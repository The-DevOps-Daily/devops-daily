import { NewsItem } from '../crawler/types.js';

/**
 * Which of two copies of the same story to keep: the better source tier
 * first (an official blog over a vendor repost), then the more recent one.
 * Ranking runs later, so this choice must not depend on feed order.
 */
function preferred(existing: NewsItem, candidate: NewsItem): NewsItem {
  const tierA = existing.tier ?? 3;
  const tierB = candidate.tier ?? 3;
  if (tierA !== tierB) return tierB < tierA ? candidate : existing;
  return new Date(candidate.publishedAt) > new Date(existing.publishedAt) ? candidate : existing;
}

/**
 * Remove duplicate items based on URL
 */
export function deduplicateByUrl(items: NewsItem[]): NewsItem[] {
  const byUrl = new Map<string, NewsItem>();
  for (const item of items) {
    const key = normalizeUrl(item.url);
    const existing = byUrl.get(key);
    byUrl.set(key, existing ? preferred(existing, item) : item);
  }
  return Array.from(byUrl.values());
}

/**
 * Remove duplicate items based on title similarity
 */
export function deduplicateByTitle(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const unique: NewsItem[] = [];

  for (const item of items) {
    const normalizedTitle = normalizeTitle(item.title);
    if (!seen.has(normalizedTitle)) {
      seen.add(normalizedTitle);
      unique.push(item);
    }
  }

  return unique;
}

/**
 * Remove duplicates using both URL and title
 */
export function deduplicate(items: NewsItem[]): NewsItem[] {
  // First dedupe by URL
  const deduped = deduplicateByUrl(items);

  // Then check for very similar titles
  const titleMap = new Map<string, NewsItem>();

  for (const item of deduped) {
    const normalized = normalizeTitle(item.title);
    const existing = titleMap.get(normalized);

    titleMap.set(normalized, existing ? preferred(existing, item) : item);
  }

  return Array.from(titleMap.values());
}

/**
 * Normalize URL for comparison
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove common tracking parameters
    parsed.searchParams.delete('utm_source');
    parsed.searchParams.delete('utm_medium');
    parsed.searchParams.delete('utm_campaign');
    parsed.searchParams.delete('ref');
    // Remove trailing slash
    const normalized = parsed.toString().replace(/\/$/, '');
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Normalize title for comparison
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

const STOPWORDS = new Set(
  (
    'a an and are as at be by for from has how in is it its new now of on or ' +
    'our the this to vs we what whats why with you your ' +
    'released release announcing introducing'
  ).split(' ')
);

/** Content words of a title. Versions keep their dots and lose a leading "v". */
export function titleTokens(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, '')
    .replace(/[^\w.\s-]/g, ' ')
    .split(/[\s-]+/)
    .map((word) => word.replace(/^\.+|\.+$/g, '').replace(/^v(?=\d)/, ''))
    .filter((word) => word && !STOPWORDS.has(word));
  return new Set(words);
}

/**
 * Two titles for the same story, such as one announcement covered by two
 * feeds: most content words are shared (Jaccard 0.6+), or the shorter title
 * of 3+ words is almost all inside the longer one.
 */
export function isNearDuplicate(a: string, b: string): boolean {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  for (const word of ta) if (tb.has(word)) shared++;
  const union = ta.size + tb.size - shared;
  const smaller = Math.min(ta.size, tb.size);
  return shared / union >= 0.6 || (smaller >= 3 && shared / smaller >= 0.8);
}
