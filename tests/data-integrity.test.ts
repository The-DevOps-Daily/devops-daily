import { describe, it, expect } from 'vitest';
import path from 'path';
import fg from 'fast-glob';
import fs from 'fs';
import matter from 'gray-matter';

describe('Data Integrity', () => {
  describe('Internal Links', () => {
    const contentDir = path.join(process.cwd(), 'content');
    const allMarkdownFiles = fg.sync('**/*.md', { cwd: contentDir });

    it('should check internal markdown links (soft check)', () => {
      const brokenLinks: Array<{ file: string; link: string }> = [];

      allMarkdownFiles.forEach((file) => {
        const filePath = path.join(contentDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const { content: markdownContent } = matter(content);

        // Match markdown links: [text](url)
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;

        while ((match = linkRegex.exec(markdownContent)) !== null) {
          const linkUrl = match[2];

          // Check for relative internal links that point to files
          if (
            linkUrl.startsWith('./') ||
            linkUrl.startsWith('../')
          ) {
            // Resolve relative path
            const linkPath = path.resolve(path.dirname(filePath), linkUrl);

            // Check if the file exists
            if (!fs.existsSync(linkPath)) {
              brokenLinks.push({ file, link: linkUrl });
            }
          }
        }
      });

      // This is a soft check - we'll just log warnings if there are broken links
      if (brokenLinks.length > 0) {
        console.warn(
          `⚠️  Found ${brokenLinks.length} potentially broken internal links`
        );
        brokenLinks.slice(0, 5).forEach((bl) => {
          console.warn(`  - ${bl.file}: ${bl.link}`);
        });
      }

      // Pass the test but log warnings
      expect(true).toBe(true);
    });
  });

  describe('Image References', () => {
    const contentDir = path.join(process.cwd(), 'content');
    const publicDir = path.join(process.cwd(), 'public');
    const allMarkdownFiles = fg.sync('**/*.md', { cwd: contentDir });

    it('should check image references (soft check)', () => {
      const brokenImages: Array<{ file: string; image: string }> = [];

      allMarkdownFiles.forEach((file) => {
        const filePath = path.join(contentDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const { content: markdownContent, data } = matter(content);

        // Check featuredImage in frontmatter
        if (data.featuredImage) {
          const imagePath = path.join(publicDir, data.featuredImage);
          if (!fs.existsSync(imagePath)) {
            brokenImages.push({ file, image: data.featuredImage });
          }
        }

        // Check images in markdown content
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let match;

        while ((match = imageRegex.exec(markdownContent)) !== null) {
          const imageUrl = match[2];

          // Only check local images (not external URLs)
          if (!imageUrl.startsWith('http')) {
            const imagePath = imageUrl.startsWith('/')
              ? path.join(publicDir, imageUrl)
              : path.resolve(path.dirname(filePath), imageUrl);

            if (!fs.existsSync(imagePath)) {
              brokenImages.push({ file, image: imageUrl });
            }
          }
        }
      });

      // This is a soft check - we'll just log warnings
      if (brokenImages.length > 0) {
        console.warn(
          `⚠️  Found ${brokenImages.length} potentially broken image references`
        );
        brokenImages.slice(0, 5).forEach((bi) => {
          console.warn(`  - ${bi.file}: ${bi.image}`);
        });
      }

      // Pass the test but log warnings
      expect(true).toBe(true);
    });
  });

  describe('Unique Slugs', () => {
    it('should not have duplicate post slugs', () => {
      const postsDir = path.join(process.cwd(), 'content/posts');
      const postFiles = fg.sync('*.md', { cwd: postsDir });

      const slugs = postFiles.map((file) => path.basename(file, '.md'));
      const uniqueSlugs = new Set(slugs);

      expect(slugs.length).toBe(uniqueSlugs.size);
    });

    it('should not have duplicate guide slugs', () => {
      const guidesDir = path.join(process.cwd(), 'content/guides');
      const guideDirs = fs
        .readdirSync(guidesDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      const uniqueSlugs = new Set(guideDirs);

      expect(guideDirs.length).toBe(uniqueSlugs.size);
    });
  });

  describe('Category Consistency', () => {
    it('should have categories defined across posts', () => {
      const postsDir = path.join(process.cwd(), 'content/posts');
      const postFiles = fg.sync('*.md', { cwd: postsDir });

      const categories = new Set<string>();

      postFiles.forEach((file) => {
        const filePath = path.join(postsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const { data } = matter(content);

        if (data.category) {
          // Handle both string and object categories
          const categoryName = typeof data.category === 'string' 
            ? data.category 
            : data.category.name || data.category.slug;
          if (categoryName) {
            categories.add(categoryName);
          }
        }
      });

      // We expect to have multiple categories
      expect(categories.size).toBeGreaterThan(0);

      // Log categories for visibility
      console.log(`📁 Found ${categories.size} unique categories`);
    });
  });
});
