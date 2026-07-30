/**
 * Pure logic behind the webhook delivery simulator.
 *
 * Everything here is deliberately free of React and of any network access, so
 * the retry, classification and signature rules can be tested directly. The
 * signing is real HMAC-SHA256 via Web Crypto, which works unchanged in the
 * browser and in Node, so the signatures the simulator displays are ones you
 * could verify yourself with the svix library or a few lines of `crypto`.
 */

/** How a simulated endpoint responds. */
export type EndpointBehavior =
  | 'success'
  | 'timeout'
  | 'http_400'
  | 'http_429'
  | 'http_500'
  | 'intermittent';

export type AttemptResult =
  /** 2xx: the chain ends here, successfully. */
  | 'delivered'
  /** Retryable failure, and attempts remain. */
  | 'retrying'
  /** Non-retryable failure: no point trying again. */
  | 'dropped'
  /** Retryable failure, but the schedule ran out. */
  | 'exhausted';

/**
 * Svix's published retry schedule, as gaps between attempts in seconds.
 * Attempt 1 is immediate; each later entry is the wait after the previous
 * attempt failed. Eight attempts total.
 *
 * @see https://docs.svix.com/retries
 */
export const RETRY_GAPS_SECONDS = [0, 5, 5 * 60, 30 * 60, 2 * 3600, 5 * 3600, 10 * 3600, 10 * 3600];

export const MAX_ATTEMPTS = RETRY_GAPS_SECONDS.length;

/** Seconds from the first attempt to attempt `n` (1-based). */
export function cumulativeDelaySeconds(attempt: number): number {
  return RETRY_GAPS_SECONDS.slice(0, Math.max(0, attempt)).reduce((a, b) => a + b, 0);
}

/** "immediately", "5s", "5m", "2h 5m" and so on. Used in the timeline. */
export function formatDelay(seconds: number): string {
  if (seconds <= 0) return 'immediately';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(' ');
}

export interface Classification {
  retryable: boolean;
  /** Short label for a status badge. */
  label: string;
  /** Why this class of response is or is not worth retrying. */
  reason: string;
}

/**
 * Decide whether a response is worth another attempt.
 *
 * `null` means the request timed out, which is the genuinely ambiguous case:
 * the receiver may well have processed it and simply failed to answer in time.
 * Retrying is the safer choice, and it is exactly why the receiving side needs
 * to deduplicate.
 */
export function classifyResponse(status: number | null): Classification {
  if (status === null) {
    return {
      retryable: true,
      label: 'Timeout',
      reason:
        'No response before the timeout. The receiver may have processed this anyway, so a retry can produce a duplicate. Retrying is still right; the receiver has to be safe to run twice.',
    };
  }
  if (status >= 200 && status < 300) {
    return { retryable: true, label: `${status} OK`, reason: 'Delivered. The chain ends here.' };
  }
  if (status === 429) {
    return {
      retryable: true,
      label: '429 Rate limited',
      reason:
        'You are sending faster than this endpoint accepts. Retry, but also lower the configured rate for it, or the same thing happens on every event.',
    };
  }
  if (status === 408) {
    return {
      retryable: true,
      label: '408 Request Timeout',
      reason: 'The server asked for the request again. Retryable.',
    };
  }
  if (status >= 500) {
    return {
      retryable: true,
      label: `${status} Server error`,
      reason:
        'The endpoint is broken right now, which is the case retries exist for. Often a deploy in progress.',
    };
  }
  if (status === 401 || status === 403) {
    return {
      retryable: false,
      label: `${status} Auth failure`,
      reason:
        'Their credentials are wrong. No number of retries fixes a misconfiguration, so this stops here.',
    };
  }
  if (status === 404 || status === 410) {
    return {
      retryable: false,
      label: `${status} Gone`,
      reason:
        'The URL does not exist. 410 in particular is an explicit "stop sending", so treat it as final.',
    };
  }
  if (status >= 400) {
    return {
      retryable: false,
      label: `${status} Bad request`,
      reason:
        'The endpoint rejected the payload itself. Ten identical retries are ten identical rejections, so this drops immediately instead of burning the schedule.',
    };
  }
  return { retryable: true, label: `${status}`, reason: 'Unexpected status. Treated as retryable.' };
}

export interface Attempt {
  /** 1-based. */
  attempt: number;
  /** null for a timeout. */
  status: number | null;
  result: AttemptResult;
  /** Seconds from the first attempt to this one. */
  atSeconds: number;
  /** What the endpoint sent back. */
  responseBody: string;
  /** How long the endpoint took. */
  durationMs: number;
  /** Why the delivery moved to this state. */
  explanation: string;
}

/** What a given behavior returns on a given attempt. */
function respond(
  behavior: EndpointBehavior,
  attempt: number,
): { status: number | null; body: string; durationMs: number } {
  switch (behavior) {
    case 'success':
      return { status: 200, body: 'ok', durationMs: 42 };
    case 'timeout':
      // No response at all. 30s is a common sender-side timeout.
      return { status: null, body: '(no response, connection held open)', durationMs: 30000 };
    case 'http_400':
      return {
        status: 400,
        body: '{"error":"unknown field \\"amountCents\\""}',
        durationMs: 18,
      };
    case 'http_429':
      return { status: 429, body: '{"error":"too many requests"}', durationMs: 12 };
    case 'http_500':
      return { status: 500, body: '<html><head><title>502 Bad Gateway</title>', durationMs: 87 };
    case 'intermittent':
      // Fails the first two attempts, then recovers. This is the shape of a
      // deploy or a brief database blip, and the reason to try fast twice
      // before spreading attempts out.
      return attempt <= 2
        ? { status: 503, body: '{"error":"service unavailable"}', durationMs: 64 }
        : { status: 200, body: 'ok', durationMs: 51 };
  }
}

/**
 * Run a delivery to completion and return every attempt it made.
 *
 * @param behavior      how the endpoint responds
 * @param maxAttempts   override the schedule length, for tests
 */
export function simulateDelivery(
  behavior: EndpointBehavior,
  maxAttempts: number = MAX_ATTEMPTS,
): Attempt[] {
  const attempts: Attempt[] = [];

  for (let n = 1; n <= maxAttempts; n++) {
    const { status, body, durationMs } = respond(behavior, n);
    const cls = classifyResponse(status);
    const delivered = status !== null && status >= 200 && status < 300;

    let result: AttemptResult;
    if (delivered) result = 'delivered';
    else if (!cls.retryable) result = 'dropped';
    else if (n >= maxAttempts) result = 'exhausted';
    else result = 'retrying';

    let explanation = cls.reason;
    if (result === 'retrying') {
      explanation += ` Next attempt in ${formatDelay(RETRY_GAPS_SECONDS[n] ?? 0)}.`;
    } else if (result === 'exhausted') {
      explanation += ` That was attempt ${n} of ${maxAttempts}, so the message is marked Failed and an operational webhook (message.attempt.exhausted) fires.`;
    }

    attempts.push({
      attempt: n,
      status,
      result,
      atSeconds: cumulativeDelaySeconds(n),
      responseBody: body,
      durationMs,
      explanation,
    });

    if (result !== 'retrying') break;
  }

  return attempts;
}

/* ------------------------------------------------------------------ */
/* Signatures                                                          */
/* ------------------------------------------------------------------ */

/**
 * The exact string Svix signs: id, timestamp and the raw body, joined with
 * periods. Including the id and timestamp is what bounds the replay window.
 *
 * @see https://docs.svix.com/receiving/verifying-payloads/how-manual
 */
export function buildSignedContent(id: string, timestamp: number, body: string): string {
  return `${id}.${timestamp}.${body}`;
}

function base64Decode(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Strip the `whsec_` prefix and decode. HMAC-ing the printable form is a classic bug. */
export function decodeSecret(secret: string): Uint8Array {
  const raw = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  return base64Decode(raw);
}

/** HMAC-SHA256 the signed content and base64 the digest. */
export async function signContent(secret: string, signedContent: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    decodeSecret(secret) as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
  return base64Encode(new Uint8Array(mac));
}

/** The `svix-signature` header value for one secret. */
export async function buildSignatureHeader(
  secret: string,
  id: string,
  timestamp: number,
  body: string,
): Promise<string> {
  return `v1,${await signContent(secret, buildSignedContent(id, timestamp, body))}`;
}

/** Matches the tolerance in the `standardwebhooks` package the Svix SDK uses. */
export const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export type VerifyFailure =
  | 'missing_headers'
  | 'malformed_signature'
  | 'timestamp_out_of_tolerance'
  | 'signature_mismatch';

export interface VerifyResult {
  valid: boolean;
  failure?: VerifyFailure;
  /** What a receiver should do about it, in plain terms. */
  detail: string;
  /** What we computed, so the simulator can show both sides. */
  expected?: string;
}

/**
 * Verify a webhook the way a receiver should, and say precisely which check
 * failed. The order matters: cheap structural checks first, timestamp before
 * the HMAC, and the digest compared against every signature in the header so
 * that a secret rotation does not break verification.
 */
export async function verifyWebhook(params: {
  secret: string;
  id: string;
  timestamp: number;
  body: string;
  signatureHeader: string;
  nowSeconds: number;
}): Promise<VerifyResult> {
  const { secret, id, timestamp, body, signatureHeader, nowSeconds } = params;

  if (!id || !signatureHeader || !Number.isFinite(timestamp)) {
    return {
      valid: false,
      failure: 'missing_headers',
      detail:
        'One of svix-id, svix-timestamp or svix-signature is missing. Reject with 400 before doing any work.',
    };
  }

  const skew = Math.abs(nowSeconds - timestamp);
  if (skew > TIMESTAMP_TOLERANCE_SECONDS) {
    return {
      valid: false,
      failure: 'timestamp_out_of_tolerance',
      detail: `The timestamp is ${formatDelay(skew)} from now, outside the ${formatDelay(
        TIMESTAMP_TOLERANCE_SECONDS,
      )} tolerance. This is what stops someone replaying a request they captured earlier. Note that a badly wrong server clock produces this same error.`,
    };
  }

  const expected = await signContent(secret, buildSignedContent(id, timestamp, body));

  // The header can carry several space-delimited signatures during a rotation.
  const candidates = signatureHeader.split(' ').filter(Boolean);
  const parsed = candidates
    .map((part) => {
      const comma = part.indexOf(',');
      if (comma === -1) return null;
      return { version: part.slice(0, comma), signature: part.slice(comma + 1) };
    })
    .filter((p): p is { version: string; signature: string } => p !== null && p.version === 'v1');

  if (parsed.length === 0) {
    return {
      valid: false,
      failure: 'malformed_signature',
      detail:
        'No v1 signature in the header. Each entry looks like "v1,<base64>", space-delimited when more than one secret is live.',
      expected,
    };
  }

  if (parsed.some((p) => p.signature === expected)) {
    return {
      valid: true,
      detail:
        'The digest matches, so the body is byte-for-byte what was signed and it was signed with your secret. In real code compare with a constant-time function, not ===.',
      expected,
    };
  }

  return {
    valid: false,
    failure: 'signature_mismatch',
    detail:
      'The digest does not match. Either the body changed in transit (or was re-serialized before verifying, which is the usual cause), or it was signed with a different secret.',
    expected,
  };
}

/* ------------------------------------------------------------------ */
/* Idempotency                                                         */
/* ------------------------------------------------------------------ */

export type DedupOutcome = 'processed' | 'duplicate_ignored';

export interface DedupDecision {
  outcome: DedupOutcome;
  /** What the receiver should return. */
  status: number;
  detail: string;
}

/**
 * The receiver's dedup check, keyed on the message ID, which stays stable
 * across every retry of the same message. Mutates `seen`, the way inserting a
 * row into a table with a unique index would.
 */
export function applyDedup(seen: Set<string>, messageId: string): DedupDecision {
  if (seen.has(messageId)) {
    return {
      outcome: 'duplicate_ignored',
      status: 200,
      detail: `Already processed ${messageId}. Return 200 so the sender stops retrying, and do not run the handler again.`,
    };
  }
  seen.add(messageId);
  return {
    outcome: 'processed',
    status: 200,
    detail: `First time seeing ${messageId}. Write the dedup row and do the work in one transaction, so a crash rolls back both and the retry gets a clean attempt.`,
  };
}

/* ------------------------------------------------------------------ */
/* Sample events                                                       */
/* ------------------------------------------------------------------ */

export interface SampleEvent {
  eventType: string;
  label: string;
  payload: Record<string, unknown>;
}

export const SAMPLE_EVENTS: SampleEvent[] = [
  {
    eventType: 'invoice.paid',
    label: 'invoice.paid',
    payload: {
      type: 'invoice.paid',
      invoiceId: 'inv_9Kq2mXvNpL',
      customerId: 'cus_4dRfYhBcGj',
      amountCents: 4900,
      currency: 'usd',
      paidAt: '2026-07-30T09:14:02Z',
    },
  },
  {
    eventType: 'subscription.canceled',
    label: 'subscription.canceled',
    payload: {
      type: 'subscription.canceled',
      subscriptionId: 'sub_7TdRfYhBcG',
      customerId: 'cus_4dRfYhBcGj',
      canceledAt: '2026-07-30T09:20:41Z',
      reason: 'payment_failed',
      periodEndsAt: '2026-08-14T00:00:00Z',
    },
  },
  {
    eventType: 'deployment.succeeded',
    label: 'deployment.succeeded',
    payload: {
      type: 'deployment.succeeded',
      deploymentId: 'dpl_2Xg8kFmqLx',
      projectId: 'prj_Kp4v9rNtQw',
      commit: '7c1f4ae',
      environment: 'production',
      durationSeconds: 74,
    },
  },
];

/** Stable-looking Svix message ID. Not cryptographic; it only has to look real. */
export function makeMessageId(seed: number): string {
  const alphabet = '0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  let out = '';
  let x = seed >>> 0;
  for (let i = 0; i < 27; i++) {
    // xorshift, so the ids look random but the simulator stays reproducible
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out += alphabet[x % alphabet.length];
  }
  return `msg_${out}`;
}
