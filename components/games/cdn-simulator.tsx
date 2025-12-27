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
  // 3x2 grid layout - clean and organized
  { id: 'us-east', name: 'US East', region: 'US East', x: 16.67, y: 25, cacheHitRate: 0, activeRequests: 0, status: 'healthy' },
  { id: 'us-west', name: 'US West', region: 'US West', x: 50, y: 25, cacheHitRate: 0, activeRequests: 0, status: 'healthy' },
  { id: 'europe', name: 'Europe', region: 'Europe', x: 83.33, y: 25, cacheHitRate: 0, activeRequests: 0, status: 'healthy' },
  { id: 'asia', name: 'Asia', region: 'Asia', x: 16.67, y: 75, cacheHitRate: 0, activeRequests: 0, status: 'healthy' },
  { id: 'south-america', name: 'South America', region: 'South America', x: 50, y: 75, cacheHitRate: 0, activeRequests: 0, status: 'healthy' },
  { id: 'australia', name: 'Australia', region: 'Australia', x: 83.33, y: 75, cacheHitRate: 0, activeRequests: 0, status: 'healthy' },
];

const USER_PRESETS: Omit<UserLocation, 'id' | 'nearestEdge'>[] = [
  { name: 'New York', x: 16.67, y: 42 },
  { name: 'Los Angeles', x: 50, y: 42 },
  { name: 'London', x: 83.33, y: 42 },
  { name: 'Tokyo', x: 16.67, y: 90 },
  { name: 'São Paulo', x: 50, y: 90 },
  { name: 'Sydney', x: 83.33, y: 90 },
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
       setNarration('👉 Step 1: Add a user to simulate a visitor accessing your website. Each user connects to their nearest edge server automatically.');
       break;
     case 'start-simulation':
       setNarration('👉 Step 2: Click "Start" to simulate HTTP requests. Watch for GREEN lines (cache hit, fast!) vs RED lines (cache miss, slower).');
       break;
     case 'observe-cache':
       setNarration('👀 Notice: ~75% requests are GREEN (cache hits). This means content is served from edge servers near users, not from distant origin! This is the CDN magic.');
       break;
     case 'add-more-users':
       setNarration('👉 Step 3: Add users from different regions. Notice how each connects to their NEAREST edge server - this is why CDNs make global apps fast!');
       break;
     case 'complete':
       setNarration('🎉 You learned: CDNs cache content at edge locations worldwide, reducing latency for global users and protecting your origin server from overload!');
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
  // Define structured positions in each grid cell (3 columns x 2 rows per region)
  const userSlots = [
    // US East - top left cell (below region card)
    { x: 10, y: 40 }, { x: 16.67, y: 40 }, { x: 23.34, y: 40 },
    { x: 10, y: 45 }, { x: 16.67, y: 45 }, { x: 23.34, y: 45 },
    // US West - top middle cell (below region card)
    { x: 43.33, y: 40 }, { x: 50, y: 40 }, { x: 56.67, y: 40 },
    { x: 43.33, y: 45 }, { x: 50, y: 45 }, { x: 56.67, y: 45 },
    // Europe - top right cell (below region card)
    { x: 76.66, y: 40 }, { x: 83.33, y: 40 }, { x: 90, y: 40 },
    { x: 76.66, y: 45 }, { x: 83.33, y: 45 }, { x: 90, y: 45 },
    // Asia - bottom left cell (below region card)
    { x: 10, y: 88 }, { x: 16.67, y: 88 }, { x: 23.34, y: 88 },
    { x: 10, y: 92 }, { x: 16.67, y: 92 }, { x: 23.34, y: 92 },
    // South America - bottom middle cell (below region card)
    { x: 43.33, y: 88 }, { x: 50, y: 88 }, { x: 56.67, y: 88 },
    { x: 43.33, y: 92 }, { x: 50, y: 92 }, { x: 56.67, y: 92 },
    // Australia - bottom right cell (below region card)
    { x: 76.66, y: 88 }, { x: 83.33, y: 88 }, { x: 90, y: 88 },
    { x: 76.66, y: 92 }, { x: 83.33, y: 92 }, { x: 90, y: 92 },
  ];
   
   const userData = preset || (() => {
      // Find all available slots that aren't already occupied
      const occupiedPositions = users.map(u => `${u.x},${u.y}`);
      const availableSlots = userSlots.filter(slot => 
        !occupiedPositions.includes(`${slot.x},${slot.y}`)
      );
      
      // Pick a random available slot
      const position = availableSlots.length > 0
        ? availableSlots[Math.floor(Math.random() * availableSlots.length)]
        : userSlots[users.length % userSlots.length]; // Fallback if all slots full
      
      return {
        name: `User ${users.length + 1}`,
        ...position,
      };
    })();
    
    // If preset provided, use it
    const finalUserData = preset ? {
      name: preset.name,
      x: preset.x,
      y: preset.y,
    } : userData;
    
    const newUser: UserLocation = {
      id: `user-${Date.now()}-${Math.random()}`,
      ...finalUserData,
      nearestEdge: findNearestEdge(finalUserData.x, finalUserData.y),
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
                   <li>• <strong>Latency reduction:</strong> See 60-70% faster response times with CDN</li>
                   <li>• <strong>Origin protection:</strong> Watch origin load drop from 100% to ~25%</li>
                   <li>• <strong>Global reach:</strong> Users auto-connect to nearest edge server</li>
                   <li>• <strong>Cache efficiency:</strong> Compare cache hits vs misses in real-time</li>
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
              disabled={users.length >= 36}
              className={cn(
                'gap-2',
                tutorialMode && tutorialStep === 'add-user' && 'ring-4 ring-blue-500 ring-offset-2 animate-pulse'
              )}
            >
              <Users className="w-4 h-4" />
              Add Random User ({users.length}/36)
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
                disabled={users.length >= 36}
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
         <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 border border-blue-200 dark:border-blue-800">
           <div>
             <div className="text-xs text-muted-foreground">Total Requests</div>
             <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalRequests}</div>
             <div className="text-[10px] text-muted-foreground mt-1">Simulated user requests</div>
           </div>
           <div>
             <div className="text-xs text-muted-foreground">Cache Hit Rate</div>
             <div className="text-2xl font-bold text-green-500">{cacheHitRate}%</div>
             <div className="text-[10px] text-muted-foreground mt-1">Served from edge</div>
           </div>
           <div>
             <div className="text-xs text-muted-foreground">Avg Latency</div>
             <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{avgLatency}ms</div>
             <div className="text-[10px] text-green-600 dark:text-green-400 mt-1">
               {avgLatency > 0 && `~${Math.round(avgLatency * 3)}ms without CDN`}
             </div>
           </div>
           <div>
             <div className="text-xs text-muted-foreground">Origin Load</div>
             <div className="flex items-center gap-2">
               <div className="text-2xl font-bold">{Math.round(originLoad)}%</div>
               <div className="text-xs">
                 {originLoad < 30 ? '✅' : originLoad < 70 ? '⚠️' : '❌'}
               </div>
             </div>
             <div className="text-[10px] text-muted-foreground mt-1">
               {originLoad < 30 ? 'Protected!' : originLoad < 70 ? 'Moderate' : 'High load!'}
             </div>
           </div>
           <div>
             <div className="text-xs text-muted-foreground">Active Users</div>
             <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{users.length}</div>
             <div className="text-[10px] text-muted-foreground mt-1">Global distribution</div>
           </div>
         </div>

          {/* World Map Visualization */}
          <div className="relative w-full h-[600px] border-2 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
            {/* Grid Lines for Structure */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-0">
              {/* Vertical lines */}
              <div className="border-r border-slate-300 dark:border-slate-700"></div>
              <div className="border-r border-slate-300 dark:border-slate-700"></div>
              <div></div>
              <div className="border-r border-slate-300 dark:border-slate-700"></div>
              <div className="border-r border-slate-300 dark:border-slate-700"></div>
              <div></div>
            </div>

            {/* Region Cards - Clean Grid Layout */}
            {edges.map((edge) => (
              <div
                key={`region-${edge.id}`}
                className="absolute bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/40 rounded-lg border-2 border-emerald-300 dark:border-emerald-700 flex flex-col items-center justify-center shadow-sm"
                style={{
                  left: `${edge.x}%`,
                  top: `${edge.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '30%',
                  height: '28%',
                }}
              >
                {/* Server Icon */}
                <div className="mb-2">
                  <Server className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                
                {/* Region Name */}
                <div className="text-center px-2">
                  <div className="text-base font-bold text-emerald-800 dark:text-emerald-200">
                    {edge.name}
                  </div>
                  
                  {/* Status indicator */}
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      edge.status === 'healthy' && 'bg-green-500',
                      edge.status === 'degraded' && 'bg-yellow-500',
                      edge.status === 'offline' && 'bg-red-500'
                    )} />
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      {edge.activeRequests > 0 ? `${edge.activeRequests} active` : 'Ready'}
                    </span>
                  </div>
                </div>
              </div>
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
                <div className="flex items-center gap-1 bg-blue-500 text-white px-2 py-1 rounded-full shadow-lg border-2 border-blue-300 dark:border-blue-700">
                  <Users className="w-3 h-3" />
                  <div className="text-xs font-medium whitespace-nowrap">{user.name}</div>
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
             <Zap className="w-4 h-4 text-green-500" />
             <span>Edge Server</span>
           </div>
           <div className="flex items-center gap-2">
             <Users className="w-4 h-4 text-blue-500" />
             <span>User</span>
           </div>
         </div>

         {/* Real-Time Learning Insights */}
         {isRunning && totalRequests > 0 && (
           <Alert className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/40 dark:to-orange-950/40 border-yellow-300 dark:border-yellow-700">
             <Info className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
             <AlertDescription className="text-sm">
               <strong className="text-yellow-900 dark:text-yellow-100">💡 Real-time Insight:</strong>
               <span className="text-yellow-800 dark:text-yellow-200 ml-2">
                 {cacheHitRate >= 70 ? (
                   `With ${cacheHitRate}% cache hit rate, your origin server is handling ${100 - cacheHitRate}% of requests. 
                    CDN is reducing origin load by ~${cacheHitRate}%! 🎉`
                 ) : cacheHitRate >= 50 ? (
                   `Cache hit rate at ${cacheHitRate}%. More cache hits = faster responses and lower origin load.`
                 ) : (
                   `Low cache hit rate (${cacheHitRate}%). In production, optimize cache-control headers to improve this.`
                 )}
                 {avgLatency > 0 && (
                   <span className="block mt-1">
                     Without CDN, average latency would be ~<strong>{Math.round(avgLatency * 3)}ms</strong> (3x slower). 
                     You're saving <strong>{Math.round(avgLatency * 2)}ms</strong> per request!
                   </span>
                 )}
               </span>
             </AlertDescription>
           </Alert>
         )}

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
