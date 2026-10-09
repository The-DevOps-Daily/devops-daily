/** Library and series pages keep normal site navigation; reading routes scroll it away. */
export function isComicReaderPath(pathname: string | null) {
  return /^\/comics\/[^/]+\/(?:chapter-\d+|proof(?:\/.*)?|print)\/?$/.test(pathname ?? '');
}
