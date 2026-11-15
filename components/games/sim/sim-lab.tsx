'use client';

import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react';
import { Check, ChevronDown, CircleCheck, Eye, Lightbulb, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimFeedback } from '@/components/games/sim/sim-feedback';
import {
  SimBar,
  SimHintButton,
  SimResetButton,
  useSimBarHeight,
  type SimStep,
} from '@/components/games/sim/sim-frame';
import type { SimStat } from '@/components/games/sim/sim-complete';
import type { SimTerminalLine, SimTerminalLineType } from '@/components/games/sim/sim-terminal';
import { useSimGame } from '@/components/games/sim/sim-game';
import { useEmbed } from '@/lib/games/embed-context';
import { cn } from '@/lib/utils';

/**
 * The terminal lab layout, for games on hooks/use-terminal-simulator.ts:
 *
 *   SimFrame
 *   ├── SimLabTop     lesson n of m, progress, "All lessons", start over (not sticky)
 *   ├── SimComplete   in place of the lab when the last command is done
 *   └── SimLabMain    lg: the lesson and step card on the left, the terminal
 *                     (inline prompt, rendered once) on the right; below lg the
 *                     step card, the terminal, then closed drawers
 *
 * SimLabBar and SimLabLayout are the older layout (a sticky bar with the task
 * as a goal line), still used by the labs not yet moved to SimLabMain.
 *
 * The terminal never goes in a SimStage: the stage renders each panel twice
 * (columns and phone tabs), which would give the lab two inputs.
 */

/** The fields of a lesson step that the lab shows: the step list and the "Done" note. */
export interface SimLabCommand {
  instruction: string;
  explanation?: string;
  expectedCommand?: string | readonly string[];
  /** The command of a step that takes one, when it is not `expectedCommand`. */
  command?: string;
}

export interface SimLabLesson {
  id: string;
  title: string;
  description?: string;
  commands: readonly SimLabCommand[];
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
 * in the first screen under the bar. On lg it fills SimLabLayout's terminal
 * column, which is as tall as the screen under the bar.
 */
export const LAB_TERMINAL_HEIGHT = 'h-[clamp(11rem,calc(100dvh-33rem),24rem)] lg:h-auto lg:flex-1';

/** Focuses the terminal input without scrolling; on touch screens only when asked. */
export function focusTerminal(el: HTMLInputElement | null, onTouch = false): void {
  if (!el || typeof window === 'undefined') return;
  if (!onTouch && window.matchMedia?.('(pointer: coarse)').matches) return;
  el.focus({ preventScroll: true });
}

/** The hook's history as SimTerminal lines, or the welcome text before the first command. */
export function labLines(
  history: readonly { type: SimTerminalLineType; content: string; prompt?: string }[],
  welcome: SimTerminalLine[]
): SimTerminalLine[] {
  return history.length > 0
    ? history.map(({ type, content, prompt }) => ({ type, content, prompt }))
    : welcome;
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
 * The terminal, rendered once, and the side panels. On lg the lab fills the
 * screen under the bar (--sim-fill-h): the terminal column is a flex column
 * whose SimTerminal (LAB_TERMINAL_HEIGHT) takes the free height, and the side
 * column scrolls on its own. Below lg the panels follow the terminal as
 * closed drawers, so the input stays near the top.
 */
export function SimLabLayout({
  terminal,
  aside,
  minHeight = 'lg:min-h-[18rem]',
}: {
  terminal: ReactNode;
  aside?: ReactNode;
  /** The lab's least height on lg, for a short window. */
  minHeight?: string;
}) {
  return (
    <div
      className={cn(
        // minmax(0,1fr): the row is the lab's height, never the terminal's whole log.
        'grid gap-2 lg:h-[var(--sim-fill-h)] lg:grid-rows-[minmax(0,1fr)]',
        minHeight,
        aside && 'lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]'
      )}
    >
      <div className="min-w-0 lg:flex lg:flex-col">{terminal}</div>
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

const LG = '(min-width: 1024px)';

function subscribeLg(onChange: () => void) {
  const query = window.matchMedia?.(LG);
  query?.addEventListener?.('change', onChange);
  return () => query?.removeEventListener?.('change', onChange);
}

/** True on lg screens; false on the server and in the first render. */
function useLg(): boolean {
  return useSyncExternalStore(
    subscribeLg,
    () => !!window.matchMedia?.(LG).matches,
    () => false
  );
}

/** True inside SimLabMain, where panels can be closed on lg too. */
const CollapsibleOnLg = createContext(false);

/**
 * A side panel. On phones a closed drawer. On lg, in SimLabLayout, always
 * open; in SimLabMain a section that opens and closes, open at first when
 * `defaultOpen` (live state such as a file tree), closed otherwise.
 */
export function SimLabPanel({
  title,
  icon: Icon,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  /** A few words after the title, such as "2 of 6 done" or "3 running". */
  summary?: ReactNode;
  /** Open at first on lg, in SimLabMain. Phones always start closed. */
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const collapsible = useContext(CollapsibleOnLg);
  const lg = useLg();
  // null: not toggled yet, so each screen size shows its own default.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const id = useId();
  const openOnLg = collapsible ? defaultOpen : true;
  const open = toggled ?? (lg && openOnLg);
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
          onClick={() => setToggled(!open)}
          className={cn(
            'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsible ? 'lg:min-h-9' : 'lg:hidden'
          )}
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
        {!collapsible && (
          <span className="hidden items-center gap-2 px-3 pt-2 lg:flex">{label}</span>
        )}
      </h3>
      <div
        id={id}
        className={cn(
          'px-3 pb-3 pt-1',
          // Before a toggle, CSS picks the default, so the first paint on lg does not jump.
          toggled === null ? (openOnLg ? 'hidden lg:block' : 'hidden') : open ? 'block' : 'hidden',
          !collapsible && 'lg:block'
        )}
      >
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

/**
 * The terminal's height in SimLabMain. On phones the step card, an open hint
 * and the whole terminal fit in one screen under the top row; on lg the
 * terminal fills the lab's right column.
 */
export const LAB_SHELL_HEIGHT =
  'h-[clamp(11rem,calc(100dvh-24rem),26rem)] lg:h-auto lg:min-h-0 lg:flex-1';

function lessonMeterFill(done: number, total: number): string {
  return `${total > 0 ? Math.round((done / total) * 100) : 0}%`;
}

/** The top row: lesson n of m, progress, the lesson picker and start over. Not sticky. */
export function SimLabTop({
  title,
  icon: Icon,
  lead,
  lessons,
  lab,
  ui,
  actions,
  unit = 'commands',
}: {
  /** The short title, shown only in an embed. */
  title: string;
  icon?: LucideIcon;
  /** Always shown at the start (a mode toggle). */
  lead?: ReactNode;
  lessons: readonly SimLabLesson[];
  lab: SimLabState;
  ui: SimLabUi;
  /** The game's own controls, before the lesson picker. */
  actions?: ReactNode;
  /** The word after the completed count. */
  unit?: string;
}) {
  const { embedded } = useEmbed();
  const ref = useRef<HTMLDivElement>(null);
  useSimBarHeight(ref);
  const lesson = lessons[lab.currentLessonIndex];
  return (
    <div
      ref={ref}
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border bg-card px-3 py-1.5 shadow-sm"
    >
      {embedded && (
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-primary" aria-hidden="true" />}
          <span className="font-semibold">{title}</span>
        </div>
      )}
      {lead}
      <p className="hidden text-sm text-muted-foreground sm:block">
        <span className="tabular-nums">
          Lesson {lab.currentLessonIndex + 1} of {lessons.length}
        </span>
        {lesson && <span className="hidden md:inline"> · {lesson.title}</span>}
      </p>
      <div className="flex items-center gap-1" aria-hidden="true">
        {lessons.map((l, i) => {
          const done = lessonDone(l, i, lab);
          const total = l.commands.length;
          const current = i === lab.currentLessonIndex;
          return (
            <span
              key={l.id}
              className={cn(
                'h-1.5 w-3 overflow-hidden rounded-full sm:w-5',
                current ? 'bg-hint/30' : 'bg-muted-foreground/20'
              )}
            >
              <span
                className={cn(
                  'block h-full rounded-full',
                  done === total ? 'bg-correct' : current ? 'bg-hint' : 'bg-correct/70'
                )}
                style={{ width: lessonMeterFill(done, total) }}
              />
            </span>
          );
        })}
      </div>
      <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">
        {lab.completedCount}/{lab.totalCommands} {unit}
      </span>
      <div className="ml-auto flex items-center gap-1">
        {actions}
        <SimLabLessonPicker lessons={lessons} lab={lab} ui={ui} />
        <SimResetButton onReset={ui.startOver} showLabel />
      </div>
    </div>
  );
}

/** "All lessons": the lesson list in a menu, to jump to any lesson. */
function SimLabLessonPicker({
  lessons,
  lab,
  ui,
}: {
  lessons: readonly SimLabLesson[];
  lab: SimLabState;
  ui: SimLabUi;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-10 gap-1.5 lg:h-8">
          <span className="tabular-nums sm:hidden">
            Lesson {lab.currentLessonIndex + 1} of {lessons.length}
          </span>
          <span className="hidden sm:inline">All lessons</span>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(20rem,calc(100vw-2rem))]"
        // A picked lesson puts the cursor in the terminal; keep it there.
        onCloseAutoFocus={(event) => {
          if (document.activeElement === lab.inputRef.current) event.preventDefault();
        }}
      >
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Lessons
        </DropdownMenuLabel>
        {lessons.map((lesson, i) => {
          const done = lessonDone(lesson, i, lab);
          const total = lesson.commands.length;
          const current = i === lab.currentLessonIndex;
          return (
            <DropdownMenuItem
              key={lesson.id}
              onSelect={() => ui.pickLesson(i)}
              className={cn('min-h-10 gap-2 lg:min-h-8', current && 'bg-hint/10 font-semibold')}
            >
              {done === total ? (
                <CircleCheck className="text-correct-foreground" aria-hidden="true" />
              ) : (
                <span
                  className="w-4 shrink-0 text-center font-mono text-xs text-muted-foreground"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="sr-only">Lesson {i + 1}: </span>
                {lesson.title}
                {current && <span className="sr-only"> (current)</span>}
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {done}/{total}
                <span className="sr-only"> {done === total ? 'done' : 'commands done'}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function commandText(command: SimLabCommand | undefined): string | undefined {
  if (!command) return undefined;
  const expected = command.expectedCommand;
  return (typeof expected === 'string' ? expected : expected?.[0]) ?? command.command;
}

/** The step before the current one, in lesson order, when it is done. */
function lastDoneStep(lessons: readonly SimLabLesson[], lab: SimLabState) {
  let lessonIndex = lab.currentLessonIndex;
  let commandIndex = lab.currentCommandIndex - 1;
  // After the last command the lab stays on it: that one is the step just done.
  if (lab.isComplete) commandIndex += 1;
  if (commandIndex < 0) {
    lessonIndex -= 1;
    commandIndex = (lessons[lessonIndex]?.commands.length ?? 0) - 1;
  }
  const command = lessons[lessonIndex]?.commands[commandIndex];
  if (!command || !lab.isCommandDone(lessonIndex, commandIndex)) return undefined;
  return command;
}

// The step card's buttons keep the cursor in the terminal when clicked with a mouse.
const keepFocus = (event: MouseEvent) => event.preventDefault();

/** The current step: the task in large text, Hint and Show me, and the hint inside the card. */
function SimLabStepCard({
  lessons,
  lab,
  ui,
  task,
  hint,
  showMe,
  doneGoal,
}: {
  lessons: readonly SimLabLesson[];
  lab: SimLabState;
  ui: SimLabUi;
  task?: ReactNode;
  hint?: ReactNode;
  showMe?: string;
  doneGoal: ReactNode;
}) {
  const hintId = useId();
  const lesson = lessons[lab.currentLessonIndex];
  if (lab.isComplete) {
    return (
      <section
        aria-label="Current step"
        className="rounded-xl border-2 border-correct/60 bg-correct/5 p-3 lg:p-4"
      >
        <p className="flex items-start gap-2 font-semibold">
          <CircleCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-correct-foreground"
            aria-hidden="true"
          />
          {doneGoal}
        </p>
      </section>
    );
  }
  return (
    <section
      aria-label="Current step"
      className="rounded-xl border-2 border-hint/70 bg-hint/5 p-3 lg:p-4"
    >
      {lesson && (
        <p className="text-xs font-semibold uppercase tracking-wide text-partial-foreground">
          Step {lab.currentCommandIndex + 1} of {lesson.commands.length}
        </p>
      )}
      <p className="mt-1 text-base font-semibold leading-snug [overflow-wrap:anywhere] lg:text-lg">
        {task}
      </p>
      {(hint || showMe !== undefined) && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {hint && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 bg-background lg:h-8"
              aria-expanded={lab.showHint}
              aria-controls={hintId}
              onMouseDown={keepFocus}
              onClick={ui.toggleHint}
            >
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
              {lab.showHint ? 'Hide hint' : 'Hint'}
            </Button>
          )}
          {showMe !== undefined && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 bg-background lg:h-8"
              onMouseDown={keepFocus}
              onClick={() => ui.showMe(showMe)}
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
              Show me
            </Button>
          )}
        </div>
      )}
      {hint && (
        // Always in the tree, so the hint is read out when it opens.
        <div id={hintId} role="status">
          {lab.showHint && (
            <div className="mt-2.5 border-t border-dashed border-hint/50 pt-2.5 text-sm leading-relaxed">
              {hint}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Every step of the current lesson, marked done, current or to do. */
function SimLabStepList({ lessons, lab }: { lessons: readonly SimLabLesson[]; lab: SimLabState }) {
  const lesson = lessons[lab.currentLessonIndex];
  if (!lesson) return null;
  return (
    <ol className="space-y-0.5">
      {lesson.commands.map((command, i) => {
        const done = lab.isCommandDone(lab.currentLessonIndex, i);
        const current = !lab.isComplete && i === lab.currentCommandIndex;
        return (
          <li
            key={i}
            aria-current={current ? 'step' : undefined}
            className={cn(
              'flex items-start gap-2.5 rounded-md px-2 py-1.5 text-sm',
              current ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'
            )}
          >
            {done ? (
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-correct text-white">
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
              </span>
            ) : (
              <span
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2',
                  current ? 'border-hint' : 'border-muted-foreground/40'
                )}
              />
            )}
            <span className={cn('min-w-0', !current && 'line-clamp-2')}>
              <span className="sr-only">{done ? 'Done: ' : current ? 'Current: ' : 'To do: '}</span>
              {command.instruction}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The lab under SimLabTop. On lg two columns that fill the screen under the
 * top row: on the left the lesson, the step card and, scrolling on its own,
 * the step just done, the step list and the game's panels; on the right the
 * terminal, whose size never changes. Below lg the same order stacks: the
 * step card, the terminal, then the rest as closed drawers.
 *
 * The terminal is rendered once, never in a SimStage.
 */
export function SimLabMain({
  lessons,
  lab,
  ui,
  task,
  hint,
  showMe,
  doneGoal = 'All lessons done. The terminal stays open for your own commands.',
  terminal,
  panels,
  minHeight = 'lg:min-h-[28rem]',
}: {
  lessons: readonly SimLabLesson[];
  lab: SimLabState;
  ui: SimLabUi;
  /** The current step's instruction. */
  task?: ReactNode;
  hint?: ReactNode;
  /** The command "Show me" types for the player. Leave undefined for no button. */
  showMe?: string;
  /** The step card once every lesson is done. */
  doneGoal?: ReactNode;
  /** The SimTerminal (inline, LAB_SHELL_HEIGHT), or a column with an editor above it. */
  terminal: ReactNode;
  /** SimLabPanels: quick reference, live state. */
  panels?: ReactNode;
  /** The lab's least height on lg, for a short window. */
  minHeight?: string;
}) {
  const lesson = lessons[lab.currentLessonIndex];
  const done = lastDoneStep(lessons, lab);
  const doneCommand = commandText(done);
  const stepsDone = lesson
    ? lesson.commands.filter((_, i) => lab.isCommandDone(lab.currentLessonIndex, i)).length
    : 0;
  return (
    <div
      className={cn(
        'flex flex-col gap-2 lg:grid lg:gap-3',
        'lg:grid-cols-[23rem_minmax(0,1fr)] xl:grid-cols-[25rem_minmax(0,1fr)]',
        // The left column: the step card as tall as it needs, the rest scrolls under it.
        'lg:grid-rows-[minmax(0,auto)_minmax(0,1fr)]',
        // The screen under the top row: what sits above the game, the row, 8px gap, 24px room.
        'lg:h-[calc(100dvh-var(--sim-embed-top,12px)-var(--sim-bar-h)-2rem)]',
        minHeight
      )}
    >
      <div className="min-w-0 space-y-2 lg:space-y-3 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 lg:[scrollbar-width:thin]">
        {lesson && (
          <div>
            <p className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground lg:block">
              Lesson {lab.currentLessonIndex + 1} of {lessons.length}
            </p>
            <h2 className="text-sm font-semibold lg:text-xl lg:tracking-tight">{lesson.title}</h2>
            {lesson.description && (
              <p className="hidden text-sm text-muted-foreground lg:block">{lesson.description}</p>
            )}
          </div>
        )}
        <SimLabStepCard
          lessons={lessons}
          lab={lab}
          ui={ui}
          task={task}
          hint={hint}
          showMe={showMe}
          doneGoal={doneGoal}
        />
      </div>

      <div className="flex min-w-0 flex-col lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-0">
        {terminal}
      </div>

      <div className="min-w-0 space-y-2 lg:col-start-1 lg:row-start-2 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 lg:[scrollbar-width:thin]">
        {done && (
          <div className="rounded-r-md border-l-2 border-correct bg-correct/5 px-3 py-2 text-sm">
            <p className="font-semibold">
              Done
              {doneCommand && (
                <>
                  : <code className="font-mono text-[13px]">{doneCommand}</code>
                </>
              )}
            </p>
            {done.explanation && <p className="mt-0.5 text-muted-foreground">{done.explanation}</p>}
          </div>
        )}
        <SimLabPanel title="Steps" summary={`${stepsDone} of ${lesson?.commands.length ?? 0} done`}>
          <SimLabStepList lessons={lessons} lab={lab} />
        </SimLabPanel>
        <div className="lg:hidden">
          <SimLabPanel title="Lessons" summary={lessonsSummary(lessons, lab)}>
            <SimLabLessons lessons={lessons} lab={lab} ui={ui} />
          </SimLabPanel>
        </div>
        <CollapsibleOnLg.Provider value={true}>{panels}</CollapsibleOnLg.Provider>
      </div>
    </div>
  );
}
