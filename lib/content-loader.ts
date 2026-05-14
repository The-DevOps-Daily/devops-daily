import fs from 'fs/promises';
import path from 'path';

export const CONTENT_CACHE_DURATION =
  process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME
    ? Infinity
    : 5 * 60 * 1000;

export function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isFileNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}

export function createCachedLoader<T>(
  load: () => Promise<T>,
  cacheDuration = CONTENT_CACHE_DURATION
): () => Promise<T> {
  let cache: T | null = null;
  let lastCacheTime = 0;

  return async () => {
    const now = Date.now();
    if (cache && now - lastCacheTime < cacheDuration) {
      return cache;
    }

    cache = await load();
    lastCacheTime = now;
    return cache;
  };
}

export async function readDirectoryFiles(directory: string, extension: string): Promise<string[]> {
  const files = await fs.readdir(directory);
  return files.filter((file) => file.endsWith(extension)).sort();
}

export async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readTextFile(filePath);

  try {
    return JSON.parse(content) as T;
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${formatUnknownError(error)}`);
  }
}

export async function readJsonFiles<T>(
  directory: string,
  mapItem?: (item: T, file: string) => T | Promise<T>
): Promise<T[]> {
  const files = await readDirectoryFiles(directory, '.json');

  return Promise.all(
    files.map(async (file) => {
      const item = await readJsonFile<T>(path.join(directory, file));
      return mapItem ? mapItem(item, file) : item;
    })
  );
}
