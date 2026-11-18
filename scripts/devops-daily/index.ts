#!/usr/bin/env node

/**
 * Options:
 *   --force            replace a digest file that already exists
 *   --week 2026-W47    rebuild the window of a past week
 *   --until 2026-11-16 the 7 days before this date
 *   --pr-body <file>   also write the pull request description to <file>
 */

import fs from 'fs/promises';
import path from 'path';
import * as yaml from 'js-yaml';
import { SourcesConfig } from './crawler/types.js';
import { crawlRssFeeds } from './crawler/rss.js';
import { crawlWebSources } from './crawler/web.js';
import { crawlReleases, selectReleases } from './crawler/releases.js';
import { normalizeItems } from './utils/normalize.js';
import { deduplicate } from './utils/dedupe.js';
import { resolveWindow } from './utils/date.js';
import { classifyItems } from './pipeline/classify.js';
import { selectItems } from './pipeline/rank.js';
import { assembleDigest, printStats } from './pipeline/assemble.js';
import { loadOwnPosts, selectOwnPosts } from './pipeline/own-posts.js';
import { generateMarkdown } from './pipeline/template.js';
import { buildPrBody } from './pipeline/pr-body.js';
import { validateMarkdown, checkDuplicateUrls } from './pipeline/validate.js';

function argValue(name: string): string | undefined {
  const args = process.argv;
  const index = args.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (index === -1) return undefined;
  const arg = args[index];
  return arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : args[index + 1];
}

async function main() {
  console.log('🚀 DevOps Daily Digest Generator\n');

  const force = process.argv.includes('--force');
  const prBodyPath = argValue('--pr-body');
  const now = new Date();
  const window = resolveWindow(process.argv.slice(2), now);
  console.log(
    `🗓️  Week ${window.week}, ${window.year}: ${window.start.toISOString()} to ${window.end.toISOString()}\n`
  );

  try {
    // 1. Load sources
    console.log('📋 Loading sources...');
    const sourcesPath = path.join(process.cwd(), 'scripts/devops-daily/data/sources.yaml');
    const sourcesContent = await fs.readFile(sourcesPath, 'utf-8');
    const sourcesConfig = yaml.load(sourcesContent) as SourcesConfig;
    const releaseSources = sourcesConfig.releases ?? [];
    console.log(
      `  ✓ Loaded ${sourcesConfig.sources.length} news sources and ${releaseSources.length} release feeds\n`
    );

    // 2. Crawl feeds
    const failures: string[] = [];
    console.log('🔍 Crawling RSS feeds...');
    const rssItems = await crawlRssFeeds(sourcesConfig.sources, 5, failures);
    console.log(`  ✓ Found ${rssItems.length} items from RSS feeds\n`);

    console.log('🌐 Crawling web sources...');
    const webItems = await crawlWebSources(sourcesConfig.sources, 3, failures);
    console.log(`  ✓ Found ${webItems.length} items from web sources\n`);

    console.log('🚀 Reading release feeds...');
    const releaseEntries = await crawlReleases(releaseSources, failures);
    const releases = selectReleases(
      releaseEntries,
      releaseSources.map((s) => s.name),
      window.start,
      window.end,
      now
    );
    console.log(`  ✓ ${releases.length} projects with releases in the window\n`);

    // 3. Normalize, dedupe, keep the window
    console.log('🔧 Normalizing and deduplicating...');
    const until = Math.min(window.end.getTime(), now.getTime());
    const releaseUrls = new Set(releases.flatMap((p) => p.releases.map((r) => r.url)));
    let allItems = deduplicate(normalizeItems([...rssItems, ...webItems])).filter((item) => {
      const t = new Date(item.publishedAt).getTime();
      // A release post listed under Releases is not repeated as news.
      return t >= window.start.getTime() && t < until && !releaseUrls.has(item.url);
    });
    console.log(`  ✓ ${allItems.length} unique items in the window\n`);

    if (allItems.length === 0) {
      console.log('⚠️  No items found in the window. Exiting...');
      return;
    }

    // 4. Classify, rank and pick
    console.log('🔤 Classifying and ranking...');
    allItems = classifyItems(allItems);
    const picked = selectItems(allItems, { end: window.end });
    console.log(`  ✓ ${picked.length} items picked\n`);

    // 5. Our own posts from the same window
    const ownPosts = selectOwnPosts(
      await loadOwnPosts(path.join(process.cwd(), 'content', 'posts')),
      window.start,
      window.end,
      now
    );

    // 6. Assemble and render
    console.log('📝 Assembling digest...');
    const digest = assembleDigest({
      items: picked,
      releases,
      ownPosts,
      week: window.week,
      year: window.year,
      date: window.date,
    });
    printStats(digest);

    const markdown = generateMarkdown(digest);
    const duplicateUrls = checkDuplicateUrls(markdown);
    if (duplicateUrls.length > 0) {
      console.warn(`⚠️  Found ${duplicateUrls.length} duplicate URLs:`, duplicateUrls);
    }

    // 7. Write file
    console.log('\n💾 Writing file...');
    const newsDir = path.join(process.cwd(), 'content', 'news', window.year.toString());
    await fs.mkdir(newsDir, { recursive: true });
    const filePath = path.join(newsDir, `week-${window.week}.md`);
    const exists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);
    if (exists && !force) {
      console.error(`❌ ${filePath} already exists. Re-run with --force to replace that issue.`);
      process.exit(1);
    }
    await fs.writeFile(filePath, markdown, 'utf-8');
    console.log(`  ✓ Written to: ${filePath}\n`);

    if (prBodyPath) {
      const body = buildPrBody({
        digest,
        window,
        newsSources: sourcesConfig.sources.length,
        releaseSources: releaseSources.length,
        failedSources: failures,
      });
      await fs.writeFile(prBodyPath, body, 'utf-8');
      console.log(`  ✓ PR description written to: ${prBodyPath}\n`);
    }

    // 8. Validate markdown
    console.log('✅ Validating markdown...');
    const isValid = await validateMarkdown(filePath);
    if (!isValid) {
      console.error('❌ Markdown validation failed');
      process.exit(1);
    }

    console.log(`\n✨ Success! Generated digest for Week ${window.week}, ${window.year}`);
    console.log(`📄 File: ${filePath}`);

    // Force exit to prevent hanging on open connections
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Execute
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
