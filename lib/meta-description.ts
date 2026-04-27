/**
 * Trims a long description down to fit Google's recommended meta description
 * length (~155-160 chars). Tries to cut at the last sentence boundary to keep
 * the result readable; falls back to a word boundary if no early sentence end
 * exists. Keeps the first words intact, which is where the keywords usually
 * live, so SEO signal is preserved.
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

  // Find the last sentence end (period, !, ?) within the limit.
  const slice = trimmed.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  );

  if (sentenceEnd > 80) {
    // The +1 keeps the closing punctuation.
    return trimmed.slice(0, sentenceEnd + 1);
  }

  // No good sentence break: cut at the last word boundary and add ellipsis.
  const wordEnd = slice.lastIndexOf(' ');
  if (wordEnd > 0) {
    return trimmed.slice(0, wordEnd).replace(/[,;:.\s]+$/, '') + '...';
  }

  // Pathological single-word input - just hard cut.
  return trimmed.slice(0, maxLength - 3) + '...';
}
