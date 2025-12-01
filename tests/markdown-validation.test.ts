import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import fg from 'fast-glob';

describe('Markdown Content Validation', () => {
  describe('Posts', () => {
    const postsDir = path.join(process.cwd(), 'content/posts');
    const postFiles = fg.sync('*.md', { cwd: postsDir });

    it('should have at least one post', () => {
      expect(postFiles.length).toBeGreaterThan(0);
    });

    postFiles.forEach((file) => {
      describe(`Post: ${file}`, () => {
        const filePath = path.join(postsDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const { data, content } = matter(fileContent);

        it('should have valid frontmatter', () => {
          expect(data).toBeDefined();
          expect(data.title).toBeDefined();
          expect(typeof data.title).toBe('string');
          expect(data.title.length).toBeGreaterThan(0);
        });

        it('should have required fields', () => {
          const requiredFields = [
            'title',
            'excerpt',
            'publishedAt',
            'author',
            'category',
            'tags',
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

        it('should have tags as an array', () => {
          expect(Array.isArray(data.tags)).toBe(true);
          expect(data.tags.length).toBeGreaterThan(0);
        });

        it('should have content', () => {
          expect(content).toBeDefined();
          expect(content.trim().length).toBeGreaterThan(0);
        });

        it('should have valid excerpt length', () => {
          expect(data.excerpt).toBeDefined();
          expect(data.excerpt.length).toBeGreaterThan(10);
          expect(data.excerpt.length).toBeLessThan(500);
        });
      });
    });
  });

  describe('Guides', () => {
    const guidesDir = path.join(process.cwd(), 'content/guides');
    const guideDirs = fs
      .readdirSync(guidesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    it('should have at least one guide', () => {
      expect(guideDirs.length).toBeGreaterThan(0);
    });

    guideDirs.forEach((guideSlug) => {
      describe(`Guide: ${guideSlug}`, () => {
        const guideDir = path.join(guidesDir, guideSlug);
        const indexPath = path.join(guideDir, 'index.md');

        it('should have an index.md file', () => {
          expect(fs.existsSync(indexPath)).toBe(true);
        });

        if (fs.existsSync(indexPath)) {
          const fileContent = fs.readFileSync(indexPath, 'utf-8');
          const { data, content } = matter(fileContent);

          it('should have valid frontmatter in index.md', () => {
            expect(data).toBeDefined();
            expect(data.title).toBeDefined();
            expect(typeof data.title).toBe('string');
          });

          it('should have required fields in index.md', () => {
            const requiredFields = ['title', 'description'];

            requiredFields.forEach((field) => {
              expect(data[field]).toBeDefined();
            });
          });

          it('should have at least one part markdown file', () => {
            const partFiles = fs
              .readdirSync(guideDir)
              .filter((f) => f !== 'index.md' && f.endsWith('.md'));
            expect(partFiles.length).toBeGreaterThan(0);
          });

          it('should have content in index.md', () => {
            expect(content).toBeDefined();
            expect(content.trim().length).toBeGreaterThan(0);
          });
        }
      });
    });
  });

  describe('Advent of DevOps', () => {
    const adventDir = path.join(process.cwd(), 'content/advent-of-devops');
    const adventFiles = fg.sync('day-*.md', { cwd: adventDir });

    it('should have 25 advent days', () => {
      expect(adventFiles.length).toBe(25);
    });

    adventFiles.forEach((file) => {
      describe(`Advent: ${file}`, () => {
        const filePath = path.join(adventDir, file);
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
            'day',
            'excerpt',
            'description',
            'publishedAt',
            'difficulty',
            'category',
            'tags',
          ];

          requiredFields.forEach((field) => {
            expect(data[field]).toBeDefined();
          });
        });

        it('should have valid day number', () => {
          expect(data.day).toBeDefined();
          expect(typeof data.day).toBe('number');
          expect(data.day).toBeGreaterThanOrEqual(1);
          expect(data.day).toBeLessThanOrEqual(25);
        });

        it('should have content', () => {
          expect(content).toBeDefined();
          expect(content.trim().length).toBeGreaterThan(0);
        });
      });
    });
  });
});
