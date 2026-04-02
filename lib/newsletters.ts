import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const NEWSLETTERS_DIR = path.join(process.cwd(), 'content', 'newsletters');

export interface Newsletter {
  slug: string;
  title: string;
  date: string;
  week: number;
  year: number;
  content: string;
}

export interface NewsletterMeta {
  slug: string;
  title: string;
  date: string;
  week: number;
  year: number;
}

let cache: Newsletter[] | null = null;
let lastCacheTime = 0;
const CACHE_DURATION =
  process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME
    ? Infinity
    : 5 * 60 * 1000;

async function loadNewsletters(): Promise<Newsletter[]> {
  const now = Date.now();
  if (cache && now - lastCacheTime < CACHE_DURATION) return cache;

  try {
    await fs.access(NEWSLETTERS_DIR);
    const files = await fs.readdir(NEWSLETTERS_DIR);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    const newsletters: Newsletter[] = [];

    for (const file of mdFiles) {
      try {
        const raw = await fs.readFile(path.join(NEWSLETTERS_DIR, file), 'utf-8');
        const { data, content } = matter(raw);
        const slug = file.replace(/\.md$/, '');

        newsletters.push({
          slug,
          title: data.title || `Newsletter ${slug}`,
          date: data.date || '',
          week: data.week || 0,
          year: data.year || 0,
          content,
        });
      } catch {
        // skip invalid files
      }
    }

    newsletters.sort((a, b) => b.date.localeCompare(a.date));
    cache = newsletters;
    lastCacheTime = now;
    return newsletters;
  } catch {
    return [];
  }
}

export async function getAllNewsletters(): Promise<NewsletterMeta[]> {
  const all = await loadNewsletters();
  return all.map(({ content, ...meta }) => meta);
}

export async function getNewsletterBySlug(slug: string): Promise<Newsletter | null> {
  const all = await loadNewsletters();
  return all.find((n) => n.slug === slug) || null;
}
