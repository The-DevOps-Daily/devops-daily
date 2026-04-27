import Link from 'next/link';
import { ArrowLeft, Twitter, Facebook, Linkedin } from 'lucide-react';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema, SoftwareApplicationSchema } from '@/components/schema-markup';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { CarbonAds } from '@/components/carbon-ads';
import { getGameById, getActiveGames } from '@/lib/games';
import { cn } from '@/lib/utils';

interface SimulatorShellProps {
  /** Game id that matches the games registry (lib/games.ts) */
  slug: string;
  /** Fallback title if the game registry lookup fails */
  fallbackTitle?: string;
  /** Fallback description if the game registry lookup fails */
  fallbackDescription?: string;
  /** The interactive simulator itself */
  children: React.ReactNode;
  /** Optional concept/background content rendered under the simulator */
  educational?: React.ReactNode;
  /** Custom share text for social links; defaults to a generic message */
  shareText?: string;
  /** Hide the CarbonAds block (use sparingly; e.g. for in-game pages that already embed ads) */
  hideAds?: boolean;
  /** Hide the social share footer */
  hideShare?: boolean;
  className?: string;
}

/**
 * Shared chrome for every simulator / game page. Encapsulates:
 * - Schemas (Breadcrumb + SoftwareApplication)
 * - Container + breadcrumb + GameActions
 * - Sponsors
 * - Educational content wrapper (styled consistently)
 * - CarbonAds
 * - Share footer + "Back to simulators" link
 *
 * Game components are passed as `children` and rendered untouched.
 */
export async function SimulatorShell({
  slug,
  fallbackTitle,
  fallbackDescription,
  children,
  educational,
  shareText,
  hideAds = false,
  hideShare = false,
  className,
}: SimulatorShellProps) {
  const game = await getGameById(slug);
  const title = game?.title ?? fallbackTitle ?? 'Simulator';
  const description = game?.description ?? fallbackDescription ?? '';
  const href = game?.href ?? `/games/${slug}`;
  const category = game?.category ?? 'DevOps Simulator';
  const tags = game?.tags;

  // Pick up to 3 related games. Same category first, then fall back to any
  // active game so even niche categories have a "try next" list. Excludes
  // the current game and anything coming-soon.
  const allGames = await getActiveGames();
  const sameCategory = game?.category
    ? allGames.filter(
        (g) => g.id !== slug && g.category === game.category,
      )
    : [];
  const otherGames = allGames.filter(
    (g) => g.id !== slug && !sameCategory.includes(g),
  );
  const relatedGames = [...sameCategory, ...otherGames].slice(0, 3);

  const shareUrl = `https://devops-daily.com${href}`;
  const defaultShareText = shareText ?? `Check out ${title} on DevOps Daily`;

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: title, href, isCurrent: true },
  ];
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: title, url: href },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      {game && (
        <SoftwareApplicationSchema
          name={title}
          description={description}
          url={href}
          category={category}
          keywords={tags}
        />
      )}

      <div className={cn('container px-4 py-8 mx-auto', className)}>
        {/* Breadcrumb + actions */}
        <div className="flex items-center justify-between mb-4 gap-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug={slug} gameTitle={title} />
        </div>

        <div className="flex flex-col mx-auto max-w-7xl">
          {/* Monospace label matches the homepage section chrome */}
          <p className="text-xs font-mono text-muted-foreground mb-1">
            // simulator
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground max-w-3xl mb-6">{description}</p>
          )}

          <GameSponsors />

          {/* Simulator itself */}
          <div className="w-full">{children}</div>

          {/* Educational content */}
          {educational && (
            <section className="w-full my-10 rounded-md border bg-muted/20 p-6">
              {educational}
            </section>
          )}

          {/* Try next - related games. Server-rendered so each game has
              real internal inlinks from at least 3 sibling games (was 1
              link, from /games index, before this section existed). */}
          {relatedGames.length > 0 && (
            <section className="w-full my-10">
              <h2 className="text-lg font-semibold mb-4">Try next</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {relatedGames.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={g.href}
                      className="block rounded-lg border p-4 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    >
                      <p className="text-xs text-muted-foreground font-mono mb-2">
                        {g.type === 'simulator' ? '// simulator' : '// game'}
                      </p>
                      <p className="font-medium mb-1">{g.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {g.description}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Carbon ads */}
          {!hideAds && (
            <div className="w-full max-w-md mx-auto my-8">
              <CarbonAds />
            </div>
          )}

          {/* Share + back-to-games footer */}
          {!hideShare && (
            <div className="w-full border-t pt-8 mt-8 flex flex-col sm:flex-row items-center justify-between gap-6">
              <Link
                href="/games"
                className="inline-flex items-center gap-1.5 text-sm font-mono text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-green-500/80">$</span> cd /games
              </Link>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-mono text-xs">// share</span>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(defaultShareText)}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on Twitter"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <Twitter className="w-3.5 h-3.5" strokeWidth={1.5} />
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on Facebook"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <Facebook className="w-3.5 h-3.5" strokeWidth={1.5} />
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on LinkedIn"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <Linkedin className="w-3.5 h-3.5" strokeWidth={1.5} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
