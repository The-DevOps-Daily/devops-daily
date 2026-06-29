import { HashGenerator } from '@/components/tools/hash-generator';
import { ToolShell } from '@/components/tools/tool-shell';
import { buildToolMetadata } from '@/lib/tools';

export const metadata = buildToolMetadata('hash-generator');

function Explainer() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">When you&apos;ll reach for this</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">Verifying a download</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A release page publishes a <code className="font-mono">sha256sum</code> next to the
            binary. Drop the file in, pick SHA-256, and paste their value into the verify box. A
            green match means the bytes you got are the bytes they shipped; a mismatch means
            corruption or tampering, so do not run it.
          </p>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Fingerprints and cache keys</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Hashes give you a stable fingerprint for a config blob, a build artifact, or a cache
            key. SHA-256 is the modern default; MD5 and SHA-1 still show up on older download pages,
            so they are here for verification only. None of them belong anywhere near password
            storage, where bcrypt or argon2 is the right tool.
          </p>
        </div>
      </div>
    </>
  );
}

export default function HashGeneratorPage() {
  return (
    <ToolShell slug="hash-generator" explainer={<Explainer />}>
      <HashGenerator />
    </ToolShell>
  );
}
