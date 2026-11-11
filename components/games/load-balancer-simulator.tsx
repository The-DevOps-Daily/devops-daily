'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Users, Server, XCircle, Network } from 'lucide-react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
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
} from '@/components/games/sim';
import { cn } from '@/lib/utils';

type AlgorithmType = 'round-robin' | 'least-connections' | 'ip-hash' | 'random';

interface ServerState {
  id: number;
  name: string;
  requests: number;
  active: number;
  healthy: boolean;
}

interface RequestPacket {
  id: string;
  targetServer: number;
  phase: 'to-lb' | 'exit-lb' | 'to-server' | 'failed' | 'crashed' | 'retry';
  clientId?: number;
  retryCount?: number;
}

const SERVER_CATEGORIES = [SIM_CATEGORY.primary, SIM_CATEGORY.sky, SIM_CATEGORY.violet];

const ALGORITHMS: Record<AlgorithmType, { name: string; description: string }> = {
  'round-robin': {
    name: 'Round Robin',
    description: 'Sends requests to each server in order: 1 → 2 → 3 → 1 → 2 → 3...',
  },
  'least-connections': {
    name: 'Least Connections',
    description:
      'Always sends to the server handling the fewest requests right now. Ties take turns.',
  },
  'ip-hash': {
    name: 'IP Hash',
    description:
      'Same user always goes to the same server (sticky sessions). nginx hashes the first three parts of the IP, so a whole /24 shares a server. If that server is offline, the user moves to another healthy server.',
  },
  random: {
    name: 'Random',
    description: 'Randomly picks a server for each request',
  },
};

// Traffic rate presets (ms between requests)
const TRAFFIC_RATES = [
  { label: 'Slow', value: 1200 },
  { label: 'Normal', value: 600 },
  { label: 'Fast', value: 300 },
  { label: 'Burst', value: 150 },
];

// Server failure rate presets (% chance of crash after accepting request)
const FAILURE_RATES = [
  { label: 'None', value: 0 },
  { label: 'Low (5%)', value: 0.05 },
  { label: 'Medium (15%)', value: 0.15 },
  { label: 'High (30%)', value: 0.3 },
];

const MAX_RETRY_ATTEMPTS = 3;

// nginx ip_hash hashes only the first three octets of an IPv4 address, so a whole /24
// shares one server. If that server is down, nginx keeps hashing from where it stopped,
// so the client lands on the same fallback every time. After 20 misses nginx falls back
// to round robin; here that is the first healthy server.
function ipHashServer(ip: string, isUp: (id: number) => boolean): number | null {
  const octets = ip.split('.').slice(0, 3).map(Number);
  let hash = 89;
  for (let tries = 0; tries < 20; tries++) {
    for (const octet of octets) hash = (hash * 113 + octet) % 6271;
    const id = (hash % 3) + 1;
    if (isUp(id)) return id;
  }
  return null;
}

interface LoadBalancerMissionState {
  handledByAlgorithm: Record<AlgorithmType, number>;
  hasOfflineServer: boolean;
  handledWhileServerDown: boolean;
}

const MISSIONS: Mission<LoadBalancerMissionState>[] = [
  {
    id: 'round-robin',
    label: 'Send traffic with round robin and watch the servers take turns.',
    hint: 'Press Start: each server gets the next request in line.',
    check: (state) => state.handledByAlgorithm['round-robin'] >= 2,
  },
  {
    id: 'least-connections',
    label: 'Switch to least connections and keep the traffic flowing.',
    hint: 'New requests go to the server with the fewest in progress.',
    check: (state) => state.handledByAlgorithm['least-connections'] >= 2,
  },
  {
    id: 'ip-hash',
    label: 'Try IP hash: the same client always reaches the same server.',
    hint: "Pick IP hash and watch one client's requests.",
    check: (state) => state.handledByAlgorithm['ip-hash'] >= 2,
  },
  {
    id: 'failover',
    label: 'Take a server down and see where its traffic goes.',
    hint: 'Mark a server as down while traffic runs.',
    check: (state) => state.hasOfflineServer && state.handledWhileServerDown,
  },
];

export default function LoadBalancerSimulator() {
  const [tab, setTab] = useState<'traffic' | 'details'>('traffic');
  const [dismissed, setDismissed] = useState(false);
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('round-robin');
  const [isRunning, setIsRunning] = useState(false);
  const [trafficRate, setTrafficRate] = useState(600);
  const [failureRate, setFailureRate] = useState(0);
  const [enableRetry, setEnableRetry] = useState(true);
  const [servers, setServers] = useState<ServerState[]>([
    { id: 1, name: 'Server 1', requests: 0, active: 0, healthy: true },
    { id: 2, name: 'Server 2', requests: 0, active: 0, healthy: true },
    { id: 3, name: 'Server 3', requests: 0, active: 0, healthy: true },
  ]);
  const serversRef = useRef(servers);
  const generationRef = useRef(0);
  const [packets, setPackets] = useState<RequestPacket[]>([]);
  const [roundRobinIndex, setRoundRobinIndex] = useState(0);
  const [clientIndex, setClientIndex] = useState(0);
  const [failedRequests, setFailedRequests] = useState(0);
  const [crashedRequests, setCrashedRequests] = useState(0);
  const [retriedRequests, setRetriedRequests] = useState(0);
  const [handledByAlgorithm, setHandledByAlgorithm] = useState<Record<AlgorithmType, number>>({
    'round-robin': 0,
    'least-connections': 0,
    'ip-hash': 0,
    random: 0,
  });
  const [handledWhileServerDown, setHandledWhileServerDown] = useState(false);

  // Simulated clients for IP Hash, each in a different /24 so they spread across servers
  const clients = useMemo(
    () => [
      { id: 1, ip: '10.0.0.15' },
      { id: 2, ip: '192.168.1.10' },
      { id: 3, ip: '172.16.0.33' },
      { id: 4, ip: '203.0.113.7' },
      { id: 5, ip: '10.0.1.15' },
      { id: 6, ip: '192.168.2.10' },
    ],
    []
  );

  // Track which server lines are active (have packets going to them)
  const activeServerLines = useMemo(() => {
    const active = new Set<number>();
    packets.forEach((p) => {
      if (p.phase === 'to-server') {
        active.add(p.targetServer);
      }
    });
    return active;
  }, [packets]);

  const healthyServers = useMemo(() => servers.filter((s) => s.healthy), [servers]);

  const missionState = useMemo(
    () => ({
      handledByAlgorithm,
      hasOfflineServer: servers.some((server) => !server.healthy),
      handledWhileServerDown,
    }),
    [handledByAlgorithm, servers, handledWhileServerDown]
  );
  const missions = useMissions(MISSIONS, missionState);

  const toggleServerHealth = useCallback((serverId: number) => {
    setServers((prev) => prev.map((s) => (s.id === serverId ? { ...s, healthy: !s.healthy } : s)));
  }, []);

  const getTargetServer = useCallback((): number | null => {
    if (healthyServers.length === 0) return null;

    switch (algorithm) {
      case 'round-robin': {
        let attempts = 0;
        let idx = roundRobinIndex;
        while (attempts < 3) {
          const target = (idx % 3) + 1;
          idx++;
          if (servers.find((s) => s.id === target)?.healthy) {
            setRoundRobinIndex(idx);
            return target;
          }
          attempts++;
        }
        return healthyServers[0]?.id ?? null;
      }
      case 'least-connections': {
        // Ties between equally loaded servers go round robin, like nginx least_conn
        const fewest = Math.min(...healthyServers.map((s) => s.active));
        for (let i = 0; i < 3; i++) {
          const target = ((roundRobinIndex + i) % 3) + 1;
          if (healthyServers.find((s) => s.id === target)?.active === fewest) {
            setRoundRobinIndex(roundRobinIndex + i + 1);
            return target;
          }
        }
        return healthyServers[0].id;
      }
      case 'ip-hash': {
        // Rotate through simulated clients - each client always maps to same server
        const client = clients[clientIndex % clients.length];
        setClientIndex((prev) => prev + 1);
        return (
          ipHashServer(client.ip, (id) => !!servers.find((s) => s.id === id)?.healthy) ??
          healthyServers[0].id
        );
      }
      case 'random':
        return healthyServers[Math.floor(Math.random() * healthyServers.length)].id;
      default:
        return 1;
    }
  }, [algorithm, roundRobinIndex, servers, clientIndex, clients, healthyServers]);

  const sendRequest = useCallback(() => {
    const targetServer = getTargetServer();
    const requestAlgorithm = algorithm;
    const packetId = `req-${Date.now()}-${Math.random()}`;
    // Reset bumps the generation, so steps of requests sent before it do nothing
    const generation = generationRef.current;
    const later = (step: () => void, ms: number) =>
      window.setTimeout(() => {
        if (generation === generationRef.current) step();
      }, ms);

    if (targetServer === null) {
      // No healthy servers - show failed request
      setPackets((prev) => [...prev, { id: packetId, targetServer: 0, phase: 'to-lb' }]);
      later(() => {
        setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, phase: 'failed' } : p)));
      }, 350);
      later(() => {
        setPackets((prev) => prev.filter((p) => p.id !== packetId));
        setFailedRequests((prev) => prev + 1);
      }, 700);
      return;
    }

    const sendPacket = (serverId: number, retryAttempt = 0, tried: number[] = []) => {
      const newPacketId = retryAttempt > 0 ? `${packetId}-retry${retryAttempt}` : packetId;
      setPackets((prev) => [
        ...prev,
        { id: newPacketId, targetServer: serverId, phase: 'to-lb', retryCount: retryAttempt },
      ]);

      // Phase 1 complete: arrived at LB center, now exit horizontally to line start
      later(() => {
        setPackets((prev) =>
          prev.map((p) => (p.id === newPacketId ? { ...p, phase: 'exit-lb' } : p))
        );
      }, 350);

      // Phase 2: at line start point (58%), now follow angled line to server
      later(() => {
        setPackets((prev) =>
          prev.map((p) => (p.id === newPacketId ? { ...p, phase: 'to-server' } : p))
        );
        setServers((prev) =>
          prev.map((s) => (s.id === serverId ? { ...s, active: s.active + 1 } : s))
        );
      }, 450);

      // Phase 3: Server may crash or successfully complete request
      later(() => {
        const willCrash = Math.random() < failureRate;

        if (willCrash) {
          // Server crashes after accepting request - show red X on server
          setPackets((prev) =>
            prev.map((p) => (p.id === newPacketId ? { ...p, phase: 'crashed' } : p))
          );
          setCrashedRequests((prev) => prev + 1);
          setServers((prev) =>
            prev.map((s) => (s.id === serverId ? { ...s, active: Math.max(0, s.active - 1) } : s))
          );

          // Show crash animation, then retry or fail
          later(() => {
            setPackets((prev) => prev.filter((p) => p.id !== newPacketId));

            if (enableRetry && retryAttempt < MAX_RETRY_ATTEMPTS) {
              // Retry on the next healthy server this request has not tried yet,
              // like nginx proxy_next_upstream
              const usedServers = [...tried, serverId];
              const nextServer = [1, 2]
                .map((offset) => ((serverId - 1 + offset) % 3) + 1)
                .find(
                  (id) =>
                    !usedServers.includes(id) &&
                    serversRef.current.find((s) => s.id === id)?.healthy
                );
              if (nextServer) {
                setRetriedRequests((prev) => prev + 1);
                sendPacket(nextServer, retryAttempt + 1, usedServers);
              } else {
                setFailedRequests((prev) => prev + 1);
              }
            } else {
              setFailedRequests((prev) => prev + 1);
            }
          }, 500);
        } else {
          // Success: request completed normally
          setPackets((prev) => prev.filter((p) => p.id !== newPacketId));
          setServers((prev) =>
            prev.map((s) =>
              s.id === serverId
                ? { ...s, requests: s.requests + 1, active: Math.max(0, s.active - 1) }
                : s
            )
          );
          setHandledByAlgorithm((prev) => ({
            ...prev,
            [requestAlgorithm]: prev[requestAlgorithm] + 1,
          }));
          if (
            serversRef.current.some((server) => !server.healthy) &&
            serversRef.current.find((server) => server.id === serverId)?.healthy
          ) {
            setHandledWhileServerDown(true);
          }
        }
      }, 950);
    };

    sendPacket(targetServer);
  }, [getTargetServer, failureRate, enableRetry, algorithm]);

  useEffect(() => {
    serversRef.current = servers;
  }, [servers]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(sendRequest, trafficRate);
    return () => clearInterval(interval);
  }, [isRunning, trafficRate, sendRequest]);

  const reset = () => {
    generationRef.current += 1;
    setIsRunning(false);
    setServers([
      { id: 1, name: 'Server 1', requests: 0, active: 0, healthy: true },
      { id: 2, name: 'Server 2', requests: 0, active: 0, healthy: true },
      { id: 3, name: 'Server 3', requests: 0, active: 0, healthy: true },
    ]);
    setPackets([]);
    setRoundRobinIndex(0);
    setClientIndex(0);
    setFailedRequests(0);
    setCrashedRequests(0);
    setRetriedRequests(0);
    setHandledByAlgorithm({
      'round-robin': 0,
      'least-connections': 0,
      'ip-hash': 0,
      random: 0,
    });
    setHandledWhileServerDown(false);
  };

  const totalRequests = servers.reduce((sum, s) => sum + s.requests, 0);

  // Pre-compute server Y positions for consistent line/dot placement
  const serverYPositions = [20, 50, 80]; // top, middle, bottom as percentages

  const startOver = () => {
    reset();
    missions.reset();
    setDismissed(false);
  };
  const announcement = isRunning
    ? `${ALGORITHMS[algorithm].name} is routing traffic to ${healthyServers.length} healthy servers.`
    : 'Traffic is paused. Choose an algorithm, then start the load balancer.';

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="Load Balancer Simulator"
          icon={Network}
          lead={
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Algorithm">
              {(Object.keys(ALGORITHMS) as AlgorithmType[]).map((algo) => (
                <Button
                  key={algo}
                  type="button"
                  variant={algorithm === algo ? 'default' : 'outline'}
                  className="h-10 px-2 text-xs lg:h-8"
                  aria-pressed={algorithm === algo}
                  onClick={() => setAlgorithm(algo)}
                >
                  {ALGORITHMS[algo].name}
                </Button>
              ))}
            </div>
          }
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={
            isRunning
              ? `${ALGORITHMS[algorithm].name} is routing traffic`
              : 'Ready to route traffic'
          }
          actions={
            <Button
              type="button"
              className="hidden h-8 lg:flex"
              variant={isRunning ? 'outline' : 'default'}
              onClick={() => setIsRunning(!isRunning)}
            >
              {isRunning ? (
                <Pause className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
              {isRunning ? 'Stop' : 'Start'}
            </Button>
          }
          goal={
            missions.complete ? (
              'All four missions are complete. Keep exploring load-balancing behavior.'
            ) : (
              <>
                {missions.current?.label}{' '}
                <span className="text-muted-foreground">{missions.current?.hint}</span>
              </>
            )
          }
        />

        <SimAnnouncer message={announcement} />

        {missions.complete && !dismissed ? (
          <SimComplete
            title="Load balancing missions complete"
            summary="You compared three routing algorithms and kept traffic moving after a server went down."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Successful', value: totalRequests },
              { label: 'Retries', value: retriedRequests },
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
            columns="lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.8fr)]"
            minHeight="min-h-[22rem]"
            tab={tab}
            onTabChange={(next) => {
              if (next === 'traffic' || next === 'details') setTab(next);
            }}
            tabsLabel="Load balancer panels"
            panels={[
              {
                id: 'traffic',
                label: 'Traffic',
                className: 'space-y-2',
                content: (
                  <section className="rounded-lg border bg-card p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">Traffic flow</h3>
                        <p className="text-xs text-muted-foreground">
                          {ALGORITHMS[algorithm].description}
                        </p>
                      </div>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {packets.length} in flight
                      </span>
                    </div>
                    <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] gap-3">
                      <div className="flex min-w-0 flex-col justify-center gap-2">
                        <div
                          className={cn(
                            'rounded-lg border p-3 text-center',
                            SIM_CATEGORY.emerald.fill,
                            SIM_CATEGORY.emerald.border
                          )}
                        >
                          <Users className="mx-auto h-6 w-6" aria-hidden="true" />
                          <p className="mt-1 text-xs font-semibold">Clients</p>
                        </div>
                        <div
                          className={cn(
                            'rounded-lg border p-3 text-center',
                            SIM_CATEGORY.primary.fill,
                            SIM_CATEGORY.primary.border
                          )}
                        >
                          <Network className="mx-auto h-6 w-6" aria-hidden="true" />
                          <p className="mt-1 text-xs font-semibold">Load balancer</p>
                          <p className="text-xs text-muted-foreground">
                            {ALGORITHMS[algorithm].name}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 content-center gap-2">
                        {servers.map((server, idx) => {
                          const category = SERVER_CATEGORIES[idx];
                          const active = activeServerLines.has(server.id);
                          return (
                            <Button
                              key={server.id}
                              type="button"
                              variant="outline"
                              className={cn(
                                'h-auto min-h-20 flex-col gap-1 whitespace-normal p-2 text-center',
                                server.healthy
                                  ? [category.fill, category.border]
                                  : SIM_TONE.danger.surface,
                                serverYPositions[idx] === 50 && 'col-span-2',
                                active && server.healthy && 'ring-2 ring-primary',
                                !server.healthy && 'opacity-70'
                              )}
                              aria-label={`${server.name}: ${server.healthy ? 'online' : 'down'}`}
                              aria-pressed={!server.healthy}
                              onClick={() => toggleServerHealth(server.id)}
                            >
                              {server.healthy ? (
                                <Server className="h-5 w-5" aria-hidden="true" />
                              ) : (
                                <XCircle
                                  className={cn('h-5 w-5', SIM_TONE.danger.iconClass)}
                                  aria-hidden="true"
                                />
                              )}
                              <span className="text-xs font-semibold">{server.name}</span>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {server.requests} handled
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-3 min-h-8 rounded-md border bg-muted/50 px-2 py-1.5">
                      <AnimatePresence initial={false}>
                        {packets.slice(-4).map((packet) => {
                          const category =
                            SERVER_CATEGORIES[Math.max(0, packet.targetServer - 1)] ??
                            SIM_CATEGORY.neutral;
                          return (
                            <motion.span
                              key={packet.id}
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 12 }}
                              transition={{ duration: 0.2 }}
                              className={cn(
                                'mr-1 inline-flex rounded-full border px-2 py-0.5 text-xs',
                                category.fill,
                                category.border
                              )}
                            >
                              {packet.phase === 'crashed' || packet.phase === 'failed'
                                ? 'Request failed'
                                : `Request to server ${packet.targetServer}`}
                            </motion.span>
                          );
                        })}
                      </AnimatePresence>
                      {packets.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          No requests in flight.
                        </span>
                      )}
                    </div>
                  </section>
                ),
              },
              {
                id: 'details',
                label: 'Details',
                className: 'space-y-2',
                content: (
                  <>
                    <SimMissionList missions={missions.missions} />
                    <section className="rounded-lg border bg-card p-3">
                      <h3 className="text-sm font-semibold">Traffic controls</h3>
                      <fieldset className="mt-2">
                        <legend className="text-xs font-medium text-muted-foreground">
                          Traffic rate
                        </legend>
                        <div className="mt-1 grid grid-cols-2 gap-1">
                          {TRAFFIC_RATES.map((rate) => (
                            <Button
                              key={rate.value}
                              type="button"
                              variant={trafficRate === rate.value ? 'secondary' : 'outline'}
                              className="h-10 text-xs lg:h-8"
                              aria-pressed={trafficRate === rate.value}
                              onClick={() => setTrafficRate(rate.value)}
                            >
                              {rate.label}
                            </Button>
                          ))}
                        </div>
                      </fieldset>
                      <fieldset className="mt-3">
                        <legend className="text-xs font-medium text-muted-foreground">
                          Failure rate
                        </legend>
                        <div className="mt-1 grid grid-cols-2 gap-1">
                          {FAILURE_RATES.map((rate) => (
                            <Button
                              key={rate.value}
                              type="button"
                              variant={failureRate === rate.value ? 'secondary' : 'outline'}
                              className="h-10 text-xs lg:h-8"
                              aria-pressed={failureRate === rate.value}
                              onClick={() => setFailureRate(rate.value)}
                            >
                              {rate.label}
                            </Button>
                          ))}
                        </div>
                      </fieldset>
                      {failureRate > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-2 h-10 w-full text-xs lg:h-8"
                          aria-pressed={enableRetry}
                          onClick={() => setEnableRetry(!enableRetry)}
                        >
                          Retry: {enableRetry ? 'On' : 'Off'}
                        </Button>
                      )}
                    </section>
                    <section className="rounded-lg border bg-card p-3">
                      <h3 className="text-sm font-semibold">Request counters</h3>
                      <dl className="mt-2 grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-md bg-muted/50 p-2">
                          <dt className="text-xs text-muted-foreground">Successful</dt>
                          <dd className="font-mono text-lg font-semibold tabular-nums">
                            {totalRequests}
                          </dd>
                        </div>
                        <div className="rounded-md bg-muted/50 p-2">
                          <dt className="text-xs text-muted-foreground">Active</dt>
                          <dd className="font-mono text-lg font-semibold tabular-nums">
                            {servers.reduce((sum, server) => sum + server.active, 0)}
                          </dd>
                        </div>
                        <div className="rounded-md bg-muted/50 p-2">
                          <dt className="text-xs text-muted-foreground">Crashed</dt>
                          <dd className="font-mono text-lg font-semibold tabular-nums">
                            {crashedRequests}
                          </dd>
                        </div>
                        <div className="rounded-md bg-muted/50 p-2">
                          <dt className="text-xs text-muted-foreground">Failed</dt>
                          <dd className="font-mono text-lg font-semibold tabular-nums">
                            {failedRequests}
                          </dd>
                        </div>
                      </dl>
                    </section>
                    <details className="rounded-lg border bg-card p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        How load balancing works
                      </summary>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Round robin rotates through healthy servers. Least connections favors the
                        one with the fewest active requests. IP hash keeps a client on a consistent
                        healthy server; taking one down routes later traffic to a fallback.
                      </p>
                    </details>
                  </>
                ),
              },
            ]}
          />
        )}

        <SimPhoneBar>
          <Button
            type="button"
            className="h-10 flex-1"
            variant={isRunning ? 'outline' : 'default'}
            onClick={() => setIsRunning(!isRunning)}
          >
            {isRunning ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            {isRunning ? 'Stop' : 'Start'}
          </Button>
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
