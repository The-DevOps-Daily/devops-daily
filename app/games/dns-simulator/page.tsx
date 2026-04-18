import type { Metadata } from 'next';
import DnsSimulator from '../../../components/games/dns-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('dns-simulator');
}

function DnsEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Understanding DNS Resolution</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">DNS Hierarchy</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Root Servers (.):</strong> The top of the DNS
              hierarchy — 13 root server clusters worldwide direct queries to TLD servers.
            </li>
            <li>
              <strong className="text-foreground">TLD Servers (.com, .org):</strong> Manage
              top-level domains and point to authoritative nameservers.
            </li>
            <li>
              <strong className="text-foreground">Authoritative Servers:</strong> Hold the actual
              DNS records for specific domains.
            </li>
            <li>
              <strong className="text-foreground">Recursive Resolvers:</strong> Your ISP or DNS
              provider (like 1.1.1.1 or 8.8.8.8) that does the lookup work.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">DNS Record Types</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">A Record:</strong> Maps domain to IPv4 address
              (e.g., 192.168.1.1).
            </li>
            <li>
              <strong className="text-foreground">AAAA Record:</strong> Maps domain to IPv6 address
              (e.g., 2001:db8::1).
            </li>
            <li>
              <strong className="text-foreground">CNAME Record:</strong> Alias pointing to another
              domain name.
            </li>
            <li>
              <strong className="text-foreground">MX Record:</strong> Mail server for the domain.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Key concepts</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">TTL (Time To Live):</strong> How long a DNS record
            can be cached before needing refresh.
          </li>
          <li>
            <strong className="text-foreground">Recursive query:</strong> The resolver does all the
            work and returns the final answer.
          </li>
          <li>
            <strong className="text-foreground">Iterative query:</strong> Each server returns a
            referral; the client follows the chain.
          </li>
          <li>
            <strong className="text-foreground">DNS caching:</strong> Happens at browser, OS, and
            resolver levels to speed up lookups.
          </li>
        </ul>
      </div>
    </>
  );
}

export default function DnsSimulatorPage() {
  return (
    <SimulatorShell slug="dns-simulator" educational={<DnsEducational />}>
      <DnsSimulator />
    </SimulatorShell>
  );
}
