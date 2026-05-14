import path from 'path';
import { getAdventImagePath } from './image-utils';
import {
  createCachedLoader,
  isFileNotFound,
  readMarkdownFile,
  readMarkdownFiles,
} from './content-loader';

const ADVENT_DIR = path.join(process.cwd(), 'content', 'advent-of-devops');

export type AdventDay = {
  title: string;
  slug: string;
  day: number;
  excerpt?: string;
  description?: string;
  content: string;
  category?: string;
  difficulty?: string;
  publishedAt?: string;
  updatedAt?: string;
  image?: string;
  tags?: string[];
};

export type AdventIndex = {
  title: string;
  slug: string;
  excerpt?: string;
  description?: string;
  content: string;
  publishedAt?: string;
  updatedAt?: string;
  tags?: string[];
};

function mapAdventDay(data: Partial<AdventDay>, content: string, filename: string): AdventDay {
  const slug = filename.replace(/\.md$/, '');
  const image = data.image || getAdventImagePath(slug);

  return {
    ...data,
    slug,
    content,
    image,
    day: data.day || parseInt(slug.replace('day-', ''), 10),
  } as AdventDay;
}

const loadAdventDays = createCachedLoader(async () => {
  const days = await readMarkdownFiles<AdventDay, Partial<AdventDay>>(
    ADVENT_DIR,
    mapAdventDay
  );

  return days.filter((day) => day.slug.startsWith('day-')).sort((a, b) => a.day - b.day);
});

const loadAdventIndex = createCachedLoader(() =>
  readMarkdownFile<AdventIndex, Partial<AdventIndex>>(
    path.join(ADVENT_DIR, 'index.md'),
    (data, content) =>
      ({
        ...data,
        slug: 'advent-of-devops',
        content,
      }) as AdventIndex
  )
);

export async function getAllAdventDays(): Promise<AdventDay[]> {
  return loadAdventDays();
}

export async function getAdventDayBySlug(slug: string): Promise<AdventDay | null> {
  const days = await getAllAdventDays();
  const cachedDay = days.find((d) => d.slug === slug);

  if (cachedDay) {
    return cachedDay;
  }

  try {
    return await readMarkdownFile<AdventDay, Partial<AdventDay>>(
      path.join(ADVENT_DIR, `${slug}.md`),
      mapAdventDay
    );
  } catch (error) {
    if (isFileNotFound(error)) {
      return null;
    }
    throw error;
  }
}

export async function getAdventDayByNumber(dayNumber: number): Promise<AdventDay | null> {
  return getAdventDayBySlug(`day-${dayNumber}`);
}

export async function getAdventIndex(): Promise<AdventIndex | null> {
  try {
    return await loadAdventIndex();
  } catch (error) {
    if (isFileNotFound(error)) {
      return null;
    }
    throw error;
  }
}

export async function getNextAdventDay(currentDay: number): Promise<AdventDay | null> {
  if (currentDay >= 25) return null;
  return getAdventDayByNumber(currentDay + 1);
}

export async function getPreviousAdventDay(currentDay: number): Promise<AdventDay | null> {
  if (currentDay <= 1) return null;
  return getAdventDayByNumber(currentDay - 1);
}

export async function getAdventProgress(): Promise<{
  totalDays: number;
  completedDays: number;
  percentComplete: number;
}> {
  const days = await getAllAdventDays();
  const today = new Date();
  const december = today.getMonth() === 11; // December is month 11
  const dayOfMonth = today.getDate();

  const completedDays = december && dayOfMonth <= 25 ? dayOfMonth : 25;

  return {
    totalDays: 25,
    completedDays,
    percentComplete: (completedDays / 25) * 100,
  };
}
