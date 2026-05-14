import type { Metadata } from 'next';
import ForkBombSimulator from '@/components/games/fork-bomb-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('fork-bomb-simulator');
}

export default function ForkBombSimulatorPage() {
  return (
    <SimulatorShell
      slug="fork-bomb-simulator"
      seoLearningPoints={[
        'Understand how fork bombs create exponential process growth',
        'See how resource exhaustion leads to system crashes',
        'Learn to prevent fork bombs with ulimit, cgroups, and systemd',
      ]}
    >
      <ForkBombSimulator />
    </SimulatorShell>
  );
}
