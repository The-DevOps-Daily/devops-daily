#!/usr/bin/env node
/**
 * Research signals collector.
 *
 * Reuses the digest crawler to gather what has actually happened in the DevOps
 * world over the last few days, but stops short of the AI classify/summarize
 * step: it just emits a compact JSON list of recent items (title, url, source,
 * date, category). That list is the raw material a post-writing agent reads to
 * pick one fresh, specific angle to research and write up. No OpenAI key needed.
 *
 * Usage: tsx scripts/devops-daily/research-signals.ts [--days N] [--max N] [--out FILE]
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { SourcesConfig, NewsItem } from './crawler/types.js';
import { crawlRssFeeds } from './crawler/rss.js';
import { normalizeItems } from './utils/normalize.js';
import { deduplicate } from './utils/dedupe.js';
import { isWithinLastDays } from './utils/date.js';

function argValue(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

async function main() {
  const days = parseInt(argValue('--days', '4'), 10);
  const max = parseInt(argValue('--max', '60'), 10);
  const outFile = argValue('--out', '');

  const sourcesPath = path.join(process.cwd(), 'scripts/devops-daily/data/sources.yaml');
  const sourcesConfig = yaml.load(await fs.readFile(sourcesPath, 'utf-8')) as SourcesConfig;

  // Map source name -> priority so we can rank items by how much we trust the feed.
  const priorityByName = new Map(sourcesConfig.sources.map((s) => [s.name, s.priority]));

  const rssItems = await crawlRssFeeds(sourcesConfig.sources, 5);
  let items: NewsItem[] = normalizeItems(rssItems);
  items = deduplicate(items);
  items = items.filter((item) => isWithinLastDays(item.publishedAt, days));

  items.sort((a, b) => {
    const pa = PRIORITY_RANK[priorityByName.get(a.source) ?? 'low'] ?? 2;
    const pb = PRIORITY_RANK[priorityByName.get(b.source) ?? 'low'] ?? 2;
    if (pa !== pb) return pa - pb;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  const signals = items.slice(0, max).map((item) => ({
    title: item.title,
    url: item.url,
    source: item.source,
    publishedAt: item.publishedAt,
    category: item.category ?? null,
    excerpt: (item.excerpt ?? '').slice(0, 280),
  }));

  const payload = JSON.stringify(
    { generatedAt: new Date().toISOString(), days, count: signals.length, signals },
    null,
    2
  );

  if (outFile) {
    await fs.writeFile(outFile, payload);
    console.error(`Wrote ${signals.length} signals to ${outFile}`);
  } else {
    process.stdout.write(payload);
  }
}

main().catch((err) => {
  console.error('research-signals failed:', err);
  process.exit(1);
});
