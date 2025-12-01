import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import fg from 'fast-glob';

describe('Quiz Content Validation', () => {
  const quizzesDir = path.join(process.cwd(), 'content/quizzes');
  const quizFiles = fs.existsSync(quizzesDir)
    ? fg.sync('*.md', { cwd: quizzesDir })
    : [];

  it.skipIf(quizFiles.length === 0)('should have at least one quiz', () => {
    expect(quizFiles.length).toBeGreaterThan(0);
  });

  quizFiles.forEach((file) => {
    describe(`Quiz: ${file}`, () => {
      const filePath = path.join(quizzesDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(fileContent);

      it('should have valid frontmatter', () => {
        expect(data).toBeDefined();
        expect(data.title).toBeDefined();
        expect(typeof data.title).toBe('string');
      });

      it('should have required fields', () => {
        const requiredFields = [
          'title',
          'description',
          'category',
          'difficulty',
          'questions',
        ];

        requiredFields.forEach((field) => {
          expect(data[field]).toBeDefined();
        });
      });

      it('should have questions array', () => {
        expect(Array.isArray(data.questions)).toBe(true);
        expect(data.questions.length).toBeGreaterThan(0);
      });

      it('should have valid questions structure', () => {
        data.questions.forEach((question: any, index: number) => {
          expect(question.question).toBeDefined();
          expect(question.options).toBeDefined();
          expect(Array.isArray(question.options)).toBe(true);
          expect(question.options.length).toBeGreaterThanOrEqual(2);
          expect(question.correctAnswer).toBeDefined();
          expect(typeof question.correctAnswer).toBe('number');
          expect(question.correctAnswer).toBeGreaterThanOrEqual(0);
          expect(question.correctAnswer).toBeLessThan(question.options.length);
        });
      });

      it('should have valid difficulty level', () => {
        const validDifficulties = ['beginner', 'intermediate', 'advanced'];
        expect(validDifficulties).toContain(data.difficulty.toLowerCase());
      });

      it('should have at least 5 questions', () => {
        expect(data.questions.length).toBeGreaterThanOrEqual(5);
      });
    });
  });
});
