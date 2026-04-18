import type { Metadata } from 'next';
import SSLTLSHandshakeSimulator from '@/components/games/ssl-tls-handshake-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('ssl-tls-handshake');
}

function SslTlsEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Understanding SSL/TLS Handshakes</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How TLS 1.2 and TLS 1.3 handshakes differ</li>
            <li>Certificate chain validation process</li>
            <li>Key exchange mechanisms (RSA, ECDHE)</li>
            <li>Cipher suite negotiation</li>
            <li>Common TLS failure scenarios</li>
            <li>Perfect Forward Secrecy (PFS)</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">TLS versions</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">TLS 1.3:</strong> Latest version with 1-RTT
              handshake, mandatory PFS, and removed insecure algorithms.
            </li>
            <li>
              <strong className="text-foreground">TLS 1.2:</strong> Still widely used, 2-RTT
              handshake with optional PFS.
            </li>
            <li>
              <strong className="text-foreground">TLS 1.0/1.1:</strong> Deprecated, should not be
              used due to security vulnerabilities.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Key concepts</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Certificate:</strong> Digital document that binds
            a public key to an identity.
          </li>
          <li>
            <strong className="text-foreground">Cipher Suite:</strong> Set of algorithms for
            encryption, authentication, and key exchange.
          </li>
          <li>
            <strong className="text-foreground">PFS:</strong> Ensures session keys aren&apos;t
            compromised even if server&apos;s private key is.
          </li>
          <li>
            <strong className="text-foreground">AEAD:</strong> Authenticated Encryption with
            Associated Data (e.g., AES-GCM).
          </li>
        </ul>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Best practices</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Use TLS 1.3 where possible, TLS 1.2 as minimum.</li>
          <li>Disable weak cipher suites (RC4, DES, export ciphers).</li>
          <li>Enable HSTS to prevent protocol downgrade attacks.</li>
          <li>Keep certificates up to date and use short validity periods.</li>
          <li>Use Certificate Transparency (CT) logging.</li>
        </ul>
      </div>
    </>
  );
}

export default function SSLTLSHandshakePage() {
  return (
    <SimulatorShell
      slug="ssl-tls-handshake"
      educational={<SslTlsEducational />}
      shareText="Check out this SSL/TLS Handshake Simulator! Learn how secure connections work."
    >
      <SSLTLSHandshakeSimulator />
    </SimulatorShell>
  );
}
