'use client';

import { useSyncExternalStore } from 'react';
import { ADVENT_DAYS, getOpenAdventDays } from '@/lib/advent-schedule';

const noSubscription = () => () => {};

/**
 * Open calendar days for this visitor. The server HTML shows every day open,
 * so crawlers see all links; after hydration the count comes from the
 * visitor's clock.
 */
export function useOpenAdventDays() {
  return useSyncExternalStore(
    noSubscription,
    () => getOpenAdventDays(new Date()),
    () => ADVENT_DAYS
  );
}
