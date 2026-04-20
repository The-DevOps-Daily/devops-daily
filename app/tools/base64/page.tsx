import { Base64Encoder } from '@/components/tools/base64-encoder';
import { ToolShell } from '@/components/tools/tool-shell';
import { buildToolMetadata } from '@/lib/tools';

export const metadata = buildToolMetadata('base64');

function Explainer() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">When you&apos;ll reach for this</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">Kubernetes Secrets</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Kubernetes stores Secret data as base64. Encoding a token or password here gives you
            the value that goes into <code className="font-mono">data:</code> in a Secret manifest.
            Remember: base64 is encoding, not encryption. Your secrets aren&apos;t secret yet.
          </p>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">API debugging</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            HTTP Basic auth, SAML responses, OAuth state parameters, signed URLs — lots of
            day-to-day DevOps work involves URL encoding or base64. Paste, inspect, move on.
          </p>
        </div>
      </div>
    </>
  );
}

export default function Base64Page() {
  return (
    <ToolShell slug="base64" explainer={<Explainer />}>
      <Base64Encoder />
    </ToolShell>
  );
}
