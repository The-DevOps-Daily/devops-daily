import path from 'path';
import {
  createCachedLoader,
  isFileNotFound,
  readMarkdownFile,
  readMarkdownFiles,
} from './content-loader';

const CONTENT_DIR = path.join(process.cwd(), 'content/hacktoberfest');

export interface HacktoberfestDay {
  title: string;
  slug: string;
  day: number;
  excerpt: string;
  difficulty: string;
  time: string;
  category: string;
  tags: string[];
  content: string;
}

function mapHacktoberfestDay(
  data: Partial<HacktoberfestDay>,
  content: string,
  filename: string
): HacktoberfestDay {
  const slug = filename.replace(/\.md$/, '');

  return {
    title: data.title || '',
    slug,
    day: data.day || 0,
    excerpt: data.excerpt || '',
    difficulty: data.difficulty || 'Beginner',
    time: data.time || '5 min',
    category: data.category || '',
    tags: data.tags || [],
    content,
  };
}

const loadHacktoberfestDays = createCachedLoader(async () => {
  try {
    const days = await readMarkdownFiles<HacktoberfestDay, Partial<HacktoberfestDay>>(
      CONTENT_DIR,
      mapHacktoberfestDay
    );

    return days
      .filter((day) => day.slug.startsWith('day-'))
      .sort((a, b) => a.day - b.day);
  } catch (error) {
    if (isFileNotFound(error)) {
      return [];
    }
    throw error;
  }
});

export async function getAllHacktoberfestDays(): Promise<HacktoberfestDay[]> {
  return loadHacktoberfestDays();
}

export async function getHacktoberfestDay(slug: string): Promise<HacktoberfestDay | null> {
  try {
    return await readMarkdownFile<HacktoberfestDay, Partial<HacktoberfestDay>>(
      path.join(CONTENT_DIR, `${slug}.md`),
      mapHacktoberfestDay
    );
  } catch (error) {
    if (isFileNotFound(error)) {
      return null;
    }
    throw error;
  }
}
