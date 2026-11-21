'use client';

import { useEffect, useId, useRef } from 'react';
import { ChapterSections, GuideChapterList, completedKey } from '@/components/guide-chapter-list';
import { useChapterHeadings } from '@/hooks/use-chapter-headings';
import { useLocalStorage } from '@/hooks/use-local-storage';
import type { GuideNav } from '@/lib/guides';

interface GuideSidebarProps {
  guide: GuideNav;
  activePart?: string;
}

export function GuideSidebar({ guide, activePart }: GuideSidebarProps) {
  const id = useId();
  const [completedParts, setCompletedParts] = useLocalStorage<string[]>(
    completedKey(guide.slug),
    []
  );
  const { headings, activeId } = useChapterHeadings(activePart);
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLLIElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);
  // A chapter the reader set by hand is not marked again by the timer.
  const setByHand = useRef<string | null>(null);

  // A chapter counts as done after 30 seconds on it.
  useEffect(() => {
    if (activePart && setByHand.current !== activePart && !completedParts.includes(activePart)) {
      const timer = setTimeout(() => {
        setCompletedParts((prev) => (prev.includes(activePart) ? prev : [...prev, activePart]));
      }, 30000);

      return () => clearTimeout(timer);
    }
  }, [activePart, completedParts, setCompletedParts]);

  // Bring the current chapter into view in the list, without scrolling the page.
  useEffect(() => {
    const list = listRef.current;
    const item = activeItemRef.current;
    if (!list || !item) return;
    const top = item.offsetTop;
    if (top < list.scrollTop || top + 48 > list.scrollTop + list.clientHeight) {
      list.scrollTop = Math.max(0, top - list.clientHeight / 3);
    }
  }, [activePart]);

  // Keep the section being read visible in the On this page list.
  useEffect(() => {
    const box = sectionsRef.current;
    const link = box?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!box || !link) return;
    const top = link.offsetTop;
    if (top < box.scrollTop || top + link.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = Math.max(0, top - box.clientHeight / 3);
    }
  }, [activeId]);

  const doneCount = guide.parts.filter((p) => completedParts.includes(p.slug)).length;
  const activeDone = !!activePart && completedParts.includes(activePart);

  const toggleActive = () => {
    if (!activePart) return;
    setByHand.current = activePart;
    setCompletedParts((prev) =>
      prev.includes(activePart) ? prev.filter((p) => p !== activePart) : [...prev, activePart]
    );
  };

  return (
    <nav
      aria-label="Guide contents"
      className="sticky top-[calc(var(--site-header-h,5rem)+1rem)] flex max-h-[calc(100vh-var(--site-header-h,5rem)-2rem)] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm"
    >
      <p className="shrink-0 border-b px-4 py-3 text-base font-medium">Guide Contents</p>

      <div
        ref={listRef}
        className="relative min-h-36 shrink overflow-y-auto overscroll-contain py-2"
      >
        <GuideChapterList
          guide={guide}
          activePart={activePart}
          completedParts={completedParts}
          headings={headings}
          activeHeadingId={activeId}
          activeItemRef={activeItemRef}
        />
      </div>

      {headings.length > 0 && (
        <div className="flex min-h-28 shrink-[4] flex-col border-t">
          <p
            id={`${id}-sections`}
            className="shrink-0 px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            On this page
          </p>
          <div
            ref={sectionsRef}
            className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3"
          >
            <ChapterSections
              headings={headings}
              activeHeadingId={activeId}
              labelledBy={`${id}-sections`}
            />
          </div>
        </div>
      )}

      <div className="shrink-0 border-t px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span id={`${id}-progress`} className="text-muted-foreground">
            Your progress
          </span>
          <span className="font-medium tabular-nums">
            {doneCount}/{guide.parts.length}
          </span>
        </div>
        <div
          role="progressbar"
          aria-labelledby={`${id}-progress`}
          aria-valuemin={0}
          aria-valuemax={guide.parts.length}
          aria-valuenow={doneCount}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${Math.round((doneCount / guide.parts.length) * 100)}%` }}
          />
        </div>
        {activePart && (
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={activeDone}
              onChange={toggleActive}
              className="h-4 w-4 accent-primary"
            />
            I finished this chapter
          </label>
        )}
      </div>
    </nav>
  );
}
