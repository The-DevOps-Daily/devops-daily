'use client';

import { useEffect, useState, type RefObject } from 'react';

// Scroll distance in one direction before the header changes state, so small
// jitters (trackpad momentum, mobile URL bar) do not make it flicker.
const THRESHOLD = 8;

/**
 * Hides an element (a sticky header) while the reader scrolls down and shows
 * it again as soon as they scroll up. It stays shown near the top of the page,
 * while it holds keyboard focus, while the pointer is over it, and while `pinned` is
 * true (for example an open menu). Returns whether it should be hidden.
 */
export function useHeadroom(
  ref: RefObject<HTMLElement | null>,
  { enabled, pinned = false }: { enabled: boolean; pinned?: boolean }
): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || pinned || !el) {
      setHidden(false);
      return;
    }

    const hover = window.matchMedia('(hover: hover)');
    let lastY = window.scrollY;
    let anchorY = lastY;
    let lastDir = 0;
    let isHidden = false;
    let frame = 0;

    const set = (next: boolean) => {
      if (next === isHidden) return;
      isHidden = next;
      setHidden(next);
    };

    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      if (y === lastY) return;
      const dir = y > lastY ? 1 : -1;
      // Count the distance from where the reader last changed direction.
      if (dir !== lastDir) {
        anchorY = lastY;
        lastDir = dir;
      }
      lastY = y;

      if (y <= el.offsetHeight) return set(false);
      if (el.querySelector(':focus-visible')) return set(false);
      if (hover.matches && el.matches(':hover')) return set(false);
      if (Math.abs(y - anchorY) < THRESHOLD) return;
      set(dir > 0);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // Keyboard users who tab into the header always see it.
    const onFocusIn = () => set(false);

    window.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('scroll', onScroll);
      el.removeEventListener('focusin', onFocusIn);
      cancelAnimationFrame(frame);
      set(false);
    };
  }, [ref, enabled, pinned]);

  return hidden;
}
