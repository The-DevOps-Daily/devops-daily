'use client';

import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bug,
  CheckCircle,
  Eye,
  FileWarning,
  GitCompareArrows,
  GitMerge,
  Layers,
  Lightbulb,
  PencilLine,
  Play,
  RotateCcw,
  Save,
  Split,
  Trophy,
  Undo2,
  Wand2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  LESSONS,
  TOTAL_STEPS,
  classifyLines,
  execute,
  hasMarkers,
  saveFile,
  type Lesson,
  type LineSide,
  type LineType,
  type RepoFile,
  type RepoState,
} from '@/lib/games/git-conflict-engine';

interface TerminalLine {
  id: number;
  type: LineType;
  content: string;
}

const LESSON_ICONS: Record<Lesson['icon'], ReactNode> = {
  markers: <FileWarning className="h-5 w-5" />,
  edit: <PencilLine className="h-5 w-5" />,
  side: <Split className="h-5 w-5" />,
  rebase: <GitCompareArrows className="h-5 w-5" />,
  abort: <Undo2 className="h-5 w-5" />,
  bug: <Bug className="h-5 w-5" />,
};

const STATUS_STYLE: Record<RepoFile['status'], { label: string; className: string }> = {
  unmerged: {
    label: 'both modified',
    className: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300',
  },
  staged: {
    label: 'staged',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  modified: {
    label: 'modified',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  new: {
    label: 'untracked',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  clean: { label: 'clean', className: 'border-border bg-muted/40 text-muted-foreground' },
};

const SIDE_STYLE: Record<LineSide, string> = {
  plain: 'text-slate-300',
  ours: 'bg-emerald-500/10 text-emerald-100',
  theirs: 'bg-sky-500/10 text-sky-100',
  'marker-ours': 'bg-emerald-500/25 font-semibold text-emerald-300',
  'marker-sep': 'bg-slate-500/25 font-semibold text-slate-200',
  'marker-theirs': 'bg-sky-500/25 font-semibold text-sky-300',
};

function sideLabels(repo: RepoState): { ours: string; theirs: string } {
  if (repo.op?.kind === 'rebase') {
    return {
      ours: `ours: ${repo.op.onto} (HEAD)`,
      theirs: `theirs: your commit ${repo.op.commitSha}`,
    };
  }
  if (repo.op?.kind === 'merge') {
    return { ours: `ours: ${repo.branch} (HEAD)`, theirs: `theirs: ${repo.op.other}` };
  }
  return { ours: 'ours', theirs: 'theirs' };
}

export default function GitMergeConflictSimulator() {
  const [lessonIndex, setLessonIndex] = useState(0);
  const lesson = LESSONS[lessonIndex];
  const [repo, setRepo] = useState<RepoState>(() => LESSONS[0].initial());
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [terminal, setTerminal] = useState<TerminalLine[]>(() =>
    LESSONS[0].intro.map((l, i) => ({ ...l, id: i + 1 }))
  );
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHint, setShowHint] = useState(false);
  const [activeFile, setActiveFile] = useState(LESSONS[0].focusFile);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const lineId = useRef(LESSONS[0].intro.length);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const step = lesson.steps[stepIndex] as (typeof lesson.steps)[number] | undefined;
  const lessonDone = lesson.steps.every((_, i) => completed.has(`${lesson.id}-${i}`));
  const firstEditIndex = lesson.steps.findIndex((s) => s.kind === 'edit');
  const editableFile =
    firstEditIndex >= 0 && stepIndex >= firstEditIndex
      ? (lesson.steps[firstEditIndex] as { file: string }).file
      : null;
  const labels = sideLabels(repo);
  const file = repo.files[activeFile] ?? repo.files[lesson.focusFile];

  const makeLines = useCallback(
    (lines: { type: LineType; content: string }[]): TerminalLine[] =>
      lines.map((l) => ({ ...l, id: (lineId.current += 1) })),
    []
  );

  const openLesson = useCallback(
    (index: number) => {
      const next = LESSONS[index];
      setLessonIndex(index);
      setRepo(next.initial());
      setStepIndex(0);
      setTerminal(makeLines(next.intro));
      setActiveFile(next.focusFile);
      setEditing(false);
      setEditError(null);
      setShowHint(false);
      setInput('');
    },
    [makeLines]
  );

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminal]);

  const completeStep = useCallback(
    (explanation: string) => {
      setCompleted((prev) => new Set(prev).add(`${lesson.id}-${stepIndex}`));
      setTerminal((prev) => [...prev, ...makeLines([{ type: 'success', content: explanation }])]);
      setStepIndex((i) => Math.min(i + 1, lesson.steps.length));
      setShowHint(false);
    },
    [lesson, makeLines, stepIndex]
  );

  const run = useCallback(
    (raw: string) => {
      const cmd = raw.trim();
      if (!cmd) return;
      setHistory((prev) => [cmd, ...prev.filter((c) => c !== cmd)].slice(0, 30));
      setHistoryIndex(-1);
      setInput('');
      const result = execute(cmd, repo);
      if (result.clear) {
        setTerminal([]);
        return;
      }
      setRepo(result.state);
      setTerminal((prev) => [
        ...prev,
        ...makeLines([
          { type: 'input', content: cmd },
          ...result.lines.filter((l) => l.content !== ''),
        ]),
      ]);
      if (step?.kind === 'command' && step.done(cmd, repo, result.state))
        completeStep(step.explanation);
      // A command may rewrite the file on screen; leave the editor so it shows the new content.
      if (editing && result.state.files[activeFile]?.content !== repo.files[activeFile]?.content) {
        setEditing(false);
      }
    },
    [activeFile, completeStep, editing, makeLines, repo, step]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    run(input);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.min(historyIndex + 1, history.length - 1);
      if (next >= 0) {
        setHistoryIndex(next);
        setInput(history[next]);
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = Math.max(historyIndex - 1, -1);
      setHistoryIndex(next);
      setInput(next >= 0 ? history[next] : '');
    }
  };

  const startEditing = (content?: string) => {
    if (!editableFile) return;
    setActiveFile(editableFile);
    setDraft(content ?? repo.files[editableFile].content);
    setEditError(null);
    setEditing(true);
  };

  const save = () => {
    if (!editableFile) return;
    const next = saveFile(repo, editableFile, draft);
    setRepo(next);
    setEditing(false);
    const saved = next.files[editableFile].content;
    setTerminal((prev) => [
      ...prev,
      ...makeLines([{ type: 'note', content: `Saved ${editableFile}.` }]),
    ]);
    if (step?.kind === 'edit' && step.file === editableFile) {
      const problem = step.validate(saved);
      if (problem) {
        setEditError(problem);
      } else {
        setEditError(null);
        completeStep(step.explanation);
      }
    } else {
      setEditError(null);
    }
  };

  const resetLab = () => {
    setCompleted(new Set());
    setHistory([]);
    openLesson(0);
  };

  const fileNames = useMemo(() => Object.keys(repo.files).sort(), [repo.files]);
  const unmergedCount = Object.values(repo.files).filter((f) => f.status === 'unmerged').length;
  const stagedCount = Object.values(repo.files).filter((f) => f.status === 'staged').length;
  const allDone = completed.size === TOTAL_STEPS;
  const opLabel =
    repo.op?.kind === 'merge'
      ? `Merging ${repo.op.other} into ${repo.branch}`
      : repo.op?.kind === 'rebase'
        ? `Rebasing ${repo.op.branch} onto ${repo.op.onto}`
        : 'No merge or rebase in progress';

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-md border bg-muted/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-primary">
              <GitMerge className="h-6 w-6" />
            </div>
            <div>
              <p className="font-mono text-xs text-muted-foreground">{'// CONFLICT (content)'}</p>
              <h2 className="text-2xl font-bold md:text-3xl">Git Merge Conflict Simulator</h2>
            </div>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Each lesson opens on a real-looking conflict. Read the markers, resolve the file, take a
            side, survive a rebase, back out with --abort, and catch the merge that Git called
            clean.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {completed.size}/{TOTAL_STEPS}
              </span>
            </div>
            <Progress value={(completed.size / TOTAL_STEPS) * 100} />
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Branch" value={repo.branch ?? 'detached'} />
              <Metric label="Unmerged" value={String(unmergedCount)} />
              <Metric label="Staged" value={String(stagedCount)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-5 w-5" />
                Lessons
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {LESSONS.map((l, index) => {
                const done = l.steps.every((_, i) => completed.has(`${l.id}-${i}`));
                const active = index === lessonIndex;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => openLesson(index)}
                    className={cn(
                      'w-full rounded-md border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      active
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-border hover:border-primary/40 hover:bg-muted/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'rounded-md border p-1.5',
                          active ? 'text-primary' : 'text-muted-foreground'
                        )}
                      >
                        {done ? (
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                        ) : (
                          LESSON_ICONS[l.icon]
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {index + 1}. {l.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{l.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={() => openLesson(lessonIndex)}>
              <RotateCcw className="mr-1 h-4 w-4" />
              Restart lesson
            </Button>
            <Button size="sm" variant="outline" onClick={resetLab}>
              <RotateCcw className="mr-1 h-4 w-4" />
              Reset lab
            </Button>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <Card className="border-primary/40">
            <CardContent className="space-y-2.5 p-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      Lesson {lessonIndex + 1} / {LESSONS.length}
                    </Badge>
                    <Badge>
                      {step ? `Step ${stepIndex + 1} / ${lesson.steps.length}` : 'Lesson complete'}
                    </Badge>
                    {step?.kind === 'edit' && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/50 text-amber-600 dark:text-amber-300"
                      >
                        Edit in the editor
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium sm:text-base">
                    {step
                      ? step.instruction
                      : lessonIndex < LESSONS.length - 1
                        ? `Done with "${lesson.title}". The next lesson opens a new repository.`
                        : 'That was the last lesson.'}
                  </p>
                  {showHint && step && (
                    <p className="mt-2 rounded-md border border-primary/30 bg-primary/10 p-2 font-mono text-sm text-muted-foreground">
                      {step.hint}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {step && (
                    <Button size="sm" variant="outline" onClick={() => setShowHint((v) => !v)}>
                      <Lightbulb className="mr-1 h-4 w-4" />
                      Hint
                    </Button>
                  )}
                  {step?.kind === 'command' && (
                    <Button size="sm" onClick={() => run(step.command)}>
                      <Play className="mr-1 h-4 w-4" />
                      Run
                    </Button>
                  )}
                  {step?.kind === 'edit' && (
                    <Button size="sm" onClick={() => startEditing(step.solution)}>
                      <Wand2 className="mr-1 h-4 w-4" />
                      Show a solution
                    </Button>
                  )}
                  {!step && lessonDone && lessonIndex < LESSONS.length - 1 && (
                    <Button size="sm" onClick={() => openLesson(lessonIndex + 1)}>
                      Next lesson
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border bg-[#171717]">
            <CardHeader className="border-b border-border/60 bg-[#262626] p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap gap-1" role="tablist" aria-label="Files">
                  {fileNames.map((name) => {
                    const f = repo.files[name];
                    return (
                      <button
                        key={name}
                        type="button"
                        role="tab"
                        aria-selected={name === file?.path}
                        onClick={() => {
                          if (!editing) setActiveFile(name);
                        }}
                        className={cn(
                          'rounded px-2 py-1 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          name === file?.path
                            ? 'bg-[#171717] text-slate-100'
                            : 'text-slate-400 hover:text-slate-200',
                          f.status === 'unmerged' && 'text-red-300'
                        )}
                      >
                        {name}
                        {f.status === 'unmerged' ? ' !' : ''}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
                        <Eye className="mr-1 h-4 w-4" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={save}>
                        <Save className="mr-1 h-4 w-4" />
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!editableFile || file?.path !== editableFile}
                      onClick={() => startEditing()}
                      title={
                        editableFile ? undefined : 'This lesson resolves the conflict with commands'
                      }
                    >
                      <PencilLine className="mr-1 h-4 w-4" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {editing ? (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  aria-label={`Edit ${editableFile}`}
                  className="block h-[280px] w-full resize-y bg-[#171717] p-4 font-mono text-sm leading-relaxed text-slate-100 caret-emerald-400 outline-none"
                />
              ) : (
                <FileView file={file} labels={labels} />
              )}
              {editError && (
                <p className="border-t border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                  {editError}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border bg-[#171717]">
            <CardHeader className="border-b border-border/60 bg-[#262626] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  </div>
                  <span className="ml-2 text-sm text-slate-400">~/repo</span>
                </div>
                <Badge variant="secondary" className="font-mono text-[11px]">
                  {repo.op?.kind === 'merge'
                    ? `${repo.branch}|MERGING`
                    : repo.op?.kind === 'rebase'
                      ? `(${repo.op.branch})|REBASE 1/1`
                      : repo.branch}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div
                ref={terminalRef}
                className="h-[340px] cursor-text overflow-y-auto p-4 font-mono text-sm leading-relaxed"
                onClick={() => inputRef.current?.focus()}
              >
                {terminal.map((line) => (
                  <div
                    key={line.id}
                    className={cn(
                      'mb-2 whitespace-pre-wrap break-words',
                      line.type === 'input' && 'text-slate-100',
                      line.type === 'output' && 'text-slate-300',
                      line.type === 'error' && 'text-red-400',
                      line.type === 'note' && 'border-l-2 border-amber-400/60 pl-2 text-amber-200',
                      line.type === 'success' &&
                        'rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 font-sans text-emerald-300'
                    )}
                  >
                    {line.type === 'input' && <span className="text-emerald-400">$ </span>}
                    {line.content}
                  </div>
                ))}
                <form onSubmit={handleSubmit} className="flex items-center">
                  <span className="text-emerald-400">$</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    aria-label="Terminal command"
                    className="ml-2 min-w-0 flex-1 bg-transparent text-slate-100 caret-emerald-400 outline-none"
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                    placeholder={step?.kind === 'command' ? 'type a command, or help' : 'help'}
                  />
                </form>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <GitMerge className="h-5 w-5" />
                Repository
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 text-sm">
              <p
                className={cn(
                  'rounded-md border px-2.5 py-1.5 font-medium',
                  repo.op
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-emerald-500/40 bg-emerald-500/10'
                )}
              >
                {opLabel}
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
                <dt className="text-muted-foreground">HEAD</dt>
                <dd>
                  {repo.branch ? `${repo.branch} @ ${repo.headSha}` : `detached @ ${repo.headSha}`}
                </dd>
                {repo.op?.kind === 'merge' && (
                  <>
                    <dt className="text-muted-foreground">MERGE_HEAD</dt>
                    <dd>
                      {repo.op.other} @ {repo.op.otherSha}
                    </dd>
                  </>
                )}
                {repo.op?.kind === 'rebase' && (
                  <>
                    <dt className="text-muted-foreground">REBASE_HEAD</dt>
                    <dd>{repo.op.commitSha} (your commit)</dd>
                    <dt className="text-muted-foreground">onto</dt>
                    <dd>
                      {repo.op.onto} @ {repo.op.ontoSha}
                    </dd>
                  </>
                )}
                {repo.tests !== null && (
                  <>
                    <dt className="text-muted-foreground">make test</dt>
                    <dd
                      className={cn(
                        repo.tests === 'failing' && 'text-red-500',
                        repo.tests === 'passing' && 'text-emerald-600 dark:text-emerald-400'
                      )}
                    >
                      {repo.tests === 'not-run' ? 'not run since the last change' : repo.tests}
                    </dd>
                  </>
                )}
              </dl>
              <ul className="space-y-1.5">
                {fileNames.map((name) => {
                  const f = repo.files[name];
                  const style = STATUS_STYLE[f.status];
                  return (
                    <li key={name} className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs">{name}</span>
                      <span
                        className={cn(
                          'shrink-0 rounded border px-1.5 py-0.5 text-[11px]',
                          style.className
                        )}
                      >
                        {style.label}
                        {f.status !== 'unmerged' && hasMarkers(f.content) ? ', markers!' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <IndexStages file={file} labels={labels} />

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Split className="h-5 w-5" />
                Ours and theirs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0 text-sm">
              <SideRow
                active={repo.op?.kind === 'merge'}
                title="During a merge"
                ours="the branch you are on"
                theirs="the branch you are merging in"
              />
              <SideRow
                active={repo.op?.kind === 'rebase'}
                title="During a rebase"
                ours="the branch you are rebasing onto"
                theirs="your commit being replayed"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {allDone && (
        <Card className="mt-4 border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="font-semibold">Lab complete</p>
                <p className="text-sm text-muted-foreground">
                  You read, resolved, sided, rebased, aborted, and caught the clean merge that broke
                  the build.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={resetLab}>
              <RotateCcw className="mr-1 h-4 w-4" />
              Start over
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate font-mono text-sm font-semibold" title={value}>
        {value}
      </p>
    </div>
  );
}

function FileView({
  file,
  labels,
}: {
  file: RepoFile | undefined;
  labels: { ours: string; theirs: string };
}) {
  if (!file) return <div className="h-[280px] p-4 font-mono text-sm text-slate-400">No file.</div>;
  const lines = classifyLines(file.content.replace(/\n$/, ''));
  return (
    <div className="h-[280px] overflow-auto py-2 font-mono text-sm leading-relaxed">
      {lines.map((line, i) => (
        <div key={i} className={cn('flex min-w-max gap-3 px-4', SIDE_STYLE[line.side])}>
          <span className="w-6 shrink-0 select-none text-right text-slate-500">{i + 1}</span>
          <span className="whitespace-pre">{line.text || ' '}</span>
          {line.side === 'marker-ours' && (
            <span className="ml-2 select-none rounded bg-emerald-500/20 px-1.5 text-[11px] font-normal text-emerald-200">
              {labels.ours}
            </span>
          )}
          {line.side === 'marker-theirs' && (
            <span className="ml-2 select-none rounded bg-sky-500/20 px-1.5 text-[11px] font-normal text-sky-200">
              {labels.theirs}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function IndexStages({
  file,
  labels,
}: {
  file: RepoFile | undefined;
  labels: { ours: string; theirs: string };
}) {
  const stages =
    file && file.status === 'unmerged' && file.base !== undefined
      ? [
          { n: 1, name: 'base (common ancestor)', text: file.base, tone: 'border-slate-500/40' },
          { n: 2, name: labels.ours, text: file.ours ?? '', tone: 'border-emerald-500/50' },
          { n: 3, name: labels.theirs, text: file.theirs ?? '', tone: 'border-sky-500/50' },
        ]
      : null;
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-5 w-5" />
          Index stages{file ? `: ${file.path}` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0 text-sm">
        {stages ? (
          stages.map((s) => (
            <div key={s.n} className={cn('rounded-md border-l-4 bg-muted/30 p-2', s.tone)}>
              <p className="mb-1 text-xs font-medium">
                <span className="font-mono">:{s.n}:</span> {s.name}
              </p>
              <pre className="max-h-24 overflow-auto whitespace-pre font-mono text-[11px] leading-snug text-muted-foreground">
                {s.text.replace(/\n$/, '')}
              </pre>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">
            {file?.status === 'staged'
              ? 'Resolved: git add replaced the three stages with the one version you staged.'
              : 'No conflict in this file. While a file is unmerged, the index holds three versions of it here.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SideRow({
  active,
  title,
  ours,
  theirs,
}: {
  active: boolean;
  title: string;
  ours: string;
  theirs: string;
}) {
  return (
    <div
      className={cn(
        'rounded-md border p-2',
        active ? 'border-primary/60 bg-primary/10' : 'border-border'
      )}
    >
      <p className="mb-1 text-xs font-semibold">
        {title}
        {active ? ' (now)' : ''}
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="font-mono text-emerald-600 dark:text-emerald-400">--ours</span> = {ours}
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="font-mono text-sky-600 dark:text-sky-400">--theirs</span> = {theirs}
      </p>
    </div>
  );
}
