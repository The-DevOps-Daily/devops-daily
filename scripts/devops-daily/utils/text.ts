import * as cheerio from 'cheerio';

/**
 * Plain text from feed HTML. Block tags become spaces, so a heading and the
 * paragraph after it do not run together ("OpenShiftRed Hat"), and every
 * entity is decoded. The result is text only: escape it before it goes into
 * Markdown.
 */
export function htmlToText(input: unknown): string {
  if (typeof input !== 'string' || input.length === 0) return '';
  const spaced = input.replace(
    /<\/?(p|div|br|li|ul|ol|h[1-6]|blockquote|pre|tr|td|th|table|section|article|header|footer|figure|figcaption|hr)\b[^>]*>/gi,
    ' $& '
  );
  const $ = cheerio.load(spaced, null, false);
  $('script, style, noscript, iframe, object, svg, template').remove();
  // Some feeds encode twice (&amp;#8217;), so decode what is left once more.
  return collapse(decodeEntities($.root().text()));
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '...',
  mdash: '-',
  ndash: '-',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

/** Decodes numeric entities and the few named ones that feeds double-encode. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function collapse(text: string): string {
  // \s also matches U+2028/U+2029 and NBSP; strip other control characters.
  // The digest uses no em dashes, so one in feed text becomes " - ".
  return (
    text
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/\s*\u2014\s*/g, ' - ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Feed title as plain text, without "Blog: " prefixes or " | Brand" suffixes.
 */
export function cleanTitle(title: unknown): string {
  let text = htmlToText(title);
  text = text.replace(/^(blog|news|post)\s*:\s+/i, '');
  const suffix = text.match(/\s+\|\s+[^|]{1,40}$/);
  if (suffix && suffix.index !== undefined && suffix.index >= 15) {
    text = text.slice(0, suffix.index);
  }
  return text.trim();
}

/**
 * Excerpt as plain text, without feed boilerplate. A truncation marker from
 * the feed ("[…]") becomes "...".
 */
export function cleanExcerpt(excerpt: unknown, title = ''): string {
  let text = htmlToText(excerpt);
  text = text
    .replace(/\s*The post .{1,300}? appeared first on .{1,120}?\.?\s*$/i, '')
    .replace(
      /\s*(read the full article|read more|continue reading|learn more)\s*(\.{3}|…|»|→)?\s*$/i,
      ''
    )
    .replace(/\s+\|\s+[^|.!?]{1,30}$/, '')
    .replace(/\*\*|__/g, '')
    .replace(/\s*\[(…|\.\.\.)\]\s*$/, '...')
    .replace(/\s*…$/, '...')
    .trim();
  if (title && text.toLowerCase().startsWith(title.toLowerCase())) {
    const rest = text.slice(title.length).replace(/^[\s:.,-]+/, '');
    if (rest.length > 0) text = rest;
  }
  return text;
}

const ABBREVIATIONS = new Set(
  'e.g i.e etc vs inc ltd co corp mr mrs ms dr st no approx fig u.s u.k a.m p.m'.split(' ')
);

/**
 * Character offsets just after each sentence end: ".", "!" or "?" followed
 * by a space and a capital or digit, or by the end of the text. Skips
 * abbreviations, initials and a trailing "..." (that is a cut, not an end).
 */
export function sentenceEnds(text: string): number[] {
  const ends: number[] = [];
  const re = /[.!?]+["'”’)\]]*(?=\s+["'“‘(\[]?[A-Z0-9]|\s*$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const punct = m[0];
    if (punct.startsWith('..')) continue;
    if (punct[0] === '.') {
      const word = (text.slice(0, m.index).match(/([A-Za-z.]+)$/)?.[1] ?? '').toLowerCase();
      if (ABBREVIATIONS.has(word) || /^[a-z]$/.test(word)) continue;
    }
    ends.push(m.index + punct.length);
  }
  return ends;
}

/**
 * Shortens an excerpt to end at a full sentence between `min` and `max`
 * characters. Falls back to a shorter full sentence, then to a word
 * boundary plus "...". Never cuts inside a word. Text that the feed already
 * cut mid-sentence (no closing punctuation) gets the same treatment, so it
 * does not end on a dangling word.
 */
export function cutExcerpt(text: string, min = 160, max = 240): string {
  const clean = text.trim();
  const complete = /[.!?]["'\u201d\u2019)\]]*$/.test(clean) && !clean.endsWith('...');
  // A short line without a full stop ("Learn what's new in VS Code 1.146")
  // is usually a whole description, not a cut one.
  if (clean.length <= max && (complete || clean.length < 100)) return clean;

  const ends = sentenceEnds(clean).filter((end) => end <= max);
  const inRange = ends.filter((end) => end >= min);
  if (inRange.length > 0) return clean.slice(0, inRange[inRange.length - 1]).trim();
  const shorter = ends.filter((end) => end >= 60);
  if (shorter.length > 0) return clean.slice(0, shorter[shorter.length - 1]).trim();
  if (clean.endsWith('...') && clean.length <= max) return clean;

  let cut = clean.length <= max ? clean : clean.slice(0, max - 3);
  if (clean.length > max) {
    const space = cut.lastIndexOf(' ');
    if (space > 0) cut = cut.slice(0, space);
  }
  return `${cut.replace(/[\s,;:([{\u2013\u2014-]+$/, '')}...`;
}

/**
 * The first sentence, for the one-line picks at the top. Long first
 * sentences are cut at a word boundary.
 */
export function firstSentence(text: string, max = 200): string {
  const clean = text.trim();
  const first = sentenceEnds(clean).find((end) => end >= 40);
  if (first !== undefined && first <= max) return clean.slice(0, first).trim();
  return cutExcerpt(clean, Math.min(120, max), max);
}
