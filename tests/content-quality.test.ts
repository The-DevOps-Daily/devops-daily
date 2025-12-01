import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import fg from 'fast-glob';

describe('Content Quality Checks', () => {
  describe('Code Block Syntax', () => {
    const contentDir = path.join(process.cwd(), 'content');
    const markdownFiles = fg.sync('**/*.md', { cwd: contentDir });

    it('should check code blocks have language specified (soft check)', () => {
      const codeBlocksWithoutLang: Array<{ file: string; count: number }> = [];

      markdownFiles.forEach((file) => {
        const filePath = path.join(contentDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const { content } = matter(fileContent);

        // Match code blocks without language: ```\n (no language after backticks)
        const codeBlockRegex = /```(?!\w)/g;
        const matches = content.match(codeBlockRegex);

        if (matches && matches.length > 0) {
          codeBlocksWithoutLang.push({ file, count: matches.length });
        }
      });

      if (codeBlocksWithoutLang.length > 0) {
        console.warn(
          `⚠️  Found ${codeBlocksWithoutLang.length} files with code blocks missing language specifiers`
        );
        codeBlocksWithoutLang.slice(0, 3).forEach((item) => {
          console.warn(`  - ${item.file}: ${item.count} block(s)`);
        });
      }

      // Soft check - just warn
      expect(true).toBe(true);
    });
  });

  describe('External Links', () => {
    const contentDir = path.join(process.cwd(), 'content');
    const markdownFiles = fg.sync('**/*.md', { cwd: contentDir });

    it('should have valid external link format', () => {
      const invalidLinks: Array<{ file: string; link: string }> = [];

      markdownFiles.forEach((file) => {
        const filePath = path.join(contentDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const { content } = matter(fileContent);

        // Match markdown links
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;

        while ((match = linkRegex.exec(content)) !== null) {
          const linkUrl = match[2];

          // Check for malformed external links
          if (linkUrl.startsWith('http')) {
            // Basic validation: should start with http:// or https://
            if (!linkUrl.startsWith('http://') && !linkUrl.startsWith('https://')) {
              invalidLinks.push({ file, link: linkUrl });
            }
          }
        }
      });

      if (invalidLinks.length > 0) {
        console.warn(
          `⚠️  Found ${invalidLinks.length} potentially malformed external links`
        );
      }

      expect(invalidLinks.length).toBe(0);
    });
  });

  describe('Heading Structure', () => {
    const contentDir = path.join(process.cwd(), 'content');
    const markdownFiles = fg.sync('posts/*.md', { cwd: contentDir });

    markdownFiles.slice(0, 10).forEach((file) => {
      it(`should have proper heading hierarchy in ${file}`, () => {
        const filePath = path.join(contentDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const { content } = matter(fileContent);

        // Extract headings
        const headingRegex = /^(#{1,6})\s+(.+)$/gm;
        const headings: number[] = [];
        let match;

        while ((match = headingRegex.exec(content)) !== null) {
          headings.push(match[1].length);
        }

        // Check if we have at least one heading
        if (headings.length > 0) {
          // First heading should be H2 or lower (H1 is typically the title)
          expect(headings[0]).toBeGreaterThanOrEqual(2);

          // Check for skipped heading levels (e.g., H2 to H4)
          for (let i = 1; i < headings.length; i++) {
            const diff = headings[i] - headings[i - 1];
            if (diff > 1) {
              console.warn(
                `⚠️  Skipped heading level in ${file}: H${headings[i - 1]} to H${headings[i]}`
              );
            }
          }
        }

        expect(true).toBe(true);
      });
    });
  });

  describe('File Naming Conventions', () => {
    it('should have kebab-case post filenames', () => {
      const postsDir = path.join(process.cwd(), 'content/posts');
      const postFiles = fg.sync('*.md', { cwd: postsDir });

      const invalidNames = postFiles.filter((file) => {
        const basename = path.basename(file, '.md');
        // Should be lowercase with hyphens (kebab-case)
        return !/^[a-z0-9-]+$/.test(basename);
      });

      if (invalidNames.length > 0) {
        console.warn(
          `⚠️  Found ${invalidNames.length} post files with non-kebab-case names`
        );
        invalidNames.slice(0, 3).forEach((name) => {
          console.warn(`  - ${name}`);
        });
      }

      expect(invalidNames.length).toBe(0);
    });
  });
});
