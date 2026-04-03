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
    <div className="border-b border-border/50 bg-muted/20">
      <div className="container mx-auto px-4 py-10 sm:py-14">
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
              <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center`}>
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
            </div>
          </div>

          {/* Stats row */}
          {stats && stats.length > 0 && (
            <div className="flex flex-wrap gap-6 mt-6 pl-14">
              {stats.map((stat, i) => (
                <div key={i} className="text-sm">
                  <span className="font-semibold text-foreground">{stat.value}</span>
                  <span className="text-muted-foreground ml-1">{stat.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Optional extra content (filters, CTAs, etc.) */}
          {children && <div className="mt-6">{children}</div>}
        </div>
      </div>
    </div>
  );
}
