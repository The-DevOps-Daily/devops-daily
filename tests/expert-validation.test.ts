import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import fg from 'fast-glob';

describe('Expert Validation', () => {
  const expertsDir = path.join(process.cwd(), 'content/experts');

  describe('Expert Files', () => {
    const expertFiles = fg.sync('*.md', { cwd: expertsDir });

    it('should have at least one expert', () => {
      expect(expertFiles.length).toBeGreaterThan(0);
    });

    expertFiles.forEach((file) => {
      describe(`Expert: ${file}`, () => {
        const filePath = path.join(expertsDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const { data, content } = matter(fileContent);

        it('should have valid frontmatter', () => {
          expect(data).toBeDefined();
          expect(typeof data).toBe('object');
        });

        it('should have required fields', () => {
          expect(data.name).toBeDefined();
          expect(data.name.length).toBeGreaterThan(0);
          expect(data.slug).toBeDefined();
          expect(data.slug.length).toBeGreaterThan(0);
        });

        it('should have a valid slug format', () => {
          expect(data.slug).toMatch(/^[a-z0-9-]+$/);
        });

        it('should have a bio or description', () => {
          const hasBio = (data.bio && data.bio.length > 0) || content.trim().length > 0;
          expect(hasBio).toBe(true);
        });

        it('should have specialties as an array', () => {
          if (data.specialties) {
            expect(Array.isArray(data.specialties)).toBe(true);
            expect(data.specialties.length).toBeGreaterThan(0);
          }
        });

        it('should have valid email format if provided', () => {
          if (data.email) {
            expect(data.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
          }
        });

        it('should have contact information', () => {
          const hasContact = data.email || data.website || data.linkedin || data.github;
          expect(!!hasContact).toBe(true);
        });

        it('should have content describing services', () => {
          expect(content.trim().length).toBeGreaterThan(0);
        });

        it('should have valid showPosts field if provided', () => {
          if (data.showPosts !== undefined) {
            expect(typeof data.showPosts).toBe('boolean');
          }
        });
      });
    });
  });

  describe('Expert Slug Uniqueness', () => {
    const expertFiles = fg.sync('*.md', { cwd: expertsDir });

    it('should have unique slugs across all experts', () => {
      const slugs = expertFiles.map((file) => {
        const filePath = path.join(expertsDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const { data } = matter(fileContent);
        return data.slug;
      });

      const uniqueSlugs = new Set(slugs);
      expect(slugs.length).toBe(uniqueSlugs.size);
    });
  });
});
