import type { Metadata } from 'next';
import TcpVsUdpSimulator from '@/components/games/tcp-vs-udp';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('tcp-vs-udp');
}

function TcpVsUdpEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Understanding TCP vs UDP</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">TCP (Transmission Control Protocol)</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Connection-oriented with 3-way handshake</li>
            <li>Guaranteed delivery and ordering</li>
            <li>Automatic retransmission of lost packets</li>
            <li>Flow control and congestion management</li>
            <li>Higher overhead but reliable</li>
            <li>Best for: HTTP, FTP, email, file transfers</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">UDP (User Datagram Protocol)</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Connectionless. No handshake required.</li>
            <li>No delivery or ordering guarantees</li>
            <li>No retransmission. Fire and forget.</li>
            <li>Minimal overhead, very fast</li>
            <li>Lower latency, higher throughput</li>
            <li>Best for: Streaming, gaming, VoIP, DNS</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">When to use each protocol</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Use TCP</strong> when data integrity is critical
            (banking, file downloads, web pages).
          </li>
          <li>
            <strong className="text-foreground">Use UDP</strong> when speed matters more than
            reliability (live video, multiplayer games).
          </li>
          <li>Some apps use both: DNS queries over UDP, zone transfers over TCP.</li>
          <li>Modern protocols like QUIC combine benefits of both (HTTP/3).</li>
        </ul>
      </div>
    </>
  );
}

export default function TcpVsUdpPage() {
  return (
    <SimulatorShell slug="tcp-vs-udp" educational={<TcpVsUdpEducational />}>
      <TcpVsUdpSimulator />
    </SimulatorShell>
  );
}
