import type { Metadata } from 'next';
import CachingSimulator from '../../../components/games/caching-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('caching-simulator');
}

function CachingEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Understanding Caching Strategies</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">Eviction Policies</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">LRU (Least Recently Used):</strong> Evicts items
              not accessed recently. Most common in practice.
            </li>
            <li>
              <strong className="text-foreground">LFU (Least Frequently Used):</strong> Evicts
              items accessed least often. Great for identifying hot data.
            </li>
            <li>
              <strong className="text-foreground">FIFO (First In, First Out):</strong> Simple
              queue-based approach, evicts oldest items first.
            </li>
            <li>
              <strong className="text-foreground">TTL (Time To Live):</strong> Evicts items based
              on expiration time. Common for sessions.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Write Strategies</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Write-Through:</strong> Writes to cache and
              database simultaneously. Strong consistency but higher latency.
            </li>
            <li>
              <strong className="text-foreground">Write-Back:</strong> Writes to cache first, async
              to database. Better performance but risk of data loss.
            </li>
            <li>
              <strong className="text-foreground">Write-Around:</strong> Writes directly to
              database, bypasses cache. Reduces cache pollution.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Key concepts</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Hit rate:</strong> Percentage of requests served
            from cache (higher is better).
          </li>
          <li>
            <strong className="text-foreground">Cache size:</strong> Balance between memory usage
            and hit rate.
          </li>
          <li>
            <strong className="text-foreground">Hot data:</strong> Frequently accessed items that
            benefit most from caching.
          </li>
          <li>
            <strong className="text-foreground">Cache invalidation:</strong> One of the hardest
            problems in computer science.
          </li>
        </ul>
      </div>
    </>
  );
}

export default function CachingSimulatorPage() {
  return (
    <SimulatorShell slug="caching-simulator" educational={<CachingEducational />}>
      <CachingSimulator />
    </SimulatorShell>
  );
}
