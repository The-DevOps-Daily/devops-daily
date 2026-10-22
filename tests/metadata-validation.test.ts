import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import matter from '../lib/front-matter';
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
      expect(fs.existsSync(path.join(publicDir, 'icon.svg'))).toBe(true);
    });

    it('should have every manifest icon at its declared size', () => {
      const publicDir = path.join(process.cwd(), 'public');
      const manifest = JSON.parse(
        fs.readFileSync(path.join(publicDir, 'site.webmanifest'), 'utf-8')
      );
      const icons: { src: string; sizes: string }[] = [
        ...manifest.icons,
        ...manifest.shortcuts.flatMap((shortcut: { icons?: unknown[] }) => shortcut.icons ?? []),
      ];

      for (const icon of icons) {
        const file = path.join(publicDir, icon.src);
        expect(fs.existsSync(file), icon.src).toBe(true);
        // A PNG stores its width and height at bytes 16-23, in the IHDR chunk.
        const png = fs.readFileSync(file);
        expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.src).toBe(icon.sizes);
      }
    });

    it('should have OpenGraph image', () => {
      const ogImagePath = path.join(process.cwd(), 'public/og-image.png');
      expect(fs.existsSync(ogImagePath)).toBe(true);
    });
  });
});
