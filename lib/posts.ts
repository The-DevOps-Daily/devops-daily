import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { getPostImagePath } from './image-utils';

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts');

// Cache for posts to avoid re-reading files on every request
let postsCache: Post[] | null = null;
let lastCacheTime = 0;
// During build, use infinite cache; during runtime, use 5-minute cache
const CACHE_DURATION =
  process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME
    ? Infinity
    : 5 * 60 * 1000;

// Define the expected Post type for type safety
export type Post = {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  category?: { name: string; slug: string };
  date?: string;
  publishedAt?: string;
  updatedAt?: string;
  readingTime?: string;
  author?: { name: string; slug: string };
  image?: string;
  tags?: string[];
  featured?: boolean;
};

export async function getAllPosts(): Promise<Post[]> {
  // Check if cache is still valid
  const now = Date.now();
  if (postsCache && now - lastCacheTime < CACHE_DURATION) {
    return postsCache;
  }

  const files = await fs.readdir(POSTS_DIR);
  const posts = await Promise.all(
    files
      .filter((f) => f.endsWith('.md'))
      .map(async (filename) => {
        const filePath = path.join(POSTS_DIR, filename);
        const file = await fs.readFile(filePath, 'utf-8');
        const { data, content } = matter(file);
        const slug = filename.replace(/\.md$/, '');
        const image = data.image || getPostImagePath(slug);

        return {
          ...data,
          slug,
          content,
          image,
        } as Post;
      })
  );

  const sortedPosts = posts.sort((a, b) => {
    const dateA = new Date(a.date ?? a.publishedAt ?? 0);
    const dateB = new Date(b.date ?? b.publishedAt ?? 0);
    return dateB.getTime() - dateA.getTime();
  });

  // Update cache
  postsCache = sortedPosts;
  lastCacheTime = now;

  return sortedPosts;
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  // Try to get from cache first
  const posts = await getAllPosts();
  const cachedPost = posts.find((p) => p.slug === slug);

  if (cachedPost) {
    return cachedPost;
  }

  // If not in cache, try to load directly (fallback)
  const filePath = path.join(POSTS_DIR, `${slug}.md`);
  try {
    const file = await fs.readFile(filePath, 'utf-8');
    const { data, content } = matter(file);
    const image = data.image || getPostImagePath(slug);

    return {
      ...data,
      slug,
      content,
      image,
    } as Post;
  } catch {
    return null;
  }
}

export async function getPostsByCategory(categorySlug: string) {
  const posts = await getAllPosts();
  return posts.filter((post) => post.category?.slug === categorySlug);
}

export async function getRelatedPosts(currentSlug: string, categorySlug: string, limit = 3) {
  const posts = await getAllPosts();
  const currentPost = posts.find((p) => p.slug === currentSlug);
  const currentTags = currentPost?.tags || [];
  const candidatePosts = posts.filter((post) => post.slug !== currentSlug);
  const scoredPosts = candidatePosts.map((post) => {
    let score = 0;
    if (post.tags && currentTags.length > 0) {
      const matchingTags = post.tags.filter((tag) => currentTags.includes(tag));
      score += matchingTags.length * 10;
    }
    if (post.category?.slug === categorySlug) {
      score += 5;
    }
    const postDate = new Date(post.publishedAt || post.date || 0).getTime();
    const daysSincePublished = (Date.now() - postDate) / (1000 * 60 * 60 * 24);
    if (daysSincePublished < 30) {
      score += 2;
    }
    return { post, score };
  });
  return scoredPosts.sort((a, b) => b.score - a.score).slice(0, limit).map(({ post }) => post);
}

export async function getPostsByTag(tag: string) {
  const posts = await getAllPosts();
  return posts.filter((post) => post.tags && post.tags.includes(tag));
}

export async function getLatestPosts(limit = 6) {
  const posts = await getAllPosts();
  return posts
    .sort(
      (a, b) =>
        new Date(b.publishedAt || b.date || '').getTime() -
        new Date(a.publishedAt || a.date || '').getTime()
    )
    .slice(0, limit);
}

export async function getFeaturedPosts(limit = 3): Promise<Post[]> {
  const posts = await getAllPosts();
  return posts
    .filter((post) => post.featured === true)
    .sort(
      (a, b) =>
        new Date(b.publishedAt || b.date || '').getTime() -
        new Date(a.publishedAt || a.date || '').getTime()
    )
    .slice(0, limit);
}
