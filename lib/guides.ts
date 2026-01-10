import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { getGuideImagePath } from './image-utils';

const GUIDES_DIR = path.join(process.cwd(), 'content', 'guides');

// Cache for guides to avoid re-reading files on every request
let guidesCache: Guide[] | null = null;
let lastCacheTime = 0;
// During build, use infinite cache; during runtime, use 5-minute cache
const CACHE_DURATION =
  process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME
    ? Infinity
    : 5 * 60 * 1000;

export type GuidePart = {
  title: string;
  slug: string;
  order?: number;
  content: string;
  description?: string;
};

export type Guide = {
  title: string;
  slug: string;
  description?: string;
  content: string;
  category?: { name: string; slug: string };
  image?: string;
  publishedAt?: string;
  updatedAt?: string;
  author?: { name: string; slug: string };
  tags?: string[];
  parts: GuidePart[];
  partsCount: number;
  readingTime?: string;
};

export type Guides = Guide & {
  category: { name: string; slug: string };
};

async function getGuideDirSlugs() {
  const dirs = await fs.readdir(GUIDES_DIR, { withFileTypes: true });
  return dirs.filter((d) => d.isDirectory()).map((d) => d.name);
}

export async function getAllGuides(): Promise<Guide[]> {
  // Check if cache is still valid
  const now = Date.now();
  if (guidesCache && now - lastCacheTime < CACHE_DURATION) {
    return guidesCache;
  }

  const slugs = await getGuideDirSlugs();
  const guides = await Promise.all(slugs.map((slug) => getGuideBySlug(slug)));

  const sortedGuides = guides
    .filter((guide): guide is Guide => guide !== null && !!guide.publishedAt)
    .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());

  // Update cache
  guidesCache = sortedGuides;
  lastCacheTime = now;

  return sortedGuides;
}

export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  const guideDir = path.join(GUIDES_DIR, slug);
  try {
    const indexFile = await fs.readFile(path.join(guideDir, 'index.md'), 'utf-8');
    const { data, content } = matter(indexFile);
    const image = data.image || getGuideImagePath(slug);

    // Read parts
    const files = await fs.readdir(guideDir);
    const partFiles = files.filter((f) => f !== 'index.md' && f.endsWith('.md'));
    const parts: GuidePart[] = await Promise.all(
      partFiles.map(async (filename) => {
        const partFile = await fs.readFile(path.join(guideDir, filename), 'utf-8');
        const { data: partData, content: partContent } = matter(partFile);
        return {
          ...partData,
          slug: filename.replace(/\.md$/, ''),
          content: partContent,
        } as GuidePart;
      })
    );
    parts.sort((a, b) => (a.order || 0) - (b.order || 0));
    const partsCount = parts.length;
    const readingTime = parts.reduce((total, part) => {
      const words = part.content.split(/\s+/).length;
      // Assuming an average reading speed of 200 wpm
      return total + Math.ceil(words / 200);
    }, 0);

    return {
      ...data,
      slug,
      content,
      image,
      parts,
      partsCount,
      readingTime: `${readingTime} min read`,
    } as Guide;
  } catch {
    return null;
  }
}

export async function getGuidePart(guideSlug: string, partSlug: string): Promise<string | null> {
  const guideDir = path.join(GUIDES_DIR, guideSlug);
  try {
    const partFile = await fs.readFile(path.join(guideDir, `${partSlug}.md`), 'utf-8');
    const { content } = matter(partFile);
    return content;
  } catch {
    return null;
  }
}

export async function getGuidesByCategory(categorySlug: string) {
  const guides = await getAllGuides();
  return guides.filter((guide) => guide?.category?.slug === categorySlug);
}

export async function getGuidesByTag(tag: string) {
  const guides = await getAllGuides();
  return guides.filter((guide) => guide?.tags && guide.tags.includes(tag));
}

export async function getLatestGuides(limit = 4) {
  const guides = await getAllGuides();
  return guides
    .sort(
      (a, b) => new Date(b?.publishedAt || '').getTime() - new Date(a?.publishedAt || '').getTime()
    )
    .slice(0, limit);
}

export async function getRelatedGuides(currentSlug: string, categorySlug: string, limit = 3) {
  const guides = await getAllGuides();
  const currentGuide = guides.find((g) => g.slug === currentSlug);
  const currentTags = currentGuide?.tags || [];
  
  // Filter out current guide
  const candidateGuides = guides.filter((guide) => guide.slug !== currentSlug);
  
  // Score each candidate guide
  const scoredGuides = candidateGuides.map((guide) => {
    let score = 0;
    
    // Tag matches (highest priority: 10 points per matching tag)
    if (guide.tags && currentTags.length > 0) {
      const matchingTags = guide.tags.filter((tag) => currentTags.includes(tag));
      score += matchingTags.length * 10;
    }
    
    // Same category (5 points)
    if (guide.category?.slug === categorySlug) {
      score += 5;
    }
    
    // Recency bonus (2 points for guides published within last 30 days)
    const guideDate = new Date(guide.publishedAt || 0).getTime();
    const daysSincePublished = (Date.now() - guideDate) / (1000 * 60 * 60 * 24);
    if (daysSincePublished < 30) {
      score += 2;
    }
    
    return { guide, score };
  });
  
  // Sort by score (descending) and return top results
  return scoredGuides
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ guide }) => guide);
}
