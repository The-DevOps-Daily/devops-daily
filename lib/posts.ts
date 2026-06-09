import path from 'path';
import { getPostImagePath } from './image-utils';
import { rankRelatedByScore } from './related-content';
import {
  createCachedLoader,
  isFileNotFound,
  readMarkdownFile,
  readMarkdownFiles,
} from './content-loader';

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts');

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

function mapPost(data: Partial<Post>, content: string, filename: string): Post {
  const slug = filename.replace(/\.md$/, '');
  const image = data.image || getPostImagePath(slug);

  return {
    ...data,
    slug,
    content,
    image,
  } as Post;
}

const loadPosts = createCachedLoader(async () => {
  const posts = await readMarkdownFiles<Post, Partial<Post>>(POSTS_DIR, mapPost);
  return posts.sort((a, b) => {
    const dateA = new Date(a.date ?? a.publishedAt ?? 0);
    const dateB = new Date(b.date ?? b.publishedAt ?? 0);
    return dateB.getTime() - dateA.getTime();
  });
});

export async function getAllPosts(): Promise<Post[]> {
  return loadPosts();
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  // Try to get from cache first
  const posts = await getAllPosts();
  const cachedPost = posts.find((p) => p.slug === slug);

  if (cachedPost) {
    return cachedPost;
  }

  try {
    return await readMarkdownFile<Post, Partial<Post>>(
      path.join(POSTS_DIR, `${slug}.md`),
      mapPost
    );
  } catch (error) {
    if (isFileNotFound(error)) {
      return null;
    }
    throw error;
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

  const candidates = posts
    .filter((post) => post.slug !== currentSlug)
    .map((post) => ({
      item: post,
      tags: post.tags,
      sameCategory: post.category?.slug === categorySlug,
      date: post.publishedAt || post.date || null,
    }));

  return rankRelatedByScore(currentTags, candidates, { limit });
}

export async function getPostsByTag(tag: string) {
  const posts = await getAllPosts();
  return posts.filter((post) => post.tags && post.tags.includes(tag));
}

export async function getLatestPosts(limit = 6) {
  const posts = await getAllPosts();
  return [...posts]
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
