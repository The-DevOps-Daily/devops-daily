// Turn-based incident simulation for the Incident Commander Simulator.
// Pure and deterministic: the same choices always produce the same incident,
// so scenarios can be unit tested. Reading never advances time; only
// advance() moves the clock, minute by minute.

export type ResponderId = 'r1' | 'r2';
export type Owner = ResponderId | 'you';
export type ActionGroup = 'investigate' | 'mitigate' | 'communicate';
export type Risk = 'low' | 'medium' | 'high';
export type Phase = 'responding' | 'monitoring' | 'resolved';
export type Severity = 'SEV1' | 'SEV2' | 'SEV3';
export type UpdateKind = 'investigating' | 'identified' | 'monitoring' | 'resolved';

export interface Signals {
  /** Share of checkout requests that fail, in percent. */
  failed: number;
  /** Successful checkouts per minute. */
  success: number;
  /** Checkout attempts per minute. */
  demand: number;
  /** The scenario's key constraint, in its own unit. */
  constraint: number;
}

export interface MetricPoint extends Signals {
  t: number;
}

export interface Evidence {
  kind: 'log' | 'table' | 'trace' | 'diff' | 'note';
  title: string;
  lines: string[];
}

export interface AppliedChange {
  id: string;
  at: number;
}

export interface ModelContext {
  changes: AppliedChange[];
  /** Minute the change completed, if it has completed by t. */
  at(id: string, t: number): number | undefined;
  /** Deterministic noise in [-1, 1] for a minute and a key. */
  noise(t: number, key: string): number;
}

export interface ActionResult {
  evidence?: Evidence;
  interpretation?: string;
  findings?: string[];
  change?: string;
  message?: string;
}

export interface ActionDef {
  id: string;
  group: ActionGroup;
  owner: Owner;
  /** Investigations are phrased as the question they answer. */
  title: string;
  detail: string;
  minutes: number;
  risk?: Risk;
  reversible?: boolean;
  expected?: string;
  confirm?: string;
  repeatable?: boolean;
  /** Communication: which status update this posts. */
  update?: UpdateKind;
  /** A change that cannot interact with the others, such as pausing an unrelated rollout. */
  independent?: boolean;
  onDone?: (state: GameState, ctx: ModelContext) => ActionResult;
}

export interface ScenarioEvent {
  t: number;
  who: string;
  text: string;
  /** Skip the event if this is false when it is due. */
  when?: (state: GameState, ctx: ModelContext) => boolean;
}

export interface Responder {
  name: string;
  role: string;
}

export interface Scenario {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tagline: string;
  briefing: string;
  startClock: string;
  responders: Record<ResponderId, Responder>;
  constraint: {
    label: string;
    unit: string;
    healthy: string;
    lowerIsBetter: boolean;
    format: (v: number) => string;
  };
  successLabel: string;
  /** Changes made before the page, shown in Recent changes. Negative minutes. */
  recentChanges: { t: number; text: string }[];
  openQuestions: { text: string; answeredBy: string }[];
  causeFindings: string[];
  acceptableSeverities: Severity[];
  model: (t: number, ctx: ModelContext) => Signals;
  isHealthy: (p: Signals) => boolean;
  actions: ActionDef[];
  events: ScenarioEvent[];
  hints: [string, string, string];
  debrief: {
    rootCause: string;
    effectiveResponse: string[];
    alternatives: string[];
    revisit: (state: GameState) => string | null;
    lessons: string[];
    goDeeper: { title: string; href: string }[];
  };
}

export interface Task {
  uid: number;
  actionId: string;
  owner: Owner;
  start: number;
  end: number;
  status: 'running' | 'done';
}

export type FeedKind =
  'alert' | 'event' | 'dispatch' | 'result' | 'change' | 'update' | 'system' | 'hint';

export interface FeedItem {
  id: number;
  t: number;
  kind: FeedKind;
  who?: string;
  text: string;
  evidence?: Evidence;
  interpretation?: string;
}

export interface UpdateRecord {
  t: number;
  kind: UpdateKind;
  accurate: boolean;
  note: string;
}

export interface GameState {
  scenarioId: string;
  t: number;
  busyUntil: Record<Owner, number>;
  tasks: Task[];
  changes: AppliedChange[];
  findings: string[];
  feed: FeedItem[];
  updates: UpdateRecord[];
  severity: Severity | null;
  severitySetAt: number | null;
  phase: Phase;
  monitoringSince: number | null;
  phaseClaims: { t: number; phase: Phase; ok: boolean }[];
  history: MetricPoint[];
  hintLevel: number;
  firedEvents: number[];
  overdueWarnedFor: number[];
  ended: boolean;
  endReason: 'resolved' | 'timeout' | null;
  nextId: number;
}

export const TIME_LIMIT = 60;
export const SUSTAIN_MINUTES = 8;
export const FIRST_UPDATE_DUE = 10;
export const UPDATE_INTERVAL = 15;
export const HISTORY_START = -15;

function hash(n: number, key: string): number {
  let h = 2166136261 ^ n;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function makeContext(changes: AppliedChange[]): ModelContext {
  return {
    changes,
    at(id, t) {
      const c = changes.find((x) => x.id === id && x.at <= t);
      return c?.at;
    },
    noise(t, key) {
      return hash(t + 1000, key) * 2 - 1;
    },
  };
}

function point(s: Scenario, t: number, changes: AppliedChange[]): MetricPoint {
  const raw = s.model(t, makeContext(changes));
  const failed = Math.min(100, Math.max(0, raw.failed));
  return {
    t,
    failed,
    demand: raw.demand,
    success: raw.demand * (1 - failed / 100),
    constraint: raw.constraint,
  };
}

function pushFeed(state: GameState, item: Omit<FeedItem, 'id'>): GameState {
  return {
    ...state,
    feed: [...state.feed, { ...item, id: state.nextId }],
    nextId: state.nextId + 1,
  };
}

export function ownerName(s: Scenario, owner: Owner): string {
  return owner === 'you' ? 'You' : s.responders[owner].name;
}

export function createGame(s: Scenario): GameState {
  const history: MetricPoint[] = [];
  for (let t = HISTORY_START; t <= 0; t++) history.push(point(s, t, []));
  const now = history[history.length - 1];
  let state: GameState = {
    scenarioId: s.id,
    t: 0,
    busyUntil: { you: 0, r1: 0, r2: 0 },
    tasks: [],
    changes: [],
    findings: [],
    feed: [],
    updates: [],
    severity: null,
    severitySetAt: null,
    phase: 'responding',
    monitoringSince: null,
    phaseClaims: [],
    history,
    hintLevel: 0,
    firedEvents: [],
    overdueWarnedFor: [],
    ended: false,
    endReason: null,
    nextId: 1,
  };
  state = pushFeed(state, {
    t: 0,
    kind: 'alert',
    who: 'Pager',
    text: `Paged: checkout failures at ${now.failed.toFixed(1)}% (normal is under 0.5%). You are the incident commander.`,
  });
  return state;
}

export function currentPoint(state: GameState): MetricPoint {
  return state.history[state.history.length - 1];
}

export function getAction(s: Scenario, id: string): ActionDef {
  const a = s.actions.find((x) => x.id === id);
  if (!a) throw new Error(`unknown action ${id}`);
  return a;
}

export function isDone(state: GameState, actionId: string): boolean {
  return state.tasks.some((t) => t.actionId === actionId);
}

export type DispatchBlock = 'ended' | 'busy' | 'done' | null;

export function dispatchBlock(state: GameState, a: ActionDef): DispatchBlock {
  if (state.ended) return 'ended';
  if (!a.repeatable && isDone(state, a.id)) return 'done';
  if (state.busyUntil[a.owner] > state.t) return 'busy';
  return null;
}

export function dispatch(s: Scenario, state: GameState, actionId: string): GameState {
  const a = getAction(s, actionId);
  if (dispatchBlock(state, a)) return state;
  const task: Task = {
    uid: state.nextId,
    actionId,
    owner: a.owner,
    start: state.t,
    end: state.t + a.minutes,
    status: 'running',
  };
  let next: GameState = {
    ...state,
    nextId: state.nextId + 1,
    tasks: [...state.tasks, task],
    busyUntil: { ...state.busyUntil, [a.owner]: task.end },
  };
  const verb =
    a.group === 'investigate' ? 'Looking into' : a.group === 'mitigate' ? 'Starting' : 'Posting';
  next = pushFeed(next, {
    t: state.t,
    kind: 'dispatch',
    who: ownerName(s, a.owner),
    text: `${verb}: ${a.title}${a.minutes > 0 ? ` (done at T+${pad(task.end)})` : ''}`,
  });
  if (a.minutes === 0) next = completeTask(s, next, task);
  return next;
}

function judgeUpdate(
  s: Scenario,
  state: GameState,
  kind: UpdateKind
): { accurate: boolean; note: string } {
  const p = currentPoint(state);
  const healthy = s.isHealthy(p);
  switch (kind) {
    case 'investigating':
      return { accurate: true, note: 'Acknowledged the impact and set the next update time.' };
    case 'identified': {
      const ok = state.findings.some((f) => s.causeFindings.includes(f));
      return ok
        ? { accurate: true, note: 'Named a likely cause that your evidence supports.' }
        : { accurate: false, note: 'Claimed a cause before any evidence pointed to one.' };
    }
    case 'monitoring':
      return healthy
        ? { accurate: true, note: 'Said a fix was in place while checkouts were recovering.' }
        : {
            accurate: false,
            note: `Said checkouts were recovering while ${p.failed.toFixed(1)}% were still failing.`,
          };
    case 'resolved':
      return sustainedHealthy(s, state)
        ? { accurate: true, note: 'Closed the incident after recovery held.' }
        : { accurate: false, note: 'Told customers it was resolved before recovery had held.' };
  }
}

function completeTask(s: Scenario, state: GameState, task: Task): GameState {
  const a = getAction(s, task.actionId);
  let next: GameState = {
    ...state,
    tasks: state.tasks.map((x) => (x.uid === task.uid ? { ...x, status: 'done' as const } : x)),
  };
  if (a.update) {
    const verdict = judgeUpdate(s, next, a.update);
    next = { ...next, updates: [...next.updates, { t: next.t, kind: a.update, ...verdict }] };
    next = pushFeed(next, {
      t: next.t,
      kind: 'update',
      who: 'You',
      text: `Status page: ${a.detail}`,
    });
    return next;
  }
  const result = a.onDone ? a.onDone(next, makeContext(next.changes)) : {};
  if (result.findings?.length) {
    next = { ...next, findings: Array.from(new Set([...next.findings, ...result.findings])) };
  }
  if (result.change) {
    next = { ...next, changes: [...next.changes, { id: result.change, at: next.t }] };
  }
  next = pushFeed(next, {
    t: next.t,
    kind: result.change ? 'change' : 'result',
    who: ownerName(s, a.owner),
    text: result.message ?? (a.group === 'investigate' ? `Answer: ${a.title}` : `Done: ${a.title}`),
    evidence: result.evidence,
    interpretation: result.interpretation,
  });
  return next;
}

export function sustainedHealthy(s: Scenario, state: GameState): boolean {
  const recent = state.history.filter((p) => p.t > state.t - SUSTAIN_MINUTES && p.t <= state.t);
  return recent.length >= SUSTAIN_MINUTES && recent.every((p) => s.isHealthy(p));
}

/** Update deadlines: the first is due at T+10, then every 15 minutes after the last update. */
export function nextUpdateDue(state: GameState): number {
  const last = state.updates[state.updates.length - 1];
  return last ? last.t + UPDATE_INTERVAL : FIRST_UPDATE_DUE;
}

function stepMinute(s: Scenario, state: GameState): GameState {
  let next: GameState = { ...state, t: state.t + 1 };
  for (const task of next.tasks) {
    if (task.status === 'running' && task.end <= next.t) next = completeTask(s, next, task);
  }
  next = { ...next, history: [...next.history, point(s, next.t, next.changes)] };
  s.events.forEach((e, i) => {
    if (e.t === next.t && !next.firedEvents.includes(i)) {
      const show = !e.when || e.when(next, makeContext(next.changes));
      next = { ...next, firedEvents: [...next.firedEvents, i] };
      if (show) next = pushFeed(next, { t: next.t, kind: 'event', who: e.who, text: e.text });
    }
  });
  const due = nextUpdateDue(next);
  if (next.t > due && !next.overdueWarnedFor.includes(due) && next.phase !== 'resolved') {
    next = pushFeed(
      { ...next, overdueWarnedFor: [...next.overdueWarnedFor, due] },
      {
        t: next.t,
        kind: 'system',
        text: `Status update overdue (was due at T+${pad(due)}). Customers and support are waiting.`,
      }
    );
  }
  if (next.phase === 'monitoring' && !s.isHealthy(currentPoint(next))) {
    next = pushFeed(
      { ...next, phase: 'responding', monitoringSince: null },
      {
        t: next.t,
        kind: 'alert',
        who: 'Monitoring',
        text: 'Recovery did not hold: failures are back above normal. Back to responding.',
      }
    );
  }
  if (next.t >= TIME_LIMIT && !next.ended) {
    next = pushFeed(
      { ...next, ended: true, endReason: 'timeout' },
      {
        t: next.t,
        kind: 'system',
        text: `T+${TIME_LIMIT}: the incident review starts now, resolved or not.`,
      }
    );
  }
  return next;
}

export function advance(s: Scenario, state: GameState, minutes = 1): GameState {
  let next = state;
  for (let i = 0; i < minutes && !next.ended; i++) next = stepMinute(s, next);
  return next;
}

/** Advance until the next task completes or event fires, at least 1 and at most 10 minutes. */
export function advanceToNextEvent(s: Scenario, state: GameState): GameState {
  const marks = [
    ...state.tasks.filter((x) => x.status === 'running').map((x) => x.end),
    ...s.events.map((e, i) => (state.firedEvents.includes(i) ? Infinity : e.t)),
  ].filter((m) => m > state.t);
  const target = Math.min(state.t + 10, ...marks);
  return advance(s, state, Math.max(1, target - state.t));
}

export function setSeverity(state: GameState, sev: Severity): GameState {
  if (state.ended) return state;
  return { ...state, severity: sev, severitySetAt: state.severitySetAt ?? state.t };
}

export function startMonitoring(s: Scenario, state: GameState): GameState {
  if (state.ended || state.phase !== 'responding') return state;
  const p = currentPoint(state);
  const ok = s.isHealthy(p);
  let next: GameState = {
    ...state,
    phaseClaims: [...state.phaseClaims, { t: state.t, phase: 'monitoring', ok }],
  };
  if (!ok) {
    return pushFeed(next, {
      t: state.t,
      kind: 'system',
      text: `Not mitigated yet: ${p.failed.toFixed(1)}% of checkouts are failing. Keep working, then start monitoring when the signals are back to normal.`,
    });
  }
  next = { ...next, phase: 'monitoring', monitoringSince: state.t };
  return pushFeed(next, {
    t: state.t,
    kind: 'system',
    text: `Monitoring started. Recovery has to hold for ${SUSTAIN_MINUTES} minutes before you can resolve.`,
  });
}

export function resolveIncident(s: Scenario, state: GameState): GameState {
  if (state.ended) return state;
  const ok = state.phase === 'monitoring' && sustainedHealthy(s, state);
  let next: GameState = {
    ...state,
    phaseClaims: [...state.phaseClaims, { t: state.t, phase: 'resolved', ok }],
  };
  if (!ok) {
    const why =
      state.phase !== 'monitoring'
        ? 'Start monitoring first, once the signals are back to normal.'
        : `Recovery has to hold for ${SUSTAIN_MINUTES} minutes; keep watching.`;
    return pushFeed(next, { t: state.t, kind: 'system', text: `Not ready to resolve. ${why}` });
  }
  next = { ...next, phase: 'resolved', ended: true, endReason: 'resolved' };
  return pushFeed(next, {
    t: state.t,
    kind: 'system',
    text: 'Incident resolved. Time for the review.',
  });
}

export function takeHint(s: Scenario, state: GameState): GameState {
  if (state.hintLevel >= 3 || state.ended) return state;
  const level = state.hintLevel + 1;
  return pushFeed(
    { ...state, hintLevel: level },
    { t: state.t, kind: 'hint', who: 'Experienced IC', text: s.hints[level - 1] }
  );
}

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function clockAt(s: Scenario, t: number): string {
  const [h, m] = s.startClock.split(':').map(Number);
  const total = h * 60 + m + t;
  const hh = ((Math.floor(total / 60) % 24) + 24) % 24;
  return `${pad(hh)}:${pad(((total % 60) + 60) % 60)}`;
}

// ---------- Debrief ----------

export interface Debrief {
  endReason: 'resolved' | 'timeout' | null;
  mitigatedAt: number | null;
  failedRequests: number;
  firstUpdateAt: number | null;
  updatesOnTime: number;
  updatesDue: number;
  inaccurateUpdates: UpdateRecord[];
  severityNote: string;
  coordination: string[];
  safety: string[];
  revisit: string | null;
  outageMinutes: number;
}

/** Deadlines that fell inside the incident, and whether each was met in time. */
function updateCadence(state: GameState): { due: number; onTime: number } {
  const end = state.t;
  let due = 0;
  let onTime = 0;
  let deadline = FIRST_UPDATE_DUE;
  let i = 0;
  while (deadline <= end) {
    due++;
    const u = state.updates.slice(i).find((x) => x.t <= deadline);
    if (u) {
      onTime++;
      i = state.updates.indexOf(u) + 1;
      deadline = u.t + UPDATE_INTERVAL;
    } else {
      const late = state.updates.slice(i).find((x) => x.t > deadline);
      if (late) {
        i = state.updates.indexOf(late) + 1;
        deadline = late.t + UPDATE_INTERVAL;
      } else {
        deadline += UPDATE_INTERVAL;
      }
    }
  }
  return { due, onTime };
}

export function mitigatedAt(s: Scenario, state: GameState): number | null {
  const pts = state.history.filter((p) => p.t >= 0);
  for (let i = 0; i < pts.length; i++) {
    const window = pts.slice(i, i + SUSTAIN_MINUTES);
    if (window.length === SUSTAIN_MINUTES && window.every((p) => s.isHealthy(p))) return pts[i].t;
  }
  return null;
}

export function buildDebrief(s: Scenario, state: GameState): Debrief {
  const pts = state.history.filter((p) => p.t > 0);
  const failedRequests = Math.round(pts.reduce((sum, p) => sum + (p.demand * p.failed) / 100, 0));
  const outageMinutes = pts.filter((p) => p.failed >= 90).length;
  const cadence = updateCadence(state);

  const coordination: string[] = [];
  const running = (t: number) => state.tasks.filter((x) => x.start <= t && x.end > t).length;
  const parallel = state.history.some((p) => p.t >= 0 && running(p.t) >= 2);
  coordination.push(
    parallel
      ? 'You kept more than one line of work going at once.'
      : 'Only one thing happened at a time. Your responders can investigate in parallel while you communicate.'
  );
  const mitigations = state.tasks.filter((x) => getAction(s, x.actionId).group === 'mitigate');
  const interacting = mitigations.filter((x) => !getAction(s, x.actionId).independent);
  const clashes = interacting.filter((a, i) =>
    interacting.some((b, j) => j !== i && a.start < b.end && b.start < a.end)
  );
  if (clashes.length) {
    coordination.push(
      'Two production changes overlapped, which makes it hard to tell which one helped or hurt.'
    );
  }

  const safety: string[] = [];
  for (const task of mitigations) {
    const a = getAction(s, task.actionId);
    if (a.risk === 'high') safety.push(`High-risk change at T+${pad(task.start)}: ${a.title}.`);
  }
  if (outageMinutes > 0)
    safety.push(`Your changes caused ${outageMinutes} minute(s) of near-total checkout outage.`);
  const early = state.phaseClaims.filter((c) => !c.ok);
  if (early.length)
    safety.push(
      `Tried to move to ${early.map((c) => c.phase).join(' and ')} before the signals supported it.`
    );
  if (!safety.length) safety.push('No high-risk changes and no premature claims.');

  let severityNote: string;
  if (!state.severity)
    severityNote = 'You never set a severity. It tells everyone how much attention this needs.';
  else if (s.acceptableSeverities.includes(state.severity))
    severityNote = `${state.severity} at T+${pad(state.severitySetAt ?? 0)} fits the impact.`;
  else
    severityNote = `${state.severity} undersells or oversells this impact; ${s.acceptableSeverities.join(' or ')} fits better.`;

  return {
    endReason: state.endReason,
    mitigatedAt: mitigatedAt(s, state),
    failedRequests,
    firstUpdateAt: state.updates[0]?.t ?? null,
    updatesOnTime: cadence.onTime,
    updatesDue: cadence.due,
    inaccurateUpdates: state.updates.filter((u) => !u.accurate),
    severityNote,
    coordination,
    safety,
    revisit: s.debrief.revisit(state),
    outageMinutes,
  };
}

export function buildRecap(s: Scenario, state: GameState, d: Debrief): string {
  const lines = [
    `Incident Commander Simulator: ${s.title}`,
    d.endReason === 'resolved'
      ? `Resolved at T+${pad(state.t)}`
      : `Not resolved by T+${TIME_LIMIT}`,
    d.mitigatedAt !== null
      ? `Sustained mitigation from T+${pad(d.mitigatedAt)}`
      : 'No sustained mitigation',
    `Failed checkout requests: ${d.failedRequests.toLocaleString('en-US')}`,
    `Status updates on time: ${d.updatesOnTime}/${d.updatesDue}`,
    'Play it: https://devops-daily.com/games/incident-commander-simulator',
  ];
  return lines.join('\n');
}
