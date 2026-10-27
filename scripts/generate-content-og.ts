#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { getAllPosts } from '../lib/posts.js';
import { getAllGuides } from '../lib/guides.js';
import { getAllExercises } from '../lib/exercises.js';
import { getAllNews } from '../lib/news.js';
import { getAllAdventDays } from '../lib/advent.js';
import { getAllGames } from '../lib/games.js';
import { CATEGORY_LABEL, TOOLS } from '../lib/tools.js';
import { insertStaticRedirects } from './redirects-order.js';
import {
  buildContentCoverSvg,
  cleanOgText,
  CONTENT_COVER_TYPES,
  COVER_HEIGHT,
  COVER_WIDTH,
  coverTypeLabel,
  layoutContentCoverTitle,
  renderContentCoverJpeg,
  renderCoverOverlay,
  selectCoverBackground,
  type ContentCoverType,
} from './og-utils.js';

interface CoverItem {
  type: ContentCoverType;
  slug: string;
  title: string;
  /** Shown in the category pill. */
  category: string;
  /** Category and tags used to pick the background illustration. */
  topicCategory?: string;
  tags?: unknown[];
  typeLabel?: string;
  directory: string;
  ogSuffix: boolean;
}

interface JsonContentRecord {
  id?: string;
  slug?: string;
  title?: string;
  category?: string;
  tags?: unknown[];
  toolA?: { name?: string };
  toolB?: { name?: string };
}

const root = process.cwd();
const force = process.argv.includes('--force');
const preview = process.argv.includes('--preview');
const check = process.argv.includes('--check');
// --migrate replaces covers that are still PNG; --limit=N caps one run so the
// migration can go in small batches.
const migrate = process.argv.includes('--migrate');
function numericFlag(name: string, fallback: number): number {
  const argument = process.argv.find((value) => value.startsWith(`--${name}=`));
  const value = argument ? Number(argument.slice(name.length + 3)) : fallback;
  if (!Number.isInteger(value) || value < 1) throw new Error(`Invalid --${name}`);
  return value;
}
const limit = numericFlag('limit', Number.MAX_SAFE_INTEGER);
// One cover at a time by default: rendering is CPU-bound and this also runs
// on small machines. CI can pass --workers=4.
const workers = numericFlag('workers', 1);
sharp.concurrency(workers);
const onlyKeys = new Set(
  process.argv
    .filter((argument) => argument.startsWith('--only='))
    .flatMap((argument) => argument.slice('--only='.length).split(','))
    .map((value) => value.trim())
    .filter(Boolean)
);

async function readJsonDirectory(relativeDirectory: string): Promise<JsonContentRecord[]> {
  const directory = path.join(root, relativeDirectory);
  const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.json')).sort();
  return Promise.all(
    files.map(async (file) => JSON.parse(await fs.readFile(path.join(directory, file), 'utf8')))
  );
}

function required(value: unknown, field: string): string {
  const clean = cleanOgText(value);
  if (!clean) throw new Error(`Missing ${field} while collecting content covers`);
  return clean;
}

async function collectItems(): Promise<CoverItem[]> {
  const items: CoverItem[] = [];
  const [posts, guides, exercises, news, adventDays, games] = await Promise.all([
    getAllPosts(),
    getAllGuides(),
    getAllExercises(),
    getAllNews(),
    getAllAdventDays(),
    getAllGames(),
  ]);

  for (const post of posts) {
    items.push({
      type: 'post',
      slug: post.slug,
      title: post.title,
      category: post.category?.name || 'DevOps',
      topicCategory: post.category?.slug || post.category?.name,
      tags: post.tags,
      directory: 'posts',
      ogSuffix: false,
    });
  }
  for (const guide of guides) {
    items.push({
      type: 'guide',
      slug: guide.slug,
      title: guide.title,
      category: guide.category?.name || 'DevOps',
      topicCategory: guide.category?.slug || guide.category?.name,
      tags: guide.tags,
      directory: 'guides',
      ogSuffix: false,
    });
  }
  for (const exercise of exercises) {
    items.push({
      type: 'exercise',
      slug: exercise.id,
      title: exercise.title,
      category: exercise.category?.name || 'DevOps',
      topicCategory: exercise.category?.slug || exercise.category?.name,
      tags: exercise.tags,
      directory: 'exercises',
      ogSuffix: false,
    });
  }
  for (const digest of news) {
    items.push({
      type: 'news',
      slug: digest.slug,
      title: digest.title,
      category: `Week ${digest.week}, ${digest.year}`,
      directory: 'news',
      ogSuffix: false,
    });
  }
  for (const day of adventDays) {
    items.push({
      type: 'advent',
      slug: day.slug,
      title: day.title.replace(/^Day \d+\s*-\s*/, ''),
      category: day.category || 'DevOps',
      topicCategory: day.category,
      tags: day.tags,
      typeLabel: `Advent · Day ${day.day}`,
      directory: 'advent',
      ogSuffix: false,
    });
  }
  for (const game of games) {
    if (game.isComingSoon) continue;
    items.push({
      type: 'game',
      slug: game.id,
      title: game.title,
      category: game.category || 'Interactive',
      typeLabel: game.type === 'game' ? 'Game' : 'Simulator',
      directory: 'games',
      ogSuffix: true,
    });
  }
  for (const tool of TOOLS) {
    items.push({
      type: 'tool',
      slug: tool.slug,
      title: tool.title,
      category: CATEGORY_LABEL[tool.category],
      topicCategory: tool.category,
      directory: 'tools',
      ogSuffix: false,
    });
  }

  for (const quiz of await readJsonDirectory('content/quizzes')) {
    items.push({
      type: 'quiz',
      slug: required(quiz.id, 'quiz id'),
      title: required(quiz.title, 'quiz title'),
      category: quiz.category || 'DevOps',
      directory: 'quizzes',
      ogSuffix: true,
    });
  }
  for (const checklist of await readJsonDirectory('content/checklists')) {
    items.push({
      type: 'checklist',
      slug: required(checklist.slug || checklist.id, 'checklist slug'),
      title: required(checklist.title, 'checklist title'),
      category: checklist.category || 'DevOps',
      topicCategory: checklist.category,
      tags: checklist.tags,
      directory: 'checklists',
      ogSuffix: true,
    });
  }
  for (const question of await readJsonDirectory('content/interview-questions')) {
    items.push({
      type: 'interview',
      slug: required(question.slug || question.id, 'interview slug'),
      title: required(question.title, 'interview title'),
      category: question.category || 'DevOps',
      topicCategory: question.category,
      tags: question.tags,
      directory: 'interview-questions',
      ogSuffix: true,
    });
  }
  for (const comparison of await readJsonDirectory('content/comparisons')) {
    items.push({
      type: 'comparison',
      slug: required(comparison.slug || comparison.id, 'comparison slug'),
      title: required(
        comparison.title || `${comparison.toolA?.name || ''} vs ${comparison.toolB?.name || ''}`,
        'comparison title'
      ),
      category: comparison.category || 'DevOps',
      directory: 'comparisons',
      ogSuffix: true,
    });
  }
  for (const challenge of await readJsonDirectory('content/challenges')) {
    items.push({
      type: 'challenge',
      slug: required(challenge.slug || challenge.id, 'challenge slug'),
      title: required(challenge.title, 'challenge title'),
      category: challenge.category || 'DevOps',
      topicCategory: challenge.category,
      tags: challenge.tags,
      directory: 'challenges',
      ogSuffix: true,
    });
  }
  for (const flashcard of await readJsonDirectory('content/flashcards')) {
    items.push({
      type: 'flashcard',
      slug: required(flashcard.id, 'flashcard id'),
      title: required(flashcard.title, 'flashcard title'),
      category: flashcard.category || 'DevOps',
      topicCategory: flashcard.category,
      tags: flashcard.tags,
      directory: 'flashcards',
      ogSuffix: true,
    });
  }

  return items;
}

function selectItems(items: CoverItem[]): CoverItem[] {
  if (onlyKeys.size > 0) {
    return items.filter((item) => onlyKeys.has(`${item.type}/${item.slug}`));
  }
  if (!preview) return items;

  const selected: CoverItem[] = [];
  for (const type of [...new Set(items.map((item) => item.type))]) {
    const longest = items
      .filter((item) => item.type === type)
      .sort((a, b) => cleanOgText(b.title).length - cleanOgText(a.title).length)[0];
    if (longest) selected.push(longest);
  }
  return selected;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Renders the overlay with the title in magenta and checks every line's
// pixels stay inside the text column, clear of the illustration.
function assertRenderedTitleBounds(item: CoverItem): void {
  const typeLabel = coverTypeLabel(item.type, item.typeLabel);
  const layout = layoutContentCoverTitle(item.title, item.category, typeLabel);
  const svg = buildContentCoverSvg({ ...item, typeLabel: typeLabel ?? undefined }).replace(
    /(<text data-cover-title-line="true"[^>]*fill=")#[^"]+("[^>]*>)/g,
    '$1#ff00ff$2'
  );
  const image = renderCoverOverlay(svg);
  if (image.width !== COVER_WIDTH || image.height !== COVER_HEIGHT) {
    throw new Error(`Invalid cover dimensions for ${item.type}/${item.slug}`);
  }
  const pixels = image.pixels;
  for (let lineIndex = 0; lineIndex < layout.lines.length; lineIndex += 1) {
    const baseline = layout.titleY + lineIndex * layout.lineHeight;
    const top = Math.max(0, Math.floor(baseline - layout.fontSize * 1.15));
    const bottom = Math.min(image.height - 1, Math.ceil(baseline + layout.fontSize * 0.3));
    let maxX = -1;
    for (let y = top; y <= bottom; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const index = (y * image.width + x) * 4;
        if (
          pixels[index + 3] > 0 &&
          pixels[index] > 140 &&
          pixels[index + 2] > 140 &&
          pixels[index + 1] < 110
        ) {
          maxX = Math.max(maxX, x);
        }
      }
    }
    if (maxX < 0)
      throw new Error(`Could not detect title line ${lineIndex + 1} for ${item.type}/${item.slug}`);
    if (maxX > layout.titleX + layout.maxWidth + 2) {
      throw new Error(
        `Rendered title overflow on line ${lineIndex + 1} for ${item.type}/${item.slug}`
      );
    }
  }
}

function coverPaths(item: CoverItem) {
  const outputDirectory = path.join(root, 'public', 'images', item.directory);
  const baseName = `${item.slug}${item.ogSuffix ? '-og' : ''}`;
  return {
    outputDirectory,
    baseName,
    jpgPath: path.join(outputDirectory, `${baseName}.jpg`),
    pngPath: path.join(outputDirectory, `${baseName}.png`),
  };
}

// Served paths of PNG covers this run replaced; each gets a 301 to the JPEG
// because sent newsletters and cross-posts still link the old URL.
const replacedPngs: string[] = [];

async function writeCover(item: CoverItem): Promise<'generated' | 'skipped' | 'validated'> {
  const { outputDirectory, baseName, jpgPath, pngPath } = coverPaths(item);
  if (check) {
    assertRenderedTitleBounds(item);
    return 'validated';
  }
  // Keep an existing cover, JPEG or older PNG, unless --force or --migrate
  // asks for it; a new item gets one on the next run.
  const hasJpg = await pathExists(jpgPath);
  const hasPng = await pathExists(pngPath);
  if (!force && (hasJpg || (hasPng && !migrate))) return 'skipped';

  await fs.mkdir(outputDirectory, { recursive: true });
  const jpg = await renderContentCoverJpeg({
    type: item.type,
    title: item.title,
    category: item.category,
    typeLabel: item.typeLabel,
    background: selectCoverBackground({
      type: item.type,
      slug: item.slug,
      category: item.topicCategory,
      tags: item.tags,
    }),
  });

  const temporaryJpg = `${jpgPath}.${process.pid}-${Date.now()}.tmp`;
  try {
    await fs.writeFile(temporaryJpg, jpg);
    await fs.rename(temporaryJpg, jpgPath);
  } finally {
    await fs.rm(temporaryJpg, { force: true });
  }
  // Older covers for the same item were PNG (rendered from an SVG). The JPEG
  // replaces both, so they should not ship alongside it.
  await Promise.all(
    ['png', 'svg'].map((extension) =>
      fs.rm(path.join(outputDirectory, `${baseName}.${extension}`), { force: true })
    )
  );
  if (hasPng) replacedPngs.push(`/images/${item.directory}/${baseName}.png`);
  return 'generated';
}

async function addPngRedirects(): Promise<number> {
  if (replacedPngs.length === 0) return 0;
  const redirectsPath = path.join(root, 'public', '_redirects');
  const current = await fs.readFile(redirectsPath, 'utf8');
  const existing = new Set(current.split('\n').map((line) => line.split(/\s+/)[0]));
  const header = '# Content covers moved from PNG to JPEG (Oct 2026)';
  const lines = [...new Set(replacedPngs)]
    .filter((from) => !existing.has(from))
    .sort()
    .map((from) => `${from} ${from.replace(/\.png$/, '.jpg')} 301`);
  if (lines.length === 0) return 0;
  const block = current.includes(header) ? lines : ['', header, ...lines];
  await fs.writeFile(redirectsPath, insertStaticRedirects(current, block));
  return lines.length;
}

async function main(): Promise<void> {
  const allItems = await collectItems();
  const inventory = CONTENT_COVER_TYPES.map((type) => {
    const count = allItems.filter((item) => item.type === type).length;
    return `${type}=${count}`;
  }).join(', ');
  const items = selectItems(allItems);
  if (onlyKeys.size > 0 && items.length !== onlyKeys.size) {
    const matched = new Set(items.map((item) => `${item.type}/${item.slug}`));
    const missing = [...onlyKeys].filter((key) => !matched.has(key));
    throw new Error(`Unknown --only cover key(s): ${missing.join(', ')}`);
  }

  let generated = 0;
  let skipped = 0;
  let validated = 0;
  for (let index = 0; index < items.length && generated < limit; index += workers) {
    const batch = items.slice(index, index + Math.min(workers, limit - generated));
    const results = await Promise.all(batch.map(writeCover));
    generated += results.filter((result) => result === 'generated').length;
    skipped += results.filter((result) => result === 'skipped').length;
    validated += results.filter((result) => result === 'validated').length;
  }
  const redirects = await addPngRedirects();

  console.log(`Content cover inventory: ${inventory}.`);
  console.log(
    `Content covers: ${generated} generated, ${skipped} skipped, ${validated} validated, ${items.length} selected (${allItems.length} total), ${redirects} PNG redirects added.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
