// Load model for the microservices simulator.
//
// Each service gets a fixed share of the shop's traffic (its demand, in load
// units). One instance handles CAPACITY_PER_INSTANCE units before it saturates,
// so the same demand spread over more instances means less load on each one.
// Utilization (demand / total capacity) drives CPU, latency and how many calls
// to the service succeed. Health (degraded, down) still applies on top.

export type MicroserviceType = 'api-gateway' | 'user' | 'product' | 'cart' | 'order';
export type MicroserviceStatus = 'healthy' | 'degraded' | 'down';

export const CAPACITY_PER_INSTANCE = 40;

/** Load units each service receives. The user service is the hot spot. */
export const SERVICE_DEMAND: Record<MicroserviceType, number> = {
  'api-gateway': 60,
  user: 150,
  product: 90,
  cart: 60,
  order: 90,
};

/** Above this utilization, requests start to queue up and time out. */
export const SATURATION_POINT = 0.85;

const BASE_LATENCY_MS = 60;
const MAX_LATENCY_MS = 1500;

export function utilization(type: MicroserviceType, instances: number): number {
  return SERVICE_DEMAND[type] / (Math.max(1, instances) * CAPACITY_PER_INSTANCE);
}

/** CPU % for a healthy service at this utilization, before random noise. */
export function cpuForUtilization(u: number): number {
  return Math.min(99, Math.max(5, 8 + 85 * Math.min(u, 1.1)));
}

/**
 * Latency for a healthy service: a base cost multiplied by a simple queueing
 * factor, so latency stays flat at low load and climbs steeply near capacity.
 */
export function latencyForUtilization(u: number): number {
  return Math.min(MAX_LATENCY_MS, BASE_LATENCY_MS / (1 - Math.min(u, 0.96)));
}

/** Share of calls an overloaded service still answers (1 below saturation). */
export function overloadSuccessFactor(u: number): number {
  if (u <= SATURATION_POINT) return 1;
  return Math.max(0.3, 1 - (u - SATURATION_POINT) * 1.2);
}

const HEALTH_SUCCESS: Record<MicroserviceStatus, number> = {
  healthy: 0.99,
  degraded: 0.7,
  down: 0.1,
};

/** Chance that a call to a service succeeds, from its health and its load. */
export function callSuccessChance(
  type: MicroserviceType,
  instances: number,
  status: MicroserviceStatus
): number {
  if (status === 'down') return HEALTH_SUCCESS.down;
  return HEALTH_SUCCESS[status] * overloadSuccessFactor(utilization(type, instances));
}

/** CPU and latency a service shows, from its load and health. `noise` is in [-1, 1]. */
export function serviceMetrics(
  type: MicroserviceType,
  instances: number,
  status: MicroserviceStatus,
  noise = 0
): { cpu: number; latency: number; utilization: number } {
  const u = utilization(type, instances);
  if (status === 'down') {
    return { cpu: 90 + 5 * (noise + 1), latency: 800 + 200 * (noise + 1), utilization: u };
  }
  let cpu = cpuForUtilization(u);
  let latency = latencyForUtilization(u);
  if (status === 'degraded') {
    cpu = Math.min(99, cpu + 20);
    latency = Math.min(MAX_LATENCY_MS, latency * 3);
  }
  return {
    cpu: Math.min(99, Math.max(5, cpu + 3 * noise)),
    latency: Math.min(MAX_LATENCY_MS, Math.max(1, latency * (1 + 0.1 * noise))),
    utilization: u,
  };
}
