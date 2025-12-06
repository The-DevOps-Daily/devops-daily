import type { Metadata } from 'next';
import BugHunter from '@/components/games/bug-hunter';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('bug-hunter');
}

export default function BugHunterPage() {
  return <BugHunter />;
}
