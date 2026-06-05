import type { Metadata } from 'next';
import Link from 'next/link';
import LatencyPercentilesSimulator from '@/components/games/latency-percentiles-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('latency-percentiles-simulator');
}

function LatencyPercentilesEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">How P90, P95, and P99 latency work</h3>
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <h4 className="mb-3 text-sm font-semibold">Percentiles are sorted ranks</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">P90:</strong> sort every request by latency. The
              P90 value is the point where 90% of requests are at or below that value.
            </li>
            <li>
              <strong className="text-foreground">P95:</strong> leaves only the slowest 5% above
              the cutoff, which makes it useful for SLOs and user-facing dashboards.
            </li>
            <li>
              <strong className="text-foreground">P99:</strong> focuses on the slowest 1%, so it
              exposes rare but painful paths that averages often hide.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Why average is not enough</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              A few very slow requests can be invisible when the median and average look normal.
            </li>
            <li>
              Tail latency often comes from retries, lock waits, cold starts, cache misses, or slow
              dependencies.
            </li>
            <li>
              Percentiles show how many users are affected, not just how slow the typical request
              is.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">How to use them in practice</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Use P50 to understand the normal request path.</li>
            <li>Use P90 or P95 to track broad user experience and SLO health.</li>
            <li>Use P99 to investigate tail events, capacity limits, and reliability regressions.</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Keep learning</h4>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            className="rounded-md border bg-background px-3 py-2 hover:border-primary/50"
            href="/posts/what-is-p99-latency"
          >
            What is P99 latency?
          </Link>
          <Link
            className="rounded-md border bg-background px-3 py-2 hover:border-primary/50"
            href="/posts/slos-slis-error-budgets-practical-guide"
          >
            SLOs, SLIs, and error budgets
          </Link>
          <Link
            className="rounded-md border bg-background px-3 py-2 hover:border-primary/50"
            href="/games/promql-playground"
          >
            PromQL playground
          </Link>
        </div>
      </div>
    </>
  );
}

export default function LatencyPercentilesPage() {
  return (
    <SimulatorShell
      slug="latency-percentiles-simulator"
      educational={<LatencyPercentilesEducational />}
      shareText="Try the P90, P95, and P99 Latency Percentiles Simulator on DevOps Daily."
      seoLearningPoints={[
        'Understand that P90, P95, and P99 are percentile rank cutoffs',
        'Visualize how latency distributions create long-tail behavior',
        'Compare average latency, median latency, and percentile latency',
        'See why P99 exposes slow requests that averages can hide',
        'Practice choosing the right latency metric for SLOs and incident response',
      ]}
    >
      <LatencyPercentilesSimulator />
    </SimulatorShell>
  );
}
