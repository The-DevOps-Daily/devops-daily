import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Terminal, Play } from 'lucide-react';
import type { RelatedSimulator } from '@/lib/related-simulators';

interface RelatedSimulatorsProps {
  simulators: RelatedSimulator[];
  /** Section heading. */
  title?: string;
  className?: string;
}

/**
 * Sits directly under the article body rather than below the comments, where
 * the other related sections live. A reader who has just finished a Docker
 * article is at the point of wanting to try the commands, and a link that far
 * down the page reaches neither them nor much crawl equity.
 */
export function RelatedSimulators({
  simulators,
  title = 'Try it hands-on',
  className,
}: RelatedSimulatorsProps) {
  if (!simulators.length) return null;

  return (
    <section className={cn('', className)} aria-labelledby="related-simulators-heading">
      <div className="flex items-center gap-2 mb-4">
        <Terminal className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 id="related-simulators-heading" className="text-2xl font-bold">
          {title}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Run the commands from this article in the browser. Nothing to install.
      </p>
      <div
        className={cn(
          'grid gap-4',
          simulators.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1',
        )}
      >
        {simulators.map((sim) => (
          <Link
            key={sim.id}
            href={sim.href}
            className="group flex flex-col rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                <Play className="w-3 h-3" aria-hidden="true" />
                {sim.type === 'simulator' ? 'Simulator' : 'Interactive'}
              </span>
            </div>
            <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
              {sim.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
              {sim.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
