'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  RotateCcw,
  Server,
  Zap,
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
    description: 'Each server gets requests in turn, one after another',
  },
  'least-connections': {
    name: 'Least Connections',
    description: 'Sends requests to the server handling the fewest connections',
  },
  'ip-hash': {
    name: 'IP Hash',
    description: 'Same client always goes to the same server (sticky sessions)',
  },
  random: {
    name: 'Random',
    description: 'Picks a random server for each request',
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
      name: 'S1',
      activeConnections: 0,
      totalRequests: 0,
      color: SERVER_COLORS[0],
    },
    {
      id: 'server-2',
      name: 'S2',
      activeConnections: 0,
      totalRequests: 0,
      color: SERVER_COLORS[1],
    },
    {
      id: 'server-3',
      name: 'S3',
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
    }, 600);

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
          <div className="relative bg-muted/30 rounded-lg p-8 h-[400px] overflow-hidden">
            {/* Client Icon */}
            <div className="absolute left-8 top-1/2 -translate-y-1/2 z-10">
              <div className="text-center">
                <Zap className="h-12 w-12 mx-auto text-blue-500" />
                <div className="text-xs mt-2 font-medium">Clients</div>
              </div>
            </div>

            {/* Servers */}
            <div className="absolute right-8 top-0 bottom-0 flex flex-col justify-around py-12 z-10">
              {servers.map((server, idx) => (
                <div key={server.id} className="text-center">
                  <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg"
                    style={{ backgroundColor: server.color }}
                  >
                    {server.name}
                  </div>
                  <div className="text-xs mt-2">
                    <div className="font-medium">{server.totalRequests} requests</div>
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
                  
                  // Fixed positions for 3 servers in 400px container
                  const serverYPositions = [80, 200, 320];
                  const targetY = serverYPositions[targetIndex] || 200;
                  
                  return (
                    <motion.div
                      key={req.id}
                      initial={{ left: 100, top: 200 }}
                      animate={{
                        left: 'calc(100% - 100px)',
                        top: targetY,
                      }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{ duration: 0.8, ease: 'linear' }}
                      className="absolute w-3 h-3 rounded-full shadow-lg"
                      style={{
                        backgroundColor: CLIENT_COLORS[clientColorIndex % CLIENT_COLORS.length],
                      }}
                    />
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
