'use client';

import React, { useState, useEffect, useCallback } from 'react';
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

export default function LoadBalancerSimulator() {
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('round-robin');
  const [isRunning, setIsRunning] = useState(false);
  const [servers, setServers] = useState<ServerState[]>([
    { id: 1, name: 'Server 1', requests: 0, active: 0 },
    { id: 2, name: 'Server 2', requests: 0, active: 0 },
    { id: 3, name: 'Server 3', requests: 0, active: 0 },
  ]);
  const [packets, setPackets] = useState<RequestPacket[]>([]);
  const [roundRobinIndex, setRoundRobinIndex] = useState(0);
  const [clientHash] = useState(() => Math.floor(Math.random() * 3));

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

    // Create packet going to load balancer
    setPackets((prev) => [...prev, { id: packetId, targetServer, phase: 'to-lb' }]);

    // After 500ms, switch to going to server
    setTimeout(() => {
      setPackets((prev) =>
        prev.map((p) => (p.id === packetId ? { ...p, phase: 'to-server' } : p))
      );

      // Increment active connections
      setServers((prev) =>
        prev.map((s) => (s.id === targetServer ? { ...s, active: s.active + 1 } : s))
      );
    }, 500);

    // After 1000ms, complete the request
    setTimeout(() => {
      setPackets((prev) => prev.filter((p) => p.id !== packetId));
      setServers((prev) =>
        prev.map((s) =>
          s.id === targetServer
            ? { ...s, requests: s.requests + 1, active: Math.max(0, s.active - 1) }
            : s
        )
      );
    }, 1000);
  }, [getTargetServer]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(sendRequest, 800);
    return () => clearInterval(interval);
  }, [isRunning, sendRequest]);

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

  // Server Y positions (percentage from top)
  const serverYPositions = [20, 50, 80];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Load Balancer Simulator</CardTitle>
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

          {/* Main Diagram - Simple left-to-right flow */}
          <div className="relative h-80 bg-slate-50 dark:bg-slate-900 rounded-lg border overflow-hidden">
            {/* Connection lines (SVG) */}
            <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
              {/* Users to Load Balancer */}
              <line x1="15%" y1="50%" x2="45%" y2="50%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6 4" />
              {/* Load Balancer to each Server */}
              {serverYPositions.map((y) => (
                <line key={y} x1="55%" y1="50%" x2="85%" y2={`${y}%`} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6 4" />
              ))}
            </svg>

            {/* Users (Left) */}
            <div className="absolute left-[10%] top-1/2 -translate-y-1/2 z-10 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center shadow-lg mx-auto">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div className="mt-2 text-sm font-medium">Users</div>
            </div>

            {/* Load Balancer (Center) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-center">
              <div className="w-20 h-20 rounded-lg bg-purple-600 flex items-center justify-center shadow-lg mx-auto">
                <span className="text-white text-xs font-bold text-center leading-tight">Load<br/>Balancer</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{ALGORITHMS[algorithm].name}</div>
            </div>

            {/* Servers (Right) */}
            <div className="absolute right-[5%] top-0 bottom-0 flex flex-col justify-around py-4 z-10">
              {servers.map((server, idx) => (
                <div key={server.id} className="flex items-center gap-2">
                  <div className="w-14 h-14 rounded-lg bg-green-600 flex items-center justify-center shadow-lg">
                    <Server className="h-7 w-7 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium">{server.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {server.requests} handled
                      {server.active > 0 && (
                        <span className="ml-1 text-orange-500">({server.active} active)</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Animated Packets */}
            <AnimatePresence>
              {packets.map((packet) => {
                const serverIdx = packet.targetServer - 1;
                const serverY = serverYPositions[serverIdx];

                if (packet.phase === 'to-lb') {
                  // Animate from Users (15%) to Load Balancer (50%)
                  return (
                    <motion.div
                      key={packet.id}
                      initial={{ left: '15%', top: '50%' }}
                      animate={{ left: '50%', top: '50%' }}
                      transition={{ duration: 0.5, ease: 'linear' }}
                      className="absolute w-4 h-4 rounded-full bg-blue-500 shadow-lg z-20"
                      style={{ transform: 'translate(-50%, -50%)' }}
                    />
                  );
                } else {
                  // Animate from Load Balancer (50%) to Server (85%)
                  return (
                    <motion.div
                      key={packet.id}
                      initial={{ left: '50%', top: '50%' }}
                      animate={{ left: '85%', top: `${serverY}%` }}
                      transition={{ duration: 0.5, ease: 'linear' }}
                      className="absolute w-4 h-4 rounded-full bg-green-500 shadow-lg z-20"
                      style={{ transform: 'translate(-50%, -50%)' }}
                    />
                  );
                }
              })}
            </AnimatePresence>
          </div>

          {/* Simple Stats */}
          <div className="grid grid-cols-3 gap-4">
            {servers.map((server) => (
              <div key={server.id} className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 text-center">
                <div className="text-sm font-medium">{server.name}</div>
                <div className="text-3xl font-bold text-green-600">{server.requests}</div>
                <div className="text-xs text-muted-foreground">requests handled</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
