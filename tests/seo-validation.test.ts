import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import fg from 'fast-glob';

describe('SEO and Metadata Validation', () => {
  describe('Posts SEO', () => {
    const postsDir = path.join(process.cwd(), 'content/posts');
    const postFiles = fg.sync('*.md', { cwd: postsDir });

    postFiles.forEach((file) => {
      describe(`Post SEO: ${file}`, () => {
        const filePath = path.join(postsDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const { data } = matter(fileContent);

        it('should have SEO-friendly title length', () => {
          expect(data.title).toBeDefined();
          expect(data.title.length).toBeGreaterThan(10);
          
          // Soft check for SEO best practices
          if (data.title.length > 70) {
            console.warn(`⚠️  Title too long for SEO in ${file}: ${data.title.length} chars`);
          }
        });

        it('should have SEO-friendly excerpt length', () => {
          expect(data.excerpt).toBeDefined();
          expect(data.excerpt.length).toBeGreaterThan(50);
          
          // Soft check for SEO best practices
          if (data.excerpt.length > 160) {
            console.warn(`⚠️  Excerpt too long for SEO in ${file}: ${data.excerpt.length} chars`);
          }
        });

        it('should have at least 2 tags for better discoverability', () => {
          expect(data.tags).toBeDefined();
          expect(Array.isArray(data.tags)).toBe(true);
          expect(data.tags.length).toBeGreaterThanOrEqual(2);
        });

        it('should have a valid author', () => {
          expect(data.author).toBeDefined();
          expect(typeof data.author === 'string' || typeof data.author === 'object').toBe(true);
        });
      });
    });
  });

  describe('Guides SEO', () => {
    const guidesDir = path.join(process.cwd(), 'content/guides');
    const guideDirs = fs
      .readdirSync(guidesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    guideDirs.forEach((guideSlug) => {
      describe(`Guide SEO: ${guideSlug}`, () => {
        const indexPath = path.join(guidesDir, guideSlug, 'index.md');

        if (fs.existsSync(indexPath)) {
          const fileContent = fs.readFileSync(indexPath, 'utf-8');
          const { data } = matter(fileContent);

          it('should have SEO-friendly title length', () => {
            expect(data.title).toBeDefined();
            expect(data.title.length).toBeLessThan(70);
            expect(data.title.length).toBeGreaterThan(10);
          });

          it('should have description', () => {
            expect(data.description).toBeDefined();
            expect(data.description.length).toBeGreaterThan(20);
          });
        }
      });
    });
  });
});
