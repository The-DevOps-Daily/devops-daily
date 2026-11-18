import Parser from 'rss-parser';
import { NewsItem, Source } from './types.js';
import { htmlToText } from '../utils/text.js';

const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['description', 'description'],
    ],
  },
});

/**
 * Crawl an RSS feed
 */
/**
 * Resolves a feed item's link against the feed's own URL.
 *
 * Returns the input unchanged when it cannot be parsed, because a slightly
 * wrong link is better than dropping the item, and the link checker will
 * catch anything that is still relative.
 */
export function absoluteUrl(link: string, feedUrl: string): string {
  try {
    return new URL(link, feedUrl).href;
  } catch {
    return link;
  }
}

/**
 * One retry for a timeout or server error. A 4xx (blocked, gone) will not
 * change in two seconds.
 */
async function parseFeed(url: string) {
  try {
    return await parser.parseURL(url);
  } catch (error) {
    if (/Status code 4\d\d/.test(String(error))) throw error;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return parser.parseURL(url);
  }
}

export async function crawlRssFeed(source: Source, failures?: string[]): Promise<NewsItem[]> {
  try {
    console.log(`Crawling RSS: ${source.name} (${source.url})`);

    const feed = await parseFeed(source.url);
    const items: NewsItem[] = [];

    for (const item of feed.items) {
      if (!item.title || !item.link) {
        continue;
      }

      items.push({
        title: item.title,
        // Some feeds publish relative links. The Bazel blog does, and one of
        // them reached a digest as `/2026/08/05/new-websites-incoming.html`,
        // which the link checker correctly read as a broken internal link and
        // which failed the build on main. Resolve against the feed URL so a
        // relative link becomes the absolute one the reader needs.
        url: absoluteUrl(item.link, source.url),
        excerpt: extractExcerpt(item),
        source: source.name,
        // No date means the item cannot be placed in a week. Leave it empty
        // so normalize drops it, instead of dating it "now" and putting an
        // old post into every digest.
        publishedAt: item.isoDate || item.pubDate || '',
        category: source.category,
        tier: source.tier ?? 3,
      });
    }

    console.log(`  ✓ Found ${items.length} items from ${source.name}`);
    return items;
  } catch (error) {
    console.error(`  ✗ Error crawling ${source.name}:`, error);
    failures?.push(source.name);
    return [];
  }
}

/**
 * Extract excerpt from RSS item. The summary or description is the best
 * excerpt; the full content is the fallback. HTML is turned into text here,
 * so block tags become spaces and entities are decoded.
 */
export function extractExcerpt(item: object): string {
  const { summary, description, content, contentEncoded, contentSnippet } = item as Record<
    string,
    unknown
  >;
  for (const field of [summary, description, content, contentEncoded, contentSnippet]) {
    const text = htmlToText(field);
    if (text) return text.substring(0, 2000);
  }
  return '';
}

/**
 * Crawl multiple RSS feeds in parallel
 */
export async function crawlRssFeeds(
  sources: Source[],
  concurrency: number = 5,
  failures?: string[]
): Promise<NewsItem[]> {
  const rssFeeds = sources.filter((s) => s.type === 'rss');
  const allItems: NewsItem[] = [];

  // Process in batches to avoid overwhelming servers
  for (let i = 0; i < rssFeeds.length; i += concurrency) {
    const batch = rssFeeds.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((source) => crawlRssFeed(source, failures)));
    allItems.push(...results.flat());
  }

  return allItems;
}
