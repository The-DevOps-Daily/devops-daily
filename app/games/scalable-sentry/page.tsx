import type { Metadata } from 'next';
import ScalableSentry from '@/components/games/scalable-sentry';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('scalable-sentry');
}

export default function ScalableSentryPage() {
  return (
    <SimulatorShell
      slug="scalable-sentry"
      seoLearningPoints={[
        'Design auto-scaling architectures',
        'Implement load balancing strategies',
        'Build high-availability systems',
        'Handle traffic spikes gracefully',
      ]}
    >
      <ScalableSentry />
    </SimulatorShell>
  );
}
