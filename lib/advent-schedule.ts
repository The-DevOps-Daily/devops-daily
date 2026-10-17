export const ADVENT_YEAR = 2026;
export const ADVENT_DAYS = 25;

/**
 * How many calendar days are open at `now`, in the visitor's local time.
 * In December of ADVENT_YEAR the calendar opens one day each morning.
 * At all other times every day is open, because the content stays public.
 */
export function getOpenAdventDays(now: Date): number {
  if (now.getFullYear() === ADVENT_YEAR && now.getMonth() === 11) {
    return Math.min(now.getDate(), ADVENT_DAYS);
  }
  return ADVENT_DAYS;
}
