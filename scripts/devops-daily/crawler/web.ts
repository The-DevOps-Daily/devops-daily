import * as cheerio from 'cheerio';
import { NewsItem, Source } from './types.js';
import { fetchWithRetry } from './fetch.js';
import { crawlRssFeed } from './rss.js';

/**
 * Discover RSS feed from a web page
 */
export async function discoverRssFeed(url: string): Promise<string | null> {
  try {
    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);

    // Look for RSS feed links in common locations
    const rssLinks = [
      $('link[type="application/rss+xml"]').attr('href'),
      $('link[type="application/atom+xml"]').attr('href'),
      $('a[href*="rss"]').attr('href'),
      $('a[href*="feed"]').attr('href'),
    ];

    for (const link of rssLinks) {
      if (link) {
        // Make absolute URL
        return new URL(link, url).toString();
      }
    }

    // Try common RSS feed paths
    const commonPaths = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/blog/feed'];
    for (const path of commonPaths) {
      try {
        const feedUrl = new URL(path, url).toString();
        const response = await fetchWithRetry(feedUrl, 1, 5000);
        if (response.includes('<rss') || response.includes('<feed')) {
          return feedUrl;
        }
      } catch {
        // Continue to next path
      }
    }

    return null;
  } catch (error) {
    console.error(`Error discovering RSS for ${url}:`, error);
    return null;
  }
}

/**
 * Crawl a web source (discover RSS and crawl it)
 */
export async function crawlWebSource(source: Source, failures?: string[]): Promise<NewsItem[]> {
  try {
    console.log(`Crawling web: ${source.name} (${source.url})`);

    // Try to discover RSS feed
    const rssFeedUrl = await discoverRssFeed(source.url);

    if (rssFeedUrl) {
      console.log(`  → Found RSS feed: ${rssFeedUrl}`);
      // Create a temporary RSS source
      const rssSource: Source = {
        ...source,
        type: 'rss',
        url: rssFeedUrl,
      };
      return await crawlRssFeed(rssSource, failures);
    } else {
      console.log(`  ✗ No RSS feed found for ${source.name}`);
      failures?.push(source.name);
      return [];
    }
  } catch (error) {
    console.error(`  ✗ Error crawling web source ${source.name}:`, error);
    failures?.push(source.name);
    return [];
  }
}

/**
 * Crawl multiple web sources in parallel
 */
export async function crawlWebSources(
  sources: Source[],
  concurrency: number = 3,
  failures?: string[]
): Promise<NewsItem[]> {
  const webSources = sources.filter((s) => s.type === 'web');
  const allItems: NewsItem[] = [];

  // Process in batches (slower for web scraping)
  for (let i = 0; i < webSources.length; i += concurrency) {
    const batch = webSources.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((source) => crawlWebSource(source, failures)));
    allItems.push(...results.flat());
  }

  return allItems;
}
