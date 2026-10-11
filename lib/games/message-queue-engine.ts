// State transitions for the message queue simulator, kept free of React so
// they can be tested.

export type QueueMode = 'kafka' | 'rabbitmq';
export type ScenarioId = 'normal' | 'lag' | 'rebalance' | 'ordering' | 'dlq' | 'backpressure';

export interface QueueScenario {
  id: ScenarioId;
  produceRate: number;
  consumerRate: number;
  defaultConsumers: number;
  defaultPartitions: number;
  failureEvery?: number;
}

export interface PoisonMessage {
  id: string;
  /** Delivery attempts so far; 0 while it waits for its first delivery. */
  attempts: number;
}

export interface QueueState {
  produced: number;
  processed: number;
  /** Failed delivery attempts, including the ones that were retried. */
  failed: number;
  dlq: number;
  tick: number;
  consumers: number;
  partitions: number;
  isPlaying: boolean;
  log: string[];
  /** Ticks left in a Kafka group rebalance; nothing is consumed meanwhile. */
  rebalanceTicksLeft: number;
  /** A message that keeps failing and is being retried. */
  poison: PoisonMessage | null;
}

/** Deliveries a message gets before it goes to the dead letter queue. */
export const MAX_DELIVERY_ATTEMPTS = 3;
/** How long a rebalance pauses consumption, in simulator ticks. */
export const REBALANCE_TICKS = 2;
const LOG_LENGTH = 7;

export function shortId(value: number) {
  return `m-${String(value).padStart(3, '0')}`;
}

function withLog(current: QueueState, entry: string): string[] {
  return [entry, ...current.log].slice(0, LOG_LENGTH);
}

export function createQueueState(scenario: QueueScenario): QueueState {
  return {
    produced: scenario.produceRate * 2,
    processed: scenario.consumerRate,
    failed: 0,
    dlq: 0,
    tick: 1,
    consumers: scenario.defaultConsumers,
    partitions: scenario.defaultPartitions,
    isPlaying: false,
    log: [
      `producer published ${scenario.produceRate * 2} messages`,
      `consumer group started with ${scenario.defaultConsumers} consumers`,
    ],
    rebalanceTicksLeft: 0,
    poison: null,
  };
}

export function backlogOf(state: QueueState): number {
  return Math.max(state.produced - state.processed - state.dlq, 0);
}

export function activeConsumers(state: QueueState, mode: QueueMode): number {
  // A Kafka partition goes to one consumer in the group, so consumers beyond
  // the partition count sit idle. RabbitMQ consumers compete on one queue.
  return mode === 'kafka' ? Math.min(state.consumers, state.partitions) : state.consumers;
}

/** One simulator tick: consume, retry or dead-letter, and produce more. */
export function stepQueue(
  current: QueueState,
  scenario: QueueScenario,
  mode: QueueMode
): QueueState {
  const backlog = backlogOf(current);
  let processed = 0;
  let failed = 0;
  let dlq = 0;
  let poison = current.poison;
  let rebalanceTicksLeft = current.rebalanceTicksLeft;
  const notes: string[] = [];

  if (rebalanceTicksLeft > 0) {
    // While partitions change owner, no consumer in the group reads.
    notes.push(
      `rebalance in progress, consumption paused (${REBALANCE_TICKS - rebalanceTicksLeft + 1}/${REBALANCE_TICKS})`
    );
    rebalanceTicksLeft -= 1;
  } else {
    let slots = Math.min(backlog, activeConsumers(current, mode) * scenario.consumerRate);
    if (poison) {
      // The poison message takes a delivery slot each time it is retried.
      slots = Math.max(0, slots - 1);
      const attempts = poison.attempts + 1;
      failed += 1;
      if (attempts >= MAX_DELIVERY_ATTEMPTS) {
        dlq += 1;
        notes.push(
          `${poison.id} failed ${attempts} of ${MAX_DELIVERY_ATTEMPTS} attempts, moved to DLQ`
        );
        poison = null;
      } else {
        notes.push(
          attempts === 1
            ? `${poison.id} failed (attempt 1/${MAX_DELIVERY_ATTEMPTS}), will retry`
            : `${poison.id} failed again (attempt ${attempts}/${MAX_DELIVERY_ATTEMPTS}), will retry`
        );
        poison = { ...poison, attempts };
      }
    } else if (
      scenario.failureEvery !== undefined &&
      current.tick % scenario.failureEvery === 0 &&
      slots > 0
    ) {
      slots -= 1;
      failed += 1;
      poison = { id: shortId(current.processed + 1), attempts: 1 };
      notes.push(`${poison.id} failed (attempt 1/${MAX_DELIVERY_ATTEMPTS}), will retry`);
    }
    processed = slots;
    if (notes.length === 0) {
      notes.push(`processed ${processed}, backlog ${Math.max(backlog - processed - dlq, 0)}`);
    }
  }

  if (scenario.id === 'rebalance' && current.tick % 3 === 0 && rebalanceTicksLeft === 0) {
    if (mode === 'kafka') {
      rebalanceTicksLeft = REBALANCE_TICKS;
      notes.push(`consumer-${Math.min(2, current.consumers)} restarted, group rebalance started`);
    } else {
      notes.push(`consumer-${Math.min(2, current.consumers)} restarted, the others keep consuming`);
    }
  }

  const produced =
    scenario.id === 'backpressure' || scenario.id === 'lag'
      ? current.produced + scenario.produceRate
      : current.produced + Math.ceil(scenario.produceRate / 2);

  return {
    ...current,
    produced,
    processed: current.processed + processed,
    failed: current.failed + failed,
    dlq: current.dlq + dlq,
    tick: current.tick + 1,
    rebalanceTicksLeft,
    poison,
    // Newest first: the last note of this tick goes on top.
    log: [...notes.reverse(), ...current.log].slice(0, LOG_LENGTH),
  };
}

export function produceMessages(
  current: QueueState,
  scenario: QueueScenario,
  broker: string
): QueueState {
  return {
    ...current,
    produced: current.produced + scenario.produceRate,
    log: withLog(current, `produced ${scenario.produceRate} messages to ${broker}`),
  };
}

/** A consumer joins. In Kafka that triggers a group rebalance. */
export function addConsumer(current: QueueState, mode: QueueMode): QueueState {
  const consumers = Math.min(5, current.consumers + 1);
  if (consumers === current.consumers) return current;
  const idle = mode === 'kafka' && consumers > current.partitions;
  const rebalance = mode === 'kafka';
  return {
    ...current,
    consumers,
    rebalanceTicksLeft: rebalance ? REBALANCE_TICKS : current.rebalanceTicksLeft,
    log: withLog(
      current,
      `consumer-${consumers} joined${idle ? ', idle: no free partition' : ''}${rebalance ? '; group rebalance pauses consumption' : ''}`
    ),
  };
}

/** A consumer leaves. In Kafka its partitions move, so the group rebalances. */
export function removeConsumer(current: QueueState, mode: QueueMode): QueueState {
  const consumers = Math.max(1, current.consumers - 1);
  if (consumers === current.consumers) return current;
  const rebalance = mode === 'kafka';
  return {
    ...current,
    consumers,
    rebalanceTicksLeft: rebalance ? REBALANCE_TICKS : current.rebalanceTicksLeft,
    log: withLog(
      current,
      `consumer left; ${consumers} remain${rebalance ? '; group rebalance pauses consumption' : ''}`
    ),
  };
}

/** Publish a message that fails every delivery. It fails on the next tick that consumes. */
export function injectPoison(current: QueueState): QueueState {
  if (current.poison) {
    return { ...current, log: withLog(current, `${current.poison.id} is still being retried`) };
  }
  const id = shortId(current.processed + 1);
  return {
    ...current,
    poison: { id, attempts: 0 },
    log: withLog(current, `published ${id}, a message that fails on every delivery`),
  };
}
