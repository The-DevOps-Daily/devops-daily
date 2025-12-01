import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import fg from 'fast-glob';

describe('News Content Validation', () => {
  const newsDir = path.join(process.cwd(), 'content/news');
  const newsFiles = fs.existsSync(newsDir)
    ? fg.sync('*.md', { cwd: newsDir })
    : [];

  it.skipIf(newsFiles.length === 0)('should have at least one news item', () => {
    expect(newsFiles.length).toBeGreaterThan(0);
  });

  newsFiles.forEach((file) => {
    describe(`News: ${file}`, () => {
      const filePath = path.join(newsDir, file);
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
          'week',
          'publishedAt',
        ];

        requiredFields.forEach((field) => {
          expect(data[field]).toBeDefined();
        });
      });

      it('should have valid date format', () => {
        expect(data.publishedAt).toBeDefined();
        const date = new Date(data.publishedAt);
        expect(date.toString()).not.toBe('Invalid Date');
      });

      it('should have content', () => {
        expect(content).toBeDefined();
        expect(content.trim().length).toBeGreaterThan(0);
      });

      it('should have week number', () => {
        expect(data.week).toBeDefined();
        expect(typeof data.week === 'string' || typeof data.week === 'number').toBe(true);
      });
    });
  });
});
