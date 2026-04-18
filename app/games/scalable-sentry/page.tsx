import type { Metadata } from 'next';
import { GameSeoContent } from '@/components/games/game-seo-content';
import ScalableSentry from '@/components/games/scalable-sentry';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('scalable-sentry');
}

export default function ScalableSentryPage() {
  return (
    <>
      <GameSeoContent
        title="Scalable Sentry"
        description="Design and defend a scalable infrastructure against increasing traffic and failure scenarios. Learn about auto-scaling, load balancing, caching, and high availability patterns."
        category="Infrastructure"
        tags={['scaling', 'infrastructure', 'high-availability', 'load-balancing']}
        learningPoints={[
          'Design auto-scaling architectures',
          'Implement load balancing strategies',
          'Build high-availability systems',
          'Handle traffic spikes gracefully',
        ]}
      />
      <SimulatorShell slug="scalable-sentry">
        <ScalableSentry />
      </SimulatorShell>
    </>
  );
}
