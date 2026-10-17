import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { splitAdventSolution } from '@/lib/advent-solution';
import { ADVENT_DAYS, ADVENT_YEAR, getOpenAdventDays } from '@/lib/advent-schedule';

const fenceCount = (text: string) => (text.match(/^ {0,3}(```|~~~)/gm) || []).length;

describe('splitAdventSolution', () => {
  it('returns null when there is no solution section', () => {
    expect(splitAdventSolution('## Task\n\nDo it.\n')).toBeNull();
  });

  it('hides Solution and Explanation, and keeps Result visible', () => {
    const parts = splitAdventSolution(
      '## Task\n\nA\n\n## Solution\n\nB\n\n## Explanation\n\nC\n\n## Result\n\nD\n'
    );
    expect(parts?.before).toBe('## Task\n\nA\n');
    expect(parts?.solution).toBe('## Solution\n\nB\n\n## Explanation\n\nC\n');
    expect(parts?.after).toBe('## Result\n\nD\n');
  });

  it('ignores headings inside fenced code blocks', () => {
    const content = [
      '## Solution',
      '',
      '````markdown',
      '## Links',
      '```bash',
      'echo hi',
      '```',
      '## Result',
      '````',
      '',
      '## Explanation',
      '',
      '## Links',
      '',
      '- a',
    ].join('\n');
    const parts = splitAdventSolution(content);
    expect(parts?.solution).toContain('## Explanation');
    expect(parts?.after.startsWith('## Links\n\n- a')).toBe(true);
  });
});

describe('Advent of DevOps days', () => {
  const dir = path.join(process.cwd(), 'content/advent-of-devops');
  const files = fg.sync('day-*.md', { cwd: dir });

  files.forEach((file) => {
    const { content } = matter(fs.readFileSync(path.join(dir, file), 'utf-8'));

    it(`${file} has a solution that splits outside code blocks`, () => {
      const parts = splitAdventSolution(content);
      expect(parts).not.toBeNull();
      expect(fenceCount(parts!.before) % 2).toBe(0);
      expect(fenceCount(parts!.solution) % 2).toBe(0);
      expect(parts!.after).toMatch(/^## (Result|Validation|Links|Share Your Success)/);
    });
  });
});

describe('getOpenAdventDays', () => {
  it('opens one day at a time in December of the event year', () => {
    expect(getOpenAdventDays(new Date(ADVENT_YEAR, 11, 1, 0, 5))).toBe(1);
    expect(getOpenAdventDays(new Date(ADVENT_YEAR, 11, 14, 23, 59))).toBe(14);
    expect(getOpenAdventDays(new Date(ADVENT_YEAR, 11, 31))).toBe(ADVENT_DAYS);
  });

  it('keeps every day open outside that December', () => {
    expect(getOpenAdventDays(new Date(ADVENT_YEAR, 9, 17))).toBe(ADVENT_DAYS);
    expect(getOpenAdventDays(new Date(ADVENT_YEAR - 1, 11, 3))).toBe(ADVENT_DAYS);
    expect(getOpenAdventDays(new Date(ADVENT_YEAR + 1, 11, 3))).toBe(ADVENT_DAYS);
  });
});
