import path from 'path';
import { getAllPosts } from './posts';
import { getAllGuides } from './guides';
import { isFileNotFound, readMarkdownFile, readMarkdownFiles } from './content-loader';

const CATEGORIES_DIR = path.join(process.cwd(), 'content', 'categories');

export type Category = {
  name: string;
  slug: string;
  description?: string;
  longDescription?: string;
  icon?: string;
  color?: string;
  count?: number;
};

// Icon mapping for categories (you can expand this)
const iconMap: Record<string, string> = {
  kubernetes: 'Layers',
  terraform: 'Server',
  docker: 'Database',
  'ci-cd': 'Workflow',
  cloud: 'Cloud',
  git: 'GitBranch',
  security: 'Lock',
  cli: 'Terminal',
  code: 'Code',
};

// Color mapping for categories
const colorMap: Record<string, string> = {
  kubernetes: 'bg-blue-500/10 text-blue-500',
  terraform: 'bg-purple-500/10 text-purple-500',
  docker: 'bg-cyan-500/10 text-cyan-500',
  'ci-cd': 'bg-green-500/10 text-green-500',
  cloud: 'bg-orange-500/10 text-orange-500',
  git: 'bg-red-500/10 text-red-500',
  security: 'bg-yellow-500/10 text-yellow-500',
  cli: 'bg-indigo-500/10 text-indigo-500',
  code: 'bg-pink-500/10 text-pink-500',
};

export async function getAllCategories(): Promise<Category[]> {
  // Get all posts and guides to count them
  const [posts, guides] = await Promise.all([getAllPosts(), getAllGuides()]);

  // Count posts and guides by category
  const categoryCount = new Map<string, number>();

  // Count posts
  posts.forEach((post) => {
    if (post.category?.slug) {
      const count = categoryCount.get(post.category.slug) || 0;
      categoryCount.set(post.category.slug, count + 1);
    }
  });

  // Count guides
  guides.forEach((guide) => {
    if (guide.category?.slug) {
      const count = categoryCount.get(guide.category.slug) || 0;
      categoryCount.set(guide.category.slug, count + 1);
    }
  });

  const categories = await readMarkdownFiles<Category, Partial<Category>>(
    CATEGORIES_DIR,
    (data, _content, filename) => {
      const slug = filename.replace(/\.md$/, '');

      return {
        ...data,
        slug,
        icon: data.icon || iconMap[slug],
        color: data.color || colorMap[slug],
        count: categoryCount.get(slug) || 0,
      } as Category;
    }
  );

  // Sort by count (descending) then by name
  return categories.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.name.localeCompare(b.name);
  });
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    // Get count for this specific category
    const [posts, guides] = await Promise.all([getAllPosts(), getAllGuides()]);

    let count = 0;
    posts.forEach((post) => {
      if (post.category?.slug === slug) count++;
    });
    guides.forEach((guide) => {
      if (guide.category?.slug === slug) count++;
    });

    return await readMarkdownFile<Category, Partial<Category>>(
      path.join(CATEGORIES_DIR, `${slug}.md`),
      (data) =>
        ({
          ...data,
          slug,
          icon: data.icon || iconMap[slug],
          color: data.color || colorMap[slug],
          count,
        }) as Category
    );
  } catch (error) {
    if (isFileNotFound(error)) {
      return null;
    }
    throw error;
  }
}

export async function getCategoriesWithCounts(): Promise<Map<string, number>> {
  const [posts, guides] = await Promise.all([getAllPosts(), getAllGuides()]);

  const categoryCount = new Map<string, number>();

  // Count posts
  posts.forEach((post) => {
    if (post.category?.slug) {
      const count = categoryCount.get(post.category.slug) || 0;
      categoryCount.set(post.category.slug, count + 1);
    }
  });

  // Count guides
  guides.forEach((guide) => {
    if (guide.category?.slug) {
      const count = categoryCount.get(guide.category.slug) || 0;
      categoryCount.set(guide.category.slug, count + 1);
    }
  });

  return categoryCount;
}
