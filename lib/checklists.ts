import fs from 'fs/promises';
import path from 'path';
import type { Checklist } from './checklist-utils';

const CHECKLISTS_DIR = path.join(process.cwd(), 'content', 'checklists');

let cache: Checklist[] | null = null;
let lastCacheTime = 0;
const CACHE_DURATION =
  process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME
    ? Infinity
    : 5 * 60 * 1000;

async function loadChecklists(): Promise<Checklist[]> {
  const now = Date.now();
  if (cache && now - lastCacheTime < CACHE_DURATION) return cache;

  try {
    await fs.access(CHECKLISTS_DIR);
    const files = await fs.readdir(CHECKLISTS_DIR);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const checklists: Checklist[] = [];

    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(CHECKLISTS_DIR, file), 'utf-8');
        const checklist = JSON.parse(content) as Checklist;
        checklists.push(checklist);
      } catch (error) {
        throw new Error(
          `Failed to parse checklist file ${file}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    checklists.sort((a, b) => a.title.localeCompare(b.title));
    cache = checklists;
    lastCacheTime = now;
    return checklists;
  } catch (error) {
    throw new Error(
      `Failed to load checklists from ${CHECKLISTS_DIR}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getAllChecklists(): Promise<Checklist[]> {
  return loadChecklists();
}

export async function getChecklistBySlug(slug: string): Promise<Checklist | undefined> {
  const all = await loadChecklists();
  return all.find((c) => c.slug === slug);
}

export async function getChecklistsByCategory(category: string): Promise<Checklist[]> {
  const all = await loadChecklists();
  return all.filter((c) => c.category === category);
}

export async function getChecklistsByTag(tag: string): Promise<Checklist[]> {
  const all = await loadChecklists();
  return all.filter((c) => c.tags.includes(tag));
}
