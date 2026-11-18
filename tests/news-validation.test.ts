import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import matter from '../lib/front-matter';
import fg from 'fast-glob';

/**
 * This suite had never run. It globbed `*.md` at the top of content/news,
 * but every digest lives in a year directory, so the glob matched nothing
 * and `skipIf` skipped the whole file. It reported green for 41 files it
 * had never opened.
 *
 * It also required `week` and `publishedAt`, which no digest has ever had.
 * The real frontmatter is title, date and summary, so the assertions below
 * are the ones that describe the content we actually publish.
 */
describe('News Content Validation', () => {
  const newsDir = path.join(process.cwd(), 'content/news');
  // Recursive: the digests are in content/news/<year>/week-NN.md.
  const newsFiles = fg.sync('**/*.md', { cwd: newsDir });

  it('finds the digests on disk', () => {
    // Deliberately not skipIf. An empty result means the glob is wrong
    // again, and silence is how this went unnoticed for months.
    expect(newsFiles.length).toBeGreaterThan(0);
  });

  newsFiles.forEach((file) => {
    describe(`News: ${file}`, () => {
      const filePath = path.join(newsDir, file);
      const { data, content } = matter(fs.readFileSync(filePath, 'utf-8'));

      it('has a title', () => {
        expect(typeof data.title).toBe('string');
        expect(data.title.trim().length).toBeGreaterThan(0);
      });

      it('has a valid date', () => {
        expect(data.date).toBeDefined();
        expect(Number.isNaN(new Date(data.date).getTime())).toBe(false);
      });

      it('has a summary', () => {
        expect(typeof data.summary).toBe('string');
        expect(data.summary.trim().length).toBeGreaterThan(0);
      });

      it('has body content', () => {
        expect(content.trim().length).toBeGreaterThan(0);
      });

      it('links every source with an absolute URL', () => {
        // Outside sources must be absolute. Our own internal links (/news,
        // /feed.xml, /posts/<slug> in "From DevOps Daily this week") are
        // relative on purpose; a /posts/ link must name a post that exists.
        //
        // A feed that publishes relative links put one of these in the week
        // 33 digest as `/2026/08/05/...`. The link checker read it as a
        // broken internal link, which is what it was, and the build failed
        // on main for every open PR until it was fixed.
        const links = [...content.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
        const internal = /^\/(news|feed\.xml)$|^\/posts\/[a-z0-9-]+$/;
        const bad = links.filter((url) => !/^https?:\/\//.test(url) && !internal.test(url));
        expect(bad, `non-absolute source links in ${file}`).toEqual([]);
        const missingPosts = links
          .filter((url) => url.startsWith('/posts/'))
          .filter((url) => !fs.existsSync(path.join(process.cwd(), 'content', `${url}.md`)));
        expect(missingPosts, `links to missing posts in ${file}`).toEqual([]);
      });

      it('keeps the summary short enough for a meta description', () => {
        expect(data.summary.length).toBeLessThanOrEqual(160);
      });
    });
  });
});
