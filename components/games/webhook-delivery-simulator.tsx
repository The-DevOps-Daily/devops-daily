'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
 * A fixture, not a credential. Real endpoint secrets come from the provider and
 * never appear in client code; this one exists so the signatures shown below
 * are genuine and reproducible.
 */
const DEMO_SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
const ROTATED_SECRET = 'whsec_kQ8vLpNzR3TgWyBdFhJkMnPqStVwXzA2';

const BEHAVIORS: Array<{ id: EndpointBehavior; label: string; hint: string }> = [
  { id: 'success', label: '200 OK', hint: 'Delivers first time' },
  { id: 'intermittent', label: 'Intermittent', hint: 'Fails twice, then recovers' },
  { id: 'http_500', label: '500 error', hint: 'Down for good: burns the schedule' },
  { id: 'timeout', label: 'Timeout', hint: 'No response: outcome unknown' },
  { id: 'http_429', label: '429 rate limited', hint: 'You are sending too fast' },
  { id: 'http_400', label: '400 bad request', hint: 'Dropped without retrying' },
];

type Tamper = 'none' | 'body' | 'secret' | 'stale';

const TAMPERS: Array<{ id: Tamper; label: string; hint: string }> = [
  { id: 'none', label: 'Untouched', hint: 'Verifies cleanly' },
  { id: 'body', label: 'Edit the body', hint: 'One character changes the digest' },
  { id: 'secret', label: 'Wrong secret', hint: 'Signed with a rotated-out key' },
  { id: 'stale', label: 'Replay it later', hint: 'Valid digest, expired timestamp' },
];

interface Delivery {
  key: number;
  messageId: string;
  event: SampleEvent;
  body: string;
  timestamp: number;
  behavior: EndpointBehavior;
  attempts: Attempt[];
  /** How many attempts are on screen so far. */
  revealed: number;
  /** Whether this reused an earlier message ID. */
  isRedelivery: boolean;
  dedup?: DedupDecision;
}

const RESULT_STYLES: Record<Attempt['result'], string> = {
  delivered: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  retrying: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  dropped: 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  exhausted: 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

const RESULT_LABELS: Record<Attempt['result'], string> = {
  delivered: 'Delivered',
  retrying: 'Retrying',
  dropped: 'Dropped',
  exhausted: 'Exhausted',
};

function StatusPill({ attempt }: { attempt: Attempt }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${RESULT_STYLES[attempt.result]}`}
    >
      {attempt.status === null ? 'timeout' : attempt.status} {RESULT_LABELS[attempt.result]}
    </span>
  );
}

export default function WebhookDeliverySimulator() {
  const [eventIndex, setEventIndex] = useState(0);
  const [behavior, setBehavior] = useState<EndpointBehavior>('intermittent');
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [tamper, setTamper] = useState<Tamper>('none');
  const [signatureHeader, setSignatureHeader] = useState('');
  const [verification, setVerification] = useState<VerifyResult | null>(null);

  // Message IDs the receiver has already handled. A ref because it is a store,
  // not rendered state, and it must survive re-renders untouched.
  const seenRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<number[]>([]);
  const counterRef = useRef(1);

  const active = deliveries[0];

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  /** Reveal attempts one at a time so the retry chain reads as a sequence. */
  const scheduleReveal = useCallback(
    (key: number, total: number) => {
      const stepMs = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 620;
      for (let i = 2; i <= total; i++) {
        const t = window.setTimeout(
          () =>
            setDeliveries((prev) =>
              prev.map((d) => (d.key === key ? { ...d, revealed: Math.max(d.revealed, i) } : d)),
            ),
          stepMs * (i - 1),
        );
        timersRef.current.push(t);
      }
    },
    [],
  );

  const send = useCallback(
    (opts: { reuseMessageId?: string; behaviorOverride?: EndpointBehavior } = {}) => {
      clearTimers();

      const event = SAMPLE_EVENTS[eventIndex];
      const useBehavior = opts.behaviorOverride ?? behavior;
      const messageId = opts.reuseMessageId ?? makeMessageId(counterRef.current++);
      const attempts = simulateDelivery(useBehavior);

      // The receiver only gets to run its dedup check if something arrived.
      const wasDelivered = attempts.some((a) => a.result === 'delivered');
      const dedup = wasDelivered ? applyDedup(seenRef.current, messageId) : undefined;

      const delivery: Delivery = {
        key: counterRef.current,
        messageId,
        event,
        body: JSON.stringify(event.payload),
        timestamp: Math.floor(Date.now() / 1000),
        behavior: useBehavior,
        attempts,
        revealed: 1,
        isRedelivery: Boolean(opts.reuseMessageId),
        dedup,
      };

      setDeliveries((prev) => [delivery, ...prev].slice(0, 8));
      setTamper('none');
      scheduleReveal(delivery.key, attempts.length);
    },
    [behavior, clearTimers, eventIndex, scheduleReveal],
  );

  const skipAhead = useCallback(() => {
    clearTimers();
    setDeliveries((prev) =>
      prev.map((d, i) => (i === 0 ? { ...d, revealed: d.attempts.length } : d)),
    );
  }, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    seenRef.current = new Set();
    counterRef.current = 1;
    setDeliveries([]);
    setVerification(null);
    setSignatureHeader('');
    setTamper('none');
  }, [clearTimers]);

  // The body actually presented to the receiver, given the current tampering.
  const presentedBody = useMemo(() => {
    if (!active) return '';
    if (tamper !== 'body') return active.body;
    return active.body.replace(/(\d)(?=[,}"]|$)/, (d) => String((Number(d) + 1) % 10));
  }, [active, tamper]);

  // Sign, then verify, whenever the request or the tampering changes. Signing
  // is real HMAC over Web Crypto, so both are async.
  useEffect(() => {
    if (!active) {
      setSignatureHeader('');
      setVerification(null);
      return;
    }
    let cancelled = false;

    (async () => {
      // Always signed with the true secret and the untouched body: the sender
      // is honest. Tampering happens after signing, which is the threat model.
      const signingSecret = tamper === 'secret' ? ROTATED_SECRET : DEMO_SECRET;
      const header = await buildSignatureHeader(
        signingSecret,
        active.messageId,
        active.timestamp,
        active.body,
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
    const all = deliveries.flatMap((d) => d.attempts);
    return {
      messages: deliveries.length,
      attempts: all.length,
      delivered: deliveries.filter((d) => d.attempts.some((a) => a.result === 'delivered')).length,
      duplicatesIgnored: deliveries.filter((d) => d.dedup?.outcome === 'duplicate_ignored').length,
    };
  }, [deliveries]);

  const revealing = active ? active.revealed < active.attempts.length : false;

  return (
    <div className="space-y-6">
      {/* ---------------- intro ---------------- */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Send a webhook and watch what happens to it</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick an event, decide how the receiving endpoint behaves, and send it. You will see every
          delivery attempt, the exponential backoff between them, the exact headers and signature
          that go over the wire, and what a receiver should do with each response. Nothing here
          leaves your browser, and no account or API key is needed. The signatures are real
          HMAC-SHA256, so you can verify them yourself.
        </p>
      </div>

      {/* ---------------- controls ---------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <fieldset className="rounded-lg border border-border bg-card p-4">
          <legend className="px-1 text-sm font-semibold">1. The event</legend>
          <div className="mt-2 space-y-2">
            {SAMPLE_EVENTS.map((e, i) => (
              <button
                key={e.eventType}
                type="button"
                onClick={() => setEventIndex(i)}
                aria-pressed={eventIndex === i}
                className={`w-full rounded-md border px-3 py-2 text-left font-mono text-xs transition-colors ${
                  eventIndex === i
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-border bg-card p-4">
          <legend className="px-1 text-sm font-semibold">2. How the endpoint behaves</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {BEHAVIORS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBehavior(b.id)}
                aria-pressed={behavior === b.id}
                className={`rounded-md border px-3 py-2 text-left transition-colors ${
                  behavior === b.id
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border bg-muted/20 hover:bg-muted/40'
                }`}
              >
                <span className="block text-xs font-semibold">{b.label}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">
                  {b.hint}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => send()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Send event
        </button>
        {active && (
          <button
            type="button"
            onClick={() => send({ reuseMessageId: active.messageId, behaviorOverride: 'success' })}
            className="rounded-md border border-border bg-muted/30 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/60"
          >
            Redeliver the same message
          </button>
        )}
        {revealing && (
          <button
            type="button"
            onClick={skipAhead}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
          >
            Skip the wait
          </button>
        )}
        {deliveries.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
          >
            Reset
          </button>
        )}
      </div>

      {!active && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Choose an event and an endpoint behaviour, then press{' '}
          <span className="font-semibold text-foreground">Send event</span>. Try{' '}
          <span className="font-semibold text-foreground">Intermittent</span> first: it fails twice
          and then recovers, which is the case retries exist for.
        </p>
      )}

      {active && (
        <>
          {/* ---------------- counters ---------------- */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Messages', value: stats.messages },
              { label: 'Attempts made', value: stats.attempts },
              { label: 'Delivered', value: stats.delivered },
              { label: 'Duplicates ignored', value: stats.duplicatesIgnored },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-card p-3 text-center">
                <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* ---------------- timeline ---------------- */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Delivery timeline</h3>
              <span className="font-mono text-xs text-muted-foreground">{active.messageId}</span>
            </div>

            <ol className="divide-y divide-border" aria-live="polite">
              {active.attempts.slice(0, active.revealed).map((a) => (
                <li key={a.attempt} className="p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      attempt {a.attempt}/{MAX_ATTEMPTS}
                    </span>
                    <StatusPill attempt={a} />
                    <span className="font-mono text-xs text-muted-foreground">
                      t + {formatDelay(a.atSeconds)}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{a.durationMs}ms</span>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-2 font-mono text-[11px] leading-relaxed">
                    {a.responseBody}
                  </pre>
                  <p className="mt-2 text-sm text-muted-foreground">{a.explanation}</p>
                </li>
              ))}
            </ol>

            {revealing && (
              <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                Waiting out the backoff before the next attempt. Real time would be{' '}
                {formatDelay(active.attempts[active.revealed]?.atSeconds ?? 0)} from the first
                attempt.
              </div>
            )}

            {active.dedup && (
              <div
                className={`border-t border-border p-4 ${
                  active.dedup.outcome === 'duplicate_ignored' ? 'bg-amber-500/5' : 'bg-emerald-500/5'
                }`}
              >
                <h4 className="text-sm font-semibold">
                  Receiver&apos;s idempotency check:{' '}
                  {active.dedup.outcome === 'duplicate_ignored' ? 'duplicate' : 'first delivery'}
                </h4>
                <p className="mt-1 text-sm text-muted-foreground">{active.dedup.detail}</p>
                {!active.isRedelivery && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Press <span className="font-semibold">Redeliver the same message</span> to send
                    this again with the same <code className="font-mono">svix-id</code>, which is
                    what a real retry after a timeout looks like.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ---------------- request inspector ---------------- */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* min-w-0 on the grid children: without it the single-column grid
                track sizes to the longest unbroken line of JSON and the whole
                page scrolls sideways instead of the pre scrolling inside it. */}
            <div className="min-w-0 rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">The request on the wire</h3>
              </div>
              <div className="space-y-3 p-4">
                <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                  {`POST /webhooks/billing HTTP/1.1
host: api.customer.example
content-type: application/json
user-agent: Svix-Webhooks/1.4
svix-id: ${active.messageId}
svix-timestamp: ${active.timestamp}
svix-signature: ${signatureHeader || 'computing...'}`}
                </pre>
                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">
                    Body {tamper === 'body' && '(edited after signing)'}
                  </div>
                  <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                    {presentedBody}
                  </pre>
                </div>
              </div>
            </div>

            {/* ---------------- signature lab ---------------- */}
            <div className="min-w-0 rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Signature verification</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Break it on purpose and see which check catches it.
                </p>
              </div>
              <div className="space-y-3 p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {TAMPERS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTamper(t.id)}
                      aria-pressed={tamper === t.id}
                      className={`rounded-md border px-3 py-2 text-left transition-colors ${
                        tamper === t.id
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border bg-muted/20 hover:bg-muted/40'
                      }`}
                    >
                      <span className="block text-xs font-semibold">{t.label}</span>
                      <span className="block text-[11px] leading-snug text-muted-foreground">
                        {t.hint}
                      </span>
                    </button>
                  ))}
                </div>

                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">
                    Signed content
                  </div>
                  <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
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
                    <div className="text-sm font-semibold">
                      {verification.valid
                        ? 'Signature valid'
                        : `Rejected: ${verification.failure?.replace(/_/g, ' ')}`}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{verification.detail}</p>
                    {!verification.valid && verification.expected && (
                      <dl className="mt-2 space-y-1 font-mono text-[11px]">
                        <div>
                          <dt className="inline text-muted-foreground">computed: </dt>
                          <dd className="inline break-all">{verification.expected}</dd>
                        </div>
                        <div>
                          <dt className="inline text-muted-foreground">received: </dt>
                          <dd className="inline break-all">
                            {signatureHeader.replace(/^v1,/, '')}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ---------------- log ---------------- */}
          {deliveries.length > 1 && (
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Delivery log</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  The thing customers actually ask for. Every message, every attempt, still
                  readable an hour later.
                </p>
              </div>
              <div className="divide-y divide-border">
                {deliveries.map((d) => {
                  const final = d.attempts.at(-1)!;
                  return (
                    <div
                      key={d.key}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs"
                    >
                      <span className="font-mono text-muted-foreground">{d.messageId}</span>
                      <span className="font-mono">{d.event.eventType}</span>
                      <StatusPill attempt={final} />
                      <span className="text-muted-foreground">
                        {d.attempts.length} attempt{d.attempts.length === 1 ? '' : 's'}
                      </span>
                      {d.isRedelivery && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          redelivery
                        </span>
                      )}
                      {d.dedup?.outcome === 'duplicate_ignored' && (
                        <span className="text-amber-600 dark:text-amber-400">
                          deduplicated by receiver
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---------------- receiver code ---------------- */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">What the receiver looks like</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                The status codes are doing real work: 400 stops the retries, 500 invites them, 200
                on a duplicate ends a chain early.
              </p>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed">
              {`import { Webhook, WebhookVerificationError } from 'svix';

const wh = new Webhook(process.env.SVIX_WEBHOOK_SECRET);

// express.raw, not express.json: the signature covers the raw bytes.
app.post('/webhooks/billing', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = wh.verify(req.body, req.headers);
  } catch (err) {
    if (err instanceof WebhookVerificationError) return res.status(400).send('bad signature');
    throw err;
  }

  const messageId = req.header('svix-id');
  try {
    await db.$transaction(async (tx) => {
      await tx.processedWebhook.create({ data: { id: messageId } });  // unique index
      await applyEvent(tx, event);
    });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(200).send('duplicate');
    return res.status(500).send('handler failed');   // deliberately retryable
  }

  res.status(200).send('ok');
});`}
            </pre>
          </div>
        </>
      )}

      {/* ---------------- sponsor ---------------- */}
      <div className="rounded-lg border border-[#2c70ff]/30 bg-[#2c70ff]/[0.05] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">How this works in production</h3>
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
            Sponsor
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          The retry schedule above is the one{' '}
          <a
            href="https://www.svix.com/?ref=devops-daily"
            className="font-medium text-primary underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer sponsored"
          >
            Svix Dispatch
          </a>{' '}
          uses: eight attempts spread over about 27 hours, then the message is marked failed and an
          operational webhook tells you about it. Endpoints that stay broken get disabled rather
          than retried forever, each endpoint has its own secret and rate limit, and your customers
          get a delivery log and a replay button of their own instead of opening a ticket. If you
          want the mechanics rather than the product, our{' '}
          <a
            href="/posts/reliable-webhook-delivery-retries-signatures-idempotency"
            className="font-medium text-primary underline underline-offset-2"
          >
            guide to webhook delivery in production
          </a>{' '}
          has the working Node code for both sides.
        </p>
      </div>
    </div>
  );
}
