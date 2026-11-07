'use client';

import {
  useId,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react';
import { ChevronDown, CircleCheck, Eye, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SimFeedback } from '@/components/games/sim/sim-feedback';
import {
  SimBar,
  SimHintButton,
  SimResetButton,
  type SimStep,
} from '@/components/games/sim/sim-frame';
import type { SimStat } from '@/components/games/sim/sim-complete';
import type { SimTerminalLine, SimTerminalLineType } from '@/components/games/sim/sim-terminal';
import { useSimGame } from '@/components/games/sim/sim-game';
import { cn } from '@/lib/utils';

/**
 * The terminal lab layout, for games on hooks/use-terminal-simulator.ts:
 *
 *   SimFrame
 *   ├── SimLabBar     lesson pills, the task as the goal line, hint, start over
 *   ├── SimComplete   in place of the lab when the last command is done
 *   └── SimLabLayout  the terminal (rendered once) and, on lg, a side column;
 *                     below lg the side panels are closed drawers under the terminal
 *
 * The terminal never goes in a SimStage: the stage renders each panel twice
 * (columns and phone tabs), which would give the lab two inputs.
 */

export interface SimLabLesson {
  id: string;
  title: string;
  description?: string;
  commands: readonly unknown[];
}

/** What the lab pieces read from useTerminalSimulator. */
export interface SimLabState {
  currentLessonIndex: number;
  currentCommandIndex: number;
  completedCount: number;
  totalCommands: number;
  isComplete: boolean;
  isCommandDone: (lessonIndex: number, commandIndex: number) => boolean;
  showHint: boolean;
  setShowHint: Dispatch<SetStateAction<boolean>>;
  setInputValue: Dispatch<SetStateAction<string>>;
  inputRef: RefObject<HTMLInputElement | null>;
  jumpToLesson: (index: number) => void;
  resetProgress: () => void;
}

/**
 * The terminal's height in a lab: short enough on a phone that the input is
 * in the first screen under the bar, and on lg the whole lab fits 1280x800.
 */
export const LAB_TERMINAL_HEIGHT =
  'h-[clamp(11rem,calc(100dvh-33rem),24rem)] lg:h-[clamp(16rem,calc(100dvh-22rem),30rem)]';

/** Focuses the terminal input without scrolling; on touch screens only when asked. */
export function focusTerminal(el: HTMLInputElement | null, onTouch = false): void {
  if (!el || typeof window === 'undefined') return;
  if (!onTouch && window.matchMedia?.('(pointer: coarse)').matches) return;
  el.focus({ preventScroll: true });
}

/** The hook's history as SimTerminal lines, or the welcome text before the first command. */
export function labLines(
  history: readonly { type: SimTerminalLineType; content: string }[],
  welcome: SimTerminalLine[]
): SimTerminalLine[] {
  return history.length > 0 ? history.map(({ type, content }) => ({ type, content })) : welcome;
}

function lessonDone(lesson: SimLabLesson, index: number, lab: SimLabState): number {
  return lesson.commands.filter((_, c) => lab.isCommandDone(index, c)).length;
}

/** One SimBar pill per lesson. */
export function labSteps(lessons: readonly SimLabLesson[], lab: SimLabState): SimStep[] {
  return lessons.map((lesson, i) => {
    const done = lessonDone(lesson, i, lab);
    const total = lesson.commands.length;
    return {
      title: lesson.title,
      status: done === total ? 'done' : done > 0 ? 'started' : 'todo',
      statusLabel: `${done} of ${total} commands done`,
    };
  });
}

/**
 * The lab's own UI state around the hook: the end card's "Keep exploring",
 * hints and "Show me" counts for the end card, and starting over.
 */
export function useSimLab(lab: SimLabState) {
  const [dismissed, setDismissed] = useState(false);
  const [hinted, setHinted] = useState<ReadonlySet<string>>(() => new Set());
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());
  const key = `${lab.currentLessonIndex}-${lab.currentCommandIndex}`;

  return {
    /** The end card shows from the render that completes the last command until "Keep exploring". */
    showComplete: lab.isComplete && !dismissed,
    keepExploring: () => setDismissed(true),
    hintsUsed: hinted.size,
    shownCount: shown.size,
    toggleHint: () => {
      if (!lab.showHint) setHinted((s) => new Set(s).add(key));
      lab.setShowHint((v) => !v);
    },
    /** Types the expected command into the prompt; the player still runs it with Enter. */
    showMe: (command: string) => {
      setShown((s) => new Set(s).add(key));
      lab.setInputValue(command);
      focusTerminal(lab.inputRef.current, true);
    },
    pickLesson: (index: number) => {
      lab.jumpToLesson(index);
      focusTerminal(lab.inputRef.current);
    },
    startOver: () => {
      lab.resetProgress();
      setDismissed(false);
      setHinted(new Set());
      setShown(new Set());
      focusTerminal(lab.inputRef.current);
    },
  };
}

export type SimLabUi = ReturnType<typeof useSimLab>;

/**
 * The end card's tiles: two, or four with "Show me", so they sit in one row
 * (two by two on a phone) instead of stacking.
 */
export function labStats(
  lab: SimLabState,
  lessons: readonly SimLabLesson[],
  ui: SimLabUi,
  { showMe = false }: { showMe?: boolean } = {}
): SimStat[] {
  const commands = { label: 'Commands', value: `${lab.completedCount}/${lab.totalCommands}` };
  const hints = { label: 'Hints used', value: ui.hintsUsed };
  if (!showMe) return [commands, hints];
  return [
    commands,
    { label: 'Lessons', value: `${lessons.length}/${lessons.length}` },
    hints,
    { label: 'Show me used', value: ui.shownCount },
  ];
}

export function SimLabBar({
  title,
  icon,
  lead,
  lessons,
  lab,
  ui,
  task,
  hint,
  showMe,
  actions,
  unit = 'commands',
  doneGoal = 'All lessons done. The terminal stays open for your own commands.',
}: {
  /** The short title, shown only in an embed. */
  title: string;
  icon?: LucideIcon;
  lead?: ReactNode;
  lessons: readonly SimLabLesson[];
  lab: SimLabState;
  ui: SimLabUi;
  /** The current command's instruction: the goal line. */
  task?: ReactNode;
  hint?: ReactNode;
  /** The command "Show me" types for the player. Leave undefined for no button. */
  showMe?: string;
  /** The game's own controls, placed before the Show me button. */
  actions?: ReactNode;
  /** The word after the completed count. */
  unit?: string;
  doneGoal?: ReactNode;
}) {
  const game = useSimGame();
  const lesson = lessons[lab.currentLessonIndex];
  const open = !lab.isComplete;
  return (
    <SimBar
      title={title}
      icon={icon}
      lead={lead}
      steps={labSteps(lessons, lab)}
      current={lab.currentLessonIndex}
      onStep={ui.pickLesson}
      stepNoun="Lesson"
      stepsLabel="Lessons"
      tools={
        <>
          {open && hint && (
            // Icon only on phones, so the pills and the tools share one row.
            <SimHintButton onClick={ui.toggleHint} pressed={lab.showHint}>
              <span className="sr-only sm:not-sr-only">Hint</span>
            </SimHintButton>
          )}
          <SimResetButton onReset={ui.startOver} />
        </>
      }
      progress={{ current: lab.currentLessonIndex + 1, total: lessons.length }}
      heading={lesson?.title}
      meta={
        <>
          {open && lesson && (
            <Badge variant="secondary" className="tabular-nums">
              Step {lab.currentCommandIndex + 1} of {lesson.commands.length}
            </Badge>
          )}
          {game?.level && (
            <Badge variant="outline" className="hidden sm:inline-flex">
              {game.level}
            </Badge>
          )}
        </>
      }
      actions={
        <>
          <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">
            {lab.completedCount}/{lab.totalCommands} {unit}
          </span>
          {actions}
          {open && showMe !== undefined && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 lg:h-8"
              onClick={() => ui.showMe(showMe)}
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Show me</span>
            </Button>
          )}
        </>
      }
      goal={open ? task : doneGoal}
    >
      {open && lab.showHint && hint && (
        <SimFeedback
          tone="hint"
          role="status"
          onDismiss={() => lab.setShowHint(false)}
          dismissLabel="Close the hint"
        >
          <p>{hint}</p>
        </SimFeedback>
      )}
    </SimBar>
  );
}

/**
 * The terminal, rendered once, and the side panels. On lg the side column is
 * exactly as tall as the terminal and scrolls on its own; below lg the panels
 * follow the terminal as closed drawers, so the input stays near the top.
 */
export function SimLabLayout({ terminal, aside }: { terminal: ReactNode; aside?: ReactNode }) {
  return (
    <div
      className={cn(
        'grid gap-2',
        aside && 'lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]'
      )}
    >
      <div className="min-w-0">{terminal}</div>
      {aside && (
        <div className="min-w-0 lg:relative">
          <div className="space-y-2 lg:absolute lg:inset-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 lg:[scrollbar-width:thin]">
            {aside}
          </div>
        </div>
      )}
    </div>
  );
}

/** A side panel: always open next to the terminal on lg, a closed drawer on phones. */
export function SimLabPanel({
  title,
  icon: Icon,
  summary,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  /** A few words after the title, such as "2 of 6 done" or "3 running". */
  summary?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const label = (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <span className="min-w-0 flex-1">{title}</span>
      {summary && (
        <span className="text-xs font-normal tabular-nums text-muted-foreground">{summary}</span>
      )}
    </>
  );
  return (
    <section className="rounded-lg border bg-card">
      <h3 className="text-sm font-semibold">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          {label}
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
              open && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </button>
        <span className="hidden items-center gap-2 px-3 pt-2 lg:flex">{label}</span>
      </h3>
      <div id={id} className={cn('px-3 pb-3 pt-1 lg:block', open ? 'block' : 'hidden')}>
        {children}
      </div>
    </section>
  );
}

/** The lesson list with titles, for a SimLabPanel. The bar's pills are the short form. */
export function SimLabLessons({
  lessons,
  lab,
  ui,
}: {
  lessons: readonly SimLabLesson[];
  lab: SimLabState;
  ui: SimLabUi;
}) {
  return (
    <ol className="space-y-0.5">
      {lessons.map((lesson, i) => {
        const done = lessonDone(lesson, i, lab);
        const total = lesson.commands.length;
        const current = i === lab.currentLessonIndex;
        return (
          <li key={lesson.id}>
            <button
              type="button"
              onClick={() => ui.pickLesson(i)}
              aria-current={current ? 'step' : undefined}
              aria-label={`Lesson ${i + 1}: ${lesson.title}, ${done} of ${total} commands done`}
              className={cn(
                'w-full rounded-md border px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:py-1',
                current ? 'border-primary/60 bg-primary/10' : 'border-transparent hover:bg-muted'
              )}
            >
              <span className="flex min-h-7 items-center gap-2">
                {done === total ? (
                  <CircleCheck
                    className="h-4 w-4 shrink-0 text-correct-foreground"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="w-4 shrink-0 text-center font-mono text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                )}
                <span className="min-w-0 flex-1">{lesson.title}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {done}/{total}
                </span>
              </span>
              {current && lesson.description && (
                <span className="block pl-6 text-xs text-muted-foreground">
                  {lesson.description}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** "3 of 6 done" for the lessons drawer. */
export function lessonsSummary(lessons: readonly SimLabLesson[], lab: SimLabState): string {
  const done = lessons.filter((l, i) => lessonDone(l, i, lab) === l.commands.length).length;
  return `${done} of ${lessons.length} done`;
}
