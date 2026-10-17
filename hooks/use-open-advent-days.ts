'use client';

import { useSyncExternalStore } from 'react';
import { ADVENT_DAYS, getOpenAdventDays } from '@/lib/advent-schedule';

/**
 * Re-read the clock at the next local midnight (when a new day can open) and
 * when the tab becomes visible again, so an open tab does not need a reload.
 */
function subscribeToDayChanges(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = setTimeout(
      () => {
        onChange();
        schedule();
      },
      nextMidnight.getTime() - now.getTime() + 1000
    );
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') onChange();
  };
  schedule();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onChange);
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onChange);
  };
}

/**
 * Open calendar days for this visitor. The server HTML shows every day open,
 * so crawlers see all links; after hydration the count comes from the
 * visitor's clock.
 */
export function useOpenAdventDays() {
  return useSyncExternalStore(
    subscribeToDayChanges,
    () => getOpenAdventDays(new Date()),
    () => ADVENT_DAYS
  );
}
