'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, Database, HardDrive, Zap, Clock, TrendingUp, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type EvictionPolicy = 'lru' | 'fifo' | 'lfu';

interface CacheItem {
  key: string;
  accessCount: number;
  lastAccess: number;
  insertTime: number;
}

interface RequestAnimation {
  id: string;
  key: string;
  phase: 'checking' | 'hit' | 'miss-fetching' | 'storing' | 'complete';
  isHit: boolean;
}

interface RequestStep {
  step: number;
  label: string;
  status: 'pending' | 'active' | 'done';
  time?: number;
}

const EVICTION_POLICIES: Record<EvictionPolicy, { name: string; description: string; how: string }> = {
  lru: {
    name: 'LRU',
    description: 'Least Recently Used',
    how: 'Removes the item that was accessed longest ago',
  },
  fifo: {
    name: 'FIFO',
    description: 'First In, First Out',
    how: 'Removes the oldest item in cache (like a queue)',
  },
  lfu: {
    name: 'LFU',
    description: 'Least Frequently Used',
    how: 'Removes the item accessed the fewest times',
  },
};

const DATA_ITEMS = [
  { key: 'A', label: 'User Profile', color: 'bg-blue-500' },
  { key: 'B', label: 'Product List', color: 'bg-green-500' },
  { key: 'C', label: 'Settings', color: 'bg-purple-500' },
  { key: 'D', label: 'Dashboard', color: 'bg-orange-500' },
  { key: 'E', label: 'Messages', color: 'bg-pink-500' },
  { key: 'F', label: 'Analytics', color: 'bg-cyan-500' },
];

const CACHE_SIZE = 4;
const CACHE_LATENCY = 5;
const DB_LATENCY = 100;

export default function CachingSimulator() {
  const [policy, setPolicy] = useState<EvictionPolicy>('lru');
  const [cache, setCache] = useState<CacheItem[]>([]);
  const [animation, setAnimation] = useState<RequestAnimation | null>(null);
  const [stats, setStats] = useState({ hits: 0, misses: 0, totalTime: 0 });
  const [evictingKey, setEvictingKey] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [requestSteps, setRequestSteps] = useState<RequestStep[]>([]);
  const [lastResult, setLastResult] = useState<{ isHit: boolean; time: number; key: string } | null>(null);

  const getItemToEvict = useCallback((currentCache: CacheItem[]): CacheItem | null => {
    if (currentCache.length < CACHE_SIZE) return null;

    switch (policy) {
      case 'lru':
        return currentCache.reduce((oldest, item) =>
          item.lastAccess < oldest.lastAccess ? item : oldest
        );
      case 'fifo':
        return currentCache.reduce((oldest, item) =>
          item.insertTime < oldest.insertTime ? item : oldest
        );
      case 'lfu':
        return currentCache.reduce((leastFreq, item) =>
          item.accessCount < leastFreq.accessCount ? item : leastFreq
        );
      default:
        return currentCache[0];
    }
  }, [policy]);

  const handleRequest = useCallback((key: string) => {
    if (animation) return;

    const requestId = `req-${Date.now()}`;
    const currentTick = tick + 1;
    setTick(currentTick);
    setLastResult(null);

    const cachedItem = cache.find((item) => item.key === key);
    const isHit = !!cachedItem;

    setAnimation({ id: requestId, key, phase: 'checking', isHit });

    if (isHit) {
      // Cache HIT - show 2-step process
      setRequestSteps([
        { step: 1, label: 'Check cache for data', status: 'active' },
        { step: 2, label: 'Return from cache', status: 'pending', time: CACHE_LATENCY },
      ]);

      setTimeout(() => {
        setRequestSteps([
          { step: 1, label: 'Check cache for data', status: 'done' },
          { step: 2, label: 'Found! Return from cache', status: 'active', time: CACHE_LATENCY },
        ]);
        setAnimation((prev) => prev && { ...prev, phase: 'hit' });

        setCache((prev) =>
          prev.map((item) =>
            item.key === key
              ? { ...item, accessCount: item.accessCount + 1, lastAccess: currentTick }
              : item
          )
        );

        setStats((prev) => ({
          ...prev,
          hits: prev.hits + 1,
          totalTime: prev.totalTime + CACHE_LATENCY,
        }));
      }, 400);

      setTimeout(() => {
        setRequestSteps([
          { step: 1, label: 'Check cache for data', status: 'done' },
          { step: 2, label: 'Found! Return from cache', status: 'done', time: CACHE_LATENCY },
        ]);
        setLastResult({ isHit: true, time: CACHE_LATENCY, key });
        setAnimation(null);
      }, 1200);
    } else {
      // Cache MISS - show 4-step process
      const toEvict = getItemToEvict(cache);
      const needsEviction = cache.length >= CACHE_SIZE;

      setRequestSteps([
        { step: 1, label: 'Check cache for data', status: 'active' },
        { step: 2, label: 'Fetch from database', status: 'pending', time: DB_LATENCY },
        ...(needsEviction ? [{ step: 3, label: `Evict "${toEvict?.key}" to make room`, status: 'pending' as const }] : []),
        { step: needsEviction ? 4 : 3, label: 'Store in cache for next time', status: 'pending' as const },
      ]);

      setTimeout(() => {
        setRequestSteps((prev) => prev.map((s, i) =>
          i === 0 ? { ...s, status: 'done', label: 'Not in cache!' }
          : i === 1 ? { ...s, status: 'active' }
          : s
        ));
        setAnimation((prev) => prev && { ...prev, phase: 'miss-fetching' });
      }, 400);

      setTimeout(() => {
        if (needsEviction && toEvict) {
          setEvictingKey(toEvict.key);
          setRequestSteps((prev) => prev.map((s, i) =>
            i === 1 ? { ...s, status: 'done' }
            : i === 2 ? { ...s, status: 'active' }
            : s
          ));
        } else {
          setRequestSteps((prev) => prev.map((s, i) =>
            i === 1 ? { ...s, status: 'done' }
            : i === 2 ? { ...s, status: 'active' }
            : s
          ));
        }
      }, 800);

      setTimeout(() => {
        setAnimation((prev) => prev && { ...prev, phase: 'storing' });

        setCache((prev) => {
          const toEvictNow = getItemToEvict(prev);
          const filtered = toEvictNow ? prev.filter((item) => item.key !== toEvictNow.key) : prev;
          return [
            ...filtered,
            { key, accessCount: 1, lastAccess: currentTick, insertTime: currentTick },
          ];
        });

        setEvictingKey(null);
        setRequestSteps((prev) => prev.map((s) => ({ ...s, status: 'done' as const })));

        setStats((prev) => ({
          ...prev,
          misses: prev.misses + 1,
          totalTime: prev.totalTime + DB_LATENCY,
        }));
      }, 1200);

      setTimeout(() => {
        setLastResult({ isHit: false, time: DB_LATENCY, key });
        setAnimation(null);
      }, 1800);
    }
  }, [animation, cache, getItemToEvict, policy, tick]);

  const reset = () => {
    setCache([]);
    setAnimation(null);
    setStats({ hits: 0, misses: 0, totalTime: 0 });
    setEvictingKey(null);
    setTick(0);
    setRequestSteps([]);
    setLastResult(null);
  };

  const hitRate = stats.hits + stats.misses > 0
    ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1)
    : '0.0';

  const getItemColor = (key: string) =>
    DATA_ITEMS.find((item) => item.key === key)?.color || 'bg-gray-500';

  const getItemLabel = (key: string) =>
    DATA_ITEMS.find((item) => item.key === key)?.label || key;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Policy Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Eviction Policy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(EVICTION_POLICIES) as EvictionPolicy[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  if (!animation) {
                    setPolicy(p);
                    reset();
                  }
                }}
                className={cn(
                  'p-3 rounded-lg border-2 transition-all text-left',
                  policy === p
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <div className="font-bold text-sm">{EVICTION_POLICIES[p].name}</div>
                <div className="text-xs text-muted-foreground">
                  {EVICTION_POLICIES[p].description}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
            <strong>{EVICTION_POLICIES[policy].name}:</strong> {EVICTION_POLICIES[policy].how}
          </p>
        </CardContent>
      </Card>

      {/* Main Visualization */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Cache Simulator</CardTitle>
            <Button variant="outline" size="sm" onClick={reset} disabled={!!animation}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Request Buttons */}
          <div>
            <div className="text-sm font-medium mb-2 text-muted-foreground">
              Click to request data:
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {DATA_ITEMS.map((item) => (
                <Button
                  key={item.key}
                  variant="outline"
                  onClick={() => handleRequest(item.key)}
                  disabled={!!animation}
                  className={cn(
                    'flex flex-col items-center py-3 h-auto',
                    cache.some((c) => c.key === item.key) && 'ring-2 ring-green-500'
                  )}
                >
                  <span
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-white font-bold mb-1',
                      item.color
                    )}
                  >
                    {item.key}
                  </span>
                  <span className="text-xs text-muted-foreground truncate w-full text-center">
                    {item.label}
                  </span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Items with green ring are in cache
            </p>
          </div>

          {/* Visual Flow */}
          <div className="relative h-32 bg-muted/30 rounded-lg overflow-hidden">
            {/* Database */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center">
              <div className="w-12 h-12 bg-slate-600 rounded-lg flex items-center justify-center">
                <Database className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs mt-1 text-muted-foreground">Database</span>
              <span className="text-xs text-red-500 font-medium">Slow ({DB_LATENCY}ms)</span>
            </div>

            {/* Cache */}
            <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2">
              <div className="flex flex-col items-center">
                <div className="flex gap-1 p-2 bg-emerald-500/20 rounded-lg border-2 border-emerald-500">
                  {Array.from({ length: CACHE_SIZE }).map((_, i) => {
                    const item = cache[i];
                    return (
                      <div
                        key={i}
                        className={cn(
                          'w-10 h-10 rounded flex items-center justify-center text-white font-bold text-sm transition-all',
                          item
                            ? cn(
                                getItemColor(item.key),
                                evictingKey === item.key && 'animate-pulse ring-2 ring-red-500'
                              )
                            : 'bg-gray-300 dark:bg-gray-700'
                        )}
                      >
                        {item ? item.key : '-'}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <HardDrive className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Fast ({CACHE_LATENCY}ms)</span>
                </div>
              </div>
            </div>

            {/* App/User */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs mt-1 text-muted-foreground">Your App</span>
            </div>

            {/* Animated Request */}
            <AnimatePresence>
              {animation && (
                <motion.div
                  key={animation.id}
                  className={cn(
                    'absolute w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm z-10',
                    getItemColor(animation.key)
                  )}
                  initial={{ right: 16, top: '50%', y: '-50%' }}
                  animate={{
                    right:
                      animation.phase === 'checking'
                        ? '50%'
                        : animation.phase === 'hit'
                          ? 16
                          : animation.phase === 'miss-fetching'
                            ? 'calc(100% - 64px)'
                            : animation.phase === 'storing'
                              ? '50%'
                              : 16,
                    x: animation.phase === 'checking' || animation.phase === 'storing' ? '50%' : 0,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {animation.key}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Step-by-step Status Window */}
          <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm">
            <div className="flex items-center gap-2 mb-3 text-slate-400 text-xs">
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span>Request Log</span>
            </div>

            {requestSteps.length === 0 ? (
              <div className="text-slate-500">
                <span className="text-green-400">$</span> Click a data item to see how caching works...
              </div>
            ) : (
              <div className="space-y-2">
                {requestSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {step.status === 'done' ? (
                      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    ) : step.status === 'active' ? (
                      <motion.div
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="w-4 h-4 rounded-full bg-yellow-400 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-slate-600 flex-shrink-0" />
                    )}
                    <span className={cn(
                      step.status === 'done' ? 'text-green-400' :
                      step.status === 'active' ? 'text-yellow-400' :
                      'text-slate-500'
                    )}>
                      {step.label}
                    </span>
                    {step.time && (
                      <span className={cn(
                        'ml-auto',
                        step.time === CACHE_LATENCY ? 'text-green-400' : 'text-red-400'
                      )}>
                        +{step.time}ms
                      </span>
                    )}
                  </div>
                ))}

                {/* Result summary */}
                {lastResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'mt-3 pt-3 border-t border-slate-700 flex items-center gap-2',
                      lastResult.isHit ? 'text-green-400' : 'text-amber-400'
                    )}
                  >
                    {lastResult.isHit ? (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        <span>CACHE HIT!</span>
                        <ArrowRight className="h-4 w-4" />
                        <span className="text-green-300">
                          {lastResult.time}ms (20x faster than database!)
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5" />
                        <span>CACHE MISS</span>
                        <ArrowRight className="h-4 w-4" />
                        <span className="text-amber-300">
                          {lastResult.time}ms (but now "{lastResult.key}" is cached for next time!)
                        </span>
                      </>
                    )}
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats & Cache Details */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Performance Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-500/10 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.hits}
                </div>
                <div className="text-xs text-muted-foreground">Cache Hits</div>
              </div>
              <div className="text-center p-3 bg-amber-500/10 rounded-lg">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {stats.misses}
                </div>
                <div className="text-xs text-muted-foreground">Cache Misses</div>
              </div>
              <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {hitRate}%
                </div>
                <div className="text-xs text-muted-foreground">Hit Rate</div>
              </div>
              <div className="text-center p-3 bg-purple-500/10 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.totalTime}ms
                </div>
                <div className="text-xs text-muted-foreground">Total Time</div>
              </div>
            </div>
            {stats.hits + stats.misses > 0 && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <div className="text-sm font-medium mb-2">Time Comparison</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24">With cache:</span>
                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <motion.div
                        className="h-full bg-green-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((stats.totalTime / ((stats.hits + stats.misses) * DB_LATENCY)) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-green-600 dark:text-green-400 w-16 text-right">
                      {stats.totalTime}ms
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24">Without cache:</span>
                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <div className="h-full bg-red-500 w-full" />
                    </div>
                    <span className="text-xs font-medium text-red-600 dark:text-red-400 w-16 text-right">
                      {(stats.hits + stats.misses) * DB_LATENCY}ms
                    </span>
                  </div>
                </div>
                <p className="text-xs text-center mt-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  You saved {(stats.hits + stats.misses) * DB_LATENCY - stats.totalTime}ms with caching!
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cache Contents */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-500" />
              Cache Contents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cache.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                Cache is empty. Request some data!
              </p>
            ) : (
              <div className="space-y-2">
                {cache.map((item) => (
                  <div
                    key={item.key}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg bg-muted/50',
                      evictingKey === item.key && 'ring-2 ring-red-500 animate-pulse'
                    )}
                  >
                    <span
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm',
                        getItemColor(item.key)
                      )}
                    >
                      {item.key}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{getItemLabel(item.key)}</div>
                      <div className="text-xs text-muted-foreground">
                        Accessed: {item.accessCount}x | Last: #{item.lastAccess} | Added: #{item.insertTime}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Educational Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Why Use Caching?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              <div className="font-medium text-red-600 dark:text-red-400 mb-1">Without Cache</div>
              <p>Every request goes to the database ({DB_LATENCY}ms each time). Slow and expensive!</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="font-medium text-green-600 dark:text-green-400 mb-1">With Cache</div>
              <p>Repeated requests return instantly ({CACHE_LATENCY}ms). 20x faster!</p>
            </div>
          </div>
          <p>
            The <strong>eviction policy</strong> decides what to remove when the cache is full.
            Try requesting the same items multiple times to see your hit rate improve!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
