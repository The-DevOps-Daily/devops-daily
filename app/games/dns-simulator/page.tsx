import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import DnsSimulator from '../../../components/games/dns-simulator';
import { Twitter, Facebook, Linkedin } from 'lucide-react';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('dns-simulator');
}

export default async function DnsSimulatorPage() {
  const game = await getGameById('dns-simulator');
  const gameTitle = game?.title || 'DNS Resolution Simulator';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/dns-simulator', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/dns-simulator' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <Breadcrumb items={breadcrumbItems} />

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">
            DNS Resolution Simulator - Learn How Domain Name System Works
          </h2>
          <DnsSimulator />

          {/* Educational Content */}
          <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">Understanding DNS Resolution</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">DNS Hierarchy</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-blue-600">Root Servers (.):</strong> The top of the DNS
                    hierarchy. 13 root server clusters worldwide direct queries to TLD servers.
                  </div>
                  <div>
                    <strong className="text-cyan-600">TLD Servers (.com, .org):</strong> Manage
                    top-level domains and point to authoritative nameservers.
                  </div>
                  <div>
                    <strong className="text-green-600">Authoritative Servers:</strong> Hold the
                    actual DNS records for specific domains.
                  </div>
                  <div>
                    <strong className="text-purple-600">Recursive Resolvers:</strong> Your ISP or
                    DNS provider (like 1.1.1.1 or 8.8.8.8) that does the lookup work.
                  </div>
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">DNS Record Types</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-indigo-600">A Record:</strong> Maps domain to IPv4
                    address (e.g., 192.168.1.1)
                  </div>
                  <div>
                    <strong className="text-pink-600">AAAA Record:</strong> Maps domain to IPv6
                    address (e.g., 2001:db8::1)
                  </div>
                  <div>
                    <strong className="text-teal-600">CNAME Record:</strong> Alias pointing to
                    another domain name
                  </div>
                  <div>
                    <strong className="text-orange-600">MX Record:</strong> Mail server for the
                    domain
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 Key Concepts</h3>
              <ul className="space-y-1 text-sm">
                <li>• <strong>TTL (Time To Live):</strong> How long a DNS record can be cached before needing refresh</li>
                <li>• <strong>Recursive Query:</strong> Resolver does all the work and returns final answer</li>
                <li>• <strong>Iterative Query:</strong> Each server returns a referral, client follows the chain</li>
                <li>• <strong>DNS Caching:</strong> Happens at browser, OS, and resolver levels to speed up lookups</li>
              </ul>
            </div>
          </div>

          {/* Share buttons */}
          <div className="w-full max-w-md my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this simulator</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this DNS Resolution Simulator! Learn how DNS works step-by-step.')}&url=${encodeURIComponent('https://devops-daily.com/games/dns-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/dns-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/dns-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#0A66C2] text-white rounded-full hover:bg-[#095fb8] transition-colors"
              >
                <Linkedin size={20} />
                <span className="sr-only">Share on LinkedIn</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
