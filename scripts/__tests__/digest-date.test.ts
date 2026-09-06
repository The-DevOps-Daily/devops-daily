import { describe, expect, it } from 'vitest';
import { getIsoWeekAndYear, getCurrentWeek, getCurrentYear } from '../devops-daily/utils/date';

describe('digest week numbering', () => {
  it('uses the ISO week-based year at the turn of the year', () => {
    // Monday 29 Dec 2025 is ISO week 1 of 2026, which is what `date +%V/%G`
    // in the workflow reports. The old calendar-year lookup wrote 2025/week-1.
    expect(getIsoWeekAndYear(new Date(2025, 11, 29))).toEqual({ week: 1, year: 2026 });
    expect(getIsoWeekAndYear(new Date(2026, 0, 1))).toEqual({ week: 1, year: 2026 });
  });

  it('keeps a week 53 inside its own year', () => {
    // 2026 has an ISO week 53 (28 Dec 2026 to 3 Jan 2027).
    expect(getIsoWeekAndYear(new Date(2026, 11, 28))).toEqual({ week: 53, year: 2026 });
    expect(getIsoWeekAndYear(new Date(2027, 0, 2))).toEqual({ week: 53, year: 2026 });
  });

  it('agrees with the single-value helpers for the same instant', () => {
    const d = new Date(2026, 8, 7);
    expect(getCurrentWeek(d)).toBe(37);
    expect(getCurrentYear(d)).toBe(2026);
  });
});
