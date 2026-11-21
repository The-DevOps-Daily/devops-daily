'use client';

import { useEffect, useState } from 'react';

export type ChapterHeading = { id: string; text: string };

/**
 * The H2 headings of the chapter body ([data-guide-body]) and the one the
 * reader is in now. Read from the rendered page, so the ids always match the
 * anchors the Markdown renderer made. Pass the chapter slug: the list is read
 * again when the reader moves to another chapter.
 */
export function useChapterHeadings(chapter?: string) {
  const [headings, setHeadings] = useState<ChapterHeading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const body = chapter ? document.querySelector('[data-guide-body]') : null;
    const elements = body ? Array.from(body.querySelectorAll<HTMLElement>('h2[id]')) : [];

    // The current section is the last heading above the top third of the screen.
    const update = () => {
      frame = 0;
      const line = window.innerHeight / 3;
      let current: string | null = null;
      for (const el of elements) {
        if (el.getBoundingClientRect().top > line) break;
        current = el.id;
      }
      setActiveId(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    let frame = requestAnimationFrame(() => {
      setHeadings(
        elements
          .map((el) => ({
            id: el.id,
            text: (el.querySelector('a') ?? el).textContent?.replace(/\s+/g, ' ').trim() ?? '',
          }))
          .filter((heading) => heading.text)
      );
      update();
    });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [chapter]);

  return { headings, activeId };
}
