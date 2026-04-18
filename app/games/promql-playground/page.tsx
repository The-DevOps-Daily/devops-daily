import type { Metadata } from 'next';
import PromqlPlayground from '../../../components/games/promql-playground';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('promql-playground');
}

function PromqlEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Understanding Prometheus &amp; PromQL</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">Core concepts</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Time Series:</strong> A stream of timestamped
              values identified by a metric name and labels (key-value pairs).
            </li>
            <li>
              <strong className="text-foreground">Instant Vector:</strong> A set of time series
              with one sample per series at a single point in time.
            </li>
            <li>
              <strong className="text-foreground">Range Vector:</strong> A set of time series with
              multiple samples over a time range (e.g., [5m]).
            </li>
            <li>
              <strong className="text-foreground">Scalar:</strong> A simple numeric floating point
              value.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Common functions</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">rate():</strong> Calculate per-second rate over
              a time range (for counters).
            </li>
            <li>
              <strong className="text-foreground">irate():</strong> Instant rate based on last two
              samples (more responsive).
            </li>
            <li>
              <strong className="text-foreground">sum/avg/max/min:</strong> Aggregation operators
              across multiple series.
            </li>
            <li>
              <strong className="text-foreground">histogram_quantile():</strong> Calculate
              percentiles from histogram buckets.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Key concepts</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Counters:</strong> Monotonically increasing values
            (use rate() or increase()).
          </li>
          <li>
            <strong className="text-foreground">Gauges:</strong> Values that can go up and down
            (use directly).
          </li>
          <li>
            <strong className="text-foreground">Histograms:</strong> Observations bucketed by
            value (use histogram_quantile()).
          </li>
          <li>
            <strong className="text-foreground">Summaries:</strong> Pre-calculated quantiles (use
            directly, no histogram_quantile()).
          </li>
        </ul>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Label matching</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <code className="rounded bg-muted px-1 py-0.5">=</code> Exact match:{' '}
            <code className="rounded bg-muted px-1 py-0.5">method=&quot;GET&quot;</code>
          </li>
          <li>
            <code className="rounded bg-muted px-1 py-0.5">!=</code> Negative match:{' '}
            <code className="rounded bg-muted px-1 py-0.5">status!=&quot;500&quot;</code>
          </li>
          <li>
            <code className="rounded bg-muted px-1 py-0.5">=~</code> Regex match:{' '}
            <code className="rounded bg-muted px-1 py-0.5">path=~&quot;/api/.*&quot;</code>
          </li>
          <li>
            <code className="rounded bg-muted px-1 py-0.5">!~</code> Negative regex:{' '}
            <code className="rounded bg-muted px-1 py-0.5">job!~&quot;dev-.*&quot;</code>
          </li>
        </ul>
      </div>
    </>
  );
}

export default function PromqlPlaygroundPage() {
  return (
    <SimulatorShell
      slug="promql-playground"
      educational={<PromqlEducational />}
      shareText="Master Prometheus Query Language with this interactive PromQL Playground!"
    >
      <PromqlPlayground />
    </SimulatorShell>
  );
}
