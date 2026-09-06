#!/usr/bin/env bun
/**
 * Map changed content file paths to the site routes they render at.
 *
 * Usage:
 *   bun scripts/content-path-to-url.ts < changed.txt   # one path per line
 *
 * Paths that do not render to a page of their own (sources.yaml, category
 * metadata, unknown folders) produce no output. The mapping mirrors the
 * generateStaticParams of each route under app/.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface MapOptions {
  /** Read a content file; used for routes whose params live inside the file. */
  readFile?: (path: string) => string | null;
}

function defaultReadFile(path: string): string | null {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
  } catch {
    return null;
  }
}

/** Route for one content path, or null when the file has no page of its own. */
export function contentPathToUrl(filePath: string, options: MapOptions = {}): string | null {
  const p = filePath.trim().replace(/^\.\//, '');
  const read = options.readFile ?? defaultReadFile;
  let m: RegExpMatchArray | null;

  if ((m = p.match(/^content\/posts\/([^/]+)\.md$/))) return `/posts/${m[1]}`;

  // content/news/2026/week-36.md renders at /news/2026-week-36 (lib/news.ts)
  if ((m = p.match(/^content\/news\/(\d{4})\/week-(\d+)\.md$/))) {
    return `/news/${m[1]}-week-${parseInt(m[2], 10)}`;
  }

  if ((m = p.match(/^content\/newsletters\/([^/]+)\.md$/))) return `/newsletters/${m[1]}`;

  // Guides are folders: index.md is the guide page, every other .md a part.
  if ((m = p.match(/^content\/guides\/([^/]+)\/index\.md$/))) return `/guides/${m[1]}`;
  if ((m = p.match(/^content\/guides\/([^/]+)\/([^/]+)\.md$/))) return `/guides/${m[1]}/${m[2]}`;

  if ((m = p.match(/^content\/comparisons\/([^/]+)\.json$/))) return `/comparisons/${m[1]}`;
  if ((m = p.match(/^content\/exercises\/([^/]+)\.json$/))) return `/exercises/${m[1]}`;
  if ((m = p.match(/^content\/quizzes\/([^/]+)\.json$/))) return `/quizzes/${m[1]}`;
  if ((m = p.match(/^content\/flashcards\/([^/]+)\.json$/))) return `/flashcards/${m[1]}`;
  if ((m = p.match(/^content\/checklists\/([^/]+)\.json$/))) return `/checklists/${m[1]}`;

  // Interview questions render at /interview-questions/<tier>/<slug>; the
  // tier is only known from the file body.
  if ((m = p.match(/^content\/interview-questions\/([^/]+)\.json$/))) {
    const raw = read(p);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as { tier?: string; slug?: string };
      if (typeof data.tier !== 'string') return null;
      return `/interview-questions/${data.tier}/${data.slug || m[1]}`;
    } catch {
      return null;
    }
  }

  if ((m = p.match(/^content\/advent-of-devops\/([^/]+)\.md$/))) return `/advent-of-devops/${m[1]}`;

  return null;
}

/** Map many paths, dropping unmapped ones and duplicates, keeping input order. */
export function contentPathsToUrls(paths: string[], options: MapOptions = {}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of paths) {
    const url = contentPathToUrl(path, options);
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

const isMain =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const lines = readFileSync(0, 'utf8').split('\n').filter((line) => line.trim() !== '');
  for (const url of contentPathsToUrls(lines)) console.log(url);
}
