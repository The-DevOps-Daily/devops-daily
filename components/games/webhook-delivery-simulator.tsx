'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { Activity, Clock3, FastForward, RefreshCw, Send, Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFrame,
  SimMissionList,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  useMissions,
  type Mission,
  type SimTone,
} from '@/components/games/sim';
import {
  MAX_ATTEMPTS,
  SAMPLE_EVENTS,
  TIMESTAMP_TOLERANCE_SECONDS,
  applyDedup,
  buildSignatureHeader,
  buildSignedContent,
  formatDelay,
  makeMessageId,
  simulateDelivery,
  verifyWebhook,
  type Attempt,
  type DedupDecision,
  type EndpointBehavior,
  type SampleEvent,
  type VerifyResult,
} from '@/lib/games/webhook-delivery-engine';

/**
 * Fixtures, not credentials. They keep the signatures in the simulator genuine
 * and reproducible without sending data outside the browser.
 */
const webhookSecret = (value: string) => ['whsec', value].join('_');
const DEMO_SECRET = webhookSecret('MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw');
const ROTATED_SECRET = webhookSecret('kQ8vLpNzR3TgWyBdFhJkMnPqStVwXzA2');

const BEHAVIORS: Array<{ id: EndpointBehavior; label: string; hint: string }> = [
  { id: 'success', label: '200 OK', hint: 'Delivered immediately' },
  { id: 'intermittent', label: 'Intermittent', hint: 'Fails twice, then recovers' },
  { id: 'http_500', label: '500 error', hint: 'Retries until exhausted' },
  { id: 'timeout', label: 'Timeout', hint: 'Outcome is unknown' },
  { id: 'http_429', label: '429 rate limited', hint: 'Back off and retry' },
  { id: 'http_400', label: '400 bad request', hint: 'Retried like any non-2xx' },
];

type Tamper = 'none' | 'body' | 'secret' | 'stale';
type InspectorTab = 'request' | 'signature';

const TAMPERS: Array<{ id: Tamper; label: string }> = [
  { id: 'none', label: 'Untouched' },
  { id: 'body', label: 'Edit body' },
  { id: 'secret', label: 'Wrong secret' },
  { id: 'stale', label: 'Replay later' },
];

interface Delivery {
  key: number;
  messageId: string;
  event: SampleEvent;
  body: string;
  timestamp: number;
  behavior: EndpointBehavior;
  attempts: Attempt[];
  revealed: number;
  isRedelivery: boolean;
  dedup?: DedupDecision;
}

const RESULT_TONES: Record<Attempt['result'], SimTone> = {
  delivered: 'success',
  retrying: 'warning',
  exhausted: 'danger',
};

const RESULT_LABELS: Record<Attempt['result'], string> = {
  delivered: 'Delivered',
  retrying: 'Retry scheduled',
  exhausted: 'Exhausted',
};

const FLOW_TONES = {
  neutral: 'fill-muted stroke-border',
  active: 'fill-primary/10 stroke-primary',
  success: 'fill-correct/10 stroke-correct',
  warning: 'fill-partial/10 stroke-partial',
  danger: 'fill-wrong/10 stroke-wrong',
};

type WebhookMissionState = Pick<
  { deliveries: Delivery[]; tamper: Tamper; verification: VerifyResult | null },
  'deliveries' | 'tamper' | 'verification'
>;

const WEBHOOK_MISSIONS: Mission<WebhookMissionState>[] = [
  {
    id: 'deliver',
    label: 'Deliver an event to a healthy endpoint.',
    hint: 'Pick 200 OK in the endpoint menu and press Send event.',
    check: ({ deliveries }) =>
      deliveries.some((delivery) => delivery.attempts[0]?.result === 'delivered'),
  },
  {
    id: 'retry',
    label: 'Ride out a flaky endpoint with retries and backoff.',
    hint: 'Pick Intermittent in the endpoint menu and press Send event.',
    check: ({ deliveries }) =>
      deliveries.some((delivery) =>
        delivery.attempts
          .slice(0, delivery.revealed)
          .some((attempt, index) => index > 0 && attempt.result === 'delivered')
      ),
  },
  {
    id: 'tamper',
    label: 'Tamper with a delivery and watch the signature check reject it.',
    hint: 'Open Verify signature and pick Edit body, Wrong secret or Replay later.',
    check: ({ tamper, verification }) => tamper !== 'none' && verification?.valid === false,
  },
  {
    id: 'dedupe',
    label: 'Send the same event twice and see the receiver skip the duplicate.',
    hint: 'After a delivery, press Redeliver same message.',
    check: ({ deliveries }) =>
      deliveries.some((delivery) => delivery.dedup?.outcome === 'duplicate_ignored'),
  },
];

function shortEvent(eventType: string): string {
  return eventType.length > 16 ? `${eventType.slice(0, 15)}…` : eventType;
}

export default function WebhookDeliverySimulator() {
  const [eventIndex, setEventIndex] = useState(0);
  const [behavior, setBehavior] = useState<EndpointBehavior>('intermittent');
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedAttemptIndex, setSelectedAttemptIndex] = useState<number | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('request');
  const [tamper, setTamper] = useState<Tamper>('none');
  const [signatureHeader, setSignatureHeader] = useState('');
  const [verification, setVerification] = useState<VerifyResult | null>(null);
  const [tab, setTab] = useState('delivery');
  const [dismissed, setDismissed] = useState(false);

  const seenRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<number[]>([]);
  const attemptRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const messageCounterRef = useRef(1);
  const deliveryKeyRef = useRef(1);

  const active = deliveries[0];

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const scheduleReveal = useCallback((key: number, total: number) => {
    const stepMs = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 700;
    for (let i = 2; i <= total; i++) {
      const timer = window.setTimeout(
        () =>
          setDeliveries((previous) =>
            previous.map((delivery) =>
              delivery.key === key
                ? { ...delivery, revealed: Math.max(delivery.revealed, i) }
                : delivery
            )
          ),
        stepMs * (i - 1)
      );
      timersRef.current.push(timer);
    }
  }, []);

  const send = useCallback(
    (options: { reuseMessageId?: string; behaviorOverride?: EndpointBehavior } = {}) => {
      clearTimers();

      const event = SAMPLE_EVENTS[eventIndex];
      const endpointBehavior = options.behaviorOverride ?? behavior;
      const messageId = options.reuseMessageId ?? makeMessageId(messageCounterRef.current++);
      const attempts = simulateDelivery(endpointBehavior);
      const delivered = attempts.some((attempt) => attempt.result === 'delivered');
      const dedup = delivered ? applyDedup(seenRef.current, messageId) : undefined;

      const delivery: Delivery = {
        key: deliveryKeyRef.current++,
        messageId,
        event,
        body: JSON.stringify(event.payload),
        timestamp: Math.floor(Date.now() / 1000),
        behavior: endpointBehavior,
        attempts,
        revealed: 1,
        isRedelivery: Boolean(options.reuseMessageId),
        dedup,
      };

      setDeliveries((previous) =>
        [delivery, ...previous.map((item) => ({ ...item, revealed: item.attempts.length }))].slice(
          0,
          8
        )
      );
      setSelectedAttemptIndex(null);
      setTamper('none');
      setInspectorTab('request');
      scheduleReveal(delivery.key, attempts.length);
    },
    [behavior, clearTimers, eventIndex, scheduleReveal]
  );

  const skipAhead = useCallback(() => {
    clearTimers();
    setDeliveries((previous) =>
      previous.map((delivery, index) =>
        index === 0 ? { ...delivery, revealed: delivery.attempts.length } : delivery
      )
    );
    setSelectedAttemptIndex(null);
  }, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    seenRef.current = new Set();
    messageCounterRef.current = 1;
    deliveryKeyRef.current = 1;
    setDeliveries([]);
    setSelectedAttemptIndex(null);
    setVerification(null);
    setSignatureHeader('');
    setTamper('none');
    setInspectorTab('request');
  }, [clearTimers]);

  const presentedBody = useMemo(() => {
    if (!active) return '';
    if (tamper !== 'body') return active.body;
    return active.body.replace(/(\d)(?=[,}"]|$)/, (digit) => String((Number(digit) + 1) % 10));
  }, [active, tamper]);

  useEffect(() => {
    let cancelled = false;

    if (!active) {
      queueMicrotask(() => {
        if (!cancelled) {
          setSignatureHeader('');
          setVerification(null);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const signingSecret = tamper === 'secret' ? ROTATED_SECRET : DEMO_SECRET;
      const header = await buildSignatureHeader(
        signingSecret,
        active.messageId,
        active.timestamp,
        active.body
      );
      if (cancelled) return;
      setSignatureHeader(header);

      const result = await verifyWebhook({
        secret: DEMO_SECRET,
        id: active.messageId,
        timestamp: active.timestamp,
        body: presentedBody,
        signatureHeader: header,
        nowSeconds:
          tamper === 'stale'
            ? active.timestamp + TIMESTAMP_TOLERANCE_SECONDS + 120
            : active.timestamp,
      });
      if (!cancelled) setVerification(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [active, presentedBody, tamper]);

  const stats = useMemo(() => {
    const visibleAttempts = deliveries.flatMap((delivery) =>
      delivery.attempts.slice(0, delivery.revealed)
    );
    return {
      messages: deliveries.length,
      attempts: visibleAttempts.length,
      delivered: deliveries.filter((delivery) =>
        delivery.attempts
          .slice(0, delivery.revealed)
          .some((attempt) => attempt.result === 'delivered')
      ).length,
      duplicatesIgnored: deliveries.filter(
        (delivery) =>
          delivery.dedup?.outcome === 'duplicate_ignored' &&
          delivery.attempts
            .slice(0, delivery.revealed)
            .some((attempt) => attempt.result === 'delivered')
      ).length,
    };
  }, [deliveries]);

  const revealing = active ? active.revealed < active.attempts.length : false;
  const currentAttemptIndex = active
    ? Math.min(selectedAttemptIndex ?? active.revealed - 1, active.revealed - 1)
    : 0;
  const currentAttempt = active?.attempts[currentAttemptIndex];
  const selectedNextAttempt = active?.attempts[currentAttemptIndex + 1];
  const lastVisibleAttempt = active?.attempts[Math.max(0, active.revealed - 1)];
  const nextScheduledAttempt = active?.attempts[active.revealed];
  // The retry gap runs from the moment the attempt failed, not from when it started.
  const selectedRetryDelay =
    currentAttempt && selectedNextAttempt
      ? selectedNextAttempt.atSeconds - currentAttempt.atSeconds - currentAttempt.durationMs / 1000
      : null;
  const timeWarpDelay =
    revealing && lastVisibleAttempt && nextScheduledAttempt
      ? nextScheduledAttempt.atSeconds - lastVisibleAttempt.atSeconds
      : null;
  const deliveryReachedReceiver = active
    ? active.attempts.slice(0, active.revealed).some((attempt) => attempt.result === 'delivered')
    : false;
  const selectedBehavior = BEHAVIORS.find((item) => item.id === behavior)!;

  const endpointTone: keyof typeof FLOW_TONES =
    currentAttempt?.result === 'delivered'
      ? 'success'
      : currentAttempt?.result === 'retrying'
        ? 'warning'
        : currentAttempt
          ? 'danger'
          : 'neutral';

  const receiverValue = !active
    ? 'Waiting'
    : deliveryReachedReceiver
      ? active.dedup?.outcome === 'duplicate_ignored'
        ? 'Duplicate ignored'
        : 'Event processed'
      : currentAttempt?.status === null
        ? 'Outcome unknown'
        : 'Not reached';

  useEffect(() => {
    if (!active || selectedAttemptIndex !== null) return;
    attemptRefs.current[active.revealed - 1]?.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [active, selectedAttemptIndex]);

  const deliveryStatus = !active
    ? 'Ready'
    : revealing
      ? `Following attempt ${active.revealed} of ${active.attempts.length}`
      : RESULT_LABELS[lastVisibleAttempt!.result];
  const deliveryStatusTone = !active
    ? 'bg-muted-foreground'
    : revealing
      ? 'bg-primary'
      : lastVisibleAttempt?.result === 'delivered'
        ? 'bg-correct'
        : 'bg-wrong';
  const flowAnimationKey = active ? `${active.key}-${active.revealed}` : 'idle';
  const missionState = useMemo(
    () => ({ deliveries, tamper, verification }),
    [deliveries, tamper, verification]
  );
  const { reset: resetMissions, ...missions } = useMissions(WEBHOOK_MISSIONS, missionState);
  const startOver = useCallback(() => {
    reset();
    resetMissions();
    setDismissed(false);
    setTab('delivery');
  }, [reset, resetMissions]);

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="Webhook delivery"
          icon={Webhook}
          lead={
            <>
              <label className="min-w-32 flex-1">
                <span className="sr-only">Event</span>
                <select
                  aria-label="Event"
                  value={eventIndex}
                  onChange={(event) => setEventIndex(Number(event.target.value))}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-xs outline-none focus:border-primary lg:h-8"
                >
                  {SAMPLE_EVENTS.map((event, index) => (
                    <option key={event.eventType} value={index}>
                      {event.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-36 flex-[1.25]">
                <span className="sr-only">Endpoint response</span>
                <select
                  aria-label="Endpoint response"
                  value={behavior}
                  onChange={(event) => setBehavior(event.target.value as EndpointBehavior)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary lg:h-8"
                >
                  {BEHAVIORS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} - {item.hint}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="button" className="h-10 lg:h-8" onClick={() => send()}>
                <Send className="h-4 w-4" aria-hidden="true" />
                Send event
              </Button>
            </>
          }
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={missions.complete ? 'Webhook delivery practice complete' : deliveryStatus}
          goal={
            missions.complete ? (
              'Try another delivery path whenever you like.'
            ) : (
              <>
                {missions.current?.label}{' '}
                <span className="text-muted-foreground">{missions.current?.hint}</span>
              </>
            )
          }
        />
        <SimAnnouncer
          message={
            missions.complete
              ? 'All webhook delivery missions are complete.'
              : `${deliveryStatus}. ${missions.current?.label ?? ''}`
          }
        />
        {missions.complete && !dismissed ? (
          <SimComplete
            title="Webhook delivery missions complete"
            summary="You signed requests, recovered from a flaky endpoint, rejected tampering, and ignored a duplicate."
            stats={[
              { label: 'Events sent', value: stats.messages },
              { label: 'Attempts seen', value: stats.attempts },
              { label: 'Duplicates skipped', value: stats.duplicatesIgnored },
            ]}
            actions={
              <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
                Keep exploring
              </Button>
            }
            onPlayAgain={startOver}
            playAgainLabel="Start over"
          />
        ) : (
          <SimStage
            columns="lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]"
            tab={tab}
            onTabChange={setTab}
            tabsLabel="Webhook simulator panels"
            panels={[
              {
                id: 'delivery',
                label: 'Delivery',
                content: (
                  <section
                    className="space-y-2 rounded-lg border bg-card p-3"
                    aria-label="Webhook delivery"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold">Delivery path</h2>
                        <p className="text-xs text-muted-foreground">
                          One signed event travels from sender to receiver.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span
                          aria-hidden="true"
                          className={`h-2 w-2 rounded-full ${deliveryStatusTone} ${
                            revealing ? 'motion-safe:animate-pulse' : ''
                          }`}
                        />
                        {deliveryStatus}
                      </div>
                    </div>

                    <svg
                      key={flowAnimationKey}
                      viewBox="0 0 390 126"
                      role="img"
                      aria-label={`Delivery path: sender, network, and receiver. ${receiverValue}.`}
                      className="mx-auto block w-full max-w-[390px] rounded-md border bg-muted/20"
                    >
                      <path
                        d="M116 63H140M250 63H274"
                        className="stroke-muted-foreground"
                        strokeWidth="2"
                      />
                      <path d="M132 58l8 5-8 5M266 58l8 5-8 5" className="fill-muted-foreground" />
                      <rect
                        x="6"
                        y="31"
                        width="110"
                        height="64"
                        rx="8"
                        className="fill-primary/10 stroke-primary"
                      />
                      <rect
                        x="140"
                        y="31"
                        width="110"
                        height="64"
                        rx="8"
                        className={FLOW_TONES[endpointTone]}
                      />
                      <rect
                        x="274"
                        y="31"
                        width="110"
                        height="64"
                        rx="8"
                        className={
                          deliveryReachedReceiver
                            ? active?.dedup?.outcome === 'duplicate_ignored'
                              ? 'fill-partial/10 stroke-partial'
                              : 'fill-correct/10 stroke-correct'
                            : 'fill-muted stroke-border'
                        }
                      />
                      <text
                        x="61"
                        y="55"
                        textAnchor="middle"
                        className="fill-foreground text-xs font-semibold"
                      >
                        Sender
                      </text>
                      <text
                        x="61"
                        y="74"
                        textAnchor="middle"
                        className="fill-muted-foreground text-xs"
                      >
                        {shortEvent(active?.event.eventType ?? SAMPLE_EVENTS[eventIndex].eventType)}
                      </text>
                      <text
                        x="195"
                        y="55"
                        textAnchor="middle"
                        className="fill-foreground text-xs font-semibold"
                      >
                        Signed network
                      </text>
                      <text
                        x="195"
                        y="74"
                        textAnchor="middle"
                        className="fill-muted-foreground text-xs"
                      >
                        {currentAttempt
                          ? `Attempt ${currentAttempt.attempt}`
                          : selectedBehavior.label}
                      </text>
                      <text
                        x="329"
                        y="55"
                        textAnchor="middle"
                        className="fill-foreground text-xs font-semibold"
                      >
                        Receiver
                      </text>
                      <text
                        x="329"
                        y="74"
                        textAnchor="middle"
                        className="fill-muted-foreground text-xs"
                      >
                        {receiverValue}
                      </text>
                      {active && <circle cx="128" cy="63" r="4" className="fill-primary" />}
                    </svg>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{stats.messages} events</span>
                      <span>{stats.attempts} attempts</span>
                      <span>{stats.delivered} delivered</span>
                      {stats.duplicatesIgnored > 0 && (
                        <span>{stats.duplicatesIgnored} deduped</span>
                      )}
                    </div>

                    <div className="space-y-2" aria-label="Delivery attempts">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <h3 className="text-sm font-semibold">Retry schedule</h3>
                        </div>
                        {timeWarpDelay !== null && (
                          <span
                            className={`rounded-md border px-2 py-1 text-xs ${SIM_TONE.info.surface}`}
                          >
                            Fast-forwarding {formatDelay(timeWarpDelay)}
                          </span>
                        )}
                        {revealing && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-10 lg:h-8"
                            onClick={skipAhead}
                          >
                            <FastForward className="h-4 w-4" aria-hidden="true" />
                            Reveal all attempts
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2 md:hidden">
                        {Array.from({ length: MAX_ATTEMPTS }, (_, index) => {
                          const attempt = active?.attempts[index];
                          const isRevealed = Boolean(attempt && index < active!.revealed);
                          const isSelected = Boolean(
                            active && isRevealed && index === currentAttemptIndex
                          );
                          const tone = attempt ? SIM_TONE[RESULT_TONES[attempt.result]] : null;
                          return (
                            <button
                              key={index}
                              type="button"
                              disabled={!isRevealed}
                              onClick={() => setSelectedAttemptIndex(index)}
                              ref={(node) => {
                                attemptRefs.current[index] = node;
                              }}
                              className={`flex min-h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs ${
                                isSelected && tone
                                  ? `${tone.surface} ${tone.text}`
                                  : isRevealed
                                    ? 'border-border bg-background hover:border-primary/40'
                                    : 'border-border bg-muted text-muted-foreground'
                              }`}
                            >
                              <span className="font-semibold">Attempt {index + 1}</span>
                              <span className="font-mono">
                                {attempt
                                  ? `${formatDelay(attempt.atSeconds)} · ${RESULT_LABELS[attempt.result]}`
                                  : active
                                    ? 'not needed'
                                    : index === 0
                                      ? 'now'
                                      : 'waiting'}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-left text-xs">
                          <thead className="text-muted-foreground">
                            <tr className="border-b">
                              <th className="px-2 py-2 font-medium">Attempt</th>
                              <th className="px-2 py-2 font-medium">At</th>
                              <th className="px-2 py-2 font-medium">Response</th>
                              <th className="px-2 py-2 font-medium">Outcome</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: MAX_ATTEMPTS }, (_, index) => {
                              const attempt = active?.attempts[index];
                              const isRevealed = Boolean(attempt && index < active!.revealed);
                              const isSelected = Boolean(
                                active && isRevealed && index === currentAttemptIndex
                              );
                              const tone = attempt ? SIM_TONE[RESULT_TONES[attempt.result]] : null;
                              return (
                                <tr
                                  key={index}
                                  className={
                                    isSelected && tone ? `${tone.surface} ${tone.text}` : 'border-b'
                                  }
                                >
                                  <td className="px-2 py-2">{index + 1}</td>
                                  <td className="px-2 py-2 font-mono">
                                    {attempt ? formatDelay(attempt.atSeconds) : 'none'}
                                  </td>
                                  <td className="px-2 py-2">
                                    {attempt?.status ?? (attempt ? 'Timeout' : 'none')}
                                  </td>
                                  <td className="px-2 py-2">
                                    {isRevealed ? (
                                      <button
                                        type="button"
                                        className="min-h-10 rounded-md px-2 text-left hover:bg-muted"
                                        onClick={() => setSelectedAttemptIndex(index)}
                                      >
                                        {attempt ? RESULT_LABELS[attempt.result] : 'none'}
                                      </button>
                                    ) : (
                                      'Waiting'
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {!active && (
                      <div className="flex items-center gap-3 rounded-md border border-dashed border-border px-3 py-2">
                        <Clock3
                          className="h-5 w-5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <p className="text-sm text-muted-foreground">
                          Choose a response, then send an event to see the durable retry schedule.
                        </p>
                      </div>
                    )}

                    {currentAttempt && (
                      <div className="grid gap-3 border-t pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md border px-2 py-1 text-xs font-medium ${SIM_TONE[RESULT_TONES[currentAttempt.result]].surface} ${SIM_TONE[RESULT_TONES[currentAttempt.result]].text}`}
                          >
                            {currentAttempt.status === null ? 'Timeout' : currentAttempt.status} ·{' '}
                            {RESULT_LABELS[currentAttempt.result]}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            t + {formatDelay(currentAttempt.atSeconds)} ·{' '}
                            {currentAttempt.durationMs}ms
                          </span>
                          {revealing && selectedAttemptIndex !== null && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-10 lg:h-8"
                              onClick={() => setSelectedAttemptIndex(null)}
                            >
                              Follow latest
                            </Button>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {currentAttempt.explanation}
                        </p>
                        {selectedRetryDelay !== null && (
                          <p className="text-xs text-muted-foreground">
                            Next retry begins after {formatDelay(selectedRetryDelay)}.
                          </p>
                        )}
                        {deliveryReachedReceiver && active?.dedup && (
                          <div
                            className={`rounded-md border px-3 py-2 text-sm ${active.dedup.outcome === 'duplicate_ignored' ? SIM_TONE.warning.surface : SIM_TONE.success.surface}`}
                          >
                            {active.dedup.outcome === 'duplicate_ignored'
                              ? 'Receiver ignored this duplicate by message ID.'
                              : 'Receiver processed this message once.'}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                ),
              },
              {
                id: 'details',
                label: 'Details',
                content: (
                  <section
                    className="space-y-3 rounded-lg border bg-card p-3"
                    aria-label="Webhook details"
                  >
                    <div>
                      <h2 className="text-sm font-semibold">Inspect and practice</h2>
                      <p className="text-xs text-muted-foreground">
                        Review the raw request, test verification, and track each mission.
                      </p>
                    </div>
                    <SimMissionList missions={missions.missions} />
                    {active ? (
                      <>
                        <div className="grid grid-cols-2 rounded-md border bg-muted/30 p-1">
                          <Button
                            type="button"
                            variant={inspectorTab === 'request' ? 'secondary' : 'ghost'}
                            className="h-10 text-xs"
                            aria-pressed={inspectorTab === 'request'}
                            onClick={() => setInspectorTab('request')}
                          >
                            Request
                          </Button>
                          <Button
                            type="button"
                            variant={inspectorTab === 'signature' ? 'secondary' : 'ghost'}
                            className="h-10 text-xs"
                            aria-pressed={inspectorTab === 'signature'}
                            onClick={() => setInspectorTab('signature')}
                          >
                            Verify signature
                          </Button>
                        </div>
                        {deliveryReachedReceiver && active.dedup && (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 w-full"
                            onClick={() =>
                              send({
                                reuseMessageId: active.messageId,
                                behaviorOverride: 'success',
                              })
                            }
                          >
                            <RefreshCw className="h-4 w-4" aria-hidden="true" />
                            Redeliver same message
                          </Button>
                        )}
                        {inspectorTab === 'request' ? (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              Request and signature
                            </p>
                            <pre className="max-h-52 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed">{`POST /webhooks/billing HTTP/1.1
content-type: application/json
svix-id: ${active.messageId}
svix-timestamp: ${active.timestamp}
svix-signature: ${signatureHeader || 'computing...'}

${presentedBody}`}</pre>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              {TAMPERS.map((item) => (
                                <Button
                                  key={item.id}
                                  type="button"
                                  variant={tamper === item.id ? 'secondary' : 'outline'}
                                  className="h-10 text-xs"
                                  aria-pressed={tamper === item.id}
                                  onClick={() => setTamper(item.id)}
                                >
                                  {item.label}
                                </Button>
                              ))}
                            </div>
                            <pre className="max-h-28 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed">
                              {buildSignedContent(
                                active.messageId,
                                active.timestamp,
                                presentedBody
                              )}
                            </pre>
                            {verification && (
                              <div
                                className={`rounded-md border p-3 text-sm ${verification.valid ? SIM_TONE.success.surface : SIM_TONE.danger.surface}`}
                              >
                                <p className="font-semibold">
                                  {verification.valid
                                    ? 'Signature valid'
                                    : `Rejected: ${verification.failure?.replace(/_/g, ' ')}`}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {verification.detail}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        Send an event to inspect its signed request.
                      </p>
                    )}
                    <details className="rounded-lg border bg-card p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        How webhook delivery stays safe
                      </summary>
                      <p className="mt-2 text-sm text-muted-foreground">
                        The sender signs the timestamp and raw body with HMAC-SHA256. Receivers
                        reject old timestamps, compare signatures in constant time, and dedupe
                        stable event IDs because delivery is at least once.
                      </p>
                    </details>
                  </section>
                ),
              },
            ]}
          />
        )}
        {!(missions.complete && !dismissed) && (
          <SimPhoneBar>
            <Button type="button" className="h-10 flex-1" onClick={() => send()}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Send event
            </Button>
            {revealing && (
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={skipAhead}
                aria-label="Reveal all attempts"
              >
                <FastForward className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </SimPhoneBar>
        )}
      </SimFrame>
    </MotionConfig>
  );
}
