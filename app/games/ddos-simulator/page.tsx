import type { Metadata } from 'next';
import DDoSSimulator from '@/components/games/ddos-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('ddos-simulator');
}

export default function DDoSSimulatorPage() {
  return (
    <SimulatorShell
      slug="ddos-simulator"
      seoLearningPoints={[
        'Recognize different types of DDoS attacks',
        'Implement rate limiting and traffic filtering',
        'Design resilient architectures against DDoS',
      ]}
    >
      <DDoSSimulator />
    </SimulatorShell>
  );
}
