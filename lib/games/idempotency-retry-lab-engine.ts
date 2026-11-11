// Deterministic model for the Idempotency and Retry Lab. It deliberately has
// no UI state, clocks, DOM APIs, or ambient randomness so the HTTP rules can
// be tested on their own.

export const AMOUNT_CENTS = 2499;
export const RETRY_BASE_MS = 100;
export const RETRY_CAP_MS = 5000;
export const MAX_ATTEMPTS = 5;
export const OUTAGE_MS = 3000;
export const BUCKET_MS = 100;
export const OUTAGE_CLIENTS = 200;
export const KEY_RETENTION_HOURS = 24;
export const HTTP_STATUS = {
  success: 200,
  badRequest: 400,
  conflict: 409,
  mismatch: 422,
  rateLimited: 429,
  serverError: 500,
  unavailable: 503,
} as const;

export type StatusCode = 200 | 400 | 409 | 422 | 429 | 500 | 503;
export type StoreState = 'processing' | 'completed';
export type BackoffMode = 'none' | 'exponential' | 'full-jitter';
export type RetryReason = 'network-error' | '409' | '429' | '5xx' | '400' | '422';

export interface SavedResponse {
  status: StatusCode;
  body: string;
}

export interface StoreRow {
  key: string;
  fingerprint: string;
  state: StoreState;
  savedResponse: SavedResponse | null;
  createdAtMs: number;
  expiresAtMs: number;
}

export interface Charge {
  id: string;
  amountCents: number;
  operation: string;
}

export interface LabEvent {
  id: string;
  label: string;
  status: StatusCode | 'lost';
  replayed?: boolean;
}

export interface DeadLetterJob {
  key: string;
  lastError: string;
  attempts: number;
}

export interface OutageBucket {
  startMs: number;
  requests: number;
}

export interface OutageRun {
  mode: BackoffMode;
  buckets: OutageBucket[];
  peakRequests: number;
  attempts: number;
  deadLetters: number;
}

export interface LabState {
  ledger: Charge[];
  store: StoreRow[];
  events: LabEvent[];
  deadLetters: DeadLetterJob[];
  outageRuns: Partial<Record<BackoffMode, OutageRun>>;
  checks: {
    duplicate: boolean;
    withKey: boolean;
    mismatch: boolean;
    conflict: boolean;
  };
  nextCharge: number;
}

export const DEMO_KEYS = {
  protectedCheckout: '6f1de128-8cb4-4de8-9a47-a1d53d5c21b1',
  mismatch: 'f92a7b39-14ae-46d8-a9bc-47e2f7a06c52',
  conflict: 'b321dd70-5078-4c54-b218-e987d43b7840',
  deadLetter: 'd46c3d11-2b55-4e63-a8a1-6f9e4c0c9143',
} as const;

export function requestFingerprint(amountCents: number): string {
  return `POST /charges amount=${amountCents}`;
}

export function createLab(): LabState {
  return {
    ledger: [],
    store: [],
    events: [],
    deadLetters: [],
    outageRuns: {},
    checks: { duplicate: false, withKey: false, mismatch: false, conflict: false },
    nextCharge: 1,
  };
}

function event(
  state: LabState,
  label: string,
  status: LabEvent['status'],
  replayed = false
): LabState {
  return {
    ...state,
    events: [...state.events, { id: `event-${state.events.length + 1}`, label, status, replayed }],
  };
}

function addCharge(state: LabState, amountCents: number, operation: string): LabState {
  return {
    ...state,
    ledger: [
      ...state.ledger,
      { id: `ch_${String(state.nextCharge).padStart(3, '0')}`, amountCents, operation },
    ],
    nextCharge: state.nextCharge + 1,
  };
}

function rowFor(state: LabState, key: string): StoreRow | undefined {
  return state.store.find((row) => row.key === key);
}

/** Repeating a lab card represents a new intended operation, so it gets a new UUID-shaped key. */
function scenarioKey(state: LabState, base: string): string {
  if (!rowFor(state, base)) return base;
  return `${base.slice(0, -12)}${(state.store.length + 1).toString(16).padStart(12, '0')}`;
}

function chargeResponse(amountCents: number): SavedResponse {
  return { status: 200, body: `charge created for ${formatCurrency(amountCents)}` };
}

export function startKeyedRequest(
  state: LabState,
  key: string,
  amountCents: number,
  nowMs = 0
): { state: LabState; response: SavedResponse | null; replayed: boolean } {
  const existing = rowFor(state, key);
  const fingerprint = requestFingerprint(amountCents);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      return {
        state: event(state, 'Key reused with a different payload', 422),
        response: { status: 422, body: 'Idempotency key payload mismatch' },
        replayed: false,
      };
    }
    if (existing.state === 'processing') {
      return {
        state: event(state, 'Earlier keyed request is still processing', 409),
        response: { status: 409, body: 'Idempotent request is in progress' },
        replayed: false,
      };
    }
    return {
      state: event(state, 'Saved response replayed', existing.savedResponse!.status, true),
      response: existing.savedResponse,
      replayed: true,
    };
  }
  return {
    state: {
      ...state,
      store: [
        ...state.store,
        {
          key,
          fingerprint,
          state: 'processing',
          savedResponse: null,
          createdAtMs: nowMs,
          expiresAtMs: nowMs + KEY_RETENTION_HOURS * 60 * 60 * 1000,
        },
      ],
    },
    response: null,
    replayed: false,
  };
}

export function finishKeyedRequest(
  state: LabState,
  key: string,
  amountCents: number,
  response: SavedResponse = chargeResponse(amountCents)
): LabState {
  const row = rowFor(state, key);
  if (!row || row.state !== 'processing') throw new Error(`No processing row for ${key}`);
  const charged = response.status === 200 ? addCharge(state, amountCents, 'keyed checkout') : state;
  return event(
    {
      ...charged,
      store: charged.store.map((candidate) =>
        candidate.key === key
          ? { ...candidate, state: 'completed', savedResponse: response }
          : candidate
      ),
    },
    response.status === 200 ? 'Charge completed and response saved' : 'Failure response saved',
    response.status
  );
}

export function runLostResponse(state: LabState, keyed: boolean): LabState {
  if (!keyed) {
    const first = event(
      addCharge(state, AMOUNT_CENTS, 'lost response checkout'),
      'Response lost after charge',
      'lost'
    );
    const second = event(
      addCharge(first, AMOUNT_CENTS, 'retry without key'),
      'Retry charged again',
      200
    );
    return {
      ...second,
      checks: {
        ...second.checks,
        duplicate:
          second.checks.duplicate ||
          second.ledger.filter(
            (charge) =>
              charge.operation.includes('response checkout') ||
              charge.operation === 'retry without key'
          ).length >= 2,
      },
    };
  }
  const key = scenarioKey(state, DEMO_KEYS.protectedCheckout);
  const started = startKeyedRequest(state, key, AMOUNT_CENTS);
  const finished = finishKeyedRequest(started.state, key, AMOUNT_CENTS);
  const lost = event(finished, 'Response lost after charge', 'lost');
  const replay = startKeyedRequest(lost, key, AMOUNT_CENTS);
  if (!replay.response || !replay.replayed) throw new Error('Expected a saved response replay');
  return {
    ...replay.state,
    checks: {
      ...replay.state.checks,
      withKey: replay.state.checks.withKey || replay.replayed,
    },
  };
}

export function runPayloadMismatch(state: LabState): LabState {
  const key = scenarioKey(state, DEMO_KEYS.mismatch);
  const started = startKeyedRequest(state, key, AMOUNT_CENTS);
  const finished = finishKeyedRequest(started.state, key, AMOUNT_CENTS);
  const mismatch = startKeyedRequest(finished, key, AMOUNT_CENTS + 100);
  return {
    ...mismatch.state,
    checks: {
      ...mismatch.state.checks,
      mismatch: mismatch.state.checks.mismatch || mismatch.response?.status === 422,
    },
  };
}

export function runConcurrentConflict(state: LabState): LabState {
  const key = scenarioKey(state, DEMO_KEYS.conflict);
  const first = startKeyedRequest(state, key, AMOUNT_CENTS);
  const conflicting = startKeyedRequest(first.state, key, AMOUNT_CENTS);
  const finished = finishKeyedRequest(conflicting.state, key, AMOUNT_CENTS);
  const later = startKeyedRequest(finished, key, AMOUNT_CENTS);
  return {
    ...later.state,
    checks: {
      ...later.state.checks,
      conflict:
        later.state.checks.conflict ||
        (conflicting.response?.status === 409 && later.response?.status === 200 && later.replayed),
    },
  };
}

export function shouldRetry(reason: RetryReason): boolean {
  return reason === 'network-error' || reason === '409' || reason === '429' || reason === '5xx';
}

export type RandomSource = () => number;

export function seededRandom(seed: number): RandomSource {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

/** Retry ordinal starts at zero after the first failed call. */
export function retryDelayMs(
  mode: BackoffMode,
  retryOrdinal: number,
  random: RandomSource
): number {
  if (mode === 'none') return 0;
  const ceiling = Math.min(RETRY_CAP_MS, RETRY_BASE_MS * 2 ** retryOrdinal);
  if (mode === 'exponential') return ceiling;
  return Math.floor(random() * (ceiling + 1));
}

function bucketize(times: number[]): OutageBucket[] {
  const buckets = new Map<number, number>();
  for (const time of times) {
    const startMs = Math.floor(time / BUCKET_MS) * BUCKET_MS;
    buckets.set(startMs, (buckets.get(startMs) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([startMs, requests]) => ({ startMs, requests }));
}

export function simulateOutage(
  mode: BackoffMode,
  random: RandomSource = seededRandom(7)
): OutageRun {
  const times: number[] = [];
  let deadLetters = 0;
  for (let client = 0; client < OUTAGE_CLIENTS; client += 1) {
    let time = 0;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      times.push(time);
      if (time >= OUTAGE_MS) break;
      if (attempt === MAX_ATTEMPTS - 1) deadLetters += 1;
      else time += retryDelayMs(mode, attempt, random);
    }
  }
  const buckets = bucketize(times);
  return {
    mode,
    buckets,
    peakRequests: Math.max(...buckets.map((bucket) => bucket.requests), 0),
    attempts: times.length,
    deadLetters,
  };
}

export function runOutage(state: LabState, mode: BackoffMode): LabState {
  const run = simulateOutage(mode, seededRandom(mode === 'full-jitter' ? 41 : 7));
  return { ...state, outageRuns: { ...state.outageRuns, [mode]: run } };
}

export function runDeadLetterJob(state: LabState): LabState {
  const attempts = MAX_ATTEMPTS;
  return {
    ...state,
    deadLetters: [
      ...state.deadLetters,
      { key: DEMO_KEYS.deadLetter, lastError: '503 Service Unavailable', attempts },
    ],
    events: [
      ...state.events,
      {
        id: `event-${state.events.length + 1}`,
        label: 'Job moved to dead-letter queue',
        status: 503,
      },
    ],
  };
}

export function formatCurrency(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`;
}

export function formatKeyExpiry(): string {
  return `expires after ${KEY_RETENTION_HOURS} h`;
}

export function missionChecks(state: LabState) {
  const noBackoff = state.outageRuns.none;
  const jitter = state.outageRuns['full-jitter'];
  return {
    duplicate: state.checks.duplicate,
    'with-key': state.checks.withKey,
    mismatch: state.checks.mismatch,
    conflict: state.checks.conflict,
    jitter: !!noBackoff && !!jitter && jitter.peakRequests < noBackoff.peakRequests,
    dlq: state.deadLetters.length > 0,
  };
}
