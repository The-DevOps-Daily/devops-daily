// lib/on-call.ts
//
// Engine for "On-Call: The Daily Incident".
//
// One incident per UTC day, identical for everyone (the day index selects it),
// so results are comparable and shareable the way a daily word puzzle is. All
// logic here is pure and deterministic: the caller passes the date, and a round
// is replayed from the list of actions the player took. The React component
// owns state and localStorage; this file owns rules, so both stay testable.
// The incidents themselves live in lib/on-call-incidents.ts.

import { INCIDENTS } from './on-call-incidents';

export type Verdict = 'correct' | 'partial' | 'wrong';

/** A thing you can do with one of your moves. */
export type MoveKind = 'inspect' | 'diagnose';

export type Severity = 'SEV1' | 'SEV2' | 'SEV3';

/** The area a cause belongs to. A wrong cause in the right area scores "partial". */
export const SUBSYSTEMS = {
  application: 'Application',
  database: 'Database',
  kubernetes: 'Kubernetes',
  network: 'Network',
  dns: 'DNS',
  tls: 'TLS',
  cache: 'Cache',
  queue: 'Queue',
  host: 'Host and OS',
  'ci-cd': 'CI/CD',
  scheduler: 'Scheduled jobs',
  'third-party': 'Third-party API',
} as const;

export type Subsystem = keyof typeof SUBSYSTEMS;

/** What the incident is about, shown after the round and used to spread topics. */
export const TOPICS = {
  kubernetes: 'Kubernetes',
  dns: 'DNS',
  tls: 'TLS certificates',
  database: 'Databases',
  'ci-cd': 'CI/CD',
  networking: 'Cloud networking',
  memory: 'Memory and OOM',
  cron: 'Cron and time',
  'rate-limits': 'Rate limits',
  caching: 'Caching',
  queues: 'Queues',
  'feature-flags': 'Feature flags',
  deploys: 'Deploys and rollbacks',
} as const;

export type Topic = keyof typeof TOPICS;

export interface Evidence {
  /** Short label on the button, e.g. "kubectl get pods". */
  label: string;
  /** The command that produced the output, shown after a $ prompt. */
  command?: string;
  /** Raw output: logs, metrics, command output. */
  output: string;
}

export interface Cause {
  id: string;
  label: string;
  subsystem: Subsystem;
}

export interface Incident {
  /** Stable 1-based id. Rounds are stored against it. */
  number: number;
  title: string;
  topic: Topic;
  severity: Severity;
  /** The alert that paged you. */
  page: string;
  /** Observations shown before you spend any moves. */
  symptoms: string[];
  evidence: Evidence[];
  causes: Cause[];
  correctCauseId: string;
  /** Shown after the round: what actually happened and the fix. */
  resolution: string;
  /** Shown after the round: how to stop it happening again. */
  lesson: string;
}

/** Total moves a player gets per incident (inspect or diagnose). */
export const MAX_MOVES = 6;

/** Day 0, puzzle #1. Kept in UTC so the daily rollover is the same for everyone. */
export const LAUNCH_ISO = '2026-10-28';

/**
 * The schedule walks the pool in order, so an incident comes back exactly
 * INCIDENTS.length days later. A pool of 30 or more means a daily player never
 * sees a repeat within a month. Tests hold the pool to this.
 */
export const MIN_REPEAT_GAP_DAYS = 30;

const MS_PER_DAY = 86_400_000;

/** UTC day index since launch. Day 0 is the launch date. */
export function dayNumber(date: Date): number {
  const launch = Date.parse(`${LAUNCH_ISO}T00:00:00Z`);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((today - launch) / MS_PER_DAY);
}

/** The number players see and share ("On-Call #12"). */
export function puzzleNumber(day: number): number {
  return Math.max(day, 0) + 1;
}

/** The incident for a day index, walking the pool in order and wrapping. */
export function getIncidentForDay(day: number): Incident {
  // Days before launch (clock skew) clamp to the first incident.
  const index = Math.max(day, 0) % INCIDENTS.length;
  return INCIDENTS[index];
}

export function getDailyIncident(date: Date): Incident {
  return getIncidentForDay(dayNumber(date));
}

export function getIncidentByNumber(number: number): Incident | undefined {
  return INCIDENTS.find((incident) => incident.number === number);
}

/** Correct for the root cause, partial for another cause in the same area. */
export function verdictFor(incident: Incident, causeId: string): Verdict {
  if (causeId === incident.correctCauseId) return 'correct';
  const correct = incident.causes.find((cause) => cause.id === incident.correctCauseId);
  const cause = incident.causes.find((c) => c.id === causeId);
  return cause && correct && cause.subsystem === correct.subsystem ? 'partial' : 'wrong';
}

export function getCorrectCause(incident: Incident): Cause {
  const cause = incident.causes.find((c) => c.id === incident.correctCauseId);
  if (!cause) throw new Error(`Incident ${incident.number} has no correct cause`);
  return cause;
}

// --- A round ----------------------------------------------------------------

export type Action = { kind: 'inspect'; index: number } | { kind: 'diagnose'; causeId: string };

/** A single move a player made, in order. */
export interface MoveRecord {
  kind: MoveKind;
  /** For diagnose moves, the resulting verdict. */
  verdict?: Verdict;
}

export interface RoundView {
  /** The actions that counted; repeats and moves after the end are dropped. */
  actions: Action[];
  moves: MoveRecord[];
  /** Evidence indexes, in the order inspected. */
  revealed: number[];
  /** Cause ids, in the order tried. */
  tried: string[];
  solved: boolean;
  finished: boolean;
  movesLeft: number;
}

/** Inspecting is allowed only while a move would be left for a diagnosis. */
export function canInspect(view: RoundView, index: number): boolean {
  return !view.finished && view.movesLeft > 1 && !view.revealed.includes(index);
}

/** Replays a round from the player's actions. Invalid actions are ignored. */
export function playRound(incident: Incident, actions: readonly Action[]): RoundView {
  const view: RoundView = {
    actions: [],
    moves: [],
    revealed: [],
    tried: [],
    solved: false,
    finished: false,
    movesLeft: MAX_MOVES,
  };
  for (const action of actions) {
    if (view.finished) break;
    if (action.kind === 'inspect') {
      const valid =
        Number.isInteger(action.index) &&
        action.index >= 0 &&
        action.index < incident.evidence.length &&
        canInspect(view, action.index);
      if (!valid) continue;
      view.revealed.push(action.index);
      view.moves.push({ kind: 'inspect' });
    } else if (action.kind === 'diagnose') {
      const known = incident.causes.some((cause) => cause.id === action.causeId);
      if (!known || view.tried.includes(action.causeId)) continue;
      const verdict = verdictFor(incident, action.causeId);
      view.tried.push(action.causeId);
      view.moves.push({ kind: 'diagnose', verdict });
      if (verdict === 'correct') view.solved = true;
    } else {
      continue;
    }
    view.actions.push(action);
    view.movesLeft = MAX_MOVES - view.moves.length;
    view.finished = view.solved || view.movesLeft === 0;
  }
  return view;
}

// --- Sharing -----------------------------------------------------------------

const MOVE_EMOJI = {
  inspect: '\u{1F50D}', // magnifying glass
  correct: '\u{1F7E9}', // green square
  partial: '\u{1F7E8}', // yellow square
  wrong: '\u{2B1B}', // black square
} as const;

export function moveEmoji(move: MoveRecord): string {
  if (move.kind === 'inspect') return MOVE_EMOJI.inspect;
  return MOVE_EMOJI[move.verdict ?? 'wrong'];
}

export interface RoundResult {
  puzzle: number;
  severity: Severity;
  solved: boolean;
  moves: MoveRecord[];
}

/** The clipboard/share string. Spoiler-free: emoji grid, no cause names. */
export function buildShareText(result: RoundResult): string {
  const grid = result.moves.map(moveEmoji).join('');
  const status = result.solved
    ? `resolved in ${result.moves.length}/${MAX_MOVES}`
    : `unresolved (${MAX_MOVES}/${MAX_MOVES})`;
  return [
    `On-Call #${result.puzzle} · ${result.severity} ${status}`,
    grid,
    'https://devops-daily.com/games/on-call',
  ].join('\n');
}

// --- Persistence shape (owned by the component, typed and checked here) ------

export interface StoredRound {
  /** Incident number, so a pool change cannot mix up a stored result. */
  incident: number;
  solved: boolean;
  moves: MoveRecord[];
}

/** Today's unfinished round, so a reload does not reset it. */
export interface ActiveRound {
  day: number;
  incident: number;
  actions: Action[];
}

export interface OnCallState {
  /** Day index of the most recent completed round. */
  lastDay: number;
  current: number;
  best: number;
  played: number;
  solved: number;
  /** Recent completed rounds keyed by day index. */
  rounds: Record<number, StoredRound>;
  active: ActiveRound | null;
}

/** Older rounds are dropped; the counters above keep the totals. */
export const ROUND_HISTORY_DAYS = 60;

export function emptyState(): OnCallState {
  return { lastDay: -1, current: 0, best: 0, played: 0, solved: 0, rounds: {}, active: null };
}

function pruneRounds(
  rounds: Record<number, StoredRound>,
  latestDay: number
): Record<number, StoredRound> {
  const kept: Record<number, StoredRound> = {};
  for (const [key, round] of Object.entries(rounds)) {
    if (Number(key) > latestDay - ROUND_HISTORY_DAYS) kept[Number(key)] = round;
  }
  return kept;
}

/**
 * Fold a finished round into the running streak. A streak continues only when
 * consecutive days are both solved; a gap or an unsolved day resets it.
 */
export function applyResult(state: OnCallState, day: number, round: StoredRound): OnCallState {
  if (state.rounds[day]) return state; // already recorded; idempotent
  const rounds = pruneRounds({ ...state.rounds, [day]: round }, Math.max(day, state.lastDay));
  const active = state.active?.day === day ? null : state.active;
  // A day at or before the last recorded one can only come after a restore
  // from a backup code; keep the round but do not count it twice.
  if (day <= state.lastDay) return { ...state, rounds, active };
  const current = round.solved ? (state.lastDay === day - 1 ? state.current + 1 : 1) : 0;
  return {
    lastDay: day,
    current,
    best: Math.max(state.best, current),
    played: state.played + 1,
    solved: state.solved + (round.solved ? 1 : 0),
    rounds,
    active,
  };
}

/** The streak to show today: it is broken once a whole day passes unplayed. */
export function currentStreak(state: OnCallState, today: number): number {
  return state.lastDay >= today - 1 ? state.current : 0;
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function sanitizeMoves(value: unknown): MoveRecord[] | null {
  if (!Array.isArray(value) || value.length > MAX_MOVES) return null;
  const moves: MoveRecord[] = [];
  for (const move of value) {
    if (move?.kind === 'inspect') moves.push({ kind: 'inspect' });
    else if (move?.kind === 'diagnose' && ['correct', 'partial', 'wrong'].includes(move.verdict)) {
      moves.push({ kind: 'diagnose', verdict: move.verdict });
    } else return null;
  }
  return moves;
}

function sanitizeActions(value: unknown): Action[] | null {
  if (!Array.isArray(value) || value.length > MAX_MOVES * 2) return null;
  const actions: Action[] = [];
  for (const action of value) {
    if (action?.kind === 'inspect' && isCount(action.index)) {
      actions.push({ kind: 'inspect', index: action.index });
    } else if (
      action?.kind === 'diagnose' &&
      typeof action.causeId === 'string' &&
      action.causeId.length <= 40
    ) {
      actions.push({ kind: 'diagnose', causeId: action.causeId });
    } else return null;
  }
  return actions;
}

/**
 * Turns whatever localStorage holds into a valid state. Anything malformed is
 * dropped rather than trusted: a hand-edited or half-written value must not
 * break the page.
 */
export function sanitizeState(raw: unknown): OnCallState {
  const state = emptyState();
  if (!raw || typeof raw !== 'object') return state;
  const input = raw as Record<string, unknown>;

  const rounds: Record<number, StoredRound> = {};
  if (input.rounds && typeof input.rounds === 'object') {
    for (const [key, value] of Object.entries(input.rounds as Record<string, unknown>)) {
      const day = Number(key);
      const round = value as Record<string, unknown> | null;
      const moves = sanitizeMoves(round?.moves);
      if (!isCount(day) || !round || !moves) continue;
      if (!isCount(round.incident) || typeof round.solved !== 'boolean') continue;
      rounds[day] = { incident: round.incident, solved: round.solved, moves };
    }
  }

  const summary = {
    lastDay: input.lastDay,
    current: input.current,
    best: input.best,
    played: input.played,
    solved: input.solved,
  };
  if (!isValidSummary(summary)) return state;
  Object.assign(state, summary);
  state.rounds = state.lastDay >= 0 ? pruneRounds(rounds, state.lastDay) : rounds;

  const active = input.active as Record<string, unknown> | null | undefined;
  const actions = sanitizeActions(active?.actions);
  if (active && isCount(active.day) && isCount(active.incident) && actions) {
    state.active = { day: active.day, incident: active.incident, actions };
  }
  return state;
}

// --- Backup codes ------------------------------------------------------------
//
// A short code such as OC1-1K-5-9-1C-18-4F2Q carries the streak counters, so a
// cleared browser can get its streak back. No backend: the player copies the
// code somewhere and pastes it later. The last group is a checksum that
// catches typos; it is not a signature, and the game has nothing to protect.

export type BackupSummary = Pick<OnCallState, 'lastDay' | 'current' | 'best' | 'played' | 'solved'>;

const BACKUP_PREFIX = 'OC1';
const MAX_BACKUP_INPUT = 80;
const BACKUP_PATTERN = /^OC1((?:-[0-9A-Z]{1,6}){5})-([0-9A-Z]{4})$/;

function checksum(payload: string): string {
  // FNV-1a, 32 bit.
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash % 36 ** 4).toString(36).toUpperCase().padStart(4, '0');
}

function isValidSummary(value: Record<string, unknown>): value is BackupSummary {
  const { lastDay, current, best, played, solved } = value;
  if (lastDay === -1) return played === 0 && solved === 0 && best === 0 && current === 0;
  return (
    isCount(lastDay) &&
    isCount(current) &&
    isCount(best) &&
    isCount(played) &&
    isCount(solved) &&
    current <= best &&
    best <= solved &&
    solved <= played &&
    played <= lastDay + 1
  );
}

/** Null until at least one round is finished. */
export function encodeBackup(state: OnCallState): string | null {
  if (state.lastDay < 0 || state.played === 0) return null;
  const fields = [state.lastDay, state.current, state.best, state.played, state.solved];
  const payload = [BACKUP_PREFIX, ...fields.map((n) => n.toString(36).toUpperCase())].join('-');
  return `${payload}-${checksum(payload)}`;
}

export type DecodeResult = { ok: true; summary: BackupSummary } | { ok: false; error: string };

export function decodeBackup(input: unknown, today: number): DecodeResult {
  if (typeof input !== 'string' || input.length > MAX_BACKUP_INPUT) {
    return { ok: false, error: 'That is not an On-Call backup code.' };
  }
  const code = input.replace(/\s+/g, '').toUpperCase();
  if (!code) return { ok: false, error: 'Paste your backup code first.' };
  const match = BACKUP_PATTERN.exec(code);
  if (!match) return { ok: false, error: 'That is not an On-Call backup code.' };
  const payload = code.slice(0, -(match[2].length + 1));
  if (checksum(payload) !== match[2]) {
    return { ok: false, error: 'The code has a typo. Check it and try again.' };
  }
  const [lastDay, current, best, played, solved] = match[1]
    .slice(1)
    .split('-')
    .map((part) => parseInt(part, 36));
  const summary = { lastDay, current, best, played, solved };
  if (!isValidSummary(summary)) {
    return { ok: false, error: 'The numbers in this code do not add up.' };
  }
  // One day of slack for a device clock that is a little ahead.
  if (lastDay > today + 1) {
    return { ok: false, error: 'This code is from a later date. Check the clock on this device.' };
  }
  return { ok: true, summary };
}

/**
 * Restores the counters from a backup, then replays any rounds this browser
 * finished after the backup was made, so playing first and restoring later
 * still continues the streak.
 */
export function restoreBackup(local: OnCallState, summary: BackupSummary): OnCallState {
  let next: OnCallState = { ...summary, rounds: {}, active: local.active };
  const days = Object.keys(local.rounds)
    .map(Number)
    .sort((a, b) => a - b);
  for (const day of days) {
    const round = local.rounds[day];
    next =
      day > summary.lastDay
        ? applyResult(next, day, round)
        : { ...next, rounds: { ...next.rounds, [day]: round } };
  }
  return next;
}
