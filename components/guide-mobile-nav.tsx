'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BookOpen, CheckCircle, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { cn } from '@/lib/utils';

interface GuidePart {
  title: string;
  slug: string;
}

interface GuideMobileNavProps {
  guide: {
    title: string;
    slug: string;
    parts: GuidePart[];
  };
  activePart: string;
  previousPart?: GuidePart;
  nextPart?: GuidePart;
}

/**
 * Bottom bar for guide parts on small screens: previous, contents and next
 * stay one tap away instead of only at the end of a long page. Hidden from lg
 * up, where the sidebar does the same job.
 */
export function GuideMobileNav({ guide, activePart, previousPart, nextPart }: GuideMobileNavProps) {
  const [open, setOpen] = useState(false);
  // Same key as GuideSidebar, so the checkmarks match.
  const [completedParts] = useLocalStorage<string[]>(`guide-${guide.slug}-completed`, []);

  const index = guide.parts.findIndex((p) => p.slug === activePart);
  const previousHref = previousPart
    ? `/guides/${guide.slug}/${previousPart.slug}`
    : `/guides/${guide.slug}`;

  return (
    <nav
      aria-label="Guide navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
    >
      <div className="mx-auto grid h-14 max-w-screen-sm grid-cols-[auto_1fr_auto] items-center gap-2 px-3">
        <Link
          href={previousHref}
          className="flex h-10 items-center gap-1 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={previousPart ? `Prev: ${previousPart.title}` : 'Guide overview'}
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{previousPart ? 'Prev' : 'Overview'}</span>
        </Link>

        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
          <DrawerTrigger asChild>
            <button
              type="button"
              className="flex h-10 min-w-0 flex-col items-center justify-center rounded-md px-2 transition-colors hover:bg-muted"
            >
              <span className="text-xs font-medium tabular-nums">
                Part {index + 1} of {guide.parts.length}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                Contents
                <ChevronUp className="h-3 w-3" />
              </span>
            </button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[80vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>{guide.title}</DrawerTitle>
              <DrawerDescription>
                Part {index + 1} of {guide.parts.length}
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Link
                href={`/guides/${guide.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-muted"
              >
                <BookOpen className="h-4 w-4 text-primary" />
                <span>Overview</span>
              </Link>
              <ol>
                {guide.parts.map((part, i) => {
                  const isActive = part.slug === activePart;
                  const isCompleted = completedParts.includes(part.slug);
                  return (
                    <li key={part.slug}>
                      <Link
                        href={`/guides/${guide.slug}/${part.slug}`}
                        onClick={() => setOpen(false)}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-muted',
                          isActive && 'bg-muted font-medium'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : isCompleted
                                ? 'bg-green-500/20 text-green-600 dark:bg-green-500/30 dark:text-green-400'
                                : 'bg-secondary text-secondary-foreground'
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="flex-1">{part.title}</span>
                        {isCompleted && !isActive && (
                          <CheckCircle
                            className="h-4 w-4 shrink-0 text-green-500"
                            aria-label="Completed"
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          </DrawerContent>
        </Drawer>

        {nextPart ? (
          <Link
            href={`/guides/${guide.slug}/${nextPart.slug}`}
            className="flex h-10 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            aria-label={`Next: ${nextPart.title}`}
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            href={`/guides/${guide.slug}`}
            className="flex h-10 items-center gap-1 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <BookOpen className="h-4 w-4" />
            <span>Overview</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
