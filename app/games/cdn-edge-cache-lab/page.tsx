import type { Metadata } from 'next';
import Link from 'next/link';
import CdnEdgeCacheLab from '@/components/games/cdn-edge-cache-lab';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('cdn-edge-cache-lab');
}

const seoLearningPoints = [
  'Build shared-cache keys from HTTP method, target URI, query string, and Vary',
  'Choose Cache-Control directives for pages, versioned assets, and personal responses',
  'Distinguish a cache hit, miss, conditional 304 revalidation, and cache bypass',
  'Use stale-while-revalidate and purges to balance freshness with latency',
  'Avoid tracking parameters fragmenting a CDN cache key',
];

function CdnEdgeCacheEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About the CDN Edge Cache Lab</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll practise</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Choosing cache lifetimes for HTML, hashed assets, and personal cart data</li>
            <li>Reading the difference between HIT, MISS, REVALIDATED (304), and BYPASS</li>
            <li>Seeing how deployment purges and no-cache change what visitors receive</li>
            <li>Keeping UTM parameters from splitting otherwise identical cache entries</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">How it works</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>A Frankfurt origin serves three CDN edges: Frankfurt, Virginia, and Singapore.</li>
            <li>
              Each request follows the shared-cache rules for storage, freshness, and validation.
            </li>
            <li>
              The latency figures are illustrative round-trip and origin-work estimates, not
              measurements.
            </li>
            <li>
              The lab intentionally uses no heuristic freshness when no explicit lifetime is
              present.
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Sources</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="https://www.rfc-editor.org/rfc/rfc9111#section-4"
            >
              RFC 9111, HTTP Caching
            </Link>
            : cache keys, directives, freshness, Age, and validation.
          </li>
          <li>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="https://www.rfc-editor.org/rfc/rfc5861#section-3"
            >
              RFC 5861, stale-while-revalidate
            </Link>
            : serving stale responses while validation happens in the background.
          </li>
        </ul>
      </div>
    </>
  );
}

export default function CdnEdgeCacheLabPage() {
  return (
    <SimulatorShell
      slug="cdn-edge-cache-lab"
      fallbackTitle="CDN Edge Cache Lab"
      fallbackDescription="Set CDN cache headers, send traffic through global edges, deploy, purge, and learn how shared HTTP caches decide what to serve."
      educational={<CdnEdgeCacheEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Can you keep a global CDN cache fast, fresh, and private? Try the CDN Edge Cache Lab."
    >
      <CdnEdgeCacheLab />
    </SimulatorShell>
  );
}
