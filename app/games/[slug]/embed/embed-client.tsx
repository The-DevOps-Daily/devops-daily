'use client';

import { useSearchParams, usePathname } from 'next/navigation';
import { EmbedBadge } from '@/components/embed';
import { Suspense, useEffect } from 'react';

interface EmbedClientProps {
  slug: string;
  title: string;
  GameComponent: React.ComponentType;
}

function EmbedContent({ slug, title, GameComponent }: EmbedClientProps) {
  const searchParams = useSearchParams();
  const theme = searchParams.get('theme') || 'dark';
  const hideTitle = searchParams.get('hideTitle') === 'true';
  const pathname = usePathname();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com';
  const gameUrl = `${siteUrl}/games/${slug}`;

  // Hide header/footer when in embed mode
  useEffect(() => {
    if (pathname?.includes('/embed')) {
      // Hide header and footer
      const header = document.querySelector('header');
      const footer = document.querySelector('footer');
      const skipToContent = document.getElementById('skip-to-content');
      const cookieBanner = document.querySelector('[data-cookie-banner]');
      const mainElement = document.getElementById('main-content');

      if (header) (header as HTMLElement).style.display = 'none';
      if (footer) (footer as HTMLElement).style.display = 'none';
      if (skipToContent) (skipToContent as HTMLElement).style.display = 'none';
      if (cookieBanner) (cookieBanner as HTMLElement).style.display = 'none';

      // Set body styles for embed
      document.body.style.minHeight = 'auto';
      document.body.classList.remove('flex', 'flex-col');

      // Remove padding from main
      if (mainElement) {
        mainElement.classList.remove('flex-1');
      }

      return () => {
        // Restore on unmount
        if (header) (header as HTMLElement).style.display = '';
        if (footer) (footer as HTMLElement).style.display = '';
        if (skipToContent) (skipToContent as HTMLElement).style.display = '';
        if (cookieBanner) (cookieBanner as HTMLElement).style.display = '';
        document.body.style.minHeight = '';
        document.body.classList.add('flex', 'flex-col');
        if (mainElement) mainElement.classList.add('flex-1');
      };
    }
  }, [pathname]);

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      data-theme={theme}
    >
      {/* Minimal header */}
      {!hideTitle && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <h1 className="text-sm font-semibold truncate">{title}</h1>
          <a
            href={gameUrl}
            target="_blank"
            rel="noopener"
            className="text-xs text-muted-foreground hover:text-primary transition-colors whitespace-nowrap ml-4"
          >
            View Full Version →
          </a>
        </div>
      )}

      {/* Game content */}
      <div className="p-4">
        <GameComponent />
      </div>

      {/* Attribution badge - always visible, cannot be removed */}
      <EmbedBadge gameSlug={slug} gameTitle={title} />
    </div>
  );
}

export function EmbedClient(props: EmbedClientProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <EmbedContent {...props} />
    </Suspense>
  );
}
