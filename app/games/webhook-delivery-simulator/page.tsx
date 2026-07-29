import type { Metadata } from 'next';
import WebhookDeliverySimulator from '@/components/games/webhook-delivery-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('webhook-delivery-simulator');
}

const seoLearningPoints = [
  'Why a webhook delivery is a durable state machine rather than a single HTTP POST',
  'How exponential backoff spreads eight retry attempts across roughly 27 hours',
  'Which HTTP responses are worth retrying and which should be dropped immediately',
  'Why a timeout is the ambiguous case that makes idempotency mandatory',
  'How HMAC-SHA256 webhook signatures are built over the id, timestamp and raw body',
  'Why verifying a re-serialized JSON body always fails, and what to do instead',
  'How a timestamp tolerance window limits replay attacks',
  'How receivers deduplicate deliveries using a message ID that is stable across retries',
];

function WebhookDeliveryEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this webhook delivery simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>What actually happens to a webhook after you send it</li>
            <li>Why retrying a 400 for a day is worse than dropping it</li>
            <li>How a signature is built, and the four ways verification fails</li>
            <li>Why the same event can arrive twice, and whose job it is to cope</li>
            <li>Which status code your handler should return, and when</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">The three headers that matter</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">svix-id:</strong> identifies the message and stays
              the same across every retry, which is what makes it usable as a dedup key
            </li>
            <li>
              <strong className="text-foreground">svix-timestamp:</strong> signed alongside the body,
              so an old captured request cannot be replayed indefinitely
            </li>
            <li>
              <strong className="text-foreground">svix-signature:</strong> one or more{' '}
              <span className="font-mono text-xs">v1,&lt;base64&gt;</span> digests, space-delimited
              while two secrets are live during a rotation
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">The mistake that costs the most time</h4>
        <p className="text-sm text-muted-foreground">
          Verifying the wrong bytes. The signature covers the raw request body, and{' '}
          <span className="font-mono text-xs">express.json()</span> parses that body and throws the
          bytes away. Re-serializing the parsed object with{' '}
          <span className="font-mono text-xs">JSON.stringify</span> is not guaranteed to reproduce
          them, because key order, whitespace and unicode escaping can all differ. The result is a
          signature that fails for a payload that was never tampered with, which sends people
          hunting for a wrong secret. Use{' '}
          <span className="font-mono text-xs">express.raw()</span> on the webhook route and verify
          before you parse.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Why the signatures here are real</h4>
        <p className="text-sm text-muted-foreground">
          The simulator computes genuine HMAC-SHA256 digests in your browser using Web Crypto, over
          the same{' '}
          <span className="font-mono text-xs">
            {'`${id}.${timestamp}.${body}`'}
          </span>{' '}
          content that the Standard Webhooks spec defines. The signing secret is a fixture rather
          than a credential, so you can copy any request out of the inspector and verify it yourself
          with the <span className="font-mono text-xs">svix</span> library or a few lines of{' '}
          <span className="font-mono text-xs">node:crypto</span> and get the same answer. Nothing is
          sent anywhere, and no API key is required.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Doing this in production</h4>
        <p className="text-sm text-muted-foreground">
          The retry schedule modelled here is the published one from{' '}
          <a
            href="https://www.svix.com/?ref=devops-daily"
            className="font-medium text-primary underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer sponsored"
          >
            Svix Dispatch
          </a>
          , who run webhook sending as a service: eight attempts over about 27 hours, then the
          message is marked failed and an operational webhook tells the sender. Endpoints that stay
          broken are disabled rather than retried forever, each endpoint gets its own secret and
          rate limit, and customers get their own delivery log and replay button instead of asking
          you to read production logs. Building the retry engine is a week; building the operations
          around it is the part teams underestimate.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Go deeper</h4>
        <p className="text-sm text-muted-foreground">
          <a
            href="/posts/reliable-webhook-delivery-retries-signatures-idempotency"
            className="font-medium text-primary underline underline-offset-2"
          >
            What it actually takes to deliver a webhook in production
          </a>{' '}
          has the working Node sender and Express receiver behind this simulator, including the
          transaction that makes deduplication safe. The{' '}
          <a
            href="/games/message-queue-simulator"
            className="font-medium text-primary underline underline-offset-2"
          >
            message queue simulator
          </a>{' '}
          covers at-least-once delivery more generally, and the{' '}
          <a
            href="/games/rate-limit-simulator"
            className="font-medium text-primary underline underline-offset-2"
          >
            rate limit simulator
          </a>{' '}
          covers what to do when an endpoint answers with 429.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Why learn it this way?</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            Backoff is abstract until you watch attempt six land ten hours after attempt one.
          </li>
          <li>
            Most receivers have never had a duplicate delivered on purpose, so their dedup path has
            never actually run.
          </li>
          <li>
            Breaking a signature deliberately is the fastest way to learn which of the four checks
            your production error is really hitting.
          </li>
        </ul>
      </div>
    </>
  );
}

export default function WebhookDeliverySimulatorPage() {
  return (
    <SimulatorShell
      slug="webhook-delivery-simulator"
      fallbackTitle="Webhook Delivery Simulator"
      fallbackDescription="Send a webhook, choose how the endpoint responds, and watch every delivery attempt, the exponential backoff between them, the real HMAC signature, and how a receiver deduplicates a redelivery."
      educational={<WebhookDeliveryEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Watch what production actually does with a webhook: retries, exponential backoff, HMAC signature verification and idempotency, all in the browser."
    >
      <WebhookDeliverySimulator />
    </SimulatorShell>
  );
}
