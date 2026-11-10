'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TopicStatus } from '@/lib/roadmap-progress';
import { topicAnchor } from '@/lib/roadmap-syllabus';
import { useStageCounts, useSyllabus, type SyllabusStageInfo } from './syllabus-provider';

const pad = (n: number) => String(n).padStart(2, '0');

function ago(at: number) {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

export function SyllabusContinueLink() {
  const { next, progress, loaded } = useSyllabus();
  if (!next) {
    return (
      <a
        href="#roadmap"
        className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        No topics left. Review the path
      </a>
    );
  }
  const started = loaded && Object.keys(progress.topics).length > 0;
  return (
    <a
      href={`#${topicAnchor(next.id)}`}
      className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
    >
      <Play className="h-4 w-4" aria-hidden="true" />
      {started ? 'Continue' : 'Start with'}: {next.name}
    </a>
  );
}

export function ResetProgress({ tone }: { tone: 'terminal' | 'card' }) {
  const { progress, loaded, reset } = useSyllabus();
  const [confirming, setConfirming] = useState(false);
  const empty = Object.keys(progress.topics).length === 0 && !progress.last;
  const link =
    tone === 'terminal'
      ? 'underline underline-offset-4 hover:text-terminal-input'
      : 'underline underline-offset-4 hover:text-foreground';
  if (confirming) {
    return (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>Reset all progress?</span>
        <button
          type="button"
          onClick={() => {
            reset();
            setConfirming(false);
          }}
          className={cn(
            'underline underline-offset-4',
            tone === 'terminal' ? 'text-terminal-error' : 'text-destructive'
          )}
        >
          Yes, reset
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={link}>
          Cancel
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={!loaded || empty}
      className={cn(link, 'disabled:no-underline disabled:opacity-50')}
    >
      Reset progress
    </button>
  );
}

const CELL: Record<TopicStatus | 'none', string> = {
  done: 'bg-terminal-success',
  progress: 'bg-terminal-warning',
  skip: 'border border-terminal-muted/50',
  none: 'bg-terminal-border',
};

function StatusRow({
  stage,
  index,
  current,
}: {
  stage: SyllabusStageInfo;
  index: number;
  current: boolean;
}) {
  const { progress, loaded } = useSyllabus();
  const { done, counted } = useStageCounts(stage);
  return (
    <li>
      <a
        href={`#stage-${stage.id}`}
        aria-current={current ? 'step' : undefined}
        className={cn(
          'grid grid-cols-[1.5rem_minmax(0,1fr)_auto_2.75rem] items-center gap-2 rounded px-1.5 py-1 transition-colors hover:bg-terminal-bar',
          current && 'bg-terminal-bar'
        )}
      >
        <span className={current ? 'text-terminal-warning' : 'text-terminal-muted'}>
          {current ? '>' : pad(index + 1)}
        </span>
        <span
          className={cn('truncate', current ? 'text-terminal-input' : 'text-terminal-foreground')}
        >
          {stage.title}
        </span>
        <span aria-hidden="true" className="hidden gap-[3px] sm:inline-flex">
          {stage.topics.map((t) => (
            <span
              key={t.id}
              className={cn(
                'h-2.5 w-2.5 rounded-[2px]',
                CELL[(loaded && progress.topics[t.id]) || 'none']
              )}
            />
          ))}
        </span>
        <span
          className={cn(
            'text-right tabular-nums',
            done > 0 ? 'text-terminal-success' : 'text-terminal-muted'
          )}
        >
          <span className="sr-only">
            , {done} of {counted} topics done
          </span>
          <span aria-hidden="true">
            {done}/{counted}
          </span>
        </span>
      </a>
    </li>
  );
}

export function SyllabusStatusCard() {
  const { stages, next, progress, loaded } = useSyllabus();
  const last = loaded ? progress.last : undefined;
  return (
    <section
      aria-labelledby="syllabus-status-title"
      className="overflow-hidden rounded-lg border border-terminal-border bg-terminal font-mono text-[13px] text-terminal-foreground shadow-sm"
    >
      <div className="flex items-center gap-2 border-b border-terminal-border bg-terminal-bar px-3 py-2 text-xs">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-terminal-error/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-terminal-warning/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-terminal-success/80" />
        </span>
        <h2 id="syllabus-status-title" className="ml-1 font-normal text-terminal-muted">
          roadmap --status
        </h2>
        <span className="ml-auto hidden text-terminal-muted sm:inline">saved in this browser</span>
      </div>
      <div className="px-3 py-3 leading-6 sm:px-4">
        <p className="px-1.5">
          <span className="text-terminal-prompt">$</span> roadmap status
        </p>
        <ol aria-label="Progress per stage" className="mt-1">
          {stages.map((stage, i) => (
            <StatusRow key={stage.id} stage={stage} index={i} current={next?.stageIndex === i} />
          ))}
        </ol>
        <p className="mt-3 px-1.5">
          <span className="text-terminal-prompt">$</span> roadmap next
        </p>
        <div className="min-h-12 px-1.5">
          {next ? (
            <>
              <a
                href={`#${topicAnchor(next.id)}`}
                className="text-terminal-warning underline decoration-terminal-warning/40 underline-offset-4 hover:decoration-terminal-warning"
              >
                {next.name}
              </a>
              <p className="text-terminal-muted">
                stage {next.stageIndex + 1}, topic {next.index + 1} of{' '}
                {stages[next.stageIndex].topics.length}
              </p>
            </>
          ) : (
            <p className="text-terminal-success">no topics left: each one is done or skipped</p>
          )}
        </div>
        <p className="mt-2 px-1.5">
          <span className="text-terminal-prompt">$</span> roadmap last
        </p>
        <p className="min-h-12 px-1.5">
          <span className="text-terminal-muted">Continue where you left off: </span>
          {last ? (
            <>
              <a
                href={last.href}
                className="text-terminal-input underline decoration-terminal-border underline-offset-4 hover:decoration-terminal-input"
              >
                {last.title}
              </a>
              <span className="text-terminal-muted">, opened {ago(last.at)}</span>
            </>
          ) : (
            <span className="text-terminal-muted">nothing opened yet</span>
          )}
        </p>
        <div className="mt-1 flex min-h-7 flex-wrap items-center justify-between gap-2 border-t border-terminal-border px-1.5 pt-2 text-xs text-terminal-muted">
          <span>No account needed.</span>
          <ResetProgress tone="terminal" />
        </div>
      </div>
    </section>
  );
}

/** "progress 2/4" and a bar, in the stage header. */
export function StageProgress({ stage }: { stage: SyllabusStageInfo }) {
  const { done, counted } = useStageCounts(stage);
  const percent = counted ? Math.round((done / counted) * 100) : 0;
  return (
    <div className="w-full shrink-0 sm:w-40">
      <div className="flex items-baseline justify-between font-mono text-xs text-muted-foreground">
        <span>progress</span>
        <span className="tabular-nums text-foreground">
          {done}/{counted}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${stage.title} progress`}
        aria-valuemin={0}
        aria-valuemax={counted}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${counted} topics done`}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary/15"
      >
        <div
          className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
