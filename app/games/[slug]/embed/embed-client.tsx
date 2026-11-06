'use client';

import { useSearchParams, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { EmbedBadge } from '@/components/embed';
import { Suspense, useEffect, useState } from 'react';
import { GAME_COMPLETE_EVENT, OPSVILLE_HELLO, isOpsvilleOrigin } from '@/lib/games/game-complete';

interface EmbedClientProps {
  slug: string;
  title: string;
  GameComponent: React.ComponentType;
}

function EmbedContent({ slug, title, GameComponent }: EmbedClientProps) {
  const searchParams = useSearchParams();
  const theme = searchParams.get('theme') || 'dark';
  const hideTitle = searchParams.get('hideTitle') === 'true';
  const opsvilleRequested = searchParams.get('embed') === 'opsville';
  const pathname = usePathname();
  const { setTheme } = useTheme();
  // Set only when the page framing us is Opsville (game.devops-daily.com or a
  // Pages preview). Any other site that adds ?embed=opsville gets the normal embed.
  const [opsvilleOrigin, setOpsvilleOrigin] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com';
  const gameUrl = `${siteUrl}/games/${slug}`;

  // Apply the embed's theme via next-themes so the host site's iframe
  // renders in light/dark regardless of the visitor's system preference.
  // theme=auto falls back to whatever the user has - same as the regular
  // site behaviour. The previous `data-theme={theme}` attribute had no
  // effect because the app uses Tailwind's class-strategy theming, which
  // requires `class="dark"` on <html>, not a data attribute.
  useEffect(() => {
    if (theme === 'light' || theme === 'dark') {
      setTheme(theme);
    } else {
      setTheme('system');
    }
  }, [theme, setTheme]);

  useEffect(() => {
    if (!opsvilleRequested) return;
    // Opsville says hello when the frame loads; the browser sets event.origin.
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || !isOpsvilleOrigin(event.origin)) return;
      if ((event.data as { type?: unknown } | null)?.type === OPSVILLE_HELLO) {
        setOpsvilleOrigin(event.origin);
      }
    };
    const onComplete = () => setFinished(true);
    window.addEventListener('message', onMessage);
    window.addEventListener(GAME_COMPLETE_EVENT, onComplete);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener(GAME_COMPLETE_EVENT, onComplete);
    };
  }, [opsvilleRequested]);

  // Tell Opsville the player finished the lessons, so it can open the quiz gate.
  useEffect(() => {
    if (!opsvilleOrigin || !finished) return;
    window.parent.postMessage({ type: GAME_COMPLETE_EVENT, game: slug }, opsvilleOrigin);
  }, [opsvilleOrigin, finished, slug]);

  const inOpsville = opsvilleOrigin !== null;

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
      {!hideTitle && !inOpsville && (
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

      {/* Attribution badge: always shown, except inside Opsville, our own game */}
      {!inOpsville && <EmbedBadge gameSlug={slug} gameTitle={title} />}
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
