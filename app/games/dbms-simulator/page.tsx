import type { Metadata } from 'next';
import DbmsSimulator from '@/components/games/dbms-simulator';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('dbms-simulator');
}

export default function DbmsSimulatorPage() {
  return <DbmsSimulator />;
}
