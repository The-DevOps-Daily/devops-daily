'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Play,
  Pause,
  RotateCcw,
  Server,
  Globe,
  Zap,
  Info,
  CheckCircle,
} from 'lucide-react';

type EdgeLocation = {
  id: string;
  name: string;
  x: number;
  y: number;
  cacheHitRate: number;
  activeRequests: number;
};

type Request = {
  id: string;
  edgeId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  cacheHit: boolean;
};

const EDGE_LOCATIONS: EdgeLocation[] = [
  { id: 'us-east', name: 'US East', x: 20, y: 30, cacheHitRate: 0, activeRequests: 0 },
  { id: 'europe', name: 'Europe', x: 50, y: 30, cacheHitRate: 0, activeRequests: 0 },
  { id: 'asia', name: 'Asia', x: 80, y: 30, cacheHitRate: 0, activeRequests: 0 },
];

const ORIGIN = { x: 50, y: 70, name: 'Origin Server' };

export default function CDNSimulator() {
  const [mounted, setMounted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [edges, setEdges] = useState<EdgeLocation[]>(EDGE_LOCATIONS);
  const [requests, setRequests] = useState<Request[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [cacheHits, setCacheHits] = useState(0);
  const [avgLatency, setAvgLatency] = useState(0);
  
  const animationRef = useRef<number>();
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

  const startSimulation = () => {
    const simulate = () => {
      // Generate random requests to random edge servers
      if (Math.random() < 0.3) { // 30% chance per frame
        const randomEdge = edges[Math.floor(Math.random() * edges.length)];
        const isCacheHit = Math.random() < 0.75; // 75% cache hit rate
        
        const newRequest: Request = {
          id: `req-${Date.now()}-${Math.random()}`,
          edgeId: randomEdge.id,
          fromX: randomEdge.x,
          fromY: randomEdge.y,
          toX: isCacheHit ? randomEdge.x : ORIGIN.x,
          toY: isCacheHit ? randomEdge.y : ORIGIN.y,
          cacheHit: isCacheHit,
        };

        setRequests(prev => [...prev, newRequest]);
        setTotalRequests(prev => prev + 1);
        
        if (isCacheHit) {
          setCacheHits(prev => prev + 1);
          const latency = 25;
          latencies.current.push(latency);
        } else {
          const latency = 120;
          latencies.current.push(latency);
        }

        // Calculate average latency
        if (latencies.current.length > 0) {
          const avg = latencies.current.reduce((a, b) => a + b, 0) / latencies.current.length;
          setAvgLatency(Math.round(avg));
        }

        // Update edge server stats
        setEdges(prev => prev.map(edge => {
          if (edge.id === randomEdge.id) {
            return {
              ...edge,
              activeRequests: edge.activeRequests + 1,
              cacheHitRate: isCacheHit ? edge.cacheHitRate + 1 : edge.cacheHitRate,
            };
          }
          return edge;
        }));

        // Remove request after animation
        setTimeout(() => {
          setRequests(prev => prev.filter(r => r.id !== newRequest.id));
          setEdges(prev => prev.map(edge => {
            if (edge.id === randomEdge.id) {
              return { ...edge, activeRequests: Math.max(0, edge.activeRequests - 1) };
            }
            return edge;
          }));
        }, 1000);
      }

      animationRef.current = requestAnimationFrame(simulate);
    };

    simulate();
  };

  const handleReset = () => {
    setIsRunning(false);
    setRequests([]);
    setTotalRequests(0);
    setCacheHits(0);
    setAvgLatency(0);
    setEdges(EDGE_LOCATIONS);
    latencies.current = [];
  };

  if (!mounted) return null;

  const cacheHitRate = totalRequests > 0 ? ((cacheHits / totalRequests) * 100).toFixed(1) : '0.0';

  return (
    <div className="w-full mx-auto px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-6 h-6" />
            CDN Workflow Simulator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setIsRunning(!isRunning)}
              variant={isRunning ? 'destructive' : 'default'}
              size="lg"
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Simulation
                </>
              )}
            </Button>
            <Button onClick={handleReset} variant="outline" size="lg">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>

          {/* Metrics Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Total Requests</div>
                <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{totalRequests}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="text-sm text-green-700 dark:text-green-300 mb-1">Cache Hit Rate</div>
                <div className="text-3xl font-bold text-green-900 dark:text-green-100">{cacheHitRate}%</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4">
                <div className="text-sm text-purple-700 dark:text-purple-300 mb-1">Avg Latency</div>
                <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">{avgLatency}ms</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
              <CardContent className="p-4">
                <div className="text-sm text-orange-700 dark:text-orange-300 mb-1">Cache Hits</div>
                <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">{cacheHits}</div>
              </CardContent>
            </Card>
          </div>

          {/* Visualization */}
          <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg border-2 border-slate-200 dark:border-slate-700 h-[500px]">
            {/* Edge Servers */}
            {edges.map((edge) => (
              <div
                key={`edge-${edge.id}`}
                className="absolute"
                style={{
                  left: `${edge.x}%`,
                  top: `${edge.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <motion.div
                  animate={{
                    scale: edge.activeRequests > 0 ? [1, 1.1, 1] : 1,
                  }}
                  transition={{ duration: 0.5, repeat: edge.activeRequests > 0 ? Infinity : 0 }}
                  className="flex flex-col items-center"
                >
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg">
                      <Zap className="w-8 h-8 text-white" />
                    </div>
                    {edge.activeRequests > 0 && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {edge.activeRequests}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-center bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow border border-slate-200 dark:border-slate-700">
                    {edge.name}
                  </div>
                </motion.div>
              </div>
            ))}

            {/* Origin Server */}
            <div
              className="absolute"
              style={{
                left: `${ORIGIN.x}%`,
                top: `${ORIGIN.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-xl">
                  <Server className="w-10 h-10 text-white" />
                </div>
                <div className="mt-2 text-sm font-semibold text-center bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow border border-slate-200 dark:border-slate-700">
                  {ORIGIN.name}
                </div>
              </div>
            </div>

            {/* Request Animations */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <AnimatePresence>
                {requests.map((request) => {
                  const containerWidth = 1000;
                  const containerHeight = 500;
                  return (
                    <motion.line
                      key={request.id}
                      x1={`${request.fromX}%`}
                      y1={`${request.fromY}%`}
                      x2={`${request.toX}%`}
                      y2={`${request.toY}%`}
                      stroke={request.cacheHit ? '#10b981' : '#ef4444'}
                      strokeWidth="3"
                      strokeDasharray="5,5"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: [0, 1, 0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8, ease: 'easeInOut' }}
                    />
                  );
                })}
              </AnimatePresence>
            </svg>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Cache Hit (Fast - ~25ms)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Cache Miss (Slow - ~120ms)</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-500" />
              <span>Edge Server</span>
            </div>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-500" />
              <span>Origin Server</span>
            </div>
          </div>

          {/* Educational Insight */}
          {isRunning && totalRequests > 5 && (
            <Alert className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/40 dark:to-orange-950/40 border-yellow-300 dark:border-yellow-700">
              <Info className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <AlertDescription className="text-sm">
                <strong className="text-yellow-900 dark:text-yellow-100">💡 Real-time Insight:</strong>
                <span className="text-yellow-800 dark:text-yellow-200 ml-2">
                  {cacheHitRate >= 70 ? (
                    `With ${cacheHitRate}% cache hit rate, your CDN is handling most requests at the edge! 
                     This reduces origin load and improves response times by ~${Math.round(120 - avgLatency)}ms per request. 🎉`
                  ) : cacheHitRate >= 50 ? (
                    `Cache hit rate at ${cacheHitRate}%. More green lines = faster responses and lower origin load.`
                  ) : (
                    `Low cache hit rate (${cacheHitRate}%). In production, optimize cache-control headers to improve this.`
                  )}
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Educational Info */}
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              <strong>How it works:</strong> Requests automatically flow to edge servers distributed globally. 
              <span className="text-green-600 dark:text-green-400 font-semibold"> Green lines</span> show cache hits (content served directly from edge), 
              <span className="text-red-600 dark:text-red-400 font-semibold"> red lines</span> show cache misses (edge fetches from origin). 
              CDNs reduce latency and protect origin servers from overload.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
