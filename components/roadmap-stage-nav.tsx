'use client';

import React, { useEffect, useState } from 'react';
import { Map, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StageNavItem {
  id: string;
  title: string;
  icon: LucideIcon;
}

/**
 * Sticky stage navigator for the roadmap. On large screens it is a slim
 * icon rail (labels slide out on hover so content is never covered) with a
 * hide toggle and a floating reopen button. On smaller screens it is a
 * horizontal scroller pinned under the header, in normal flow so it never
 * overlaps content. Highlights the stage in view; click scrolls.
 */
export function RoadmapStageNav({ stages }: { stages: StageNavItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
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
      {/* Slim icon rail, large screens */}
      {!hidden && (
        <nav
          aria-label="Roadmap stages"
          className="hidden xl:flex fixed right-4 top-1/2 -translate-y-1/2 z-30 flex-col items-end gap-1"
        >
          <button
            onClick={() => setHidden(true)}
            aria-label="Hide stage navigation"
            className="mb-1 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
          {stages.map((stage) => {
            const active = activeId === stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => scrollTo(stage.id)}
                aria-label={`Jump to ${stage.title}`}
                aria-current={active ? 'true' : undefined}
                className="group flex items-center justify-end gap-0"
              >
                <span
                  className={cn(
                    'pointer-events-none max-w-0 overflow-hidden whitespace-nowrap rounded-l-full border border-r-0 text-xs font-medium opacity-0 transition-all duration-200',
                    'group-hover:max-w-[11rem] group-hover:px-3 group-hover:py-1.5 group-hover:opacity-100',
                    'border-border/60 bg-background/95 text-foreground shadow-sm'
                  )}
                >
                  {stage.title}
                </span>
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm transition-colors',
                    active
                      ? 'border-primary/50 bg-primary text-primary-foreground'
                      : 'border-border/60 bg-background/90 text-muted-foreground group-hover:text-foreground group-hover:bg-muted'
                  )}
                >
                  <stage.icon className="h-3.5 w-3.5" />
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Floating reopen button when hidden */}
      {hidden && (
        <button
          onClick={() => setHidden(false)}
          aria-label="Show stage navigation"
          className="hidden xl:flex fixed right-4 bottom-6 z-30 h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/95 text-muted-foreground shadow-md transition-colors hover:text-foreground hover:bg-muted"
        >
          <Map className="h-4 w-4" />
        </button>
      )}

      {/* Horizontal scroller, small and medium screens (in flow, never overlaps) */}
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
