import fs from 'fs/promises';
import path from 'path';
import { getGuideImagePath } from './image-utils';
import {
  CONTENT_CACHE_DURATION,
  createCachedLoader,
  isFileNotFound,
  readMarkdownFile,
} from './content-loader';
import { rankRelatedByScore } from './related-content';

const GUIDES_DIR = path.join(process.cwd(), 'content', 'guides');

export type GuidePart = {
  title: string;
  slug: string;
  order?: number;
  content: string;
  description?: string;
};

/** A guide without part bodies, for list pages rendered by client components. */
export type GuideSummary = Omit<Guide, 'content' | 'parts'> & {
  parts: Array<Omit<GuidePart, 'content'>>;
};

export function toGuideSummary(guide: Guide): GuideSummary {
  const { content: _content, parts, ...rest } = guide;
  return { ...rest, parts: parts.map(({ content: _c, ...part }) => part) };
}

/** Just what the client-side guide sidebar needs: titles and slugs, no bodies. */
export type GuideNav = {
  title: string;
  slug: string;
  parts: Array<{ title: string; slug: string }>;
};

export function toGuideNav(guide: Guide): GuideNav {
  return {
    title: guide.title,
    slug: guide.slug,
    parts: guide.parts.map(({ title, slug }) => ({ title, slug })),
  };
}

export type Guide = {
  title: string;
  /**
   * Optional longer title used only for the <title> tag and OG/Twitter
   * cards. Display headings stay short; the page title can carry more
   * descriptive text for search engines when the natural title is too
   * brief on its own.
   */
  seoTitle?: string;
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

const loadGuides = createCachedLoader(async () => {
  const slugs = await getGuideDirSlugs();
  const guides = await Promise.all(slugs.map((slug) => getGuideBySlug(slug)));

  return guides
    .filter((guide): guide is Guide => guide !== null && !!guide.publishedAt)
    .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());
});

export async function getAllGuides(): Promise<Guide[]> {
  return loadGuides();
}

async function loadGuide(slug: string): Promise<Guide | null> {
  const guideDir = path.join(GUIDES_DIR, slug);
  try {
    const guide = await readMarkdownFile<Guide, Partial<Guide>>(
      path.join(guideDir, 'index.md'),
      async (data, content) => {
        const image = data.image || getGuideImagePath(slug);

        // Read parts
        const files = await fs.readdir(guideDir);
        const partFiles = files.filter((f) => f !== 'index.md' && f.endsWith('.md'));
        const parts: GuidePart[] = await Promise.all(
          partFiles.map((filename) =>
            readMarkdownFile<GuidePart, Partial<GuidePart>>(
              path.join(guideDir, filename),
              (partData, partContent) =>
                ({
                  ...partData,
                  slug: filename.replace(/\.md$/, ''),
                  content: partContent,
                }) as GuidePart
            )
          )
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
      }
    );

    return guide;
  } catch (error) {
    if (isFileNotFound(error)) {
      return null;
    }
    throw error;
  }
}

// Per-slug promise cache so metadata + page renders (and getAllGuides) share one read.
const guideCache = new Map<string, { promise: Promise<Guide | null>; loadedAt: number }>();

export function getGuideBySlug(slug: string): Promise<Guide | null> {
  const now = Date.now();
  const cached = guideCache.get(slug);
  if (cached && now - cached.loadedAt < CONTENT_CACHE_DURATION) {
    return cached.promise;
  }

  const promise = loadGuide(slug).catch((error) => {
    guideCache.delete(slug);
    throw error;
  });
  guideCache.set(slug, { promise, loadedAt: now });
  return promise;
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
  return [...guides]
    .sort(
      (a, b) => new Date(b?.publishedAt || '').getTime() - new Date(a?.publishedAt || '').getTime()
    )
    .slice(0, limit);
}

export async function getRelatedGuides(currentSlug: string, categorySlug: string, limit = 3) {
  const guides = await getAllGuides();
  const currentGuide = guides.find((g) => g.slug === currentSlug);
  const currentTags = currentGuide?.tags || [];

  const candidates = guides
    .filter((guide) => guide.slug !== currentSlug)
    .map((guide) => ({
      item: guide,
      tags: guide.tags,
      sameCategory: guide.category?.slug === categorySlug,
      date: guide.publishedAt || null,
    }));

  return rankRelatedByScore(currentTags, candidates, { limit });
}
