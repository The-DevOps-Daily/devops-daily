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
  // Deliberately no <lastmod>. Stamping the current time would make this file
  // change on every run, producing a diff on every build for no information
  // gain. It is optional in the spec, and crawlers use each child sitemap's
  // own dates anyway.
  const items = files
    .map((f) => `  <sitemap>\n    <loc>${SITE}/${f}</loc>\n  </sitemap>`)
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

  // One sitemap per URL prefix, named after that prefix. /posts lives in
  // sitemap-posts.xml, /quizzes in sitemap-quizzes.xml, and so on.
  //
  // The rule is mechanical on purpose. Grouping several prefixes into a themed
  // file means inventing a name for the theme, and then nobody can tell what is
  // in the file without reading this script. It also blends the indexing rates
  // of formats we want to compare: if Google is indexing quizzes but not
  // flashcards, a combined file hides that and a split one shows it.
  //
  // Adding a section later is one entry here.
  const sections: Record<string, Entry[]> = {
    'sitemap-posts.xml': (posts as { slug: string; updatedAt?: string; date?: string; publishedAt?: string }[]).map((p) => ({
      loc: `${SITE}/posts/${p.slug}`,
      lastmod: iso(p.updatedAt || p.date || p.publishedAt),
    })),

    // Both the guide landing page and each of its parts.
    'sitemap-guides.xml': (guides as { slug: string; updatedAt?: string; publishedAt?: string; parts?: { slug: string }[] }[]).flatMap((g) => [
      { loc: `${SITE}/guides/${g.slug}`, lastmod: iso(g.updatedAt || g.publishedAt) },
      ...(g.parts ?? []).map((part) => ({
        loc: `${SITE}/guides/${g.slug}/${part.slug}`,
        lastmod: iso(g.updatedAt || g.publishedAt),
      })),
    ]),

    'sitemap-games.xml': (games as { id: string }[]).map((g) => ({ loc: `${SITE}/games/${g.id}` })),

    'sitemap-exercises.xml': (exercises as { id: string; updatedAt?: string; publishedAt?: string }[]).map((e) => ({
      loc: `${SITE}/exercises/${e.id}`,
      lastmod: iso(e.updatedAt || e.publishedAt),
    })),

    'sitemap-quizzes.xml': (quizzes as { id?: string; slug?: string; createdDate?: string }[]).map((q) => ({
      loc: `${SITE}/quizzes/${q.slug ?? q.id}`,
      lastmod: iso(q.createdDate),
    })),

    'sitemap-flashcards.xml': (flashcards as { id: string }[]).map((f) => ({ loc: `${SITE}/flashcards/${f.id}` })),

    'sitemap-checklists.xml': (checklists as { slug: string; updatedDate?: string; createdDate?: string }[]).map((c) => ({
      loc: `${SITE}/checklists/${c.slug}`,
      lastmod: iso(c.updatedDate || c.createdDate),
    })),

    // Individual questions and the topic hubs. Both sit under the same prefix.
    'sitemap-interview-questions.xml': [
      ...interviewQuestions.map((q) => ({ loc: `${SITE}/interview-questions/${q.tier}/${q.slug}` })),
      ...getAllTopics().map((t) => ({ loc: `${SITE}/interview-questions/topic/${t.slug}` })),
    ],

    'sitemap-comparisons.xml': (comparisons as { slug: string }[]).map((c) => ({ loc: `${SITE}/comparisons/${c.slug}` })),

    'sitemap-news.xml': (news as { slug: string; date?: string }[]).map((n) => ({
      loc: `${SITE}/news/${n.slug}`,
      lastmod: iso(n.date),
    })),

    'sitemap-newsletters.xml': (newsletters as { slug: string }[]).map((n) => ({ loc: `${SITE}/newsletters/${n.slug}` })),

    'sitemap-advent-of-devops.xml': (advent as { slug?: string; day?: number; updatedAt?: string; publishedAt?: string }[]).map((d) => ({
      loc: `${SITE}/advent-of-devops/${d.slug ?? `day-${d.day}`}`,
      lastmod: iso(d.updatedAt || d.publishedAt),
    })),

    'sitemap-hacktoberfest.xml': (hacktoberfest as { slug?: string; day?: number }[]).map((d) => ({
      loc: `${SITE}/hacktoberfest/${d.slug ?? `day-${d.day}`}`,
    })),

    'sitemap-categories.xml': (categories as { slug: string }[]).map((c) => ({ loc: `${SITE}/categories/${c.slug}` })),

    'sitemap-tools.xml': TOOLS.map((t) => ({ loc: `${SITE}/tools/${t.slug}` })),
  };

  let total = 0;
  for (const [file, entries] of Object.entries(sections)) {
    // A section that somehow resolves to nothing is a bug, not an empty sitemap.
    if (entries.length === 0) {
      throw new Error(`${file} produced zero URLs, refusing to write an empty sitemap`);
    }
    // The failure mode here is a renamed field silently producing
    // /games/undefined for every row, which is worse than no sitemap because
    // it feeds Google a list of 404s. Fail the build instead.
    const broken = entries.filter((e) => /\/(undefined|null)(\/|$)/.test(e.loc) || !e.loc.startsWith(`${SITE}/`));
    if (broken.length > 0) {
      throw new Error(`${file} has ${broken.length} malformed URLs, first: ${broken[0].loc}`);
    }
    const seen = new Set(entries.map((e) => e.loc));
    if (seen.size !== entries.length) {
      throw new Error(`${file} contains ${entries.length - seen.size} duplicate URLs`);
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
