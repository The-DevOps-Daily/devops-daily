import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SectionHeader } from '@/components/section-header';
import { TOOLS, CATEGORY_LABEL } from '@/lib/tools';
import { cn } from '@/lib/utils';

interface FeaturedToolsProps {
  className?: string;
  /** Maximum number of tools to show. Defaults to 6. */
  limit?: number;
}

export function FeaturedTools({ className, limit = 6 }: FeaturedToolsProps) {
  const featured = TOOLS.slice(0, limit);
  if (featured.length === 0) return null;

  // Pad to a multiple of 3 so the editorial gap-px grid has no trailing gaps.
  const fillerCount = (3 - (featured.length % 3)) % 3;

  return (
    <section className={cn(className)}>
      <SectionHeader
        label="tools"
        title="DevOps Tools and Calculators"
        description="Free, browser-only utilities. CIDR, JWT, base64, UUID, cron, K8s sizing, YAML. No sign-up, no server."
        viewAllHref="/tools"
      />
      <div className="grid gap-px grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 bg-border border rounded-md overflow-hidden">
        {featured.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="group bg-card p-5 flex flex-col transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <Icon
                  className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors"
                  strokeWidth={1.5}
                />
                <span className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-wider">
                  {CATEGORY_LABEL[tool.category]}
                </span>
              </div>
              <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                {tool.shortTitle}
              </h3>
              <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2 flex-1">
                {tool.description}
              </p>
              <div className="flex items-center gap-1 mt-3 text-[11px] font-mono text-primary/80">
                <span>Open</span>
                <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
        {Array.from({ length: fillerCount }).map((_, i) => (
          <div
            key={`filler-${i}`}
            aria-hidden="true"
            className="bg-card hidden lg:block"
          />
        ))}
      </div>
    </section>
  );
}
