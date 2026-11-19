import { NewsItem, Digest, DigestMetadata, ProjectReleases, OwnPost } from '../crawler/types.js';
import { generateTitle, generateSummary } from './template.js';
import { pickTop } from './rank.js';

export const CATEGORY_ORDER = [
  'Kubernetes',
  'Cloud Native',
  'CI/CD',
  'IaC',
  'Observability',
  'Security',
  'Databases',
  'Platforms',
  'Misc',
];

/**
 * Group items by category, best score first inside each category.
 */
export function groupByCategory(items: NewsItem[]): Record<string, NewsItem[]> {
  const categories: Record<string, NewsItem[]> = Object.fromEntries(
    CATEGORY_ORDER.map((category) => [category, [] as NewsItem[]])
  );

  for (const item of items) {
    const category = item.category && categories[item.category] ? item.category : 'Misc';
    categories[category].push(item);
  }

  for (const category of Object.keys(categories)) {
    categories[category].sort(
      (a, b) =>
        (b.score ?? 0) - (a.score ?? 0) ||
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }

  return categories;
}

export interface AssembleInput {
  /** The picked items, best first (selectItems output). */
  items: NewsItem[];
  releases: ProjectReleases[];
  ownPosts: OwnPost[];
  week: number;
  year: number;
  date: string;
}

/**
 * Assemble the digest: the top 3 go to "This week in short" and are not
 * repeated in their category.
 */
export function assembleDigest(input: AssembleInput): Digest {
  const { items, releases, ownPosts, week, year, date } = input;
  const topPicks = pickTop(items, 3);
  const rest = items.filter((item) => !topPicks.includes(item));

  const metadata: DigestMetadata = {
    title: generateTitle(week, year),
    date,
    week,
    year,
    summary: generateSummary(topPicks, items.length, week),
  };

  return {
    metadata,
    topPicks,
    categories: groupByCategory(rest),
    releases,
    ownPosts,
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
  let totalItems = digest.topPicks.length;
  const categoryCounts: Record<string, number> = {};
  const sourcesSet = new Set<string>(digest.topPicks.map((item) => item.source));

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
  console.log(`  News items: ${stats.totalItems} (${digest.topPicks.length} top picks)`);
  console.log(`  Unique sources: ${stats.sources.length}`);
  console.log(`  Releases: ${digest.releases.length} projects`);
  console.log(`  DevOps Daily posts: ${digest.ownPosts.length}`);
  console.log('\n  By category:');

  for (const [category, count] of Object.entries(stats.categoryCounts)) {
    if (count > 0) {
      console.log(`    ${category}: ${count}`);
    }
  }
}
