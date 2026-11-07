'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CircleCheck,
  CircleDot,
  ExternalLink,
  FileCode,
  Puzzle as PuzzleIcon,
  RotateCcw,
  Search,
  ShieldAlert,
  SquareTerminal,
  StickyNote,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimHintButton,
  SimHowTo,
  SimResetButton,
  SimStage,
  SimTabBadge,
  SimTerminalWindow,
  revealTop,
  type SimStepStatus,
  type SimTone,
} from '@/components/games/sim';
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
type Layout = 'desktop' | 'mobile';

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

const VERDICT: Record<Verdict, { label: string; tone: SimTone; icon: LucideIcon }> = {
  best: { label: 'Best fix', tone: 'success', icon: CircleCheck },
  works: { label: 'Works, with a catch', tone: 'warning', icon: Check },
  incomplete: { label: 'Safe, but not done', tone: 'info', icon: CircleDot },
  unsafe: { label: 'Unsafe', tone: 'danger', icon: ShieldAlert },
};

function verdictClass(v: Verdict): string {
  const t = SIM_TONE[VERDICT[v].tone];
  return `${t.surface} ${t.text}`;
}

const ACTION_TONE: Record<SimTone, string> = {
  success: 'border-correct/50 text-correct-foreground',
  warning: 'border-partial/50 text-partial-foreground',
  danger: 'border-wrong/50 text-wrong-foreground',
  info: 'border-info/50 text-info-foreground',
  hint: 'border-hint/50 text-foreground',
};

const ACTION: Record<BindingAction, { label: string; tone: string }> = {
  none: { label: 'no change', tone: 'border-border text-muted-foreground' },
  create: { label: 'create', tone: ACTION_TONE.success },
  destroy: { label: 'destroy', tone: ACTION_TONE.danger },
  replace: { label: 'replace', tone: ACTION_TONE.danger },
  move: { label: 'move', tone: ACTION_TONE.info },
  import: { label: 'import', tone: ACTION_TONE.info },
  forget: { label: 'forget', tone: ACTION_TONE.warning },
  untracked: { label: 'untracked', tone: ACTION_TONE.warning },
  conflict: { label: 'two owners', tone: ACTION_TONE.danger },
};

const LINE: Record<LineTone, string> = {
  add: 'text-terminal-success',
  remove: 'text-terminal-error',
  change: 'text-terminal-warning',
  replace: 'font-semibold text-terminal-error',
  error: 'font-semibold text-terminal-error',
  warn: 'text-terminal-warning',
  muted: 'text-terminal-muted',
  plain: 'text-terminal-input',
};

const STEP_STATUS: Record<PuzzleStatus, SimStepStatus> = {
  todo: 'todo',
  started: 'started',
  clean: 'perfect',
  solved: 'done',
};

const STATUS_PILL: Record<PuzzleStatus, string> = {
  todo: 'border-border text-muted-foreground',
  started: 'border-partial/60 text-partial-foreground',
  clean: 'border-correct bg-correct/25 text-correct-foreground',
  solved: 'border-correct/50 bg-correct/10 text-correct-foreground',
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
      <SimTerminalWindow
        label={
          <>
            <span className="select-none text-terminal-prompt">$ </span>
            {t.command}
          </>
        }
      >
        <pre className={cn('px-3 py-2 font-mono leading-[1.55]', preWrap(wrap))}>
          {t.lines.map((l, i) => (
            <span
              key={i}
              className={cn(
                'block',
                l.startsWith('Plan: ') ? 'font-semibold text-terminal-input' : LINE[lineTone(l)]
              )}
            >
              {l || ' '}
            </span>
          ))}
        </pre>
        {t.trimmed && (
          <div className="border-t border-terminal-border px-3 py-1 font-sans text-xs text-terminal-muted">
            The output goes on; it is cut here.
          </div>
        )}
      </SimTerminalWindow>
    </div>
  );
}

function FileView({ f, wrap }: { f: SourceFile; wrap: boolean }) {
  return (
    <SimTerminalWindow label={f.name}>
      <pre className={cn('px-3 py-2 font-mono leading-[1.55]', preWrap(wrap))}>
        {f.lines.map((l, i) => (
          <span
            key={i}
            className={cn(
              'block',
              l.trimStart().startsWith('#') ? 'text-terminal-muted' : 'text-terminal-input'
            )}
          >
            {l || ' '}
          </span>
        ))}
      </pre>
    </SimTerminalWindow>
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
  layout,
  scrollRef,
}: {
  items: ViewItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  layout: Layout;
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setWrap((w) => !w)}
            aria-pressed={wrap}
            className={cn(
              'h-8 px-2 text-xs pointer-coarse:h-10',
              wrap ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground'
            )}
          >
            Wrap lines
          </Button>
        </div>
        <div className="space-y-1.5" role="group" aria-label="Evidence to show">
          {groups.map((g) => (
            <div key={g} className="flex flex-wrap items-center gap-1.5">
              <span className="w-full text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:w-auto sm:pr-1">
                {GROUP_LABEL[g]}
              </span>
              {items
                .filter((i) => i.group === g)
                .map((i) => (
                  <button
                    key={i.key}
                    type="button"
                    aria-pressed={i.key === active?.key}
                    onClick={() => onSelect(i.key)}
                    className={cn(
                      'inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-10',
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
      <CardContent
        ref={scrollRef}
        id={`tfp-${layout}-evidence`}
        tabIndex={-1}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pt-0 [scrollbar-width:thin] focus:outline-none"
      >
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
              'mb-1 inline-block rounded border px-1.5 py-0.5 text-xs font-semibold uppercase',
              ACTION[b.action].tone
            )}
          >
            {ACTION[b.action].label}
          </span>
          <dl className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-2 gap-y-0.5">
            <dt className="text-muted-foreground">Code</dt>
            <dd className="font-mono text-xs [overflow-wrap:anywhere]">{b.code ?? none}</dd>
            <dt className="text-muted-foreground" title={stateLabel}>
              State
            </dt>
            <dd className="font-mono text-xs [overflow-wrap:anywhere]">{b.state ?? none}</dd>
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
          {prog.hint && (
            <SimFeedback tone="hint">
              <p>{p.hint}</p>
            </SimFeedback>
          )}
        </CardContent>
      </Card>

      {p.bindings.length > 0 && (
        <Card>
          <details>
            <summary className="flex cursor-pointer select-none items-center justify-between gap-2 p-3 text-sm font-semibold">
              What the plan does now
              <span className="text-xs font-normal text-muted-foreground">
                {p.bindings.length} {p.bindings.length === 1 ? 'resource' : 'resources'}
              </span>
            </summary>
            <div className="space-y-2 p-3 pt-0">
              <p className="text-xs text-muted-foreground">
                Terraform links an address in the code to an entry in the state, and the state entry
                to a real object.
                {p.stateLabel ? ` ${p.stateLabel}.` : ''}
              </p>
              <BindingList rows={p.bindings} stateLabel={p.stateLabel} />
            </div>
          </details>
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
                  type="button"
                  onClick={() => onInspect(i.id)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md border p-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    done ? 'border-correct/40 bg-correct/5' : 'hover:bg-muted/60'
                  )}
                >
                  {done ? (
                    <CircleCheck
                      className="mt-0.5 h-4 w-4 shrink-0 text-correct-foreground"
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
                      <code className="block break-all text-xs text-muted-foreground">
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
  layout,
  onNext,
  onShowOutput,
}: {
  p: Puzzle;
  result: Result;
  solved: boolean;
  last: boolean;
  layout: Layout;
  onNext: () => void;
  onShowOutput: () => void;
}) {
  const v = VERDICT[result.outcome.verdict];
  const option = getOption(p, result.optionId);
  return (
    <div className="space-y-3">
      <SimFeedback
        id={`tfp-${layout}-result`}
        tabIndex={-1}
        tone={v.tone}
        icon={v.icon}
        label={
          <>
            {v.label}
            {result.explore && (
              <span className="text-xs font-normal text-foreground/80">
                (exploring, not scored)
              </span>
            )}
          </>
        }
      >
        <p className="text-xs text-foreground/80">You picked: {option.label}</p>
        <p className="pt-1 font-medium">{result.outcome.summary}</p>
        <p className="text-foreground/90">{result.outcome.explanation}</p>
        {result.outcome.bindings && (
          <details className="pt-1">
            <summary className="cursor-pointer select-none text-xs font-semibold">
              What it does to code, state and AWS
            </summary>
            <div className="mt-1.5">
              <BindingList rows={result.outcome.bindings} />
            </div>
          </details>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" variant="outline" className="lg:hidden" onClick={onShowOutput}>
            <SquareTerminal className="mr-1.5 h-4 w-4" aria-hidden="true" /> Show the output
          </Button>
          {!solved && (
            <span className="text-xs text-foreground/80">
              Nothing was applied for real. Try another option.
            </span>
          )}
        </div>
      </SimFeedback>
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
                  className="inline-flex items-center gap-1 font-medium underline decoration-primary/60 underline-offset-4 hover:decoration-primary"
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
  layout,
}: {
  p: Puzzle;
  prog: PuzzleProgress;
  layout: Layout;
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
          layout={layout}
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
                    type="button"
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
                          'inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold',
                          verdictClass(verdict)
                        )}
                      >
                        <VIcon className="h-3 w-3" aria-hidden="true" />
                        {VERDICT[verdict].label}
                      </span>
                    )}
                  </button>
                  {open && (
                    <div className="mt-1.5 space-y-2 rounded-md border bg-muted/30 p-2.5">
                      <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-xs leading-relaxed">
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
  const allSolved = s.solved === s.total;
  const tiles = [
    { label: 'Solved', value: `${s.solved}/${s.total}` },
    { label: 'Right on the first pick', value: `${s.clean}/${s.total}` },
    { label: 'Unsafe picks', value: String(s.unsafePicks) },
    { label: 'Hints used', value: String(s.hints) },
  ];
  return (
    <SimComplete
      title="Your results"
      icon={Trophy}
      // Opsville counts the quest once every puzzle is solved, not on an early look.
      tone={allSolved ? 'success' : 'neutral'}
      signal={allSolved}
      learned={allSolved ? undefined : null}
      summary={
        <>
          {allSolved
            ? 'Every state is fixed.'
            : 'Some puzzles are still open. Pick one below to go back to it.'}{' '}
          An unsafe pick is one that, applied for real, would have destroyed, duplicated or reverted
          something.
        </>
      }
      stats={tiles}
      next={{ title: 'Terraform Basics Simulator', href: '/games/terraform-terminal-simulator' }}
      nextLabel="Practise the basics in the Terraform Basics Simulator"
      actions={
        <>
          <Button variant="outline" onClick={() => onOpen(0)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" /> Back to the puzzles
          </Button>
          <Button variant="outline" onClick={onRestart}>
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" /> Start over
          </Button>
        </>
      }
    >
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
                  type="button"
                  onClick={() => onOpen(i)}
                  className="min-h-8 text-left font-semibold underline-offset-4 hover:underline"
                >
                  {p.title}
                </button>
                <Badge variant="outline" className={cn('text-xs', STATUS_PILL[status])}>
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
    </SimComplete>
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
  const [started, setStarted] = useState(false);
  const [announce, setAnnounce] = useState('');
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
  const next = nextUnsolved(game, PUZZLES, game.current);

  // Each puzzle starts with every column at its top.
  useEffect(() => {
    for (const r of [briefRef, fixRef, evidenceRef]) r.current?.scrollTo({ top: 0 });
  }, [index]);

  useEffect(() => {
    evidenceRef.current?.scrollTo({ top: 0 });
  }, [activeKey]);

  const setView = (key: string) => setViews((v) => ({ ...v, [p.id]: key }));

  const scrollToTabs = () => revealTop(tabsRef.current, { onlyIfAbove: true });

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
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      setMobileTab('evidence');
      requestAnimationFrame(() => {
        scrollToTabs();
        document.getElementById('tfp-mobile-evidence')?.focus({ preventScroll: true });
      });
    }
    const ins = p.inspects.find((i) => i.id === id);
    setAnnounce(`${ins?.label ?? 'Check'}: the answer is in Evidence.`);
  };

  const onTry = (id: string) => {
    setStarted(true);
    const outcome = evaluate(p, id, prog.inspected);
    const explore = isSolved(prog);
    setGame((g) => choose(g, p, id));
    setResults((r) => ({ ...r, [p.id]: { optionId: id, outcome, explore } }));
    const first = outcome.transcripts[0];
    if (first) setView(`out:${id}:${first.id}`);
    setSelected(null);
    setUnseenEvidence(mobileTab !== 'evidence');
    // Show the verdict where the player is looking, and move focus to it.
    const layout: Layout = window.matchMedia('(min-width: 1024px)').matches ? 'desktop' : 'mobile';
    requestAnimationFrame(() => {
      if (layout === 'desktop') fixRef.current?.scrollTo({ top: 0 });
      else scrollToTabs();
      document.getElementById(`tfp-${layout}-result`)?.focus({ preventScroll: true });
    });
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
    setMobileTab('brief');
    setStarted(false);
  };

  if (game.finished) {
    return (
      <ResultsView game={game} results={results} onOpen={(i) => open(i)} onRestart={restart} />
    );
  }

  const brief = <BriefPanel p={p} prog={prog} onInspect={onInspect} />;
  const fix = (layout: Layout) => (
    <FixPanel
      layout={layout}
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
  const barButton = 'h-10 w-10 px-0 lg:h-9 lg:w-9';

  return (
    <SimFrame>
      <SimBar
        title="Terraform State Puzzle"
        icon={PuzzleIcon}
        steps={PUZZLES.map((x) => {
          const st = puzzleStatus(getProgress(game, x.id));
          return { title: x.title, status: STEP_STATUS[st], statusLabel: STATUS_LABEL[st] };
        })}
        current={game.current}
        onStep={open}
        stepNoun="Puzzle"
        stepsLabel="Puzzles"
        tools={
          <>
            <SimHintButton onClick={onHint} pressed={prog.hint} />
            <SimResetButton onReset={restart} />
          </>
        }
        progress={{ current: game.current + 1, total: PUZZLES.length }}
        heading={p.title}
        meta={
          <>
            <Badge variant="secondary">{p.difficulty}</Badge>
            {p.minVersion && (
              <Badge variant="outline" title="Oldest Terraform version with the recommended fix">
                Terraform {p.minVersion}+
              </Badge>
            )}
            {status === 'clean' || status === 'solved' ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-correct-foreground">
                <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> {STATUS_LABEL[status]}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <span className="text-xs tabular-nums text-muted-foreground">
              Solved {s.solved}/{s.total}
            </span>
            <Button
              variant="outline"
              size="sm"
              className={barButton}
              onClick={() => open(game.current - 1)}
              disabled={game.current === 0}
              aria-label="Previous puzzle"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={barButton}
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
                className="h-10 lg:h-9"
                onClick={() => setGame((g) => ({ ...g, finished: true }))}
              >
                <Trophy className="mr-1.5 h-4 w-4" aria-hidden="true" /> Results
              </Button>
            )}
          </>
        }
        goal={p.goal}
      >
        <SimHowTo autoOpen={!started && game.current === 0}>
          Each puzzle is a broken Terraform situation from a real team. Read the plan and the code,
          run read-only checks for free, then choose a fix. A wrong pick shows what Terraform would
          do, and you try again.
        </SimHowTo>
        {showHint && prog.hint && (
          <SimFeedback
            tone="hint"
            role="status"
            onDismiss={() => setShowHint(false)}
            dismissLabel="Dismiss hint"
          >
            <p>{p.hint}</p>
          </SimFeedback>
        )}
      </SimBar>

      <SimAnnouncer message={announce} />

      <SimStage
        columns="lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.7fr)_minmax(0,1fr)]"
        tab={mobileTab}
        onTabChange={changeTab}
        anchorRef={tabsRef}
        panels={[
          {
            id: 'brief',
            label: 'Situation',
            content: brief,
            mobile: (
              <>
                {brief}
                <Button className="w-full" onClick={() => changeTab('fix')}>
                  Choose a fix <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                </Button>
              </>
            ),
            scrollRef: briefRef,
          },
          {
            id: 'evidence',
            label: 'Evidence',
            badge: unseenEvidence && mobileTab !== 'evidence' && <SimTabBadge>new</SimTabBadge>,
            scroll: false,
            content: (
              <EvidencePanel
                items={items}
                activeKey={activeKey}
                onSelect={setView}
                layout="desktop"
                scrollRef={evidenceRef}
              />
            ),
            mobile: (
              <EvidencePanel
                items={items}
                activeKey={activeKey}
                onSelect={setView}
                layout="mobile"
              />
            ),
          },
          {
            id: 'fix',
            label: 'Fix',
            badge: result && (
              <>
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    isSolving(result.outcome.verdict) ? 'bg-correct' : 'bg-partial'
                  )}
                  aria-hidden="true"
                />
                <span className="sr-only">
                  {isSolving(result.outcome.verdict) ? '(solved)' : '(try again)'}
                </span>
              </>
            ),
            content: fix('desktop'),
            mobile: fix('mobile'),
            scrollRef: fixRef,
          },
        ]}
      />

      <p className="text-xs text-muted-foreground">
        All command output was recorded with Terraform {TERRAFORM_VERSION} using local stand-in
        resources, then relabelled to look like AWS. Plan headers, symbols, warnings, errors and
        summaries are what Terraform printed; resource bodies are trimmed to the attributes that
        matter.
      </p>
    </SimFrame>
  );
}
