import fs from 'fs/promises';
import path from 'path';
import type { Checklist } from './checklist-utils';

const CHECKLISTS_DIR = path.join(process.cwd(), 'content', 'checklists');

let checklistsCache: Checklist[] | null = null;
let lastCacheTime = 0;
const CACHE_DURATION =
  process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME
    ? Infinity
    : 5 * 60 * 1000;

async function loadChecklistsFromFiles(): Promise<Checklist[]> {
  const now = Date.now();
  if (checklistsCache && now - lastCacheTime < CACHE_DURATION) {
    return checklistsCache;
  }

  try {
    await fs.access(CHECKLISTS_DIR);
    const files = await fs.readdir(CHECKLISTS_DIR);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));

    const items: Checklist[] = [];

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(CHECKLISTS_DIR, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const checklist = JSON.parse(fileContent) as Checklist;
        items.push(checklist);
      } catch (error) {
        console.warn(`Failed to parse checklist file ${file}:`, error);
      }
    }

    checklistsCache = items;
    lastCacheTime = now;

    return items;
  } catch (error) {
    console.warn('Failed to load checklists from files:', error);
    return [];
  }
}

export async function getAllChecklists(): Promise<Checklist[]> {
  return loadChecklistsFromFiles();
}

export async function getChecklistBySlug(slug: string): Promise<Checklist | undefined> {
  const all = await getAllChecklists();
  return all.find((c) => c.slug === slug);
}

export async function getChecklistsByCategory(category: string): Promise<Checklist[]> {
  const all = await getAllChecklists();
  return all.filter((c) => c.category === category);
}

export async function getChecklistsByTag(tag: string): Promise<Checklist[]> {
  const all = await getAllChecklists();
  return all.filter((c) => c.tags.includes(tag));
}
