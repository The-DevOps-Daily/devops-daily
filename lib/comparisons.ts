import fs from 'fs/promises';
import path from 'path';
import type { Comparison } from './comparison-types';

const COMPARISONS_DIR = path.join(process.cwd(), 'content', 'comparisons');

// Cache for comparisons to avoid re-reading files on every request
let comparisonsCache: Comparison[] | null = null;
let lastCacheTime = 0;
// During build, use infinite cache; during runtime, use 5-minute cache
const CACHE_DURATION =
  process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME
    ? Infinity
    : 5 * 60 * 1000;

async function loadComparisonsFromFiles(): Promise<Comparison[]> {
  // Check if cache is still valid
  const now = Date.now();
  if (comparisonsCache && now - lastCacheTime < CACHE_DURATION) {
    return comparisonsCache;
  }

  try {
    // Check if comparisons directory exists
    await fs.access(COMPARISONS_DIR);

    // Read all JSON files from the comparisons directory
    const files = await fs.readdir(COMPARISONS_DIR);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));

    const comparisons: Comparison[] = [];

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(COMPARISONS_DIR, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const comparison = JSON.parse(fileContent) as Comparison;
        comparisons.push(comparison);
      } catch (error) {
        console.warn(`Failed to parse comparison file ${file}:`, error);
      }
    }

    // Update cache
    comparisonsCache = comparisons;
    lastCacheTime = now;

    return comparisons;
  } catch (error) {
    console.warn('Failed to load comparisons from files:', error);
    return [];
  }
}

export async function getAllComparisons(): Promise<Comparison[]> {
  const comparisons = await loadComparisonsFromFiles();
  // Sort by createdDate (when the comparison was first published) so the
  // index page reads as "newest first". updatedDate isn't used because
  // some legacy entries carry future-dated updatedDate values that would
  // push them ahead of genuinely new content.
  return comparisons.sort(
    (a: Comparison, b: Comparison) =>
      new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
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
