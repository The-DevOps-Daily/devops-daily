import Link from 'next/link';
import { ArrowUpRight, Check, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { SectionSeparator } from '@/components/section-separator';
import { GameSponsors } from '@/components/games/game-sponsors';
import { RESOURCE_TYPES } from '@/components/roadmap/resource-list';
import {
  resolveSyllabus,
  type ResolvedResource,
  type ResolvedSyllabusStage,
  type ResolvedSyllabusTopic,
} from '@/lib/roadmap-resources';
import {
  getSyllabusTotals,
  topicAnchor,
  type SyllabusStage,
  type TopicPriority,
} from '@/lib/roadmap-syllabus';
import { sponsors } from '@/lib/sponsors';
import { SyllabusProvider, type SyllabusStageInfo } from './syllabus-provider';
import { StageProgress, SyllabusContinueLink, SyllabusStatusCard } from './syllabus-status';
import { TopicRow, TopicStatusControl, UpNextTag } from './syllabus-topic';
import { SyllabusNav } from './syllabus-nav';

const pad = (n: number) => String(n).padStart(2, '0');

const ISSUE_URL = 'https://github.com/The-DevOps-Daily/devops-daily/issues/new';

// Anchors clear the sticky site header, plus the stage bar below xl.
const SCROLL_MARGIN =
  'scroll-mt-[calc(var(--site-header-h,5.5rem)+4.5rem)] xl:scroll-mt-[calc(var(--site-header-h,5.5rem)+1.5rem)]';

const ROW_GRID = 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)_8.25rem] lg:gap-x-6';

const READ_TYPES = new Set(['guide', 'post', 'external']);

const PRIORITY: Record<TopicPriority, { bars: number; label: string }> = {
  essential: { bars: 3, label: 'essential' },
  important: { bars: 2, label: 'important' },
  'nice-to-have': { bars: 1, label: 'nice to have' },
};

const DIFFICULTY = { beginner: 1, intermediate: 2, advanced: 3 } as const;

export interface SyllabusRoadmapProps {
  roadmap: 'junior' | 'devsecops';
  /** H1 and breadcrumb label, e.g. "Junior DevOps Roadmap". */
  name: string;
  intro: string;
  stages: SyllabusStage[];
  /** The other roadmaps: listed at the end, and the smaller ones under the hero buttons. */
  related: { href: string; title: string; prompt: string; description: string; facts: string }[];
}

/** A neutral 3-bar mark: shape and a word, not colour. */
function Bars({ filled, label }: { filled: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="inline-flex items-end gap-[2px]">
        {['h-1.5', 'h-2', 'h-2.5'].map((height, i) => (
          <span
            key={height}
            className={cn(
              'w-[3px] rounded-[1px]',
              height,
              i < filled ? 'bg-foreground/70' : 'bg-foreground/15'
            )}
          />
        ))}
      </span>
      {label}
    </span>
  );
}

function resourceMeta(resource: ResolvedResource) {
  if (resource.type === 'external') return resource.meta;
  if (resource.type === 'simulator') return 'simulator';
  return [RESOURCE_TYPES[resource.type].label.toLowerCase(), resource.meta]
    .filter(Boolean)
    .join(', ');
}

function ResourceItem({ resource, track = true }: { resource: ResolvedResource; track?: boolean }) {
  const external = resource.type === 'external';
  const Icon = external ? ArrowUpRight : RESOURCE_TYPES[resource.type].icon;
  return (
    <li>
      <a
        href={resource.href}
        {...(track && { 'data-roadmap-resource': '', 'data-title': resource.title })}
        {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
        className="group flex items-start gap-2 py-1 text-[13px] leading-snug"
      >
        <Icon
          className="mt-[2px] h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="min-w-0">
          <span className="font-medium text-foreground decoration-primary/50 underline-offset-4 group-hover:text-primary group-hover:underline">
            {resource.title}
          </span>
          {external && <span className="sr-only"> (opens in a new tab)</span>}
          <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
            {resourceMeta(resource)}
          </span>
        </span>
      </a>
    </li>
  );
}

function ResourceCell({ label, items }: { label: string; items: ResolvedResource[] }) {
  return (
    <div
      className={cn(
        'grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2 lg:block',
        items.length === 0 && 'hidden lg:block'
      )}
    >
      <p className="pt-1 font-mono text-[11px] text-muted-foreground lg:sr-only">{label}</p>
      {items.length > 0 ? (
        <ul>
          {items.map((resource) => (
            <ResourceItem key={resource.href} resource={resource} />
          ))}
        </ul>
      ) : (
        <p className="py-1 text-[13px] text-muted-foreground/70">none yet</p>
      )}
    </div>
  );
}

function TopicItem({ topic }: { topic: ResolvedSyllabusTopic }) {
  const read = topic.resources.filter((r) => READ_TYPES.has(r.type));
  const practice = topic.resources.filter((r) => !READ_TYPES.has(r.type));
  const priority = PRIORITY[topic.priority];
  return (
    <TopicRow
      topicId={topic.id}
      id={topicAnchor(topic.id)}
      className={cn('grid gap-3 p-4 lg:px-5', ROW_GRID, SCROLL_MARGIN)}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="font-semibold leading-snug">{topic.name}</h3>
          <UpNextTag topicId={topic.id} />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <Bars filled={priority.bars} label={priority.label} />
          <span>~{topic.hours} h</span>
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{topic.description}</p>
      </div>
      {topic.resources.length > 0 ? (
        <>
          <ResourceCell label="read" items={read} />
          <ResourceCell label="practice" items={practice} />
        </>
      ) : (
        <p className="text-[13px] text-muted-foreground lg:col-span-2 lg:self-center">
          No DevOps Daily material for this topic yet.{' '}
          <a
            href={`${ISSUE_URL}?title=${encodeURIComponent(`Roadmap resource for: ${topic.name}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline decoration-border underline-offset-4 hover:text-primary"
          >
            Suggest a resource
          </a>
        </p>
      )}
      <div className="border-t border-border/60 pt-3 lg:border-0 lg:pt-1">
        <TopicStatusControl topicId={topic.id} topicName={topic.name} />
      </div>
    </TopicRow>
  );
}

function StageFooter({ stage }: { stage: ResolvedSyllabusStage }) {
  const { project } = stage;
  const label = 'mb-3 font-mono text-xs text-muted-foreground';
  return (
    <div className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-[1.3fr_1fr_1fr]">
      <section aria-label="Stage project" className="bg-card p-5">
        <p className={label}>{'// stage project'}</p>
        <p className="text-sm font-medium leading-snug">{project.name}</p>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          <Bars filled={DIFFICULTY[project.difficulty]} label={project.difficulty} />
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
        {project.practice && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">Start with:</p>
            <ul>
              <ResourceItem resource={project.practice} track={false} />
            </ul>
          </div>
        )}
      </section>
      <section aria-label="After this stage you can" className="bg-card p-5">
        <p className={label}>{'// after this stage you can'}</p>
        <ul className="space-y-2 text-sm">
          {stage.outcomes.map((outcome) => (
            <li key={outcome} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {outcome}
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Tips" className="bg-card p-5">
        <p className={label}>{'// tips'}</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {stage.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StageSection({
  stage,
  info,
  index,
  total,
}: {
  stage: ResolvedSyllabusStage;
  info: SyllabusStageInfo;
  index: number;
  total: number;
}) {
  return (
    <>
      <SectionSeparator
        command={`cd stages/${pad(index + 1)}-${stage.id}`}
        className={index === 0 ? 'mb-8 mt-10' : 'mb-8 mt-16'}
      />
      <section
        id={`stage-${stage.id}`}
        aria-labelledby={`stage-${stage.id}-title`}
        className={SCROLL_MARGIN}
      >
        <div className="mb-5 flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-1 font-mono text-xs text-muted-foreground">
              {`// stage ${pad(index + 1)} of ${pad(total)}, ${stage.timeLabel}`}
            </p>
            <h2
              id={`stage-${stage.id}-title`}
              className="text-2xl font-bold tracking-tight sm:text-3xl"
            >
              {stage.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{stage.description}</p>
          </div>
          <StageProgress stage={info} />
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-card">
          <div
            aria-hidden="true"
            className={cn(
              'hidden border-b border-border bg-muted/40 px-5 py-2 font-mono text-[11px] text-muted-foreground lg:grid',
              ROW_GRID
            )}
          >
            <span>topic</span>
            <span>read</span>
            <span>practice</span>
            <span>progress</span>
          </div>
          <ol className="divide-y divide-border">
            {stage.topics.map((topic) => (
              <TopicItem key={topic.id} topic={topic} />
            ))}
          </ol>
        </div>

        <StageFooter stage={stage} />
      </section>
    </>
  );
}

export async function SyllabusRoadmap({
  roadmap,
  name,
  intro,
  stages,
  related,
}: SyllabusRoadmapProps) {
  const resolved = await resolveSyllabus(stages);
  const totals = getSyllabusTotals(stages);
  const linked = new Set(
    resolved
      .flatMap((s) => s.topics.flatMap((t) => t.resources))
      .filter((r) => r.type !== 'external')
      .map((r) => r.href)
  ).size;
  const facts = [
    [totals.stages, 'stages'],
    [totals.topics, 'topics'],
    [`${totals.minWeeks}-${totals.maxWeeks}`, 'weeks'],
    [totals.projects, 'projects'],
    [linked, 'links to our material'],
  ] as const;
  const info: SyllabusStageInfo[] = stages.map((s) => ({
    id: s.id,
    title: s.title,
    shortTitle: s.shortTitle,
    topics: s.topics.map((t) => ({ id: t.id, name: t.name })),
  }));
  const path = `/roadmap/${roadmap}`;
  const issueUrl = `${ISSUE_URL}?title=${encodeURIComponent(
    `Issue with the ${name}`
  )}&body=${encodeURIComponent(`Page: https://devops-daily.com${path}\n\nWhat is wrong:\n`)}`;
  const siblings = related.filter((r) => r.href !== '/roadmap');

  return (
    <div className="min-h-screen">
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Roadmaps', url: '/roadmaps' },
          { name, url: path },
        ]}
      />
      <SyllabusProvider roadmap={roadmap} stages={info}>
        <section className="relative overflow-hidden border-b border-border/50">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle,currentColor_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)] dark:opacity-[0.1]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-br from-primary/[0.06] via-transparent to-transparent"
          />
          <div className="container relative mx-auto px-4 pb-10 pt-8 sm:pt-10">
            <Breadcrumb
              items={[
                { label: 'Roadmaps', href: '/roadmaps' },
                { label: name, isCurrent: true },
              ]}
            />
            <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_27rem] lg:gap-14">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{`// roadmap/${roadmap}`}</p>
                <h1 className="mt-2 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                  {name}
                </h1>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  {intro}
                </p>
                <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-xs text-muted-foreground">
                  {facts.map(([value, label]) => (
                    <li key={label}>
                      <span className="font-semibold text-foreground">{value}</span> {label}
                    </li>
                  ))}
                </ul>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <SyllabusContinueLink />
                  <Link
                    href="/roadmap"
                    className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-muted/40"
                  >
                    <MapIcon className="h-4 w-4" aria-hidden="true" />
                    Full DevOps roadmap
                  </Link>
                </div>
                {siblings.map((other) => (
                  <p key={other.href} className="mt-3 text-sm text-muted-foreground">
                    {other.prompt}{' '}
                    <Link
                      href={other.href}
                      className="font-medium text-foreground underline decoration-border underline-offset-4 hover:text-primary hover:decoration-primary"
                    >
                      {other.title}
                    </Link>
                    .
                  </p>
                ))}
              </div>
              <SyllabusStatusCard />
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4">
          {sponsors.length > 0 && <GameSponsors placement="inline" className="mb-0 mt-8" />}

          <div className="xl:grid xl:grid-cols-[13rem_minmax(0,1fr)] xl:gap-10">
            <SyllabusNav />
            <div id="roadmap" className={cn('min-w-0', SCROLL_MARGIN)}>
              {resolved.map((stage, i) => (
                <StageSection
                  key={stage.id}
                  stage={stage}
                  info={info[i]}
                  index={i}
                  total={resolved.length}
                />
              ))}

              <SectionSeparator command="cd .. && ls roadmaps" className="mb-8 mt-16" />
              <section aria-labelledby="roadmap-next-title">
                <p className="mb-1 font-mono text-xs text-muted-foreground">{'// next'}</p>
                <h2 id="roadmap-next-title" className="text-2xl font-bold tracking-tight">
                  Keep going
                </h2>
                <ul className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-2">
                  {related.map((item) => (
                    <li key={item.href} className="bg-card">
                      <Link
                        href={item.href}
                        className="group flex h-full flex-col gap-1 p-5 transition-colors hover:bg-muted/40"
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {item.facts}
                        </span>
                        <span className="font-semibold group-hover:text-primary">{item.title}</span>
                        <span className="text-sm text-muted-foreground">{item.description}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <p className="mb-16 mt-14 border-t border-border pt-6 text-center text-sm text-muted-foreground">
                Found a wrong link or a missing topic?{' '}
                <a
                  href={issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline decoration-border underline-offset-4 hover:text-primary hover:decoration-primary"
                >
                  Open an issue on GitHub
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </SyllabusProvider>
    </div>
  );
}
