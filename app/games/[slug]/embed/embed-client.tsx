'use client';

import { useSearchParams, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { EmbedBadge } from '@/components/embed';
import { Suspense, useEffect, useState } from 'react';
import {
  GAME_COMPLETE_EVENT,
  OPSVILLE_HELLO,
  isOpsvilleOrigin,
  takeOpener,
} from '@/lib/games/game-complete';

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
  // Set only when the page that framed or opened us is Opsville
  // (game.devops-daily.com or a Pages preview). Any other site that adds
  // ?embed=opsville keeps the title bar and badge.
  const [opsville, setOpsville] = useState<{ origin: string; target: Window } | null>(null);
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
    // On phones Opsville opens this page in a new tab. Keep that window only
    // for the finish message and clear window.opener, so later pages in this
    // tab cannot reach the Opsville tab.
    const openerWin = takeOpener(window);
    // Opsville says hello when it frames this page, or after it opened it.
    // The browser sets event.origin and event.source.
    const onMessage = (event: MessageEvent) => {
      const fromParent = window.parent !== window && event.source === window.parent;
      const fromOpener = openerWin !== null && event.source === openerWin;
      if (!(fromParent || fromOpener) || !isOpsvilleOrigin(event.origin)) return;
      if ((event.data as { type?: unknown } | null)?.type === OPSVILLE_HELLO) {
        const target = event.source as Window;
        setOpsville((prev) =>
          prev?.origin === event.origin && prev.target === target
            ? prev
            : { origin: event.origin, target }
        );
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
    if (!opsville || !finished) return;
    opsville.target.postMessage({ type: GAME_COMPLETE_EVENT, game: slug }, opsville.origin);
  }, [opsville, finished, slug]);

  const inOpsville = opsville !== null;

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
      className={
        opsvilleRequested
          ? 'h-dvh overflow-y-auto bg-background text-foreground [&_[data-game-intro]]:hidden'
          : 'min-h-screen bg-background text-foreground'
      }
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
      <div className={opsvilleRequested ? 'p-2 md:p-3' : 'p-4'}>
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
