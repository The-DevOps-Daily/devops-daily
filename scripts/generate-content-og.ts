#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { getAllPosts } from '../lib/posts.js';
import { getAllGuides } from '../lib/guides.js';
import { getAllExercises } from '../lib/exercises.js';
import { getAllNews } from '../lib/news.js';
import { getAllAdventDays } from '../lib/advent.js';
import { getAllGames } from '../lib/games.js';
import { CATEGORY_LABEL, TOOLS } from '../lib/tools.js';
import {
  buildContentCoverSvg,
  cleanOgText,
  CONTENT_COVER_TYPES,
  layoutContentCoverTitle,
  type ContentCoverType,
} from './og-utils.js';

interface CoverItem {
  type: ContentCoverType;
  slug: string;
  title: string;
  category: string;
  directory: string;
  ogSuffix: boolean;
}

interface JsonContentRecord {
  id?: string;
  slug?: string;
  title?: string;
  category?: string;
  difficulty?: string;
  toolA?: { name?: string };
  toolB?: { name?: string };
}

const root = process.cwd();
const force = process.argv.includes('--force');
const preview = process.argv.includes('--preview');
const check = process.argv.includes('--check');
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
      directory: 'posts',
      ogSuffix: false,
    });
  }
  for (const guide of guides) {
    items.push({
      type: 'guide',
      slug: guide.slug,
      title: guide.title,
      category: guide.category?.name || 'Guide',
      directory: 'guides',
      ogSuffix: false,
    });
  }
  for (const exercise of exercises) {
    items.push({
      type: 'exercise',
      slug: exercise.id,
      title: exercise.title,
      category: exercise.category?.name || 'Exercise',
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
      category: `Day ${day.day} · ${day.category || 'DevOps'}`,
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
      category: game.category || game.type || 'Interactive',
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
      directory: 'tools',
      ogSuffix: false,
    });
  }

  for (const quiz of await readJsonDirectory('content/quizzes')) {
    items.push({
      type: 'quiz',
      slug: required(quiz.id, 'quiz id'),
      title: required(quiz.title, 'quiz title'),
      category: quiz.category || 'Quiz',
      directory: 'quizzes',
      ogSuffix: true,
    });
  }
  for (const checklist of await readJsonDirectory('content/checklists')) {
    items.push({
      type: 'checklist',
      slug: required(checklist.slug || checklist.id, 'checklist slug'),
      title: required(checklist.title, 'checklist title'),
      category: checklist.category || 'Checklist',
      directory: 'checklists',
      ogSuffix: true,
    });
  }
  for (const question of await readJsonDirectory('content/interview-questions')) {
    items.push({
      type: 'interview',
      slug: required(question.slug || question.id, 'interview slug'),
      title: required(question.title, 'interview title'),
      category: [question.category, question.difficulty].filter(Boolean).join(' · ') || 'Interview',
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
      category: comparison.category || 'Comparison',
      directory: 'comparisons',
      ogSuffix: true,
    });
  }
  for (const flashcard of await readJsonDirectory('content/flashcards')) {
    items.push({
      type: 'flashcard',
      slug: required(flashcard.id, 'flashcard id'),
      title: required(flashcard.title, 'flashcard title'),
      category: flashcard.category || 'Flashcards',
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

function assertRenderedTitleBounds(image: ReturnType<Resvg['render']>, item: CoverItem): void {
  const layout = layoutContentCoverTitle(item.title, item.category);
  const pixels = image.pixels;
  for (let lineIndex = 0; lineIndex < layout.lines.length; lineIndex += 1) {
    const baseline = layout.titleY + lineIndex * layout.lineHeight;
    const top = Math.max(0, Math.floor(baseline - layout.fontSize * 1.15));
    const bottom = Math.min(image.height - 1, Math.ceil(baseline + 8));
    let minX = image.width;
    let maxX = -1;
    for (let y = top; y <= bottom; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const index = (y * image.width + x) * 4;
        if (pixels[index] > 140 && pixels[index + 2] > 140 && pixels[index + 1] < 110) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
    }
    if (maxX < minX)
      throw new Error(`Could not detect title line ${lineIndex + 1} for ${item.type}/${item.slug}`);
    if (maxX - minX + 1 > layout.maxWidth + 2 || maxX > 80 + layout.maxWidth + 2) {
      throw new Error(
        `Rendered title overflow on line ${lineIndex + 1} for ${item.type}/${item.slug}`
      );
    }
  }
}

async function writeCover(item: CoverItem): Promise<'generated' | 'skipped' | 'validated'> {
  const outputDirectory = path.join(root, 'public', 'images', item.directory);
  const baseName = `${item.slug}${item.ogSuffix ? '-og' : ''}`;
  const svgPath = path.join(outputDirectory, `${baseName}.svg`);
  const pngPath = path.join(outputDirectory, `${baseName}.png`);
  // PNG is the deployed asset. Preserve any existing cover by default even
  // when its intermediate SVG was pruned; --force is the explicit migration path.
  if (!check && !force && (await pathExists(pngPath))) return 'skipped';

  await fs.mkdir(outputDirectory, { recursive: true });
  const svg = buildContentCoverSvg({
    type: item.type,
    title: item.title,
    category: item.category,
  });
  if (/\{\{[^}]+\}\}/.test(svg))
    throw new Error(`Unresolved SVG placeholder for ${item.type}/${item.slug}`);

  const renderSvg = check
    ? svg.replace(/(<text data-cover-title-line="true"[^>]*fill=")#[^"]+("[^>]*>)/g, '$1#ff00ff$2')
    : svg;
  const rendered = new Resvg(renderSvg, { fitTo: { mode: 'width', value: 1200 } }).render();
  if (rendered.width !== 1200 || rendered.height !== 630) {
    throw new Error(
      `Invalid cover dimensions for ${item.type}/${item.slug}: ${rendered.width}x${rendered.height}`
    );
  }
  if (check) {
    assertRenderedTitleBounds(rendered, item);
    const signature = [...rendered.asPng().subarray(0, 4)];
    if (signature.join(',') !== '137,80,78,71')
      throw new Error(`Invalid PNG for ${item.type}/${item.slug}`);
    return 'validated';
  }
  const png = await sharp(rendered.asPng())
    .resize(1200, 630, { fit: 'contain', background: '#08090c' })
    .png({ quality: 90, compressionLevel: 9 })
    .toBuffer();

  const token = `${process.pid}-${Date.now()}`;
  const temporarySvg = `${svgPath}.${token}.tmp`;
  const temporaryPng = `${pngPath}.${token}.tmp`;
  try {
    await fs.writeFile(temporarySvg, svg, 'utf8');
    await fs.writeFile(temporaryPng, png);
    await fs.rename(temporarySvg, svgPath);
    await fs.rename(temporaryPng, pngPath);
  } finally {
    await Promise.all([fs.rm(temporarySvg, { force: true }), fs.rm(temporaryPng, { force: true })]);
  }
  return 'generated';
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
  for (let index = 0; index < items.length; index += 10) {
    const batch = items.slice(index, index + 10);
    const results = await Promise.all(batch.map(writeCover));
    generated += results.filter((result) => result === 'generated').length;
    skipped += results.filter((result) => result === 'skipped').length;
    validated += results.filter((result) => result === 'validated').length;
  }

  console.log(`Content cover inventory: ${inventory}.`);
  console.log(
    `Content covers: ${generated} generated, ${skipped} skipped, ${validated} validated, ${items.length} selected (${allItems.length} total).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
