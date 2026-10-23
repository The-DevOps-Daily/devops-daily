import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface GuidePartNavigationProps {
  previousPart?: {
    slug: string;
    title: string;
  };
  nextPart?: {
    slug: string;
    title: string;
  };
  guideSlug: string;
  isOverview?: boolean;
}

const cardClass =
  'group flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-border px-4 py-3 no-underline transition-colors hover:border-primary/50 hover:bg-muted/50';

export function GuidePartNavigation({
  previousPart,
  nextPart,
  guideSlug,
  isOverview = false,
}: GuidePartNavigationProps) {
  const previous = isOverview
    ? undefined
    : previousPart
      ? {
          href: `/guides/${guideSlug}/${previousPart.slug}`,
          label: 'Previous',
          title: previousPart.title,
        }
      : { href: `/guides/${guideSlug}`, label: 'Back to', title: 'Overview' };

  return (
    <nav aria-label="Guide parts" className="not-prose mt-8 flex flex-col gap-3 pt-6 sm:flex-row">
      {previous ? (
        <Link href={previous.href} className={cardClass}>
          <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">{previous.label}</span>
            <span className="block truncate text-sm font-medium text-foreground">
              {previous.title}
            </span>
          </span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
      {nextPart && (
        <Link
          href={`/guides/${guideSlug}/${nextPart.slug}`}
          className={`${cardClass} justify-end text-right`}
        >
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">
              {isOverview ? 'Start with' : 'Next'}
            </span>
            <span className="block truncate text-sm font-medium text-foreground">
              {nextPart.title}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
        </Link>
      )}
    </nav>
  );
}
