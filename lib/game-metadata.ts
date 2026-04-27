// lib/game-metadata.ts
import type { Metadata } from 'next';
import { getGameById } from './games';
import { truncateMetaDescription } from './meta-description';

/**
 * Generate Next.js metadata for a game page
 */
export async function generateGameMetadata(gameId: string): Promise<Metadata> {
  const game = await getGameById(gameId);

  if (!game) {
    return {
      title: 'Game Not Found',
      description: 'The requested game could not be found.',
    };
  }

  // Prefer the longer SEO title for the page <title> when one is set.
  // Falls back to the display title for games that already read fine.
  const pageTitle = game.seoTitle || game.title;
  const title = `${pageTitle} - DevOps Daily`;
  const description = truncateMetaDescription(game.description);
  const ogImage = `/images/games/${gameId}-og.png`;

  return {
    // Absolute title so Next.js doesn't append '| DevOps Daily'. Game page
    // titles already identify the site through topic context; the brand is
    // picked up by Google from the Organization/WebSite schema. OG + Twitter
    // titles below keep the suffix because social previews benefit from
    // brand presence.
    title: { absolute: pageTitle },
    description,
    alternates: {
      canonical: game.href,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: game.href,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: game.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}
