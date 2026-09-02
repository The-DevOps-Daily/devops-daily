import { getAllPosts } from './posts';
import { getAllGuides } from './guides';
import { tagToSlug } from './tag-utils';
import type { Post } from './posts';
import type { Guide } from './guides';

export type Tag = {
  name: string;
  slug: string;
  count: number;
};

export async function getAllTags(): Promise<Tag[]> {
  const posts = (await getAllPosts()) as Post[];
  const guides = (await getAllGuides()) as Guide[];

  // Collect all tags from posts and guides
  // Use slug as key to handle both case-insensitive duplicates and slug conflicts
  const tagMap = new Map<string, { name: string; count: number }>();

  const processTag = (tag: string) => {
    const slug = tagToSlug(tag);
    const existing = tagMap.get(slug);

    if (existing) {
      // Increment count, keep the first occurrence's casing
      tagMap.set(slug, {
        name: existing.name,
        count: existing.count + 1,
      });
    } else {
      // First occurrence - use this tag's casing
      tagMap.set(slug, {
        name: tag,
        count: 1,
      });
    }
  };

  // Process post tags
  posts.forEach((post) => {
    if (post.tags) {
      post.tags.forEach(processTag);
    }
  });

  // Process guide tags
  guides.forEach((guide) => {
    if (guide.tags) {
      guide.tags.forEach(processTag);
    }
  });

  // Convert to array and sort by count (descending)
  const tags = Array.from(tagMap.entries()).map(([slug, { name, count }]) => ({
    name,
    slug,
    count,
  }));

  return tags.sort((a, b) => b.count - a.count);
}

// A tag used by fewer than this many items doesn't get its own page. A two- or
// three-item archive is a thin near-duplicate of the posts it lists, and Search
// Console showed those archives being crawled and then declined. Raising this
// from 2 to 5 drops ~150 such pages. Reversible knob: lower it again if the
// tag pages ever earn their keep.
export const MIN_TAG_PAGE_COUNT = 5;

// Tags that get their own page (count >= threshold). Used for route generation,
// the tags index, and to decide which tag chips link out.
export async function getPagedTags(): Promise<Tag[]> {
  const tags = await getAllTags();
  return tags.filter((t) => t.count >= MIN_TAG_PAGE_COUNT);
}

export async function getLinkableTagSlugs(): Promise<Set<string>> {
  const tags = await getPagedTags();
  return new Set(tags.map((t) => t.slug));
}

export async function getTagBySlug(slug: string): Promise<string | null> {
  const tags = await getAllTags();
  const tag = tags.find((t) => t.slug === slug);
  return tag ? tag.name : null;
}

export async function getPostsByTagSlug(tagSlug: string): Promise<Post[]> {
  const actualTag = await getTagBySlug(tagSlug);
  if (!actualTag) return [];

  const posts = await getAllPosts();
  return posts.filter(
    (post) => post.tags && post.tags.some((tag) => tag.toLowerCase() === actualTag.toLowerCase())
  );
}

export async function getGuidesByTagSlug(tagSlug: string): Promise<Guide[]> {
  const actualTag = await getTagBySlug(tagSlug);
  if (!actualTag) return [];

  const guides = await getAllGuides();
  return guides.filter(
    (guide) => guide.tags && guide.tags.some((tag) => tag.toLowerCase() === actualTag.toLowerCase())
  );
}
