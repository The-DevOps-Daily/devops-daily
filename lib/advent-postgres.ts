import path from 'path';
import { createCachedLoader, readMarkdownFiles } from './content-loader';

const DIR = path.join(process.cwd(), 'content', 'advent-of-postgres');

export type PostgresAdventDay = {
  title: string;
  slug: string;
  day: number;
  excerpt?: string;
  difficulty?: string;
  skills?: string[];
  schema: string;
  answerHash: string;
  answerFormat?: string;
  starter?: string;
  hint?: string;
  publishedAt: string;
  content: string;
};

const loadDays = createCachedLoader(async () => {
  const days = await readMarkdownFiles<PostgresAdventDay, Partial<PostgresAdventDay>>(
    DIR,
    (data, content, filename) => {
      const slug = filename.replace(/\.md$/, '');
      return {
        ...data,
        slug,
        content,
        day: data.day || parseInt(slug.replace('day-', ''), 10),
      } as PostgresAdventDay;
    }
  );
  return days.filter((d) => d.slug.startsWith('day-')).sort((a, b) => a.day - b.day);
});

export async function getPostgresAdventDays(): Promise<PostgresAdventDay[]> {
  return loadDays();
}

export async function getPostgresAdventDay(slug: string): Promise<PostgresAdventDay | null> {
  const days = await loadDays();
  return days.find((d) => d.slug === slug) ?? null;
}

/** The puzzle text and metadata the browser needs, without the markdown body. */
export type PostgresAdventDaySummary = Omit<PostgresAdventDay, 'content'>;

export function summarize(day: PostgresAdventDay): PostgresAdventDaySummary {
  const summary: Partial<PostgresAdventDay> = { ...day };
  delete summary.content;
  return summary as PostgresAdventDaySummary;
}
