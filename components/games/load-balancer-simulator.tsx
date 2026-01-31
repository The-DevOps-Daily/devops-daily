'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Users, Server, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  phase: 'to-lb' | 'exit-lb' | 'to-server' | 'failed';
  clientId?: number;
}

// Distinct colors for each server - makes it crystal clear where requests go
const SERVER_COLORS = [
  { bg: 'bg-emerald-500', hex: '#10b981', dimHex: '#6ee7b7' },
  { bg: 'bg-amber-500', hex: '#f59e0b', dimHex: '#fcd34d' },
  { bg: 'bg-rose-500', hex: '#f43f5e', dimHex: '#fda4af' },
];

const OFFLINE_COLOR = { bg: 'bg-gray-400', hex: '#9ca3af', dimHex: '#d1d5db' };

const ALGORITHMS: Record<AlgorithmType, { name: string; description: string }> = {
  'round-robin': {
    name: 'Round Robin',
    description: 'Sends requests to each server in order: 1 → 2 → 3 → 1 → 2 → 3...',
  },
  'least-connections': {
    name: 'Least Connections',
    description: 'Always sends to the server handling the fewest requests right now',
  },
  'ip-hash': {
    name: 'IP Hash',
    description: 'Same user always goes to the same server (sticky sessions)',
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

export default function LoadBalancerSimulator() {
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('round-robin');
  const [isRunning, setIsRunning] = useState(false);
  const [trafficRate, setTrafficRate] = useState(600);
  const [servers, setServers] = useState<ServerState[]>([
    { id: 1, name: 'Server 1', requests: 0, active: 0, healthy: true },
    { id: 2, name: 'Server 2', requests: 0, active: 0, healthy: true },
    { id: 3, name: 'Server 3', requests: 0, active: 0, healthy: true },
  ]);
  const [packets, setPackets] = useState<RequestPacket[]>([]);
  const [roundRobinIndex, setRoundRobinIndex] = useState(0);
  const [clientIndex, setClientIndex] = useState(0);
  const [failedRequests, setFailedRequests] = useState(0);

  // Simulated clients for IP Hash - each client consistently maps to a server
  const clients = useMemo(
    () => [
      { id: 1, ip: '192.168.1.10', serverHash: 0 },
      { id: 2, ip: '192.168.1.25', serverHash: 1 },
      { id: 3, ip: '192.168.1.42', serverHash: 2 },
      { id: 4, ip: '10.0.0.15', serverHash: 0 },
      { id: 5, ip: '10.0.0.88', serverHash: 1 },
      { id: 6, ip: '172.16.0.33', serverHash: 2 },
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

  const toggleServerHealth = useCallback((serverId: number) => {
    setServers((prev) =>
      prev.map((s) => (s.id === serverId ? { ...s, healthy: !s.healthy } : s))
    );
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
        const sorted = [...healthyServers].sort((a, b) => a.active - b.active);
        return sorted[0].id;
      }
      case 'ip-hash': {
        // Rotate through simulated clients - each client always maps to same server
        const client = clients[clientIndex % clients.length];
        setClientIndex((prev) => prev + 1);
        const targetId = client.serverHash + 1;
        return servers.find((s) => s.id === targetId)?.healthy ? targetId : null;
      }
      case 'random':
        return healthyServers[Math.floor(Math.random() * healthyServers.length)].id;
      default:
        return 1;
    }
  }, [algorithm, roundRobinIndex, servers, clientIndex, clients, healthyServers]);

  const sendRequest = useCallback(() => {
    const targetServer = getTargetServer();
    const packetId = `req-${Date.now()}-${Math.random()}`;

    if (targetServer === null) {
      // No healthy servers - show failed request
      setPackets((prev) => [...prev, { id: packetId, targetServer: 0, phase: 'to-lb' }]);
      setTimeout(() => {
        setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, phase: 'failed' } : p)));
      }, 350);
      setTimeout(() => {
        setPackets((prev) => prev.filter((p) => p.id !== packetId));
        setFailedRequests((prev) => prev + 1);
      }, 700);
      return;
    }

    setPackets((prev) => [...prev, { id: packetId, targetServer, phase: 'to-lb' }]);

    // Phase 1 complete: arrived at LB center, now exit horizontally to line start
    setTimeout(() => {
      setPackets((prev) =>
        prev.map((p) => (p.id === packetId ? { ...p, phase: 'exit-lb' } : p))
      );
    }, 350);

    // Phase 2: at line start point (58%), now follow angled line to server
    setTimeout(() => {
      setPackets((prev) =>
        prev.map((p) => (p.id === packetId ? { ...p, phase: 'to-server' } : p))
      );
      setServers((prev) =>
        prev.map((s) => (s.id === targetServer ? { ...s, active: s.active + 1 } : s))
      );
    }, 450);

    // Phase 3: arrived at server, complete request
    setTimeout(() => {
      setPackets((prev) => prev.filter((p) => p.id !== packetId));
      setServers((prev) =>
        prev.map((s) =>
          s.id === targetServer
            ? { ...s, requests: s.requests + 1, active: Math.max(0, s.active - 1) }
            : s
        )
      );
    }, 950);
  }, [getTargetServer]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(sendRequest, trafficRate);
    return () => clearInterval(interval);
  }, [isRunning, trafficRate, sendRequest]);

  const reset = () => {
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
  };

  const totalRequests = servers.reduce((sum, s) => sum + s.requests, 0);

  // Pre-compute server Y positions for consistent line/dot placement
  const serverYPositions = [20, 50, 80]; // top, middle, bottom as percentages

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span>Load Balancer Simulator</span>
            <span className="text-sm font-normal text-muted-foreground">
              {totalRequests} total requests{failedRequests > 0 && ` • ${failedRequests} failed`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              <Button
                onClick={() => setIsRunning(!isRunning)}
                variant={isRunning ? 'destructive' : 'default'}
                size="sm"
              >
                {isRunning ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                {isRunning ? 'Stop' : 'Start'}
              </Button>
              <Button onClick={reset} variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </div>

            <div className="flex gap-1">
              {(Object.keys(ALGORITHMS) as AlgorithmType[]).map((algo) => (
                <Button
                  key={algo}
                  onClick={() => setAlgorithm(algo)}
                  variant={algorithm === algo ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                >
                  {ALGORITHMS[algo].name}
                </Button>
              ))}
            </div>

            <div className="flex gap-1">
              {TRAFFIC_RATES.map((rate) => (
                <Button
                  key={rate.value}
                  onClick={() => setTrafficRate(rate.value)}
                  variant={trafficRate === rate.value ? 'secondary' : 'ghost'}
                  size="sm"
                  className="text-xs"
                >
                  {rate.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Algorithm Description */}
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            <span className="font-medium">{ALGORITHMS[algorithm].name}:</span>{' '}
            {ALGORITHMS[algorithm].description}
            <span className="block mt-1 text-xs opacity-75">💡 Click on servers to simulate failures</span>
          </div>

          {/* Visualization */}
          <div className="relative h-72 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-xl overflow-hidden">
            {/* Connection Lines */}
            <svg className="absolute inset-0 w-full h-full">
              {/* Users to Load Balancer */}
              <line
                x1="18%"
                y1="50%"
                x2="42%"
                y2="50%"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeDasharray="8 4"
              />
              {/* Load Balancer to each Server - colored lines that light up */}
              {serverYPositions.map((y, idx) => {
                const isActive = activeServerLines.has(idx + 1);
                const server = servers[idx];
                const lineColor = server.healthy
                  ? (isActive ? SERVER_COLORS[idx].hex : SERVER_COLORS[idx].dimHex)
                  : OFFLINE_COLOR.dimHex;
                return (
                  <line
                    key={y}
                    x1="58%"
                    y1="50%"
                    x2="82%"
                    y2={`${y}%`}
                    stroke={lineColor}
                    strokeWidth={isActive && server.healthy ? 5 : 3}
                    strokeDasharray={isActive && server.healthy ? '0' : '8 4'}
                    style={{ transition: 'stroke 0.15s, stroke-width 0.15s' }}
                  />
                );
              })}
            </svg>

            {/* Users (Left) */}
            <div className="absolute left-[8%] top-1/2 -translate-y-1/2 z-10 text-center">
              <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center shadow-lg mx-auto border-4 border-white dark:border-slate-700">
                <Users className="h-10 w-10 text-white" />
              </div>
              <div className="mt-2 text-sm font-semibold">Users</div>
            </div>

            {/* Load Balancer (Center) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-center">
              <div className="w-24 h-24 rounded-xl bg-purple-600 flex items-center justify-center shadow-xl mx-auto border-4 border-white dark:border-slate-700">
                <span className="text-white text-sm font-bold text-center leading-tight">Load<br/>Balancer</span>
              </div>
              <div className="mt-2 text-xs font-medium text-muted-foreground">{ALGORITHMS[algorithm].name}</div>
            </div>

            {/* Servers (Right) - positioned to match serverYPositions */}
            <div className="absolute right-[8%] top-0 bottom-0 w-24 z-10">
              {servers.map((server, idx) => (
                <div
                  key={server.id}
                  className="absolute text-center cursor-pointer group"
                  style={{ top: `${serverYPositions[idx]}%`, transform: 'translateY(-50%)', left: 0, right: 0 }}
                  onClick={() => toggleServerHealth(server.id)}
                  title={`Click to ${server.healthy ? 'take offline' : 'bring online'}`}
                >
                  <div
                    className={`w-20 h-20 rounded-xl flex items-center justify-center shadow-lg mx-auto border-4 transition-all
                      ${server.healthy ? SERVER_COLORS[idx].bg : OFFLINE_COLOR.bg}
                      ${server.healthy ? 'border-white dark:border-slate-700' : 'border-red-400'}
                      ${activeServerLines.has(server.id) && server.healthy ? 'scale-110' : ''}
                      ${!server.healthy ? 'opacity-60' : ''}
                      group-hover:ring-2 group-hover:ring-offset-2 group-hover:ring-purple-400`}
                  >
                    {server.healthy ? (
                      <Server className="h-9 w-9 text-white" />
                    ) : (
                      <XCircle className="h-9 w-9 text-white" />
                    )}
                  </div>
                  <div className={`mt-1 text-xs font-semibold ${!server.healthy ? 'text-red-500' : ''}`}>
                    {server.name}
                  </div>
                </div>
              ))}
            </div>

            {/* Animated Packets - Follow the colored lines */}
            <AnimatePresence>
              {packets.map((packet) => {
                const serverIdx = packet.targetServer - 1;
                const serverY = serverYPositions[serverIdx] || 50;
                const dotColor = serverIdx >= 0 && serverIdx < 3 ? SERVER_COLORS[serverIdx].hex : '#ef4444';

                if (packet.phase === 'to-lb') {
                  // Blue dot: Users → Load Balancer
                  return (
                    <motion.div
                      key={packet.id}
                      initial={{ left: '18%', top: '50%' }}
                      animate={{ left: '50%', top: '50%' }}
                      transition={{ duration: 0.35, ease: 'linear' }}
                      className="absolute w-5 h-5 rounded-full bg-blue-500 shadow-lg z-20 border-2 border-white"
                      style={{ transform: 'translate(-50%, -50%)' }}
                    />
                  );
                } else if (packet.phase === 'failed') {
                  // Red dot bouncing back: failed request
                  return (
                    <motion.div
                      key={packet.id}
                      initial={{ left: '50%', top: '50%' }}
                      animate={{ left: '18%', top: '50%' }}
                      transition={{ duration: 0.35, ease: 'linear' }}
                      className="absolute w-5 h-5 rounded-full bg-red-500 shadow-lg z-20 border-2 border-white"
                      style={{ transform: 'translate(-50%, -50%)' }}
                    />
                  );
                } else if (packet.phase === 'exit-lb') {
                  // Colored dot: exit LB horizontally to line start point (58%)
                  return (
                    <motion.div
                      key={packet.id}
                      initial={{ left: '50%', top: '50%' }}
                      animate={{ left: '58%', top: '50%' }}
                      transition={{ duration: 0.1, ease: 'linear' }}
                      className="absolute w-5 h-5 rounded-full shadow-lg z-20 border-2 border-white"
                      style={{ transform: 'translate(-50%, -50%)', backgroundColor: dotColor }}
                    />
                  );
                } else {
                  // Colored dot: follow angled line from 58% to server
                  return (
                    <motion.div
                      key={packet.id}
                      initial={{ left: '58%', top: '50%' }}
                      animate={{ left: '82%', top: `${serverY}%` }}
                      transition={{ duration: 0.5, ease: 'linear' }}
                      className="absolute w-5 h-5 rounded-full shadow-lg z-20 border-2 border-white"
                      style={{ transform: 'translate(-50%, -50%)', backgroundColor: dotColor }}
                    />
                  );
                }
              })}
            </AnimatePresence>
          </div>

          {/* Stats - Color coded to match servers */}
          <div className="grid grid-cols-3 gap-4">
            {servers.map((server, idx) => (
              <div
                key={server.id}
                className={`rounded-lg p-4 text-center border-2 transition-all ${!server.healthy ? 'opacity-50' : ''}`}
                style={{
                  borderColor: server.healthy ? SERVER_COLORS[idx].hex : OFFLINE_COLOR.hex,
                  backgroundColor: server.healthy ? SERVER_COLORS[idx].dimHex : OFFLINE_COLOR.dimHex,
                }}
              >
                <div
                  className="text-sm font-semibold"
                  style={{ color: server.healthy ? SERVER_COLORS[idx].hex : OFFLINE_COLOR.hex }}
                >
                  {server.name} {!server.healthy && '(Offline)'}
                </div>
                <div
                  className="text-3xl font-bold"
                  style={{ color: server.healthy ? SERVER_COLORS[idx].hex : OFFLINE_COLOR.hex }}
                >
                  {server.requests}
                </div>
                <div className="text-xs text-muted-foreground">requests handled</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
