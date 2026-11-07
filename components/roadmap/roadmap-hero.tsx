'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { nextTopicId, summarize } from '@/lib/roadmap-progress';
import { useRoadmap } from './roadmap-provider';

function useNextTopic() {
  const { trackedTopics, progress, loaded } = useRoadmap();
  const id = nextTopicId(loaded ? progress : { topics: {} }, trackedTopics);
  return trackedTopics.find((t) => t.id === id) ?? null;
}

export function RoadmapContinueButton() {
  const { open, progress, loaded } = useRoadmap();
  const next = useNextTopic();
  if (!next) return null;
  const started = loaded && Object.keys(progress.topics).length > 0;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={(e) => open({ kind: 'topic', id: next.id }, e.currentTarget)}
      className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
    >
      <Play className="h-4 w-4" aria-hidden="true" />
      {started ? 'Continue' : 'Start'}: {next.name}
    </button>
  );
}

function bar(percent: number, width = 12) {
  const filled = Math.round((percent / 100) * width);
  return `${'#'.repeat(filled)}${'.'.repeat(width - filled)}`;
}

function ago(at: number) {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

export function RoadmapStatusCard() {
  const { trackedTopics, progress, loaded, reset } = useRoadmap();
  const [confirming, setConfirming] = useState(false);
  const next = useNextTopic();
  const shown = loaded ? progress : { topics: {} };
  const s = summarize(
    shown,
    trackedTopics.map((t) => t.id)
  );
  const last = loaded ? progress.last : undefined;
  return (
    <section
      aria-labelledby="roadmap-status-title"
      className="overflow-hidden rounded-lg border border-terminal-border bg-terminal font-mono text-[13px] text-terminal-foreground shadow-sm"
    >
      <div className="flex items-center gap-2 border-b border-terminal-border bg-terminal-bar px-3 py-2 text-xs">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-terminal-error/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-terminal-warning/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-terminal-success/80" />
        </span>
        <h2 id="roadmap-status-title" className="ml-1 font-normal text-terminal-muted">
          Your progress
        </h2>
        <span className="ml-auto text-terminal-muted">saved in this browser</span>
      </div>
      <div className="space-y-1 px-4 py-3 leading-6">
        <p>
          <span className="text-terminal-prompt">$</span> roadmap status
        </p>
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2">
          <dt className="text-terminal-muted">done</dt>
          <dd className="tabular-nums">
            <span className="sr-only">
              {s.done} of {s.counted} topics, {s.percent} percent
            </span>
            <span aria-hidden="true">
              {s.done}/{s.counted} <span className="text-terminal-success">[{bar(s.percent)}]</span>{' '}
              {s.percent}%
            </span>
          </dd>
          <dt className="text-terminal-muted">in progress</dt>
          <dd className="tabular-nums">{s.progress}</dd>
          <dt className="text-terminal-muted">skipped</dt>
          <dd className="tabular-nums">{s.skip}</dd>
          <dt className="text-terminal-muted">next</dt>
          <dd className="truncate text-terminal-warning">{next ? next.name : 'all done'}</dd>
          <dt className="text-terminal-muted">last opened</dt>
          <dd className="truncate">
            {last ? (
              <a
                href={last.href}
                className="text-terminal-input underline decoration-terminal-border underline-offset-4 hover:decoration-terminal-input"
              >
                {last.title}
              </a>
            ) : (
              <span className="text-terminal-muted">nothing yet</span>
            )}
            {last && <span className="text-terminal-muted">, {ago(last.at)}</span>}
          </dd>
        </dl>
        <div className="flex min-h-7 flex-wrap items-center justify-between gap-2 pt-2 text-xs text-terminal-muted">
          <span>No account needed.</span>
          {confirming ? (
            <span className="flex items-center gap-3">
              <span>Reset all progress?</span>
              <button
                type="button"
                onClick={() => {
                  reset();
                  setConfirming(false);
                }}
                className="text-terminal-error underline underline-offset-4"
              >
                Yes, reset
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="underline underline-offset-4 hover:text-terminal-input"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!loaded || (s.done + s.progress + s.skip === 0 && !last)}
              className="underline underline-offset-4 hover:text-terminal-input disabled:no-underline disabled:opacity-50"
            >
              Reset progress
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function RoadmapStageNav() {
  const { stages, progress, loaded } = useRoadmap();
  return (
    <nav aria-label="Roadmap stages">
      <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3 lg:grid-cols-9">
        {stages.map((stage, i) => {
          const done = loaded
            ? stage.topics.filter((t) => progress.topics[t.id] === 'done').length
            : 0;
          const finished = !stage.ongoing && done === stage.topics.length;
          return (
            <li key={stage.id} className="bg-background last:col-span-2 sm:last:col-span-1">
              <a
                href={`#stage-${stage.id}`}
                className="flex h-full flex-col gap-1 px-3 py-2.5 transition-colors hover:bg-muted/60"
              >
                <span className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <span
                    className={cn('tabular-nums', finished && 'text-green-600 dark:text-green-400')}
                  >
                    {stage.ongoing ? 'ongoing' : `${done}/${stage.topics.length}`}
                  </span>
                </span>
                <span className="text-sm font-medium leading-tight">{stage.shortTitle}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
