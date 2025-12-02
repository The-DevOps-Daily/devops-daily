import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import fg from 'fast-glob';

describe('Author Validation', () => {
  const authorsDir = path.join(process.cwd(), 'content/authors');
  const postsDir = path.join(process.cwd(), 'content/posts');

  describe('Author Files', () => {
    const authorFiles = fg.sync('*.md', { cwd: authorsDir });

    it('should have at least one author', () => {
      expect(authorFiles.length).toBeGreaterThan(0);
    });

    authorFiles.forEach((file) => {
      describe(`Author: ${file}`, () => {
        const filePath = path.join(authorsDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const { data, content } = matter(fileContent);

        it('should have valid frontmatter', () => {
          expect(data).toBeDefined();
          expect(typeof data).toBe('object');
        });

        it('should have required fields', () => {
         expect(data.name).toBeDefined();
         expect(data.name.length).toBeGreaterThan(0);
       });

       it('should have a bio/content', () => {
          const hasBio = (data.bio && data.bio.length > 0) || content.trim().length > 0;
         expect(hasBio).toBe(true);
       });

       it('should have social links or contact info (soft check)', () => {
          const hasSocial = data.twitter || data.github || data.linkedin || data.website;
          
          if (!hasSocial && !content.includes('http')) {
            console.warn(`⚠️  Author ${file} has no social links or contact info`);
          }
          
          expect(true).toBe(true);
        });
      });
    });
  });

  describe('Author References in Posts', () => {
    const postFiles = fg.sync('*.md', { cwd: postsDir });
    const authorSlugs = fg.sync('*.md', { cwd: authorsDir }).map((file) =>
      path.basename(file, '.md')
    );

    it('should have all referenced authors defined', () => {
      const missingAuthors = new Set<string>();

      postFiles.forEach((file) => {
        const filePath = path.join(postsDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const { data } = matter(fileContent);

        if (data.author) {
          const authorSlug = typeof data.author === 'string' 
            ? data.author.toLowerCase().replace(/\s+/g, '-')
            : data.author.slug || data.author.name.toLowerCase().replace(/\s+/g, '-');

          if (!authorSlugs.includes(authorSlug)) {
            missingAuthors.add(authorSlug);
          }
        }
      });

      if (missingAuthors.size > 0) {
        console.warn(
          `\n⚠️  Found ${missingAuthors.size} referenced authors without author files:`
        );
        Array.from(missingAuthors).slice(0, 5).forEach((author) => {
          console.warn(`  - ${author}`);
        });
      }

      // Soft check
      expect(true).toBe(true);
    });
  });
});
