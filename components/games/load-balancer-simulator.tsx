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
}

const SERVER_COLORS = [
  { bg: 'bg-emerald-500', hex: '#10b981', dimHex: '#6ee7b7' },
  { bg: 'bg-amber-500', hex: '#f59e0b', dimHex: '#fcd34d' },
  { bg: 'bg-rose-500', hex: '#f43f5e', dimHex: '#fda4af' },
];

const FAILED_COLOR = { hex: '#9ca3af', dimHex: '#d1d5db' };

const ALGORITHMS: Record<AlgorithmType, { name: string; short: string }> = {
  'round-robin': { name: 'Round Robin', short: '1→2→3→...' },
  'least-connections': { name: 'Least Conn', short: 'Min load' },
  'ip-hash': { name: 'IP Hash', short: 'Sticky' },
  random: { name: 'Random', short: 'Random' },
};

const TRAFFIC_RATES = [
  { label: 'Slow', value: 1200 },
  { label: 'Normal', value: 600 },
  { label: 'Fast', value: 300 },
];

export default function LoadBalancerSimulator() {
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('round-robin');
  const [isRunning, setIsRunning] = useState(false);
  const [trafficRate, setTrafficRate] = useState(600);
  const [servers, setServers] = useState<ServerState[]>([
    { id: 1, name: 'S1', requests: 0, active: 0, healthy: true },
    { id: 2, name: 'S2', requests: 0, active: 0, healthy: true },
    { id: 3, name: 'S3', requests: 0, active: 0, healthy: true },
  ]);
  const [packets, setPackets] = useState<RequestPacket[]>([]);
  const [roundRobinIndex, setRoundRobinIndex] = useState(0);
  const [clientHash] = useState(() => Math.floor(Math.random() * 3));
  const [failedRequests, setFailedRequests] = useState(0);

  const activeServerLines = useMemo(() => {
    const active = new Set<number>();
    packets.forEach((p) => {
      if (p.phase === 'to-server') active.add(p.targetServer);
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
        const targetId = clientHash + 1;
        return servers.find((s) => s.id === targetId)?.healthy ? targetId : null;
      }
      case 'random':
        return healthyServers[Math.floor(Math.random() * healthyServers.length)].id;
      default:
        return 1;
    }
  }, [algorithm, roundRobinIndex, servers, clientHash, healthyServers]);

  const sendRequest = useCallback(() => {
    const targetServer = getTargetServer();
    const packetId = `req-${Date.now()}-${Math.random()}`;

    if (targetServer === null) {
      setPackets((prev) => [...prev, { id: packetId, targetServer: 0, phase: 'to-lb' }]);
      setTimeout(() => {
        setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, phase: 'failed' } : p)));
      }, 300);
      setTimeout(() => {
        setPackets((prev) => prev.filter((p) => p.id !== packetId));
        setFailedRequests((prev) => prev + 1);
      }, 600);
      return;
    }

    setPackets((prev) => [...prev, { id: packetId, targetServer, phase: 'to-lb' }]);
    setTimeout(() => {
      setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, phase: 'exit-lb' } : p)));
    }, 300);
    setTimeout(() => {
      setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, phase: 'to-server' } : p)));
      setServers((prev) => prev.map((s) => (s.id === targetServer ? { ...s, active: s.active + 1 } : s)));
    }, 400);
    setTimeout(() => {
      setPackets((prev) => prev.filter((p) => p.id !== packetId));
      setServers((prev) =>
        prev.map((s) =>
          s.id === targetServer ? { ...s, requests: s.requests + 1, active: Math.max(0, s.active - 1) } : s
        )
      );
    }, 900);
  }, [getTargetServer]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(sendRequest, trafficRate);
    return () => clearInterval(interval);
  }, [isRunning, trafficRate, sendRequest]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setRoundRobinIndex(0);
    setServers([
      { id: 1, name: 'S1', requests: 0, active: 0, healthy: true },
      { id: 2, name: 'S2', requests: 0, active: 0, healthy: true },
      { id: 3, name: 'S3', requests: 0, active: 0, healthy: true },
    ]);
    setPackets([]);
    setFailedRequests(0);
  }, []);

  const serverYPositions = [20, 50, 80];

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Load Balancer Simulator
            </span>
            <span className="text-xs font-normal text-muted-foreground">Click servers to toggle failure</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Compact Controls */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-1">
              <Button size="sm" onClick={() => setIsRunning(!isRunning)} variant={isRunning ? 'destructive' : 'default'}>
                {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="sm" onClick={reset} variant="outline">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-1">
              {(Object.keys(ALGORITHMS) as AlgorithmType[]).map((alg) => (
                <Button
                  key={alg}
                  size="sm"
                  variant={algorithm === alg ? 'default' : 'ghost'}
                  onClick={() => setAlgorithm(alg)}
                  className="text-xs px-2"
                >
                  {ALGORITHMS[alg].name}
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              {TRAFFIC_RATES.map((rate) => (
                <Button
                  key={rate.label}
                  size="sm"
                  variant={trafficRate === rate.value ? 'secondary' : 'ghost'}
                  onClick={() => setTrafficRate(rate.value)}
                  className="text-xs px-2"
                >
                  {rate.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Compact Visual Diagram */}
          <div className="relative h-48 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
            <svg className="absolute inset-0 w-full h-full">
              <line x1="18%" y1="50%" x2="42%" y2="50%" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 3" />
              {serverYPositions.map((y, idx) => {
                const isActive = activeServerLines.has(idx + 1);
                const isHealthy = servers[idx].healthy;
                const color = isHealthy ? SERVER_COLORS[idx] : FAILED_COLOR;
                return (
                  <line
                    key={y}
                    x1="58%"
                    y1="50%"
                    x2="82%"
                    y2={`${y}%`}
                    stroke={isActive && isHealthy ? color.hex : color.dimHex}
                    strokeWidth={isActive && isHealthy ? 4 : 2}
                    strokeDasharray={isHealthy ? (isActive ? '0' : '6 3') : '3 6'}
                    opacity={isHealthy ? 1 : 0.3}
                  />
                );
              })}
            </svg>

            {/* Users */}
            <div className="absolute left-[8%] top-1/2 -translate-y-1/2 z-10 text-center">
              <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center shadow-md border-2 border-white dark:border-slate-700">
                <Users className="h-7 w-7 text-white" />
              </div>
            </div>

            {/* Load Balancer */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="w-16 h-16 rounded-lg bg-purple-600 flex items-center justify-center shadow-md border-2 border-white dark:border-slate-700">
                <span className="text-white text-xs font-bold text-center">LB</span>
              </div>
            </div>

            {/* Servers */}
            <div className="absolute right-[6%] top-0 bottom-0 flex flex-col justify-around py-4 z-10">
              {servers.map((server, idx) => (
                <div
                  key={server.id}
                  className="text-center cursor-pointer group"
                  onClick={() => toggleServerHealth(server.id)}
                  title={`Click to ${server.healthy ? 'disable' : 'enable'}`}
                >
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-md border-2 transition-all
                      ${server.healthy ? SERVER_COLORS[idx].bg : 'bg-gray-400'}
                      ${server.healthy ? 'border-white dark:border-slate-700' : 'border-red-500'}
                      ${activeServerLines.has(server.id) && server.healthy ? 'scale-110' : ''}
                      ${!server.healthy ? 'opacity-50' : ''}
                      group-hover:ring-2 group-hover:ring-offset-1 group-hover:ring-gray-400`}
                  >
                    {server.healthy ? (
                      <Server className="h-6 w-6 text-white" />
                    ) : (
                      <XCircle className="h-6 w-6 text-white" />
                    )}
                  </div>
                  <div className={`text-xs font-medium mt-1 ${!server.healthy ? 'text-red-500' : ''}`}>
                    {server.requests}
                  </div>
                </div>
              ))}
            </div>

            {/* Packets */}
            <AnimatePresence>
              {packets.map((packet) => {
                const serverIdx = packet.targetServer - 1;
                const serverY = serverYPositions[serverIdx] || 50;
                const dotColor = serverIdx >= 0 ? SERVER_COLORS[serverIdx]?.hex : '#ef4444';

                if (packet.phase === 'to-lb') {
                  return (
                    <motion.div
                      key={packet.id}
                      initial={{ left: '14%', top: '50%' }}
                      animate={{ left: '50%', top: '50%' }}
                      transition={{ duration: 0.3, ease: 'linear' }}
                      className="absolute w-4 h-4 rounded-full bg-blue-500 shadow z-20 border border-white"
                      style={{ transform: 'translate(-50%, -50%)' }}
                    />
                  );
                } else if (packet.phase === 'failed') {
                  return (
                    <motion.div
                      key={packet.id}
                      initial={{ left: '50%', top: '50%' }}
                      animate={{ left: '14%', top: '50%' }}
                      transition={{ duration: 0.3, ease: 'linear' }}
                      className="absolute w-4 h-4 rounded-full bg-red-500 shadow z-20 border border-white"
                      style={{ transform: 'translate(-50%, -50%)' }}
                    />
                  );
                } else if (packet.phase === 'exit-lb') {
                  return (
                    <motion.div
                      key={packet.id}
                      initial={{ left: '50%', top: '50%' }}
                      animate={{ left: '58%', top: '50%' }}
                      transition={{ duration: 0.1, ease: 'linear' }}
                      className="absolute w-4 h-4 rounded-full shadow z-20 border border-white"
                      style={{ transform: 'translate(-50%, -50%)', backgroundColor: dotColor }}
                    />
                  );
                } else {
                  return (
                    <motion.div
                      key={packet.id}
                      initial={{ left: '58%', top: '50%' }}
                      animate={{ left: '82%', top: `${serverY}%` }}
                      transition={{ duration: 0.5, ease: 'linear' }}
                      className="absolute w-4 h-4 rounded-full shadow z-20 border border-white"
                      style={{ transform: 'translate(-50%, -50%)', backgroundColor: dotColor }}
                    />
                  );
                }
              })}
            </AnimatePresence>
          </div>

          {/* Compact Stats Row */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex gap-4">
              {servers.map((server, idx) => (
                <div key={server.id} className="flex items-center gap-1">
                  <div
                    className={`w-3 h-3 rounded-full ${server.healthy ? '' : 'opacity-40'}`}
                    style={{ backgroundColor: server.healthy ? SERVER_COLORS[idx].hex : FAILED_COLOR.hex }}
                  />
                  <span className={!server.healthy ? 'text-muted-foreground line-through' : ''}>
                    {server.name}: {server.requests}
                  </span>
                </div>
              ))}
            </div>
            {failedRequests > 0 && (
              <div className="flex items-center gap-1 text-red-500">
                <XCircle className="h-3 w-3" />
                <span>Failed: {failedRequests}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
