import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * The section sitemaps are what Search Console measures per content type, so a
 * broken one is worse than none: it hands Google a list of 404s and the
 * indexing numbers we are trying to read become meaningless.
 *
 * These caught three real bugs when the generator was written. Games,
 * flashcards and exercises key on `id` rather than `slug`, interview questions
 * carry `tier` rather than `level`, and the topic route is singular. All three
 * produced URLs that looked fine in aggregate and 404'd individually.
 */

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const SITE = 'https://devops-daily.com';
const SECTIONS = [
  'sitemap-posts.xml',
  'sitemap-guides.xml',
  'sitemap-games.xml',
  'sitemap-exercises.xml',
  'sitemap-quizzes.xml',
  'sitemap-flashcards.xml',
  'sitemap-checklists.xml',
  'sitemap-interview-questions.xml',
  'sitemap-comparisons.xml',
  'sitemap-news.xml',
  'sitemap-newsletters.xml',
  'sitemap-advent-of-devops.xml',
  'sitemap-hacktoberfest.xml',
  'sitemap-categories.xml',
  'sitemap-tools.xml',
];

function read(file: string): string {
  return fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf-8');
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

describe('section sitemaps', () => {
  // The files are build artefacts and are not committed, so generate them
  // first. This also means the test exercises the generator itself rather than
  // a snapshot of its output, which is the point.
  beforeAll(() => {
    execFileSync('npx', ['tsx', 'scripts/generate-section-sitemaps.ts'], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });
  }, 120_000);

  it.each(SECTIONS)('%s exists and is a well-formed urlset', (file) => {
    const xml = read(file);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
    // Every opening tag needs its closing partner, or crawlers reject the file.
    expect((xml.match(/<url>/g) ?? []).length).toBe((xml.match(/<\/url>/g) ?? []).length);
  });

  it.each(SECTIONS)('%s has URLs and none of them are malformed', (file) => {
    const urls = locs(read(file));
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url.startsWith(`${SITE}/`)).toBe(true);
      // Check the path only. The scheme's own // would match otherwise.
      const pathname = url.slice(SITE.length);
      // The exact shape a renamed field produces.
      expect(pathname).not.toMatch(/\/(undefined|null)(\/|$)/);
      expect(pathname).not.toMatch(/\/\//);
      expect(pathname).not.toMatch(/\s/);
    }
  });

  it.each(SECTIONS)('%s has no duplicate URLs', (file) => {
    const urls = locs(read(file));
    expect(new Set(urls).size).toBe(urls.length);
  });

  // The naming rule is the whole point: a file called sitemap-quizzes.xml must
  // contain /quizzes URLs and nothing else. Enforcing it here means a future
  // section cannot quietly become a themed grab-bag whose name needs a gloss.
  it.each(SECTIONS)('%s only contains URLs under the prefix it is named after', (file) => {
    const prefix = file.replace(/^sitemap-/, '').replace(/\.xml$/, '');
    for (const url of locs(read(file))) {
      expect(url.startsWith(`${SITE}/${prefix}/`), `${url} does not belong in ${file}`).toBe(true);
    }
  });

  it('no URL appears in more than one section', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const file of SECTIONS) {
      for (const url of locs(read(file))) {
        const first = seen.get(url);
        if (first) clashes.push(`${url} in both ${first} and ${file}`);
        else seen.set(url, file);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('the index lists exactly the section files', () => {
    const xml = read('sitemap-index.xml');
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    const listed = locs(xml).map((u) => u.replace(`${SITE}/`, ''));
    expect(listed.sort()).toEqual([...SECTIONS].sort());
  });

  // robots.txt is the only thing that tells a crawler these files exist. Nobody
  // submits them by hand, and a crawler we have never heard of will only find
  // them this way. If the index stops being listed here, discovery silently
  // reverts to /sitemap.xml alone and no test would otherwise notice.
  it('robots.txt advertises both the full sitemap and the index', async () => {
    const robots = (await import('../app/robots')).default();
    const listed = Array.isArray(robots.sitemap) ? robots.sitemap : [robots.sitemap];
    expect(listed).toContain(`${SITE}/sitemap.xml`);
    expect(listed).toContain(`${SITE}/sitemap-index.xml`);
  });

  it('lastmod values, where present, are valid ISO dates', () => {
    for (const file of SECTIONS) {
      const dates = [...read(file).matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
      for (const d of dates) {
        expect(Number.isNaN(new Date(d).getTime()), `${file}: ${d}`).toBe(false);
      }
    }
  });
});
