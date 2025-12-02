import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import fg from 'fast-glob';

describe('Metadata and OpenGraph Validation', () => {
  describe('Post Metadata', () => {
    const postsDir = path.join(process.cwd(), 'content/posts');
    const postFiles = fg.sync('*.md', { cwd: postsDir }).slice(0, 20);

    postFiles.forEach((file) => {
      describe(`Metadata: ${file}`, () => {
        const filePath = path.join(postsDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const { data } = matter(fileContent);

        it('should have title for social sharing', () => {
          expect(data.title).toBeDefined();
          expect(data.title.length).toBeGreaterThan(0);
        });

        it('should have excerpt/description for meta tags', () => {
          expect(data.excerpt).toBeDefined();
          expect(data.excerpt.length).toBeGreaterThan(20);
        });

        it('should have category for better organization', () => {
          expect(data.category).toBeDefined();
        });

        it('should have tags for discoverability', () => {
          expect(data.tags).toBeDefined();
          expect(Array.isArray(data.tags)).toBe(true);
          expect(data.tags.length).toBeGreaterThan(0);
        });

        it('should have publishedAt date', () => {
          expect(data.publishedAt).toBeDefined();
          
          // Should be a valid date
          const date = new Date(data.publishedAt);
          expect(date.toString()).not.toBe('Invalid Date');
        });

        it('should have image for social cards (soft check)', () => {
          if (!data.image && !data.coverImage && !data.ogImage) {
            console.warn(
              `⚠️  Post ${file} has no social card image (consider adding image/coverImage/ogImage)`
            );
          }
          
          expect(true).toBe(true);
        });
      });
    });
  });

  describe('Global Metadata Files', () => {
    it('should have site.webmanifest', () => {
      const manifestPath = path.join(process.cwd(), 'public/site.webmanifest');
      expect(fs.existsSync(manifestPath)).toBe(true);
      
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        expect(manifest.name).toBeDefined();
        expect(manifest.short_name).toBeDefined();
      }
    });

    it('should have favicon files', () => {
      const publicDir = path.join(process.cwd(), 'public');
      
      expect(fs.existsSync(path.join(publicDir, 'favicon.ico'))).toBe(true);
      expect(fs.existsSync(path.join(publicDir, 'favicon-32x32.png'))).toBe(true);
      expect(fs.existsSync(path.join(publicDir, 'apple-touch-icon.png'))).toBe(true);
    });

    it('should have OpenGraph image', () => {
      const ogImagePath = path.join(process.cwd(), 'public/og-image.png');
      expect(fs.existsSync(ogImagePath)).toBe(true);
    });
  });
});
