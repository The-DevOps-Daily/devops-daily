'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  Activity,
  ArrowRight,
  Braces,
  CheckCircle2,
  Clock3,
  FastForward,
  Inbox,
  RefreshCw,
  RotateCcw,
  Send,
  Server,
  ShieldCheck,
  Webhook,
  XCircle,
} from 'lucide-react';
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
  { id: 'http_400', label: '400 bad request', hint: 'Drop without retrying' },
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

const RESULT_STYLES: Record<Attempt['result'], string> = {
  delivered: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  retrying: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  dropped: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  exhausted: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

const RESULT_LABELS: Record<Attempt['result'], string> = {
  delivered: 'Delivered',
  retrying: 'Retry scheduled',
  dropped: 'Dropped',
  exhausted: 'Exhausted',
};

const FLOW_TONES = {
  neutral: 'border-border bg-background text-muted-foreground',
  active: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

function StatusPill({ attempt }: { attempt: Attempt }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-2 py-1 text-xs font-medium ${RESULT_STYLES[attempt.result]}`}
    >
      {attempt.status === null ? 'Timeout' : attempt.status} · {RESULT_LABELS[attempt.result]}
    </span>
  );
}

function FlowNode({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: keyof typeof FLOW_TONES;
}) {
  return (
    <div className={`min-w-0 flex-1 rounded-md border p-3 ${FLOW_TONES[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-[10px] font-semibold uppercase opacity-70">{label}</span>
      </div>
      <p className="mt-2 truncate text-xs font-semibold text-foreground" title={value}>
        {value}
      </p>
    </div>
  );
}

function FlowArrow({ animate = false, delay = 0 }: { animate?: boolean; delay?: number }) {
  return (
    <div className="relative flex h-5 shrink-0 items-center justify-center sm:w-6">
      <ArrowRight
        aria-hidden="true"
        className={`h-4 w-4 rotate-90 sm:rotate-0 ${
          animate ? 'text-primary' : 'text-muted-foreground/60'
        }`}
      />
      {animate && (
        <>
          <span
            aria-hidden="true"
            className="webhook-packet-y absolute h-1.5 w-1.5 rounded-full bg-primary sm:hidden"
            style={{ animationDelay: `${delay}ms` }}
          />
          <span
            aria-hidden="true"
            className="webhook-packet-x absolute hidden h-1.5 w-1.5 rounded-full bg-primary sm:block"
            style={{ animationDelay: `${delay}ms` }}
          />
        </>
      )}
    </div>
  );
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
  const selectedRetryDelay =
    currentAttempt && selectedNextAttempt
      ? selectedNextAttempt.atSeconds - currentAttempt.atSeconds
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
    ? 'Waiting for a delivery'
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
      ? 'bg-sky-500'
      : lastVisibleAttempt?.result === 'delivered'
        ? 'bg-emerald-500'
        : 'bg-rose-500';
  const flowAnimationKey = active ? `${active.key}-${active.revealed}` : 'idle';

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-4 lg:flex-row lg:items-end">
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Event</span>
          <select
            value={eventIndex}
            onChange={(event) => setEventIndex(Number(event.target.value))}
            className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-xs outline-none focus:border-primary"
          >
            {SAMPLE_EVENTS.map((event, index) => (
              <option key={event.eventType} value={index}>
                {event.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 flex-[1.35]">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Endpoint response
          </span>
          <select
            value={behavior}
            onChange={(event) => setBehavior(event.target.value as EndpointBehavior)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary"
          >
            {BEHAVIORS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} - {item.hint}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => send()}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 lg:flex-none"
          >
            <Send className="h-4 w-4" />
            Send event
          </button>
          {revealing && (
            <button
              type="button"
              onClick={skipAhead}
              title="Reveal all attempts"
              aria-label="Reveal all attempts"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted"
            >
              <FastForward className="h-4 w-4" />
            </button>
          )}
          {active && (
            <button
              type="button"
              onClick={reset}
              title="Reset simulator"
              aria-label="Reset simulator"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <section className="border-b border-border p-4" aria-label="Webhook delivery path">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Delivery path</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Follow one message from your app to the receiver.
            </p>
          </div>
          <div className="min-w-0 text-right">
            <div className="flex items-center justify-end gap-1.5 text-[11px] font-medium">
              <span
                className={`h-1.5 w-1.5 rounded-full ${deliveryStatusTone} ${
                  revealing ? 'motion-safe:animate-pulse' : ''
                }`}
              />
              {deliveryStatus}
            </div>
            <div className="mt-0.5 max-w-64 truncate font-mono text-[10px] text-muted-foreground">
              {active?.messageId ?? 'Choose an event and endpoint response'}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <FlowNode
            icon={Braces}
            label="Your app"
            value={active?.event.eventType ?? SAMPLE_EVENTS[eventIndex].eventType}
            tone={active ? 'active' : 'neutral'}
          />
          <FlowArrow key={`${flowAnimationKey}-1`} animate={Boolean(active)} />
          <FlowNode
            icon={Inbox}
            label="Delivery queue"
            value={
              currentAttempt
                ? currentAttempt.result === 'retrying'
                  ? selectedRetryDelay !== null
                    ? `Next attempt in ${formatDelay(selectedRetryDelay)}`
                    : 'Retry scheduled'
                  : `Attempt ${currentAttempt.attempt} complete`
                : 'Durable message'
            }
            tone={currentAttempt?.result === 'retrying' ? 'warning' : active ? 'active' : 'neutral'}
          />
          <FlowArrow key={`${flowAnimationKey}-2`} animate={Boolean(active)} delay={140} />
          <FlowNode
            icon={ShieldCheck}
            label="Signed request"
            value={active ? 'HMAC-SHA256 attached' : 'ID + time + body'}
            tone={active ? 'active' : 'neutral'}
          />
          <FlowArrow key={`${flowAnimationKey}-3`} animate={Boolean(active)} delay={280} />
          <FlowNode
            icon={Server}
            label="Customer endpoint"
            value={
              currentAttempt
                ? currentAttempt.status === null
                  ? 'Timed out'
                  : `Responded ${currentAttempt.status}`
                : selectedBehavior.label
            }
            tone={endpointTone}
          />
          <FlowArrow
            key={`${flowAnimationKey}-4`}
            animate={currentAttempt?.result === 'delivered'}
            delay={420}
          />
          <FlowNode
            icon={Webhook}
            label="Receiver"
            value={receiverValue}
            tone={
              deliveryReachedReceiver
                ? active?.dedup?.outcome === 'duplicate_ignored'
                  ? 'warning'
                  : 'success'
                : 'neutral'
            }
          />
        </div>
      </section>

      <section className="border-b border-border p-4" aria-label="Delivery attempts">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Retry schedule</h2>
            {timeWarpDelay !== null && (
              <span
                key={`${active?.key}-${active?.revealed}`}
                aria-live="polite"
                className="relative inline-flex overflow-hidden rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 font-mono text-[10px] font-medium text-sky-700 dark:text-sky-300"
              >
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  <FastForward className="h-3 w-3" />
                  Fast-forwarding {formatDelay(timeWarpDelay)}
                </span>
                <span
                  aria-hidden="true"
                  className="webhook-time-warp absolute inset-x-0 bottom-0 h-px bg-sky-500"
                />
              </span>
            )}
          </div>
          {active && (
            <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
              <span>{stats.messages} msg</span>
              <span>{stats.attempts} attempts</span>
              <span>{stats.delivered} delivered</span>
              {stats.duplicatesIgnored > 0 && <span>{stats.duplicatesIgnored} deduped</span>}
            </div>
          )}
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="relative min-w-[640px]">
            <ol className="relative grid grid-cols-8 gap-2" aria-live="polite">
              {Array.from({ length: MAX_ATTEMPTS }, (_, index) => {
                const attempt = active?.attempts[index];
                const isRevealed = Boolean(attempt && index < active!.revealed);
                const isSelected = Boolean(active && isRevealed && index === currentAttemptIndex);
                const isUnused = Boolean(active && !attempt);

                return (
                  <li key={index}>
                    <button
                      type="button"
                      disabled={!isRevealed}
                      onClick={() => setSelectedAttemptIndex(index)}
                      ref={(node) => {
                        attemptRefs.current[index] = node;
                      }}
                      aria-label={`Attempt ${index + 1}${
                        attempt ? ` at ${formatDelay(attempt.atSeconds)}` : ''
                      }`}
                      className={`relative z-10 w-full rounded-md border px-2 py-2 text-left transition-colors ${
                        isSelected
                          ? attempt
                            ? RESULT_STYLES[attempt.result]
                            : 'border-primary bg-primary/10'
                          : isRevealed
                            ? 'border-border bg-background hover:border-primary/40'
                            : 'border-border bg-muted text-muted-foreground'
                      } ${isUnused ? 'opacity-40' : ''}`}
                    >
                      <span className="block text-[10px] font-semibold uppercase">
                        A{index + 1}
                      </span>
                      <span className="mt-1 block truncate font-mono text-[10px]">
                        {attempt
                          ? formatDelay(attempt.atSeconds)
                          : active
                            ? 'not needed'
                            : index === 0
                              ? 'now'
                              : 'waiting'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {!active && (
          <div className="mt-4 flex items-center gap-3 rounded-md border border-dashed border-border px-4 py-3">
            <Clock3 className="h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Start with <strong className="text-foreground">Intermittent</strong> to watch two
              failures recover on the third attempt.
            </p>
          </div>
        )}

        {currentAttempt && (
          <div className="mt-4 grid min-w-0 gap-4 border-t border-border pt-4 md:grid-cols-[1.5fr_1fr]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill attempt={currentAttempt} />
                <span className="font-mono text-[11px] text-muted-foreground">
                  t + {formatDelay(currentAttempt.atSeconds)} · {currentAttempt.durationMs}ms
                </span>
                {revealing && selectedAttemptIndex !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedAttemptIndex(null)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Follow latest
                  </button>
                )}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {currentAttempt.explanation}
              </p>
              {deliveryReachedReceiver && active?.dedup && (
                <div
                  className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                    active.dedup.outcome === 'duplicate_ignored'
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-emerald-500/30 bg-emerald-500/5'
                  }`}
                >
                  {active.dedup.outcome === 'duplicate_ignored' ? (
                    <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  )}
                  <div>
                    <p className="font-medium">
                      {active.dedup.outcome === 'duplicate_ignored'
                        ? 'Receiver ignored the duplicate'
                        : 'Receiver processed this message once'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Keyed by the stable message ID, then acknowledged with 200.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Endpoint response</p>
              <pre className="max-h-28 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-[11px] leading-relaxed">
                {currentAttempt.responseBody}
              </pre>
            </div>
          </div>
        )}
      </section>

      {active && (
        <section className="grid min-w-0 lg:grid-cols-[1fr_2fr]" aria-label="Request inspector">
          <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
            <h2 className="text-sm font-semibold">Inspect the delivery</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              The same request can be inspected as bytes on the wire or tested against signature
              failures.
            </p>

            <div className="mt-4 grid grid-cols-2 rounded-md border border-border bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => setInspectorTab('request')}
                aria-pressed={inspectorTab === 'request'}
                className={`rounded-sm px-3 py-2 text-xs font-medium ${
                  inspectorTab === 'request'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                Request
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('signature')}
                aria-pressed={inspectorTab === 'signature'}
                className={`rounded-sm px-3 py-2 text-xs font-medium ${
                  inspectorTab === 'signature'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                Verify signature
              </button>
            </div>

            {deliveryReachedReceiver && active.dedup && !active.isRedelivery && (
              <button
                type="button"
                onClick={() =>
                  send({ reuseMessageId: active.messageId, behaviorOverride: 'success' })
                }
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" />
                Redeliver same message
              </button>
            )}
          </div>

          <div className="min-w-0 p-4">
            {inspectorTab === 'request' ? (
              <div className="grid min-w-0 gap-3 md:grid-cols-[1.1fr_1fr]">
                <div className="min-w-0">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Headers</p>
                  <pre className="max-h-52 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-[11px] leading-relaxed">
                    {`POST /webhooks/billing HTTP/1.1
content-type: application/json
svix-id: ${active.messageId}
svix-timestamp: ${active.timestamp}
svix-signature: ${signatureHeader || 'computing...'}`}
                  </pre>
                </div>
                <div className="min-w-0">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Raw body {tamper === 'body' && '(edited after signing)'}
                  </p>
                  <pre className="max-h-52 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-[11px] leading-relaxed">
                    {presentedBody}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="min-w-0">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TAMPERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTamper(item.id)}
                      aria-pressed={tamper === item.id}
                      className={`rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
                        tamper === item.id
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border bg-background hover:bg-muted'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-[1.3fr_1fr]">
                  <div className="min-w-0">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      Signed content
                    </p>
                    <pre className="max-h-32 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-[11px] leading-relaxed">
                      {buildSignedContent(active.messageId, active.timestamp, presentedBody)}
                    </pre>
                  </div>

                  {verification && (
                    <div
                      className={`rounded-md border p-3 ${
                        verification.valid
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-rose-500/40 bg-rose-500/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {verification.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-600" />
                        )}
                        <p className="text-sm font-semibold">
                          {verification.valid
                            ? 'Signature valid'
                            : `Rejected: ${verification.failure?.replace(/_/g, ' ')}`}
                        </p>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {verification.detail}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {deliveries.length > 1 && (
        <details className="border-t border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium hover:bg-muted/30">
            Recent deliveries ({deliveries.length})
          </summary>
          <div className="divide-y divide-border border-t border-border">
            {deliveries.map((delivery) => {
              const visibleAttempt = delivery.attempts[Math.max(0, delivery.revealed - 1)];
              return (
                <div
                  key={delivery.key}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs"
                >
                  <span className="max-w-48 truncate font-mono text-muted-foreground">
                    {delivery.messageId}
                  </span>
                  <span className="font-mono">{delivery.event.eventType}</span>
                  <StatusPill attempt={visibleAttempt} />
                  {delivery.dedup?.outcome === 'duplicate_ignored' && (
                    <span className="text-amber-700 dark:text-amber-300">Duplicate ignored</span>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}

      <div className="flex flex-col gap-3 border-t border-[#2c70ff]/25 bg-[#2c70ff]/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Put this delivery path into production</p>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Svix Dispatch provides the durable queue, automatic retries, signed requests, rate
            limits, searchable attempt logs, replay, and a customer-facing endpoint portal behind
            one API.
          </p>
        </div>
        <a
          href="https://link.svix.com/devopsdaily"
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          Explore Svix Dispatch
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
      <style jsx global>{`
        @keyframes webhook-packet-x {
          from {
            opacity: 0;
            transform: translateX(-9px);
          }
          25% {
            opacity: 1;
          }
          to {
            opacity: 0;
            transform: translateX(9px);
          }
        }
        @keyframes webhook-packet-y {
          from {
            opacity: 0;
            transform: translateY(-9px);
          }
          25% {
            opacity: 1;
          }
          to {
            opacity: 0;
            transform: translateY(9px);
          }
        }
        .webhook-packet-x {
          animation: webhook-packet-x 520ms ease-out both;
        }
        .webhook-packet-y {
          animation: webhook-packet-y 520ms ease-out both;
        }
        @keyframes webhook-time-warp {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }
        .webhook-time-warp {
          animation: webhook-time-warp 700ms linear both;
          transform-origin: left;
        }
        @media (prefers-reduced-motion: reduce) {
          .webhook-packet-x,
          .webhook-packet-y,
          .webhook-time-warp {
            animation: none;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
