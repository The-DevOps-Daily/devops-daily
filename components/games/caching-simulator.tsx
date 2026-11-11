'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Database, HardDrive, Zap } from 'lucide-react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import {
  SIM_CATEGORY,
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimMissionList,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  useMissions,
  type Mission,
} from '@/components/games/sim';
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

interface CacheMissionState {
  hits: number;
  evictionPolicies: EvictionPolicy[];
}

const MISSIONS: Mission<CacheMissionState>[] = [
  {
    id: 'hit',
    label: 'Ask for the same item twice and get a cache hit.',
    hint: 'The first request is a miss and fills the cache.',
    check: (state) => state.hits > 0,
  },
  {
    id: 'evict-lru',
    label: 'Fill the cache with LRU and watch the least recently used item go.',
    hint: 'The cache holds four items. Ask for a fifth.',
    check: (state) => state.evictionPolicies.includes('lru'),
  },
  {
    id: 'evict-other',
    label: 'Evict again with LFU or FIFO and compare who goes.',
    hint: 'Switch the policy, then fill the cache again.',
    check: (state) =>
      state.evictionPolicies.some(
        (evictionPolicy) => evictionPolicy === 'lfu' || evictionPolicy === 'fifo'
      ),
  },
  {
    id: 'second-policy',
    label: 'Evict with all three policies: LRU, LFU and FIFO.',
    hint: 'Each one picks a different item to throw out.',
    check: (state) => new Set(state.evictionPolicies).size >= 3,
  },
];

type CacheTab = 'cache' | 'details';

export default function CachingSimulator() {
  const [tab, setTab] = useState<CacheTab>('cache');
  const [dismissed, setDismissed] = useState(false);
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
  const [evictionPolicies, setEvictionPolicies] = useState<EvictionPolicy[]>([]);

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
            setEvictionPolicies((previous) => [...previous, policy]);
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
    [animation, cache, getItemToEvict, policy, tick]
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
  const getItemLabel = (key: string) => DATA_ITEMS.find((item) => item.key === key)?.label || key;

  const missionState = useMemo(
    () => ({ hits: stats.hits, evictionPolicies }),
    [evictionPolicies, stats.hits]
  );
  const missions = useMissions(MISSIONS, missionState);

  const startOver = () => {
    reset();
    setEvictionPolicies([]);
    missions.reset();
    setDismissed(false);
  };

  const selectPolicy = (nextPolicy: EvictionPolicy) => {
    if (!animation) {
      setPolicy(nextPolicy);
      reset();
    }
  };

  const statusMessage = animation
    ? `Requesting ${getItemLabel(animation.key)}.`
    : lastResult
      ? `${lastResult.isHit ? 'Cache hit' : 'Cache miss'} for ${getItemLabel(lastResult.key)}.`
      : 'Choose an item to begin.';

  const policyPicker = (phone = false) => (
    <div
      className={cn('flex items-center gap-1', phone && 'w-full')}
      role="group"
      aria-label="Eviction policy"
    >
      {(Object.keys(EVICTION_POLICIES) as EvictionPolicy[]).map((nextPolicy) => (
        <Button
          key={nextPolicy}
          type="button"
          variant={policy === nextPolicy ? 'default' : 'outline'}
          className={cn('h-10 min-w-10 px-2 text-xs lg:h-8', phone && 'flex-1')}
          aria-pressed={policy === nextPolicy}
          onClick={() => selectPolicy(nextPolicy)}
          disabled={!!animation}
        >
          {EVICTION_POLICIES[nextPolicy].name}
        </Button>
      ))}
    </div>
  );

  const currentGoal = missions.current;

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="Caching"
          icon={HardDrive}
          lead={policyPicker()}
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={missions.complete ? 'Caching patterns explored' : 'Watch the cache decide'}
          goal={
            missions.complete ? (
              'Missions done: keep experimenting with cache behavior.'
            ) : (
              <>
                {currentGoal?.label}{' '}
                <span className="text-muted-foreground">{currentGoal?.hint}</span>
              </>
            )
          }
        />
        <SimAnnouncer message={statusMessage} />

        {missions.complete && !dismissed ? (
          <SimComplete
            title="Caching missions complete"
            summary="You compared repeated reads with the three eviction policies."
            stats={[
              { label: 'Hits', value: stats.hits, note: 'Repeated reads served from cache' },
              { label: 'Misses', value: stats.misses, note: 'Database fetches' },
              {
                label: 'Policies',
                value: new Set(evictionPolicies).size,
                note: 'Eviction rules observed',
              },
            ]}
            actions={
              <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
                Keep exploring
              </Button>
            }
            onPlayAgain={startOver}
            playAgainLabel="Start over"
          />
        ) : (
          <SimStage
            panels={[
              {
                id: 'cache',
                label: 'Cache',
                content: (
                  <section className="space-y-3 rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Request data</p>
                        <p className="text-xs text-muted-foreground">
                          A miss fills a slot; a repeat request becomes a hit.
                        </p>
                      </div>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {cache.length}/{CACHE_SIZE} slots
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {DATA_ITEMS.map((item) => {
                        const cached = cache.some((cacheItem) => cacheItem.key === item.key);
                        return (
                          <Button
                            key={item.key}
                            type="button"
                            variant="outline"
                            onClick={() => handleRequest(item.key)}
                            disabled={!!animation}
                            className={cn(
                              'h-10 justify-start gap-2 px-3 text-left',
                              cached && 'border-primary bg-primary/5'
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                                cached
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {item.key}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </Button>
                        );
                      })}
                    </div>

                    <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                      <div
                        className={cn(
                          'rounded-md border p-3',
                          SIM_CATEGORY.neutral.fill,
                          SIM_CATEGORY.neutral.border
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <div>
                            <p className="text-sm font-medium">Database</p>
                            <p className="text-xs text-muted-foreground">50 to 200 ms on a miss</p>
                          </div>
                        </div>
                      </div>

                      <AnimatePresence mode="wait">
                        {animation ? (
                          <motion.div
                            key={animation.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className={cn(
                              'mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold',
                              SIM_CATEGORY.primary.fill,
                              SIM_CATEGORY.primary.border
                            )}
                            aria-label={`Request for ${getItemLabel(animation.key)}`}
                          >
                            {animation.key}
                          </motion.div>
                        ) : (
                          <Zap
                            className="mx-auto h-5 w-5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        )}
                      </AnimatePresence>

                      <div
                        className={cn(
                          'rounded-md border p-3',
                          SIM_CATEGORY.emerald.fill,
                          SIM_CATEGORY.emerald.border
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <div>
                            <p className="text-sm font-medium">Cache</p>
                            <p className="text-xs text-muted-foreground">1 to 10 ms on a hit</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-4 gap-1.5" aria-label="Cache slots">
                          {Array.from({ length: CACHE_SIZE }).map((_, index) => {
                            const item = cache[index];
                            return (
                              <div
                                key={index}
                                className={cn(
                                  'flex h-10 items-center justify-center rounded-md border text-sm font-semibold',
                                  item
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border bg-background text-muted-foreground',
                                  evictingKey === item?.key && 'ring-2 ring-primary ring-offset-1'
                                )}
                              >
                                {item?.key ?? '-'}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {lastResult && (
                      <SimFeedback
                        tone={lastResult.isHit ? 'success' : 'warning'}
                        label={lastResult.isHit ? 'Cache hit' : 'Cache miss'}
                      >
                        <p>
                          {getItemLabel(lastResult.key)} returned in {lastResult.time} ms.
                          {!lastResult.isHit && ' It is now in the cache.'}
                        </p>
                      </SimFeedback>
                    )}
                  </section>
                ),
              },
              {
                id: 'details',
                label: 'Details',
                content: (
                  <div className="space-y-3">
                    <SimMissionList missions={missions.missions} />

                    <section className="rounded-lg border bg-card p-3" aria-label="Cache stats">
                      <div className="grid grid-cols-2 gap-2">
                        <div className={cn('rounded-md p-2', SIM_TONE.success.surface)}>
                          <p className="font-mono text-lg font-semibold tabular-nums">
                            {stats.hits}
                          </p>
                          <p className="text-xs text-muted-foreground">Hits</p>
                        </div>
                        <div className={cn('rounded-md p-2', SIM_TONE.warning.surface)}>
                          <p className="font-mono text-lg font-semibold tabular-nums">
                            {stats.misses}
                          </p>
                          <p className="text-xs text-muted-foreground">Misses</p>
                        </div>
                        <div className="rounded-md bg-muted p-2">
                          <p className="font-mono text-lg font-semibold tabular-nums">{hitRate}%</p>
                          <p className="text-xs text-muted-foreground">Hit rate</p>
                        </div>
                        <div className="rounded-md bg-muted p-2">
                          <p className="font-mono text-lg font-semibold tabular-nums">
                            {stats.withoutCacheTime - stats.totalTime} ms
                          </p>
                          <p className="text-xs text-muted-foreground">Time saved</p>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-lg border bg-card p-3" aria-label="Request log">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">Request log</h3>
                        <span className="text-xs text-muted-foreground">
                          {EVICTION_POLICIES[policy].name}: {EVICTION_POLICIES[policy].how}
                        </span>
                      </div>
                      {requestSteps.length === 0 ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Select a data item to trace its request.
                        </p>
                      ) : (
                        <ol className="mt-2 space-y-1.5">
                          {requestSteps.map((step) => {
                            const tone =
                              step.status === 'done'
                                ? SIM_TONE.success
                                : step.status === 'active'
                                  ? SIM_TONE.info
                                  : SIM_TONE.hint;
                            return (
                              <li
                                key={step.step}
                                className={cn(
                                  'flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm',
                                  tone.surface
                                )}
                              >
                                <span className="font-mono text-xs tabular-nums">{step.step}</span>
                                <span className="min-w-0 flex-1">{step.label}</span>
                                {step.time && (
                                  <span className="font-mono text-xs tabular-nums">
                                    {step.time} ms
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </section>

                    <details className="rounded-lg border bg-card p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        How cache eviction works
                      </summary>
                      <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                        <p>
                          Repeating a request avoids the slower database path. When four slots are
                          full, the selected policy decides which entry leaves.
                        </p>
                        <ul className="list-disc space-y-1 pl-5">
                          {(Object.keys(EVICTION_POLICIES) as EvictionPolicy[]).map(
                            (evictionPolicy) => (
                              <li key={evictionPolicy}>
                                <strong className="text-foreground">
                                  {EVICTION_POLICIES[evictionPolicy].name}:
                                </strong>{' '}
                                {EVICTION_POLICIES[evictionPolicy].how}
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    </details>
                  </div>
                ),
              },
            ]}
            columns="lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"
            tab={tab}
            onTabChange={(nextTab) => {
              if (nextTab === 'cache' || nextTab === 'details') setTab(nextTab);
            }}
            tabsLabel="Caching panels"
            minHeight="min-h-[24rem]"
          />
        )}

        <SimPhoneBar>{policyPicker(true)}</SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
