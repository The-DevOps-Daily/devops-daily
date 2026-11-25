'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Sticky column that is taller than the screen, as in the X right column: it
 * scrolls with the page until its bottom reaches the bottom of the screen and
 * sticks there; on the way up it scrolls back until its top reaches the header
 * and sticks there. CSS does the sticking (data-stick and --sb-h, see
 * components/sticky-sidebar.tsx). On a change of scroll direction this moves
 * the column's flow position to where it is on screen, with a spacer above it,
 * so the browser scrolls it natively from there and nothing jumps. (A margin
 * would not do: it would stop the column from sticking above its flow position.)
 */
export function useBidirectionalSticky(
  ref: RefObject<HTMLElement | null>,
  spacerRef: RefObject<HTMLElement | null>,
  minWidth: string
) {
  useEffect(() => {
    const el = ref.current;
    const spacer = spacerRef.current;
    const parent = el?.parentElement;
    if (!el || !spacer || !parent) return;

    const root = document.documentElement;
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
      // While the column's box starts below the sticky line nothing can move
      // the column, so a spacer left from an earlier layout is dropped.
      const header = parseFloat(getComputedStyle(root).getPropertyValue('--site-header-h'));
      const line = (Number.isNaN(header) ? 80 : header) + 16;
      const offset = start >= line ? 0 : el.getBoundingClientRect().top - start;
      spacer.style.height = `${Math.round(Math.max(0, Math.min(offset, room - el.offsetHeight)))}px`;
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
    // Turnstile load late) or the page above it changes. In "up" mode the
    // column hangs from its bottom, so its new height has to be applied
    // (without the transition) before it is measured.
    const onResize = () => {
      if (!mq.matches) return;
      if (mode === 'up') {
        el.style.transition = 'none';
        setHeight();
        align('down');
        el.style.transition = '';
      } else {
        align('down');
      }
      setHeight();
    };
    const onBreakpoint = () => {
      lastY = window.scrollY;
      onResize();
    };

    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    ro.observe(document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    mq.addEventListener('change', onBreakpoint);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      mq.removeEventListener('change', onBreakpoint);
      cancelAnimationFrame(frame);
    };
  }, [ref, spacerRef, minWidth]);
}
