'use client';

import { useEffect } from 'react';
import { GO_LINKS_ORIGIN } from '@/lib/sponsors';

/**
 * Sponsor links go through go.devops-daily.com so we can count clicks per
 * placement. The placements are server-rendered and do not know which page
 * they sit on, and they use rel="noreferrer", so add the page path at click
 * time. Without JavaScript the link still works, just without the page.
 */
export function GoLinkPageTag() {
  useEffect(() => {
    const tag = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement) || !link.href.startsWith(`${GO_LINKS_ORIGIN}/`)) return;
      const url = new URL(link.href);
      if (url.searchParams.has('from')) return;
      url.searchParams.set('from', window.location.pathname);
      link.href = url.toString();
    };
    document.addEventListener('click', tag, true);
    document.addEventListener('auxclick', tag, true);
    return () => {
      document.removeEventListener('click', tag, true);
      document.removeEventListener('auxclick', tag, true);
    };
  }, []);
  return null;
}
