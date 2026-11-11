'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { Activity, Boxes, Minus, Network, Pause, Play, Plus, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SIM_CATEGORY,
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFrame,
  SimMissionList,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  useMissions,
  type Mission,
  type SimTone,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';
import {
  CAPACITY_PER_INSTANCE,
  SERVICE_DEMAND,
  callSuccessChance,
  serviceMetrics,
} from '@/lib/games/microservices-load';

// Service types
type ServiceType = 'api-gateway' | 'user' | 'product' | 'cart' | 'order';
type ServiceStatus = 'healthy' | 'degraded' | 'down';

interface Service {
  id: string;
  type: ServiceType;
  name: string;
  description?: string;
  status: ServiceStatus;
  instances: number;
  cpu: number;
  memory: number;
  latency: number;
  position: { x: number; y: number };
}

interface ServiceCall {
  id: string;
  from: string;
  to: string;
  success: boolean;
  latency: number;
}

const SERVICE_TEMPLATES: Record<ServiceType, { name: string; icon: string }> = {
  'api-gateway': { name: 'API Gateway', icon: '🌐' },
  user: { name: 'User Service', icon: '👤' },
  product: { name: 'Product Service', icon: '📦' },
  cart: { name: 'Cart Service', icon: '🛒' },
  order: { name: 'Order Service', icon: '📋' },
};

// Simulation constants
const REQUEST_INTERVAL_MS = 400; // Interval between service calls (~2.5 req/sec)
const METRICS_UPDATE_INTERVAL_MS = 200; // How often metrics refresh
const SERVICE_CALL_ANIMATION_MIN_MS = 300; // Min latency for visual animation
const SERVICE_CALL_ANIMATION_MAX_MS = 500; // Max latency for visual animation
const MIN_INSTANCES = 1;
const MAX_INSTANCES = 10;

const CALL_CLEANUP_DELAY_MS = 1000; // Delay before removing completed service calls

// Metrics calculation constants

const MEMORY_BASE_MIN = 20;
const MEMORY_BASE_MAX = 100;
const MEMORY_DOWN_MIN = 85;
const MEMORY_DOWN_RANGE = 15;
const MEMORY_DEGRADED_MIN = 55;
const MEMORY_DEGRADED_RANGE = 25;
const MEMORY_VARIATION = 4;

const HEALTH_MULTIPLIER_DOWN = 0.2; // Success rate multiplier for down services
const HEALTH_MULTIPLIER_DEGRADED = 0.8; // Success rate multiplier for degraded services

const GRAPH_POSITIONS: Record<ServiceType, { x: number; y: number }> = {
  'api-gateway': { x: 195, y: 36 },
  user: { x: 98, y: 140 },
  product: { x: 292, y: 140 },
  cart: { x: 66, y: 244 },
  order: { x: 324, y: 244 },
};

const SERVICE_CATEGORY: Record<ServiceType, keyof typeof SIM_CATEGORY> = {
  'api-gateway': 'primary',
  user: 'sky',
  product: 'violet',
  cart: 'emerald',
  order: 'neutral',
};

interface MicroservicesMissionState {
  services: Service[];
  totalRequests: number;
  successfulRequests: number;
  outageConfirmed: boolean;
  recoverySuccessBaseline: number | null;
}

const START_INSTANCES: Record<string, number> = {
  'api-gateway-1': 2,
  'user-1': 3,
  'product-1': 3,
  'cart-1': 2,
  'order-1': 3,
};

const MISSIONS: Mission<MicroservicesMissionState>[] = [
  {
    id: 'traffic',
    label: 'Start the traffic and watch requests flow from the gateway to the services.',
    hint: 'Press Start.',
    check: (state) => state.totalRequests > 0,
  },
  {
    id: 'scale',
    label: 'Scale a busy service out to more instances.',
    hint: 'Pick a service and add instances.',
    check: (state) =>
      state.services.some((service) => service.instances > (START_INSTANCES[service.id] ?? 1)),
  },
  {
    id: 'failure',
    label: 'Take a service down and see which requests fail.',
    hint: 'Mark a service as down while traffic runs.',
    check: (state) =>
      state.services.some((service) => service.status === 'down') && state.outageConfirmed,
  },
  {
    id: 'recover',
    label: 'Bring it back and watch the error rate fall.',
    hint: 'Restore the service.',
    check: (state) =>
      state.outageConfirmed &&
      state.services.every((service) => service.status === 'healthy') &&
      state.recoverySuccessBaseline !== null &&
      state.successfulRequests > state.recoverySuccessBaseline,
  },
];

type MicroservicesTab = 'graph' | 'details';

function statusTone(status: ServiceStatus): SimTone {
  if (status === 'healthy') return 'success';
  if (status === 'degraded') return 'warning';
  return 'danger';
}

export default function MicroservicesSimulator() {
  const [mounted, setMounted] = useState(false);
  const reducedMotion = useReducedMotion();
  const [tab, setTab] = useState<MicroservicesTab>('graph');
  const [dismissed, setDismissed] = useState(false);

  // Game state
  const [isRunning, setIsRunning] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [activeCalls, setActiveCalls] = useState<ServiceCall[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [successfulRequests, setSuccessfulRequests] = useState(0);
  const [failedRequests, setFailedRequests] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showAdvancedServices, setShowAdvancedServices] = useState(false);
  const [outageConfirmed, setOutageConfirmed] = useState(false);
  const [recoverySuccessBaseline, setRecoverySuccessBaseline] = useState<number | null>(null);

  const animationRef = useRef<number | undefined>(undefined);
  const lastCallTimeRef = useRef<number>(0);
  const lastMetricsUpdateRef = useRef<number>(0);
  const servicesRef = useRef<Service[]>([]);
  const outageFailureBaselineRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
    initializeServices();
  }, []);

  // Sync selectedService when services array changes
  useEffect(() => {
    servicesRef.current = services;
    if (selectedService) {
      const updated = services.find((s) => s.id === selectedService.id);
      if (
        updated &&
        (updated.cpu !== selectedService.cpu ||
          updated.memory !== selectedService.memory ||
          updated.latency !== selectedService.latency ||
          updated.instances !== selectedService.instances ||
          updated.status !== selectedService.status)
      ) {
        setSelectedService(updated);
      }
    }
  }, [services, selectedService]);

  const initializeServices = () => {
    const initialServices: Service[] = [
      {
        id: 'api-gateway-1',
        type: 'api-gateway',
        name: 'API Gateway',
        description: 'Entry point for all requests. Routes traffic to other services.',
        status: 'healthy',
        instances: 2,
        cpu: 30,
        memory: 40,
        latency: 50,
        position: { x: 100, y: 200 },
      },
      {
        id: 'user-1',
        type: 'user',
        name: 'User Service',
        description: 'Handles user authentication and profile management.',
        status: 'healthy',
        instances: 3,
        cpu: 45,
        memory: 60,
        latency: 120,
        position: { x: 300, y: 100 },
      },
      {
        id: 'product-1',
        type: 'product',
        name: 'Product Service',
        description: 'Manages product catalog and inventory queries.',
        status: 'healthy',
        instances: 3,
        cpu: 50,
        memory: 55,
        latency: 100,
        position: { x: 300, y: 300 },
      },
    ];
    // Start each service with the CPU and latency its load implies.
    setServices(
      initialServices.map((service) => {
        const { cpu, latency } = serviceMetrics(service.type, service.instances, service.status);
        return { ...service, cpu, latency };
      })
    );
  };

  const addAdvancedServices = () => {
    const advancedServices: Service[] = [
      {
        id: 'cart-1',
        type: 'cart',
        name: 'Cart Service',
        description: 'Manages shopping cart operations.',
        status: 'healthy',
        instances: 2,
        cpu: 35,
        memory: 45,
        latency: 80,
        position: { x: 500, y: 150 },
      },
      {
        id: 'order-1',
        type: 'order',
        name: 'Order Service',
        description: 'Processes and tracks orders.',
        status: 'healthy',
        instances: 3,
        cpu: 55,
        memory: 65,
        latency: 200,
        position: { x: 500, y: 350 },
      },
    ];
    setServices([...services, ...advancedServices]);
    setShowAdvancedServices(true);
  };

  const removeAdvancedServices = () => {
    setServices((prev) => prev.filter((s) => s.type !== 'cart' && s.type !== 'order'));
    setShowAdvancedServices(false);
    setSelectedService(null);
  };

  const handleStart = () => {
    setIsRunning(true);
    startSimulation();
  };

  const handlePause = () => {
    setIsRunning(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  const handleReset = () => {
    setIsRunning(false);
    setShowAdvancedServices(false);
    setTotalRequests(0);
    setSuccessfulRequests(0);
    setFailedRequests(0);
    setActiveCalls([]);
    setSelectedService(null);
    outageFailureBaselineRef.current = null;
    setOutageConfirmed(false);
    setRecoverySuccessBaseline(null);
    initializeServices();
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  const startSimulation = () => {
    const simulate = () => {
      if (!isRunning) return;
      const now = Date.now();
      if (now - lastCallTimeRef.current > REQUEST_INTERVAL_MS) {
        simulateServiceCall();
        lastCallTimeRef.current = now;
      }
      if (now - lastMetricsUpdateRef.current > METRICS_UPDATE_INTERVAL_MS) {
        setServices((prev) =>
          prev.map((service) => {
            const metrics = serviceMetrics(
              service.type,
              service.instances,
              service.status,
              Math.random() * 2 - 1
            );
            return {
              ...service,
              cpu: metrics.cpu,
              memory: Math.min(
                MEMORY_BASE_MAX,
                Math.max(
                  MEMORY_BASE_MIN,
                  service.status === 'down'
                    ? MEMORY_DOWN_MIN + Math.random() * MEMORY_DOWN_RANGE
                    : service.status === 'degraded'
                      ? MEMORY_DEGRADED_MIN + Math.random() * MEMORY_DEGRADED_RANGE
                      : service.memory + (Math.random() - 0.5) * MEMORY_VARIATION
                )
              ),
              latency: metrics.latency,
            };
          })
        );
        lastMetricsUpdateRef.current = now;
      }
      animationRef.current = requestAnimationFrame(simulate);
    };
    simulate();
  };

  const simulateServiceCall = () => {
    const currentServices = servicesRef.current;
    if (currentServices.length < 2) return;
    const fromService = currentServices[Math.floor(Math.random() * currentServices.length)];
    const availableTargets = currentServices.filter((s) => s.id !== fromService.id);
    if (availableTargets.length === 0) return;
    const toService = availableTargets[Math.floor(Math.random() * availableTargets.length)];
    let successChance = callSuccessChance(toService.type, toService.instances, toService.status);
    if (fromService.status === 'down') successChance *= HEALTH_MULTIPLIER_DOWN;
    else if (fromService.status === 'degraded') successChance *= HEALTH_MULTIPLIER_DEGRADED;
    const call: ServiceCall = {
      id: `call-${Date.now()}-${Math.random()}`,
      from: fromService.id,
      to: toService.id,
      success: Math.random() < successChance,
      latency:
        Math.random() * (SERVICE_CALL_ANIMATION_MAX_MS - SERVICE_CALL_ANIMATION_MIN_MS) +
        SERVICE_CALL_ANIMATION_MIN_MS,
    };
    setActiveCalls((prev) => [...prev, call]);
    setTotalRequests((prev) => prev + 1);
    if (call.success) setSuccessfulRequests((prev) => prev + 1);
    else {
      setFailedRequests((prev) => prev + 1);
      if (
        outageFailureBaselineRef.current !== null &&
        servicesRef.current.some((service) => service.status === 'down')
      ) {
        setOutageConfirmed(true);
      }
    }
    setTimeout(
      () => setActiveCalls((prev) => prev.filter((c) => c.id !== call.id)),
      CALL_CLEANUP_DELAY_MS
    );
  };

  const handleServiceClick = (service: Service) => setSelectedService(service);

  const scaleService = (serviceId: string, delta: number) => {
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              instances: Math.max(MIN_INSTANCES, Math.min(MAX_INSTANCES, s.instances + delta)),
            }
          : s
      )
    );
  };

  const toggleServiceHealth = (serviceId: string) => {
    const service = services.find((candidate) => candidate.id === serviceId);
    if (service?.status === 'degraded') {
      outageFailureBaselineRef.current = failedRequests;
      setOutageConfirmed(false);
      setRecoverySuccessBaseline(null);
    }
    if (service?.status === 'down') setRecoverySuccessBaseline(successfulRequests);
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== serviceId) return s;
        const statusCycle: ServiceStatus[] = ['healthy', 'degraded', 'down'];
        const currentIndex = statusCycle.indexOf(s.status);
        return { ...s, status: statusCycle[(currentIndex + 1) % statusCycle.length] };
      })
    );
  };

  useEffect(() => {
    if (isRunning) startSimulation();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isRunning]);

  const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;
  const missionState = useMemo(
    () => ({
      services,
      totalRequests,
      successfulRequests,
      outageConfirmed,
      recoverySuccessBaseline,
    }),
    [outageConfirmed, recoverySuccessBaseline, services, successfulRequests, totalRequests]
  );
  const missions = useMissions(MISSIONS, missionState);

  const startOver = () => {
    handleReset();
    missions.reset();
    setDismissed(false);
  };
  const currentGoal = missions.current;
  const statusMessage = isRunning
    ? `${totalRequests} requests are moving between ${services.length} services.`
    : 'Traffic is paused. Start it to send a request through the graph.';

  if (!mounted) return null;

  const trafficButton = (phone = false) => (
    <Button
      type="button"
      variant={isRunning ? 'outline' : 'default'}
      className={cn('h-10 gap-2', !phone && 'lg:h-8', phone && 'flex-1')}
      onClick={isRunning ? handlePause : handleStart}
      aria-pressed={isRunning}
    >
      {isRunning ? (
        <Pause className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Play className="h-4 w-4" aria-hidden="true" />
      )}
      {isRunning ? 'Stop' : 'Start'}
    </Button>
  );

  const graph = (
    <section className="space-y-3 rounded-lg border bg-card p-3" aria-label="Service graph">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Request paths</h3>
          <p className="text-xs text-muted-foreground">
            The gateway accepts traffic, then services call one another.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10 lg:h-8"
          onClick={showAdvancedServices ? removeAdvancedServices : addAdvancedServices}
        >
          <Network className="h-4 w-4" aria-hidden="true" />
          {showAdvancedServices ? 'Remove services' : 'Add services'}
        </Button>
      </div>
      <svg
        viewBox="0 0 390 276"
        role="img"
        aria-label="Microservices request graph"
        className="mx-auto block w-full max-w-[390px]"
      >
        {services.map((from) =>
          services
            .filter((to) => to.id !== from.id)
            .map((to) => {
              const fromPosition = GRAPH_POSITIONS[from.type];
              const toPosition = GRAPH_POSITIONS[to.type];
              return (
                <line
                  key={`${from.id}-${to.id}`}
                  x1={fromPosition.x}
                  y1={fromPosition.y}
                  x2={toPosition.x}
                  y2={toPosition.y}
                  className="stroke-border"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              );
            })
        )}
        {activeCalls.map((call) => {
          const from = services.find((service) => service.id === call.from);
          const to = services.find((service) => service.id === call.to);
          if (!from || !to) return null;
          const fromPosition = GRAPH_POSITIONS[from.type];
          const toPosition = GRAPH_POSITIONS[to.type];
          return (
            <motion.circle
              key={call.id}
              r="5"
              className={call.success ? 'fill-correct' : 'fill-wrong'}
              initial={{ cx: fromPosition.x, cy: fromPosition.y }}
              animate={{ cx: toPosition.x, cy: toPosition.y }}
              transition={{ duration: reducedMotion ? 0 : call.latency / 500, ease: 'linear' }}
            />
          );
        })}
        {services.map((service) => {
          const position = GRAPH_POSITIONS[service.type];
          const tone = SIM_TONE[statusTone(service.status)];
          const category = SIM_CATEGORY[SERVICE_CATEGORY[service.type]];
          return (
            <g key={service.id} transform={`translate(${position.x} ${position.y})`}>
              <rect
                x="-60"
                y="-28"
                width="120"
                height="56"
                rx="8"
                className={cn(category.svg, tone.border)}
                strokeWidth="2"
              />
              <text y="-10" textAnchor="middle" className="fill-foreground text-xs font-semibold">
                {SERVICE_TEMPLATES[service.type].name.replace(' Service', '')}
              </text>
              <text y="6" textAnchor="middle" className={cn('fill-current text-xs', tone.text)}>
                {service.status}
              </text>
              <text y="21" textAnchor="middle" className="fill-muted-foreground text-xs">
                {service.instances} {service.instances === 1 ? 'instance' : 'instances'}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );

  const serviceControls = (
    <section className="rounded-lg border bg-card p-3" aria-label="Service controls">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Service controls</h3>
          <p className="text-xs text-muted-foreground">
            Scale capacity or cycle a service through its health states.
          </p>
        </div>
        <Server className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="mt-3 space-y-2">
        {services.map((service) => {
          const tone = SIM_TONE[statusTone(service.status)];
          const isSelected = selectedService?.id === service.id;
          return (
            <div key={service.id} className={cn('rounded-md border p-2', tone.surface)}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{service.name}</p>
                  <p className={cn('text-xs', tone.text)}>
                    {service.status} · {service.instances} instances
                  </p>
                </div>
                <Button
                  type="button"
                  variant={isSelected ? 'default' : 'outline'}
                  className="h-10 shrink-0 text-xs lg:h-8"
                  aria-pressed={isSelected}
                  onClick={() => handleServiceClick(service)}
                >
                  Inspect
                </Button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 text-xs lg:h-8"
                  onClick={() => scaleService(service.id, -1)}
                  disabled={service.instances <= MIN_INSTANCES}
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                  Remove
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 text-xs lg:h-8"
                  onClick={() => scaleService(service.id, 1)}
                  disabled={service.instances >= MAX_INSTANCES}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add instance
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 text-xs lg:h-8"
                  aria-pressed={service.status === 'down'}
                  onClick={() => toggleServiceHealth(service.id)}
                >
                  Cycle health
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const details = (
    <div className="space-y-3">
      <SimMissionList missions={missions.missions} />
      <section className="rounded-lg border bg-card p-3" aria-label="Request metrics">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Metrics</h3>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="rounded-md bg-muted p-2">
            <p className="font-mono text-lg font-semibold tabular-nums">{totalRequests}</p>
            <p className="text-xs text-muted-foreground">Requests</p>
          </div>
          <div className={cn('rounded-md p-2', SIM_TONE.success.surface)}>
            <p className="font-mono text-lg font-semibold tabular-nums">{successfulRequests}</p>
            <p className="text-xs text-muted-foreground">Succeeded</p>
          </div>
          <div className={cn('rounded-md p-2', SIM_TONE.danger.surface)}>
            <p className="font-mono text-lg font-semibold tabular-nums">{failedRequests}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Success rate: {successRate.toFixed(1)}%
        </p>
      </section>
      {selectedService && (
        <section className="rounded-lg border bg-card p-3" aria-label="Selected service details">
          <h3 className="text-sm font-semibold">{selectedService.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{selectedService.description}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <span>CPU {selectedService.cpu.toFixed(0)}%</span>
            <span>Memory {selectedService.memory.toFixed(0)}%</span>
            <span>{selectedService.latency.toFixed(0)} ms</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Load: {SERVICE_DEMAND[selectedService.type]} units on {selectedService.instances} ×{' '}
            {CAPACITY_PER_INSTANCE} capacity per instance.
          </p>
        </section>
      )}
      <details className="rounded-lg border bg-card p-3">
        <summary className="cursor-pointer text-sm font-medium">
          How the original tutorial worked
        </summary>
        <div className="mt-2 space-y-2 text-sm text-muted-foreground">
          <p>
            The API Gateway is the entry point for requests. Start traffic to watch calls move
            between independent services.
          </p>
          <p>
            Add instances to spread demand across more capacity. Cycle healthy to degraded to down
            to model a failure, then cycle once more to restore it.
          </p>
          <p>
            CPU, latency, memory, request outcomes, and the success rate update as traffic runs.
          </p>
        </div>
      </details>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="Microservices"
          icon={Boxes}
          lead={trafficButton()}
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={missions.complete ? 'Microservices explored' : 'Trace traffic between services'}
          goal={
            missions.complete ? (
              'Missions done: keep experimenting with traffic, capacity, and recovery.'
            ) : (
              <>
                {currentGoal?.label}{' '}
                <span className="text-muted-foreground">{currentGoal?.hint}</span>
              </>
            )
          }
        />
        <SimAnnouncer message={statusMessage} />
        {missions.complete && !dismissed ? (
          <SimComplete
            title="Service recovery mapped"
            summary="You sent traffic through the graph, added capacity, tested an outage, and restored service."
            stats={[
              { label: 'Requests', value: totalRequests, note: 'Calls traced through the graph' },
              { label: 'Succeeded', value: successfulRequests, note: 'Requests that completed' },
              {
                label: 'Failed',
                value: failedRequests,
                note: 'Calls that failed',
              },
            ]}
            actions={
              <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
                Keep exploring
              </Button>
            }
            onPlayAgain={startOver}
            playAgainLabel="Start over"
          />
        ) : (
          <SimStage
            panels={[
              {
                id: 'graph',
                label: 'Graph',
                content: (
                  <div className="space-y-3">
                    {graph}
                    {serviceControls}
                  </div>
                ),
              },
              { id: 'details', label: 'Details', content: details },
            ]}
            columns="lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)]"
            tab={tab}
            onTabChange={(nextTab) => {
              if (nextTab === 'graph' || nextTab === 'details') setTab(nextTab);
            }}
            tabsLabel="Microservices panels"
            minHeight="min-h-[24rem]"
          />
        )}
        <SimPhoneBar>
          {trafficButton(true)}
          <SimResetButton onReset={startOver} />
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
