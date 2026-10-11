import { describe, expect, it } from 'vitest';
import {
  MAX_DELIVERY_ATTEMPTS,
  REBALANCE_TICKS,
  addConsumer,
  createQueueState,
  injectPoison,
  removeConsumer,
  stepQueue,
  type QueueScenario,
} from '../lib/games/message-queue-engine';

const normal: QueueScenario = {
  id: 'normal',
  produceRate: 6,
  consumerRate: 3,
  defaultConsumers: 2,
  defaultPartitions: 3,
};
const rebalance: QueueScenario = {
  ...normal,
  id: 'rebalance',
  produceRate: 7,
  defaultPartitions: 4,
};
const dlq: QueueScenario = { ...normal, id: 'dlq', failureEvery: 2 };

describe('message queue engine', () => {
  it('a Kafka consumer joining pauses consumption for the rebalance, then resumes', () => {
    let s = addConsumer(createQueueState(normal), 'kafka');
    expect(s.rebalanceTicksLeft).toBe(REBALANCE_TICKS);
    for (let i = 0; i < REBALANCE_TICKS; i++) {
      const before = s.processed;
      s = stepQueue(s, normal, 'kafka');
      expect(s.processed).toBe(before);
    }
    const before = s.processed;
    s = stepQueue(s, normal, 'kafka');
    expect(s.processed).toBeGreaterThan(before);
  });

  it('RabbitMQ consumers join and leave without pausing the others', () => {
    let s = addConsumer(createQueueState(normal), 'rabbitmq');
    expect(s.rebalanceTicksLeft).toBe(0);
    s = removeConsumer(s, 'rabbitmq');
    const before = s.processed;
    s = stepQueue(s, normal, 'rabbitmq');
    expect(s.processed).toBeGreaterThan(before);
  });

  it('the rebalance scenario restarts a consumer every third tick in Kafka mode', () => {
    let s = createQueueState(rebalance);
    s = stepQueue(s, rebalance, 'kafka'); // tick 1
    s = stepQueue(s, rebalance, 'kafka'); // tick 2
    expect(s.rebalanceTicksLeft).toBe(0);
    s = stepQueue(s, rebalance, 'kafka'); // tick 3 starts a rebalance
    expect(s.rebalanceTicksLeft).toBe(REBALANCE_TICKS);
    expect(s.log[0]).toMatch(/rebalance started/);
  });

  it(`gives a poison message ${MAX_DELIVERY_ATTEMPTS} delivery attempts before the DLQ`, () => {
    let s = injectPoison(createQueueState(normal));
    expect(s.poison?.attempts).toBe(0);
    expect(s.failed).toBe(0);
    for (let attempt = 1; attempt < MAX_DELIVERY_ATTEMPTS; attempt++) {
      s = stepQueue(s, normal, 'kafka');
      expect(s.poison?.attempts).toBe(attempt);
      expect(s.dlq).toBe(0);
    }
    s = stepQueue(s, normal, 'kafka');
    expect(s.poison).toBeNull();
    expect(s.dlq).toBe(1);
    expect(s.failed).toBe(MAX_DELIVERY_ATTEMPTS);
    expect(s.log[0]).toMatch(/moved to DLQ/);
  });

  it('a poison message published during a rebalance waits until consumption resumes', () => {
    let s = injectPoison(addConsumer(createQueueState(normal), 'kafka'));
    for (let i = 0; i < REBALANCE_TICKS; i++) {
      s = stepQueue(s, normal, 'kafka');
      expect(s.poison?.attempts).toBe(0);
      expect(s.failed).toBe(0);
    }
    s = stepQueue(s, normal, 'kafka');
    expect(s.poison?.attempts).toBe(1);
  });

  it('the DLQ scenario starts poison messages on its own and retries them first', () => {
    let s = createQueueState(dlq);
    for (let i = 0; i < 12; i++) s = stepQueue(s, dlq, 'kafka');
    expect(s.dlq).toBeGreaterThan(0);
    expect(s.failed).toBeGreaterThanOrEqual(s.dlq * MAX_DELIVERY_ATTEMPTS);
  });

  it('does not start a second poison message while one is being retried', () => {
    const s = injectPoison(injectPoison(createQueueState(normal)));
    expect(s.poison?.attempts).toBe(0);
    expect(s.log[0]).toMatch(/still being retried/);
  });
});
