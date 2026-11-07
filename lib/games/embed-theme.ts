export type EmbedTheme = 'light' | 'dark';

/** True for the game embed route, /games/<slug>/embed, that Opsville and other sites frame. */
export function isGameEmbedPath(pathname: string | null | undefined): boolean {
  return typeof pathname === 'string' && /^\/games\/[^/]+\/embed\/?$/.test(pathname);
}

/**
 * The theme an embed shows, from its ?theme= parameter: dark when it is
 * missing, light or dark when asked, and undefined (the visitor's own theme)
 * for theme=auto. The embed only forces this theme for its own page; it never
 * saves it, because the iframe shares localStorage with the rest of the site.
 */
export function embedThemeFromSearch(search: string): EmbedTheme | undefined {
  const theme = new URLSearchParams(search).get('theme') || 'dark';
  return theme === 'light' || theme === 'dark' ? theme : undefined;
}
