'use client';

import { useSearchParams } from 'next/navigation';
import { EmbedBadge } from './embed-badge';
import { ThemeProvider } from '@/components/theme-provider';
import { Suspense } from 'react';

interface EmbedLayoutProps {
  children: React.ReactNode;
  gameSlug: string;
  gameTitle: string;
}

function EmbedLayoutInner({ children, gameSlug, gameTitle }: EmbedLayoutProps) {
  const searchParams = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';
  const theme = searchParams.get('theme') as 'light' | 'dark' | null;

  if (!isEmbed) {
    return <>{children}</>;
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={theme || 'dark'}
      enableSystem={!theme}
      disableTransitionOnChange
    >
      <div className="min-h-screen bg-background text-foreground">
        {/* Embed header - minimal */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <h1 className="text-sm font-semibold truncate">{gameTitle}</h1>
          <a
            href={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com'}/games/${gameSlug}`}
            target="_blank"
            rel="noopener"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            View Full Version →
          </a>
        </div>

        {/* Game content */}
        <div className="p-4">
          {children}
        </div>

        {/* Attribution badge - always visible */}
        <EmbedBadge gameSlug={gameSlug} gameTitle={gameTitle} />
      </div>
    </ThemeProvider>
  );
}

/**
 * Wrapper component that detects embed mode and renders appropriate layout.
 * When ?embed=true is in the URL, shows minimal UI with attribution badge.
 */
export function EmbedLayout({ children, gameSlug, gameTitle }: EmbedLayoutProps) {
  return (
    <Suspense fallback={children}>
      <EmbedLayoutInner gameSlug={gameSlug} gameTitle={gameTitle}>
        {children}
      </EmbedLayoutInner>
    </Suspense>
  );
}
