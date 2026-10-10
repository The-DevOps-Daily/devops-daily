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
  'Why every non-2xx response is retried, 4xx included, and what each status tells you',
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
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <h4 className="mb-2 text-sm font-semibold">1. Persist and retry</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A delivery must survive a restart. Retry every timeout and every non-2xx response with
            backoff. A 4xx keeps failing until the receiver is fixed, so it runs out the schedule.
          </p>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">2. Verify raw bytes</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The signature covers the message ID, timestamp, and raw body. Verify before parsing so
            whitespace or serialization changes cannot invalidate an authentic request.
          </p>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">3. Deduplicate</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Delivery is at-least-once. Store the stable message ID with the business update in one
            transaction, then return 200 when the same message arrives again.
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <h4 className="mb-2 text-sm font-semibold">From simulator to production</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The{' '}
          <a
            href="/posts/reliable-webhook-delivery-retries-signatures-idempotency"
            className="font-medium text-primary underline underline-offset-2"
          >
            production webhook delivery guide
          </a>{' '}
          turns this flow into a typed sender and receiver you can build from. This simulator uses
          the published{' '}
          <a
            href="https://docs.svix.com/retries"
            className="font-medium text-primary underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            Svix retry rules
          </a>{' '}
          (eight attempts over about 27 hours, a 15 second timeout, and a retry for any non-2xx
          response) and genuine Standard Webhooks signatures. For the underlying queue and
          throttling concepts, try the{' '}
          <a
            href="/games/message-queue-simulator"
            className="font-medium text-primary underline underline-offset-2"
          >
            message queue simulator
          </a>{' '}
          and{' '}
          <a
            href="/games/rate-limit-simulator"
            className="font-medium text-primary underline underline-offset-2"
          >
            rate limit simulator
          </a>
          .
        </p>
      </div>
    </>
  );
}

export default function WebhookDeliverySimulatorPage() {
  return (
    <SimulatorShell
      slug="webhook-delivery-simulator"
      fallbackTitle="Webhook Delivery Simulator"
      fallbackDescription="Send a webhook through retries, signature verification, and receiver-side deduplication."
      educational={<WebhookDeliveryEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Watch what production actually does with a webhook: retries, exponential backoff, HMAC signature verification and idempotency, all in the browser."
    >
      <WebhookDeliverySimulator />
    </SimulatorShell>
  );
}
