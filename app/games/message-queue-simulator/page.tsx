import type { Metadata } from 'next';
import MessageQueueSimulator from '@/components/games/message-queue-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('message-queue-simulator');
}

function MessageQueueEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this message queue simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How producers send messages through a broker to consumers</li>
            <li>How Kafka partitions and consumer groups create parallelism</li>
            <li>How RabbitMQ exchanges, bindings, queues, and acknowledgments fit together</li>
            <li>Why lag, backpressure, and rebalancing matter during production incidents</li>
            <li>How poison messages move into a dead letter queue for later inspection</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Concepts covered</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Kafka:</strong> topics, partitions, offsets,
              consumer groups, ordering, and at-least-once delivery
            </li>
            <li>
              <strong className="text-foreground">RabbitMQ:</strong> exchanges, queues, bindings,
              prefetch, acknowledgments, retries, and DLX policies
            </li>
            <li>
              <strong className="text-foreground">Operations:</strong> lag monitoring, rebalancing,
              poison message handling, and backpressure response
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Browser-safe by design</h4>
        <p className="text-sm text-muted-foreground">
          This simulator does not run Kafka or RabbitMQ. It models the queue mechanics in the
          browser so you can see cause and effect before operating a real broker in production.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">The production lesson</h4>
        <p className="text-sm text-muted-foreground">
          Message queues decouple systems, but they do not remove failure. You still need idempotent
          consumers, lag alerts, retry limits, dead letter handling, and a clear ownership model for
          messages that cannot be processed.
        </p>
      </div>
    </>
  );
}

export default function MessageQueueSimulatorPage() {
  return (
    <SimulatorShell
      slug="message-queue-simulator"
      fallbackTitle="Message Queue Simulator"
      fallbackDescription="Visualize how message queues work across Kafka and RabbitMQ patterns. Explore producers, topics, partitions, exchanges, queues, consumer groups, lag, rebalancing, backpressure, ordering, and dead letter queues."
      educational={<MessageQueueEducational />}
      shareText="Visualize Kafka and RabbitMQ message queue behavior with this interactive simulator."
      seoLearningPoints={[
        'How producers, brokers, and consumers interact',
        'How Kafka partitions and consumer groups affect lag and ordering',
        'How RabbitMQ exchanges and queue bindings route messages',
        'How dead letter queues protect systems from poison messages',
      ]}
    >
      <MessageQueueSimulator />
    </SimulatorShell>
  );
}
