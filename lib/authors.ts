import { getAllPosts } from './posts';
import type { Post } from './posts';

export interface AuthorProfile {
  slug: string;
  name: string;
  bio?: string;
}

/**
 * Minimal author registry. Extend this as individual authors are added.
 * Unknown slugs fall back to "DevOps Daily Team" on the author page so
 * legacy posts don't 404.
 */
export const AUTHORS: AuthorProfile[] = [
  {
    slug: 'devops-daily-team',
    name: 'DevOps Daily Team',
    bio:
      'Articles by the DevOps Daily editorial team — field-tested guides, incident write-ups, and tooling deep dives for engineers who prefer a terminal over a slide deck.',
  },
];

export function getAuthorBySlug(slug: string): AuthorProfile | undefined {
  return AUTHORS.find((a) => a.slug === slug);
}

export async function getPostsByAuthor(slug: string): Promise<Post[]> {
  const posts = await getAllPosts();
  return posts.filter((p) => p.author?.slug === slug);
}

/** Slugs that have at least one post attributed to them. */
export async function getAuthorSlugsWithPosts(): Promise<string[]> {
  const posts = await getAllPosts();
  const set = new Set<string>();
  for (const p of posts) {
    if (p.author?.slug) set.add(p.author.slug);
  }
  return Array.from(set);
}
