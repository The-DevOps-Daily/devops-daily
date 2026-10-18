import Link from 'next/link';
import { Calendar, ChevronRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type AdventHeroProps = {
  /** Shown as `// <label>` above the dates. */
  label: string;
  dates: string;
  name: string;
  year: number;
  description: string;
  stats: { icon: LucideIcon; text: string }[];
  cta: { href: string; label: string };
  progress: ReactNode;
};

/** The hero the Advent events share: dates, title with the year, stats, buttons and days open. */
export function AdventHero({
  label,
  dates,
  name,
  year,
  description,
  stats,
  cta,
  progress,
}: AdventHeroProps) {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.07] dark:opacity-[0.09]"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
        }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent" />

      <div className="container relative mx-auto px-4 py-16 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-mono text-muted-foreground mb-3">{`// ${label}`}</p>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-primary/20 bg-primary/5 text-xs font-mono text-primary mb-6 tabular-nums">
            <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
            {dates}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            {name}{' '}
            <span className="text-primary relative inline-block">
              {year}
              <svg
                className="absolute -bottom-2 left-0 w-full h-3 text-primary/40"
                viewBox="0 0 120 12"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 9 Q15 2 30 8 Q45 1 60 7 Q75 2 90 9 Q105 4 118 7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            {description}
          </p>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-10 font-mono text-sm text-muted-foreground tabular-nums">
            {stats.map(({ icon: Icon, text }) => (
              <span key={text} className="inline-flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                {text}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={cta.href}
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              {cta.label}
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="https://x.com/thedevopsdaily"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-border hover:border-primary/50 hover:bg-muted/30 font-medium transition-colors"
            >
              Follow @thedevopsdaily
            </a>
          </div>

          {progress}
        </div>
      </div>
    </div>
  );
}

/** A section title in the Advent pages' style: `// label`, then the heading. */
export function AdventSectionHeader({
  id,
  label,
  title,
  description,
}: {
  id?: string;
  label: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8">
      <p className="text-xs font-mono text-muted-foreground mb-1">{`// ${label}`}</p>
      <h2 id={id} className="text-2xl sm:text-3xl font-bold tracking-tight">
        {title}
      </h2>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

/** The small icon tile next to the day number on an Advent card. */
export function AdventCardIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/40">
      <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
    </div>
  );
}
