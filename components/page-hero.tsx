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
      {/* Layered background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent" />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" />

      {/* Decorative elements - right side */}
      <div className="absolute right-0 top-0 bottom-0 w-1/3 hidden lg:block pointer-events-none">
        {/* Geometric lines */}
        <svg className="absolute right-8 top-8 w-48 h-48 opacity-[0.04]" viewBox="0 0 200 200" fill="none">
          <rect x="20" y="20" width="160" height="160" rx="8" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
          <rect x="40" y="40" width="120" height="120" rx="6" stroke="currentColor" strokeWidth="1" className="text-primary" />
          <rect x="60" y="60" width="80" height="80" rx="4" stroke="currentColor" strokeWidth="0.75" className="text-primary" />
          <line x1="0" y1="100" x2="200" y2="100" stroke="currentColor" strokeWidth="0.5" className="text-primary" />
          <line x1="100" y1="0" x2="100" y2="200" stroke="currentColor" strokeWidth="0.5" className="text-primary" />
        </svg>

        {/* Dot grid */}
        <div className="absolute bottom-8 right-12 grid grid-cols-5 gap-3 opacity-[0.06]">
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" />
          ))}
        </div>
      </div>

      <div className="relative container mx-auto px-4 py-10 sm:py-14">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground transition-colors inline-flex items-center gap-1">
                  <Home className="w-3.5 h-3.5" />
                </Link>
              </li>
              {breadcrumbs.map((item, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                  {item.href ? (
                    <Link href={item.href} className="hover:text-foreground transition-colors">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-foreground font-medium truncate max-w-[200px] sm:max-w-none">{item.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="max-w-3xl">
          {/* Badge */}
          {badge && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 mb-5">
              {badge}
            </span>
          )}

          {/* Title with optional icon */}
          <div className="flex items-start gap-4">
            {Icon && (
              <div className="mt-1 flex-shrink-0 relative">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm">
                  <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
                {/* Small accent dot */}
                <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-primary/20 border-2 border-background" />
              </div>
            )}
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
                {title}
              </h1>
              <p className="mt-3 text-muted-foreground text-lg leading-relaxed max-w-2xl">
                {description}
              </p>

              {/* Stats row */}
              {stats && stats.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-5">
                  {stats.map((stat, i) => (
                    <div key={i} className="flex items-baseline gap-1.5">
                      <span className="font-bold text-primary text-xl tabular-nums">{stat.value}</span>
                      <span className="text-sm text-muted-foreground">{stat.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Optional extra content */}
          {children && <div className="mt-6">{children}</div>}
        </div>
      </div>
    </div>
  );
}
