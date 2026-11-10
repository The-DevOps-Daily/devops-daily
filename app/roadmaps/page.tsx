import Link from 'next/link';
import { ArrowRight, Map } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHero } from '@/components/page-hero';
import { roadmapCatalog, type RoadmapEntry } from '@/lib/roadmap-catalog';

const pad = (n: number) => String(n).padStart(2, '0');

function Facts({ entry }: { entry: RoadmapEntry }) {
  const { totals } = entry;
  const facts = [
    [totals.stages, 'stages'],
    [totals.topics, 'topics'],
    [`${totals.minWeeks}-${totals.maxWeeks}`, 'weeks'],
    [totals.projects, 'projects'],
  ] as const;
  return (
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-xs text-muted-foreground">
      {facts.map(([value, label]) => (
        <li key={label}>
          <span className="font-semibold text-foreground">{value}</span> {label}
        </li>
      ))}
    </ul>
  );
}

function RoadmapCard({ entry, featured = false }: { entry: RoadmapEntry; featured?: boolean }) {
  return (
    <Link
      href={entry.href}
      className={cn(
        'group flex h-full flex-col rounded-md border border-border bg-card transition-colors hover:border-primary/50',
        featured ? 'p-6 md:p-8' : 'p-6'
      )}
    >
      <p className="font-mono text-xs text-muted-foreground">
        {featured ? `// start here, ${entry.level}` : `// ${entry.level}`}
      </p>
      <h2
        className={cn(
          'mt-1 font-bold tracking-tight transition-colors group-hover:text-primary',
          featured ? 'text-2xl sm:text-3xl' : 'text-xl'
        )}
      >
        {entry.title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {entry.description}
      </p>
      <Facts entry={entry} />
      <ol
        aria-label={`${entry.title} stages`}
        className={cn(
          'mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border',
          featured ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-9' : 'grid-cols-2 sm:grid-cols-3'
        )}
      >
        {entry.stages.map((stage, i) => (
          <li key={stage} className="bg-background px-3 py-2">
            <span className="block font-mono text-[11px] text-muted-foreground">{pad(i + 1)}</span>
            <span className="block text-sm font-medium leading-tight">{stage}</span>
          </li>
        ))}
      </ol>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-medium text-primary">
        Open the roadmap
        <ArrowRight
          className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

export default function RoadmapsPage() {
  const [main, ...paths] = roadmapCatalog;
  return (
    <div className="min-h-screen">
      <PageHero
        icon={Map}
        title="DevOps Roadmaps"
        description="Structured learning paths with links to our guides, simulators, labs and quizzes. Start with the full DevOps roadmap, or take a shorter path to your first role or into security."
        breadcrumbs={[{ label: 'Roadmaps' }]}
      />

      <section className="py-10 md:py-14">
        <div className="container mx-auto max-w-6xl px-4">
          <RoadmapCard entry={main} featured />
          <p className="mb-4 mt-10 font-mono text-xs text-muted-foreground">{'// shorter paths'}</p>
          <div className="grid gap-6 md:grid-cols-2">
            {paths.map((entry) => (
              <RoadmapCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
