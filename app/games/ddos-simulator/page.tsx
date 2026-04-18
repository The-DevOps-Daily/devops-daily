import type { Metadata } from 'next';
import { GameSeoContent } from '@/components/games/game-seo-content';
import DDoSSimulator from '@/components/games/ddos-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('ddos-simulator');
}

export default function DDoSSimulatorPage() {
  return (
    <>
      <GameSeoContent
        title="DDoS Attack Simulator"
        description="Understand Distributed Denial of Service attacks and defense mechanisms through interactive simulation. Learn about attack vectors, mitigation strategies, and incident response."
        category="Security"
        tags={['security', 'ddos', 'networking', 'incident-response']}
        learningPoints={[
          'Recognize different types of DDoS attacks',
          'Implement rate limiting and traffic filtering',
          'Design resilient architectures against DDoS',
        ]}
      />
      <SimulatorShell slug="ddos-simulator">
        <DDoSSimulator />
      </SimulatorShell>
    </>
  );
}
