import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import BugHunter from '@/components/games/bug-hunter';
import { generateGameMetadata } from '@/lib/game-metadata';
import { GameActions } from '@/components/games/game-actions';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('bug-hunter');
}

export default function BugHunterPage() {
  const gameTitle = 'Bug Hunter';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/bug-hunter', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: 'Bug Hunter', url: '/games/bug-hunter' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 pt-4 mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="bug-hunter" gameTitle={gameTitle} />
        </div>
      </div>

      <BugHunter />
    </>
  );
}
