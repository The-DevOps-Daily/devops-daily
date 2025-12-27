'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Play,
  Pause,
  RotateCcw,
  Globe,
  Server,
  Users,
  Activity,
  CheckCircle,
  XCircle,
  MapPin,
  Zap,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
type EdgeLocation = {
  id: string;
  name: string;
  region: string;
  x: number; // percentage of container width
  y: number; // percentage of container height
  cacheHitRate: number;
  activeRequests: number;
  status: 'healthy' | 'degraded' | 'offline';
};

type UserLocation = {
  id: string;
  name: string;
  x: number;
  y: number;
  nearestEdge: string;
};

type Request = {
  id: string;
  userId: string;
  edgeId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  cacheHit: boolean;
  latency: number;
  status: 'traveling' | 'hit' | 'miss' | 'complete';
};

const EDGE_LOCATIONS: EdgeLocation[] = [
  { id: 'us-east', name: 'US East (Virginia)', region: 'North America', x: 25, y: 35, cacheHitRate: 0, activeRequests: 0, status: 'healthy' },
  { id: 'us-west', name: 'US West (Oregon)', region: 'North America', x: 15, y: 38, cacheHitRate: 0, activeRequests: 0, status: 'healthy' },
  { id: 'europe', name: 'Europe (Frankfurt)', region: 'Europe', x: 50, y: 28, cacheHitRate: 0, activeRequests: 0, status: 'healthy' },
  { id: 'asia', name: 'Asia (Tokyo)', region: 'Asia', x: 80, y: 38, cacheHitRate: 0, activeRequests: 0, status: 'healthy' },
  { id: 'australia', name: 'Australia (Sydney)', region: 'Oceania', x: 85, y: 70, cacheHitRate: 0, activeRequests: 0, status: 'healthy' },
  { id: 'south-america', name: 'South America (São Paulo)', region: 'South America', x: 32, y: 65, cacheHitRate: 0, activeRequests: 0, status: 'healthy' },
];

const USER_PRESETS: Omit<UserLocation, 'id' | 'nearestEdge'>[] = [
  { name: 'New York', x: 26, y: 37 },
  { name: 'Los Angeles', x: 14, y: 40 },
  { name: 'London', x: 49, y: 27 },
  { name: 'Mumbai', x: 68, y: 48 },
  { name: 'Singapore', x: 75, y: 52 },
  { name: 'Tokyo', x: 81, y: 38 },
];

// Calculate distance between two points
const calculateDistance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

// Calculate latency based on distance (simplified)
const calculateLatency = (distance: number): number => {
  // Base latency + distance factor
  const baseLatency = 20;
  const distanceFactor = distance * 3; // Rough approximation
  return Math.round(baseLatency + distanceFactor);
};

export default function CDNSimulator() {
  const [mounted, setMounted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [edges, setEdges] = useState<EdgeLocation[]>(EDGE_LOCATIONS);
  const [users, setUsers] = useState<UserLocation[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<EdgeLocation | null>(null);
  const [totalRequests, setTotalRequests] = useState(0);
  const [cacheHits, setCacheHits] = useState(0);
  const [cacheMisses, setCacheMisses] = useState(0);
  const [avgLatency, setAvgLatency] = useState(0);
  const [originLoad, setOriginLoad] = useState(0);
  
  const animationRef = useRef<number>();
  const lastRequestTime = useRef<number>(0);
  const latencies = useRef<number[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isRunning) {
      startSimulation();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning]);

  const findNearestEdge = (x: number, y: number): string => {
    let minDistance = Infinity;
    let nearestId = edges[0].id;
    
    edges.forEach((edge) => {
      if (edge.status !== 'offline') {
        const distance = calculateDistance(x, y, edge.x, edge.y);
        if (distance < minDistance) {
          minDistance = distance;
          nearestId = edge.id;
        }
      }
    });
    
    return nearestId;
  };

  const addUser = (preset?: typeof USER_PRESETS[0]) => {
    const userData = preset || {
      name: `User ${users.length + 1}`,
      x: Math.random() * 90 + 5,
      y: Math.random() * 70 + 15,
    };
    
    const newUser: UserLocation = {
      id: `user-${Date.now()}-${Math.random()}`,
      ...userData,
      nearestEdge: findNearestEdge(userData.x, userData.y),
    };
    
    setUsers((prev) => [...prev, newUser]);
  };

  const simulateRequest = (user: UserLocation) => {
    const edge = edges.find((e) => e.id === user.nearestEdge);
    if (!edge) return;
    
    const distance = calculateDistance(user.x, user.y, edge.x, edge.y);
    const latency = calculateLatency(distance);
    const cacheHit = Math.random() < 0.75; // 75% cache hit rate
    
    const request: Request = {
      id: `req-${Date.now()}-${Math.random()}`,
      userId: user.id,
      edgeId: edge.id,
      fromX: user.x,
      fromY: user.y,
      toX: edge.x,
      toY: edge.y,
      cacheHit,
      latency,
      status: 'traveling',
    };
    
    setRequests((prev) => [...prev, request]);
    setTotalRequests((prev) => prev + 1);
    
    if (cacheHit) {
      setCacheHits((prev) => prev + 1);
    } else {
      setCacheMisses((prev) => prev + 1);
      setOriginLoad((prev) => Math.min(100, prev + 5));
    }
    
    latencies.current.push(latency);
    if (latencies.current.length > 20) {
      latencies.current.shift();
    }
    setAvgLatency(Math.round(latencies.current.reduce((a, b) => a + b, 0) / latencies.current.length));
    
    // Update edge stats
    setEdges((prev) =>
      prev.map((e) =>
        e.id === edge.id
          ? {
              ...e,
              activeRequests: e.activeRequests + 1,
              cacheHitRate: cacheHit ? Math.min(100, e.cacheHitRate + 1) : e.cacheHitRate,
            }
          : e
      )
    );
    
    // Complete request after animation
    setTimeout(() => {
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      setEdges((prev) =>
        prev.map((e) =>
          e.id === edge.id ? { ...e, activeRequests: Math.max(0, e.activeRequests - 1) } : e
        )
      );
    }, latency * 10); // Animation duration based on latency
  };

  const startSimulation = () => {
    const simulate = () => {
      const now = Date.now();
      
      // Generate random requests from users
      if (users.length > 0 && now - lastRequestTime.current > 800) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        simulateRequest(randomUser);
        lastRequestTime.current = now;
      }
      
      // Decay origin load
      setOriginLoad((prev) => Math.max(0, prev - 0.5));
      
      animationRef.current = requestAnimationFrame(simulate);
    };
    
    simulate();
  };

  const handleReset = () => {
    setIsRunning(false);
    setUsers([]);
    setRequests([]);
    setTotalRequests(0);
    setCacheHits(0);
    setCacheMisses(0);
    setAvgLatency(0);
    setOriginLoad(0);
    setEdges(EDGE_LOCATIONS);
    latencies.current = [];
  };

  if (!mounted) return null;

  const cacheHitRate = totalRequests > 0 ? ((cacheHits / totalRequests) * 100).toFixed(1) : '0.0';

  return (
    <div className="w-full mx-auto px-4">
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Globe className="w-6 h-6" />
                CDN (Content Delivery Network) Simulator
              </CardTitle>
              <CardDescription className="mt-2">
                Watch how edge servers reduce latency and protect origin servers by serving content from locations closer to users.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm">
              Interactive Learning
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setIsRunning(!isRunning)}
              className={cn(
                'gap-2',
                isRunning ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'
              )}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isRunning ? 'Pause' : 'Start'}
            </Button>

            <Button onClick={handleReset} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>

            <div className="h-6 w-px bg-border" />

            <Button
              onClick={() => addUser()}
              variant="outline"
              className="gap-2"
              disabled={users.length >= 10}
            >
              <Users className="w-4 h-4" />
              Add Random User
            </Button>
          </div>

          {/* Quick Add Preset Users */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground mr-2">Quick Add:</span>
            {USER_PRESETS.map((preset) => (
              <Button
                key={preset.name}
                onClick={() => addUser(preset)}
                variant="secondary"
                size="sm"
                disabled={users.length >= 10}
              >
                <MapPin className="w-3 h-3 mr-1" />
                {preset.name}
              </Button>
            ))}
          </div>

          {/* Metrics Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 rounded-lg bg-muted/30">
            <div>
              <div className="text-xs text-muted-foreground">Total Requests</div>
              <div className="text-2xl font-bold">{totalRequests}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Cache Hit Rate</div>
              <div className="text-2xl font-bold text-green-500">{cacheHitRate}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Avg Latency</div>
              <div className="text-2xl font-bold">{avgLatency}ms</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Origin Load</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{Math.round(originLoad)}%</div>
                <div className="text-xs">
                  {originLoad < 30 ? '✅' : originLoad < 70 ? '⚠️' : '❌'}
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Active Users</div>
              <div className="text-2xl font-bold">{users.length}</div>
            </div>
          </div>

          {/* World Map Visualization */}
          <div className="relative w-full h-[500px] border-2 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
            {/* Map background (simplified) */}
            <div className="absolute inset-0 opacity-10">
              <svg width="100%" height="100%" className="text-blue-500">
                {/* Simple continent outlines */}
                <circle cx="25%" cy="40%" r="120" fill="currentColor" opacity="0.1" />
                <circle cx="50%" cy="30%" r="100" fill="currentColor" opacity="0.1" />
                <circle cx="75%" cy="45%" r="130" fill="currentColor" opacity="0.1" />
                <circle cx="30%" cy="70%" r="80" fill="currentColor" opacity="0.1" />
                <circle cx="85%" cy="75%" r="70" fill="currentColor" opacity="0.1" />
              </svg>
            </div>

            {/* Origin Server (center) */}
            <motion.div
              className="absolute z-10"
              style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
            >
              <div className="relative">
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="absolute inset-0 -m-8 rounded-full bg-purple-500"
                />
                <Card className="relative p-3 border-2 border-purple-500 bg-white dark:bg-gray-950">
                  <Server className="w-8 h-8 text-purple-500" />
                  <div className="text-xs font-medium mt-1 text-center">Origin</div>
                  <div className="text-xs text-muted-foreground text-center">{Math.round(originLoad)}%</div>
                </Card>
              </div>
            </motion.div>

            {/* Edge Servers */}
            {edges.map((edge) => (
              <motion.div
                key={edge.id}
                className="absolute z-20 cursor-pointer"
                style={{ left: `${edge.x}%`, top: `${edge.y}%`, transform: 'translate(-50%, -50%)' }}
                onClick={() => setSelectedEdge(edge)}
                whileHover={{ scale: 1.1 }}
              >
                <motion.div
                  animate={
                    edge.activeRequests > 0
                      ? {
                          scale: [1, 1.3, 1],
                          opacity: [0.2, 0.5, 0.2],
                        }
                      : {}
                  }
                  transition={{
                    duration: 1,
                    repeat: edge.activeRequests > 0 ? Infinity : 0,
                  }}
                  className="absolute inset-0 -m-6 rounded-full bg-green-500"
                />
                <Card
                  className={cn(
                    'relative p-2 border-2 transition-all',
                    selectedEdge?.id === edge.id && 'ring-2 ring-blue-500',
                    edge.status === 'healthy' && 'border-green-500',
                    edge.status === 'degraded' && 'border-yellow-500',
                    edge.status === 'offline' && 'border-red-500'
                  )}
                >
                  <Zap className="w-6 h-6 text-green-500" />
                  <div className="text-xs font-medium mt-1 whitespace-nowrap">{edge.region}</div>
                  {edge.activeRequests > 0 && (
                    <Badge variant="secondary" className="absolute -top-2 -right-2 text-xs">
                      {edge.activeRequests}
                    </Badge>
                  )}
                </Card>
              </motion.div>
            ))}

            {/* Users */}
            {users.map((user) => (
              <motion.div
                key={user.id}
                className="absolute z-10"
                style={{ left: `${user.x}%`, top: `${user.y}%`, transform: 'translate(-50%, -50%)' }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <div className="p-2 rounded-full bg-blue-500 text-white shadow-lg">
                  <Users className="w-4 h-4" />
                </div>
                <div className="text-xs font-medium mt-1 whitespace-nowrap text-center">{user.name}</div>
              </motion.div>
            ))}

            {/* Request Animations */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
              {requests.map((request) => {
                const fromX = (request.fromX / 100) * 100;
                const fromY = (request.fromY / 100) * 100;
                const toX = (request.toX / 100) * 100;
                const toY = (request.toY / 100) * 100;
                
                return (
                  <motion.line
                    key={request.id}
                    x1={`${fromX}%`}
                    y1={`${fromY}%`}
                    x2={`${toX}%`}
                    y2={`${toY}%`}
                    stroke={request.cacheHit ? '#22c55e' : '#ef4444'}
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: [0, 1, 0] }}
                    transition={{ duration: request.latency / 100, ease: 'easeInOut' }}
                  />
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Cache Hit (Fast)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Cache Miss (Slower)</span>
            </div>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-500" />
              <span>Origin Server</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-500" />
              <span>Edge Server</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span>User</span>
            </div>
          </div>

          {/* Edge Server Details */}
          <AnimatePresence>
            {selectedEdge && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Card className="p-4 bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedEdge.name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedEdge.region}</p>
                    </div>
                    <Button onClick={() => setSelectedEdge(null)} variant="ghost" size="sm">
                      ×
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Status</div>
                      <div className="flex items-center gap-1 mt-1">
                        {selectedEdge.status === 'healthy' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {selectedEdge.status === 'degraded' && <Activity className="w-4 h-4 text-yellow-500" />}
                        {selectedEdge.status === 'offline' && <XCircle className="w-4 h-4 text-red-500" />}
                        <span className="text-sm font-medium capitalize">{selectedEdge.status}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Active Requests</div>
                      <div className="text-xl font-bold">{selectedEdge.activeRequests}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Cache Hit Rate</div>
                      <div className="text-xl font-bold text-green-500">
                        {selectedEdge.cacheHitRate > 0 ? `${Math.round(selectedEdge.cacheHitRate)}%` : 'N/A'}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Educational Info */}
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              <strong>How it works:</strong> When users request content, it's served from the nearest edge server (green line = cache hit). 
              If content isn't cached, the edge fetches it from the origin server (red line = cache miss), increasing latency and origin load.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
