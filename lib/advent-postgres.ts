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

// A day's puzzle goes into the built pages only once it opens, so the page
// source cannot give it away early. The December rebuild starts at 23:50 UTC
// and takes about 3 minutes, so a day counts as open from BUILD_LEAD_MS before
// its time; the browser still hides it until 00:00 UTC. Preview builds of other
// branches open every day, for review.
const BUILD_LEAD_MS = 20 * 60 * 1000;

export function isPreviewBuild(): boolean {
  const branch = process.env.CF_PAGES_BRANCH;
  return process.env.ADVENT_PREVIEW === '1' || (!!branch && branch !== 'main');
}

export function openAtBuild(
  day: Pick<PostgresAdventDay, 'publishedAt'>,
  now = Date.now()
): boolean {
  return isPreviewBuild() || Date.parse(day.publishedAt) - BUILD_LEAD_MS <= now;
}

/** The puzzle text and metadata the browser needs, without the markdown body. */
export type PostgresAdventDaySummary = Omit<PostgresAdventDay, 'content'> & { locked?: boolean };

export function summarize(day: PostgresAdventDay): PostgresAdventDaySummary {
  if (!openAtBuild(day)) {
    return {
      title: `Day ${day.day}`,
      slug: day.slug,
      day: day.day,
      schema: '',
      answerHash: '',
      publishedAt: day.publishedAt,
      locked: true,
    };
  }
  const summary: Partial<PostgresAdventDay> = { ...day };
  delete summary.content;
  return summary as PostgresAdventDaySummary;
}
