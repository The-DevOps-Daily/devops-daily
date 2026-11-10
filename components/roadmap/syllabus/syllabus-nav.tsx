'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStageCounts, useSyllabus, type SyllabusStageInfo } from './syllabus-provider';
import { ResetProgress } from './syllabus-status';

const pad = (n: number) => String(n).padStart(2, '0');

/** The stage whose section starts above a line just under the sticky header. */
function useActiveStage(stages: SyllabusStageInfo[]) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const header =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--site-header-h')
        ) || 88;
      let current = 0;
      stages.forEach((stage, i) => {
        const el = document.getElementById(`stage-${stage.id}`);
        if (el && el.getBoundingClientRect().top <= header + 120) current = i;
      });
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [stages]);
  return active;
}

function useTotals() {
  const { topics, progress, loaded } = useSyllabus();
  if (!loaded) return { done: 0, counted: topics.length, percent: 0 };
  const statuses = topics.map((t) => progress.topics[t.id]);
  const done = statuses.filter((s) => s === 'done').length;
  const counted = statuses.filter((s) => s !== 'skip').length;
  return { done, counted, percent: counted ? Math.round((done / counted) * 100) : 0 };
}

function StageLink({
  stage,
  index,
  active,
  short,
  onPick,
}: {
  stage: SyllabusStageInfo;
  index: number;
  active: boolean;
  short?: boolean;
  onPick?: () => void;
}) {
  const { done, counted } = useStageCounts(stage);
  return (
    <li>
      <a
        href={`#stage-${stage.id}`}
        onClick={onPick}
        aria-current={active ? 'location' : undefined}
        className={cn(
          '-ml-px flex min-h-9 items-center gap-3 border-l-2 py-1.5 pl-3 pr-1 text-sm transition-colors',
          active
            ? 'border-primary font-medium text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        )}
      >
        <span className={cn('w-5 font-mono text-xs tabular-nums', active && 'text-primary')}>
          {pad(index + 1)}
        </span>
        <span className="flex-1 truncate">{short ? stage.shortTitle : stage.title}</span>
        <span className="font-mono text-[11px] tabular-nums">
          <span className="sr-only">
            , {done} of {counted} done
          </span>
          <span aria-hidden="true">
            {done}/{counted}
          </span>
        </span>
      </a>
    </li>
  );
}

function StageList({
  active,
  short,
  onPick,
}: {
  active: number;
  short?: boolean;
  onPick?: () => void;
}) {
  const { stages } = useSyllabus();
  return (
    <ol className="space-y-0.5 border-l border-border">
      {stages.map((stage, i) => (
        <StageLink
          key={stage.id}
          stage={stage}
          index={i}
          active={i === active}
          short={short}
          onPick={onPick}
        />
      ))}
    </ol>
  );
}

/**
 * Below xl: a sticky bar under the site header that opens the stage list.
 * From xl: a sticky contents list in the left column, with overall progress.
 */
export function SyllabusNav() {
  const { stages } = useSyllabus();
  const active = useActiveStage(stages);
  const totals = useTotals();
  const current = stages[active];
  const counts = useStageCounts(current);
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <>
      <div
        ref={bar}
        className="sticky top-[var(--site-header-h,5.5rem)] z-30 -mx-4 mt-6 border-y border-border bg-background/95 px-4 backdrop-blur xl:hidden"
      >
        <nav aria-label="Roadmap stages">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="syllabus-stage-menu"
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-12 w-full items-center gap-3 py-2 text-left"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border">
              <List className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[11px] text-muted-foreground">
                stage {pad(active + 1)} of {pad(stages.length)}
              </span>
              <span className="block truncate text-sm font-medium">{current.title}</span>
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              <span className="sr-only">
                , {counts.done} of {counts.counted} done. Show all stages
              </span>
              <span aria-hidden="true">
                {counts.done}/{counts.counted}
              </span>
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground motion-safe:transition-transform',
                open && 'rotate-180'
              )}
              aria-hidden="true"
            />
          </button>
          <div
            id="syllabus-stage-menu"
            hidden={!open}
            className="absolute inset-x-0 top-full max-h-[70dvh] overflow-y-auto border-b border-border bg-background px-4 pb-4 pt-2 shadow-sm"
          >
            <StageList active={active} onPick={() => setOpen(false)} />
          </div>
        </nav>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-primary/15">
          <div className="h-full bg-primary" style={{ width: `${totals.percent}%` }} />
        </div>
      </div>

      <aside className="hidden xl:block">
        <nav
          aria-label="Roadmap stages"
          className="sticky top-[calc(var(--site-header-h,5.5rem)+1.5rem)] pt-10"
        >
          <p className="mb-3 font-mono text-xs text-muted-foreground">{'// stages'}</p>
          <StageList active={active} short />
          <div className="mt-6 rounded-md border border-border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Your progress</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {totals.done}/{totals.counted}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Roadmap progress"
              aria-valuemin={0}
              aria-valuemax={totals.counted}
              aria-valuenow={totals.done}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/15"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${totals.percent}%` }}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Saved in this browser. No account needed.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              <ResetProgress tone="card" />
            </p>
          </div>
        </nav>
      </aside>
    </>
  );
}
