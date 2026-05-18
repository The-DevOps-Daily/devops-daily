import fs from 'fs/promises';
import path from 'path';
import { getPostImagePath } from './image-utils';
import {
  createCachedLoader,
  isFileNotFound,
  readDirectoryFiles,
  readMarkdownFile,
} from './content-loader';

const NEWS_DIR = path.join(process.cwd(), 'content', 'news');

// Define the News type for type safety
export type NewsDigest = {
  title: string;
  slug: string;
  week: number;
  year: number;
  excerpt?: string;
  summary?: string;
  content: string;
  date?: string;
  publishedAt?: string;
  image?: string;
  itemCount?: number;
};

function mapNewsDigest(
  data: Partial<NewsDigest>,
  content: string,
  filename: string,
  year: string
): NewsDigest {
  const weekMatch = filename.match(/week-(\d+)\.md/);
  const week = weekMatch ? parseInt(weekMatch[1], 10) : 0;
  const slug = `${year}-week-${week}`;
  const image = data.image || getPostImagePath(slug, 'news');

  return {
    ...data,
    slug,
    week,
    year: parseInt(year, 10),
    content,
    image,
    excerpt: data.summary || data.excerpt,
  } as NewsDigest;
}

const loadNews = createCachedLoader(async () => {
  try {
    const years = await fs.readdir(NEWS_DIR);
    const allNews: NewsDigest[] = [];

    for (const year of years) {
      const yearPath = path.join(NEWS_DIR, year);
      const stat = await fs.stat(yearPath);

      if (stat.isDirectory()) {
        const files = await readDirectoryFiles(yearPath, '.md');
        const newsItems = await Promise.all(
          files.map((filename) =>
            readMarkdownFile<NewsDigest, Partial<NewsDigest>>(
              path.join(yearPath, filename),
              (data, content) => mapNewsDigest(data, content, filename, year)
            )
          )
        );
        allNews.push(...newsItems);
      }
    }

    return allNews.sort((a, b) => {
      // Sort by year desc, then week desc
      if (a.year !== b.year) {
        return b.year - a.year;
      }
      return b.week - a.week;
    });
  } catch (error) {
    if (isFileNotFound(error)) {
      return [];
    }
    throw error;
  }
});

export async function getAllNews(): Promise<NewsDigest[]> {
  return loadNews();
}

export async function getNewsBySlug(slug: string): Promise<NewsDigest | null> {
  try {
    // Extract year and week from slug (2025-week-47 -> year: 2025, week: 47)
    const match = slug.match(/(\d{4})-week-(\d+)/);
    if (!match) {
      return null;
    }

    const [, year, week] = match;
    const filePath = path.join(NEWS_DIR, year, `week-${week}.md`);

    return await readMarkdownFile<NewsDigest, Partial<NewsDigest>>(
      filePath,
      (data, content, filename) => mapNewsDigest(data, content, filename, year)
    );
  } catch (error) {
    if (isFileNotFound(error)) {
      return null;
    }
    throw error;
  }
}

export async function getLatestNews(limit = 6): Promise<NewsDigest[]> {
  const news = await getAllNews();
  return news.slice(0, limit);
}

export async function getNewsByYear(year: number): Promise<NewsDigest[]> {
  const news = await getAllNews();
  return news.filter((item) => item.year === year);
}

export async function getNewsYears(): Promise<number[]> {
  try {
    const years = await fs.readdir(NEWS_DIR);
    const yearNumbers = years
      .filter((year) => /^\d{4}$/.test(year))
      .map((year) => parseInt(year, 10))
      .sort((a, b) => b - a);
    return yearNumbers;
  } catch (error) {
    if (isFileNotFound(error)) {
      return [];
    }
    throw error;
  }
}
