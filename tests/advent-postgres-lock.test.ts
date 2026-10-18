import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPostgresAdventDays, openAtBuild, summarize } from '@/lib/advent-postgres';

const day = { publishedAt: '2026-12-05T00:00:00Z' };
const at = (iso: string) => Date.parse(iso);

describe('Advent of Postgres build-time lock', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('opens a day 20 minutes before 00:00 UTC on its date, not earlier', () => {
    vi.stubEnv('CF_PAGES_BRANCH', 'main');
    vi.stubEnv('ADVENT_PREVIEW', '');
    expect(openAtBuild(day, at('2026-12-04T23:39:00Z'))).toBe(false);
    expect(openAtBuild(day, at('2026-12-04T23:40:00Z'))).toBe(true);
    expect(openAtBuild(day, at('2026-12-06T10:00:00Z'))).toBe(true);
  });

  it('opens every day on preview builds of other branches', () => {
    vi.stubEnv('CF_PAGES_BRANCH', 'feat-advent');
    expect(openAtBuild(day, at('2026-10-18T12:00:00Z'))).toBe(true);
  });

  it('keeps the puzzle, hint and answer out of a locked day', async () => {
    vi.stubEnv('CF_PAGES_BRANCH', 'main');
    vi.stubEnv('ADVENT_PREVIEW', '');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
    try {
      const [first] = await getPostgresAdventDays();
      const locked = summarize(first);
      expect(locked).toEqual({
        title: `Day ${first.day}`,
        slug: first.slug,
        day: first.day,
        schema: '',
        answerHash: '',
        publishedAt: first.publishedAt,
        locked: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
