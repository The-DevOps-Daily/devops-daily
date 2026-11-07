'use client';

import { usePathname } from 'next/navigation';
import { isGameEmbedPath } from '@/lib/games/embed-theme';

/**
 * Site extras (cookie notice, book popup, keyboard shortcuts) stay out of a
 * game embed: other pages frame it, and a click there would save a site
 * preference in the visitor's same-origin storage.
 */
export function HideInGameEmbed({ children }: { children: React.ReactNode }) {
  return isGameEmbedPath(usePathname()) ? null : <>{children}</>;
}
