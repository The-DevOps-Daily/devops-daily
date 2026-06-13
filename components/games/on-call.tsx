'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Flame,
  Search,
  Share2,
  Siren,
  Stethoscope,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  applyResult,
  buildShareText,
  type Cause,
  type Evidence,
  dayNumber,
  emptyState,
  getDailyIncident,
  MAX_MOVES,
  moveEmoji,
  type MoveRecord,
  type OnCallState,
  type RoundResult,
  type Verdict,
} from '@/lib/on-call';

const STORAGE_KEY = 'devops-daily:on-call';

const SEVERITY_STYLE: Record<string, string> = {
  SEV1: 'bg-red-500/15 text-red-400 border-red-500/40',
  SEV2: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
  SEV3: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
};

const VERDICT_COPY: Record<Verdict, { label: string; className: string }> = {
  correct: { label: 'Root cause found', className: 'text-emerald-400' },
  partial: { label: 'Right subsystem, not the root cause', className: 'text-amber-300' },
  wrong: { label: 'Wrong subsystem', className: 'text-zinc-400' },
};

function loadState(): OnCallState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return { ...emptyState(), ...JSON.parse(raw) };
  } catch {
    return emptyState();
  }
}

function saveState(state: OnCallState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / disabled storage: game still works, just no streak */
  }
}

export default function OnCall() {
  // The day + incident are derived from "now" once on mount so SSR/export
  // renders a stable shell and the client fills in today's puzzle.
  const [today, setToday] = useState<Date | null>(null);
  const [state, setState] = useState<OnCallState>(emptyState());
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [triedCauses, setTriedCauses] = useState<Set<string>>(new Set());
  const [lastVerdict, setLastVerdict] = useState<{ id: string; verdict: Verdict } | null>(null);
  const [finished, setFinished] = useState<{ solved: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const incident = useMemo(() => (today ? getDailyIncident(today) : null), [today]);
  const day = useMemo(() => (today ? dayNumber(today) : -1), [today]);

  // Hydrate from storage and resume today's round if already played.
  useEffect(() => {
    const now = new Date();
    setToday(now);
    const loaded = loadState();
    setState(loaded);
    const d = dayNumber(now);
    const prior = loaded.rounds[d];
    if (prior) {
      setMoves(prior.moves);
      setFinished({ solved: prior.solved });
    }
  }, []);

  const movesUsed = moves.length;
  const movesLeft = MAX_MOVES - movesUsed;
  const isOver = finished !== null;

  const finishRound = useCallback(
    (finalMoves: MoveRecord[], solved: boolean) => {
      setFinished({ solved });
      setState((prev) => {
        const next = applyResult(prev, day, { solved, moves: finalMoves });
        saveState(next);
        return next;
      });
      if (solved) {
        confetti({ particleCount: 110, spread: 70, origin: { y: 0.3 }, disableForReducedMotion: true });
      }
    },
    [day],
  );

  const inspect = useCallback(
    (index: number) => {
      if (isOver || revealed.has(index) || movesLeft <= 0) return;
      const nextRevealed = new Set(revealed);
      nextRevealed.add(index);
      setRevealed(nextRevealed);
      const nextMoves = [...moves, { kind: 'inspect' as const }];
      setMoves(nextMoves);
      setLastVerdict(null);
      if (nextMoves.length >= MAX_MOVES) finishRound(nextMoves, false);
    },
    [isOver, revealed, movesLeft, moves, finishRound],
  );

  const diagnose = useCallback(
    (cause: Cause) => {
      if (isOver || triedCauses.has(cause.id) || movesLeft <= 0) return;
      const nextTried = new Set(triedCauses);
      nextTried.add(cause.id);
      setTriedCauses(nextTried);
      setLastVerdict({ id: cause.id, verdict: cause.verdict });
      const nextMoves = [...moves, { kind: 'diagnose' as const, verdict: cause.verdict }];
      setMoves(nextMoves);
      if (cause.verdict === 'correct') {
        finishRound(nextMoves, true);
      } else if (nextMoves.length >= MAX_MOVES) {
        finishRound(nextMoves, false);
      }
    },
    [isOver, triedCauses, movesLeft, moves, finishRound],
  );

  const result: RoundResult | null =
    incident && finished
      ? { incidentNumber: incident.number, severity: incident.severity, solved: finished.solved, moves }
      : null;

  const share = useCallback(async () => {
    if (!result) return;
    const text = buildShareText(result);
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user dismissed the share sheet */
    }
  }, [result]);

  if (!incident) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-500">
        <Activity className="mr-2 h-5 w-5 animate-pulse" /> Loading today&apos;s incident…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 font-mono">
      {/* Pager header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 bg-black/40 px-4 py-2 text-xs text-zinc-400">
          <span className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5" /> on-call · daily incident
          </span>
          <span>
            #{incident.number} · streak {state.current}
            {state.best > 0 ? ` · best ${state.best}` : ''}
          </span>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex items-center gap-3">
            <motion.span
              animate={isOver ? {} : { scale: [1, 1.12, 1] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold tracking-wide',
                SEVERITY_STYLE[incident.severity],
              )}
            >
              <Siren className="h-3.5 w-3.5" /> {incident.severity}
            </motion.span>
            <h2 className="text-lg font-bold text-zinc-100">{incident.title}</h2>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-black/50 p-3 text-sm text-amber-200/90">
            <span className="mr-2 text-amber-500">▸ PAGE</span>
            {incident.page}
          </div>

          <ul className="space-y-1 text-sm text-zinc-400">
            {incident.symptoms.map((s) => (
              <li key={s} className="flex gap-2">
                <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>

      {/* Moves tracker */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span>Moves</span>
          <div className="flex gap-1">
            {Array.from({ length: MAX_MOVES }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded text-sm',
                  moves[i] ? 'bg-zinc-800' : 'border border-dashed border-zinc-800',
                )}
              >
                {moves[i] ? moveEmoji(moves[i]) : ''}
              </span>
            ))}
          </div>
        </div>
        <span className={cn('text-sm font-bold', movesLeft <= 2 ? 'text-red-400' : 'text-zinc-500')}>
          {movesLeft} left
        </span>
      </div>

      {!isOver && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Evidence */}
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-300">
              <Search className="h-4 w-4 text-sky-400" /> Inspect signals
            </h3>
            {incident.evidence.map((ev: Evidence, i: number) => {
              const open = revealed.has(i);
              return (
                <button
                  key={ev.label}
                  onClick={() => inspect(i)}
                  disabled={open || movesLeft <= 0}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left text-sm transition',
                    open
                      ? 'border-sky-500/30 bg-sky-500/5'
                      : 'border-zinc-800 bg-zinc-950 hover:border-sky-500/40 hover:bg-zinc-900 disabled:opacity-40',
                  )}
                >
                  <span className="flex items-center justify-between font-semibold text-zinc-200">
                    {ev.label}
                    {!open && <span className="text-xs text-zinc-600">1 move</span>}
                  </span>
                  <AnimatePresence>
                    {open && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-1.5 text-zinc-400"
                      >
                        {ev.detail}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </div>

          {/* Diagnose */}
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-300">
              <Stethoscope className="h-4 w-4 text-emerald-400" /> Diagnose root cause
            </h3>
            {incident.causes.map((cause: Cause) => {
              const tried = triedCauses.has(cause.id);
              const v = tried ? cause.verdict : null;
              return (
                <button
                  key={cause.id}
                  onClick={() => diagnose(cause)}
                  disabled={tried || movesLeft <= 0}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left text-sm transition disabled:cursor-not-allowed',
                    !tried && 'border-zinc-800 bg-zinc-950 hover:border-emerald-500/40 hover:bg-zinc-900',
                    v === 'partial' && 'border-amber-500/40 bg-amber-500/10 text-amber-200',
                    v === 'wrong' && 'border-zinc-800 bg-zinc-900/60 text-zinc-500 line-through',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium text-current">{cause.label}</span>
                    {tried && <span className="shrink-0 text-base leading-none">{moveEmoji({ kind: 'diagnose', verdict: cause.verdict })}</span>}
                  </span>
                </button>
              );
            })}
            <AnimatePresence>
              {lastVerdict && !isOver && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={cn('pt-1 text-center text-xs font-semibold', VERDICT_COPY[lastVerdict.verdict].className)}
                >
                  {VERDICT_COPY[lastVerdict.verdict].label}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Result */}
      <AnimatePresence>
        {isOver && result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'space-y-4 rounded-2xl border p-5',
              result.solved ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5',
            )}
          >
            <div className="flex items-center gap-2 text-lg font-bold">
              {result.solved ? (
                <>
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span className="text-emerald-300">Resolved in {movesUsed}/{MAX_MOVES}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <span className="text-red-300">Out of moves. Here is what happened.</span>
                </>
              )}
            </div>

            <div className="text-2xl tracking-widest">{moves.map(moveEmoji).join('')}</div>

            <div className="rounded-lg border border-zinc-800 bg-black/40 p-3 text-sm">
              <p className="mb-1 font-bold text-zinc-200">Resolution</p>
              <p className="text-zinc-400">{incident.resolution}</p>
            </div>
            <div className="flex items-start gap-2 text-sm text-zinc-300">
              <Flame className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <span>
                <span className="font-bold">Lesson: </span>
                {incident.lesson}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={share}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-emerald-400"
              >
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Share result'}
              </button>
              <span className="text-xs text-zinc-500">
                <Copy className="mr-1 inline h-3 w-3" />
                Spoiler-free. Come back tomorrow for the next incident.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
