import type { Metadata } from 'next';
import Link from 'next/link';
import GraphqlDataloaderLab from '@/components/games/graphql-dataloader-lab';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('graphql-dataloader-lab');
}

const seoLearningPoints = [
  'Identify the GraphQL N+1 query pattern across nested list fields',
  'Trace GraphQL resolver levels and their event-loop batching boundaries',
  'Use DataLoader to batch user and comment lookups into IN queries',
  'Understand DataLoader key deduplication and per-loader caching',
  'Prevent cross-request data leaks by creating loaders per request',
];

function GraphqlDataloaderEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About the GraphQL N+1 and DataLoader Lab</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll practise</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Counting the database work hidden behind a nested GraphQL selection set</li>
            <li>Seeing one resolver level finish before the next nested level starts</li>
            <li>Batching same-tick user and comment lookups through DataLoader</li>
            <li>Distinguishing a request-scoped cache from a dangerous shared cache</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">How it works</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              Toggle fields, loaders and cache scope, then run the same blog query as Ada or Bo.
            </li>
            <li>
              The trace follows each resolver level, shows its event-loop tick, and records the SQL
              sent at that level.
            </li>
            <li>
              The lab uses a small deterministic blog data set, so the query counts and cache result
              stay repeatable while you compare configurations.
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Sources</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <Link
              href="https://github.com/graphql/dataloader#batching"
              className="text-primary underline-offset-4 hover:underline"
            >
              graphql/dataloader README: batching and per-request caching
            </Link>
          </li>
          <li>
            <Link
              href="https://spec.graphql.org/October2021/#sec-Execution"
              className="text-primary underline-offset-4 hover:underline"
            >
              GraphQL specification: execution
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}

export default function GraphqlDataloaderLabPage() {
  return (
    <SimulatorShell
      slug="graphql-dataloader-lab"
      fallbackTitle="GraphQL N+1 and DataLoader Lab"
      fallbackDescription="Trace GraphQL resolver queries, batch same-tick loads with DataLoader, and see why one shared cache can leak a previous viewer’s user data."
      educational={<GraphqlDataloaderEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Can you find the GraphQL N+1 queries and fix them with DataLoader? Try the lab."
    >
      <GraphqlDataloaderLab />
    </SimulatorShell>
  );
}
