import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkHtml from 'remark-html';
import { createCachedLoader, formatUnknownError, readDirectoryFiles } from './content-loader';

const NEWSLETTERS_DIR = path.join(process.cwd(), 'content', 'newsletters');

export interface Newsletter {
  slug: string;
  title: string;
  /** Optional per-newsletter description used as the page meta description.
   *  Falls back to a generic templated string in app/newsletters/[slug] when
   *  not set in the markdown frontmatter. */
  description?: string;
  date: string;
  week: number;
  year: number;
  content: string;
}

export interface NewsletterMeta {
  slug: string;
  title: string;
  description?: string;
  date: string;
  week: number;
  year: number;
}

const loadNewsletters = createCachedLoader(async () => {
  const mdFiles = await readDirectoryFiles(NEWSLETTERS_DIR, '.md');
  const newsletters = await Promise.all(
    mdFiles.map(async (file) => {
      try {
        const raw = await fs.readFile(path.join(NEWSLETTERS_DIR, file), 'utf-8');
        const { data, content } = matter(raw);
        const slug = file.replace(/\.md$/, '');

        const rendered = await remark().use(remarkHtml).process(content);

        return {
          slug,
          title: data.title || `Newsletter ${slug}`,
          description: typeof data.description === 'string' ? data.description : undefined,
          date: data.date || '',
          week: data.week || 0,
          year: data.year || 0,
          content: String(rendered),
        };
      } catch (error) {
        throw new Error(`Failed to parse newsletter file ${file}: ${formatUnknownError(error)}`);
      }
    })
  );

  return newsletters.sort((a, b) => b.date.localeCompare(a.date));
});

export async function getAllNewsletters(): Promise<NewsletterMeta[]> {
  const all = await loadNewsletters();
  return all.map(({ content, ...meta }) => meta);
}

export async function getNewsletterBySlug(slug: string): Promise<Newsletter | null> {
  const all = await loadNewsletters();
  return all.find((n) => n.slug === slug) || null;
}
