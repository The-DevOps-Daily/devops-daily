// lib/on-call.ts
//
// Engine + content for "On-Call: The Daily Incident".
//
// One incident per UTC day, identical for everyone (the day index selects it),
// so results are comparable and shareable the way a daily word puzzle is. All
// logic here is pure and deterministic: no Date.now() baked into selection
// beyond the caller-supplied date, no randomness. The React component owns
// state and localStorage; this file owns rules and content so both stay
// testable.

export type Verdict = 'correct' | 'partial' | 'wrong';

/** A thing you can do with one of your moves. */
export type MoveKind = 'inspect' | 'diagnose';

export interface Evidence {
  /** Short label on the button, e.g. "kubectl get pods". */
  label: string;
  /** What inspecting it reveals. */
  detail: string;
}

export interface Cause {
  id: string;
  label: string;
  /** Subsystem the cause belongs to; used to explain partial-credit verdicts. */
  subsystem: string;
  verdict: Verdict;
}

export interface Incident {
  /** Stable 1-based number shown to players ("On-Call #1"). */
  number: number;
  title: string;
  severity: 'SEV1' | 'SEV2' | 'SEV3';
  /** The alert that paged you. */
  page: string;
  /** Observations shown before you spend any moves. */
  symptoms: string[];
  evidence: Evidence[];
  causes: Cause[];
  correctCauseId: string;
  /** Shown after the round: what actually happened and the fix. */
  resolution: string;
  /** One-line takeaway. */
  lesson: string;
}

/** Total moves a player gets per incident (inspect or diagnose). */
export const MAX_MOVES = 6;

/** Day 0. Kept in UTC so the daily rollover is the same for everyone. */
export const LAUNCH_ISO = '2026-06-13';

const MS_PER_DAY = 86_400_000;

/** UTC day index since launch. Day 0 is the launch date. */
export function dayNumber(date: Date): number {
  const launch = Date.parse(`${LAUNCH_ISO}T00:00:00Z`);
  const today = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  return Math.floor((today - launch) / MS_PER_DAY);
}

/** The incident for a given date, wrapping around the pool. */
export function getDailyIncident(date: Date): Incident {
  const n = dayNumber(date);
  // Negative days (clock skew before launch) clamp to the first incident.
  const idx = ((n % INCIDENTS.length) + INCIDENTS.length) % INCIDENTS.length;
  return INCIDENTS[idx];
}

/** A single move a player made, in order. */
export interface MoveRecord {
  kind: MoveKind;
  /** For diagnose moves, the resulting verdict. */
  verdict?: Verdict;
}

const MOVE_EMOJI: Record<string, string> = {
  inspect: '\u{1F50D}', // magnifying glass
  correct: '\u{1F7E9}', // green
  partial: '\u{1F7E8}', // yellow
  wrong: '⬛', // black
};

export function moveEmoji(move: MoveRecord): string {
  if (move.kind === 'inspect') return MOVE_EMOJI.inspect;
  return MOVE_EMOJI[move.verdict ?? 'wrong'];
}

export interface RoundResult {
  incidentNumber: number;
  severity: Incident['severity'];
  solved: boolean;
  moves: MoveRecord[];
}

/** The clipboard/share string. Spoiler-free: emoji grid, no cause names. */
export function buildShareText(result: RoundResult): string {
  const grid = result.moves.map(moveEmoji).join('');
  const count = result.moves.length;
  const status = result.solved
    ? `resolved in ${count}/${MAX_MOVES}`
    : `unresolved (${MAX_MOVES}/${MAX_MOVES})`;
  return [
    `On-Call #${result.incidentNumber} · ${result.severity} ${status}`,
    grid,
    'https://devops-daily.com/games/on-call',
  ].join('\n');
}

// --- Persistence shape (owned by the component, typed here) -----------------

export interface StoredRound {
  solved: boolean;
  moves: MoveRecord[];
}

export interface OnCallState {
  /** Day index of the most recent completed round. */
  lastDay: number;
  current: number;
  best: number;
  /** Completed rounds keyed by day index, for "come back tomorrow" + history. */
  rounds: Record<number, StoredRound>;
}

export function emptyState(): OnCallState {
  return { lastDay: -1, current: 0, best: 0, rounds: {} };
}

/**
 * Fold a finished round into the running streak. A streak continues only when
 * consecutive days are both solved; a gap or an unsolved day resets it.
 */
export function applyResult(
  state: OnCallState,
  day: number,
  round: StoredRound,
): OnCallState {
  if (state.rounds[day]) return state; // already recorded; idempotent
  let current = state.current;
  if (round.solved) {
    current = state.lastDay === day - 1 ? current + 1 : 1;
  } else {
    current = 0;
  }
  return {
    lastDay: day,
    current,
    best: Math.max(state.best, current),
    rounds: { ...state.rounds, [day]: round },
  };
}

// --- Content ----------------------------------------------------------------

export const INCIDENTS: Incident[] = [
  {
    number: 1,
    title: 'Checkout API is throwing 503s',
    severity: 'SEV2',
    page: 'PagerDuty: checkout-api SEV2 — 503 rate 18%, p99 6.0s. Fired 2 minutes ago.',
    symptoms: [
      'Error rate jumped from 0.1% to 18% at 14:32.',
      'A deploy to checkout-api completed at 14:31, one minute before.',
      'Pods are Running, not CrashLooping.',
    ],
    evidence: [
      { label: 'kubectl get pods', detail: 'All 6 checkout-api pods Running, 0 restarts. Nothing is crashing.' },
      { label: 'Recent deploys', detail: 'checkout-api v412 rolled out 14:31. Its release notes mention "tuned DB pool size".' },
      { label: 'DB connections', detail: 'Postgres active connections pinned at 100/100 (max_connections=100). A wait queue is growing.' },
      { label: 'App logs', detail: 'FATAL: sorry, too many clients already / remaining connection slots are reserved.' },
      { label: 'Grafana: CPU', detail: 'DB CPU 35%, app CPU 20%. Nothing is saturated.' },
    ],
    causes: [
      { id: 'pool', label: 'The new release exhausted the DB connection pool', subsystem: 'database', verdict: 'correct' },
      { id: 'dbcpu', label: 'Database CPU saturation', subsystem: 'database', verdict: 'partial' },
      { id: 'migration', label: 'A migration locked a table', subsystem: 'database', verdict: 'partial' },
      { id: 'bug', label: 'Null-pointer bug in the v412 request handler', subsystem: 'application', verdict: 'wrong' },
      { id: 'dns', label: 'DNS resolution failure to the database', subsystem: 'network', verdict: 'wrong' },
      { id: 'oom', label: 'Pods are being OOMKilled', subsystem: 'kubernetes', verdict: 'wrong' },
    ],
    correctCauseId: 'pool',
    resolution:
      'v412 raised the per-pod connection pool from 10 to 20. With 6 pods that is 120 connections against a Postgres max_connections of 100, so the database began refusing new connections, surfacing as 503s. Fix: lower the pool size (or raise max_connections, or front the DB with PgBouncer) and redeploy.',
    lesson:
      'Database connections are a fixed, shared budget: pods × pool_size must stay under max_connections. A pooler like PgBouncer decouples the two so app scaling cannot starve the database.',
  },
  {
    number: 2,
    title: 'API latency is climbing and nobody deployed',
    severity: 'SEV3',
    page: 'SEV3 — api-gateway p99 latency 2.1s (baseline 120ms). No recent deploys.',
    symptoms: [
      'Latency has climbed steadily over 40 minutes, not a sudden step.',
      'Traffic is flat versus the same time last week.',
      'It started around 02:50 UTC.',
    ],
    evidence: [
      { label: 'Recent deploys', detail: 'No deploys in the last 9 hours. This is not a code change.' },
      { label: 'Scheduled jobs', detail: 'A nightly analytics export began at 02:50 UTC. It runs heavy aggregate queries against the primary database.' },
      { label: 'DB metrics', detail: 'Primary DB CPU 95%. The slow-query log is full of large GROUP BY sequential scans.' },
      { label: 'Redis', detail: 'Cache hit rate is normal at 94%. Redis is healthy.' },
      { label: 'Disk I/O', detail: 'Disk I/O on the DB primary is saturated; iowait is high.' },
    ],
    causes: [
      { id: 'analytics', label: 'A batch analytics job is starving the primary database', subsystem: 'database', verdict: 'correct' },
      { id: 'dbcpu2', label: 'Generic database CPU saturation', subsystem: 'database', verdict: 'partial' },
      { id: 'noisy', label: 'Noisy neighbor on a shared node', subsystem: 'kubernetes', verdict: 'partial' },
      { id: 'slowq', label: 'A slow query shipped in a deploy', subsystem: 'application', verdict: 'wrong' },
      { id: 'stampede', label: 'Cache stampede / Redis eviction', subsystem: 'cache', verdict: 'wrong' },
      { id: 'ddos', label: 'Traffic spike or DDoS', subsystem: 'network', verdict: 'wrong' },
    ],
    correctCauseId: 'analytics',
    resolution:
      'A nightly analytics export ran heavy aggregate queries against the production primary, saturating CPU and disk I/O and slowing every transactional query behind it. Fix: move analytics to a read replica or a warehouse, and schedule heavy jobs off-peak with resource limits.',
    lesson:
      'Keep analytical (OLAP) workloads off your transactional (OLTP) primary. Read replicas and warehouses exist so reporting queries can never page the on-call.',
  },
  {
    number: 3,
    title: 'Intermittent 5xx, and only sometimes',
    severity: 'SEV2',
    page: 'SEV2 — 5xx errors around 30%, but intermittent. Readiness checks are flapping.',
    symptoms: [
      'Errors come and go every few seconds rather than steadily.',
      'Roughly one request in three is affected.',
      'Three replicas sit behind the load balancer.',
    ],
    evidence: [
      { label: 'kubectl get pods -o wide', detail: '3 pods: 2 consistently Ready, 1 Running but failing readiness intermittently.' },
      { label: 'Logs (flapping pod)', detail: 'Repeated OOMKilled events. Memory limit is 256Mi; usage spikes to ~260Mi on large requests.' },
      { label: 'Load balancer', detail: 'Round-robins evenly across all 3 pods. No outlier detection / passive health ejection configured.' },
      { label: 'Recent deploys', detail: 'No deploys today.' },
      { label: 'Node health', detail: 'All nodes healthy. The other two pods are completely fine.' },
    ],
    causes: [
      { id: 'oom3', label: 'One replica OOMKills on large requests while the LB keeps routing to it', subsystem: 'kubernetes', verdict: 'correct' },
      { id: 'lbcfg', label: 'Load balancer is missing outlier detection', subsystem: 'network', verdict: 'partial' },
      { id: 'memlimit', label: 'Memory limit is set too low', subsystem: 'kubernetes', verdict: 'partial' },
      { id: 'azout', label: 'An availability-zone outage', subsystem: 'cloud', verdict: 'wrong' },
      { id: 'deploybug', label: 'A bad deploy this morning', subsystem: 'application', verdict: 'wrong' },
      { id: 'dbfail', label: 'Intermittent database failover', subsystem: 'database', verdict: 'wrong' },
    ],
    correctCauseId: 'oom3',
    resolution:
      'One replica has a memory limit too tight for real payloads; large requests push it past 256Mi and it gets OOMKilled, then restarts, while the load balancer keeps sending it about a third of traffic. Fix: raise the memory limit/request to fit real requests, and enable outlier detection so the LB ejects failing endpoints automatically.',
    lesson:
      'Errors at a clean 1-in-N rate point at 1-of-N backends. Right-size limits, and let the load balancer eject unhealthy endpoints (outlier detection / readiness gating) so one sick replica cannot serve traffic.',
  },
];
