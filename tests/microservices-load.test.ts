import { describe, expect, it } from 'vitest';
import {
  CAPACITY_PER_INSTANCE,
  SERVICE_DEMAND,
  callSuccessChance,
  serviceMetrics,
  utilization,
} from '../lib/games/microservices-load';

describe('microservices load model', () => {
  it('spreads the same demand over more instances', () => {
    expect(utilization('user', 3)).toBeCloseTo(SERVICE_DEMAND.user / (3 * CAPACITY_PER_INSTANCE));
    expect(utilization('user', 6)).toBeCloseTo(utilization('user', 3) / 2);
  });

  it('starts the user service overloaded, and scaling it up fixes that', () => {
    const before = serviceMetrics('user', 3, 'healthy');
    const after = serviceMetrics('user', 5, 'healthy');
    expect(before.utilization).toBeGreaterThan(1);
    expect(after.utilization).toBeLessThan(0.85);
    expect(after.cpu).toBeLessThan(before.cpu);
    expect(after.latency).toBeLessThan(before.latency);
    expect(callSuccessChance('user', 5, 'healthy')).toBeGreaterThan(
      callSuccessChance('user', 3, 'healthy')
    );
  });

  it('scaling down a busy service raises its latency and lowers its success rate', () => {
    expect(serviceMetrics('order', 1, 'healthy').latency).toBeGreaterThan(
      serviceMetrics('order', 3, 'healthy').latency
    );
    expect(callSuccessChance('order', 1, 'healthy')).toBeLessThan(
      callSuccessChance('order', 3, 'healthy')
    );
  });

  it('health still matters: a down service fails whatever its size', () => {
    expect(callSuccessChance('cart', 10, 'down')).toBeLessThanOrEqual(0.1);
    expect(callSuccessChance('cart', 10, 'degraded')).toBeLessThan(
      callSuccessChance('cart', 10, 'healthy')
    );
  });

  it('keeps metrics in range', () => {
    for (const n of [1, 2, 5, 10]) {
      for (const status of ['healthy', 'degraded', 'down'] as const) {
        const m = serviceMetrics('user', n, status, 1);
        expect(m.cpu).toBeGreaterThanOrEqual(5);
        expect(m.cpu).toBeLessThanOrEqual(100);
        expect(m.latency).toBeGreaterThan(0);
        expect(m.latency).toBeLessThanOrEqual(1500);
      }
    }
  });
});
