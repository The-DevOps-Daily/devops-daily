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
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <h4 className="mb-2 text-sm font-semibold">1. Persist and retry</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A delivery must survive a restart. Retry timeouts, 429s, and server errors with backoff;
            drop malformed requests that another attempt cannot fix.
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
          This simulator uses the published{' '}
          <a
            href="https://www.svix.com/?ref=devops-daily"
            className="font-medium text-primary underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer sponsored"
          >
            Svix Dispatch
          </a>{' '}
          retry schedule and genuine Standard Webhooks signatures. Dispatch adds the durable queue,
          endpoint controls, attempt history, replay, and customer portal that turn these mechanics
          into a complete delivery product. For the underlying queue and throttling concepts, try
          the{' '}
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
