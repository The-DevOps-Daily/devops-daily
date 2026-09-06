import { NewsItem, Digest, DigestMetadata } from '../crawler/types.js';
import { getIsoWeekAndYear, formatISODate } from '../utils/date.js';
import { generateTitle, generateSummary } from './template.js';

/**
 * Group items by category
 */
export function groupByCategory(items: NewsItem[]): Record<string, NewsItem[]> {
  const categories: Record<string, NewsItem[]> = {
    Kubernetes: [],
    'Cloud Native': [],
    'CI/CD': [],
    IaC: [],
    Observability: [],
    Security: [],
    Databases: [],
    Platforms: [],
    Misc: [],
  };

  for (const item of items) {
    const category = item.category || 'Misc';
    if (categories[category]) {
      categories[category].push(item);
    } else {
      categories.Misc.push(item);
    }
  }

  // Sort items within each category by date (most recent first)
  for (const category of Object.keys(categories)) {
    categories[category].sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }

  return categories;
}

/**
 * Assemble digest from items
 */
export function assembleDigest(
  items: NewsItem[],
  week?: number,
  year?: number
): Digest {
  const now = getIsoWeekAndYear();
  const w = week || now.week;
  const y = year || now.year;

  const metadata: DigestMetadata = {
    title: generateTitle(w, y),
    date: formatISODate(),
    week: w,
    year: y,
    summary: generateSummary(),
  };

  const categories = groupByCategory(items);

  return {
    metadata,
    categories,
  };
}

/**
 * Get statistics about the digest
 */
export function getDigestStats(digest: Digest): {
  totalItems: number;
  categoryCounts: Record<string, number>;
  sources: string[];
} {
  let totalItems = 0;
  const categoryCounts: Record<string, number> = {};
  const sourcesSet = new Set<string>();

  for (const [category, items] of Object.entries(digest.categories)) {
    categoryCounts[category] = items.length;
    totalItems += items.length;

    for (const item of items) {
      sourcesSet.add(item.source);
    }
  }

  return {
    totalItems,
    categoryCounts,
    sources: Array.from(sourcesSet),
  };
}

/**
 * Print digest statistics
 */
export function printStats(digest: Digest): void {
  const stats = getDigestStats(digest);

  console.log('\n📊 Digest Statistics:');
  console.log(`  Total items: ${stats.totalItems}`);
  console.log(`  Unique sources: ${stats.sources.length}`);
  console.log('\n  By category:');

  for (const [category, count] of Object.entries(stats.categoryCounts)) {
    if (count > 0) {
      console.log(`    ${category}: ${count}`);
    }
  }
}
