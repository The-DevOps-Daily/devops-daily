/**
 * Trims a long description down to fit Google's recommended meta description
 * length (~155-160 chars). Tries to cut at the last sentence boundary, but
 * only if that boundary lands close to the limit; otherwise falls back to
 * the last word boundary so the rendered description fills the space rather
 * than being clipped to the first sentence.
 *
 * History: an earlier version cut at any sentence boundary past 80 chars,
 * which turned a 213-char source into an 82-char meta tag. Bing flagged
 * those as "too short" in the May 2026 SEO report. The 70% floor below
 * stops that.
 *
 * Pass through anything already short enough.
 */
export function truncateMetaDescription(
  text: string | undefined | null,
  maxLength = 155,
): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;

  // Sentence boundary is preferred only when it lands at or above this floor.
  // 70% of maxLength keeps the meta tag in the 110-155 range that search
  // engines treat as the ideal length. Picking sentence ends below the floor
  // produces too-short descriptions.
  const sentenceFloor = Math.floor(maxLength * 0.7);

  // Allow the slice to look at one char past the limit so we can detect a
  // sentence end that lands exactly at maxLength.
  const slice = trimmed.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  );

  if (sentenceEnd >= sentenceFloor) {
    // The +1 keeps the closing punctuation.
    return trimmed.slice(0, sentenceEnd + 1);
  }

  // No sentence break in the upper range: cut at the last word boundary and
  // add an ellipsis so the result reads as a deliberate trim.
  const wordEnd = slice.lastIndexOf(' ');
  if (wordEnd > 0) {
    return trimmed.slice(0, wordEnd).replace(/[,;:.\s]+$/, '') + '...';
  }

  // Pathological single-word input - just hard cut.
  return trimmed.slice(0, maxLength - 3) + '...';
}
