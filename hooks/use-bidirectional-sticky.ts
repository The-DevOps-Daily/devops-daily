'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Sticky column that is taller than the screen, as in the X right column: it
 * scrolls with the page until its bottom reaches the bottom of the screen and
 * sticks there; on the way up it scrolls back until its top reaches the header
 * and sticks there. CSS does the sticking (data-stick and --sb-h, see
 * components/sticky-sidebar.tsx). On a change of scroll direction this moves
 * the column's flow position (--sb-m) to where it is on screen, so the browser
 * scrolls it natively from there and nothing jumps.
 */
export function useBidirectionalSticky(ref: RefObject<HTMLElement | null>, minWidth: string) {
  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    const mq = window.matchMedia(`(min-width: ${minWidth})`);
    let mode: 'down' | 'up' = 'down';
    let lastY = window.scrollY;
    let frame = 0;

    const setHeight = () => el.style.setProperty('--sb-h', `${el.offsetHeight}px`);

    const align = (next: 'down' | 'up') => {
      const p = parent.getBoundingClientRect();
      const cs = getComputedStyle(parent);
      const start = p.top + parent.clientTop + parseFloat(cs.paddingTop);
      const room = parent.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const offset = el.getBoundingClientRect().top - start;
      const m = Math.max(0, Math.min(offset, room - el.offsetHeight));
      el.style.setProperty('--sb-m', `${Math.round(m)}px`);
      el.dataset.stick = next;
      mode = next;
    };

    const onScrollFrame = () => {
      frame = 0;
      const y = window.scrollY;
      if (y === lastY) return;
      const dir = y > lastY ? 'down' : 'up';
      lastY = y;
      if (dir !== mode && mq.matches) align(dir);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(onScrollFrame);
    };

    // Keep the top edge where it is when the column grows or shrinks (ads and
    // Turnstile load late). In "up" mode the column hangs from its bottom, so
    // its new height has to be known before it is measured.
    const onResize = () => {
      if (!mq.matches) return;
      if (mode === 'up') setHeight();
      align('down');
      setHeight();
    };
    const onBreakpoint = () => {
      lastY = window.scrollY;
      onResize();
    };

    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    window.addEventListener('scroll', onScroll, { passive: true });
    mq.addEventListener('change', onBreakpoint);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      mq.removeEventListener('change', onBreakpoint);
      cancelAnimationFrame(frame);
    };
  }, [ref, minWidth]);
}
