import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  /** Monospace label shown above the heading, rendered as `// {label}` */
  label: string;
  title: string;
  description?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
}

export function SectionHeader({
  label,
  title,
  description,
  viewAllHref,
  viewAllLabel = 'Browse all',
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-end justify-between mb-8 border-b pb-4 gap-4',
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-mono text-muted-foreground mb-1">
          // {label}
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="hidden sm:inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          {viewAllLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}
