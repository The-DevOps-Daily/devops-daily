// scripts/generate-section-sitemaps.ts
//
// Writes one sitemap per content type into public/, plus an index that lists
// them. These sit alongside the full /sitemap.xml that app/sitemap.ts emits;
// they do not replace it.
//
// The point is measurement. Search Console reports indexed-against-submitted
// per sitemap, so submitting these separately turns a single site-wide
// "678 of 1.14k indexed" into a number per section, which tells you where the
// indexing problem actually is. Google is explicit that a URL may appear in
// more than one sitemap, so the overlap with /sitemap.xml is fine.
import fs from 'fs/promises';
import path from 'path';
import { getAllPosts } from '../lib/posts.js';
import { getAllGuides } from '../lib/guides.js';
import { getAllExercises } from '../lib/exercises.js';
import { getAllNews } from '../lib/news.js';
import { getActiveGames } from '../lib/games.js';
import { getAllChecklists } from '../lib/checklists.js';
import { getAllComparisons } from '../lib/comparisons.js';
import { getAllFlashCardSets } from '../lib/flashcard-loader.js';
import { getQuizMetadata } from '../lib/quiz-loader.js';
import { getAllNewsletters } from '../lib/newsletters.js';
import { getAllAdventDays } from '../lib/advent.js';
import { getAllHacktoberfestDays } from '../lib/hacktoberfest.js';
import { interviewQuestions, getAllTopics } from '../content/interview-questions/index.js';
import { getAllCategories } from '../lib/categories.js';
import { TOOLS } from '../lib/tools.js';

const SITE = 'https://devops-daily.com';
const PUBLIC_DIR = path.join(process.cwd(), 'public');

interface Entry {
  loc: string;
  lastmod?: string;
}

function iso(d?: string | Date | null): string | undefined {
  if (!d) return undefined;
  const parsed = d instanceof Date ? d : new Date(d);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderUrlset(entries: Entry[]): string {
  const urls = entries
    .map((e) => {
      const lastmod = e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : '';
      return `  <url>\n    <loc>${xmlEscape(e.loc)}</loc>${lastmod}\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function renderIndex(files: string[]): string {
  const now = new Date().toISOString();
  const items = files
    .map((f) => `  <sitemap>\n    <loc>${SITE}/${f}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

async function build() {
  const [posts, guides, exercises, news, games, checklists, comparisons, flashcards, quizzes, newsletters, advent, hacktoberfest, categories] =
    await Promise.all([
      getAllPosts(),
      getAllGuides(),
      getAllExercises(),
      getAllNews(),
      getActiveGames(),
      getAllChecklists(),
      getAllComparisons(),
      getAllFlashCardSets(),
      getQuizMetadata(),
      getAllNewsletters(),
      getAllAdventDays(),
      getAllHacktoberfestDays(),
      getAllCategories(),
    ]);

  const sections: Record<string, Entry[]> = {
    // Editorial: the pages that are supposed to earn search traffic.
    'sitemap-posts.xml': (posts as { slug: string; updatedAt?: string; date?: string; publishedAt?: string }[]).map((p) => ({
      loc: `${SITE}/posts/${p.slug}`,
      lastmod: iso(p.updatedAt || p.date || p.publishedAt),
    })),

    'sitemap-guides.xml': (guides as { slug: string; updatedAt?: string; publishedAt?: string; parts?: { slug: string }[] }[]).flatMap((g) => [
      { loc: `${SITE}/guides/${g.slug}`, lastmod: iso(g.updatedAt || g.publishedAt) },
      ...(g.parts ?? []).map((part) => ({
        loc: `${SITE}/guides/${g.slug}/${part.slug}`,
        lastmod: iso(g.updatedAt || g.publishedAt),
      })),
    ]),

    // Interactive: simulators and hands-on exercises.
    'sitemap-interactive.xml': [
      ...(games as { id: string }[]).map((g) => ({ loc: `${SITE}/games/${g.id}` })),
      ...(exercises as { id: string; updatedAt?: string; publishedAt?: string }[]).map((e) => ({
        loc: `${SITE}/exercises/${e.id}`,
        lastmod: iso(e.updatedAt || e.publishedAt),
      })),
    ],

    // Study material: the formats most at risk of reading as derivative.
    'sitemap-learning.xml': [
      ...(quizzes as { id?: string; slug?: string; createdDate?: string }[]).map((q) => ({
        loc: `${SITE}/quizzes/${q.slug ?? q.id}`,
        lastmod: iso(q.createdDate),
      })),
      ...(flashcards as { id: string }[]).map((f) => ({ loc: `${SITE}/flashcards/${f.id}` })),
      ...(checklists as { slug: string; updatedDate?: string; createdDate?: string }[]).map((c) => ({
        loc: `${SITE}/checklists/${c.slug}`,
        lastmod: iso(c.updatedDate || c.createdDate),
      })),
      ...interviewQuestions.map((q) => ({ loc: `${SITE}/interview-questions/${q.tier}/${q.slug}` })),
      ...getAllTopics().map((t) => ({ loc: `${SITE}/interview-questions/topic/${t.slug}` })),
    ],

    // Time-boxed and comparison content.
    'sitemap-timely.xml': [
      ...(news as { slug: string; date?: string }[]).map((n) => ({ loc: `${SITE}/news/${n.slug}`, lastmod: iso(n.date) })),
      ...(newsletters as { slug: string }[]).map((n) => ({ loc: `${SITE}/newsletters/${n.slug}` })),
      ...(advent as { slug?: string; day?: number; updatedAt?: string; publishedAt?: string }[]).map((d) => ({
        loc: `${SITE}/advent-of-devops/${d.slug ?? `day-${d.day}`}`,
        lastmod: iso(d.updatedAt || d.publishedAt),
      })),
      ...(hacktoberfest as { slug?: string; day?: number }[]).map((d) => ({
        loc: `${SITE}/hacktoberfest/${d.slug ?? `day-${d.day}`}`,
      })),
      ...(comparisons as { slug: string }[]).map((c) => ({ loc: `${SITE}/comparisons/${c.slug}` })),
    ],

    // Taxonomy and utility pages. Split out so their indexing rate does not
    // get blended into the editorial numbers.
    'sitemap-taxonomy.xml': [
      ...(categories as { slug: string }[]).map((c) => ({ loc: `${SITE}/categories/${c.slug}` })),
      ...TOOLS.map((t) => ({ loc: `${SITE}/tools/${t.slug}` })),
    ],
  };

  let total = 0;
  for (const [file, entries] of Object.entries(sections)) {
    // A section that somehow resolves to nothing is a bug, not an empty sitemap.
    if (entries.length === 0) {
      throw new Error(`${file} produced zero URLs, refusing to write an empty sitemap`);
    }
    await fs.writeFile(path.join(PUBLIC_DIR, file), renderUrlset(entries), 'utf-8');
    total += entries.length;
    console.log(`  ${file.padEnd(28)} ${entries.length} URLs`);
  }

  await fs.writeFile(path.join(PUBLIC_DIR, 'sitemap-index.xml'), renderIndex(Object.keys(sections)), 'utf-8');
  console.log(`  sitemap-index.xml            ${Object.keys(sections).length} sitemaps`);
  console.log(`\nTotal URLs across sections: ${total}`);
}

build().catch((err) => {
  console.error('Section sitemap generation failed:', err);
  process.exit(1);
});
