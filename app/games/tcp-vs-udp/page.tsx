import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import TcpVsUdpSimulator from '@/components/games/tcp-vs-udp';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('tcp-vs-udp');
}

export default async function TcpVsUdpPage() {
  const game = await getGameById('tcp-vs-udp');
  const gameTitle = game?.title || 'TCP vs UDP Simulator';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/tcp-vs-udp', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/tcp-vs-udp' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <Breadcrumb items={breadcrumbItems} />

        <div className="flex flex-col mx-auto max-w-7xl">
          <h2 className="sr-only">
            TCP vs UDP Simulator - Learn Network Protocol Differences
          </h2>
          <TcpVsUdpSimulator />

          <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">Understanding TCP vs UDP</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold text-cyan-600 dark:text-cyan-400">TCP (Transmission Control Protocol)</h3>
                <ul className="space-y-2 text-sm list-disc list-inside">
                  <li>Connection-oriented with 3-way handshake</li>
                  <li>Guaranteed delivery and ordering</li>
                  <li>Automatic retransmission of lost packets</li>
                  <li>Flow control and congestion management</li>
                  <li>Higher overhead but reliable</li>
                  <li>Best for: HTTP, FTP, email, file transfers</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold text-green-600 dark:text-green-400">UDP (User Datagram Protocol)</h3>
                <ul className="space-y-2 text-sm list-disc list-inside">
                  <li>Connectionless - no handshake required</li>
                  <li>No delivery or ordering guarantees</li>
                  <li>No retransmission - fire and forget</li>
                  <li>Minimal overhead, very fast</li>
                  <li>Lower latency, higher throughput</li>
                  <li>Best for: Streaming, gaming, VoIP, DNS</li>
                </ul>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 When to Use Each Protocol</h3>
              <ul className="space-y-1 text-sm">
                <li>• <strong>Use TCP</strong> when data integrity is critical (banking, file downloads, web pages)</li>
                <li>• <strong>Use UDP</strong> when speed matters more than reliability (live video, multiplayer games)</li>
                <li>• Some apps use both: DNS queries over UDP, zone transfers over TCP</li>
                <li>• Modern protocols like QUIC combine benefits of both (HTTP/3)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
