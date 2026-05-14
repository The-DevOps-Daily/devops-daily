import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getGameById, getAllGameIds } from '@/lib/games';
import { getGameComponent } from '@/components/games/game-component-registry';
import { EmbedClient } from './embed-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const gameIds = await getAllGameIds();
  return gameIds.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameById(slug);

  if (!game) {
    return { title: 'Game Not Found' };
  }

  return {
    title: `${game.title} - Embed`,
    description: game.description,
    robots: { index: false, follow: false },
  };
}

export default async function EmbedGamePage({ params }: PageProps) {
  const { slug } = await params;

  const game = await getGameById(slug);
  const GameComponent = getGameComponent(slug);

  if (!game || !GameComponent) {
    notFound();
  }

  return <EmbedClient slug={slug} title={game.title} GameComponent={GameComponent} />;
}
