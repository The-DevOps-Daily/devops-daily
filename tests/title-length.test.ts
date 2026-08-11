import { describe, it, expect } from 'vitest';
import { getAllPosts } from '@/lib/posts';

/**
 * Bing flags any <title> over 70 characters as liable to be truncated or
 * ignored, and it reported 36 of our pages. Google clips around the same
 * point, so an over-long title mostly costs the end of the sentence in the
 * result, which is usually the part that says what the page is.
 *
 * `seoTitle` shortens the tag without touching the headline a reader sees,
 * the same field guides and games already use.
 */
const MAX_TITLE = 70;

describe('search result titles', () => {
  it('keeps every post title tag within the limit', async () => {
    const posts = (await getAllPosts()) as Array<{
      slug: string;
      title: string;
      seoTitle?: string;
    }>;

    const tooLong = posts
      .map((p) => ({ slug: p.slug, title: p.seoTitle || p.title }))
      .filter((p) => p.title.length > MAX_TITLE)
      .map((p) => `${p.slug} (${p.title.length}): ${p.title}`);

    // Fix by adding a shorter `seoTitle` to the post's frontmatter, not by
    // rewriting the headline, unless the headline is genuinely too long.
    expect(tooLong, `posts whose title tag exceeds ${MAX_TITLE} characters`).toEqual([]);
  });

  it('does not set a seoTitle that is longer than the title it replaces', async () => {
    const posts = (await getAllPosts()) as Array<{
      slug: string;
      title: string;
      seoTitle?: string;
    }>;

    const pointless = posts
      .filter((p) => p.seoTitle && p.seoTitle.length >= p.title.length)
      .map((p) => p.slug);

    expect(pointless, 'seoTitle should be shorter than title').toEqual([]);
  });
});
