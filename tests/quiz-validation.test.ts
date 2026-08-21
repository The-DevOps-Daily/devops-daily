import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';

/**
 * This suite had never run either. It globbed `*.md` and parsed frontmatter
 * with gray-matter, but quizzes are JSON files. The glob matched nothing, so
 * `skipIf` skipped everything and 44 quizzes went unchecked.
 *
 * The assertions were written against an imagined shape too: a top-level
 * `difficulty`, which lives on each question instead, and `question.question`,
 * which is actually `question.title`.
 */

interface QuizQuestion {
  id?: string;
  title?: string;
  options?: unknown[];
  correctAnswer?: unknown;
  explanation?: string;
}

interface Quiz {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  questions?: QuizQuestion[];
}

describe('Quiz Content Validation', () => {
  const quizzesDir = path.join(process.cwd(), 'content/quizzes');
  const quizFiles = fg.sync('*.json', { cwd: quizzesDir });

  it('finds the quizzes on disk', () => {
    // Not skipIf. An empty result is the bug, not a reason to pass.
    expect(quizFiles.length).toBeGreaterThan(0);
  });

  quizFiles.forEach((file) => {
    describe(`Quiz: ${file}`, () => {
      const raw = fs.readFileSync(path.join(quizzesDir, file), 'utf-8');

      it('is parseable JSON', () => {
        expect(() => JSON.parse(raw) as Quiz).not.toThrow();
      });

      const quiz = JSON.parse(raw) as Quiz;

      it('has the fields the quiz pages read', () => {
        for (const field of ['id', 'title', 'description', 'category'] as const) {
          expect(quiz[field], `${file} is missing ${field}`).toBeDefined();
        }
      });

      it('has at least one question', () => {
        expect(Array.isArray(quiz.questions)).toBe(true);
        expect(quiz.questions!.length).toBeGreaterThan(0);
      });

      it('has a usable shape for every question', () => {
        quiz.questions!.forEach((q, i) => {
          const where = `${file} question ${i + 1}`;
          expect(typeof q.title, `${where} title`).toBe('string');
          expect(Array.isArray(q.options), `${where} options`).toBe(true);
          // Fewer than two options is not a question.
          expect(q.options!.length, `${where} option count`).toBeGreaterThanOrEqual(2);
        });
      });

      it('points correctAnswer at an option that exists', () => {
        // The failure this catches is a question edited to remove an option
        // without moving the index, which silently marks the wrong answer
        // correct or crashes the page.
        quiz.questions!.forEach((q, i) => {
          const where = `${file} question ${i + 1}`;
          expect(typeof q.correctAnswer, `${where} correctAnswer type`).toBe('number');
          const idx = q.correctAnswer as number;
          expect(Number.isInteger(idx), `${where} correctAnswer is an integer`).toBe(true);
          expect(idx, `${where} correctAnswer lower bound`).toBeGreaterThanOrEqual(0);
          expect(idx, `${where} correctAnswer upper bound`).toBeLessThan(q.options!.length);
        });
      });

      it('has unique question ids, where ids are used', () => {
        const ids = quiz.questions!.map((q) => q.id).filter(Boolean);
        if (ids.length > 0) {
          expect(new Set(ids).size, `${file} duplicate question ids`).toBe(ids.length);
        }
      });
    });
  });
});
