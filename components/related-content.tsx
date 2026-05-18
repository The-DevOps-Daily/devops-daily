import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface RelatedContentItem {
  slug: string;
  title: string;
  description?: string;
  href: string;
  /** Optional small label displayed above the title (category name, etc.) */
  label?: string;
  /** Optional small label displayed in the bottom-right (difficulty, time) */
  meta?: string;
}

interface RelatedContentProps {
  items: RelatedContentItem[];
  /** Section heading. Default "Related content". */
  title?: string;
  /** Wraps the section, gives the slug page room to set spacing. */
  className?: string;
}

export function RelatedContent({
  items,
  title = 'Related content',
  className,
}: RelatedContentProps) {
  if (!items.length) return null;

  return (
    <section className={cn('', className)}>
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.slug}
            href={item.href}
            className="group flex flex-col rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all"
          >
            {item.label && (
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {item.label}
              </p>
            )}
            <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
              {item.title}
            </h3>
            {item.description && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                {item.description}
              </p>
            )}
            {item.meta && (
              <p className="mt-3 text-xs text-muted-foreground">{item.meta}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
