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
type TutorialStep = 'welcome' | 'add-user' | 'start-simulation' | 'observe-cache' | 'add-more-users' | 'complete';

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
  // Coordinates calculated from lat/long: x = (lon + 180) / 360 * 100, y = (90 - lat) / 180 * 100
  { id: 'us-east', name: 'US East (Virginia)', region: 'North America', x: 27.5, y: 38.9, cacheHitRate: 0, activeRequests: 0, status: 'healthy' }, // -77.5°, 38°N
  { id: 'us-west', name: 'US West (Oregon)', region: 'North America', x: 21.9, y: 37.2, cacheHitRate: 0, activeRequests: 0, status: 'healthy' }, // -123.1°, 45°N
  { id: 'europe', name: 'Europe (Frankfurt)', region: 'Europe', x: 52.4, y: 35.6, cacheHitRate: 0, activeRequests: 0, status: 'healthy' }, // 8.7°, 50°N
  { id: 'asia', name: 'Asia (Tokyo)', region: 'Asia', x: 82.8, y: 38.9, cacheHitRate: 0, activeRequests: 0, status: 'healthy' }, // 139.7°, 35.7°N
  { id: 'australia', name: 'Australia (Sydney)', region: 'Oceania', x: 86.4, y: 68.9, cacheHitRate: 0, activeRequests: 0, status: 'healthy' }, // 151°, -33.9°S
  { id: 'south-america', name: 'South America (São Paulo)', region: 'South America', x: 36.9, y: 62.2, cacheHitRate: 0, activeRequests: 0, status: 'healthy' }, // -46.6°, -23.5°S
];

const USER_PRESETS: Omit<UserLocation, 'id' | 'nearestEdge'>[] = [
  { name: 'New York', x: 29.2, y: 38.9 }, // -74°, 40.7°N
  { name: 'Los Angeles', x: 22.3, y: 38.9 }, // -118.2°, 34°N  
  { name: 'London', x: 50, y: 35.8 }, // 0°, 51.5°N
  { name: 'Mumbai', x: 68.1, y: 39.4 }, // 72.8°, 19°N
  { name: 'Singapore', x: 75.3, y: 49.2 }, // 103.8°, 1.4°N
  { name: 'Tokyo', x: 82.8, y: 38.9 }, // 139.7°, 35.7°N
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
  const [tutorialMode, setTutorialMode] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('welcome');
  const [showWelcome, setShowWelcome] = useState(true);
  const [narration, setNarration] = useState('');
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

  // Tutorial logic
  useEffect(() => {
    if (!tutorialMode) return;

    switch (tutorialStep) {
      case 'welcome':
        setNarration('Welcome! Learn how CDNs deliver content faster using edge servers.');
        break;
      case 'add-user':
        setNarration('👉 Step 1: Click "Add Random User" or choose a preset location (e.g., New York) to place a user on the map.');
        break;
      case 'start-simulation':
        setNarration('👉 Step 2: Great! Now click "Start" to begin simulating requests from your user.');
        break;
      case 'observe-cache':
        setNarration('👀 Watch! Green lines = cache hit (fast, served from nearby edge). Red lines = cache miss (slower, must fetch from origin).');
        break;
      case 'add-more-users':
        setNarration('👉 Step 3: Try adding users from different locations (Mumbai, Tokyo, London) to see how CDN reduces global latency!');
        break;
      case 'complete':
        setNarration('🎉 Tutorial complete! You now understand how CDNs work. Keep exploring!');
        setTimeout(() => setTutorialMode(false), 3000);
        break;
    }
  }, [tutorialStep, tutorialMode]);

  // Progress tutorial based on actions
  useEffect(() => {
    if (!tutorialMode) return;

    if (tutorialStep === 'add-user' && users.length > 0) {
      setTutorialStep('start-simulation');
    } else if (tutorialStep === 'start-simulation' && isRunning) {
      setTutorialStep('observe-cache');
      setTimeout(() => {
        if (tutorialMode) setTutorialStep('add-more-users');
      }, 5000);
    } else if (tutorialStep === 'add-more-users' && users.length >= 3) {
      setTutorialStep('complete');
    }
  }, [users.length, isRunning, tutorialStep, tutorialMode]);

  const startTutorial = () => {
    setShowWelcome(false);
    setTutorialMode(true);
    setTutorialStep('add-user');
    handleReset();
  };

  const skipTutorial = () => {
    setShowWelcome(false);
    setTutorialMode(false);
  };

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
    // Define regions where users can spawn (on landmasses, not oceans)
    const landRegions = [
      { name: 'North America East', minX: 25, maxX: 32, minY: 35, maxY: 45 },
      { name: 'North America West', minX: 19, maxX: 25, minY: 33, maxY: 42 },
      { name: 'Europe', minX: 48, maxX: 58, minY: 32, maxY: 42 },
      { name: 'Asia East', minX: 77, maxX: 87, minY: 30, maxY: 45 },
      { name: 'Asia South', minX: 65, maxX: 76, minY: 38, maxY: 50 },
      { name: 'Australia', minX: 82, maxX: 90, minY: 63, maxY: 72 },
      { name: 'South America', minX: 33, maxX: 42, minY: 55, maxY: 67 },
      { name: 'Africa', minX: 48, maxX: 60, minY: 50, maxY: 70 },
    ];
    
    const userData = preset || {
      name: `User ${users.length + 1}`,
      ...(() => {
        // Pick a random land region
        const region = landRegions[Math.floor(Math.random() * landRegions.length)];
        return {
          x: Math.random() * (region.maxX - region.minX) + region.minX,
          y: Math.random() * (region.maxY - region.minY) + region.minY,
        };
      })(),
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
    if (!tutorialMode) {
      setUsers([]);
    }
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
      {/* Welcome Modal */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full mx-4 p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600">
                  <Globe className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold">CDN Simulator</h2>
                  <p className="text-muted-foreground">Learn Content Delivery Networks</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-600" />
                    What is a CDN?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    A Content Delivery Network uses edge servers worldwide to serve content from locations 
                    closer to users, reducing latency and protecting the origin server from high load.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="font-medium text-sm">Cache Hit</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Content served from edge server (fast, ~20-50ms)
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="font-medium text-sm">Cache Miss</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Must fetch from origin server (slower, ~100-300ms)
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <h3 className="font-semibold mb-2">What you'll learn:</h3>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• How geographic distance affects latency</li>
                    <li>• The difference between cache hits and misses</li>
                    <li>• How edge servers protect origin servers</li>
                    <li>• Why global users benefit from CDNs</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={startTutorial} className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700">
                  Start Tutorial
                </Button>
                <Button onClick={skipTutorial} variant="outline" className="flex-1">
                  Skip & Explore
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
          {/* Tutorial Narration */}
          <AnimatePresence>
            {tutorialMode && narration && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Alert className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 border-2 border-blue-300 dark:border-blue-700">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-900 dark:text-blue-100 font-medium text-base">
                    {narration}
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setIsRunning(!isRunning)}
              disabled={users.length === 0}
              className={cn(
                'gap-2',
                tutorialMode && tutorialStep === 'start-simulation' && 'ring-4 ring-blue-500 ring-offset-2 animate-pulse',
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
              disabled={users.length >= 10}
              className={cn(
                'gap-2',
                tutorialMode && tutorialStep === 'add-user' && 'ring-4 ring-blue-500 ring-offset-2 animate-pulse'
              )}
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
            {tutorialMode && (
              <Button onClick={() => { setTutorialMode(false); setShowWelcome(true); }} variant="ghost" size="sm" className="ml-auto">
                Exit Tutorial
              </Button>
            )}
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
            {/* World Map Image */}
            <img
              src="/world-map.jpg"
              alt="World Map"
              className="absolute inset-0 w-full h-full object-cover opacity-60 dark:opacity-40"
            />

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
              >
                {/* Simple green dot marker */}
                <motion.div
                  className={cn(
                    'relative w-3 h-3 rounded-full transition-all',
                    'hover:scale-150',
                    edge.status === 'healthy' && 'bg-green-500 shadow-lg shadow-green-500/50',
                    edge.status === 'degraded' && 'bg-yellow-500 shadow-lg shadow-yellow-500/50',
                    edge.status === 'offline' && 'bg-red-500 shadow-lg shadow-red-500/50',
                    selectedEdge?.id === edge.id && 'ring-4 ring-blue-400 scale-150'
                  )}
                  animate={
                    edge.activeRequests > 0
                      ? {
                          scale: selectedEdge?.id === edge.id ? 1.5 : [1, 1.2, 1],
                          boxShadow: [
                            '0 0 10px rgba(34, 197, 94, 0.5)',
                            '0 0 20px rgba(34, 197, 94, 0.8)',
                            '0 0 10px rgba(34, 197, 94, 0.5)',
                          ],
                        }
                      : {}
                  }
                  transition={{
                    duration: 1,
                    repeat: edge.activeRequests > 0 ? Infinity : 0,
                  }}
                />
                
                {/* Label always visible */}
                <motion.div
                  className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap"
                >
                  <div className="px-2 py-0.5 bg-white/90 dark:bg-gray-900/90 border border-green-500 rounded shadow-md text-[10px] font-medium">
                    {edge.name}
                  </div>
                </motion.div>
              </motion.div>
            ))}

            {/* Users */}
            {users.map((user) => (
              <motion.div
                key={user.id}
                className="absolute z-30"
                style={{ left: `${user.x}%`, top: `${user.y}%`, transform: 'translate(-50%, -50%)' }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <div className="relative flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-900">
                    <Users className="w-3 h-3 text-white" />
                  </div>
                  <div className="absolute top-full mt-1 px-2 py-0.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-blue-300 dark:border-blue-700 rounded shadow-sm">
                    <div className="text-xs font-medium whitespace-nowrap">{user.name}</div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Request Animations */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-25">
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
