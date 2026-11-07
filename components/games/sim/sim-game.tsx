'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { SimGameInfo } from '@/lib/games/sim-game-info';

const SimGameContext = createContext<SimGameInfo | null>(null);

/** Set by the page shell and the embed page around the game. */
export function SimGameProvider({ info, children }: { info: SimGameInfo; children?: ReactNode }) {
  return <SimGameContext.Provider value={info}>{children}</SimGameContext.Provider>;
}

/** Null when a game renders outside a page (tests, previews). */
export function useSimGame(): SimGameInfo | null {
  return useContext(SimGameContext);
}
