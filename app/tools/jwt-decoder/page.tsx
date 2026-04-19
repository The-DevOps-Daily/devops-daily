import type { Metadata } from 'next';
import { JwtDecoder } from '@/components/tools/jwt-decoder';
import { ToolShell } from '@/components/tools/tool-shell';

export const metadata: Metadata = {
  title: 'JWT Decoder | DevOps Daily',
  description:
    'Decode and inspect JSON Web Tokens in your browser. See the header, payload, signature, and human-readable expiry. Nothing is sent to a server.',
  alternates: { canonical: '/tools/jwt-decoder' },
  openGraph: {
    title: 'JWT Decoder',
    description: 'Inspect JWTs in your browser. Header, payload, expiry, all client-side.',
    url: '/tools/jwt-decoder',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JWT Decoder',
    description: 'Inspect JWTs in your browser. All client-side.',
  },
};

function Explainer() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Anatomy of a JWT</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        A JWT is three base64url-encoded segments separated by dots. The decoder above splits them
        for you:
      </p>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>
          <strong className="text-foreground">Header</strong>: algorithm (alg), token type (typ),
          and sometimes a key id (kid) to tell the server which key signed this token.
        </li>
        <li>
          <strong className="text-foreground">Payload</strong>: the claims. Standard ones include{' '}
          <code className="font-mono">iss</code> (issuer),{' '}
          <code className="font-mono">sub</code> (subject),{' '}
          <code className="font-mono">aud</code> (audience),{' '}
          <code className="font-mono">exp</code> (expiry, UNIX seconds),{' '}
          <code className="font-mono">iat</code> (issued at),{' '}
          <code className="font-mono">nbf</code> (not before).
        </li>
        <li>
          <strong className="text-foreground">Signature</strong>: used to verify the token was
          issued by the holder of the key. This decoder does not verify signatures, decoding is
          a separate concern from validating.
        </li>
      </ul>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Security note</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Decoding a JWT is trivial, the payload is not encrypted. Don&apos;t put secrets in a
          JWT payload. Always verify the signature server-side before trusting any claim.
        </p>
      </div>
    </>
  );
}

export default function JwtDecoderPage() {
  return (
    <ToolShell slug="jwt-decoder" explainer={<Explainer />}>
      <JwtDecoder />
    </ToolShell>
  );
}
