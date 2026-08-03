import type { Metadata } from 'next';
import LogAggregationPipelineSimulator from '@/components/games/log-aggregation-pipeline-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('log-aggregation-pipeline-simulator');
}

const seoLearningPoints = [
  'How application logs move through collectors, processors, buffers, indexes, and search',
  'Why parsing and filtering happen before durable indexing',
  'How bounded buffers absorb short bursts but eventually overflow',
  'How traffic spikes, parser mismatches, and slow indexing create different failure signals',
  'How document routing distributes indexed logs across search shards',
  'Why filtered, rejected, and dropped events never appear in search results',
];

function LogAggregationEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">How a log pipeline stays reliable</h3>
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <h4 className="mb-2 text-sm font-semibold">1. Collect close to the source</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Lightweight agents tail files or container output and forward events. Local queues keep
            a brief network problem from immediately losing logs.
          </p>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">2. Shape before storage</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Parsers extract searchable fields, enrichment adds context, and filters remove known
            noise. Reject counters expose format changes before they become blind spots.
          </p>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">3. Buffer the mismatch</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Collection and indexing rarely run at exactly the same rate. A durable bounded buffer
            absorbs bursts while backlog alerts give operators time to restore capacity.
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <h4 className="mb-2 text-sm font-semibold">What to alert on in production</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Monitor input rate, queue age and depth, parser rejection rate, buffer utilization,
          dropped events, indexing latency, and shard balance together. A single healthy search
          query does not prove the pipeline is complete: missing logs may have been rejected long
          before they reached the index.
        </p>
      </div>
    </>
  );
}

export default function LogAggregationPipelineSimulatorPage() {
  return (
    <SimulatorShell
      slug="log-aggregation-pipeline-simulator"
      fallbackTitle="Log Aggregation Pipeline Simulator"
      fallbackDescription="Follow logs through collection, parsing, buffering, sharded indexing, and search."
      educational={<LogAggregationEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="See how production logs move from applications to searchable shards—and where parser failures and backpressure can lose them."
    >
      <LogAggregationPipelineSimulator />
    </SimulatorShell>
  );
}
