'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResolvedStage, ResolvedTopic } from '@/lib/roadmap-resources';
import type { TopicStatus } from '@/lib/roadmap-progress';
import { useRoadmap, type PanelTarget } from './roadmap-provider';
import { ResourceGroups, ResourceLink } from './resource-list';
import { KindLabel, StatusIcon, STATUS_LABELS } from './roadmap-marks';

const SUGGEST_URL = 'https://github.com/The-DevOps-Daily/devops-daily/issues/new';

export function RoadmapPanel({
  target,
  onNavigate,
  onClose,
  returnFocus,
}: {
  target: PanelTarget | null;
  onNavigate: (target: PanelTarget) => void;
  onClose: () => void;
  returnFocus: () => boolean;
}) {
  const { stages } = useRoadmap();
  const stageIndex = target
    ? stages.findIndex((s) =>
        target.kind === 'stage' ? s.id === target.id : s.topics.some((t) => t.id === target.id)
      )
    : -1;
  const stage = stages[stageIndex];
  const topic =
    target?.kind === 'topic' ? stage?.topics.find((t) => t.id === target.id) : undefined;

  return (
    <Dialog.Root open={Boolean(stage)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            if (returnFocus()) event.preventDefault();
          }}
          className={cn(
            'fixed z-50 flex flex-col border-border bg-background text-foreground shadow-xl outline-none',
            'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-lg border-t',
            'md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[28rem] md:rounded-none md:border-l md:border-t-0',
            'motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-bottom md:motion-safe:data-[state=open]:slide-in-from-right md:motion-safe:data-[state=open]:slide-in-from-bottom-0'
          )}
        >
          {stage && (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                <p className="pt-1 font-mono text-xs text-muted-foreground">
                  {`// stage ${String(stageIndex + 1).padStart(2, '0')} of ${String(stages.length).padStart(2, '0')}, ${stage.shortTitle.toLowerCase()}`}
                </p>
                <Dialog.Close className="-mr-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <X className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Close panel</span>
                </Dialog.Close>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
                {topic ? (
                  <TopicBody stage={stage} topic={topic} onNavigate={onNavigate} />
                ) : (
                  <StageBody stage={stage} index={stageIndex} onNavigate={onNavigate} />
                )}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TopicBody({
  stage,
  topic,
  onNavigate,
}: {
  stage: ResolvedStage;
  topic: ResolvedTopic;
  onNavigate: (target: PanelTarget) => void;
}) {
  const { stages, progress, loaded, setStatus, recordOpen } = useRoadmap();
  const all = stages.flatMap((s) => s.topics);
  const at = all.findIndex((t) => t.id === topic.id);
  const prev = all[at - 1];
  const next = all[at + 1];
  const status = progress.topics[topic.id];

  return (
    <article aria-labelledby="roadmap-panel-title">
      <Dialog.Title id="roadmap-panel-title" className="text-2xl font-bold tracking-tight">
        {topic.name}
      </Dialog.Title>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
        <KindLabel kind={topic.kind} />
        <span>{topic.level}</span>
      </p>
      <Dialog.Description className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {topic.summary}
      </Dialog.Description>

      <h3 className="mt-5 font-mono text-xs text-muted-foreground">{'// covers'}</h3>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {topic.subtopics.map((sub) => (
          <li key={sub} className="rounded-md border border-border px-2 py-0.5 text-xs">
            {sub}
          </li>
        ))}
      </ul>

      {!stage.ongoing && (
        <div className="mt-6 rounded-md border border-border bg-muted/30 p-3">
          <p id="roadmap-status-label" className="text-sm font-medium">
            Your status
          </p>
          <div
            role="group"
            aria-labelledby="roadmap-status-label"
            className="mt-2 grid grid-cols-3 gap-2"
          >
            {(['done', 'progress', 'skip'] as TopicStatus[]).map((option) => {
              const pressed = loaded && status === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setStatus(topic.id, pressed ? null : option)}
                  className={cn(
                    'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors',
                    pressed
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:border-primary/50'
                  )}
                >
                  <StatusIcon
                    status={option}
                    className={pressed ? 'text-primary-foreground' : undefined}
                  />
                  {STATUS_LABELS[option].action}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Saved in this browser. Press the selected button again to clear it.
          </p>
        </div>
      )}

      <div className="mt-6">
        {topic.resources.length > 0 ? (
          <ResourceGroups
            idPrefix="roadmap-panel"
            resources={topic.resources}
            onOpen={(resource) => recordOpen(topic.id, resource)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            We have no material for this topic yet.{' '}
            <a
              href={`${SUGGEST_URL}?title=${encodeURIComponent(`Roadmap resource for: ${topic.name}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              Suggest a resource
            </a>
          </p>
        )}
      </div>

      <nav
        aria-label="Other topics"
        className="mt-8 flex justify-between gap-3 border-t border-border pt-4"
      >
        {prev ? (
          <button
            type="button"
            onClick={() => onNavigate({ kind: 'topic', id: prev.id })}
            className="inline-flex min-w-0 items-center gap-1.5 text-left text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              <span className="sr-only">Previous topic: </span>
              {prev.name}
            </span>
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button
            type="button"
            onClick={() => onNavigate({ kind: 'topic', id: next.id })}
            className="inline-flex min-w-0 items-center gap-1.5 text-right text-sm font-medium hover:text-primary"
          >
            <span className="truncate">
              <span className="sr-only">Next topic: </span>
              {next.name}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        )}
      </nav>
    </article>
  );
}

function StageBody({
  stage,
  index,
  onNavigate,
}: {
  stage: ResolvedStage;
  index: number;
  onNavigate: (target: PanelTarget) => void;
}) {
  const { progress, loaded } = useRoadmap();
  return (
    <article aria-labelledby="roadmap-panel-title">
      <Dialog.Title id="roadmap-panel-title" className="text-2xl font-bold tracking-tight">
        {stage.title}
      </Dialog.Title>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        stage {index + 1}, {stage.timeLabel.toLowerCase()}
      </p>
      <Dialog.Description className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {stage.description}
      </Dialog.Description>
      <StageDetails stage={stage} />

      <h3 className="mt-6 font-mono text-xs text-muted-foreground">{'// topics'}</h3>
      <ul className="mt-2 grid gap-1.5">
        {stage.topics.map((topic) => (
          <li key={topic.id}>
            <button
              type="button"
              onClick={() => onNavigate({ kind: 'topic', id: topic.id })}
              className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:border-primary/50"
            >
              <span className="flex-1">{topic.name}</span>
              <StatusIcon status={loaded ? progress.topics[topic.id] : undefined} withLabel />
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** Before you start, outcomes, projects and roles. Also rendered hidden in the map. */
export function StageDetails({ stage }: { stage: ResolvedStage }) {
  return (
    <div className="mt-5 space-y-5 text-sm">
      <section>
        <h3 className="font-mono text-xs text-muted-foreground">{'// before you start'}</h3>
        <p className="mt-1.5">{stage.prerequisites.join(', ')}</p>
      </section>
      <section>
        <h3 className="font-mono text-xs text-muted-foreground">{'// outcomes'}</h3>
        <ul className="mt-1.5 list-inside list-disc marker:text-muted-foreground">
          {stage.outcomes.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-mono text-xs text-muted-foreground">{'// practice projects'}</h3>
        <ul className="mt-2 grid gap-3">
          {stage.projects.map((project) => (
            <li key={project.name} className="rounded-md border border-border p-3">
              <p className="font-medium">{project.name}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {project.difficulty}, {project.estimatedTime.toLowerCase()}
              </p>
              <p className="mt-1.5 text-muted-foreground">{project.description}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {project.technologies.join(' · ')}
              </p>
              {project.practice && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs text-muted-foreground">Start with:</p>
                  <ResourceLink resource={project.practice} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-mono text-xs text-muted-foreground">{'// roles it leads to'}</h3>
        <p className="mt-1.5">{stage.roles.join(', ')}</p>
      </section>
    </div>
  );
}
