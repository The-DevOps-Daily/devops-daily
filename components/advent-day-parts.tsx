import Link from 'next/link';
import type { ReactNode } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';

const DIFFICULTY_CHIP: Record<string, string> = {
  Beginner: 'border-green-500/30 bg-green-500/10 text-green-500',
  Intermediate: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500',
  Advanced: 'border-red-500/30 bg-red-500/10 text-red-500',
};

/** The top of an Advent day page, shared by Advent of DevOps and Advent of Postgres. */
export function AdventDayHeader({
  path,
  day,
  total,
  difficulty,
  topics = [],
  title,
  excerpt,
  meta,
}: {
  /** Shown as `// <path>`, for example `advent-of-postgres/day-7`. */
  path: string;
  day: number;
  total: number;
  difficulty?: string;
  topics?: string[];
  title: string;
  excerpt?: string;
  meta?: ReactNode;
}) {
  return (
    <header className="mb-10">
      <p className="mb-3 font-mono text-xs text-muted-foreground">{`// ${path}`}</p>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-1 font-mono text-xs text-primary tabular-nums">
          <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} />
          Day {day} of {total}
        </span>
        {difficulty && (
          <span
            className={`rounded-md border px-2 py-1 text-xs font-medium ${
              DIFFICULTY_CHIP[difficulty] ?? DIFFICULTY_CHIP.Intermediate
            }`}
          >
            {difficulty}
          </span>
        )}
        {topics.map((t) => (
          <span
            key={t}
            className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
          >
            {t}
          </span>
        ))}
      </div>
      <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl">{title}</h1>
      {excerpt && <p className="mb-5 text-lg text-muted-foreground md:text-xl">{excerpt}</p>}
      {meta && (
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {meta}
        </div>
      )}
    </header>
  );
}

/** Share buttons after a day's challenge. */
export function AdventShareBox({
  heading,
  text,
  url,
  hashtags,
}: {
  heading: string;
  text: string;
  url: string;
  hashtags: string;
}) {
  return (
    <div className="mt-12 rounded-md border border-primary/20 bg-primary/5 p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-primary/15 p-3">
          <Share2 className="h-5 w-5 text-primary" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <h3 className="mb-2 text-lg font-semibold">{heading}</h3>
          <p className="mb-4 text-muted-foreground">
            Tag{' '}
            <a
              href="https://x.com/thedevopsdaily"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              @thedevopsdaily
            </a>{' '}
            and share it with the community.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${hashtags}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Share on X
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-muted/30"
            >
              Share on LinkedIn
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Previous day, all days, next day. */
export function AdventDayNav({
  base,
  prev,
  next,
}: {
  /** The event's landing page, for example `/advent-of-postgres`. */
  base: string;
  prev?: { slug: string; day: number };
  next?: { slug: string; day: number };
}) {
  const cell =
    'group flex items-center gap-2 rounded-md border border-border px-4 py-3 transition-colors hover:border-primary/50 hover:bg-primary/5';
  return (
    <nav className="mt-12 border-t border-border pt-8" aria-label="Days">
      <div className="flex items-center justify-between gap-4">
        {prev ? (
          <Link href={`${base}/${prev.slug}`} className={cell}>
            <ChevronLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
            <div className="text-left">
              <div className="text-xs text-muted-foreground">Previous</div>
              <div className="font-medium">Day {prev.day}</div>
            </div>
          </Link>
        ) : (
          <div />
        )}
        <Link href={base} className={`${cell} text-sm font-medium`}>
          All Days
        </Link>
        {next ? (
          <Link href={`${base}/${next.slug}`} className={cell}>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Next</div>
              <div className="font-medium">Day {next.day}</div>
            </div>
            <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        ) : (
          <div />
        )}
      </div>
    </nav>
  );
}
