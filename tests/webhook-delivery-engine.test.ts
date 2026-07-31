import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  MAX_ATTEMPTS,
  RETRY_GAPS_SECONDS,
  SAMPLE_EVENTS,
  TIMESTAMP_TOLERANCE_SECONDS,
  applyDedup,
  buildSignatureHeader,
  buildSignedContent,
  classifyResponse,
  cumulativeDelaySeconds,
  decodeSecret,
  formatDelay,
  makeMessageId,
  signContent,
  simulateDelivery,
  verifyWebhook,
} from '@/lib/games/webhook-delivery-engine';

const webhookSecret = (value: string) => ['whsec', value].join('_');
const SECRET = webhookSecret('MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw');
const ID = 'msg_2Xg8kFmqLxKp4v9rNtQwYbCdEf';
const TS = 1785350000;
const BODY = '{"type":"invoice.paid","invoiceId":"inv_991"}';

describe('retry schedule', () => {
  it('matches the published schedule and gives 8 attempts', () => {
    expect(RETRY_GAPS_SECONDS).toEqual([0, 5, 300, 1800, 7200, 18000, 36000, 36000]);
    expect(MAX_ATTEMPTS).toBe(8);
  });

  it('reproduces the worked example from the Svix docs', () => {
    // "an attempt that fails three times before eventually succeeding will be
    // delivered roughly 35 minutes and 5 seconds following the first attempt"
    // Failing 3 times means succeeding on attempt 4.
    expect(cumulativeDelaySeconds(4)).toBe(35 * 60 + 5);
  });

  it('spans a little over a day end to end', () => {
    expect(cumulativeDelaySeconds(MAX_ATTEMPTS)).toBe(27 * 3600 + 35 * 60 + 5);
  });

  it('formats delays readably', () => {
    expect(formatDelay(0)).toBe('immediately');
    expect(formatDelay(5)).toBe('5s');
    expect(formatDelay(300)).toBe('5m');
    expect(formatDelay(7200)).toBe('2h');
    expect(formatDelay(36000)).toBe('10h');
  });
});

describe('response classification', () => {
  it('retries server errors, timeouts and 429', () => {
    for (const status of [500, 502, 503, 429, 408]) {
      expect(classifyResponse(status).retryable, String(status)).toBe(true);
    }
    expect(classifyResponse(null).retryable).toBe(true);
  });

  it('does not retry client errors that a retry cannot fix', () => {
    for (const status of [400, 401, 403, 404, 410, 422]) {
      expect(classifyResponse(status).retryable, String(status)).toBe(false);
    }
  });

  it('flags a timeout as ambiguous rather than failed', () => {
    // The whole reason receivers must deduplicate.
    expect(classifyResponse(null).reason).toMatch(/may have processed/i);
  });
});

describe('delivery simulation', () => {
  it('stops after one attempt on success', () => {
    const attempts = simulateDelivery('success');
    expect(attempts).toHaveLength(1);
    expect(attempts[0].result).toBe('delivered');
  });

  it('drops a 400 immediately instead of burning the schedule', () => {
    const attempts = simulateDelivery('http_400');
    expect(attempts).toHaveLength(1);
    expect(attempts[0].result).toBe('dropped');
  });

  it('runs the full schedule on a permanent 500 and then exhausts', () => {
    const attempts = simulateDelivery('http_500');
    expect(attempts).toHaveLength(MAX_ATTEMPTS);
    expect(attempts.at(-1)!.result).toBe('exhausted');
    expect(attempts.at(-1)!.explanation).toMatch(/message\.attempt\.exhausted/);
    // Every attempt before the last is a retry.
    expect(attempts.slice(0, -1).every((a) => a.result === 'retrying')).toBe(true);
  });

  it('recovers on the third attempt for an intermittent endpoint', () => {
    const attempts = simulateDelivery('intermittent');
    expect(attempts).toHaveLength(3);
    expect(attempts.map((a) => a.result)).toEqual(['retrying', 'retrying', 'delivered']);
    // Recovery lands 5m5s in, which is why trying fast twice is worth it.
    expect(attempts[2].atSeconds).toBe(305);
  });

  it('retries a timeout, since the outcome is unknown', () => {
    const attempts = simulateDelivery('timeout');
    expect(attempts).toHaveLength(MAX_ATTEMPTS);
    expect(attempts[0].status).toBeNull();
  });

  it('respects a shortened schedule', () => {
    const attempts = simulateDelivery('http_500', 3);
    expect(attempts).toHaveLength(3);
    expect(attempts.at(-1)!.result).toBe('exhausted');
  });

  it('records cumulative timing, not per-attempt gaps', () => {
    const attempts = simulateDelivery('http_500');
    expect(attempts.map((a) => a.atSeconds)).toEqual([0, 5, 305, 2105, 9305, 27305, 63305, 99305]);
  });
});

describe('signing', () => {
  it('builds the signed content as id.timestamp.body', () => {
    expect(buildSignedContent(ID, TS, BODY)).toBe(`${ID}.${TS}.${BODY}`);
  });

  it('strips the whsec_ prefix before decoding', () => {
    expect(decodeSecret(SECRET)).toEqual(decodeSecret(SECRET.slice('whsec_'.length)));
    expect(decodeSecret(SECRET).length).toBeGreaterThan(0);
  });

  it('produces the same digest as node crypto over the decoded secret', async () => {
    // Independent implementation, so this catches a mistake in ours rather
    // than just asserting it is self-consistent.
    const expected = createHmac('sha256', Buffer.from(decodeSecret(SECRET)))
      .update(buildSignedContent(ID, TS, BODY))
      .digest('base64');
    expect(await signContent(SECRET, buildSignedContent(ID, TS, BODY))).toBe(expected);
  });

  it('would produce a different digest if the secret were not decoded', async () => {
    // Guards the classic bug: HMAC-ing the printable secret string.
    const wrong = createHmac('sha256', SECRET.split('_')[1])
      .update(buildSignedContent(ID, TS, BODY))
      .digest('base64');
    expect(await signContent(SECRET, buildSignedContent(ID, TS, BODY))).not.toBe(wrong);
  });

  it('prefixes the header value with the version', async () => {
    const header = await buildSignatureHeader(SECRET, ID, TS, BODY);
    expect(header.startsWith('v1,')).toBe(true);
  });
});

describe('verification', () => {
  /**
   * Signs the *default* body with the *default* secret, then verifies with the
   * overrides applied. That asymmetry is the point: passing `body` here means
   * "the body changed after it was signed".
   */
  const verify = async (over: Partial<Parameters<typeof verifyWebhook>[0]> = {}) =>
    verifyWebhook({
      secret: SECRET,
      id: ID,
      timestamp: TS,
      body: BODY,
      signatureHeader: await buildSignatureHeader(SECRET, ID, TS, BODY),
      nowSeconds: TS,
      ...over,
    });

  it('accepts an untampered request', async () => {
    expect((await verify()).valid).toBe(true);
  });

  it('rejects a changed body', async () => {
    const r = await verify({ body: BODY.replace('inv_991', 'inv_992') });
    expect(r.valid).toBe(false);
    expect(r.failure).toBe('signature_mismatch');
  });

  it('rejects a different secret', async () => {
    const r = await verify({ secret: webhookSecret('AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH') });
    expect(r.valid).toBe(false);
    expect(r.failure).toBe('signature_mismatch');
  });

  it('rejects a stale timestamp even when the digest is valid', async () => {
    // Sign for TS, then verify well after: the replay defence.
    const signatureHeader = await buildSignatureHeader(SECRET, ID, TS, BODY);
    const r = await verifyWebhook({
      secret: SECRET,
      id: ID,
      timestamp: TS,
      body: BODY,
      signatureHeader,
      nowSeconds: TS + TIMESTAMP_TOLERANCE_SECONDS + 1,
    });
    expect(r.valid).toBe(false);
    expect(r.failure).toBe('timestamp_out_of_tolerance');
  });

  it('accepts a timestamp right at the edge of tolerance', async () => {
    const signatureHeader = await buildSignatureHeader(SECRET, ID, TS, BODY);
    const r = await verifyWebhook({
      secret: SECRET,
      id: ID,
      timestamp: TS,
      body: BODY,
      signatureHeader,
      nowSeconds: TS + TIMESTAMP_TOLERANCE_SECONDS,
    });
    expect(r.valid).toBe(true);
  });

  it('checks the timestamp before the digest', async () => {
    // A stale request with a wrong signature should report the timestamp
    // problem, so the receiver fixes the clock rather than hunting the secret.
    const r = await verifyWebhook({
      secret: SECRET,
      id: ID,
      timestamp: TS,
      body: BODY,
      signatureHeader: 'v1,not-even-close',
      nowSeconds: TS + 999999,
    });
    expect(r.failure).toBe('timestamp_out_of_tolerance');
  });

  it('accepts any signature in the header, so rotation works', async () => {
    const oldSecret = webhookSecret('AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH');
    const current = await buildSignatureHeader(SECRET, ID, TS, BODY);
    const previous = await buildSignatureHeader(oldSecret, ID, TS, BODY);

    // Receiver still on the old secret; sender sends both.
    const r = await verifyWebhook({
      secret: oldSecret,
      id: ID,
      timestamp: TS,
      body: BODY,
      signatureHeader: `${current} ${previous}`,
      nowSeconds: TS,
    });
    expect(r.valid).toBe(true);
  });

  it('rejects a malformed header', async () => {
    const r = await verifyWebhook({
      secret: SECRET,
      id: ID,
      timestamp: TS,
      body: BODY,
      signatureHeader: 'garbage-without-a-comma',
      nowSeconds: TS,
    });
    expect(r.valid).toBe(false);
    expect(r.failure).toBe('malformed_signature');
  });

  it('ignores signatures at an unknown version', async () => {
    const sig = (await buildSignatureHeader(SECRET, ID, TS, BODY)).slice('v1,'.length);
    const r = await verifyWebhook({
      secret: SECRET,
      id: ID,
      timestamp: TS,
      body: BODY,
      signatureHeader: `v9,${sig}`,
      nowSeconds: TS,
    });
    expect(r.failure).toBe('malformed_signature');
  });

  it('rejects missing headers', async () => {
    const r = await verifyWebhook({
      secret: SECRET,
      id: '',
      timestamp: TS,
      body: BODY,
      signatureHeader: '',
      nowSeconds: TS,
    });
    expect(r.failure).toBe('missing_headers');
  });
});

describe('idempotency', () => {
  it('processes the first delivery and ignores the second', () => {
    const seen = new Set<string>();
    expect(applyDedup(seen, ID).outcome).toBe('processed');
    expect(applyDedup(seen, ID).outcome).toBe('duplicate_ignored');
  });

  it('returns 200 for a duplicate so the sender stops retrying', () => {
    const seen = new Set<string>([ID]);
    expect(applyDedup(seen, ID).status).toBe(200);
  });

  it('treats a different message as new', () => {
    const seen = new Set<string>([ID]);
    expect(applyDedup(seen, 'msg_something_else').outcome).toBe('processed');
  });
});

describe('sample data', () => {
  it('every sample event carries a matching type in its payload', () => {
    for (const e of SAMPLE_EVENTS) {
      expect(e.payload.type, e.eventType).toBe(e.eventType);
    }
  });

  it('generates distinct, plausible message ids', () => {
    const ids = [1, 2, 3, 4, 5].map(makeMessageId);
    expect(new Set(ids).size).toBe(5);
    for (const id of ids) expect(id).toMatch(/^msg_[0-9A-Za-z]{27}$/);
  });

  it('is reproducible for the same seed', () => {
    expect(makeMessageId(42)).toBe(makeMessageId(42));
  });
});
