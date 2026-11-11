import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { CONTENT_COVER_TYPES, type ContentCoverType } from '../scripts/og-utils';

// Every cover is the JPEG made by scripts/generate-content-og.ts. A PNG in one
// of these directories was made another way, usually with the old dark
// template that was removed in Nov 2026.
const COVER_DIRECTORIES: Record<ContentCoverType, string> = {
  post: 'posts',
  guide: 'guides',
  exercise: 'exercises',
  news: 'news',
  advent: 'advent',
  quiz: 'quizzes',
  game: 'games',
  checklist: 'checklists',
  interview: 'interview-questions',
  comparison: 'comparisons',
  flashcard: 'flashcards',
  tool: 'tools',
  challenge: 'challenges',
};

// Legacy PNGs that must stay, as 'directory/file.png': 'reason'. Keep this
// empty or very short. To fix a failure, delete the PNG and generate the cover;
// do not add it here.
const ALLOWED_PNGS: Record<string, string> = {};

const FIX =
  'Covers must be JPEG from scripts/generate-content-og.ts. Delete the PNG and run: ' +
  'npx tsx scripts/generate-content-og.ts --only=<type>/<slug>';

describe('content covers', () => {
  it('checks a directory for every cover type', () => {
    expect(Object.keys(COVER_DIRECTORIES).sort()).toEqual([...CONTENT_COVER_TYPES].sort());
  });

  it('has no PNG covers', () => {
    const pngs = Object.values(COVER_DIRECTORIES).flatMap((directory) => {
      const absolute = path.join(process.cwd(), 'public', 'images', directory);
      if (!fs.existsSync(absolute)) return [];
      return fs
        .readdirSync(absolute, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
        .map((entry) => `${directory}/${entry.name}`);
    });

    expect(
      pngs.filter((file) => !(file in ALLOWED_PNGS)),
      FIX
    ).toEqual([]);
  });
});
