'use client';

import type { KeyboardEvent } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Eye,
  GitMerge,
  Layers,
  PencilLine,
  RefreshCcw,
  Save,
  Split,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SIM_CATEGORY,
  SIM_TONE,
  SimComplete,
  SimFrame,
  SimLabBar,
  SimLabLayout,
  SimLabLessons,
  SimLabPanel,
  SimTerminal,
  useSimLab,
  type SimLabLesson,
  type SimLabState,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';
import {
  LESSONS,
  TOTAL_STEPS,
  classifyLines,
  execute,
  fileStatus,
  hasMarkers,
  hasUnstagedChanges,
  saveFile,
  type FileStatus,
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

const LAB_LESSONS: SimLabLesson[] = LESSONS.map((l) => ({
  id: l.id,
  title: l.title,
  description: l.description,
  commands: l.steps,
}));

const EDITOR_HEIGHT = 'h-44 lg:h-[clamp(9rem,calc(50dvh-13rem),16rem)]';
const TERMINAL_HEIGHT =
  'h-[clamp(11rem,calc(100dvh-36rem),20rem)] lg:h-[clamp(12rem,calc(50dvh-8rem),24rem)]';

const STATUS_STYLE: Record<FileStatus, { label: string; className: string }> = {
  unmerged: {
    label: 'both modified',
    className: `${SIM_TONE.danger.surface} ${SIM_TONE.danger.text}`,
  },
  staged: {
    label: 'staged',
    className: `${SIM_TONE.success.surface} ${SIM_TONE.success.text}`,
  },
  modified: {
    label: 'modified',
    className: `${SIM_TONE.warning.surface} ${SIM_TONE.warning.text}`,
  },
  clean: { label: 'clean', className: 'border-border bg-muted/50 text-muted-foreground' },
};

const SIDE_STYLE: Record<LineSide, string> = {
  plain: 'text-terminal-foreground',
  ours: 'bg-emerald-500/10 text-emerald-100',
  theirs: 'bg-sky-500/10 text-sky-100',
  'marker-ours': 'bg-emerald-500/25 font-semibold text-emerald-300',
  'marker-sep': 'bg-terminal-border font-semibold text-terminal-input',
  'marker-theirs': 'bg-sky-500/25 font-semibold text-sky-300',
};

function sideLabels(repo: RepoState): { ours: string; theirs: string } {
  if (repo.op?.kind === 'rebase') {
    return {
      ours: `ours: rebased side, ${repo.op.onto} (HEAD)`,
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
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

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
      setHistoryIndex(-1);
    },
    [makeLines]
  );

  /** Mark steps from the current one up to `through` as done, with their explanations. */
  const completeSteps = useCallback(
    (explanations: string[], through = stepIndex) => {
      setCompleted((prev) => {
        const next = new Set(prev);
        for (let i = stepIndex; i <= through; i++) next.add(`${lesson.id}-${i}`);
        return next;
      });
      setTerminal((prev) => [
        ...prev,
        ...makeLines(explanations.map((content) => ({ type: 'success' as const, content }))),
      ]);
      setStepIndex(Math.min(through + 1, lesson.steps.length));
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
      // A step is done when this command does it, or when the repository already is where the
      // step leads (the user went ahead, say committing before the status check). Each step is
      // checked in order, so nothing is credited that the repository does not show.
      let next = stepIndex;
      const explanations: string[] = [];
      while (next < lesson.steps.length) {
        const candidate = lesson.steps[next];
        if (candidate.kind === 'edit') break;
        const byCommand = result.ok && candidate.done(cmd, repo, result.state);
        if (!byCommand && !candidate.goal?.(result.state)) break;
        explanations.push(candidate.explanation);
        next += 1;
      }
      if (next > stepIndex) {
        completeSteps(explanations, next - 1);
      } else if (repo.op && !result.state.op && stepIndex < lesson.steps.length) {
        setTerminal((prev) => [
          ...prev,
          ...makeLines([
            {
              type: 'note',
              content: `The ${repo.op?.kind} is over, so this lesson cannot continue from here. Press Restart lesson to try again.`,
            },
          ]),
        ]);
      }
      // A command may rewrite the file on screen; leave the editor so it shows the new content.
      if (editing && result.state.files[activeFile]?.content !== repo.files[activeFile]?.content) {
        setEditing(false);
      }
    },
    [activeFile, completeSteps, editing, lesson, makeLines, repo, stepIndex]
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.min(historyIndex + 1, history.length - 1);
      if (next >= 0) {
        setHistoryIndex(next);
        setInput(history[next] ?? '');
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = Math.max(historyIndex - 1, -1);
      setHistoryIndex(next);
      setInput(next >= 0 ? (history[next] ?? '') : '');
    }
  };

  const startEditing = (content?: string) => {
    if (!editableFile) return;
    setActiveFile(editableFile);
    setDraft(content ?? repo.files[editableFile].content);
    setEditError(null);
    setEditing(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const save = () => {
    if (!editableFile) return;
    const next = saveFile(repo, editableFile, draft);
    setRepo(next);
    setEditing(false);
    requestAnimationFrame(() => editButtonRef.current?.focus());
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
        completeSteps([step.explanation]);
      }
    } else {
      setEditError(null);
    }
  };

  const resetLab = () => {
    setCompleted(new Set());
    setHistory([]);
    setHistoryIndex(-1);
    openLesson(0);
  };

  const fileNames = useMemo(() => Object.keys(repo.files).sort(), [repo.files]);
  const unmergedCount = Object.values(repo.files).filter(
    (f) => fileStatus(f) === 'unmerged'
  ).length;
  const stagedCount = Object.values(repo.files).filter((f) => fileStatus(f) === 'staged').length;
  const allDone = completed.size === TOTAL_STEPS;
  const lab: SimLabState = {
    currentLessonIndex: lessonIndex,
    currentCommandIndex: Math.min(stepIndex, lesson.steps.length - 1),
    completedCount: completed.size,
    totalCommands: TOTAL_STEPS,
    isComplete: allDone,
    isCommandDone: (l, s) => completed.has(`${LESSONS[l].id}-${s}`),
    showHint,
    setShowHint,
    setInputValue: setInput,
    inputRef,
    jumpToLesson: openLesson,
    resetProgress: resetLab,
  };
  const ui = useSimLab(lab);
  const lessonsDone = LESSONS.filter((l) =>
    l.steps.every((_, i) => completed.has(`${l.id}-${i}`))
  ).length;
  const opLabel =
    repo.op?.kind === 'merge'
      ? `Merging ${repo.op.other} into ${repo.branch}`
      : repo.op?.kind === 'rebase'
        ? `Rebasing ${repo.op.branch} onto ${repo.op.onto}`
        : 'No merge or rebase in progress';

  return (
    <SimFrame>
      <SimLabBar
        title="Git Merge Conflict Simulator"
        icon={GitMerge}
        lessons={LAB_LESSONS}
        lab={lab}
        ui={ui}
        unit="steps"
        task={
          step
            ? step.instruction
            : lessonIndex < LESSONS.length - 1
              ? `Done with "${lesson.title}". The next lesson opens a new repository.`
              : 'That was the last lesson.'
        }
        hint={step?.hint}
        showMe={step?.kind === 'command' ? step.command : undefined}
        actions={
          !allDone && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 lg:h-8"
                onClick={() => openLesson(lessonIndex)}
              >
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Restart lesson</span>
              </Button>
              {step?.kind === 'edit' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 lg:h-8"
                  onClick={() => startEditing(step.solution)}
                >
                  <Wand2 className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Show a solution</span>
                </Button>
              )}
              {!step && lessonDone && lessonIndex < LESSONS.length - 1 && (
                <Button
                  type="button"
                  size="sm"
                  className="h-10 lg:h-8"
                  onClick={() => openLesson(lessonIndex + 1)}
                >
                  Next lesson
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </>
          )
        }
      />

      {ui.showComplete ? (
        <SimComplete
          title="Lab complete"
          summary="You read, resolved, sided, rebased, aborted, and caught the clean merge that broke the build."
          stats={[
            { label: 'Steps', value: `${completed.size}/${TOTAL_STEPS}` },
            { label: 'Lessons', value: `${LESSONS.length}/${LESSONS.length}` },
            { label: 'Hints used', value: ui.hintsUsed },
            { label: 'Show me used', value: ui.shownCount },
          ]}
          actions={
            <Button type="button" variant="outline" onClick={ui.keepExploring}>
              Keep exploring
            </Button>
          }
          onPlayAgain={ui.startOver}
          playAgainLabel="Start over"
        />
      ) : (
        <SimLabLayout
          terminal={
            <div className="space-y-2">
              <section
                aria-label="Editor"
                className="overflow-hidden rounded-lg border border-terminal-border bg-terminal text-terminal-foreground"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-terminal-border bg-terminal-bar px-2 py-1.5">
                  <div className="flex min-w-0 flex-wrap gap-1" role="group" aria-label="Files">
                    {fileNames.map((name) => {
                      const unmerged = fileStatus(repo.files[name]) === 'unmerged';
                      return (
                        <button
                          key={name}
                          type="button"
                          aria-pressed={name === file?.path}
                          disabled={editing}
                          onClick={() => setActiveFile(name)}
                          className={cn(
                            'min-h-8 rounded px-2 py-1 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                            name === file?.path
                              ? 'bg-terminal text-terminal-input'
                              : 'text-terminal-muted hover:text-terminal-input',
                            unmerged && 'text-terminal-error'
                          )}
                        >
                          {name}
                          {unmerged && <span className="sr-only"> (unmerged)</span>}
                          {unmerged && <span aria-hidden="true"> !</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    {editing ? (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-10 lg:h-8"
                          onClick={() => setEditing(false)}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Cancel
                        </Button>
                        <Button size="sm" className="h-10 lg:h-8" onClick={save}>
                          <Save className="h-4 w-4" aria-hidden="true" />
                          Save
                        </Button>
                      </>
                    ) : (
                      <Button
                        ref={editButtonRef}
                        size="sm"
                        variant="secondary"
                        className="h-10 lg:h-8"
                        disabled={!editableFile || file?.path !== editableFile}
                        onClick={() => startEditing()}
                        title={
                          editableFile
                            ? undefined
                            : 'This lesson resolves the conflict with commands'
                        }
                      >
                        <PencilLine className="h-4 w-4" aria-hidden="true" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
                {editing ? (
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    spellCheck={false}
                    aria-label={`Edit ${editableFile}`}
                    aria-describedby={editError ? 'git-conflict-edit-error' : undefined}
                    className={cn(
                      'block w-full resize-y bg-terminal p-4 font-mono text-sm leading-relaxed text-terminal-input caret-terminal-prompt outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      EDITOR_HEIGHT
                    )}
                  />
                ) : (
                  <FileView file={file} labels={labels} />
                )}
                {editError && (
                  <p
                    id="git-conflict-edit-error"
                    role="alert"
                    className="border-t border-terminal-border bg-terminal-error/10 px-3 py-2 text-sm text-terminal-error"
                  >
                    {editError}
                  </p>
                )}
              </section>
              <SimTerminal
                label="~/repo"
                status={
                  repo.op?.kind === 'merge'
                    ? `${repo.branch}|MERGING`
                    : repo.op?.kind === 'rebase'
                      ? `(${repo.op.branch})|REBASE 1/1`
                      : repo.branch
                }
                lines={terminal.map((l) => ({
                  type: l.type === 'note' ? 'warning' : l.type,
                  content: l.content,
                }))}
                prompt="$"
                value={input}
                onChange={setInput}
                onSubmit={run}
                onKeyDown={handleKeyDown}
                inputRef={inputRef}
                placeholder={step?.kind === 'command' ? 'type a command, or help' : 'help'}
                heightClassName={TERMINAL_HEIGHT}
              />
            </div>
          }
          aside={
            <>
              <SimLabPanel
                title="Repository"
                icon={GitMerge}
                summary={`${unmergedCount} unmerged, ${stagedCount} staged`}
              >
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-3 gap-1.5">
                    <Metric label="Branch" value={repo.branch ?? 'detached'} />
                    <Metric label="Unmerged" value={String(unmergedCount)} />
                    <Metric label="Staged" value={String(stagedCount)} />
                  </div>
                  <p
                    className={cn(
                      'rounded-md border px-2.5 py-1.5 font-medium',
                      repo.op ? SIM_TONE.warning.surface : SIM_TONE.success.surface
                    )}
                  >
                    {opLabel}
                  </p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
                    <dt className="text-muted-foreground">HEAD</dt>
                    <dd>
                      {repo.branch
                        ? `${repo.branch} @ ${repo.headSha}`
                        : `detached @ ${repo.headSha}`}
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
                            repo.tests === 'failing' && 'text-wrong-foreground',
                            repo.tests === 'passing' && 'text-correct-foreground'
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
                      const status = fileStatus(f);
                      const style = STATUS_STYLE[status];
                      return (
                        <li key={name} className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-xs">{name}</span>
                          <span
                            className={cn(
                              'shrink-0 rounded border px-1.5 py-0.5 text-xs',
                              style.className
                            )}
                          >
                            {style.label}
                            {status === 'staged' && hasUnstagedChanges(f) ? ', edited since' : ''}
                            {status !== 'unmerged' && !f.binary && hasMarkers(f.content)
                              ? ', markers!'
                              : ''}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </SimLabPanel>
              <SimLabPanel title="Index stages" icon={Layers} summary={file?.path}>
                <IndexStages file={file} labels={labels} />
              </SimLabPanel>
              <SimLabPanel title="Ours and theirs" icon={Split}>
                <div className="space-y-2 text-sm">
                  <SideRow
                    active={repo.op?.kind === 'merge'}
                    title="During a merge"
                    ours="the branch you are on"
                    theirs="the branch you are merging in"
                  />
                  <SideRow
                    active={repo.op?.kind === 'rebase'}
                    title="During a rebase"
                    ours="the rebased result so far: the branch you rebase onto, plus your commits already replayed"
                    theirs="your commit being replayed"
                  />
                </div>
              </SimLabPanel>
              <SimLabPanel
                title="Lessons"
                icon={BookOpen}
                summary={`${lessonsDone} of ${LESSONS.length} done`}
              >
                <SimLabLessons lessons={LAB_LESSONS} lab={lab} ui={ui} />
              </SimLabPanel>
            </>
          }
        />
      )}
    </SimFrame>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
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
  if (!file)
    return (
      <div className={cn(EDITOR_HEIGHT, 'p-4 font-mono text-sm text-terminal-muted')}>No file.</div>
    );
  if (file.binary) {
    return (
      <div
        className={cn(
          EDITOR_HEIGHT,
          'flex flex-col justify-center gap-2 p-6 text-sm text-terminal-foreground'
        )}
      >
        <p className="font-mono text-terminal-input">{file.content.trim()}</p>
        <p className="text-terminal-muted">
          {file.stages
            ? 'Binary file. Git cannot merge it line by line, so it writes no markers: the working tree keeps one version and the index holds the conflicting ones.'
            : 'Binary file. The index holds one version of it.'}
        </p>
      </div>
    );
  }
  const lines = classifyLines(file.content.replace(/\n$/, ''));
  return (
    <div className={cn(EDITOR_HEIGHT, 'overflow-auto py-2 font-mono text-sm leading-relaxed')}>
      {lines.map((line, i) => (
        <div key={i} className={cn('flex min-w-max gap-3 px-4', SIDE_STYLE[line.side])}>
          <span className="w-6 shrink-0 select-none text-right text-terminal-muted">{i + 1}</span>
          <span className="whitespace-pre">{line.text || ' '}</span>
          {line.side === 'marker-ours' && (
            <span className="ml-2 select-none rounded bg-emerald-500/20 px-1.5 text-xs font-normal text-emerald-200">
              {labels.ours}
            </span>
          )}
          {line.side === 'marker-theirs' && (
            <span className="ml-2 select-none rounded bg-sky-500/20 px-1.5 text-xs font-normal text-sky-200">
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
  const stages = file?.stages
    ? [
        {
          n: 1,
          name: 'base (common ancestor)',
          text: file.stages.base,
          tone: SIM_CATEGORY.neutral.border,
        },
        { n: 2, name: labels.ours, text: file.stages.ours, tone: SIM_CATEGORY.emerald.border },
        { n: 3, name: labels.theirs, text: file.stages.theirs, tone: SIM_CATEGORY.sky.border },
      ].filter(
        (s): s is { n: number; name: string; text: string; tone: string } => s.text !== undefined
      )
    : null;
  return (
    <div className="space-y-2 text-sm">
      {stages ? (
        stages.map((s) => (
          <div key={s.n} className={cn('rounded-md border-l-4 bg-muted/50 p-2', s.tone)}>
            <p className="mb-1 text-xs font-medium">
              <span className="font-mono">:{s.n}:</span> {s.name}
            </p>
            <pre className="max-h-24 overflow-auto whitespace-pre font-mono text-xs leading-snug text-muted-foreground">
              {s.text.replace(/\n$/, '')}
            </pre>
          </div>
        ))
      ) : (
        <p className="text-muted-foreground">
          {file?.undo
            ? 'Resolved: git add replaced the conflict stages with the one version you staged.'
            : 'No conflict in this file. While a path is unmerged, the index holds up to three versions of it here.'}
        </p>
      )}
    </div>
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
        <span className="font-mono text-emerald-700 dark:text-emerald-300">--ours</span> = {ours}
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="font-mono text-sky-700 dark:text-sky-300">--theirs</span> = {theirs}
      </p>
    </div>
  );
}
