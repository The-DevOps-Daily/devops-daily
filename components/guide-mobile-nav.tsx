'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { GuideChapterList, completedKey } from '@/components/guide-chapter-list';
import { useChapterHeadings } from '@/hooks/use-chapter-headings';
import { useLocalStorage } from '@/hooks/use-local-storage';
import type { GuideNav } from '@/lib/guides';
import { cn } from '@/lib/utils';

interface GuideMobileNavProps {
  guide: GuideNav;
  activePart: string;
}

const iconLink = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors';

/**
 * Sticky bar under the site header on phones and tablets: where the reader is
 * ("Chapter 3 of 11: ...") and a menu with every chapter and the sections of
 * this one. Hidden from lg up, where the sidebar does the same job.
 */
export function GuideMobileNav({ guide, activePart }: GuideMobileNavProps) {
  // Open for one chapter only, so moving to another chapter closes the menu.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === activePart;
  const setOpen = (value: boolean) => setOpenFor(value ? activePart : null);
  const [completedParts] = useLocalStorage<string[]>(completedKey(guide.slug), []);
  const { headings, activeId } = useChapterHeadings(activePart);
  const panelId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLLIElement>(null);

  const index = guide.parts.findIndex((p) => p.slug === activePart);
  const current = guide.parts[index];
  const previous = index > 0 ? guide.parts[index - 1] : undefined;
  const next = guide.parts[index + 1];

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const item = activeItemRef.current;
    if (panel && item) panel.scrollTop = Math.max(0, item.offsetTop - panel.clientHeight / 3);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenFor(null);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenFor(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  if (!current) return null;
  const label = current.navTitle ?? current.title;

  return (
    <nav
      ref={rootRef}
      aria-label="Guide chapters"
      className="sticky top-[var(--site-header-h,0px)] z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:hidden print:hidden"
    >
      <div className="mx-auto flex h-12 max-w-screen-md items-center gap-1 px-2">
        <Link
          href={previous ? `/guides/${guide.slug}/${previous.slug}` : `/guides/${guide.slug}`}
          aria-label={previous ? `Previous chapter: ${previous.title}` : 'Guide overview'}
          className={cn(iconLink, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
        >
          {previous ? <ChevronLeft className="h-5 w-5" /> : <BookOpen className="h-4 w-4" />}
        </Link>

        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted"
        >
          <span className="shrink-0 tabular-nums text-muted-foreground">
            Chapter {index + 1} of {guide.parts.length}:
          </span>
          <span className="min-w-0 truncate font-medium text-foreground">{label}</span>
          <ChevronDown
            aria-hidden
            className={cn(
              'ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
              open && 'rotate-180'
            )}
          />
        </button>

        <Link
          href={next ? `/guides/${guide.slug}/${next.slug}` : `/guides/${guide.slug}`}
          aria-label={next ? `Next chapter: ${next.title}` : 'Guide overview'}
          className={cn(
            iconLink,
            next
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {next ? <ChevronRight className="h-5 w-5" /> : <BookOpen className="h-4 w-4" />}
        </Link>
      </div>

      <div
        ref={panelRef}
        id={panelId}
        hidden={!open}
        className="relative max-h-[calc(100dvh-var(--site-header-h,0px)-3rem)] overflow-y-auto overscroll-contain border-t border-border bg-background pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-1 shadow-lg"
      >
        <div className="mx-auto max-w-screen-md">
          <GuideChapterList
            guide={guide}
            activePart={activePart}
            completedParts={completedParts}
            headings={headings}
            activeHeadingId={activeId}
            activeItemRef={activeItemRef}
            onNavigate={() => setOpen(false)}
          />
        </div>
      </div>
    </nav>
  );
}
