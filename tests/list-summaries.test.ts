import { describe, expect, it } from 'vitest';
import { toPostSummary, type Post } from '@/lib/posts';
import { toGuideCard, type Guide } from '@/lib/guides';

// List pages send one summary per item to the client, so these stay small.
describe('list summaries', () => {
  it('keeps only the post fields the list card and its search use', () => {
    const post: Post = {
      title: 'Title',
      slug: 'a-post',
      excerpt: 'Excerpt',
      content: 'Body',
      category: { name: 'Kubernetes', slug: 'kubernetes' },
      date: '2026-11-13',
      publishedAt: '2026-11-13T07:00:00Z',
      updatedAt: '2026-11-13T07:00:00Z',
      readingTime: '5 min read',
      author: { name: 'DevOps Daily Team', slug: 'devops-daily-team' },
      image: '/images/posts/a-post.jpg',
      tags: ['Kubernetes', 'Networking'],
      featured: false,
      sponsorCampaign: 'campaign',
    };

    expect(toPostSummary(post)).toEqual({
      slug: 'a-post',
      title: 'Title',
      excerpt: 'Excerpt',
      categoryName: 'Kubernetes',
      date: '2026-11-13',
      readingTime: '5 min read',
      tags: ['Kubernetes', 'Networking'],
    });
  });

  it('leaves out empty post fields instead of sending undefined', () => {
    const summary = toPostSummary({ title: 'T', slug: 's', content: '' });
    expect(Object.keys(summary)).toEqual(['slug', 'title']);
  });

  it('keeps only what an expert page guide card shows', () => {
    const guide: Guide = {
      title: 'Guide',
      slug: 'a-guide',
      description: 'Description',
      content: 'Body',
      tags: ['Security'],
      parts: [
        { title: 'One', slug: 'one', content: 'Part body' },
        { title: 'Two', slug: 'two', content: 'Part body' },
      ],
      partsCount: 2,
    };

    expect(toGuideCard(guide)).toEqual({
      slug: 'a-guide',
      title: 'Guide',
      description: 'Description',
      partsCount: 2,
    });
  });
});
