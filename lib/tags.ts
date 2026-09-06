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

/**
 * Count tags across content items by their slug, so `Docker Compose` and
 * `docker-compose` share one entry. Each item counts at most once per slug,
 * and the first spelling seen becomes the display name.
 */
export function countTags(tagLists: Array<string[] | undefined>): Tag[] {
  const tagMap = new Map<string, { name: string; count: number }>();

  for (const tags of tagLists) {
    if (!tags) continue;
    const seen = new Set<string>();
    for (const tag of tags) {
      const slug = tagToSlug(tag);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      const existing = tagMap.get(slug);
      if (existing) {
        existing.count += 1;
      } else {
        tagMap.set(slug, { name: tag, count: 1 });
      }
    }
  }

  return Array.from(tagMap.entries())
    .map(([slug, { name, count }]) => ({ name, slug, count }))
    .sort((a, b) => b.count - a.count);
}

/** True when any of the item's tags normalizes to the given slug. */
export function hasTagSlug(tags: string[] | undefined, tagSlug: string): boolean {
  return !!tags && tags.some((tag) => tagToSlug(tag) === tagSlug);
}

export async function getAllTags(): Promise<Tag[]> {
  const posts = (await getAllPosts()) as Post[];
  const guides = (await getAllGuides()) as Guide[];

  return countTags([...posts.map((post) => post.tags), ...guides.map((guide) => guide.tags)]);
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
  const posts = await getAllPosts();
  return posts.filter((post) => hasTagSlug(post.tags, tagSlug));
}

export async function getGuidesByTagSlug(tagSlug: string): Promise<Guide[]> {
  const guides = await getAllGuides();
  return guides.filter((guide) => hasTagSlug(guide.tags, tagSlug));
}
