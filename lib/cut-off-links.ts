// Social posts and link previews often cut a long URL short and end it with
// "...", "…" or a dash. The 404 page uses these helpers to find the page the
// link meant, from the URLs in /search-index.json.

export const MIN_PREFIX_LENGTH = 12;
export const MAX_SUGGESTIONS = 5;

const SECTION_PATH = /^\/(posts|guides|games|comparisons)\/([^/]+)\/?$/;
const CUT_OFF_END = /(?:\.|…|%E2%80%A6|-)+$/i;

/** The section and the slug start left after removing the cut-off marks. */
export function cutOffPrefix(pathname: string): { section: string; prefix: string } | null {
  const match = SECTION_PATH.exec(pathname);
  if (!match) return null;
  const prefix = match[2].replace(CUT_OFF_END, '').toLowerCase();
  return prefix.length >= MIN_PREFIX_LENGTH ? { section: match[1], prefix } : null;
}

/** Pages in the same section whose slug starts with what is left of the path. */
export function matchCutOffPath(pathname: string, urls: string[]): string[] {
  const parsed = cutOffPrefix(pathname);
  if (!parsed) return [];
  const base = `/${parsed.section}/`;
  const exact = base + parsed.prefix;
  const matches = urls.filter(
    (url) => url.startsWith(exact) && url !== pathname && !url.slice(base.length).includes('/')
  );
  return [...new Set(matches)].sort((a, b) => Number(b === exact) - Number(a === exact));
}
