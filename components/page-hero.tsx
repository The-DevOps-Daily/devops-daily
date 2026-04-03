import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeroProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  iconColor?: string;
  breadcrumbs?: BreadcrumbItem[];
  stats?: Array<{ label: string; value: string | number }>;
  badge?: string;
  children?: React.ReactNode;
}

export function PageHero({
  title,
  description,
  icon: Icon,
  iconColor = 'text-primary',
  breadcrumbs,
  stats,
  badge,
  children,
}: PageHeroProps) {
  return (
    <div className="relative border-b border-border/50 overflow-hidden">
      {/* Subtle background with slight color wash */}
      <div className="absolute inset-0 bg-muted/30" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent" />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/40 via-primary/10 to-transparent" />

      <div className="relative container mx-auto px-4 py-10 sm:py-14">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground transition-colors">
                  <Home className="w-3.5 h-3.5" />
                </Link>
              </li>
              {breadcrumbs.map((item, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                  {item.href ? (
                    <Link href={item.href} className="hover:text-foreground transition-colors">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-foreground font-medium">{item.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="max-w-3xl">
          {/* Badge */}
          {badge && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary mb-4">
              {badge}
            </span>
          )}

          {/* Title with optional icon */}
          <div className="flex items-start gap-4">
            {Icon && (
              <div className="mt-1.5 flex-shrink-0 w-11 h-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
            )}
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="mt-3 text-muted-foreground text-lg leading-relaxed max-w-2xl">
                {description}
              </p>

              {/* Stats row - inline with description */}
              {stats && stats.length > 0 && (
                <div className="flex flex-wrap gap-5 mt-4">
                  {stats.map((stat, i) => (
                    <div key={i} className="flex items-baseline gap-1.5 text-sm">
                      <span className="font-bold text-primary text-lg">{stat.value}</span>
                      <span className="text-muted-foreground">{stat.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Optional extra content (filters, CTAs, etc.) */}
          {children && <div className="mt-6">{children}</div>}
        </div>
      </div>
    </div>
  );
}
