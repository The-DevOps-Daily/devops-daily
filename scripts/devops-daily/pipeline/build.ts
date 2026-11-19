import { Digest, NewsItem, OwnPost, ProjectReleases } from '../crawler/types.js';
import { DigestWindow } from '../utils/date.js';
import { deduplicate } from '../utils/dedupe.js';
import { normalizeItems } from '../utils/normalize.js';
import { assembleDigest } from './assemble.js';
import { classifyItems } from './classify.js';
import { selectItems } from './rank.js';

export interface BuildInput {
  /** Items as the crawlers return them. */
  rawItems: NewsItem[];
  releases: ProjectReleases[];
  ownPosts: OwnPost[];
  window: DigestWindow;
  now: Date;
}

/**
 * The whole pipeline after crawling: clean, dedupe, keep the window, rank,
 * pick and assemble. Returns null only when the window has no news, no
 * releases and no posts of ours.
 */
export function buildDigest(input: BuildInput): Digest | null {
  const { rawItems, releases, ownPosts, window, now } = input;
  const until = Math.min(window.end.getTime(), now.getTime());
  const releaseUrls = new Set(releases.flatMap((p) => p.releases.map((r) => r.url)));

  const inWindow = deduplicate(normalizeItems(rawItems)).filter((item) => {
    const t = new Date(item.publishedAt).getTime();
    // A release post listed under Releases is not repeated as news.
    return t >= window.start.getTime() && t < until && !releaseUrls.has(item.url);
  });
  console.log(`  ✓ ${inWindow.length} unique items in the window`);

  const picked = selectItems(classifyItems(inWindow), { end: window.end });
  console.log(`  ✓ ${picked.length} items picked`);

  if (picked.length === 0 && releases.length === 0 && ownPosts.length === 0) return null;

  return assembleDigest({
    items: picked,
    releases,
    ownPosts,
    week: window.week,
    year: window.year,
    date: window.date,
  });
}
