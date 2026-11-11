import type { Metadata } from 'next';
import Link from 'next/link';
import IdempotencyRetryLab from '@/components/games/idempotency-retry-lab';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('idempotency-retry-lab');
}

const seoLearningPoints = [
  'Create one UUID v4 idempotency key per intended operation and reuse it only for retries',
  'Replay a saved response instead of creating a duplicate charge after an ambiguous network failure',
  'Handle payload mismatches and concurrent keyed requests with distinct HTTP responses',
  'Choose exponential backoff or full jitter to reduce retry spikes during an outage',
  'Send exhausted jobs to a dead-letter queue with their key and final error',
];

function IdempotencyRetryLabEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About the Idempotency and Retry Lab</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll practise</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Separating a lost response from a failed payment operation</li>
            <li>Reusing one idempotency key for one intended checkout and its retries</li>
            <li>Reading replay, payload-mismatch, and in-progress outcomes</li>
            <li>Comparing immediate retries with exponential backoff and full jitter</li>
            <li>Putting an exhausted job in a dead-letter queue instead of retrying forever</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">How it works</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              The checkout model sends POST /charges to a payments API with a fixed example amount.
            </li>
            <li>
              The API records the request fingerprint and the first response for each keyed
              operation.
            </li>
            <li>
              Its outage chart is a simplified deterministic model of client arrivals, not a
              production measurement.
            </li>
            <li>
              The dead-letter queue records the final error and key, and does not retry its jobs
              automatically.
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
              href="https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header"
            >
              IETF draft, The Idempotency-Key HTTP Header Field
            </Link>
            : key scope, payload fingerprints, conflicts, and expiration guidance.
          </li>
          <li>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="https://docs.stripe.com/api/idempotent_requests"
            >
              Stripe documentation, Idempotent requests
            </Link>
            : storing the first result, including failures, and removing keys after at least a day.
          </li>
          <li>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/"
            >
              AWS Architecture Blog, Exponential Backoff And Jitter
            </Link>
            : capped exponential delays and randomized full jitter during contention.
          </li>
        </ul>
      </div>
    </>
  );
}

export default function IdempotencyRetryLabPage() {
  return (
    <SimulatorShell
      slug="idempotency-retry-lab"
      fallbackTitle="Idempotency and Retry Lab"
      fallbackDescription="Lose payment responses, replay idempotent requests, compare retry backoff patterns, and send exhausted jobs to a dead-letter queue."
      educational={<IdempotencyRetryLabEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Can you avoid duplicate charges while a payments API is unreliable? Try the Idempotency and Retry Lab."
    >
      <IdempotencyRetryLab />
    </SimulatorShell>
  );
}
