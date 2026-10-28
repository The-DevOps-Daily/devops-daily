'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Flame,
  KeyRound,
  Minus,
  Search,
  Share2,
  ShieldCheck,
  Siren,
  Stethoscope,
  Terminal,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  applyResult,
  buildShareText,
  canInspect,
  currentStreak,
  dayNumber,
  decodeBackup,
  emptyState,
  encodeBackup,
  getCorrectCause,
  getIncidentByNumber,
  getIncidentForDay,
  MAX_MOVES,
  playRound,
  puzzleNumber,
  restoreBackup,
  sanitizeState,
  SUBSYSTEMS,
  TOPICS,
  verdictFor,
  type Action,
  type Incident,
  type MoveRecord,
  type OnCallState,
  type Verdict,
} from '@/lib/on-call';

const STORAGE_KEY = 'devops-daily:on-call';

const SEVERITY_STYLE: Record<string, string> = {
  SEV1: 'bg-red-500/15 text-red-300 border-red-500/40',
  SEV2: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  SEV3: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
};

const VERDICT_COPY: Record<Verdict, { label: string; className: string }> = {
  correct: { label: 'Root cause found', className: 'text-emerald-300' },
  partial: { label: 'Right area, not the root cause', className: 'text-amber-200' },
  wrong: { label: 'Wrong area', className: 'text-zinc-300' },
};

const TILE_STYLE = {
  inspect: 'border-sky-500/50 bg-sky-500/20 text-sky-200',
  correct: 'border-emerald-400 bg-emerald-500 text-black',
  partial: 'border-amber-300 bg-amber-400 text-black',
  wrong: 'border-zinc-600 bg-zinc-700 text-zinc-100',
} as const;

const TILE_LABEL = {
  inspect: 'inspected a signal',
  correct: 'root cause',
  partial: 'right area',
  wrong: 'wrong area',
} as const;

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';

function loadState(): OnCallState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeState(JSON.parse(raw)) : emptyState();
  } catch {
    return emptyState();
  }
}

function saveState(state: OnCallState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / disabled storage: the game still works, just no streak */
  }
}

function untilNextIncident(now: number): string | null {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  const minutes = Math.ceil((next.getTime() - now) / 60_000);
  if (minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

/** Arrow keys, Home and End move focus between the buttons of one list. */
function moveFocus(event: React.KeyboardEvent<HTMLElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-nav]'));
  const index = items.indexOf(document.activeElement as HTMLElement);
  if (index === -1) return;
  event.preventDefault();
  const last = items.length - 1;
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? last
        : event.key === 'ArrowDown'
          ? (index + 1) % items.length
          : (index - 1 + items.length) % items.length;
  items[next]?.focus();
}

function MoveTile({ move, size = 'sm' }: { move?: MoveRecord; size?: 'sm' | 'lg' }) {
  const box = size === 'lg' ? 'h-9 w-9' : 'h-6 w-6';
  if (!move) {
    return <span aria-hidden className={cn(box, 'rounded border border-dashed border-zinc-700')} />;
  }
  const kind = move.kind === 'inspect' ? 'inspect' : (move.verdict ?? 'wrong');
  const Icon =
    kind === 'inspect' ? Search : kind === 'correct' ? Check : kind === 'partial' ? Minus : X;
  return (
    <span
      title={TILE_LABEL[kind]}
      className={cn(box, 'flex items-center justify-center rounded border', TILE_STYLE[kind])}
    >
      <Icon aria-hidden className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      <span className="sr-only">{TILE_LABEL[kind]}</span>
    </span>
  );
}

function SignalOutput({ command, output }: { command?: string; output: string }) {
  return (
    <div className="min-w-0 space-y-1">
      {command && <p className="break-all text-xs text-emerald-300">$ {command}</p>}
      <pre className="max-w-full overflow-x-auto whitespace-pre pb-1 text-xs leading-relaxed text-zinc-200 [scrollbar-width:thin]">
        {output}
      </pre>
    </div>
  );
}

export default function OnCall() {
  // The day + incident are derived from "now" once on mount so SSR/export
  // renders a stable shell and the client fills in today's puzzle.
  const [day, setDay] = useState<number | null>(null);
  const [state, setState] = useState<OnCallState>(emptyState);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [lastVerdict, setLastVerdict] = useState<Verdict | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [copied, setCopied] = useState(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const focusResult = useRef(false);

  // Hydrate from storage and resume today's round, finished or not.
  useEffect(() => {
    const today = dayNumber(new Date());
    const loaded = loadState();
    const stored = loaded.rounds[today];
    const active = loaded.active?.day === today ? loaded.active : null;
    const number = stored?.incident ?? active?.incident;
    setDay(today);
    setState(loaded);
    setIncident((number && getIncidentByNumber(number)) || getIncidentForDay(today));
    if (!stored && active) setActions(active.actions);
  }, []);

  const view = useMemo(() => (incident ? playRound(incident, actions) : null), [incident, actions]);
  const stored = day !== null ? state.rounds[day] : undefined;
  const finished = Boolean(stored) || Boolean(view?.finished);

  useEffect(() => {
    if (finished && focusResult.current) {
      focusResult.current = false;
      resultHeading.current?.focus();
    }
  }, [finished]);

  const act = useCallback(
    (action: Action) => {
      if (!incident || day === null || !view || finished) return;
      const next = playRound(incident, [...view.actions, action]);
      if (next.actions.length === view.actions.length) return; // not a valid move
      setActions(next.actions);

      let nextState: OnCallState;
      if (next.finished) {
        nextState = applyResult({ ...state, active: null }, day, {
          incident: incident.number,
          solved: next.solved,
          moves: next.moves,
        });
        focusResult.current = true;
        if (next.solved) {
          confetti({
            particleCount: 110,
            spread: 70,
            origin: { y: 0.3 },
            disableForReducedMotion: true,
          });
        }
      } else {
        nextState = {
          ...state,
          active: { day, incident: incident.number, actions: next.actions },
        };
      }
      setState(nextState);
      saveState(nextState);

      const left = `${next.movesLeft} ${next.movesLeft === 1 ? 'move' : 'moves'} left.`;
      if (action.kind === 'inspect') {
        setLastVerdict(null);
        setAnnouncement(`${incident.evidence[action.index].label} opened. ${left}`);
      } else {
        const verdict = verdictFor(incident, action.causeId);
        setLastVerdict(verdict);
        setAnnouncement(
          next.finished
            ? next.solved
              ? 'Root cause found. Incident resolved.'
              : 'Out of moves.'
            : `${VERDICT_COPY[verdict].label}. ${left}`
        );
      }
    },
    [incident, day, view, finished, state]
  );

  const toggleSignal = useCallback((index: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  if (!incident || day === null || !view) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 font-mono text-zinc-300">
        <Activity className="mr-2 h-5 w-5 motion-safe:animate-pulse" aria-hidden /> Loading
        today&apos;s incident…
      </div>
    );
  }

  const moves = stored?.moves ?? view.moves;
  const solved = stored?.solved ?? view.solved;
  const movesLeft = MAX_MOVES - moves.length;
  const puzzle = puzzleNumber(day);
  const streak = currentStreak(state, day);
  const correct = getCorrectCause(incident);

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-3xl space-y-4 font-mono">
        {/* Pager header */}
        <motion.section
          aria-labelledby="oncall-title"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-zinc-800 bg-black/40 px-4 py-2 text-xs text-zinc-300">
            <span className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5" aria-hidden /> on-call · daily incident
            </span>
            <span>
              #{puzzle} · streak {streak}
              {state.best > 0 ? ` · best ${state.best}` : ''}
            </span>
          </div>

          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <motion.span
                animate={finished ? {} : { scale: [1, 1.12, 1] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold tracking-wide',
                  SEVERITY_STYLE[incident.severity]
                )}
              >
                <Siren className="h-3.5 w-3.5" aria-hidden /> {incident.severity}
              </motion.span>
              <h2 id="oncall-title" className="text-base font-bold text-zinc-100 sm:text-lg">
                {incident.title}
              </h2>
            </div>

            <p className="rounded-lg border border-zinc-800 bg-black/50 p-3 text-sm text-amber-100">
              <span className="mr-2 font-bold text-amber-400">▸ PAGE</span>
              {incident.page}
            </p>

            <ul className="space-y-1 text-sm text-zinc-300">
              {incident.symptoms.map((symptom) => (
                <li key={symptom} className="flex gap-2">
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                  {symptom}
                </li>
              ))}
            </ul>
          </div>
        </motion.section>

        {/* Moves tracker */}
        <div className="sticky top-[var(--site-header-h,0px)] z-10 flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/95 px-3 py-2.5 backdrop-blur sm:px-4">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <span className="hidden sm:inline">Moves</span>
            <div
              className="flex gap-1"
              role="img"
              aria-label={`${moves.length} of ${MAX_MOVES} moves used`}
            >
              {Array.from({ length: MAX_MOVES }).map((_, i) => (
                <MoveTile key={i} move={moves[i]} />
              ))}
            </div>
          </div>
          <span
            className={cn(
              'text-sm font-bold',
              !finished && movesLeft <= 2 ? 'text-red-300' : 'text-zinc-300'
            )}
          >
            {movesLeft} left
          </span>
        </div>

        {!finished && (
          <>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Each signal you open and each cause you name costs one move. Arrow keys move between
              items in a list.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Evidence */}
              <section aria-labelledby="oncall-signals" className="min-w-0 space-y-2">
                <h3
                  id="oncall-signals"
                  className="flex items-center gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-200"
                >
                  <Search className="h-4 w-4 text-sky-500" aria-hidden /> Inspect signals
                </h3>
                {view.movesLeft === 1 && (
                  <p className="text-xs font-semibold text-red-600 dark:text-red-300">
                    Last move: name the root cause.
                  </p>
                )}
                <ul className="space-y-2" onKeyDown={moveFocus}>
                  {incident.evidence.map((evidence, i) => {
                    const open = view.revealed.includes(i);
                    const expanded = open && !collapsed.has(i);
                    const blocked = !open && !canInspect(view, i);
                    return (
                      <li
                        key={evidence.label}
                        className={cn(
                          'min-w-0 overflow-hidden rounded-lg border',
                          open ? 'border-sky-500/40 bg-zinc-950' : 'border-zinc-800 bg-zinc-950'
                        )}
                      >
                        <button
                          type="button"
                          data-nav
                          aria-expanded={open ? expanded : undefined}
                          aria-controls={open ? `oncall-signal-${i}` : undefined}
                          aria-disabled={blocked || undefined}
                          onClick={() =>
                            open ? toggleSignal(i) : act({ kind: 'inspect', index: i })
                          }
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-lg p-3 text-left text-sm transition-colors',
                            FOCUS_RING,
                            blocked ? 'cursor-not-allowed opacity-50' : 'hover:bg-zinc-900'
                          )}
                        >
                          <span className="font-semibold text-zinc-100">{evidence.label}</span>
                          <span className="shrink-0 text-xs text-zinc-400">
                            {open ? (expanded ? 'hide' : 'show') : '1 move'}
                          </span>
                        </button>
                        <AnimatePresence initial={false}>
                          {expanded && (
                            <motion.div
                              id={`oncall-signal-${i}`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="border-t border-zinc-800 px-3 pb-3 pt-2"
                            >
                              <SignalOutput command={evidence.command} output={evidence.output} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Diagnose */}
              <section aria-labelledby="oncall-diagnose" className="min-w-0 space-y-2">
                <h3
                  id="oncall-diagnose"
                  className="flex items-center gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-200"
                >
                  <Stethoscope className="h-4 w-4 text-emerald-500" aria-hidden /> Diagnose root
                  cause
                </h3>
                <ul className="space-y-2" onKeyDown={moveFocus}>
                  {incident.causes.map((cause) => {
                    const tried = view.tried.includes(cause.id);
                    const verdict = tried ? verdictFor(incident, cause.id) : null;
                    return (
                      <li key={cause.id}>
                        <button
                          type="button"
                          data-nav
                          aria-disabled={tried || undefined}
                          onClick={() => !tried && act({ kind: 'diagnose', causeId: cause.id })}
                          className={cn(
                            'w-full rounded-lg border p-3 text-left text-sm transition-colors',
                            FOCUS_RING,
                            !tried &&
                              'border-zinc-800 bg-zinc-950 text-zinc-100 hover:border-emerald-500/50 hover:bg-zinc-900',
                            verdict === 'partial' &&
                              'cursor-not-allowed border-amber-500/50 bg-amber-950 text-amber-100',
                            verdict === 'wrong' &&
                              'cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-400 line-through'
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-medium">{cause.label}</span>
                            {verdict && (
                              <span className="shrink-0">
                                <MoveTile move={{ kind: 'diagnose', verdict }} />
                              </span>
                            )}
                          </span>
                          {verdict === 'partial' && (
                            <span className="mt-1 block text-xs text-amber-200">
                              Right area: {SUBSYSTEMS[cause.subsystem]}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <AnimatePresence>
                  {lastVerdict && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={cn(
                        'rounded-md bg-zinc-950 py-1.5 text-center text-xs font-semibold',
                        VERDICT_COPY[lastVerdict].className
                      )}
                    >
                      {VERDICT_COPY[lastVerdict].label}
                    </motion.p>
                  )}
                </AnimatePresence>
              </section>
            </div>
          </>
        )}

        {/* Result */}
        {finished && (
          <motion.section
            aria-labelledby="oncall-result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'space-y-4 rounded-2xl border bg-zinc-950 p-4 sm:p-5',
              solved ? 'border-emerald-500/40' : 'border-red-500/40'
            )}
          >
            <h3
              id="oncall-result"
              ref={resultHeading}
              tabIndex={-1}
              className="flex items-center gap-2 text-lg font-bold focus:outline-none"
            >
              {solved ? (
                <>
                  <Check className="h-5 w-5 text-emerald-400" aria-hidden />
                  <span className="text-emerald-300">
                    Resolved in {moves.length}/{MAX_MOVES}
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden />
                  <span className="text-red-300">Out of moves. Here is what happened.</span>
                </>
              )}
            </h3>

            <div
              className="flex gap-1.5"
              role="img"
              aria-label={moves
                .map((m) => TILE_LABEL[m.kind === 'inspect' ? 'inspect' : (m.verdict ?? 'wrong')])
                .join(', ')}
            >
              {moves.map((move, i) => (
                <MoveTile key={i} move={move} size="lg" />
              ))}
            </div>

            <div className="rounded-lg border border-emerald-500/30 bg-black/40 p-3 text-sm">
              <p className="mb-1 flex flex-wrap items-center gap-2 font-bold text-zinc-100">
                <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden /> Root cause
                <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[11px] font-normal text-zinc-300">
                  {TOPICS[incident.topic]}
                </span>
              </p>
              <p className="text-emerald-200">{correct.label}</p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-black/40 p-3 text-sm">
              <p className="mb-1 font-bold text-zinc-100">What happened</p>
              <p className="text-zinc-300">{incident.resolution}</p>
            </div>
            <div className="flex items-start gap-2 text-sm text-zinc-200">
              <Flame className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
              <p>
                <span className="font-bold">How to prevent it: </span>
                {incident.lesson}
              </p>
            </div>

            <ShareRow
              text={buildShareText({ puzzle, severity: incident.severity, solved, moves })}
              copied={copied}
              setCopied={setCopied}
            />

            <details className="group rounded-lg border border-zinc-800 bg-black/30">
              <summary
                className={cn(
                  'cursor-pointer list-none rounded-lg px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-900',
                  FOCUS_RING
                )}
              >
                <ChevronRight
                  className="mr-1 inline h-4 w-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                  aria-hidden
                />
                Review every signal
              </summary>
              <ul className="space-y-3 border-t border-zinc-800 p-3">
                {incident.evidence.map((evidence) => (
                  <li key={evidence.label} className="min-w-0">
                    <p className="mb-1 text-sm font-semibold text-zinc-100">{evidence.label}</p>
                    <SignalOutput command={evidence.command} output={evidence.output} />
                  </li>
                ))}
              </ul>
            </details>
          </motion.section>
        )}

        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>

        <StreakPanel day={day} state={state} setState={setState} />
      </div>
    </MotionConfig>
  );
}

function ShareRow({
  text,
  copied,
  setCopied,
}: {
  text: string;
  copied: boolean;
  setCopied: (value: boolean) => void;
}) {
  const share = useCallback(async () => {
    try {
      // The share sheet suits phones; on desktop copying is what people expect.
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* dismissed share sheet or no clipboard access: the text is shown below */
    }
  }, [text, setCopied]);

  const next = untilNextIncident(Date.now());

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={share}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-emerald-300',
            FOCUS_RING
          )}
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Share2 className="h-4 w-4" aria-hidden />
          )}
          {copied ? 'Copied!' : 'Share result'}
        </button>
        <span className="text-xs text-zinc-300" role="status">
          {copied ? 'Result copied. ' : ''}
          {next
            ? `Spoiler-free. Next incident in ${next} (00:00 UTC).`
            : 'A new incident is out. Reload the page to play it.'}
        </span>
      </div>
      <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-black/40 p-2 text-xs text-zinc-300">
        {text}
      </pre>
    </div>
  );
}

function StreakPanel({
  day,
  state,
  setState,
}: {
  day: number;
  state: OnCallState;
  setState: (state: OnCallState) => void;
}) {
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const code = encodeBackup(state);
  const rate = state.played > 0 ? Math.round((state.solved / state.played) * 100) : 0;

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the code is visible and selectable */
    }
  };

  const restore = (event: React.FormEvent) => {
    event.preventDefault();
    const result = decodeBackup(input, day);
    if (!result.ok) {
      setMessage({ ok: false, text: result.error });
      return;
    }
    const next = restoreBackup(state, result.summary);
    setState(next);
    saveState(next);
    setInput('');
    setMessage({
      ok: true,
      text: `Restored: streak ${currentStreak(next, day)}, best ${next.best}, ${next.played} played.`,
    });
  };

  const stats = [
    ['Played', state.played],
    ['Solved', `${rate}%`],
    ['Streak', currentStreak(state, day)],
    ['Best', state.best],
  ] as const;

  return (
    <details className="group rounded-xl border border-zinc-800 bg-zinc-950 text-sm">
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 font-semibold text-zinc-100 hover:bg-zinc-900',
          FOCUS_RING
        )}
      >
        <KeyRound className="h-4 w-4 text-amber-400" aria-hidden />
        Stats and streak backup
        <ChevronRight
          className="ml-auto h-4 w-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>
      <div className="space-y-4 border-t border-zinc-800 p-4">
        <dl className="grid grid-cols-4 gap-2 text-center">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-zinc-800 bg-black/40 p-2">
              <dt className="text-[11px] text-zinc-400">{label}</dt>
              <dd className="text-lg font-bold text-zinc-100">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-2">
          <p className="font-semibold text-zinc-100">Your backup code</p>
          {code ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <code className="select-all rounded border border-zinc-700 bg-black/50 px-2 py-1 text-amber-200">
                  {code}
                </code>
                <button
                  type="button"
                  onClick={copy}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-900',
                    FOCUS_RING
                  )}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-zinc-400">
                Your streak lives only in this browser. Keep this code somewhere safe; if you clear
                your browser data or switch devices, paste it below to get your streak back. The
                code changes after each round.
              </p>
            </>
          ) : (
            <p className="text-xs text-zinc-400">Finish a round to get a backup code.</p>
          )}
        </div>

        <form onSubmit={restore} className="space-y-2">
          <label htmlFor="oncall-backup" className="block font-semibold text-zinc-100">
            Restore from a code
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="oncall-backup"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={80}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="OC1-..."
              aria-describedby="oncall-backup-status"
              className={cn(
                'min-w-0 flex-1 rounded-md border border-zinc-700 bg-black/50 px-2 py-1.5 text-zinc-100 placeholder:text-zinc-400',
                FOCUS_RING
              )}
            />
            <button
              type="submit"
              className={cn(
                'rounded-md bg-amber-400 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-300',
                FOCUS_RING
              )}
            >
              Restore
            </button>
          </div>
          <p
            id="oncall-backup-status"
            role="status"
            className={cn('min-h-4 text-xs', message?.ok ? 'text-emerald-300' : 'text-red-300')}
          >
            {message?.text}
          </p>
        </form>
      </div>
    </details>
  );
}
