import fs from 'fs/promises';
import path from 'path';
import matter from '../../../lib/front-matter';
import { OwnPost } from '../crawler/types.js';

/** Reads slug, title and publish time from every post in content/posts. */
export async function loadOwnPosts(postsDir: string): Promise<OwnPost[]> {
  const files = (await fs.readdir(postsDir)).filter((file) => file.endsWith('.md'));
  const posts: OwnPost[] = [];
  for (const file of files) {
    const { data } = matter(await fs.readFile(path.join(postsDir, file), 'utf-8'));
    const when = data.publishedAt ?? data.date;
    const date = when instanceof Date ? when : new Date(String(when ?? ''));
    if (typeof data.title !== 'string' || isNaN(date.getTime())) continue;
    posts.push({
      slug: file.replace(/\.md$/, ''),
      title: data.title,
      publishedAt: date.toISOString(),
    });
  }
  return posts;
}

/**
 * Posts published inside [start, end) and not after `now` (a post with a
 * future date is not live yet), newest first, at most `max`.
 */
export function selectOwnPosts(
  posts: OwnPost[],
  start: Date,
  end: Date,
  now: Date = new Date(),
  max = 6
): OwnPost[] {
  const until = Math.min(end.getTime(), now.getTime());
  return posts
    .filter((post) => /^[a-z0-9][a-z0-9-]*$/.test(post.slug))
    .filter((post) => {
      const t = new Date(post.publishedAt).getTime();
      return t >= start.getTime() && t < until;
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, max);
}
