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

const DAY_MS = 86_400_000;

/** ISO week and week-based year of a date, read in UTC. */
export function isoWeekUtc(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  // The Thursday of the same week decides the year.
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / DAY_MS + 1) / 7);
  return { week, year };
}

/** Monday 00:00 UTC of an ISO week. */
export function isoWeekMondayUtc(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  return new Date(Date.UTC(year, 0, 4 - (day - 1)) + (week - 1) * 7 * DAY_MS);
}

/**
 * The 7 days a digest covers: [start, end). `week`/`year` name the file
 * (content/news/<year>/week-<week>.md) and `date` is its frontmatter date.
 */
export interface DigestWindow {
  start: Date;
  end: Date;
  week: number;
  year: number;
  date: string;
}

function argValue(args: string[], name: string): string | undefined {
  const index = args.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (index === -1) return undefined;
  const arg = args[index];
  return arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : args[index + 1];
}

/**
 * The digest window from the command line:
 *
 * - no option: the 7 days before Monday 00:00 UTC of the current ISO week.
 *   A run that GitHub starts hours late still covers the same days.
 * - `--week 2026-W47`: the same window for that ISO week, to rebuild a past
 *   digest.
 * - `--until 2026-11-16`: the 7 days before that date (00:00 UTC) or time.
 */
export function resolveWindow(args: string[], now: Date = new Date()): DigestWindow {
  const weekArg = argValue(args, '--week');
  const untilArg = argValue(args, '--until');
  let end: Date;

  if (weekArg !== undefined) {
    const match = weekArg.match(/^(\d{4})-?W(\d{1,2})$/i);
    if (!match) throw new Error(`--week must look like 2026-W47, got "${weekArg}"`);
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);
    end = isoWeekMondayUtc(year, week);
    if (week < 1 || isoWeekUtc(end).week !== week) {
      throw new Error(`${weekArg} is not an ISO week of ${year}`);
    }
  } else if (untilArg !== undefined) {
    end = new Date(untilArg);
    if (!/^\d{4}-\d{2}-\d{2}/.test(untilArg) || isNaN(end.getTime())) {
      throw new Error(`--until must be a date like 2026-11-16, got "${untilArg}"`);
    }
  } else {
    const { week, year } = isoWeekUtc(now);
    end = isoWeekMondayUtc(year, week);
  }

  const { week, year } = isoWeekUtc(end);
  return {
    start: new Date(end.getTime() - 7 * DAY_MS),
    end,
    week,
    year,
    date: end.toISOString().slice(0, 10),
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 12", read in UTC. */
export function shortDateUtc(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
