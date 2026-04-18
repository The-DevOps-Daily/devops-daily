import Link from 'next/link';
import { cn } from '@/lib/utils';

interface BreadcrumbProps {
  items: {
    label: string;
    href: string;
    isCurrent?: boolean;
  }[];
  className?: string;
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Terminal-style breadcrumb rendered like a shell path:
 *   $ ~/games/dns-simulator
 * Each segment is clickable; the current page is rendered as plain text.
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('mb-6 font-mono text-xs sm:text-sm', className)}
    >
      <ol className="flex flex-wrap items-center gap-0.5 text-muted-foreground">
        <li>
          <span className="text-green-500/80 select-none mr-2">$</span>
          <Link
            href="/"
            className="hover:text-primary transition-colors"
          >
            ~
          </Link>
        </li>
        {items.map((item, index) => {
          const segment = slugify(item.label);
          const isLast = item.isCurrent || index === items.length - 1;
          return (
            <li key={index} className="flex items-center">
              <span className="select-none">/</span>
              {isLast ? (
                <span
                  aria-current="page"
                  className="text-foreground truncate max-w-[12rem] sm:max-w-xs"
                  title={item.label}
                >
                  {segment}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-primary transition-colors"
                  title={item.label}
                >
                  {segment}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
