import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { Challenge } from '../lib/challenge-types';
import { passedLabel } from '../components/challenges/passed-by';

const root = process.cwd();
const dir = path.join(root, 'content', 'challenges');
const files = fs.readdirSync(dir).filter((file) => file.endsWith('.json'));
const challenges = files.map((file) => ({
  file,
  data: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as Challenge,
}));

function allText(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(allText);
  if (value && typeof value === 'object') return Object.values(value).flatMap(allText);
  return [];
}

describe('challenges content', () => {
  it('has challenges', () => {
    expect(challenges.length).toBeGreaterThan(0);
  });

  for (const { file, data } of challenges) {
    describe(file, () => {
      it('uses the file name as id and slug', () => {
        expect(data.id).toBe(file.replace(/\.json$/, ''));
        expect(data.slug).toBe(data.id);
      });

      it('has a meta description of 155 characters or less', () => {
        expect(data.description.length).toBeGreaterThan(50);
        expect(data.description.length).toBeLessThanOrEqual(155);
      });

      it('has a known level, a time and the brief sections', () => {
        expect(['starter', 'intermediate', 'advanced']).toContain(data.difficulty);
        expect(data.minutes).toBeGreaterThan(0);
        expect(data.situation.length).toBeGreaterThan(0);
        expect(data.task.length).toBeGreaterThan(0);
        expect(data.hints.length).toBeGreaterThan(0);
        expect(data.localTest.commands.trim()).not.toBe('');
      });

      it('lists checks with unique ids', () => {
        const ids = data.checks.map((check) => check.id);
        expect(ids.length).toBeGreaterThan(0);
        expect(new Set(ids).size).toBe(ids.length);
        for (const check of data.checks) {
          expect(check.name).not.toBe('');
          expect(check.description).not.toBe('');
        }
      });

      it('only lists solution files inside its own folder', () => {
        for (const file of data.solutionFiles) {
          expect(file.startsWith(`challenges/${data.id}/`)).toBe(true);
        }
      });

      it('links only to exercises and guides that exist', () => {
        for (const id of data.related?.exercises ?? []) {
          expect(fs.existsSync(path.join(root, 'content', 'exercises', `${id}.json`)), id).toBe(
            true
          );
        }
        for (const slug of data.related?.guides ?? []) {
          expect(fs.existsSync(path.join(root, 'content', 'guides', slug, 'index.md')), slug).toBe(
            true
          );
        }
      });

      it('has a share image', () => {
        expect(
          fs.existsSync(path.join(root, 'public', 'images', 'challenges', `${data.id}-og.jpg`))
        ).toBe(true);
      });

      it('uses no em dashes', () => {
        for (const text of allText(data)) {
          expect(text).not.toContain('—');
        }
      });
    });
  }
});

describe('passedLabel', () => {
  it('words the count', () => {
    expect(passedLabel(0)).toBe('No passes yet');
    expect(passedLabel(1)).toBe('Passed by 1 person');
    expect(passedLabel(1234)).toBe('Passed by 1,234 people');
  });
});
