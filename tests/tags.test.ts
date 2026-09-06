import { describe, it, expect } from 'vitest';
import { countTags, hasTagSlug, getAllTags, getPostsByTagSlug, getGuidesByTagSlug } from '@/lib/tags';

describe('countTags', () => {
  it('merges spellings that share a slug and keeps the first spelling as the name', () => {
    const tags = countTags([['Docker Compose'], ['docker-compose'], ['Next.js'], ['nextjs']]);
    expect(tags).toEqual([
      { name: 'Docker Compose', slug: 'docker-compose', count: 2 },
      { name: 'Next.js', slug: 'nextjs', count: 2 },
    ]);
  });

  it('counts an item once per slug even when it repeats the tag', () => {
    const tags = countTags([['Kubernetes', 'kubernetes', 'k8s']]);
    expect(tags).toEqual([
      { name: 'Kubernetes', slug: 'kubernetes', count: 1 },
      { name: 'k8s', slug: 'k8s', count: 1 },
    ]);
  });

  it('skips missing tag lists and tags that slug to nothing', () => {
    expect(countTags([undefined, ['!!!'], ['a']])).toEqual([{ name: 'a', slug: 'a', count: 1 }]);
  });
});

describe('hasTagSlug', () => {
  it('matches any spelling that normalizes to the slug', () => {
    expect(hasTagSlug(['Docker Compose'], 'docker-compose')).toBe(true);
    expect(hasTagSlug(['docker-compose'], 'docker-compose')).toBe(true);
    expect(hasTagSlug(['Docker'], 'docker-compose')).toBe(false);
    expect(hasTagSlug(undefined, 'docker')).toBe(false);
  });
});

describe('tag pages over the real content', () => {
  it('lists exactly as many items on a tag page as the tag count says', async () => {
    const tags = await getAllTags();
    for (const tag of tags.slice(0, 40)) {
      const [posts, guides] = await Promise.all([getPostsByTagSlug(tag.slug), getGuidesByTagSlug(tag.slug)]);
      expect(posts.length + guides.length, tag.slug).toBe(tag.count);
    }
  });
});
