'use client';

import { useSearchParams, usePathname } from 'next/navigation';
import { EmbedBadge } from '@/components/embed';
import { Suspense, useEffect, useState } from 'react';
import { SimGameProvider } from '@/components/games/sim/sim-game';
import { EmbedProvider } from '@/lib/games/embed-context';
import { embedThemeFromSearch } from '@/lib/games/embed-theme';
import type { SimGameInfo } from '@/lib/games/sim-game-info';
import {
  GAME_COMPLETE_EVENT,
  OPSVILLE_CHANNEL,
  OPSVILLE_READY,
  cutOpener,
  isOpsvilleHello,
  isRunId,
} from '@/lib/games/game-complete';

interface EmbedClientProps {
  slug: string;
  title: string;
  GameComponent: React.ComponentType;
  info?: SimGameInfo;
}

function EmbedContent({ slug, title, GameComponent, info }: EmbedClientProps) {
  const searchParams = useSearchParams();
  const theme = searchParams.get('theme') || 'dark';
  const hideTitle = searchParams.get('hideTitle') === 'true';
  const opsvilleRequested = searchParams.get('embed') === 'opsville';
  const run = searchParams.get('run');
  const pathname = usePathname();
  // Set only when Opsville, on this same origin, answers our "ready" for this
  // run. Any other site that adds ?embed=opsville keeps the title bar and badge.
  const [opsville, setOpsville] = useState<{ send: (message: unknown) => void } | null>(null);
  const [finished, setFinished] = useState(false);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com';
  const gameUrl = `${siteUrl}/games/${slug}`;

  // SiteThemeProvider forces ?theme= on this route without saving it. Calling
  // setTheme here would write the visitor's theme for the whole site, since
  // Opsville frames this page on the same origin.

  useEffect(() => {
    if (!opsvilleRequested) return;
    cutOpener(window);
    if (!isRunId(run)) return;
    const origin = window.location.origin;
    const framed = window.parent !== window;
    let channel: BroadcastChannel | null = null;
    let send: (message: unknown) => void;
    if (framed) {
      // Opsville frames this page on desktop. The target origin keeps the
      // message from reaching a parent page on any other site.
      send = (message) => window.parent.postMessage(message, origin);
    } else if (typeof BroadcastChannel === 'function') {
      // On phones Opsville opens this page in a new tab, with noopener.
      const ch = new BroadcastChannel(OPSVILLE_CHANNEL);
      channel = ch;
      send = (message) => ch.postMessage(message);
    } else {
      return;
    }
    const onHello = (data: unknown) => {
      if (isOpsvilleHello(data, run)) setOpsville((prev) => prev ?? { send });
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source === window.parent && event.origin === origin) onHello(event.data);
    };
    if (framed) window.addEventListener('message', onMessage);
    if (channel) channel.onmessage = (event) => onHello(event.data);
    const onComplete = () => setFinished(true);
    window.addEventListener(GAME_COMPLETE_EVENT, onComplete);
    send({ type: OPSVILLE_READY, run });
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener(GAME_COMPLETE_EVENT, onComplete);
      channel?.close();
    };
  }, [opsvilleRequested, run]);

  // Tell Opsville the player finished the lessons, so it can open the quiz gate.
  useEffect(() => {
    if (!opsville || !finished || !isRunId(run)) return;
    opsville.send({ type: GAME_COMPLETE_EVENT, game: slug, run });
  }, [opsville, finished, slug, run]);

  const inOpsville = opsville !== null;

  // Hide header/footer when in embed mode
  useEffect(() => {
    if (pathname?.includes('/embed')) {
      // Hide header and footer
      const header = document.querySelector('header');
      const footer = document.querySelector('footer');
      const skipToContent = document.getElementById('skip-to-content');
      const mainElement = document.getElementById('main-content');

      if (header) (header as HTMLElement).style.display = 'none';
      if (footer) (footer as HTMLElement).style.display = 'none';
      if (skipToContent) (skipToContent as HTMLElement).style.display = 'none';

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

      {/* Game content. --sim-embed-pad is this padding, top plus bottom, so a
          SimFrame stage still fits the frame. */}
      <div
        className={
          opsvilleRequested
            ? 'p-2 [--sim-embed-pad:16px] md:p-3 md:[--sim-embed-pad:24px]'
            : 'p-4 [--sim-embed-pad:32px]'
        }
      >
        <EmbedProvider
          host={opsvilleRequested ? 'opsville' : 'other'}
          theme={embedThemeFromSearch(`?${searchParams.toString()}`)}
        >
          {info ? (
            <SimGameProvider info={info}>
              <GameComponent />
            </SimGameProvider>
          ) : (
            <GameComponent />
          )}
        </EmbedProvider>
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
