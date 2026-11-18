/**
 * Feed titles and excerpts are untrusted. Everything that goes into the
 * digest passes through these helpers, so feed text stays text: no raw HTML,
 * no emphasis or links of its own, and no line that turns into a heading,
 * list or fence.
 */

/**
 * Escapes plain text for Markdown. Newlines become spaces. With
 * `atLineStart`, text that would start a heading, list or fence is escaped
 * too; text inside a link or after other text does not need that.
 */
export function escapeMarkdown(text: string, atLineStart = true): string {
  const inline = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\\/g, '\\\\')
    // Keep "AT&T" readable; only an entity-like "&x;" needs escaping.
    .replace(/&(?=#?[a-z0-9]+;)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([`*_[\]~|])/g, '\\$1');
  if (!atLineStart) return inline;
  // Block syntax only counts at the start of a line.
  return inline.replace(/^([#+=:-])/, '\\$1').replace(/^(\d+)([.)])/, '$1\\$2');
}

/**
 * A URL for a Markdown link target, or '' when it is not http(s). Parentheses
 * and spaces are encoded so they cannot end the link early.
 */
export function markdownUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
  return parsed.href.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\s/g, '%20');
}

/** `[text](url)` with escaped text, or the escaped text alone for a bad URL. */
export function markdownLink(text: string, url: string): string {
  const safe = markdownUrl(url);
  const label = escapeMarkdown(text, false);
  return safe ? `[${label}](${safe})` : label;
}
