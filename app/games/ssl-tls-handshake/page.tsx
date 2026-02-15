import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import SSLTLSHandshakeSimulator from '@/components/games/ssl-tls-handshake-simulator';
import { Twitter, Facebook, Linkedin } from 'lucide-react';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';
import { GameActions } from '@/components/games/game-actions';
import { GameSponsors } from '@/components/games/game-sponsors';
import { CarbonAds } from '@/components/carbon-ads';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('ssl-tls-handshake');
}

export default async function SSLTLSHandshakePage() {
  const game = await getGameById('ssl-tls-handshake');
  const gameTitle = game?.title || 'SSL/TLS Handshake Simulator';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/ssl-tls-handshake', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/ssl-tls-handshake' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumb items={breadcrumbItems} />
          <GameActions gameSlug="ssl-tls-handshake" gameTitle={gameTitle} />
        </div>

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">
            SSL/TLS Handshake Simulator - Learn Secure Connection Establishment
          </h2>

          {/* Sponsors */}
          <GameSponsors />

          <SSLTLSHandshakeSimulator />

          <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">Understanding SSL/TLS Handshakes</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">What You'll Learn</h3>
                <ul className="space-y-2 text-sm list-disc list-inside">
                  <li>How TLS 1.2 and TLS 1.3 handshakes differ</li>
                  <li>Certificate chain validation process</li>
                  <li>Key exchange mechanisms (RSA, ECDHE)</li>
                  <li>Cipher suite negotiation</li>
                  <li>Common TLS failure scenarios</li>
                  <li>Perfect Forward Secrecy (PFS)</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">TLS Versions</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-green-600">TLS 1.3:</strong> Latest version with
                    1-RTT handshake, mandatory PFS, and removed insecure algorithms
                  </div>
                  <div>
                    <strong className="text-blue-600">TLS 1.2:</strong> Still widely used,
                    2-RTT handshake with optional PFS
                  </div>
                  <div>
                    <strong className="text-red-600">TLS 1.0/1.1:</strong> Deprecated,
                    should not be used due to security vulnerabilities
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 mt-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-500/20">
              <h3 className="mb-2 text-lg font-semibold">🔐 Key Concepts</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  • <strong>Certificate:</strong> Digital document that binds a public key to an identity
                </li>
                <li>
                  • <strong>Cipher Suite:</strong> Set of algorithms for encryption, authentication, and key exchange
                </li>
                <li>
                  • <strong>PFS:</strong> Ensures session keys aren't compromised even if server's private key is
                </li>
                <li>
                  • <strong>AEAD:</strong> Authenticated Encryption with Associated Data (e.g., AES-GCM)
                </li>
              </ul>
            </div>

            <div className="p-4 mt-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-500/20">
              <h3 className="mb-2 text-lg font-semibold">🎯 Best Practices</h3>
              <ul className="space-y-1 text-sm">
                <li>• Use TLS 1.3 where possible, TLS 1.2 as minimum</li>
                <li>• Disable weak cipher suites (RC4, DES, export ciphers)</li>
                <li>• Enable HSTS to prevent protocol downgrade attacks</li>
                <li>• Keep certificates up to date and use short validity periods</li>
                <li>• Use Certificate Transparency (CT) logging</li>
              </ul>
            </div>
          </div>

          {/* Carbon Ads */}
          <div className="w-full max-w-md mx-auto my-8">
            <CarbonAds />
          </div>

          <div className="w-full max-w-md mx-auto my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this simulator</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this SSL/TLS Handshake Simulator! Learn how secure connections work.')}&url=${encodeURIComponent('https://devops-daily.com/games/ssl-tls-handshake')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/ssl-tls-handshake')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/ssl-tls-handshake')}`}
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
