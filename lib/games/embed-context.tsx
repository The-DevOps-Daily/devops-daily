'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { EmbedTheme } from '@/lib/games/embed-theme';

/**
 * Where a game runs: its own page on the site, Opsville's quest frame (or the
 * tab Opsville opens on phones), or an embed on another site.
 */
export type EmbedHost = 'site' | 'opsville' | 'other';

export interface EmbedInfo {
  host: EmbedHost;
  /** The theme the embed shows (forced, never saved), or undefined for the visitor's own. */
  theme: EmbedTheme | undefined;
  /**
   * True in any embed. There is no page shell around the game, so it shows its
   * short title in its own bar and uses the compact layout.
   */
  embedded: boolean;
  /** True inside Opsville: the next step is Opsville's quiz, not another game. */
  inOpsville: boolean;
}

export function embedInfo(host: EmbedHost, theme?: EmbedTheme): EmbedInfo {
  return { host, theme, embedded: host !== 'site', inOpsville: host === 'opsville' };
}

const EmbedContext = createContext<EmbedInfo>(embedInfo('site'));

/** Set by the embed route (app/games/[slug]/embed/embed-client.tsx) around the game. */
export function EmbedProvider({
  host,
  theme,
  children,
}: {
  host: EmbedHost;
  theme?: EmbedTheme;
  children?: ReactNode;
}) {
  const value = useMemo(() => embedInfo(host, theme), [host, theme]);
  return <EmbedContext.Provider value={value}>{children}</EmbedContext.Provider>;
}

/** On the game's own page there is no provider, so this returns host 'site'. */
export function useEmbed(): EmbedInfo {
  return useContext(EmbedContext);
}
