'use client';

import Link from 'next/link';
import { useId, type Ref } from 'react';
import { BookOpen, Check } from 'lucide-react';
import type { ChapterHeading } from '@/hooks/use-chapter-headings';
import type { GuideNav } from '@/lib/guides';
import { cn } from '@/lib/utils';

/** localStorage key for the chapters a reader has finished in a guide. */
export const completedKey = (guideSlug: string) => `guide-${guideSlug}-completed`;

interface GuideChapterListProps {
  guide: GuideNav;
  activePart?: string;
  completedParts: string[];
  headings: ChapterHeading[];
  activeHeadingId: string | null;
  activeItemRef?: Ref<HTMLLIElement>;
  onNavigate?: () => void;
  /** Show the current chapter's sections under it (the mobile menu). */
  nestSections?: boolean;
}

/**
 * Overview link and the numbered chapters, optionally with the current
 * chapter's H2 sections under it. Shared by the desktop sidebar and the
 * mobile chapter menu.
 */
export function GuideChapterList({
  guide,
  activePart,
  completedParts,
  headings,
  activeHeadingId,
  activeItemRef,
  onNavigate,
  nestSections = false,
}: GuideChapterListProps) {
  const id = useId();
  const rowClass = (active: boolean) =>
    cn(
      'relative flex items-start gap-3 py-2 pl-4 pr-3 text-sm leading-snug transition-colors',
      active
        ? 'bg-primary/10 font-semibold text-foreground'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    );
  const activeBar = <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />;

  return (
    <>
      <Link
        href={`/guides/${guide.slug}`}
        onClick={onNavigate}
        aria-current={activePart ? undefined : 'page'}
        className={rowClass(!activePart)}
      >
        {!activePart && activeBar}
        <BookOpen aria-hidden className="h-5 w-5 shrink-0 p-0.5 text-primary" />
        <span>Overview</span>
      </Link>

      <p
        id={`${id}-chapters`}
        className="px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground"
      >
        Chapters
      </p>
      <ol aria-labelledby={`${id}-chapters`}>
        {guide.parts.map((part, index) => {
          const isActive = part.slug === activePart;
          const isDone = completedParts.includes(part.slug);

          return (
            <li key={part.slug} ref={isActive ? activeItemRef : undefined}>
              <Link
                href={`/guides/${guide.slug}/${part.slug}`}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                title={part.title}
                className={rowClass(isActive)}
              >
                {isActive && activeBar}
                <span
                  aria-hidden
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isDone
                        ? 'bg-green-600/15 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                        : 'bg-secondary text-secondary-foreground'
                  )}
                >
                  {isDone && !isActive ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="sr-only">Chapter {index + 1}: </span>
                  {part.navTitle ? (
                    <>
                      <span aria-hidden className="line-clamp-2">
                        {part.navTitle}
                      </span>
                      <span className="sr-only">{part.title}</span>
                    </>
                  ) : (
                    <span className="line-clamp-2">{part.title}</span>
                  )}
                  {isDone && <span className="sr-only"> (done)</span>}
                </span>
                <span
                  className={cn(
                    'shrink-0 pt-px text-xs font-normal tabular-nums',
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {part.minutes} min
                </span>
              </Link>

              {nestSections && isActive && headings.length > 0 && (
                <div className="pb-2 pl-12 pr-3 pt-1">
                  <p
                    id={`${id}-sections`}
                    className="pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    On this page
                  </p>
                  <ChapterSections
                    headings={headings}
                    activeHeadingId={activeHeadingId}
                    labelledBy={`${id}-sections`}
                    onNavigate={onNavigate}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

interface ChapterSectionsProps {
  headings: ChapterHeading[];
  activeHeadingId: string | null;
  labelledBy: string;
  onNavigate?: () => void;
}

/** The H2 sections of the current chapter, with the one being read marked. */
export function ChapterSections({
  headings,
  activeHeadingId,
  labelledBy,
  onNavigate,
}: ChapterSectionsProps) {
  return (
    <ul aria-labelledby={labelledBy} className="border-l">
      {headings.map((heading) => {
        const current = heading.id === activeHeadingId;
        return (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              onClick={onNavigate}
              aria-current={current ? 'location' : undefined}
              className={cn(
                '-ml-px block border-l-2 py-1 pl-3 text-[13px] leading-snug transition-colors',
                current
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              {heading.text}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
