import type { Metadata } from 'next';
import { CidrCalculator } from '@/components/tools/cidr-calculator';
import { ToolShell } from '@/components/tools/tool-shell';

export const metadata: Metadata = {
  title: 'CIDR Subnet Calculator | DevOps Daily',
  description:
    'Calculate network range, usable IPs, subnet mask, and broadcast address from a CIDR block. Check whether an IP is inside a network. Runs entirely in your browser.',
  alternates: { canonical: '/tools/cidr-calculator' },
  openGraph: {
    title: 'CIDR Subnet Calculator',
    description:
      'Parse CIDR blocks, compute ranges, and check whether an IP lives inside a network.',
    url: '/tools/cidr-calculator',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CIDR Subnet Calculator',
    description: 'Parse CIDR blocks in your browser. No sign-up.',
  },
};

function Explainer() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">How CIDR works</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">Prefix length</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The number after the slash is the prefix length. It tells you how many bits of the
            address are the network portion. <code className="font-mono">/24</code> means the
            first 24 bits are the network, leaving 8 bits (256 addresses) for hosts.
          </p>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Usable vs total</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every normal subnet reserves the first address for the network identifier and the last
            for broadcast. Usable hosts = total addresses minus 2. Point-to-point links
            (<code className="font-mono">/31</code>) and host routes (<code className="font-mono">/32</code>) are the exceptions.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Common prefixes</h4>
        <ul className="space-y-1 text-sm text-muted-foreground font-mono tabular-nums">
          <li>
            <strong className="text-foreground">/32</strong>: a single host (1 address)
          </li>
          <li>
            <strong className="text-foreground">/30</strong>: 4 addresses, 2 usable (point-to-point link)
          </li>
          <li>
            <strong className="text-foreground">/24</strong>: 256 addresses, 254 usable (classic LAN)
          </li>
          <li>
            <strong className="text-foreground">/16</strong>: 65,536 addresses (AWS VPC default)
          </li>
          <li>
            <strong className="text-foreground">/8</strong>: 16,777,216 addresses (one of the old class-A ranges)
          </li>
        </ul>
      </div>
    </>
  );
}

export default function CidrCalculatorPage() {
  return (
    <ToolShell slug="cidr-calculator" explainer={<Explainer />}>
      <CidrCalculator />
    </ToolShell>
  );
}
