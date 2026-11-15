'use client';

import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type CSSProperties,
  type Dispatch,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react';
import { Check, ChevronDown, CircleCheck, Eye, Lightbulb, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimResetButton, useSimBarHeight } from '@/components/games/sim/sim-frame';
import type { SimStat } from '@/components/games/sim/sim-complete';
import type { SimTerminalLine, SimTerminalLineType } from '@/components/games/sim/sim-terminal';
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
 * SimLabRow, SimLabSplit and SimLabCard are the pieces SimLabTop and
 * SimLabMain are made of, for a lab mode without lessons (SQL challenges).
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
    /**
     * Types the expected command into the prompt; the player still runs it
     * with Enter. A function does the step's own "show me" (an edit step).
     */
    showMe: (command: string | (() => void)) => {
      setShown((s) => new Set(s).add(key));
      if (typeof command === 'function') {
        command();
        return;
      }
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

/** True in SimLabSplit's panels, which can be closed on lg too. */
const CollapsibleOnLg = createContext(false);

/**
 * A side panel. On phones a closed drawer. On lg, in SimLabSplit's panels,
 * a section that opens and closes, open at first when `defaultOpen` (live
 * state such as a file tree), closed otherwise; elsewhere always open.
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
  /** Open at first on lg, in SimLabSplit's panels. Phones always start closed. */
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

/** The lesson list with titles, for the lessons drawer on phones. */
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
  'h-[clamp(11rem,calc(100dvh-29rem),26rem)] lg:h-auto lg:min-h-0 lg:flex-1';

/**
 * The lab's height on lg, as --sim-lab-h: the screen under the top row, less
 * what sits above the game (--sim-embed-top), the 8px gap and 24px of room.
 */
const LAB_HEIGHT = 'calc(100dvh - var(--sim-embed-top, 12px) - var(--sim-bar-h) - 2rem)';

export interface SimLabRowItem {
  id: string;
  title: string;
  done: boolean;
  /** 0 to 1, for the item's bar. */
  progress: number;
  /** Right of the item in the picker, such as "2/6". */
  meta?: string;
}

/**
 * The top row: "Lesson n of m", a bar per item, a count, the picker and
 * start over. Not sticky, so it never covers the terminal.
 */
export function SimLabRow({
  title,
  icon: Icon,
  lead,
  noun,
  items,
  current,
  onPick,
  showTitle = true,
  count,
  actions,
  reset,
  inputRef,
}: {
  /** The short title, shown only in an embed. */
  title: string;
  icon?: LucideIcon;
  /** Always shown at the start (a mode toggle). */
  lead?: ReactNode;
  /** "Lesson" or "Challenge". */
  noun: string;
  items: readonly SimLabRowItem[];
  current: number;
  onPick: (index: number) => void;
  /** The current item's title after "Lesson n of m", from md up. */
  showTitle?: boolean;
  /** "2/32 commands", from sm up. */
  count?: ReactNode;
  /** The game's own controls, before the picker. */
  actions?: ReactNode;
  /** A SimResetButton. */
  reset: ReactNode;
  /** The terminal's input, which keeps the cursor after a pick. */
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const { embedded } = useEmbed();
  const ref = useRef<HTMLDivElement>(null);
  useSimBarHeight(ref);
  const item = items[current];
  const position = `${noun} ${current + 1} of ${items.length}`;
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
        <span className="tabular-nums">{position}</span>
        {showTitle && item && <span className="hidden md:inline"> · {item.title}</span>}
      </p>
      <div className="flex items-center gap-1" aria-hidden="true">
        {items.map((it, i) => (
          <span
            key={it.id}
            className={cn(
              'h-1.5 w-3 overflow-hidden rounded-full sm:w-5',
              i === current ? 'bg-hint/30' : 'bg-muted-foreground/20'
            )}
          >
            <span
              className={cn(
                'block h-full rounded-full',
                it.done ? 'bg-correct' : i === current ? 'bg-hint' : 'bg-correct/70'
              )}
              style={{ width: `${Math.round(it.progress * 100)}%` }}
            />
          </span>
        ))}
      </div>
      {count && (
        <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">
          {count}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        {actions}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-10 gap-1.5 lg:h-8">
              <span className="tabular-nums sm:hidden">{position}</span>
              <span className="hidden sm:inline">All {noun.toLowerCase()}s</span>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-[min(28rem,70dvh)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto"
            // A pick puts the cursor in the terminal; keep it there.
            onCloseAutoFocus={(event) => {
              if (document.activeElement === inputRef.current) event.preventDefault();
            }}
          >
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
              {noun}s
            </DropdownMenuLabel>
            {items.map((it, i) => (
              <DropdownMenuItem
                key={it.id}
                onSelect={() => onPick(i)}
                className={cn(
                  'min-h-10 items-start gap-2 lg:min-h-8',
                  i === current && 'bg-hint/10 font-semibold'
                )}
              >
                {it.done ? (
                  <CircleCheck className="mt-0.5 text-correct-foreground" aria-hidden="true" />
                ) : (
                  <span
                    className="mt-0.5 w-4 shrink-0 text-center font-mono text-xs text-muted-foreground"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="sr-only">
                    {noun} {i + 1}:{' '}
                  </span>
                  {it.title}
                  {i === current && <span className="sr-only"> (current)</span>}
                  {it.done && <span className="sr-only"> (done)</span>}
                </span>
                {it.meta && (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {it.meta}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {reset}
      </div>
    </div>
  );
}

/** SimLabRow for lessons: lesson n of m, commands done, "All lessons", start over. */
export function SimLabTop({
  title,
  icon,
  lead,
  lessons,
  lab,
  ui,
  actions,
  unit = 'commands',
}: {
  title: string;
  icon?: LucideIcon;
  lead?: ReactNode;
  lessons: readonly SimLabLesson[];
  lab: SimLabState;
  ui: SimLabUi;
  actions?: ReactNode;
  /** The word after the completed count. */
  unit?: string;
}) {
  return (
    <SimLabRow
      title={title}
      icon={icon}
      lead={lead}
      noun="Lesson"
      items={lessons.map((lesson, i) => {
        const done = lessonDone(lesson, i, lab);
        const total = lesson.commands.length;
        return {
          id: lesson.id,
          title: lesson.title,
          done: done === total,
          progress: total > 0 ? done / total : 0,
          meta: `${done}/${total}`,
        };
      })}
      current={lab.currentLessonIndex}
      onPick={ui.pickLesson}
      count={`${lab.completedCount}/${lab.totalCommands} ${unit}`}
      actions={actions}
      reset={<SimResetButton onReset={ui.startOver} showLabel />}
      inputRef={lab.inputRef}
    />
  );
}

/**
 * The lab under the top row. On lg two columns that fill the screen under
 * the row (--sim-lab-h): on the left `head` (the card) and, scrolling on its
 * own, `rest` and the panels; on the right the terminal, whose size never
 * changes. Below lg the same order stacks: head, terminal, rest, panels.
 */
export function SimLabSplit({
  head,
  terminal,
  rest,
  panels,
  minHeight = 'lg:min-h-[20rem]',
}: {
  head: ReactNode;
  /** The SimTerminal (inline, LAB_SHELL_HEIGHT), or a column with an editor above it. */
  terminal: ReactNode;
  rest?: ReactNode;
  /** SimLabPanels, which open and close on lg too. */
  panels?: ReactNode;
  /** The lab's least height on lg, for a short window. */
  minHeight?: string;
}) {
  return (
    <div
      style={{ '--sim-lab-h': LAB_HEIGHT } as CSSProperties}
      className={cn(
        'flex flex-col gap-2 lg:grid lg:h-[var(--sim-lab-h)] lg:gap-3',
        'lg:grid-cols-[23rem_minmax(0,1fr)] xl:grid-cols-[25rem_minmax(0,1fr)]',
        // The left column: the card as tall as it needs, the rest scrolls under it.
        'lg:grid-rows-[minmax(0,auto)_minmax(0,1fr)]',
        minHeight
      )}
    >
      <div className="min-w-0 space-y-2 lg:space-y-3 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 lg:[scrollbar-width:thin]">
        {head}
      </div>
      <div className="flex min-w-0 flex-col lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-0">
        {terminal}
      </div>
      <div className="min-w-0 space-y-2 lg:col-start-1 lg:row-start-2 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 lg:[scrollbar-width:thin]">
        {rest}
        <CollapsibleOnLg.Provider value={true}>{panels}</CollapsibleOnLg.Provider>
      </div>
    </div>
  );
}

// The card's buttons keep the cursor in the terminal when clicked with a mouse.
const keepFocus = (event: MouseEvent) => event.preventDefault();

/** A button in a SimLabCard: a mouse click leaves the cursor in the terminal. */
export function SimLabCardButton({
  className,
  variant = 'outline',
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onMouseDown={keepFocus}
      className={cn('h-10 lg:h-8', variant === 'outline' && 'bg-background', className)}
      {...props}
    />
  );
}

/**
 * The current step: a kicker ("Step 3 of 6"), the task in large text, its
 * buttons, and `detail` (a hint, a solution) inside the card, in a live
 * region so it is read out when it opens.
 */
export function SimLabCard({
  kicker,
  task,
  buttons,
  detail,
  detailId,
  done = false,
}: {
  kicker?: ReactNode;
  task: ReactNode;
  buttons?: ReactNode;
  detail?: ReactNode;
  /** The id the detail's button points to with aria-controls. */
  detailId?: string;
  /** Green, with a check: the lab is done. */
  done?: boolean;
}) {
  return (
    <section
      aria-label="Current step"
      className={cn(
        'rounded-xl border-2 p-3 lg:p-4',
        done ? 'border-correct/60 bg-correct/5' : 'border-hint/70 bg-hint/5'
      )}
    >
      {kicker && (
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-partial-foreground">
          {kicker}
        </p>
      )}
      <p
        className={cn(
          'font-semibold leading-snug [overflow-wrap:anywhere]',
          done ? 'flex items-start gap-2' : 'text-base lg:text-lg'
        )}
      >
        {done && (
          <CircleCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-correct-foreground"
            aria-hidden="true"
          />
        )}
        {task}
      </p>
      {buttons && <div className="mt-2.5 flex flex-wrap gap-2">{buttons}</div>}
      {detailId && (
        <div id={detailId} role="status">
          {detail && (
            <div className="mt-2.5 border-t border-dashed border-hint/50 pt-2.5 text-sm leading-relaxed">
              {detail}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function commandText(command: SimLabCommand | undefined): string | undefined {
  if (!command) return undefined;
  const expected = command.expectedCommand;
  return (typeof expected === 'string' ? expected : expected?.[0]) ?? command.command;
}

/**
 * The step just done: the current one when it is done (the last step, or
 * one waiting for the advance delay), otherwise the one before it.
 */
function lastDoneStep(lessons: readonly SimLabLesson[], lab: SimLabState) {
  let lessonIndex = lab.currentLessonIndex;
  let commandIndex = lab.currentCommandIndex;
  if (!lab.isCommandDone(lessonIndex, commandIndex)) {
    commandIndex -= 1;
    if (commandIndex < 0) {
      lessonIndex -= 1;
      commandIndex = (lessons[lessonIndex]?.commands.length ?? 0) - 1;
    }
  }
  const command = lessons[lessonIndex]?.commands[commandIndex];
  if (!command || !lab.isCommandDone(lessonIndex, commandIndex)) return undefined;
  return command;
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
 * The lessons' lab: SimLabSplit with the lesson and its step card (Hint and
 * Show me, the hint inside the card), then the step just done, the lesson's
 * steps, the lessons (a drawer on phones; the top row's picker on lg) and the
 * game's panels.
 */
export function SimLabMain({
  lessons,
  lab,
  ui,
  task,
  hint,
  showMe,
  kicker,
  cardButtons,
  doneGoal = 'All lessons done. The terminal stays open for your own commands.',
  terminal,
  panels,
  minHeight,
}: {
  lessons: readonly SimLabLesson[];
  lab: SimLabState;
  ui: SimLabUi;
  /** The current step's instruction. */
  task?: ReactNode;
  hint?: ReactNode;
  /**
   * The command "Show me" types for the player, or the step's own "show me"
   * (an edit step). Leave undefined for no button.
   */
  showMe?: string | (() => void);
  /** In place of "Step n of m", such as "Lesson done". */
  kicker?: ReactNode;
  /** More buttons in the card, after Hint and Show me ("Next lesson"). */
  cardButtons?: ReactNode;
  /** The step card once every lesson is done. */
  doneGoal?: ReactNode;
  terminal: ReactNode;
  /** SimLabPanels: live state (defaultOpen), quick reference. */
  panels?: ReactNode;
  minHeight?: string;
}) {
  const hintId = useId();
  const lesson = lessons[lab.currentLessonIndex];
  const done = lastDoneStep(lessons, lab);
  const doneCommand = commandText(done);
  const stepsDone = lesson ? lessonDone(lesson, lab.currentLessonIndex, lab) : 0;
  const card = lab.isComplete ? (
    <SimLabCard done task={doneGoal} />
  ) : (
    <SimLabCard
      kicker={
        kicker ?? (lesson && `Step ${lab.currentCommandIndex + 1} of ${lesson.commands.length}`)
      }
      task={task}
      buttons={
        (hint || showMe !== undefined || cardButtons) && (
          <>
            {hint && (
              <SimLabCardButton
                aria-expanded={lab.showHint}
                aria-controls={hintId}
                onClick={ui.toggleHint}
              >
                <Lightbulb className="h-4 w-4" aria-hidden="true" />
                {lab.showHint ? 'Hide hint' : 'Hint'}
              </SimLabCardButton>
            )}
            {showMe !== undefined && (
              <SimLabCardButton onClick={() => ui.showMe(showMe)}>
                <Eye className="h-4 w-4" aria-hidden="true" />
                Show me
              </SimLabCardButton>
            )}
            {cardButtons}
          </>
        )
      }
      detail={lab.showHint && hint}
      detailId={hint ? hintId : undefined}
    />
  );
  return (
    <SimLabSplit
      minHeight={minHeight}
      head={
        <>
          {lesson && (
            <div>
              <p className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground lg:block">
                Lesson {lab.currentLessonIndex + 1} of {lessons.length}
              </p>
              <h2 className="text-sm font-semibold lg:text-xl lg:tracking-tight">{lesson.title}</h2>
              {lesson.description && (
                <p className="hidden text-sm text-muted-foreground lg:block">
                  {lesson.description}
                </p>
              )}
            </div>
          )}
          {card}
        </>
      }
      terminal={terminal}
      rest={
        <>
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
              {done.explanation && (
                <p className="mt-0.5 text-muted-foreground">{done.explanation}</p>
              )}
            </div>
          )}
          <SimLabPanel
            title="Steps"
            summary={`${stepsDone} of ${lesson?.commands.length ?? 0} done`}
          >
            <SimLabStepList lessons={lessons} lab={lab} />
          </SimLabPanel>
          <div className="lg:hidden">
            <SimLabPanel title="Lessons" summary={lessonsSummary(lessons, lab)}>
              <SimLabLessons lessons={lessons} lab={lab} ui={ui} />
            </SimLabPanel>
          </div>
        </>
      }
      panels={panels}
    />
  );
}
