'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Users, Server } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type AlgorithmType = 'round-robin' | 'least-connections' | 'ip-hash' | 'random';

interface ServerState {
  id: number;
  name: string;
  requests: number;
  active: number;
}

interface RequestPacket {
  id: string;
  targetServer: number;
  phase: 'to-lb' | 'to-server';
}

// Distinct colors for each server - makes it crystal clear where requests go
const SERVER_COLORS = [
  { bg: 'bg-emerald-500', hex: '#10b981', dimHex: '#d1fae5' },
  { bg: 'bg-amber-500', hex: '#f59e0b', dimHex: '#fef3c7' },
  { bg: 'bg-rose-500', hex: '#f43f5e', dimHex: '#ffe4e6' },
];

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
    { id: 1, name: 'Server 1', requests: 0, active: 0 },
    { id: 2, name: 'Server 2', requests: 0, active: 0 },
    { id: 3, name: 'Server 3', requests: 0, active: 0 },
  ]);
  const [packets, setPackets] = useState<RequestPacket[]>([]);
  const [roundRobinIndex, setRoundRobinIndex] = useState(0);
  const [clientHash] = useState(() => Math.floor(Math.random() * 3));

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

  const getTargetServer = useCallback((): number => {
    switch (algorithm) {
      case 'round-robin': {
        const target = (roundRobinIndex % 3) + 1;
        setRoundRobinIndex((prev) => prev + 1);
        return target;
      }
      case 'least-connections': {
        const sorted = [...servers].sort((a, b) => a.active - b.active);
        return sorted[0].id;
      }
      case 'ip-hash':
        return clientHash + 1;
      case 'random':
        return Math.floor(Math.random() * 3) + 1;
      default:
        return 1;
    }
  }, [algorithm, roundRobinIndex, servers, clientHash]);

  const sendRequest = useCallback(() => {
    const targetServer = getTargetServer();
    const packetId = `req-${Date.now()}-${Math.random()}`;

    setPackets((prev) => [...prev, { id: packetId, targetServer, phase: 'to-lb' }]);

    setTimeout(() => {
      setPackets((prev) =>
        prev.map((p) => (p.id === packetId ? { ...p, phase: 'to-server' } : p))
      );
      setServers((prev) =>
        prev.map((s) => (s.id === targetServer ? { ...s, active: s.active + 1 } : s))
      );
    }, 400);

    setTimeout(() => {
      setPackets((prev) => prev.filter((p) => p.id !== packetId));
      setServers((prev) =>
        prev.map((s) =>
          s.id === targetServer
            ? { ...s, requests: s.requests + 1, active: Math.max(0, s.active - 1) }
            : s
        )
      );
    }, 900);
  }, [getTargetServer]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(sendRequest, trafficRate);
    return () => clearInterval(interval);
  }, [isRunning, sendRequest, trafficRate]);

  const reset = () => {
    setIsRunning(false);
    setPackets([]);
    setServers([
      { id: 1, name: 'Server 1', requests: 0, active: 0 },
      { id: 2, name: 'Server 2', requests: 0, active: 0 },
      { id: 3, name: 'Server 3', requests: 0, active: 0 },
    ]);
    setRoundRobinIndex(0);
  };

  // Server Y positions - these match the flex justify-around layout
  // Container is 420px with py-6 (24px each side), so usable = 372px
  // 3 items with justify-around: positions at 1/6, 3/6, 5/6 of usable area
  // Adding padding offset: (24 + 372/6)/420, (24 + 372/2)/420, (24 + 5*372/6)/420
  // Roughly: 17%, 50%, 83%
  const serverYPositions = [17, 50, 83];

  return (
    <div className="space-y-6">
      <Card className="max-w-6xl mx-auto">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Load Balancer Simulator
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Watch how a load balancer distributes incoming user requests across multiple servers
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsRunning(!isRunning)}
                variant={isRunning ? 'destructive' : 'default'}
                size="sm"
              >
                {isRunning ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                {isRunning ? 'Stop' : 'Start'}
              </Button>
              <Button onClick={reset} variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-1" /> Reset
              </Button>
            </div>

            {/* Traffic Rate Control */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Traffic:</label>
              <div className="flex gap-1">
                {TRAFFIC_RATES.map((rate) => (
                  <Button
                    key={rate.value}
                    variant={trafficRate === rate.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTrafficRate(rate.value)}
                    className="text-xs px-2 h-8"
                  >
                    {rate.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Algorithm Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Algorithm:</label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}
                className="px-3 py-1.5 text-sm border rounded-md bg-background"
              >
                {Object.entries(ALGORITHMS).map(([key, { name }]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Algorithm explanation */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm">
              <span className="font-semibold">{ALGORITHMS[algorithm].name}:</span>{' '}
              {ALGORITHMS[algorithm].description}
            </p>
          </div>

          {/* Main Diagram - Wide layout */}
          <div className="relative h-[420px] bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl border-2 overflow-hidden">
            {/* Connection lines (SVG) */}
            <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
              {/* Users to Load Balancer - single line */}
              <line
                x1="12%"
                y1="50%"
                x2="42%"
                y2="50%"
                stroke="#94a3b8"
                strokeWidth="3"
                strokeDasharray="8 4"
              />
              {/* Load Balancer to each Server - colored lines that light up */}
              {serverYPositions.map((y, idx) => {
                const isActive = activeServerLines.has(idx + 1);
                return (
                  <line
                    key={y}
                    x1="58%"
                    y1="50%"
                    x2="85%"
                    y2={`${y}%`}
                    stroke={isActive ? SERVER_COLORS[idx].hex : SERVER_COLORS[idx].dimHex}
                    strokeWidth={isActive ? 5 : 3}
                    strokeDasharray={isActive ? '0' : '8 4'}
                    style={{ transition: 'stroke 0.15s, stroke-width 0.15s' }}
                  />
                );
              })}
            </svg>

            {/* Users (Left) */}
            <div className="absolute left-[6%] top-1/2 -translate-y-1/2 z-10 text-center">
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
            <div className="absolute right-[4%] top-0 bottom-0 flex flex-col justify-around py-6 z-10">
              {servers.map((server, idx) => (
                <div key={server.id} className="text-center">
                  <div
                    className={`w-20 h-20 rounded-xl ${SERVER_COLORS[idx].bg} flex items-center justify-center shadow-lg mx-auto border-4 border-white dark:border-slate-700 transition-transform ${
                      activeServerLines.has(server.id) ? 'scale-110' : ''
                    }`}
                  >
                    <Server className="h-9 w-9 text-white" />
                  </div>
                  <div className="mt-2 text-sm font-semibold">{server.name}</div>
                </div>
              ))}
            </div>

            {/* Animated Packets - Follow the colored lines */}
            <AnimatePresence>
              {packets.map((packet) => {
                const serverIdx = packet.targetServer - 1;
                const serverY = serverYPositions[serverIdx];
                const dotColor = SERVER_COLORS[serverIdx].hex;

                if (packet.phase === 'to-lb') {
                  // Blue dot: Users → Load Balancer
                  return (
                    <motion.div
                      key={packet.id}
                      initial={{ left: '12%', top: '50%' }}
                      animate={{ left: '50%', top: '50%' }}
                      transition={{ duration: 0.4, ease: 'linear' }}
                      className="absolute w-5 h-5 rounded-full bg-blue-500 shadow-lg z-20 border-2 border-white"
                      style={{ transform: 'translate(-50%, -50%)' }}
                    />
                  );
                } else {
                  // Colored dot: Load Balancer → Server (matches server color)
                  return (
                    <motion.div
                      key={packet.id}
                      initial={{ left: '50%', top: '50%' }}
                      animate={{ left: '85%', top: `${serverY}%` }}
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
                className="rounded-lg p-4 text-center border-2"
                style={{ borderColor: SERVER_COLORS[idx].hex, backgroundColor: SERVER_COLORS[idx].dimHex }}
              >
                <div className="text-sm font-semibold" style={{ color: SERVER_COLORS[idx].hex }}>
                  {server.name}
                </div>
                <div className="text-3xl font-bold" style={{ color: SERVER_COLORS[idx].hex }}>
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
