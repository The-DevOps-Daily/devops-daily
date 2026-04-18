import type { Metadata } from 'next';
import { GameSeoContent } from '@/components/games/game-seo-content';
import PacketJourney from '@/components/games/packet-journey';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('packet-journey');
}

export default function PacketJourneyPage() {
  return (
    <>
      <GameSeoContent
        title="Packet Journey"
        description="Follow a network packet from source to destination through the TCP/IP stack. Visualize how data travels through layers, routers, switches, and firewalls in this interactive networking simulator."
        category="Networking"
        tags={['networking', 'tcp-ip', 'packets', 'routing']}
        learningPoints={[
          'Understand the TCP/IP network model',
          'Trace packet routing through network hops',
          'Learn about DNS resolution, NAT, and firewalls',
        ]}
      />
      <SimulatorShell slug="packet-journey">
        <PacketJourney />
      </SimulatorShell>
    </>
  );
}
