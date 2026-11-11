import { describe, expect, it } from 'vitest';
import {
  AMOUNT_CENTS,
  DEMO_KEYS,
  HTTP_STATUS,
  KEY_RETENTION_HOURS,
  MAX_ATTEMPTS,
  RETRY_BASE_MS,
  RETRY_CAP_MS,
  createLab,
  finishKeyedRequest,
  missionChecks,
  retryDelayMs,
  runConcurrentConflict,
  runDeadLetterJob,
  runLostResponse,
  runOutage,
  runPayloadMismatch,
  shouldRetry,
  simulateOutage,
  startKeyedRequest,
} from '@/lib/games/idempotency-retry-lab-engine';

describe('Idempotency and Retry Lab engine', () => {
  it('uses a unique UUID v4 key for each intended demo operation', () => {
    const keys = Object.values(DEMO_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys)
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('charges twice when a lost response is retried without a key', () => {
    const state = runLostResponse(createLab(), false);
    expect(state.ledger).toHaveLength(2);
    expect(state.ledger.map((charge) => charge.amountCents)).toEqual([AMOUNT_CENTS, AMOUNT_CENTS]);
    expect(missionChecks(state).duplicate).toBe(true);
  });

  it('saves the first successful keyed response and replays it without a second charge', () => {
    const state = runLostResponse(createLab(), true);
    expect(state.ledger).toHaveLength(1);
    expect(state.store).toHaveLength(1);
    expect(state.store[0]).toMatchObject({
      state: 'completed',
      savedResponse: { status: HTTP_STATUS.success },
    });
    expect(state.events.at(-1)).toMatchObject({ status: HTTP_STATUS.success, replayed: true });
    expect(missionChecks(state)['with-key']).toBe(true);
  });

  it('also saves and replays the first 500 response', () => {
    const key = '0f149832-8d91-4a0c-8bb8-5c2d4e061e13';
    const started = startKeyedRequest(createLab(), key, AMOUNT_CENTS);
    const failed = finishKeyedRequest(started.state, key, AMOUNT_CENTS, {
      status: 500,
      body: 'temporary server failure',
    });
    const replay = startKeyedRequest(failed, key, AMOUNT_CENTS);
    expect(replay.replayed).toBe(true);
    expect(replay.response).toEqual({ status: 500, body: 'temporary server failure' });
    expect(replay.state.ledger).toHaveLength(0);
  });

  it('refuses a key reused with a different payload using 422', () => {
    const state = runPayloadMismatch(createLab());
    expect(state.events.at(-1)).toMatchObject({ status: HTTP_STATUS.mismatch });
    expect(missionChecks(state).mismatch).toBe(true);
  });

  it('returns 409 while a matching keyed request is processing, then replays it later', () => {
    const state = runConcurrentConflict(createLab());
    expect(state.events.some((item) => item.status === HTTP_STATUS.conflict)).toBe(true);
    expect(state.events.at(-1)).toMatchObject({ status: HTTP_STATUS.success, replayed: true });
    expect(state.ledger).toHaveLength(1);
    expect(missionChecks(state).conflict).toBe(true);
  });

  it('sets keyed response expiration at 24 hours', () => {
    const nowMs = 1234;
    const started = startKeyedRequest(
      createLab(),
      DEMO_KEYS.protectedCheckout,
      AMOUNT_CENTS,
      nowMs
    );
    expect(started.state.store[0].expiresAtMs).toBe(nowMs + KEY_RETENTION_HOURS * 60 * 60 * 1000);
  });

  it('retries only transient network and HTTP outcomes', () => {
    expect(shouldRetry('network-error')).toBe(true);
    expect(shouldRetry('409')).toBe(true);
    expect(shouldRetry('429')).toBe(true);
    expect(shouldRetry('5xx')).toBe(true);
    expect(shouldRetry('400')).toBe(false);
    expect(shouldRetry('422')).toBe(false);
  });

  it('computes no backoff, capped exponential, and seeded full jitter delays', () => {
    expect(retryDelayMs('none', 4, () => 0.9)).toBe(0);
    expect(retryDelayMs('exponential', 0, () => 0)).toBe(RETRY_BASE_MS);
    expect(retryDelayMs('exponential', 9, () => 0)).toBe(RETRY_CAP_MS);
    expect(retryDelayMs('full-jitter', 0, () => 0.5)).toBe(50);
    expect(retryDelayMs('full-jitter', 1, () => 0.25)).toBe(50);
  });

  it('spreads full jitter below the no-backoff arrival peak during the outage', () => {
    const noBackoff = simulateOutage('none');
    const jitter = simulateOutage('full-jitter');
    expect(noBackoff.attempts).toBe(200 * MAX_ATTEMPTS);
    expect(noBackoff.peakRequests).toBe(noBackoff.attempts);
    expect(jitter.peakRequests).toBeLessThan(noBackoff.peakRequests);
  });

  it('requires both no-backoff and full-jitter outage runs for the jitter mission', () => {
    let state = runOutage(createLab(), 'none');
    expect(missionChecks(state).jitter).toBe(false);
    state = runOutage(state, 'full-jitter');
    expect(missionChecks(state).jitter).toBe(true);
  });

  it('moves a permanently unavailable job to the dead-letter queue after five attempts', () => {
    const state = runDeadLetterJob(createLab());
    expect(state.deadLetters).toEqual([
      { key: DEMO_KEYS.deadLetter, lastError: '503 Service Unavailable', attempts: MAX_ATTEMPTS },
    ]);
    expect(missionChecks(state).dlq).toBe(true);
  });
});
