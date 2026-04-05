import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';

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

export async function getAllHacktoberfestDays(): Promise<HacktoberfestDay[]> {
  if (!fs.existsSync(CONTENT_DIR)) return [];

  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.startsWith('day-') && f.endsWith('.md'));

  const days = await Promise.all(
    files.map(async (file) => {
      const slug = file.replace(/\.md$/, '');
      return getHacktoberfestDay(slug);
    })
  );

  return days.filter(Boolean).sort((a, b) => a!.day - b!.day) as HacktoberfestDay[];
}

export async function getHacktoberfestDay(slug: string): Promise<HacktoberfestDay | null> {
  const filePath = path.join(CONTENT_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const fileContents = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(fileContents);

  const processed = await remark().use(html).process(content);

  return {
    title: data.title || '',
    slug,
    day: data.day || 0,
    excerpt: data.excerpt || '',
    difficulty: data.difficulty || 'Beginner',
    time: data.time || '5 min',
    category: data.category || '',
    tags: data.tags || [],
    content: processed.toString(),
  };
}
