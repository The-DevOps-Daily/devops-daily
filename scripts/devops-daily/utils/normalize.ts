import { NewsItem } from '../crawler/types.js';

/**
 * Normalize a news item
 */
export function normalizeItem(item: NewsItem): NewsItem {
  return {
    ...item,
    title: normalizeTitle(item.title),
    url: normalizeUrl(item.url),
    excerpt: item.excerpt ? normalizeExcerpt(item.excerpt) : '',
    publishedAt: normalizeDate(item.publishedAt),
  };
}

/**
 * Normalize multiple items
 */
export function normalizeItems(items: NewsItem[]): NewsItem[] {
  return items.map(normalizeItem);
}

/**
 * Normalize title
 */
function normalizeTitle(title: string): string {
  // Feed titles are untrusted and end up in markdown: strip any tags and
  // keep angle brackets encoded so they stay text when rendered.
  return title
    .trim()
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .replace(/\n/g, ' ')            // Remove newlines
    .replace(/&amp;/g, '&')         // Decode HTML entities
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[.*?\]/g, '')        // Remove [tags]
    .trim();
}

/**
 * Normalize URL
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Only web links are followed; anything else would become a live
    // javascript:/data: link in the digest.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Normalize excerpt/description
 */
function normalizeExcerpt(excerpt: string): string {
  return excerpt
    .trim()
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .replace(/\n/g, ' ')            // Remove newlines
    .replace(/<[^>]*>/g, '')        // Remove HTML tags
    .replace(/&amp;/g, '&')         // Decode HTML entities
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .substring(0, 500)              // Limit length
    .trim();
}

/**
 * Normalize date to ISO format
 */
function normalizeDate(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
      return new Date().toISOString();
    }
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
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
