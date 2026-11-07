'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { Lightbulb, RotateCcw, Target, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEmbed } from '@/lib/games/embed-context';
import { cn } from '@/lib/utils';

/**
 * The shared simulator layout (style guide section 5):
 *
 *   SimFrame
 *   ├── SimBar     sticky on lg: steps, hint, start over, n/m, step title, goal
 *   ├── SimStage   lg: columns sized to the viewport; below lg: tabs
 *   └── SimComplete (sim-complete.tsx) in place of the stage when done
 *
 * The page shell (simulator-shell.tsx) keeps the h1, so SimBar shows the
 * game's short title only in an embed, where there is no shell.
 */

const FrameContext = createContext<{ barHeight: number; setBarHeight: (h: number) => void }>({
  barHeight: 0,
  setBarHeight: () => {},
});

export function SimFrame({
  children,
  phoneBar = false,
  className,
}: {
  children: ReactNode;
  /** Leaves room under the game for a SimPhoneBar. */
  phoneBar?: boolean;
  className?: string;
}) {
  const [barHeight, setBarHeight] = useState(104);
  const value = useMemo(() => ({ barHeight, setBarHeight }), [barHeight]);
  return (
    <FrameContext.Provider value={value}>
      <div
        data-sim-frame=""
        className={cn('space-y-2', phoneBar ? 'pb-20 lg:pb-0' : 'pb-4 lg:pb-0', className)}
      >
        {children}
      </div>
    </FrameContext.Provider>
  );
}

export type SimStepStatus = 'todo' | 'started' | 'done' | 'perfect';

export interface SimStep {
  title: string;
  status: SimStepStatus;
  /** Read out with the step, for example "solved on the first pick". */
  statusLabel?: string;
}

const STEP_PILL: Record<SimStepStatus, string> = {
  todo: 'border-border text-muted-foreground hover:text-foreground',
  started: 'border-partial/60 text-partial-foreground',
  done: 'border-correct/50 bg-correct/10 text-correct-foreground',
  perfect: 'border-2 border-correct bg-correct/25 text-correct-foreground',
};

const STEP_STATUS: Record<SimStepStatus, string> = {
  todo: 'not started',
  started: 'in progress',
  done: 'done',
  perfect: 'done on the first try',
};

export interface SimBarProps {
  /** The game's short title, shown only in an embed. */
  title?: string;
  icon?: LucideIcon;
  /** Always shown at the start of the first row (a back link, a scenario name, toggles). */
  lead?: ReactNode;
  steps?: SimStep[];
  current?: number;
  onStep?: (index: number) => void;
  /** "Puzzle" reads "Puzzle 3: <title>, in progress". */
  stepNoun?: string;
  stepsLabel?: string;
  /** Right side of the first row: SimHintButton, SimResetButton. */
  tools?: ReactNode;
  /** n/m at the start of the second row. */
  progress?: { current: number; total: number };
  /** The step title, an h2. */
  heading?: ReactNode;
  /** Badges and status after the title. */
  meta?: ReactNode;
  /** Right side of the second row: previous, next, results. */
  actions?: ReactNode;
  /** One line, always visible. */
  goal?: ReactNode;
  /** Extra rows: SimHowTo, a hint, a notice. */
  children?: ReactNode;
}

export function SimBar({
  title,
  icon: Icon,
  lead,
  steps,
  current = 0,
  onStep,
  stepNoun = 'Step',
  stepsLabel = 'Steps',
  tools,
  progress,
  heading,
  meta,
  actions,
  goal,
  children,
}: SimBarProps) {
  const { embedded } = useEmbed();
  const { setBarHeight } = useContext(FrameContext);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBarHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [setBarHeight]);

  const secondRow = progress || heading || meta || actions;
  const showTitle = embedded && title;
  const pills = steps && steps.length > 0;
  // With nothing else in the first row (the game page has no title and no pills),
  // the tools join the second row instead of taking a row of their own.
  const firstRow = showTitle || lead || pills || (tools && !secondRow);
  const rowTools = tools && !firstRow;
  return (
    <div
      ref={ref}
      className="z-20 space-y-1.5 rounded-lg border bg-card p-2 shadow-sm lg:sticky lg:top-[var(--site-header-h,0px)] lg:transition-[top] lg:duration-200 motion-reduce:transition-none"
    >
      {firstRow && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {showTitle && (
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4 text-primary" aria-hidden="true" />}
              <span className="font-semibold">{title}</span>
            </div>
          )}
          {lead}
          {pills && (
            <nav className="flex flex-wrap items-center gap-1" aria-label={stepsLabel}>
              {steps.map((step, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onStep?.(i)}
                  aria-current={i === current ? 'step' : undefined}
                  aria-label={`${stepNoun} ${i + 1}: ${step.title}, ${step.statusLabel ?? STEP_STATUS[step.status]}`}
                  title={step.title}
                  className={cn(
                    'h-10 w-9 rounded-md border text-xs font-semibold tabular-nums lg:h-8 lg:w-8',
                    STEP_PILL[step.status],
                    i === current && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </nav>
          )}
          {tools && <div className="ml-auto flex items-center gap-1">{tools}</div>}
        </div>
      )}

      {secondRow && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-3 gap-y-1',
            firstRow && 'border-t pt-1.5'
          )}
        >
          {progress && (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {progress.current}/{progress.total}
            </span>
          )}
          {heading && <h2 className="text-sm font-semibold sm:text-base">{heading}</h2>}
          {meta}
          {(actions || rowTools) && (
            <div className="ml-auto flex items-center gap-2">
              {actions}
              {rowTools && <div className="flex items-center gap-1">{tools}</div>}
            </div>
          )}
        </div>
      )}

      {goal && <SimGoal>{goal}</SimGoal>}
      {children}
    </div>
  );
}

/** The goal line: visible for the whole step, in the hint tone. */
export function SimGoal({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-hint/30 bg-hint/5 px-3 py-1 text-sm">
      <Target className="mt-0.5 h-4 w-4 shrink-0 text-hint" aria-hidden="true" />
      <p>
        <strong>Goal: </strong>
        {children}
      </p>
    </div>
  );
}

/**
 * How-to text that never disappears: open while `autoOpen` is true (before
 * the player's first action), then a one-line summary the player can reopen.
 */
export function SimHowTo({
  summary = 'How to play',
  autoOpen = false,
  children,
}: {
  summary?: ReactNode;
  autoOpen?: boolean;
  children: ReactNode;
}) {
  // React only writes `open` when autoOpen changes, so the player's own toggle sticks.
  return (
    <details open={autoOpen} className="text-sm">
      <summary className="w-fit cursor-pointer select-none rounded-sm py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        {summary}
      </summary>
      <div className="mt-1 rounded-md bg-muted/50 px-3 py-1.5 leading-relaxed">{children}</div>
    </details>
  );
}

export function SimHintButton({
  onClick,
  pressed,
  disabled,
  children,
}: {
  onClick: () => void;
  /** True once the hint for this step is open. Leave undefined for a counter. */
  pressed?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-10 lg:h-8"
      onClick={onClick}
      aria-pressed={pressed}
      disabled={disabled}
    >
      <Lightbulb className="h-4 w-4" aria-hidden="true" />
      {children ?? 'Hint'}
    </Button>
  );
}

/** Asks once ("Start over?") before it wipes progress; the question goes away after 3 s. */
export function SimResetButton({
  onReset,
  label = 'Start over',
  confirmLabel = 'Start over?',
}: {
  onReset: () => void;
  label?: string;
  confirmLabel?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-10 min-w-10 lg:h-8 lg:min-w-8"
      onClick={() => {
        if (confirming) {
          setConfirming(false);
          onReset();
        } else {
          setConfirming(true);
        }
      }}
      aria-label={confirming ? `Click again to ${label[0].toLowerCase()}${label.slice(1)}` : label}
    >
      <RotateCcw className="h-4 w-4" aria-hidden="true" />
      {confirming && <span>{confirmLabel}</span>}
    </Button>
  );
}

export interface SimPanel {
  id: string;
  /** The tab label below lg. */
  label: ReactNode;
  /** A small badge in the tab, such as "new". */
  badge?: ReactNode;
  content: ReactNode;
  /** Tab content below lg, when it differs from the column. */
  mobile?: ReactNode;
  /** False when the panel scrolls inside itself (a card with its own scroll area). */
  scroll?: boolean;
  scrollRef?: Ref<HTMLDivElement>;
  className?: string;
}

const TAB_COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

/**
 * The stage. On lg the panels are columns that fill the screen under the
 * sticky bar, each scrolling on its own; below lg the same panels are tabs.
 * `columns` is the lg grid template, as a literal Tailwind class.
 */
export function SimStage({
  panels,
  columns,
  tab,
  onTabChange,
  tabsLabel = 'Panels',
  anchorRef,
  minHeight = 'min-h-[18rem]',
  tabOrder,
}: {
  panels: SimPanel[];
  columns: string;
  tab: string;
  onTabChange: (tab: string) => void;
  tabsLabel?: string;
  /** An empty marker above the tabs, for revealTop() when the tab changes. */
  anchorRef?: Ref<HTMLDivElement>;
  minHeight?: string;
  /** Panel ids in tab order, when the tabs differ from the column order. */
  tabOrder?: string[];
}) {
  const { barHeight } = useContext(FrameContext);
  const tabs = tabOrder ? tabOrder.flatMap((id) => panels.filter((p) => p.id === id)) : panels;
  return (
    <>
      <div
        className={cn('hidden grid-rows-[minmax(0,1fr)] gap-2.5 lg:grid', minHeight, columns)}
        // As tall as the content, at most the screen under the sticky bar. --sim-embed-pad
        // is the embed route's own padding, 0 on the game page.
        style={{
          maxHeight: `calc(100dvh - var(--site-header-h, 0px) - var(--sim-embed-pad, 0px) - ${barHeight + 16}px)`,
        }}
      >
        {panels.map((p) =>
          p.scroll === false ? (
            <div key={p.id} className={cn('min-h-0', p.className)}>
              {p.content}
            </div>
          ) : (
            <div
              key={p.id}
              ref={p.scrollRef}
              className={cn(
                'min-h-0 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]',
                p.className
              )}
            >
              {p.content}
            </div>
          )
        )}
      </div>

      <div ref={anchorRef} aria-hidden="true" className="lg:hidden" />
      <Tabs value={tab} onValueChange={onTabChange} className="lg:hidden">
        <div className="sticky top-[var(--site-header-h,0px)] z-20 -mx-1 bg-background px-1 py-1.5 transition-[top] duration-200 motion-reduce:transition-none">
          <TabsList
            className={cn('grid h-11 w-full', TAB_COLS[tabs.length] ?? 'grid-cols-3')}
            aria-label={tabsLabel}
          >
            {tabs.map((p) => (
              <TabsTrigger key={p.id} value={p.id} className="h-9 gap-1.5">
                {p.label}
                {p.badge}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tabs.map((p) => (
          <TabsContent key={p.id} value={p.id} className="mt-0 space-y-2">
            {p.mobile ?? p.content}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

/** The primary actions on phones, fixed to the bottom. Pair with <SimFrame phoneBar>. */
export function SimPhoneBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-xl items-center gap-2">{children}</div>
    </div>
  );
}

/** A small "new" or count badge for a tab. */
export function SimTabBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-primary px-1.5 text-xs font-semibold leading-4 text-primary-foreground">
      {children}
    </span>
  );
}

/**
 * Scrolls the nearest scrolling box (the page, or the embed's own scroll
 * area) so the top of `el` is in view. Unlike scrollIntoView it never
 * scrolls the page around an iframe, so it is safe inside Opsville.
 */
export function revealTop(
  el: HTMLElement | null,
  {
    onlyIfAbove = false,
    offset = 0,
    smooth = false,
  }: { onlyIfAbove?: boolean; offset?: number; smooth?: boolean } = {}
): void {
  if (!el || typeof window === 'undefined') return;
  let box = el.parentElement;
  while (box && box !== document.body && box !== document.documentElement) {
    const overflow = getComputedStyle(box).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && box.scrollHeight > box.clientHeight)
      break;
    box = box.parentElement;
  }
  const scroller = box && box !== document.body && box !== document.documentElement ? box : null;
  const top =
    el.getBoundingClientRect().top - (scroller ? scroller.getBoundingClientRect().top : 0) - offset;
  if (onlyIfAbove ? top >= 0 : Math.abs(top) < 1) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const options: ScrollToOptions = { top, behavior: smooth && !reduce ? 'smooth' : 'auto' };
  if (scroller) scroller.scrollBy(options);
  else window.scrollBy(options);
}
