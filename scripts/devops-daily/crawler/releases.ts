import Parser from 'rss-parser';
import { ProjectReleases, ReleaseEntry, ReleaseSource } from './types.js';
import { cleanUrl } from '../utils/normalize.js';
import { titleText } from '../utils/text.js';

const parser = new Parser({ timeout: 10000 });

// "v1.17.2", "Helm v4.3.2", "Istio 1.32.0", "3.16.0 / 2026-11-04". A tag with
// a path ("api/v1.57.0", "gitops-engine/v3.6.1") is a sub-module, not the
// project release, and does not match.
const GITHUB_TITLE =
  /^(?:[A-Za-z][A-Za-z .-]*?\s+)?v?(\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.]+)?)(?:\s*\/\s*\d{4}-\d{2}-\d{2})?$/;

/** The version in a GitHub release title, without a leading "v". */
export function parseGithubReleaseTitle(title: string): string | null {
  const match = titleText(title).match(GITHUB_TITLE);
  return match ? match[1] : null;
}

/**
 * Stable versions only. With `majorRc`, an x.y.0 release candidate is kept
 * too, because a Kubernetes or PostgreSQL major RC is news on its own.
 */
export function isListedVersion(version: string, majorRc = false): boolean {
  if (/^\d+\.\d+(\.\d+)?$/.test(version)) return true;
  return majorRc && /^\d+\.\d+\.0-rc\.?\d+$/i.test(version);
}

const PG_PART = /^(\d+(?:\.\d+)?)(?:\s+(rc|beta)\s*(\d+))?$/i;

/**
 * The versions in a PostgreSQL release post title, such as
 * "PostgreSQL 18.7, 17.12, 16.16, 15.20, 14.25, and 19 RC 2 Released!".
 * Betas are dropped and RCs kept. Posts about other tools ("pg_cve 1.1.1
 * released", "PostgreSQL JDBC 42.7.5 Released") return null.
 */
export function parsePostgresReleaseTitle(title: string): string | null {
  const match = titleText(title).match(/^PostgreSQL\s+(.+?)\s+Released!?$/i);
  if (!match) return null;
  const parts = match[1]
    .split(/\s*,\s*(?:and\s+)?|\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const kept: string[] = [];
  for (const part of parts) {
    const m = part.match(PG_PART);
    if (!m) return null;
    if (m[2] && m[2].toLowerCase() === 'beta') continue;
    kept.push(m[2] ? `${m[1]} RC ${m[3]}` : m[1]);
  }
  if (kept.length === 0) return null;
  return kept.length === 1
    ? kept[0]
    : `${kept.slice(0, -1).join(', ')} and ${kept[kept.length - 1]}`;
}

interface FeedEntry {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
}

/** Release entries from one parsed feed. Links must point at the project. */
export function releaseEntriesFromFeed(source: ReleaseSource, items: FeedEntry[]): ReleaseEntry[] {
  const skip = source.skip ? new RegExp(source.skip) : null;
  const linkPrefix = source.github
    ? `https://github.com/${source.github}/releases/`
    : 'https://www.postgresql.org/';
  const entries: ReleaseEntry[] = [];

  for (const item of items) {
    if (!item.title || !item.link) continue;
    const url = cleanUrl(item.link);
    if (!url.startsWith(linkPrefix)) continue;
    const date = new Date(item.isoDate || item.pubDate || '');
    if (isNaN(date.getTime())) continue;

    let version: string | null;
    if (source.github) {
      version = parseGithubReleaseTitle(item.title);
      if (!version || (skip && skip.test(version)) || !isListedVersion(version, source.majorRc))
        continue;
    } else {
      version = parsePostgresReleaseTitle(item.title);
      if (!version) continue;
    }
    entries.push({ project: source.name, version, url, publishedAt: date.toISOString() });
  }
  return entries;
}

/** Higher version first; a stable version before an RC of the same number. */
export function compareVersionsDesc(a: string, b: string): number {
  const [coreA, preA] = a.split('-', 2);
  const [coreB, preB] = b.split('-', 2);
  const pa = coreA.split('.').map((p) => parseInt(p, 10) || 0);
  const pb = coreB.split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (!preA !== !preB) return preA ? 1 : -1;
  return (preB ?? '').localeCompare(preA ?? '');
}

/**
 * Releases published inside [start, end) and not after `now`, grouped per
 * project in config order, highest version first, each version once.
 */
export function selectReleases(
  entries: ReleaseEntry[],
  projectOrder: string[],
  start: Date,
  end: Date,
  now: Date = new Date()
): ProjectReleases[] {
  const until = Math.min(end.getTime(), now.getTime());
  const byProject = new Map<string, Map<string, ReleaseEntry>>();
  for (const entry of entries) {
    const t = new Date(entry.publishedAt).getTime();
    if (t < start.getTime() || t >= until) continue;
    const versions = byProject.get(entry.project) ?? new Map<string, ReleaseEntry>();
    if (!versions.has(entry.version)) versions.set(entry.version, entry);
    byProject.set(entry.project, versions);
  }

  const result: ProjectReleases[] = [];
  for (const project of projectOrder) {
    const versions = byProject.get(project);
    if (!versions) continue;
    const releases = [...versions.values()].sort((a, b) =>
      compareVersionsDesc(a.version, b.version)
    );
    result.push({ project, releases });
  }
  return result;
}

function feedUrl(source: ReleaseSource): string | null {
  if (source.github && /^[\w.-]+\/[\w.-]+$/.test(source.github)) {
    return `https://github.com/${source.github}/releases.atom`;
  }
  return source.feed ?? null;
}

/** Fetches every release feed. A feed that fails is logged and skipped. */
export async function crawlReleases(
  sources: ReleaseSource[],
  failures?: string[]
): Promise<ReleaseEntry[]> {
  const results = await Promise.all(
    sources.map(async (source) => {
      const url = feedUrl(source);
      if (!url) return [];
      try {
        const feed = await parser.parseURL(url);
        const entries = releaseEntriesFromFeed(source, feed.items as FeedEntry[]);
        console.log(`  ✓ ${source.name}: ${entries.length} listed releases in the feed`);
        return entries;
      } catch (error) {
        console.error(`  ✗ Error reading releases for ${source.name}:`, error);
        failures?.push(`${source.name} releases`);
        return [];
      }
    })
  );
  return results.flat();
}
