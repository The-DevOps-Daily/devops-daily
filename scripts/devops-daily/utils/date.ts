import { format, getISOWeek, getISOWeekYear, isAfter, isBefore, subDays } from 'date-fns';

/**
 * ISO week number and week-based year for a date, taken from the same
 * instant so a year-end run never pairs week 1 with the old year. Matches
 * the `date +%V` / `date +%G` pair the digest workflow uses.
 */
export function getIsoWeekAndYear(date: Date = new Date()): { week: number; year: number } {
  return { week: getISOWeek(date), year: getISOWeekYear(date) };
}

/**
 * Get the current ISO week number
 */
export function getCurrentWeek(date: Date = new Date()): number {
  return getIsoWeekAndYear(date).week;
}

/**
 * Get the current ISO week-based year
 */
export function getCurrentYear(date: Date = new Date()): number {
  return getIsoWeekAndYear(date).year;
}

/**
 * Format a date as ISO string (YYYY-MM-DD)
 */
export function formatISODate(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Check if a date is within the last N days
 */
export function isWithinLastDays(date: Date | string, days: number = 7): boolean {
  const compareDate = typeof date === 'string' ? new Date(date) : date;
  const threshold = subDays(new Date(), days);
  return isAfter(compareDate, threshold);
}

/**
 * Parse various date formats to Date object
 */
export function parseDate(dateString: string): Date {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date string: ${dateString}`);
    return new Date();
  }
  return date;
}

/**
 * Get formatted date for display (e.g., "Nov 16, 2025")
 */
export function formatDisplayDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseDate(date) : date;
  return format(d, 'MMM d, yyyy');
}

/**
 * Generate a branch name for the news digest
 */
export function generateBranchName(year?: number, week?: number): string {
  const now = getIsoWeekAndYear();
  const y = year || now.year;
  const w = week || now.week;
  return `news-${y}-w${w}`;
}
