'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, BookOpen, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';

interface GuidePart {
  title: string;
  slug: string;
  description?: string;
}

interface Guide {
  title: string;
  slug: string;
  parts: GuidePart[];
}

interface GuideSidebarProps {
  guide: Guide;
  activePart?: string;
}

export function GuideSidebar({ guide, activePart }: GuideSidebarProps) {
  // Track completed parts in localStorage
  const [completedParts, setCompletedParts] = useState<string[]>([]);

  // Load completed parts from localStorage on mount
  useEffect(() => {
    const key = `guide-${guide.slug}-completed`;
    const saved = localStorage.getItem(key);
    if (saved) {
      setCompletedParts(JSON.parse(saved));
    }
  }, [guide.slug]);

  // Save completed parts to localStorage
  useEffect(() => {
    if (completedParts.length > 0) {
      const key = `guide-${guide.slug}-completed`;
      localStorage.setItem(key, JSON.stringify(completedParts));
    }
  }, [completedParts, guide.slug]);

  // Mark current part as completed when navigating away
  useEffect(() => {
    if (activePart && !completedParts.includes(activePart)) {
      // Add a small delay to mark as complete once user has spent time on the page
      const timer = setTimeout(() => {
        setCompletedParts((prev) => [...prev, activePart]);
      }, 30000); // Mark as complete after 30 seconds

      return () => clearTimeout(timer);
    }
  }, [activePart, completedParts]);

  // Toggle completion status manually
  const toggleCompletion = (slug: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setCompletedParts((prev) =>
      prev.includes(slug) ? prev.filter((p) => p !== slug) : [...prev, slug]
    );
  };

  return (
    <Card className="sticky top-8 flex flex-col max-h-[calc(100vh-100px)]">
      <CardHeader className="border-b py-3 shrink-0">
        <CardTitle className="text-base font-medium">Guide Contents</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex flex-col overflow-hidden">
        <div className="grow flex flex-col overflow-hidden">
          <Link
            href={`/guides/${guide.slug}`}
            className={cn(
              'flex items-center px-4 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors shrink-0',
              !activePart && 'bg-muted font-medium'
            )}
          >
            <BookOpen className="mr-2 h-4 w-4 text-primary" />
            <span>Overview</span>
          </Link>

          <div className="mt-2 border-t">
            <div className="px-4 py-2 text-xs uppercase tracking-wider font-medium text-muted-foreground sticky top-0 bg-card z-10 border-b">
              Sections
            </div>

            <div className="max-h-[calc(100vh-240px)] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
              {guide.parts.map((part, index) => {
                const isActive = activePart === part.slug;
                const isCompleted = completedParts.includes(part.slug);

                return (
                  <div
                    key={part.slug}
                    id={`section-${part.slug}`}
                    className={cn('relative transition-all', isActive && 'bg-muted/70')}
                  >
                    <Link
                      href={`/guides/${guide.slug}/${part.slug}`}
                      className="flex items-center group px-4 py-2 hover:bg-muted/50 transition-colors"
                    >
                      {/* Number indicator */}
                      <div
                        className={cn(
                          'shrink-0 w-6 h-6 flex items-center justify-center rounded-full mr-2 text-xs font-medium',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : isCompleted
                              ? 'bg-green-500/20 text-green-600 dark:bg-green-500/30 dark:text-green-400'
                              : 'bg-secondary text-secondary-foreground'
                        )}
                      >
                        {index + 1}
                      </div>

                      {/* Title */}
                      <span
                        className={cn(
                          'text-sm flex-1 transition-colors line-clamp-1',
                          isActive && 'font-medium text-foreground',
                          isCompleted && !isActive && 'text-muted-foreground',
                          isCompleted &&
                            !isActive &&
                            'line-through decoration-slate-400 decoration-1'
                        )}
                      >
                        {part.title}
                      </span>

                      {/* Status icons */}
                      <div className="shrink-0 ml-2">
                        {isCompleted ? (
                          <button
                            onClick={(e) => toggleCompletion(part.slug, e)}
                            className="opacity-60 hover:opacity-100 transition-opacity"
                            title="Mark as not completed"
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => toggleCompletion(part.slug, e)}
                            className="opacity-0 group-hover:opacity-50 hover:opacity-100 transition-opacity"
                            title="Mark as completed"
                          >
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>

                      {/* Active indicator */}
                      {isActive && (
                        <ChevronRight className="h-4 w-4 ml-1 text-primary shrink-0" />
                      )}
                    </Link>

                    {/* Active left border */}
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-3 border-t shrink-0">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Your progress</span>
            <Badge variant="outline" className="px-2 py-0 h-5 text-xs font-normal">
              {completedParts.length}/{guide.parts.length}
            </Badge>
          </div>

          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{
                width: `${Math.round((completedParts.length / guide.parts.length) * 100)}%`,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
