'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, Database, HardDrive, Zap, Clock, TrendingUp } from 'lucide-react';
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

// Data items the user can request
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
  const [lastAction, setLastAction] = useState<string>('');
  const [tick, setTick] = useState(0);

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
    if (animation) return; // Prevent overlapping requests

    const requestId = `req-${Date.now()}`;
    const currentTick = tick + 1;
    setTick(currentTick);

    // Check if item is in cache
    const cachedItem = cache.find((item) => item.key === key);
    const isHit = !!cachedItem;

    // Start animation - checking cache
    setAnimation({ id: requestId, key, phase: 'checking', isHit });

    if (isHit) {
      // Cache HIT
      setTimeout(() => {
        setAnimation((prev) => prev && { ...prev, phase: 'hit' });
        setLastAction(`HIT! "${key}" found in cache (${CACHE_LATENCY}ms)`);

        // Update access stats
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
        setAnimation(null);
      }, 1200);
    } else {
      // Cache MISS
      setTimeout(() => {
        setAnimation((prev) => prev && { ...prev, phase: 'miss-fetching' });
        setLastAction(`MISS! Fetching "${key}" from database...`);
      }, 400);

      setTimeout(() => {
        // Check if we need to evict
        const toEvict = getItemToEvict(cache);
        if (toEvict) {
          setEvictingKey(toEvict.key);
          setLastAction(`Evicting "${toEvict.key}" (${EVICTION_POLICIES[policy].how.toLowerCase()})`);
        }
      }, 800);

      setTimeout(() => {
        setAnimation((prev) => prev && { ...prev, phase: 'storing' });

        // Add to cache (with potential eviction)
        setCache((prev) => {
          const toEvict = getItemToEvict(prev);
          const filtered = toEvict ? prev.filter((item) => item.key !== toEvict.key) : prev;
          return [
            ...filtered,
            { key, accessCount: 1, lastAccess: currentTick, insertTime: currentTick },
          ];
        });

        setEvictingKey(null);
        setLastAction(`Stored "${key}" in cache (${DB_LATENCY}ms total)`);

        setStats((prev) => ({
          ...prev,
          misses: prev.misses + 1,
          totalTime: prev.totalTime + DB_LATENCY,
        }));
      }, 1200);

      setTimeout(() => {
        setAnimation(null);
      }, 1800);
    }
  }, [animation, cache, getItemToEvict, policy, tick]);

  const reset = () => {
    setCache([]);
    setAnimation(null);
    setStats({ hits: 0, misses: 0, totalTime: 0 });
    setEvictingKey(null);
    setLastAction('');
    setTick(0);
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
              <span className="text-xs text-muted-foreground">({DB_LATENCY}ms)</span>
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
                  <span className="text-xs text-muted-foreground">Cache ({CACHE_LATENCY}ms)</span>
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

          {/* Status Message */}
          <div
            className={cn(
              'text-center py-2 px-4 rounded-lg font-medium text-sm',
              lastAction.includes('HIT')
                ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                : lastAction.includes('MISS') || lastAction.includes('Evicting')
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                  : lastAction.includes('Stored')
                    ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
                    : 'bg-muted text-muted-foreground'
            )}
          >
            {lastAction || 'Click a data item above to make a request'}
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
              <p className="mt-3 text-xs text-muted-foreground text-center">
                Without cache: {(stats.hits + stats.misses) * DB_LATENCY}ms |
                Saved: {(stats.hits + stats.misses) * DB_LATENCY - stats.totalTime}ms
              </p>
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
          <CardTitle className="text-lg">How Caching Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>
            <strong>Caching</strong> stores frequently accessed data in fast memory to avoid
            slow database lookups. When you request data:
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li><strong>Cache Hit:</strong> Data is found in cache → returned instantly ({CACHE_LATENCY}ms)</li>
            <li><strong>Cache Miss:</strong> Data not in cache → fetch from database ({DB_LATENCY}ms), then store in cache</li>
          </ol>
          <p>
            When the cache is full (4 items), the <strong>eviction policy</strong> decides which
            item to remove to make room for new data. Try different policies and see how they
            affect performance!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
