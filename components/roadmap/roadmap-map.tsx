'use client';

import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResolvedStage, ResolvedTopic } from '@/lib/roadmap-resources';
import type { TopicStatus } from '@/lib/roadmap-progress';
import { useRoadmap } from './roadmap-provider';
import { ResourceGroups } from './resource-list';
import { StageDetails } from './roadmap-panel';
import { KindMarker, StatusIcon, STATUS_LABELS } from './roadmap-marks';

const NODE = '[data-roadmap-node]';

function moveFocus(event: React.KeyboardEvent<HTMLDivElement>) {
  const current = (event.target as HTMLElement).closest(NODE);
  if (!current) return;
  const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(NODE));
  const at = nodes.indexOf(current as HTMLElement);
  const to =
    event.key === 'ArrowDown' || event.key === 'ArrowRight'
      ? at + 1
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
        ? at - 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? nodes.length - 1
            : null;
  if (to === null || !nodes[to]) return;
  event.preventDefault();
  nodes[to].focus();
}

export function RoadmapMap() {
  const { stages } = useRoadmap();
  return (
    <div className="relative" onKeyDown={moveFocus}>
      <div
        aria-hidden="true"
        className="absolute bottom-6 left-[11px] top-6 w-0.5 bg-border md:left-1/2 md:-translate-x-1/2"
      />
      {stages.map((stage, index) => (
        <StageBlock key={stage.id} stage={stage} index={index} total={stages.length} />
      ))}
    </div>
  );
}

function StageBlock({
  stage,
  index,
  total,
}: {
  stage: ResolvedStage;
  index: number;
  total: number;
}) {
  const { open } = useRoadmap();
  const number = String(index + 1).padStart(2, '0');
  return (
    <section
      id={`stage-${stage.id}`}
      aria-labelledby={`stage-${stage.id}-title`}
      className="relative scroll-mt-24 pb-14 last:pb-0"
    >
      <header className="relative pl-8 md:flex md:justify-center md:pl-0">
        <span
          aria-hidden="true"
          className="absolute left-[5px] top-5 h-3.5 w-3.5 rotate-45 border-2 border-primary bg-background md:hidden"
        />
        <div className="relative z-10 rounded-md border border-border bg-card px-4 py-3 shadow-sm md:w-[26rem] md:text-center">
          <p className="font-mono text-xs text-muted-foreground">
            stage {number} of {String(total).padStart(2, '0')}, {stage.timeLabel.toLowerCase()}
          </p>
          <h2 id={`stage-${stage.id}-title`} className="mt-0.5 text-xl font-bold tracking-tight">
            {stage.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{stage.description}</p>
          <StageProgress stage={stage} />
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={(e) => open({ kind: 'stage', id: stage.id }, e.currentTarget)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            Projects, outcomes and roles
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <div hidden>
            <StageDetails stage={stage} />
          </div>
        </div>
      </header>
      <ol className="mt-8 grid gap-y-5 md:grid-cols-2 md:gap-x-16 md:gap-y-6">
        {stage.topics.map((topic, i) => (
          <TopicNode key={topic.id} topic={topic} side={i % 2 === 0 ? 'left' : 'right'} />
        ))}
      </ol>
    </section>
  );
}

function StageProgress({ stage }: { stage: ResolvedStage }) {
  const { progress, loaded } = useRoadmap();
  if (stage.ongoing) {
    return (
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        ongoing habits, no progress to track
      </p>
    );
  }
  const total = stage.topics.length;
  const skipped = stage.topics.filter((t) => progress.topics[t.id] === 'skip').length;
  const done = loaded ? stage.topics.filter((t) => progress.topics[t.id] === 'done').length : 0;
  const counted = total - (loaded ? skipped : 0);
  const percent = counted ? Math.round((done / counted) * 100) : 0;
  return (
    <div className="mt-2.5 flex items-center gap-3 md:mx-auto md:max-w-xs">
      <div
        role="progressbar"
        aria-label={`${stage.title} progress`}
        aria-valuemin={0}
        aria-valuemax={counted}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${counted} topics done`}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/15"
      >
        <div
          className="h-full bg-primary motion-safe:transition-[width] motion-safe:duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {done}/{counted}
      </span>
    </div>
  );
}

function TopicNode({ topic, side }: { topic: ResolvedTopic; side: 'left' | 'right' }) {
  const { progress, loaded, open } = useRoadmap();
  const status: TopicStatus | undefined = loaded ? progress.topics[topic.id] : undefined;
  const left = side === 'left';
  return (
    <li className={cn('relative pl-8 md:pl-0', !left && 'md:mt-10')}>
      <div
        className={cn(
          'relative flex flex-col gap-2 lg:flex-row lg:items-start lg:gap-0',
          left ? 'md:items-end lg:flex-row-reverse' : 'md:items-start'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-5 h-0.5 -translate-y-1/2 bg-border',
            '-left-[21px] w-[21px]',
            left ? 'md:-right-8 md:left-auto md:w-8' : 'md:-left-8 md:w-8'
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-5 h-2 w-2 -translate-y-1/2 rounded-full',
            '-left-[24px]',
            left ? 'md:-right-[36px] md:left-auto' : 'md:-left-[36px]',
            status === 'done' ? 'bg-green-600 dark:bg-green-400' : 'bg-border'
          )}
        />
        <button
          type="button"
          data-roadmap-node
          aria-haspopup="dialog"
          onClick={(e) => open({ kind: 'topic', id: topic.id }, e.currentTarget)}
          className={cn(
            'flex min-h-10 w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors md:w-60 md:shrink-0',
            topic.kind === 'core'
              ? 'border-foreground/25 bg-card font-medium hover:border-primary'
              : 'border-dashed border-muted-foreground/50 bg-background text-foreground/90 hover:border-primary',
            status === 'done' && 'border-green-600/50 dark:border-green-400/50',
            status === 'progress' && 'border-primary',
            status === 'skip' && 'opacity-60'
          )}
        >
          <KindMarker kind={topic.kind} />
          <span className={cn('flex-1', status === 'skip' && 'line-through')}>{topic.name}</span>
          {topic.kind === 'optional' && (
            <span
              aria-hidden="true"
              className="font-mono text-[10px] font-normal text-muted-foreground"
            >
              optional
            </span>
          )}
          <StatusIcon status={status} />
          <span className="sr-only">
            , {topic.kind === 'core' ? 'core topic' : 'optional topic'}
            {status ? `, ${STATUS_LABELS[status].label.toLowerCase()}` : ''}
          </span>
        </button>
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-5 hidden h-0.5 w-7 -translate-y-1/2 bg-border lg:block',
            left ? 'right-60' : 'left-60'
          )}
        />
        <ul
          aria-label={`${topic.name} covers`}
          className={cn(
            'flex flex-wrap text-[13px] leading-6 text-muted-foreground',
            left && 'md:justify-end',
            'lg:block lg:min-w-0 lg:py-0.5 lg:text-xs lg:leading-5',
            left
              ? 'lg:mr-7 lg:border-r-2 lg:border-border lg:pr-3 lg:text-right'
              : 'lg:ml-7 lg:border-l-2 lg:border-border lg:pl-3'
          )}
        >
          {topic.subtopics.map((sub) => (
            <li
              key={sub}
              className={cn(
                'relative after:mx-1.5 after:content-["·"] last:after:content-none lg:after:content-none',
                'lg:before:absolute lg:before:top-1/2 lg:before:h-px lg:before:w-2 lg:before:bg-border',
                left ? 'lg:before:-right-3' : 'lg:before:-left-3'
              )}
            >
              {sub}
            </li>
          ))}
        </ul>
      </div>
      <div hidden>
        <p>{topic.summary}</p>
        <ResourceGroups
          idPrefix={`topic-${topic.id.replace('/', '-')}`}
          resources={topic.resources}
        />
      </div>
    </li>
  );
}
