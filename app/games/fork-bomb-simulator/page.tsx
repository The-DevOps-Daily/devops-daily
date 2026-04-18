import type { Metadata } from 'next';
import { GameSeoContent } from '@/components/games/game-seo-content';
import ForkBombSimulator from '@/components/games/fork-bomb-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('fork-bomb-simulator');
}

export default function ForkBombSimulatorPage() {
  return (
    <>
      <GameSeoContent
        title="Fork Bomb Simulator"
        description="Visualize how the :(){ :|:& };: fork bomb works. Watch exponential process growth, understand resource exhaustion, and learn prevention with ulimit and cgroups."
        category="Security"
        tags={['linux', 'bash', 'security', 'processes']}
        learningPoints={[
          'Understand how fork bombs create exponential process growth',
          'See how resource exhaustion leads to system crashes',
          'Learn to prevent fork bombs with ulimit, cgroups, and systemd',
        ]}
      />
      <SimulatorShell slug="fork-bomb-simulator">
        <ForkBombSimulator />
      </SimulatorShell>
    </>
  );
}
