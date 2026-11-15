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
  useNoTransitionsWhileThemeSwitches();
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      forcedTheme={embed ? embedThemeFromSearch(search) : undefined}
    >
      {children}
    </NextThemesProvider>
  );
}

/**
 * Keeps transitions off while the theme class on <html> changes, in place of
 * next-themes' disableTransitionOnChange (see postcss.config.mjs). The observer
 * runs before the next style update, and the class comes off after the switch
 * has been painted.
 */
function useNoTransitionsWhileThemeSwitches() {
  React.useEffect(() => {
    const root = document.documentElement;
    let dark = root.classList.contains('dark');
    let frame = 0;
    let timer = 0;
    const observer = new MutationObserver(() => {
      if (root.classList.contains('dark') === dark) return;
      dark = !dark;
      root.classList.add('theme-switching');
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      frame = requestAnimationFrame(() => {
        timer = window.setTimeout(() => root.classList.remove('theme-switching'), 0);
      });
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      root.classList.remove('theme-switching');
    };
  }, []);
}

/** The theme on screen: an embed's forced theme, else the visitor's resolved one. */
export function useResolvedTheme(): string | undefined {
  const { forcedTheme, resolvedTheme } = useTheme();
  return forcedTheme ?? resolvedTheme;
}
