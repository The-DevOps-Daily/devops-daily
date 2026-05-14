import path from 'path';
import type { Checklist } from './checklist-utils';
import { createCachedLoader, readJsonFiles } from './content-loader';

const CHECKLISTS_DIR = path.join(process.cwd(), 'content', 'checklists');

const loadChecklists = createCachedLoader(async () => {
  const checklists = await readJsonFiles<Checklist>(CHECKLISTS_DIR);
  return checklists.sort((a, b) => a.title.localeCompare(b.title));
});

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
