import path from 'path';
import type { Comparison } from './comparison-types';
import { createCachedLoader, readJsonFiles } from './content-loader';

const COMPARISONS_DIR = path.join(process.cwd(), 'content', 'comparisons');

const loadComparisonsFromFiles = createCachedLoader(() =>
  readJsonFiles<Comparison>(COMPARISONS_DIR)
);

export async function getAllComparisons(): Promise<Comparison[]> {
  const comparisons = await loadComparisonsFromFiles();
  return [...comparisons].sort(
    (a: Comparison, b: Comparison) =>
      new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime()
  );
}

export async function getComparisonBySlug(slug: string): Promise<Comparison | null> {
  const comparisons = await getAllComparisons();
  return comparisons.find((comparison) => comparison.slug === slug) || null;
}

export async function getComparisonsByCategory(category: string): Promise<Comparison[]> {
  const comparisons = await getAllComparisons();
  return comparisons.filter((comparison) => comparison.category === category);
}

export async function getComparisonCategories(): Promise<string[]> {
  const comparisons = await getAllComparisons();
  return Array.from(new Set(comparisons.map((c) => c.category))).sort();
}
