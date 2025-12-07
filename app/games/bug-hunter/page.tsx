import type { Metadata } from 'next';
import { BreadcrumbSchema } from '@/components/schema-markup';
import BugHunter from '@/components/games/bug-hunter';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('bug-hunter');
}

export default function BugHunterPage() {
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: 'Bug Hunter', url: '/games/bug-hunter' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <BugHunter />
    </>
  );
}
