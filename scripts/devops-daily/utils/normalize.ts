import { NewsItem } from '../crawler/types.js';
import { cleanExcerpt, cleanTitle } from './text.js';

/**
 * Normalize a news item
 */
export function normalizeItem(item: NewsItem): NewsItem {
  const title = cleanTitle(item.title);
  return {
    ...item,
    title,
    url: cleanUrl(item.url),
    excerpt: item.excerpt ? cleanExcerpt(item.excerpt, title) : '',
    publishedAt: normalizeDate(item.publishedAt),
  };
}

/**
 * Normalize multiple items. Items without a title, a web link or a date are
 * dropped: an undated item cannot be placed in a week.
 */
export function normalizeItems(items: NewsItem[]): NewsItem[] {
  return items.map(normalizeItem).filter((item) => item.title && item.url && item.publishedAt);
}

const TRACKING_PARAMS = new Set([
  'ref',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  '_hsenc',
  '_hsmi',
  'mkt_tok',
  'sc_channel',
  'sc_campaign',
  'sc_medium',
  'sc_content',
  'sc_country',
  'sc_geo',
  'sc_outcome',
  'sc_publisher',
  'trk',
]);

/**
 * Only http(s) links, without tracking parameters. Anything else would be a
 * live javascript:/data: link in the digest, so it becomes ''.
 */
export function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    for (const key of [...parsed.searchParams.keys()]) {
      const lower = key.toLowerCase();
      const value = parsed.searchParams.get(key) ?? '';
      if (
        lower.startsWith('utm_') ||
        TRACKING_PARAMS.has(lower) ||
        (lower === 'source' && /^rss/i.test(value))
      ) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Normalize date to ISO format, or '' when there is no valid date.
 */
function normalizeDate(date: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}
