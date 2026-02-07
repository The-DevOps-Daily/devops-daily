'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  RotateCcw,
  Database,
  HardDrive,
  Zap,
  Clock,
  Trash2,
  Plus,
  Search,
  Edit,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'random' | 'ttl';
type WriteStrategy = 'write-through' | 'write-back' | 'write-around';
type AccessPattern = 'random' | 'sequential' | 'zipf';

interface CacheItem {
  key: string;
  value: string;
  accessCount: number;
  lastAccess: number;
  insertTime: number;
  ttl: number;
  expiresAt: number;
}

interface RequestAnimation {
  id: string;
  key: string;
  type: 'read' | 'write';
  phase: 'to-cache' | 'hit' | 'miss-to-db' | 'db-to-cache' | 'complete';
  isHit: boolean;
}

interface Stats {
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
  timeSavedMs: number;
}

// Configuration
const EVICTION_POLICIES: Record<EvictionPolicy, { name: string; description: string }> = {
  lru: {
    name: 'LRU (Least Recently Used)',
    description: 'Evicts items not accessed recently. Most common in practice.',
  },
  lfu: {
    name: 'LFU (Least Frequently Used)',
    description: 'Evicts items accessed least often. Good for identifying hot data.',
  },
  fifo: {
    name: 'FIFO (First In, First Out)',
    description: 'Evicts oldest items first. Simple queue-based approach.',
  },
  random: {
    name: 'Random',
    description: 'Randomly selects items to evict. Surprisingly effective.',
  },
  ttl: {
    name: 'TTL (Time To Live)',
    description: 'Evicts expired items based on time. Common for sessions.',
  },
};

const WRITE_STRATEGIES: Record<WriteStrategy, { name: string; description: string }> = {
  'write-through': {
    name: 'Write-Through',
    description: 'Write to cache and database simultaneously. Strong consistency.',
  },
  'write-back': {
    name: 'Write-Back',
    description: 'Write to cache, async to database. Better performance.',
  },
  'write-around': {
    name: 'Write-Around',
    description: 'Write directly to database, bypass cache. Reduces cache pollution.',
  },
};

const TRAFFIC_RATES = [
  { label: 'Slow', value: 2000 },
  { label: 'Normal', value: 1000 },
  { label: 'Fast', value: 500 },
  { label: 'Burst', value: 200 },
];

const CACHE_LATENCY_MS = 5;
const DB_LATENCY_MS = 100;

// Sample data keys (simulating user data)
const DATA_KEYS = [
  'user:1',
  'user:2',
  'user:3',
  'user:4',
  'user:5',
  'session:abc',
  'session:def',
  'session:ghi',
  'product:100',
  'product:101',
  'product:102',
  'cart:user1',
  'cart:user2',
  'config:app',
  'config:db',
];

// Generate Zipf distribution weights (hot keys accessed more frequently)
function generateZipfWeights(n: number): number[] {
  const weights: number[] = [];
  let sum = 0;
  for (let i = 1; i <= n; i++) {
    weights.push(1 / i);
    sum += 1 / i;
  }
  return weights.map((w) => w / sum);
}

const ZIPF_WEIGHTS = generateZipfWeights(DATA_KEYS.length);

export default function CachingSimulator() {
  // State
  const [cache, setCache] = useState<Map<string, CacheItem>>(new Map());
  const [cacheSize, setCacheSize] = useState(8);
  const [evictionPolicy, setEvictionPolicy] = useState<EvictionPolicy>('lru');
  const [writeStrategy, setWriteStrategy] = useState<WriteStrategy>('write-through');
  const [accessPattern, setAccessPattern] = useState<AccessPattern>('zipf');
  const [ttlSeconds, setTtlSeconds] = useState(30);
  const [isRunning, setIsRunning] = useState(false);
  const [trafficRate, setTrafficRate] = useState(1000);
  const [stats, setStats] = useState<Stats>({
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0,
    timeSavedMs: 0,
  });
  const [animations, setAnimations] = useState<RequestAnimation[]>([]);
  const [lastOperation, setLastOperation] = useState<string | null>(null);
  const tickRef = useRef(0);

  // Derived state
  const hitRate = useMemo(() => {
    if (stats.totalRequests === 0) return 0;
    return ((stats.hits / stats.totalRequests) * 100).toFixed(1);
  }, [stats]);

  const cacheArray = useMemo(() => Array.from(cache.entries()), [cache]);

  // Select key based on access pattern
  const selectKey = useCallback((): string => {
    switch (accessPattern) {
      case 'sequential':
        return DATA_KEYS[tickRef.current % DATA_KEYS.length];
      case 'zipf': {
        const rand = Math.random();
        let cumulative = 0;
        for (let i = 0; i < ZIPF_WEIGHTS.length; i++) {
          cumulative += ZIPF_WEIGHTS[i];
          if (rand <= cumulative) return DATA_KEYS[i];
        }
        return DATA_KEYS[0];
      }
      default:
        return DATA_KEYS[Math.floor(Math.random() * DATA_KEYS.length)];
    }
  }, [accessPattern]);

  // Find item to evict based on policy
  const findEvictionCandidate = useCallback(
    (currentCache: Map<string, CacheItem>): string | null => {
      if (currentCache.size === 0) return null;

      const entries = Array.from(currentCache.entries());

      switch (evictionPolicy) {
        case 'lru': {
          let oldest = entries[0];
          for (const entry of entries) {
            if (entry[1].lastAccess < oldest[1].lastAccess) {
              oldest = entry;
            }
          }
          return oldest[0];
        }
        case 'lfu': {
          let leastFrequent = entries[0];
          for (const entry of entries) {
            if (entry[1].accessCount < leastFrequent[1].accessCount) {
              leastFrequent = entry;
            }
          }
          return leastFrequent[0];
        }
        case 'fifo': {
          let oldest = entries[0];
          for (const entry of entries) {
            if (entry[1].insertTime < oldest[1].insertTime) {
              oldest = entry;
            }
          }
          return oldest[0];
        }
        case 'ttl': {
          const now = Date.now();
          const expired = entries.find((e) => e[1].expiresAt <= now);
          if (expired) return expired[0];
          let soonestExpiry = entries[0];
          for (const entry of entries) {
            if (entry[1].expiresAt < soonestExpiry[1].expiresAt) {
              soonestExpiry = entry;
            }
          }
          return soonestExpiry[0];
        }
        case 'random':
        default:
          return entries[Math.floor(Math.random() * entries.length)][0];
      }
    },
    [evictionPolicy]
  );

  // Process a read request
  const processRead = useCallback(
    (key: string) => {
      const animId = `${Date.now()}-${Math.random()}`;
      const now = Date.now();

      setCache((prevCache) => {
        const newCache = new Map(prevCache);
        const item = newCache.get(key);

        if (item && (evictionPolicy !== 'ttl' || item.expiresAt > now)) {
          // Cache hit
          newCache.set(key, {
            ...item,
            accessCount: item.accessCount + 1,
            lastAccess: now,
          });

          setStats((s) => ({
            ...s,
            hits: s.hits + 1,
            totalRequests: s.totalRequests + 1,
            timeSavedMs: s.timeSavedMs + (DB_LATENCY_MS - CACHE_LATENCY_MS),
          }));

          setAnimations((prev) => [
            ...prev,
            { id: animId, key, type: 'read', phase: 'hit', isHit: true },
          ]);
          setLastOperation(`HIT: ${key} (${CACHE_LATENCY_MS}ms)`);
        } else {
          // Cache miss - need to evict if full
          if (newCache.size >= cacheSize) {
            const evictKey = findEvictionCandidate(newCache);
            if (evictKey) {
              newCache.delete(evictKey);
              setStats((s) => ({ ...s, evictions: s.evictions + 1 }));
            }
          }

          // Add new item from "database"
          newCache.set(key, {
            key,
            value: `data_${key}`,
            accessCount: 1,
            lastAccess: now,
            insertTime: now,
            ttl: ttlSeconds * 1000,
            expiresAt: now + ttlSeconds * 1000,
          });

          setStats((s) => ({
            ...s,
            misses: s.misses + 1,
            totalRequests: s.totalRequests + 1,
          }));

          setAnimations((prev) => [
            ...prev,
            { id: animId, key, type: 'read', phase: 'miss-to-db', isHit: false },
          ]);
          setLastOperation(`MISS: ${key} (${DB_LATENCY_MS}ms)`);
        }

        return newCache;
      });

      // Clear animation after delay
      setTimeout(() => {
        setAnimations((prev) => prev.filter((a) => a.id !== animId));
      }, 800);
    },
    [cacheSize, evictionPolicy, ttlSeconds, findEvictionCandidate]
  );

  // Process a write request
  const processWrite = useCallback(
    (key: string) => {
      const animId = `${Date.now()}-${Math.random()}`;
      const now = Date.now();

      setAnimations((prev) => [
        ...prev,
        { id: animId, key, type: 'write', phase: 'to-cache', isHit: false },
      ]);

      if (writeStrategy === 'write-around') {
        // Write-around: only write to DB, invalidate cache
        setCache((prevCache) => {
          const newCache = new Map(prevCache);
          newCache.delete(key);
          return newCache;
        });
        setLastOperation(`WRITE-AROUND: ${key} (DB only)`);
      } else {
        // Write-through or write-back: update cache
        setCache((prevCache) => {
          const newCache = new Map(prevCache);

          if (newCache.size >= cacheSize && !newCache.has(key)) {
            const evictKey = findEvictionCandidate(newCache);
            if (evictKey) {
              newCache.delete(evictKey);
              setStats((s) => ({ ...s, evictions: s.evictions + 1 }));
            }
          }

          const existing = newCache.get(key);
          newCache.set(key, {
            key,
            value: `updated_${key}_${now}`,
            accessCount: existing ? existing.accessCount + 1 : 1,
            lastAccess: now,
            insertTime: existing ? existing.insertTime : now,
            ttl: ttlSeconds * 1000,
            expiresAt: now + ttlSeconds * 1000,
          });

          return newCache;
        });

        const strategyLabel = writeStrategy === 'write-through' ? 'WRITE-THROUGH' : 'WRITE-BACK';
        setLastOperation(`${strategyLabel}: ${key}`);
      }

      setStats((s) => ({ ...s, totalRequests: s.totalRequests + 1 }));

      setTimeout(() => {
        setAnimations((prev) => prev.filter((a) => a.id !== animId));
      }, 800);
    },
    [writeStrategy, cacheSize, ttlSeconds, findEvictionCandidate]
  );

  // Auto-run traffic
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      tickRef.current++;
      const key = selectKey();
      // 80% reads, 20% writes
      if (Math.random() < 0.8) {
        processRead(key);
      } else {
        processWrite(key);
      }
    }, trafficRate);

    return () => clearInterval(interval);
  }, [isRunning, trafficRate, selectKey, processRead, processWrite]);

  // Reset
  const handleReset = () => {
    setIsRunning(false);
    setCache(new Map());
    setStats({ hits: 0, misses: 0, evictions: 0, totalRequests: 0, timeSavedMs: 0 });
    setAnimations([]);
    setLastOperation(null);
    tickRef.current = 0;
  };

  // Manual operations
  const handleManualRead = (key: string) => {
    processRead(key);
  };

  const handleManualWrite = (key: string) => {
    processWrite(key);
  };

  const handleClearCache = () => {
    setCache(new Map());
    setLastOperation('Cache cleared');
  };

  const handleInvalidateKey = (key: string) => {
    setCache((prevCache) => {
      const newCache = new Map(prevCache);
      newCache.delete(key);
      return newCache;
    });
    setLastOperation(`Invalidated: ${key}`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
          Caching Strategies Simulator
        </h1>
        <p className="text-muted-foreground">
          Learn how caching works with different eviction policies and write strategies
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Cache Size */}
            <div>
              <label className="text-sm font-medium mb-2 block">Cache Size: {cacheSize}</label>
              <input
                type="range"
                min="4"
                max="16"
                value={cacheSize}
                onChange={(e) => setCacheSize(Number(e.target.value))}
                className="w-full"
                disabled={isRunning}
              />
            </div>

            {/* Eviction Policy */}
            <div>
              <label className="text-sm font-medium mb-2 block">Eviction Policy</label>
              <select
                value={evictionPolicy}
                onChange={(e) => setEvictionPolicy(e.target.value as EvictionPolicy)}
                className="w-full p-2 rounded border bg-background"
                disabled={isRunning}
              >
                {Object.entries(EVICTION_POLICIES).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Write Strategy */}
            <div>
              <label className="text-sm font-medium mb-2 block">Write Strategy</label>
              <select
                value={writeStrategy}
                onChange={(e) => setWriteStrategy(e.target.value as WriteStrategy)}
                className="w-full p-2 rounded border bg-background"
                disabled={isRunning}
              >
                {Object.entries(WRITE_STRATEGIES).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Access Pattern */}
            <div>
              <label className="text-sm font-medium mb-2 block">Access Pattern</label>
              <select
                value={accessPattern}
                onChange={(e) => setAccessPattern(e.target.value as AccessPattern)}
                className="w-full p-2 rounded border bg-background"
                disabled={isRunning}
              >
                <option value="zipf">Zipf (Hot Keys)</option>
                <option value="random">Random</option>
                <option value="sequential">Sequential</option>
              </select>
            </div>
          </div>

          {/* TTL for TTL policy */}
          {evictionPolicy === 'ttl' && (
            <div className="mt-4">
              <label className="text-sm font-medium mb-2 block">TTL: {ttlSeconds}s</label>
              <input
                type="range"
                min="5"
                max="60"
                value={ttlSeconds}
                onChange={(e) => setTtlSeconds(Number(e.target.value))}
                className="w-full max-w-xs"
                disabled={isRunning}
              />
            </div>
          )}

          {/* Policy Description */}
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-purple-500" />
              <span className="font-medium">Policy:</span>
              <span className="text-muted-foreground">
                {EVICTION_POLICIES[evictionPolicy].description}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-1">
              <Edit className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Write:</span>
              <span className="text-muted-foreground">
                {WRITE_STRATEGIES[writeStrategy].description}
              </span>
            </div>
          </div>

          {/* Traffic Controls */}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Traffic Rate:</span>
              <div className="flex gap-1">
                {TRAFFIC_RATES.map((rate) => (
                  <Button
                    key={rate.value}
                    variant={trafficRate === rate.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTrafficRate(rate.value)}
                  >
                    {rate.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setIsRunning(!isRunning)}
                variant={isRunning ? 'destructive' : 'default'}
              >
                {isRunning ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {isRunning ? 'Pause' : 'Start'}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button variant="outline" onClick={handleClearCache}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Cache
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cache Visualization */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-purple-500" />
              Cache ({cache.size}/{cacheSize} items)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Cache Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-h-[200px]">
              <AnimatePresence mode="popLayout">
                {cacheArray.map(([key, item]) => (
                  <motion.div
                    key={key}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                    className="relative p-2 rounded-lg border bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30"
                  >
                    <div className="text-xs font-mono font-bold truncate">{item.key}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{item.value}</div>
                    <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
                      <span>Hits: {item.accessCount}</span>
                      {evictionPolicy === 'ttl' && (
                        <span className="text-orange-500">
                          TTL: {Math.max(0, Math.round((item.expiresAt - Date.now()) / 1000))}s
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleInvalidateKey(key)}
                      className="absolute top-1 right-1 opacity-50 hover:opacity-100 text-red-500"
                      title="Invalidate"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Empty slots */}
              {Array.from({ length: Math.max(0, cacheSize - cache.size) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="p-2 rounded-lg border border-dashed border-muted-foreground/20 flex items-center justify-center text-xs text-muted-foreground"
                >
                  Empty
                </div>
              ))}
            </div>

            {/* Last Operation */}
            {lastOperation && (
              <motion.div
                key={lastOperation}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-2 rounded text-sm font-mono text-center ${
                  lastOperation.includes('HIT')
                    ? 'bg-green-500/20 text-green-600'
                    : lastOperation.includes('MISS')
                      ? 'bg-red-500/20 text-red-600'
                      : 'bg-blue-500/20 text-blue-600'
                }`}
              >
                {lastOperation}
              </motion.div>
            )}

            {/* Request Animations */}
            <AnimatePresence>
              {animations.map((anim) => (
                <motion.div
                  key={anim.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 rounded-full text-xs font-bold ${
                    anim.isHit ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}
                >
                  {anim.isHit ? 'HIT!' : 'MISS'}
                </motion.div>
              ))}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Stats Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hit Rate Gauge */}
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-500">{hitRate}%</div>
              <div className="text-sm text-muted-foreground">Hit Rate</div>
              <div className="mt-2 h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all"
                  style={{ width: `${hitRate}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0%</span>
                <span className="text-green-500">Target: 80%+</span>
                <span>100%</span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-green-500/10 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{stats.hits}</div>
                <div className="text-xs text-muted-foreground">Cache Hits</div>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">{stats.misses}</div>
                <div className="text-xs text-muted-foreground">Cache Misses</div>
              </div>
              <div className="p-3 bg-orange-500/10 rounded-lg text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.evictions}</div>
                <div className="text-xs text-muted-foreground">Evictions</div>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalRequests}</div>
                <div className="text-xs text-muted-foreground">Total Requests</div>
              </div>
            </div>

            {/* Time Saved */}
            <div className="p-3 bg-purple-500/10 rounded-lg text-center">
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-5 w-5 text-purple-500" />
                <span className="text-2xl font-bold text-purple-600">
                  {(stats.timeSavedMs / 1000).toFixed(2)}s
                </span>
              </div>
              <div className="text-xs text-muted-foreground">Time Saved by Caching</div>
            </div>

            {/* Latency Comparison */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Latency Comparison</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-16">Cache:</span>
                <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: '5%' }} />
                </div>
                <span className="text-green-600">{CACHE_LATENCY_MS}ms</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-16">Database:</span>
                <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: '100%' }} />
                </div>
                <span className="text-red-600">{DB_LATENCY_MS}ms</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual Operations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Manual Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {DATA_KEYS.slice(0, 10).map((key) => (
              <div key={key} className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleManualRead(key)}
                  className="text-xs"
                >
                  <Search className="h-3 w-3 mr-1" />
                  {key}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleManualWrite(key)}
                  className="text-xs text-blue-500"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
