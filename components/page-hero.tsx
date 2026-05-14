import type { LucideIcon } from 'lucide-react';
import { Breadcrumb } from '@/components/breadcrumb';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeroProps {
  title: string;
  /** Word to highlight in the title with accent color + underline */
  accentWord?: string;
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
  accentWord,
  description,
  icon: Icon,
  iconColor = 'text-primary',
  breadcrumbs,
  stats,
  badge,
  children,
}: PageHeroProps) {
  // Build title with optional accent word
  const renderTitle = () => {
    if (!accentWord) return title;
    const idx = title.toLowerCase().indexOf(accentWord.toLowerCase());
    if (idx === -1) return title;
    const before = title.slice(0, idx);
    const word = title.slice(idx, idx + accentWord.length);
    const after = title.slice(idx + accentWord.length);
    return (
      <>
        {before}
        <span className="text-primary relative inline-block">
          {word}
          <svg className="absolute -bottom-1 left-0 w-full h-2 text-primary/30" viewBox="0 0 100 8" preserveAspectRatio="none">
            <path d="M0 7 Q20 1 40 5 Q60 0 80 6 Q90 3 100 5" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </span>
        {after}
      </>
    );
  };
  return (
    <div className="relative border-b border-border/50 overflow-hidden">
      {/* Layered background with depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/60 via-muted/30 to-background" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-transparent to-transparent" />

      {/* Top accent line with shimmer */}
      <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden">
        <div className="h-full bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />
        <div className="absolute inset-0 h-full w-1/3 bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
      </div>

      {/* Decorative right side */}
      <div className="absolute right-0 top-0 bottom-0 w-2/5 hidden lg:block pointer-events-none">
        {/* Concentric arcs */}
        <svg className="absolute right-0 top-1/2 -translate-y-1/2 w-80 h-80 opacity-[0.03]" viewBox="0 0 320 320" fill="none">
          <circle cx="320" cy="160" r="60" stroke="currentColor" strokeWidth="1" className="text-primary" />
          <circle cx="320" cy="160" r="100" stroke="currentColor" strokeWidth="0.8" className="text-primary" />
          <circle cx="320" cy="160" r="140" stroke="currentColor" strokeWidth="0.6" className="text-primary" />
          <circle cx="320" cy="160" r="180" stroke="currentColor" strokeWidth="0.4" className="text-primary" strokeDasharray="4 6" />
        </svg>

        {/* Dot grid */}
        <div className="absolute bottom-10 right-10 grid grid-cols-4 gap-3 opacity-[0.05]">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" />
          ))}
        </div>

        {/* Small diagonal lines */}
        <svg className="absolute top-10 right-48 w-16 h-16 opacity-[0.04]" viewBox="0 0 64 64" fill="none">
          <line x1="0" y1="16" x2="16" y2="0" stroke="currentColor" strokeWidth="1" className="text-primary" />
          <line x1="0" y1="32" x2="32" y2="0" stroke="currentColor" strokeWidth="1" className="text-primary" />
          <line x1="0" y1="48" x2="48" y2="0" stroke="currentColor" strokeWidth="1" className="text-primary" />
          <line x1="0" y1="64" x2="64" y2="0" stroke="currentColor" strokeWidth="1" className="text-primary" />
        </svg>
      </div>

      <div className="relative container mx-auto px-4 py-10 sm:py-14">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb
            className="mb-6"
            items={breadcrumbs.map((item) => ({
              label: item.label,
              href: item.href,
              isCurrent: !item.href,
            }))}
          />
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
              <div className="mt-1 flex-shrink-0 relative group">
                {/* Glow behind icon */}
                <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md scale-110 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center shadow-sm">
                  <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
              </div>
            )}
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
                {renderTitle()}
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
