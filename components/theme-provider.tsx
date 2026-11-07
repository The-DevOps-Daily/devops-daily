'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import {
  ThemeProvider as NextThemesProvider,
  useTheme,
  type ThemeProviderProps,
} from 'next-themes';
import { embedThemeFromSearch, isGameEmbedPath } from '@/lib/games/embed-theme';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

const noSubscribe = () => () => {};
const locationSearch = () => window.location.search;
// The static HTML has no query string; '' gives dark, the embed default.
const noSearch = () => '';

/**
 * The site's theme. A game embed forces the theme from its ?theme= parameter
 * for that page only. next-themes applies a forced theme without saving it, so
 * the visitor's own choice, which the same-origin iframe shares, stays as is.
 */
export function SiteThemeProvider({ children }: { children: React.ReactNode }) {
  const embed = isGameEmbedPath(usePathname());
  const search = React.useSyncExternalStore(noSubscribe, locationSearch, noSearch);
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      forcedTheme={embed ? embedThemeFromSearch(search) : undefined}
    >
      {children}
    </NextThemesProvider>
  );
}

/** The theme on screen: an embed's forced theme, else the visitor's resolved one. */
export function useResolvedTheme(): string | undefined {
  const { forcedTheme, resolvedTheme } = useTheme();
  return forcedTheme ?? resolvedTheme;
}
