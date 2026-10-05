'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CircleCheck,
  CircleDot,
  ExternalLink,
  FileCode,
  Lightbulb,
  Puzzle as PuzzleIcon,
  RotateCcw,
  Search,
  ShieldAlert,
  SquareTerminal,
  StickyNote,
  Target,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  choose,
  createGame,
  evaluate,
  getOption,
  getProgress,
  goTo,
  inspect,
  isSolved,
  isSolving,
  lineTone,
  nextUnsolved,
  puzzleStatus,
  score,
  takeHint,
  type Binding,
  type BindingAction,
  type GameState,
  type LineTone,
  type Note,
  type Outcome,
  type Puzzle,
  type PuzzleProgress,
  type PuzzleStatus,
  type SourceFile,
  type Transcript,
  type Verdict,
} from '@/lib/games/terraform-puzzle-engine';
import { PUZZLES, TERRAFORM_VERSION } from '@/lib/games/terraform-puzzle-puzzles';

type MobileTab = 'brief' | 'evidence' | 'fix';

interface Result {
  optionId: string;
  outcome: Outcome;
  explore: boolean;
}

interface ViewItem {
  key: string;
  label: string;
  group: 'situation' | 'checks' | 'result';
  transcript?: Transcript;
  file?: SourceFile;
  note?: Note;
}

const VERDICT: Record<Verdict, { label: string; tone: string; icon: LucideIcon }> = {
  best: {
    label: 'Best fix',
    tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
    icon: CircleCheck,
  },
  works: {
    label: 'Works, with a catch',
    tone: 'border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300',
    icon: Check,
  },
  incomplete: {
    label: 'Safe, but not done',
    tone: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
    icon: CircleDot,
  },
  unsafe: {
    label: 'Unsafe',
    tone: 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300',
    icon: ShieldAlert,
  },
};

const ACTION: Record<BindingAction, { label: string; tone: string }> = {
  none: { label: 'no change', tone: 'border-border text-muted-foreground' },
  create: { label: 'create', tone: 'border-emerald-500/50 text-emerald-700 dark:text-emerald-400' },
  destroy: { label: 'destroy', tone: 'border-red-500/50 text-red-700 dark:text-red-400' },
  replace: { label: 'replace', tone: 'border-red-500/50 text-red-700 dark:text-red-400' },
  move: { label: 'move', tone: 'border-sky-500/50 text-sky-700 dark:text-sky-400' },
  import: { label: 'import', tone: 'border-sky-500/50 text-sky-700 dark:text-sky-400' },
  forget: { label: 'forget', tone: 'border-amber-500/50 text-amber-700 dark:text-amber-400' },
  untracked: { label: 'untracked', tone: 'border-amber-500/50 text-amber-700 dark:text-amber-400' },
  conflict: { label: 'two owners', tone: 'border-red-500/50 text-red-700 dark:text-red-400' },
};

const LINE: Record<LineTone, string> = {
  add: 'text-emerald-400',
  remove: 'text-red-400',
  change: 'text-amber-300',
  replace: 'text-fuchsia-300',
  error: 'font-semibold text-red-400',
  warn: 'text-amber-300',
  muted: 'text-zinc-400',
  plain: 'text-zinc-100',
};

const STATUS_PILL: Record<PuzzleStatus, string> = {
  todo: 'border-border text-muted-foreground hover:text-foreground',
  started: 'border-amber-500/60 text-amber-700 dark:text-amber-400',
  clean: 'border-emerald-600 bg-emerald-600 text-white',
  solved: 'border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

const STATUS_LABEL: Record<PuzzleStatus, string> = {
  todo: 'not started',
  started: 'in progress',
  clean: 'solved on the first pick',
  solved: 'solved',
};

function shortSource(source: string): string {
  return source.split(/[:,]/)[0];
}

function evidenceItems(p: Puzzle, prog: PuzzleProgress, result?: Result): ViewItem[] {
  const items: ViewItem[] = [];
  for (const t of p.evidence) {
    items.push({ key: `ev:${t.id}`, label: t.title, group: 'situation', transcript: t });
  }
  for (const f of p.files) {
    items.push({ key: `file:${f.name}`, label: f.name, group: 'situation', file: f });
  }
  (p.notes ?? []).forEach((n, i) =>
    items.push({ key: `note:${i}`, label: shortSource(n.source), group: 'situation', note: n })
  );
  for (const id of prog.inspected) {
    const ins = p.inspects.find((i) => i.id === id);
    if (!ins) continue;
    items.push({
      key: `in:${id}`,
      label: ins.transcript ? ins.transcript.title : shortSource(ins.note?.source ?? ''),
      group: 'checks',
      transcript: ins.transcript,
      note: ins.note,
    });
  }
  if (result) {
    for (const t of result.outcome.transcripts) {
      items.push({
        key: `out:${result.optionId}:${t.id}`,
        label: t.title,
        group: 'result',
        transcript: t,
      });
    }
  }
  return items;
}

function preWrap(wrap: boolean): string {
  return wrap ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'overflow-x-auto';
}

function TerminalView({ t, wrap }: { t: Transcript; wrap: boolean }) {
  return (
    <div className="space-y-2">
      {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
      <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
        <div className="border-b border-zinc-800 px-3 py-1.5 font-mono text-[12px] text-zinc-300">
          <span className="select-none text-emerald-400">$ </span>
          {t.command}
        </div>
        <pre className={cn('px-3 py-2 font-mono text-[11.5px] leading-[1.55]', preWrap(wrap))}>
          {t.lines.map((l, i) => (
            <span
              key={i}
              className={cn(
                'block',
                l.startsWith('Plan: ') ? 'font-semibold text-white' : LINE[lineTone(l)]
              )}
            >
              {l || ' '}
            </span>
          ))}
        </pre>
        {t.trimmed && (
          <div className="border-t border-zinc-800 px-3 py-1 text-[11px] text-zinc-400">
            The output goes on; it is cut here.
          </div>
        )}
      </div>
    </div>
  );
}

function FileView({ f, wrap }: { f: SourceFile; wrap: boolean }) {
  return (
    <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-3 py-1.5 font-mono text-[12px] text-zinc-300">
        {f.name}
      </div>
      <pre className={cn('px-3 py-2 font-mono text-[11.5px] leading-[1.55]', preWrap(wrap))}>
        {f.lines.map((l, i) => (
          <span
            key={i}
            className={cn(
              'block',
              l.trimStart().startsWith('#') ? 'text-zinc-400' : 'text-zinc-100'
            )}
          >
            {l || ' '}
          </span>
        ))}
      </pre>
    </div>
  );
}

function NoteView({ n }: { n: Note }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <StickyNote className="h-3.5 w-3.5" aria-hidden="true" /> {n.source}
      </div>
      <ul className="space-y-1">
        {n.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        A note from outside Terraform, not command output.
      </p>
    </div>
  );
}

function ItemIcon({ item }: { item: ViewItem }) {
  const Icon = item.file ? FileCode : item.note ? StickyNote : SquareTerminal;
  return <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
}

const GROUP_LABEL: Record<ViewItem['group'], string> = {
  situation: 'Situation',
  checks: 'Your checks',
  result: 'Result of your pick',
};

function EvidencePanel({
  items,
  activeKey,
  onSelect,
  scrollRef,
}: {
  items: ViewItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  scrollRef?: React.Ref<HTMLDivElement>;
}) {
  const [wrap, setWrap] = useState(false);
  const active = items.find((i) => i.key === activeKey) ?? items[0];
  const groups = (['situation', 'checks', 'result'] as const).filter((g) =>
    items.some((i) => i.group === g)
  );
  return (
    <Card className="flex min-h-0 flex-col lg:h-full">
      <CardHeader className="space-y-2 p-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <SquareTerminal className="h-4 w-4 text-primary" aria-hidden="true" /> Evidence
          </CardTitle>
          <button
            onClick={() => setWrap((w) => !w)}
            aria-pressed={wrap}
            className={cn(
              'rounded-md border px-2 py-0.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              wrap ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground'
            )}
          >
            Wrap lines
          </button>
        </div>
        <div className="space-y-1.5" role="group" aria-label="Evidence to show">
          {groups.map((g) => (
            <div key={g} className="flex flex-wrap items-center gap-1.5">
              <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:w-auto sm:pr-1">
                {GROUP_LABEL[g]}
              </span>
              {items
                .filter((i) => i.group === g)
                .map((i) => (
                  <button
                    key={i.key}
                    aria-pressed={i.key === active?.key}
                    onClick={() => onSelect(i.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      i.key === active?.key
                        ? 'border-primary bg-primary/10 font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      g === 'result' && i.key !== active?.key && 'border-primary/40'
                    )}
                  >
                    <ItemIcon item={i} />
                    {i.label}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 pt-0">
        {active?.transcript && <TerminalView t={active.transcript} wrap={wrap} />}
        {active?.file && <FileView f={active.file} wrap={wrap} />}
        {active?.note && <NoteView n={active.note} />}
      </CardContent>
    </Card>
  );
}

function BindingList({ rows, stateLabel }: { rows: Binding[]; stateLabel?: string }) {
  const none = <span className="italic text-muted-foreground">(none)</span>;
  return (
    <ul className="space-y-1.5">
      {rows.map((b, i) => (
        <li key={i} className="rounded-md border bg-background/60 p-2 text-xs">
          <span
            className={cn(
              'mb-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase',
              ACTION[b.action].tone
            )}
          >
            {ACTION[b.action].label}
          </span>
          <dl className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-2 gap-y-0.5">
            <dt className="text-muted-foreground">Code</dt>
            <dd className="font-mono text-[11px] [overflow-wrap:anywhere]">{b.code ?? none}</dd>
            <dt className="text-muted-foreground" title={stateLabel}>
              State
            </dt>
            <dd className="font-mono text-[11px] [overflow-wrap:anywhere]">{b.state ?? none}</dd>
            <dt className="text-muted-foreground">AWS</dt>
            <dd className="[overflow-wrap:anywhere]">{b.object ?? none}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function BriefPanel({
  p,
  prog,
  onInspect,
}: {
  p: Puzzle;
  prog: PuzzleProgress;
  onInspect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-3 p-3 text-sm">
          <p>{p.story}</p>
          <div className="flex gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <p>
              <strong>Goal: </strong>
              {p.goal}
            </p>
          </div>
          {prog.hint && (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <p>{p.hint}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {p.bindings.length > 0 && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">What the plan does now</CardTitle>
            <p className="text-xs text-muted-foreground">
              Terraform links an address in the code to an entry in the state, and the state entry
              to a real object.
              {p.stateLabel ? ` ${p.stateLabel}.` : ''}
            </p>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <BindingList rows={p.bindings} stateLabel={p.stateLabel} />
          </CardContent>
        </Card>
      )}

      {p.inspects.length > 0 && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Search className="h-4 w-4 text-primary" aria-hidden="true" /> Investigate
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Read-only checks. They are free and the answer opens in Evidence.
            </p>
          </CardHeader>
          <CardContent className="space-y-1.5 p-3 pt-0">
            {p.inspects.map((i) => {
              const done = prog.inspected.includes(i.id);
              return (
                <button
                  key={i.id}
                  onClick={() => onInspect(i.id)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md border p-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    done ? 'border-emerald-500/40 bg-emerald-500/5' : 'hover:bg-muted/60'
                  )}
                >
                  {done ? (
                    <CircleCheck
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                  ) : i.transcript ? (
                    <SquareTerminal
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  ) : (
                    <StickyNote
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block">{i.label}</span>
                    {i.transcript && (
                      <code className="block break-all text-[11px] text-muted-foreground">
                        {i.transcript.command}
                      </code>
                    )}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResultCard({
  p,
  result,
  solved,
  last,
  onNext,
  onShowOutput,
}: {
  p: Puzzle;
  result: Result;
  solved: boolean;
  last: boolean;
  onNext: () => void;
  onShowOutput: () => void;
}) {
  const v = VERDICT[result.outcome.verdict];
  const option = getOption(p, result.optionId);
  return (
    <div className="space-y-3">
      <div className={cn('rounded-lg border p-3', v.tone)}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
          <v.icon className="h-4 w-4" aria-hidden="true" />
          {v.label}
          {result.explore && (
            <span className="text-xs font-normal text-muted-foreground">
              (exploring, not scored)
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-foreground/80">You picked: {option.label}</p>
        <p className="mt-2 text-sm font-medium text-foreground">{result.outcome.summary}</p>
        <p className="mt-1 text-sm text-foreground/90">{result.outcome.explanation}</p>
        {result.outcome.bindings && (
          <details className="mt-2 text-foreground" open>
            <summary className="cursor-pointer select-none text-xs font-semibold">
              What it does to code, state and AWS
            </summary>
            <div className="mt-1.5">
              <BindingList rows={result.outcome.bindings} />
            </div>
          </details>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="lg:hidden" onClick={onShowOutput}>
            <SquareTerminal className="mr-1.5 h-4 w-4" aria-hidden="true" /> Show the output
          </Button>
          {!solved && (
            <span className="text-xs text-foreground/80">
              Nothing was applied for real. Try another option.
            </span>
          )}
        </div>
      </div>
      {solved && (
        <div className="rounded-lg border bg-card p-3 text-sm">
          <h4 className="flex items-center gap-2 font-semibold">
            <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" /> What to remember
          </h4>
          <p className="mt-1">{p.lesson}</p>
          <ul className="mt-2 space-y-1">
            {p.docs.map((d) => (
              <li key={d.href}>
                <a
                  href={d.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                >
                  {d.title}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            You can still try the other options to see what they would do.
          </p>
          <Button size="sm" className="mt-2 w-full" onClick={onNext}>
            {last ? (
              <>
                <Trophy className="mr-1.5 h-4 w-4" aria-hidden="true" /> See your results
              </>
            ) : (
              <>
                Next puzzle <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function FixPanel({
  p,
  prog,
  result,
  selected,
  setSelected,
  onTry,
  onNext,
  onShowOutput,
  last,
}: {
  p: Puzzle;
  prog: PuzzleProgress;
  result?: Result;
  selected: string | null;
  setSelected: (id: string | null) => void;
  onTry: (id: string) => void;
  onNext: () => void;
  onShowOutput: () => void;
  last: boolean;
}) {
  const solved = isSolved(prog);
  const tried = new Map(prog.picks.map((pk) => [pk.optionId, pk.verdict] as const));
  return (
    <div className="space-y-3">
      {result && (
        <ResultCard
          p={p}
          result={result}
          solved={solved}
          last={last}
          onNext={onNext}
          onShowOutput={onShowOutput}
        />
      )}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-base">Choose a fix</CardTitle>
          <p className="text-xs text-muted-foreground">
            A wrong pick shows what Terraform would do. Nothing is applied for real.
          </p>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <ul className="space-y-1.5">
            {p.options.map((o, idx) => {
              const open = selected === o.id;
              const verdict = tried.get(o.id);
              const VIcon = verdict ? VERDICT[verdict].icon : null;
              return (
                <li key={o.id}>
                  <button
                    id={`tfp-option-${o.id}`}
                    onClick={() => setSelected(open ? null : o.id)}
                    aria-expanded={open}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md border p-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      open ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'
                    )}
                  >
                    <span className="mt-px font-mono text-xs text-muted-foreground">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="flex-1 font-medium">{o.label}</span>
                    {VIcon && verdict && (
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold',
                          VERDICT[verdict].tone
                        )}
                      >
                        <VIcon className="h-3 w-3" aria-hidden="true" />
                        {VERDICT[verdict].label}
                      </span>
                    )}
                  </button>
                  {open && (
                    <div className="mt-1.5 space-y-2 rounded-md border bg-muted/30 p-2.5">
                      <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-[12px] leading-relaxed">
                        {o.code.join('\n')}
                      </pre>
                      <Button size="sm" className="w-full" onClick={() => onTry(o.id)}>
                        Try this fix
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultsView({
  game,
  results,
  onOpen,
  onRestart,
}: {
  game: GameState;
  results: Record<string, Result>;
  onOpen: (index: number) => void;
  onRestart: () => void;
}) {
  const s = score(game, PUZZLES);
  const tiles = [
    { label: 'Solved', value: `${s.solved}/${s.total}` },
    { label: 'Right on the first pick', value: `${s.clean}/${s.total}` },
    { label: 'Unsafe picks', value: String(s.unsafePicks) },
    { label: 'Hints used', value: String(s.hints) },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-5">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Trophy className="h-5 w-5 text-primary" aria-hidden="true" /> Your results
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {s.solved === s.total
            ? 'Every state is fixed.'
            : 'Some puzzles are still open. Pick one below to go back to it.'}{' '}
          An unsafe pick is one that, applied for real, would have destroyed, duplicated or reverted
          something.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-md bg-muted/50 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{t.label}</div>
              <div className="font-mono text-2xl font-semibold tabular-nums">{t.value}</div>
            </div>
          ))}
        </div>
      </div>
      <ol className="space-y-2">
        {PUZZLES.map((p, i) => {
          const prog = getProgress(game, p.id);
          const status = puzzleStatus(prog);
          const first = prog.picks.find((pk) => !pk.explore);
          return (
            <li key={p.id} className="rounded-lg border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                <button
                  onClick={() => onOpen(i)}
                  className="font-semibold underline-offset-4 hover:underline"
                >
                  {p.title}
                </button>
                <Badge variant="outline" className={cn('text-[10px]', STATUS_PILL[status])}>
                  {STATUS_LABEL[status]}
                </Badge>
              </div>
              {first && (
                <p className="mt-1 text-xs text-muted-foreground">
                  First pick: {getOption(p, first.optionId).label} ({VERDICT[first.verdict].label})
                </p>
              )}
              {results[p.id] || status !== 'todo' ? <p className="mt-1">{p.lesson}</p> : null}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => onOpen(0)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" /> Back to the puzzles
        </Button>
        <Button variant="outline" onClick={onRestart}>
          <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" /> Start over
        </Button>
        <Button asChild>
          <Link href="/games/terraform-terminal-simulator">
            Practise the basics in the Terraform Basics Simulator
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function TerraformPuzzle() {
  const [game, setGame] = useState<GameState>(() => createGame(PUZZLES));
  const [results, setResults] = useState<Record<string, Result>>({});
  const [views, setViews] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('brief');
  const [unseenEvidence, setUnseenEvidence] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [started, setStarted] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [barHeight, setBarHeight] = useState(112);
  const barRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);
  const briefRef = useRef<HTMLDivElement>(null);
  const fixRef = useRef<HTMLDivElement>(null);

  const index = game.current;
  const p = PUZZLES[index];
  const prog = getProgress(game, p.id);
  const result = results[p.id];
  const items = useMemo(() => evidenceItems(p, prog, result), [p, prog, result]);
  const defaultKey = items[0]?.key ?? '';
  const activeKey = items.some((i) => i.key === views[p.id]) ? views[p.id] : defaultKey;
  const s = score(game, PUZZLES);
  const status = puzzleStatus(prog);
  const solved = isSolved(prog);
  const next = nextUnsolved(game, PUZZLES, game.current);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBarHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [game.finished]);

  // Each puzzle starts with every column at its top.
  useEffect(() => {
    for (const r of [briefRef, fixRef, evidenceRef]) r.current?.scrollTo({ top: 0 });
  }, [index]);

  useEffect(() => {
    evidenceRef.current?.scrollTo({ top: 0 });
  }, [activeKey]);

  useEffect(() => {
    if (!confirmReset) return;
    const t = setTimeout(() => setConfirmReset(false), 3000);
    return () => clearTimeout(t);
  }, [confirmReset]);

  const setView = (key: string) => setViews((v) => ({ ...v, [p.id]: key }));

  const scrollToTabs = () => {
    const top = tabsRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) {
      const header = document.querySelector('header')?.offsetHeight ?? 0;
      window.scrollBy({ top: top - header });
    }
  };

  const changeTab = (v: string) => {
    setMobileTab(v as MobileTab);
    if (v === 'evidence') setUnseenEvidence(false);
    scrollToTabs();
  };

  const open = (index: number) => {
    const g = goTo(game, PUZZLES, index);
    setGame(g);
    setSelected(null);
    setShowHint(false);
    setMobileTab('brief');
    setUnseenEvidence(false);
    setAnnounce(`Puzzle ${g.current + 1} of ${PUZZLES.length}: ${PUZZLES[g.current].title}`);
    scrollToTabs();
  };

  const onInspect = (id: string) => {
    setStarted(true);
    setGame((g) => inspect(g, p, id));
    setView(`in:${id}`);
    if (mobileTab !== 'evidence') {
      setMobileTab('evidence');
      scrollToTabs();
    }
    const ins = p.inspects.find((i) => i.id === id);
    setAnnounce(`${ins?.label ?? 'Check'}: the answer is in Evidence.`);
  };

  const onTry = (id: string) => {
    setStarted(true);
    const outcome = evaluate(p, id, prog.inspected);
    const explore = solved;
    setGame((g) => choose(g, p, id));
    setResults((r) => ({ ...r, [p.id]: { optionId: id, outcome, explore } }));
    const first = outcome.transcripts[0];
    if (first) setView(`out:${id}:${first.id}`);
    setSelected(null);
    setUnseenEvidence(mobileTab !== 'evidence');
    fixRef.current?.scrollTo({ top: 0 });
    requestAnimationFrame(() =>
      document.getElementById(`tfp-option-${id}`)?.focus({ preventScroll: true })
    );
    setAnnounce(`${VERDICT[outcome.verdict].label}. ${outcome.summary}`);
  };

  const onHint = () => {
    setStarted(true);
    setGame((g) => takeHint(g, p));
    setShowHint(true);
  };

  const onNext = () => {
    if (next === null) {
      setGame((g) => ({ ...g, finished: true }));
      return;
    }
    open(next);
  };

  const restart = () => {
    setGame(createGame(PUZZLES));
    setResults({});
    setViews({});
    setSelected(null);
    setShowHint(false);
    setConfirmReset(false);
    setMobileTab('brief');
    setStarted(false);
  };

  if (game.finished) {
    return (
      <ResultsView game={game} results={results} onOpen={(i) => open(i)} onRestart={restart} />
    );
  }

  const brief = <BriefPanel p={p} prog={prog} onInspect={onInspect} />;
  const fix = (
    <FixPanel
      p={p}
      prog={prog}
      result={result}
      selected={selected}
      setSelected={setSelected}
      onTry={onTry}
      onNext={onNext}
      onShowOutput={() => changeTab('evidence')}
      last={next === null}
    />
  );

  return (
    <div className="space-y-3 pb-6 lg:pb-0">
      <div
        ref={barRef}
        className="z-20 space-y-2 rounded-lg border bg-card p-2.5 shadow-sm lg:sticky lg:top-[var(--site-header-h,0px)] lg:transition-[top] lg:duration-200 motion-reduce:transition-none"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <PuzzleIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="font-semibold">Terraform State Puzzle</span>
          </div>
          <nav className="flex flex-wrap items-center gap-1" aria-label="Puzzles">
            {PUZZLES.map((x, i) => {
              const st = puzzleStatus(getProgress(game, x.id));
              return (
                <button
                  key={x.id}
                  onClick={() => open(i)}
                  aria-current={i === game.current ? 'step' : undefined}
                  aria-label={`Puzzle ${i + 1}: ${x.title}, ${STATUS_LABEL[st]}`}
                  title={x.title}
                  className={cn(
                    'h-7 w-7 rounded-md border text-xs font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    STATUS_PILL[st],
                    i === game.current && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={onHint}
              aria-pressed={prog.hint}
            >
              <Lightbulb className="mr-1.5 h-4 w-4" aria-hidden="true" /> Hint
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => (confirmReset ? restart() : setConfirmReset(true))}
              aria-label={confirmReset ? 'Click again to start over' : 'Start over'}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {confirmReset && <span className="ml-1.5">Start over?</span>}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-2">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {game.current + 1}/{PUZZLES.length}
          </span>
          <h2 className="text-sm font-semibold sm:text-base">{p.title}</h2>
          <Badge variant="secondary">{p.difficulty}</Badge>
          {p.minVersion && (
            <Badge variant="outline" title="Oldest Terraform version with the recommended fix">
              Terraform {p.minVersion}+
            </Badge>
          )}
          {status === 'clean' || status === 'solved' ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> {STATUS_LABEL[status]}
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs tabular-nums text-muted-foreground">
              Solved {s.solved}/{s.total}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => open(game.current - 1)}
              disabled={game.current === 0}
              aria-label="Previous puzzle"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => open(game.current + 1)}
              disabled={game.current === PUZZLES.length - 1}
              aria-label="Next puzzle"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            {s.solved > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setGame((g) => ({ ...g, finished: true }))}
              >
                <Trophy className="mr-1.5 h-4 w-4" aria-hidden="true" /> Results
              </Button>
            )}
          </div>
        </div>

        {!started && game.current === 0 && (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">
            Each puzzle is a broken Terraform situation from a real team. Read the plan and the
            code, run read-only checks for free, then choose a fix. A wrong pick shows what
            Terraform would do, and you try again.
          </p>
        )}

        {showHint && prog.hint && (
          <div
            className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
            role="status"
          >
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="flex-1">{p.hint}</p>
            <button
              onClick={() => setShowHint(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss hint"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <div
        className="hidden min-h-[26rem] gap-3 lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.7fr)_minmax(0,1fr)]"
        style={{ height: `calc(100dvh - ${barHeight + 24}px)` }}
      >
        <div ref={briefRef} className="min-h-0 overflow-y-auto pr-1">
          {brief}
        </div>
        <div className="min-h-0">
          <EvidencePanel
            items={items}
            activeKey={activeKey}
            onSelect={setView}
            scrollRef={evidenceRef}
          />
        </div>
        <div ref={fixRef} className="min-h-0 overflow-y-auto pr-1">
          {fix}
        </div>
      </div>

      <div ref={tabsRef} aria-hidden="true" className="lg:hidden" />
      <Tabs value={mobileTab} onValueChange={changeTab} className="lg:hidden">
        <div className="sticky top-[var(--site-header-h,0px)] z-20 -mx-1 bg-background px-1 py-2 transition-[top] duration-200 motion-reduce:transition-none">
          <TabsList className="grid w-full grid-cols-3" aria-label="Panels">
            <TabsTrigger value="brief">Situation</TabsTrigger>
            <TabsTrigger value="evidence" className="gap-1.5">
              Evidence
              {unseenEvidence && mobileTab !== 'evidence' && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">
                  new
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="fix" className="gap-1.5">
              Fix
              {result && (
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    isSolving(result.outcome.verdict) ? 'bg-emerald-500' : 'bg-amber-500'
                  )}
                  aria-hidden="true"
                />
              )}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="brief" className="mt-1 space-y-3">
          {brief}
          <Button className="w-full" onClick={() => changeTab('fix')}>
            Choose a fix <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Button>
        </TabsContent>
        <TabsContent value="evidence" className="mt-1">
          <EvidencePanel items={items} activeKey={activeKey} onSelect={setView} />
        </TabsContent>
        <TabsContent value="fix" className="mt-1">
          {fix}
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        All command output was recorded with Terraform {TERRAFORM_VERSION} using local stand-in
        resources, then relabelled to look like AWS. Plan headers, symbols, warnings, errors and
        summaries are what Terraform printed; resource bodies are trimmed to the attributes that
        matter.
      </p>
    </div>
  );
}
