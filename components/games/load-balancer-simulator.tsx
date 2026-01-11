'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  RotateCcw,
  Server,
  Globe,
  Network,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type AlgorithmType =
  | 'round-robin'
  | 'least-connections'
  | 'ip-hash'
  | 'random';

interface ServerConfig {
  id: string;
  name: string;
  activeConnections: number;
  totalRequests: number;
  color: string;
}

interface Request {
  id: string;
  clientId: string;
  timestamp: number;
  targetServerId: string;
  status: 'pending' | 'completed' | 'failed';
}

const ALGORITHMS: Record<
  AlgorithmType,
  { name: string; description: string }
> = {
  'round-robin': {
    name: 'Round Robin',
    description: 'Distributes requests sequentially across all servers in a circular order',
  },
  'least-connections': {
    name: 'Least Connections',
    description: 'Routes traffic to the server with the fewest active connections',
  },
  'ip-hash': {
    name: 'IP Hash',
    description: 'Uses client IP hash to maintain session affinity (sticky sessions)',
  },
  random: {
    name: 'Random',
    description: 'Randomly distributes requests across available servers',
  },
};

const CLIENT_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
];

const SERVER_COLORS = ['#8b5cf6', '#ec4899', '#06b6d4'];

function Select({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {children}
    </select>
  );
}

function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return <option value={value}>{children}</option>;
}

export default function LoadBalancerSimulator() {
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('round-robin');
  const [isRunning, setIsRunning] = useState(false);
  const [servers, setServers] = useState<ServerConfig[]>([
    {
      id: 'server-1',
      name: 'Server 1',
      activeConnections: 0,
      totalRequests: 0,
      color: SERVER_COLORS[0],
    },
    {
      id: 'server-2',
      name: 'Server 2',
      activeConnections: 0,
      totalRequests: 0,
      color: SERVER_COLORS[1],
    },
    {
      id: 'server-3',
      name: 'Server 3',
      activeConnections: 0,
      totalRequests: 0,
      color: SERVER_COLORS[2],
    },
  ]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [currentRRIndex, setCurrentRRIndex] = useState(0);
  const [requestIdCounter, setRequestIdCounter] = useState(0);
  const [clientIdCounter, setClientIdCounter] = useState(0);

  const selectServer = useCallback(
    (clientId: string): ServerConfig | null => {
      if (servers.length === 0) return null;

      switch (algorithm) {
        case 'round-robin': {
          const server = servers[currentRRIndex % servers.length];
          setCurrentRRIndex((prev) => prev + 1);
          return server;
        }

        case 'least-connections': {
          return servers.reduce((min, server) =>
            server.activeConnections < min.activeConnections ? server : min
          );
        }

        case 'ip-hash': {
          const hash = clientId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          return servers[hash % servers.length];
        }

        case 'random': {
          return servers[Math.floor(Math.random() * servers.length)];
        }

        default:
          return servers[0];
      }
    },
    [algorithm, servers, currentRRIndex]
  );

  const generateRequest = useCallback(() => {
    if (!isRunning || servers.length === 0) return;

    const clientId = `client-${clientIdCounter % 4}`;
    setClientIdCounter((prev) => prev + 1);

    const targetServer = selectServer(clientId);
    if (!targetServer) return;

    const request: Request = {
      id: `req-${requestIdCounter}`,
      clientId,
      timestamp: Date.now(),
      targetServerId: targetServer.id,
      status: 'pending',
    };

    setRequestIdCounter((prev) => prev + 1);
    setRequests((prev) => [...prev.slice(-20), request]);

    setServers((prevServers) =>
      prevServers.map((s) =>
        s.id === targetServer.id
          ? {
              ...s,
              activeConnections: s.activeConnections + 1,
              totalRequests: s.totalRequests + 1,
            }
          : s
      )
    );

    // Complete request after animation
    setTimeout(() => {
      setRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, status: 'completed' } : r))
      );
      setServers((prevServers) =>
        prevServers.map((s) =>
          s.id === targetServer.id
            ? {
                ...s,
                activeConnections: Math.max(0, s.activeConnections - 1),
              }
            : s
        )
      );
    }, 800);
  }, [isRunning, servers, selectServer, clientIdCounter, requestIdCounter]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      generateRequest();
    }, 400);

    return () => clearInterval(interval);
  }, [isRunning, generateRequest]);

  const handleReset = () => {
    setIsRunning(false);
    setServers((prev) =>
      prev.map((s) => ({
        ...s,
        activeConnections: 0,
        totalRequests: 0,
      }))
    );
    setRequests([]);
    setCurrentRRIndex(0);
    setRequestIdCounter(0);
    setClientIdCounter(0);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl md:text-3xl">
            <Server className="h-8 w-8" />
            Load Balancer Algorithm Simulator
          </CardTitle>
          <CardDescription>
            Watch how different algorithms distribute requests across 3 servers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">Select Algorithm</label>
              <Select value={algorithm} onValueChange={(v) => setAlgorithm(v as AlgorithmType)}>
                {Object.entries(ALGORITHMS).map(([key, { name }]) => (
                  <SelectItem key={key} value={key}>
                    {name}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setIsRunning(!isRunning)}
                variant={isRunning ? 'destructive' : 'default'}
                className="flex-1"
              >
                {isRunning ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start
                  </>
                )}
              </Button>
              <Button onClick={handleReset} variant="outline" size="icon">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Algorithm Description */}
          <div className="p-3 mb-6 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm">
              <strong>{ALGORITHMS[algorithm].name}:</strong> {ALGORITHMS[algorithm].description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Visual Area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Live Traffic Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative bg-gradient-to-br from-blue-50 to-green-50 dark:from-slate-900 dark:to-slate-800 rounded-lg p-8 h-[500px] overflow-hidden">
            {/* Dashed Connection Lines */}
            <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
              {/* Internet to Load Balancer */}
              <line
                x1="15%"
                y1="50%"
                x2="50%"
                y2="50%"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="5,5"
                className="text-muted-foreground"
              />
              {/* Load Balancer to Servers */}
              {[20, 50, 80].map((yPercent, idx) => (
                <line
                  key={idx}
                  x1="50%"
                  y1="50%"
                  x2="85%"
                  y2={`${yPercent}%`}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  className="text-muted-foreground"
                />
              ))}
            </svg>

            {/* Internet Icon */}
            <div className="absolute left-[15%] top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                  <Globe className="h-8 w-8 text-white" />
                </div>
                <div className="text-xs mt-2 font-medium">Internet</div>
              </div>
            </div>

            {/* Load Balancer Icon */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="text-center">
                <div className="w-20 h-20 rounded-lg bg-purple-500 flex items-center justify-center shadow-lg">
                  <Network className="h-10 w-10 text-white" />
                </div>
                <div className="text-xs mt-2 font-medium">Load Balancer</div>
                <div className="text-xs text-muted-foreground">{ALGORITHMS[algorithm].name}</div>
              </div>
            </div>

            {/* Servers */}
            <div className="absolute right-[85%] top-0 bottom-0 flex flex-col justify-around py-8 z-10" style={{ transform: 'translateX(50%)' }}>
              {servers.map((server) => (
                <div key={server.id} className="text-center">
                  {/* Server Rack Visual */}
                  <div
                    className="relative w-24 h-32 rounded-lg flex flex-col items-center justify-center shadow-lg border-2 border-slate-300 dark:border-slate-600"
                    style={{ backgroundColor: server.color }}
                  >
                    {/* Server rack slots */}
                    <div className="absolute inset-2 flex flex-col gap-2">
                      {[1, 2, 3].map((slot) => (
                        <div
                          key={slot}
                          className="h-6 rounded bg-white/20 border border-white/30 flex items-center justify-center"
                        >
                          <div className="flex gap-1">
                            <div className="w-1 h-1 rounded-full bg-white/60" />
                            <div className="w-1 h-1 rounded-full bg-white/60" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="absolute bottom-2 text-white text-xs font-bold">
                      {server.name.replace('Server ', 'S')}
                    </div>
                  </div>
                  {/* Stats below server */}
                  <div className="text-xs mt-2 bg-white dark:bg-slate-800 rounded px-3 py-1.5 shadow-md inline-block">
                    <div className="font-bold text-foreground">{server.name}</div>
                    <div className="font-medium text-muted-foreground">{server.totalRequests} requests</div>
                    <div className="text-muted-foreground">
                      {server.activeConnections} active
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Animated Requests */}
            <AnimatePresence>
              {requests
                .filter((r) => r.status === 'pending')
                .map((req) => {
                  const targetIndex = servers.findIndex((s) => s.id === req.targetServerId);
                  const clientColorIndex = parseInt(req.clientId.split('-')[1]);
                  const serverYPercents = [20, 50, 80];
                  const targetYPercent = serverYPercents[targetIndex] || 50;
                  const color = CLIENT_COLORS[clientColorIndex % CLIENT_COLORS.length];

                  return (
                    <React.Fragment key={req.id}>
                      {/* Stage 1: Internet to Load Balancer */}
                      <motion.div
                        initial={{ left: '15%', top: '50%', opacity: 1 }}
                        animate={{ left: '50%', top: '50%', opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4, ease: 'easeInOut' }}
                        className="absolute w-3 h-3 rounded-full shadow-lg"
                        style={{
                          backgroundColor: color,
                          transform: 'translate(-50%, -50%)',
                          zIndex: 20,
                        }}
                      />
                      
                      {/* Stage 2: Load Balancer to Server */}
                      <motion.div
                      initial={{ left: '50%', top: '50%', opacity: 0 }}
                      animate={{ left: '85%', top: `${targetYPercent}%`, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, delay: 0.4, ease: 'easeInOut' }}
                      className="absolute w-3 h-3 rounded-full shadow-lg"
                      style={{
                        backgroundColor: color,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 20,
                      }}
                    />
                    </React.Fragment>
                  );
                })}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Simple Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Request Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={servers}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="totalRequests" fill="#3b82f6" name="Total Requests" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
