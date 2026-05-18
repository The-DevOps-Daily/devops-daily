import type { Metadata } from 'next';
import PacketJourney from '@/components/games/packet-journey';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('packet-journey');
}

export default function PacketJourneyPage() {
  return (
    <SimulatorShell
      slug="packet-journey"
      seoLearningPoints={[
        'Understand the TCP/IP network model',
        'Trace packet routing through network hops',
        'Learn about DNS resolution, NAT, and firewalls',
      ]}
    >
      <PacketJourney />
    </SimulatorShell>
  );
}
