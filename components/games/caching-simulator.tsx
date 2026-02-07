'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  RotateCcw,
  Database,
  HardDrive,
  Zap,
  Clock,
  TrendingUp,
  CheckCircle,
  XCircle,
  ArrowDown,
} from 'lucide-react';
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
  shortLabel: string;
  status: 'pending' | 'active' | 'done';
  time?: number;
}

const EVICTION_POLICIES: Record<
  EvictionPolicy,
  { name: string; description: string; shortDesc: string; how: string }
> = {
  lru: {
    name: 'LRU',
    description: 'Least Recently Used',
    shortDesc: 'Least Recent',
    how: 'Removes the item accessed longest ago',
  },
  fifo: {
    name: 'FIFO',
    description: 'First In, First Out',
    shortDesc: 'First In, Out',
    how: 'Removes the oldest item (like a queue)',
  },
  lfu: {
    name: 'LFU',
    description: 'Least Frequently Used',
    shortDesc: 'Least Frequent',
    how: 'Removes the least accessed item',
  },
};

const DATA_ITEMS = [
  { key: 'A', label: 'User Profile', shortLabel: 'User', color: 'bg-blue-500' },
  { key: 'B', label: 'Product List', shortLabel: 'Products', color: 'bg-green-500' },
  { key: 'C', label: 'Settings', shortLabel: 'Settings', color: 'bg-purple-500' },
  { key: 'D', label: 'Dashboard', shortLabel: 'Dash', color: 'bg-orange-500' },
  { key: 'E', label: 'Messages', shortLabel: 'Msgs', color: 'bg-pink-500' },
  { key: 'F', label: 'Analytics', shortLabel: 'Stats', color: 'bg-cyan-500' },
];

const CACHE_SIZE = 4;

const getCacheLatency = () => Math.floor(Math.random() * 9) + 1;
const getDbLatency = () => Math.floor(Math.random() * 150) + 50;

export default function CachingSimulator() {
  const [policy, setPolicy] = useState<EvictionPolicy>('lru');
  const [cache, setCache] = useState<CacheItem[]>([]);
  const [animation, setAnimation] = useState<RequestAnimation | null>(null);
  const [stats, setStats] = useState({ hits: 0, misses: 0, totalTime: 0, withoutCacheTime: 0 });
  const [evictingKey, setEvictingKey] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [requestSteps, setRequestSteps] = useState<RequestStep[]>([]);
  const [lastResult, setLastResult] = useState<{
    isHit: boolean;
    time: number;
    key: string;
  } | null>(null);

  const getItemToEvict = useCallback(
    (currentCache: CacheItem[]): CacheItem | null => {
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
    },
    [policy]
  );

  const handleRequest = useCallback(
    (key: string) => {
      if (animation) return;

      const requestId = `req-${Date.now()}`;
      const currentTick = tick + 1;
      setTick(currentTick);
      setLastResult(null);

      const cacheLatency = getCacheLatency();
      const dbLatency = getDbLatency();

      const cachedItem = cache.find((item) => item.key === key);
      const isHit = !!cachedItem;

      setAnimation({ id: requestId, key, phase: 'checking', isHit });

      if (isHit) {
        setRequestSteps([
          { step: 1, label: 'Check cache for data', shortLabel: 'Check cache', status: 'active' },
          {
            step: 2,
            label: 'Return from cache',
            shortLabel: 'Return',
            status: 'pending',
            time: cacheLatency,
          },
        ]);

        setTimeout(() => {
          setRequestSteps([
            { step: 1, label: 'Check cache for data', shortLabel: 'Found!', status: 'done' },
            {
              step: 2,
              label: 'Found! Return from cache',
              shortLabel: 'Return',
              status: 'active',
              time: cacheLatency,
            },
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
            totalTime: prev.totalTime + cacheLatency,
            withoutCacheTime: prev.withoutCacheTime + dbLatency,
          }));
        }, 300);

        setTimeout(() => {
          setRequestSteps((prev) => prev.map((s) => ({ ...s, status: 'done' as const })));
          setLastResult({ isHit: true, time: cacheLatency, key });
          setAnimation(null);
        }, 800);
      } else {
        setRequestSteps([
          { step: 1, label: 'Check cache', shortLabel: 'Check', status: 'active' },
          {
            step: 2,
            label: 'Fetch from database',
            shortLabel: 'Fetch DB',
            status: 'pending',
            time: dbLatency,
          },
          { step: 3, label: 'Store in cache', shortLabel: 'Store', status: 'pending' },
          { step: 4, label: 'Return data', shortLabel: 'Return', status: 'pending' },
        ]);

        setTimeout(() => {
          setRequestSteps([
            { step: 1, label: 'Not found', shortLabel: 'Miss', status: 'done' },
            {
              step: 2,
              label: 'Fetching from database...',
              shortLabel: 'Fetching...',
              status: 'active',
              time: dbLatency,
            },
            { step: 3, label: 'Store in cache', shortLabel: 'Store', status: 'pending' },
            { step: 4, label: 'Return data', shortLabel: 'Return', status: 'pending' },
          ]);
          setAnimation((prev) => prev && { ...prev, phase: 'miss-fetching' });
        }, 300);

        setTimeout(() => {
          const itemToEvict = getItemToEvict(cache);
          if (itemToEvict) {
            setEvictingKey(itemToEvict.key);
            setRequestSteps([
              { step: 1, label: 'Not found', shortLabel: 'Miss', status: 'done' },
              {
                step: 2,
                label: 'Fetched from database',
                shortLabel: 'Fetched',
                status: 'done',
                time: dbLatency,
              },
              {
                step: 3,
                label: `Evicting "${itemToEvict.key}"`,
                shortLabel: `Evict ${itemToEvict.key}`,
                status: 'active',
              },
              { step: 4, label: 'Return data', shortLabel: 'Return', status: 'pending' },
            ]);
          } else {
            setRequestSteps([
              { step: 1, label: 'Not found', shortLabel: 'Miss', status: 'done' },
              {
                step: 2,
                label: 'Fetched from database',
                shortLabel: 'Fetched',
                status: 'done',
                time: dbLatency,
              },
              { step: 3, label: 'Storing in cache...', shortLabel: 'Storing', status: 'active' },
              { step: 4, label: 'Return data', shortLabel: 'Return', status: 'pending' },
            ]);
          }
          setAnimation((prev) => prev && { ...prev, phase: 'storing' });
        }, 700);

        setTimeout(() => {
          setCache((prev) => {
            let newCache = [...prev];
            const evictItem = getItemToEvict(newCache);
            if (evictItem) {
              newCache = newCache.filter((item) => item.key !== evictItem.key);
            }
            newCache.push({
              key,
              accessCount: 1,
              lastAccess: currentTick,
              insertTime: currentTick,
            });
            return newCache;
          });

          setEvictingKey(null);
          setRequestSteps((prev) => prev.map((s) => ({ ...s, status: 'done' as const })));

          setStats((prev) => ({
            ...prev,
            misses: prev.misses + 1,
            totalTime: prev.totalTime + dbLatency,
            withoutCacheTime: prev.withoutCacheTime + dbLatency,
          }));
        }, 1200);

        setTimeout(() => {
          setLastResult({ isHit: false, time: dbLatency, key });
          setAnimation(null);
        }, 1800);
      }
    },
    [animation, cache, getItemToEvict, tick]
  );

  const reset = () => {
    setCache([]);
    setAnimation(null);
    setStats({ hits: 0, misses: 0, totalTime: 0, withoutCacheTime: 0 });
    setEvictingKey(null);
    setTick(0);
    setRequestSteps([]);
    setLastResult(null);
  };

  const hitRate =
    stats.hits + stats.misses > 0
      ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(0)
      : '0';

  const getItemColor = (key: string) =>
    DATA_ITEMS.find((item) => item.key === key)?.color || 'bg-gray-500';

  const getItemLabel = (key: string) =>
    DATA_ITEMS.find((item) => item.key === key)?.label || key;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Policy Selector */}
      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
            Eviction Policy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
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
                  'p-2 sm:p-3 rounded-lg border-2 transition-all text-left',
                  policy === p
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                )}
              >
                <div className="font-bold text-xs sm:text-sm">{EVICTION_POLICIES[p].name}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                  {EVICTION_POLICIES[p].description}
                </div>
                <div className="text-[10px] text-muted-foreground sm:hidden">
                  {EVICTION_POLICIES[p].shortDesc}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-muted-foreground bg-muted/50 p-2 rounded">
            <strong>{EVICTION_POLICIES[policy].name}:</strong> {EVICTION_POLICIES[policy].how}
          </p>
        </CardContent>
      </Card>

      {/* Main Visualization */}
      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg">Cache Simulator</CardTitle>
            <Button variant="outline" size="sm" onClick={reset} disabled={!!animation}>
              <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="text-xs sm:text-sm">Reset</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          {/* Request Buttons */}
          <div>
            <div className="text-xs sm:text-sm font-medium mb-2 text-muted-foreground">
              Tap to request data:
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {DATA_ITEMS.map((item) => (
                <Button
                  key={item.key}
                  variant="outline"
                  onClick={() => handleRequest(item.key)}
                  disabled={!!animation}
                  className={cn(
                    'flex flex-col items-center py-2 sm:py-3 h-auto px-1 sm:px-3',
                    cache.some((c) => c.key === item.key) && 'ring-2 ring-green-500'
                  )}
                >
                  <span
                    className={cn(
                      'w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm mb-1',
                      item.color
                    )}
                  >
                    {item.key}
                  </span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground truncate w-full text-center">
                    <span className="sm:hidden">{item.shortLabel}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </span>
                </Button>
              ))}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">
              Green ring = in cache
            </p>
          </div>

          {/* Visual Animation Area - Vertical on mobile, horizontal on desktop */}
          <div className="relative bg-gradient-to-b sm:bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-800/30 rounded-lg overflow-hidden p-3 sm:p-4">
            {/* Mobile: Vertical layout */}
            <div className="flex flex-col sm:hidden items-center gap-3">
              {/* Your App */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <span className="text-xs text-muted-foreground">Your App</span>
              </div>

              <ArrowDown className="h-4 w-4 text-muted-foreground" />

              {/* Cache */}
              <div className="flex flex-col items-center">
                <div className="grid grid-cols-4 gap-1 p-2 bg-emerald-500/20 rounded-lg border-2 border-emerald-500">
                  {Array.from({ length: CACHE_SIZE }).map((_, i) => {
                    const item = cache[i];
                    return (
                      <div
                        key={i}
                        className={cn(
                          'w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs transition-all',
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
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Cache (1-10ms)
                  </span>
                </div>
              </div>

              <ArrowDown className="h-4 w-4 text-muted-foreground" />

              {/* Database */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center">
                  <Database className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-xs text-muted-foreground block">Database</span>
                  <span className="text-[10px] text-red-500 font-medium">(50-200ms)</span>
                </div>
              </div>

              {/* Mobile Animation Indicator */}
              <AnimatePresence>
                {animation && (
                  <motion.div
                    key={animation.id}
                    className={cn(
                      'absolute w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs z-10',
                      getItemColor(animation.key)
                    )}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                  >
                    {animation.key}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop: Horizontal layout */}
            <div className="hidden sm:block h-32">
              {/* Database */}
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center">
                <div className="w-12 h-12 bg-slate-600 rounded-lg flex items-center justify-center">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs mt-1 text-muted-foreground">Database</span>
                <span className="text-xs text-red-500 font-medium">50-200ms</span>
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
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      Cache (1-10ms)
                    </span>
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

              {/* Desktop Animated Request */}
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
                      x:
                        animation.phase === 'checking' || animation.phase === 'storing'
                          ? '50%'
                          : 0,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    {animation.key}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Step-by-step Status Window */}
          <div className="bg-slate-900 rounded-lg p-3 sm:p-4 font-mono text-xs sm:text-sm">
            <div className="flex items-center gap-2 mb-2 sm:mb-3 text-slate-400 text-[10px] sm:text-xs">
              <div className="flex gap-1">
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500" />
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-500" />
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500" />
              </div>
              <span>Request Log</span>
            </div>

            {requestSteps.length === 0 ? (
              <div className="text-slate-500 text-xs sm:text-sm">
                <span className="text-green-400">$</span>{' '}
                <span className="hidden sm:inline">Click a data item to see how caching works...</span>
                <span className="sm:hidden">Tap an item above...</span>
              </div>
            ) : (
              <div className="space-y-1 sm:space-y-2">
                {requestSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-1 sm:gap-2">
                    {step.status === 'done' ? (
                      <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 flex-shrink-0" />
                    ) : step.status === 'active' ? (
                      <motion.div
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-yellow-400 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-slate-600 flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        'truncate',
                        step.status === 'done'
                          ? 'text-green-400'
                          : step.status === 'active'
                            ? 'text-yellow-400'
                            : 'text-slate-500'
                      )}
                    >
                      <span className="hidden sm:inline">{step.label}</span>
                      <span className="sm:hidden">{step.shortLabel}</span>
                    </span>
                    {step.time && (
                      <span
                        className={cn(
                          'ml-auto flex-shrink-0',
                          step.time <= 10 ? 'text-green-400' : 'text-red-400'
                        )}
                      >
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
                      'mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-slate-700 flex items-center gap-1 sm:gap-2 flex-wrap',
                      lastResult.isHit ? 'text-green-400' : 'text-amber-400'
                    )}
                  >
                    {lastResult.isHit ? (
                      <>
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="font-bold">HIT!</span>
                        <span className="text-green-300 text-[10px] sm:text-xs">
                          {lastResult.time}ms <span className="hidden sm:inline">(~20x faster!)</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="font-bold">MISS</span>
                        <span className="text-amber-300 text-[10px] sm:text-xs">
                          {lastResult.time}ms{' '}
                          <span className="hidden sm:inline">
                            ("{lastResult.key}" now cached)
                          </span>
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

      {/* Stats & Cache Details - Stack on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stats */}
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="text-center p-2 sm:p-3 bg-green-500/10 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.hits}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">Hits</div>
              </div>
              <div className="text-center p-2 sm:p-3 bg-amber-500/10 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {stats.misses}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">Misses</div>
              </div>
              <div className="text-center p-2 sm:p-3 bg-blue-500/10 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {hitRate}%
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">Hit Rate</div>
              </div>
              <div className="text-center p-2 sm:p-3 bg-purple-500/10 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.totalTime}<span className="text-sm">ms</span>
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">Total Time</div>
              </div>
            </div>
            {stats.hits + stats.misses > 0 && (
              <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-muted/50 rounded-lg">
                <div className="text-xs sm:text-sm font-medium mb-2">Time Saved</div>
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs text-muted-foreground w-16 sm:w-24">
                      With cache:
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-3 sm:h-4 overflow-hidden">
                      <motion.div
                        className="h-full bg-green-500"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${stats.withoutCacheTime > 0 ? Math.min((stats.totalTime / stats.withoutCacheTime) * 100, 100) : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] sm:text-xs font-medium text-green-600 dark:text-green-400 w-12 sm:w-16 text-right">
                      {stats.totalTime}ms
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs text-muted-foreground w-16 sm:w-24">
                      Without:
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-3 sm:h-4 overflow-hidden">
                      <div className="h-full bg-red-500 w-full" />
                    </div>
                    <span className="text-[10px] sm:text-xs font-medium text-red-600 dark:text-red-400 w-12 sm:w-16 text-right">
                      {stats.withoutCacheTime}ms
                    </span>
                  </div>
                </div>
                <p className="text-[10px] sm:text-xs text-center mt-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  Saved {stats.withoutCacheTime - stats.totalTime}ms!
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cache Contents */}
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
              Cache ({cache.length}/{CACHE_SIZE})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cache.length === 0 ? (
              <p className="text-muted-foreground text-xs sm:text-sm text-center py-4">
                Cache is empty
              </p>
            ) : (
              <div className="space-y-1 sm:space-y-2">
                {cache.map((item) => (
                  <div
                    key={item.key}
                    className={cn(
                      'flex items-center gap-2 sm:gap-3 p-2 rounded-lg bg-muted/50',
                      evictingKey === item.key && 'ring-2 ring-red-500 animate-pulse'
                    )}
                  >
                    <span
                      className={cn(
                        'w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0',
                        getItemColor(item.key)
                      )}
                    >
                      {item.key}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs sm:text-sm truncate">
                        {getItemLabel(item.key)}
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">
                        <span className="hidden sm:inline">
                          Accessed: {item.accessCount}x | Last: #{item.lastAccess} | Added: #
                          {item.insertTime}
                        </span>
                        <span className="sm:hidden">
                          {item.accessCount}x | #{item.lastAccess}
                        </span>
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
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-base sm:text-lg">Why Use Caching?</CardTitle>
        </CardHeader>
        <CardContent className="text-xs sm:text-sm text-muted-foreground space-y-2 sm:space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="p-2 sm:p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              <div className="font-medium text-red-600 dark:text-red-400 mb-1 text-xs sm:text-sm">
                Without Cache
              </div>
              <p className="text-[10px] sm:text-sm">
                <span className="hidden sm:inline">
                  Every request goes to the database (50-200ms). Slow!
                </span>
                <span className="sm:hidden">Every request = slow DB call</span>
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="font-medium text-green-600 dark:text-green-400 mb-1 text-xs sm:text-sm">
                With Cache
              </div>
              <p className="text-[10px] sm:text-sm">
                <span className="hidden sm:inline">
                  Repeated requests return instantly (1-10ms). 20x faster!
                </span>
                <span className="sm:hidden">Repeat requests = instant!</span>
              </p>
            </div>
          </div>
          <p className="text-[10px] sm:text-sm">
            The eviction policy decides what to remove when cache is full.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
