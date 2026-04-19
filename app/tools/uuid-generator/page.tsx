import type { Metadata } from 'next';
import { UuidGenerator } from '@/components/tools/uuid-generator';
import { ToolShell } from '@/components/tools/tool-shell';

export const metadata: Metadata = {
  title: 'UUID and Secret Generator | DevOps Daily',
  description:
    'Generate UUIDs (v4, v7), hex tokens, base64 secrets, and Kubernetes Secret values in your browser. Uses the Web Crypto API.',
  alternates: { canonical: '/tools/uuid-generator' },
  openGraph: {
    title: 'UUID and Secret Generator',
    description: 'Cryptographically secure UUIDs and secrets, generated in your browser.',
    url: '/tools/uuid-generator',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UUID and Secret Generator',
    description: 'Cryptographically secure UUIDs and secrets, in your browser.',
  },
};

function Explainer() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Which format do I pick?</h3>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>
          <strong className="text-foreground">UUID v4</strong>: random 128-bit identifier. Great
          for record IDs where order doesn&apos;t matter.
        </li>
        <li>
          <strong className="text-foreground">UUID v7</strong>: timestamp-prefixed, so IDs sort
          chronologically. Better for database primary keys because it avoids the index
          fragmentation that v4 causes.
        </li>
        <li>
          <strong className="text-foreground">Hex 32 / 64</strong>: raw hex tokens. Good for
          opaque API tokens or request IDs. 32 hex chars = 128 bits, 64 hex chars = 256 bits.
        </li>
        <li>
          <strong className="text-foreground">Base64 32</strong>: URL-safe-ish token, 24 random
          bytes → 32 base64 chars. Fits well in cookies and query strings.
        </li>
        <li>
          <strong className="text-foreground">Kube Secret</strong>: base64-encoded 32 random
          bytes, ready to paste into a Secret manifest&apos;s <code className="font-mono">data:</code> field.
        </li>
      </ul>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Security note</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">
          All values are generated locally with <code className="font-mono">crypto.getRandomValues</code>. Nothing is sent to a server. If your threat model
          requires hardware-backed randomness (HSM), don&apos;t use a browser tool for that.
        </p>
      </div>
    </>
  );
}

export default function UuidGeneratorPage() {
  return (
    <ToolShell slug="uuid-generator" explainer={<Explainer />}>
      <UuidGenerator />
    </ToolShell>
  );
}
