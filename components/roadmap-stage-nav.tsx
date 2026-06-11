'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StageNavItem {
  id: string;
  title: string;
  icon: LucideIcon;
}

/**
 * Sticky stage navigator for the roadmap: a vertical rail on large screens,
 * a horizontal scroller pinned under the header on smaller ones. Highlights
 * the stage currently in view and scrolls smoothly on click.
 */
export function RoadmapStageNav({ stages }: { stages: StageNavItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the visible stage closest to the top of the viewport
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id.replace('stage-', ''));
      },
      { rootMargin: '-15% 0px -65% 0px' }
    );
    for (const stage of stages) {
      const el = document.getElementById(`stage-${stage.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [stages]);

  const scrollTo = (id: string) => {
    document.getElementById(`stage-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      {/* Vertical rail, large screens */}
      <nav
        aria-label="Roadmap stages"
        className="hidden xl:flex fixed right-6 top-1/2 -translate-y-1/2 z-30 flex-col gap-1"
      >
        {stages.map((stage) => {
          const active = activeId === stage.id;
          return (
            <button
              key={stage.id}
              onClick={() => scrollTo(stage.id)}
              aria-label={`Jump to ${stage.title}`}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'group flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-left transition-colors',
                active ? 'bg-primary/10' : 'hover:bg-muted/60'
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors',
                  active
                    ? 'border-primary/50 bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground group-hover:text-foreground'
                )}
              >
                <stage.icon className="h-3.5 w-3.5" />
              </span>
              <span
                className={cn(
                  'max-w-[9rem] truncate text-xs font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                )}
              >
                {stage.title}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Horizontal scroller, small and medium screens */}
      <nav
        aria-label="Roadmap stages"
        className="xl:hidden sticky top-14 z-30 -mx-4 border-y border-border/50 bg-background/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70"
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {stages.map((stage) => {
            const active = activeId === stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => scrollTo(stage.id)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <stage.icon className="h-3 w-3" />
                {stage.title}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
