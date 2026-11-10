'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Play, Pause, RotateCcw, CircleCheck, CircleX, Gauge } from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import {
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFrame,
  SimMissionList,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  useMissions,
  type Mission,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';

// The header values come from Date.now(), so they render only in the browser (no hydration mismatch).
const subscribeNothing = () => () => {};
interface RateLimitConfig {
  limit: number;
  windowMs: number;
  windowLabel: string;
}

interface RequestData {
  id: string;
  timestamp: number;
  success: boolean;
  remaining: number;
  retryAfter?: number;
}

interface ChartData {
  period: string;
  successful: number;
  throttled: number;
  remaining: number;
  total: number;
}

const RATE_LIMIT_PRESETS: Record<string, RateLimitConfig> = {
  github: { limit: 5000, windowMs: 3600000, windowLabel: 'hour' },
  twitter: { limit: 300, windowMs: 900000, windowLabel: '15 minutes' },
  stripe: { limit: 100, windowMs: 1000, windowLabel: 'second' }, // live mode global limit
  openai: { limit: 3, windowMs: 60000, windowLabel: 'minute' },
  demo: { limit: 20, windowMs: 30000, windowLabel: '30 seconds' }, // Better for demo
};

// Each throttled request is retried up to this many times. With exponential
// backoff that is 1s, 2s, 4s, 8s, 16s, then the 30s cap.
const MAX_RETRIES = 6;

const BACKOFF_STRATEGIES = {
  none: { name: 'No Backoff', description: 'Keep retrying immediately' },
  fixed: { name: 'Fixed Delay', description: 'Wait 1 second between retries' },
  exponential: { name: 'Exponential Backoff', description: 'Double the delay each time' },
};

interface RateMissionState {
  preset: string;
  strategy: string;
  burstSize: number;
  burstInterval: number;
  throttled: number;
  requests: RequestData[];
}

const MISSIONS: Mission<RateMissionState>[] = [
  {
    id: 'limit',
    label: 'Start the client and run it into the limit.',
    hint: 'The demo API allows 20 requests per 30 seconds.',
    check: (s) => s.throttled > 0,
  },
  {
    id: 'backoff',
    label: 'With exponential backoff, see a retry wait 8 seconds.',
    hint: 'Each retry doubles the wait: 1, 2, 4, 8 seconds.',
    check: (s) => s.requests.some((r) => !r.success && (r.retryAfter ?? 0) >= 8000),
  },
  {
    id: 'recovered',
    label: 'Keep running until a request succeeds again after a 429.',
    hint: 'The window resets every 30 seconds.',
    check: (s) => {
      const firstThrottle = s.requests.findIndex((r) => !r.success);
      return firstThrottle >= 0 && s.requests.slice(firstThrottle + 1).some((r) => r.success);
    },
  },
  {
    id: 'storm',
    label: 'Switch to No Backoff and watch a blocked request retry six times at once.',
    hint: 'No delay means every retry hits the closed window.',
    check: (s) => s.requests.filter((r) => !r.success && r.retryAfter === 0).length >= 6,
  },
  {
    id: 'paced',
    label: 'Pace the client to 20 requests per 30 s or fewer, then send 10 in a row without a 429.',
    hint: 'Fewer requests per burst, or more time between bursts.',
    check: (s) =>
      s.preset === 'demo' &&
      s.burstSize * Math.ceil(30000 / s.burstInterval) <= 20 &&
      s.requests.length >= 10 &&
      s.requests.slice(-10).every((r) => r.success),
  },
];

type Tab = 'traffic' | 'client' | 'headers';
const FIELD =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9';

export default function RateLimitSimulator() {
  const [tab, setTab] = useState<Tab>('traffic');
  const [dismissed, setDismissed] = useState(false);

  // Configuration state
  const [preset, setPreset] = useState('demo');
  const [config, setConfig] = useState<RateLimitConfig>(RATE_LIMIT_PRESETS.demo);
  const [strategy, setStrategy] = useState('exponential');
  const [burstSize, setBurstSize] = useState(5);
  const [burstInterval, setBurstInterval] = useState(3000);

  // Simulation state
  const [isRunning, setIsRunning] = useState(false);
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [currentRemaining, setCurrentRemaining] = useState(config.limit);
  const [windowResetTime, setWindowResetTime] = useState(() => Date.now() + config.windowMs);
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());

  // Stats
  const [totalRequests, setTotalRequests] = useState(0);
  const [successfulRequests, setSuccessfulRequests] = useState(0);
  const [throttledRequests, setThrottledRequests] = useState(0);

  const missionState = useMemo(
    () => ({
      preset,
      strategy,
      burstSize,
      burstInterval,
      throttled: throttledRequests,
      requests,
    }),
    [preset, strategy, burstSize, burstInterval, throttledRequests, requests]
  );
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false
  );
  const missions = useMissions(MISSIONS, missionState);

  // Chart data - aggregate by 5-second periods for better readability
  const [chartData, setChartData] = useState<ChartData[]>([]);

  // Refs for intervals
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chartUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const windowResetIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Staggered burst requests and scheduled retries, so Stop and Reset can cancel them
  const pendingTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  // Retries read the strategy when they fire, so a change applies to them at once
  const strategyRef = useRef(strategy);

  useEffect(() => {
    strategyRef.current = strategy;
  }, [strategy]);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timeout = setTimeout(() => {
      pendingTimeoutsRef.current.delete(timeout);
      callback();
    }, delay);
    pendingTimeoutsRef.current.add(timeout);
  }, []);

  const clearPending = useCallback(() => {
    pendingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    pendingTimeoutsRef.current.clear();
  }, []);

  // Calculate backoff delay
  const calculateBackoffDelay = useCallback((attempt: number): number => {
    switch (strategyRef.current) {
      case 'none':
        return 0;
      case 'fixed':
        return 1000;
      case 'exponential':
        return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      default:
        return 0;
    }
  }, []);

  // Make a single request with atomic rate limiting
  const makeRequest = useCallback(
    (isRetry = false, attempt = 1): void => {
      const now = Date.now();
      let requestData: RequestData;

      // Use functional state update to make this atomic
      setCurrentRemaining((prev) => {
        const canMakeRequest = prev > 0;
        const newRemaining = canMakeRequest ? Math.max(0, prev - 1) : prev;

        requestData = {
          id: `${now}-${Math.random()}`,
          timestamp: now,
          success: canMakeRequest,
          remaining: newRemaining,
        };

        // Update stats immediately in the same state update cycle
        if (canMakeRequest) {
          setSuccessfulRequests((s) => s + 1);
        } else {
          setThrottledRequests((t) => t + 1);

          // Handle retry with backoff. "none" still retries, just with no delay.
          if (attempt <= MAX_RETRIES) {
            const delay = calculateBackoffDelay(attempt);
            requestData.retryAfter = delay;

            schedule(() => {
              makeRequest(true, attempt + 1);
            }, delay);
          }
        }

        setTotalRequests((total) => total + 1);
        setRequests((prevRequests) => [...prevRequests.slice(-200), requestData]);

        return newRemaining;
      });
    },
    [calculateBackoffDelay, schedule]
  );

  const runBurst = useCallback(() => {
    for (let i = 0; i < burstSize; i++) {
      // Stagger requests slightly to avoid all hitting at exactly the same time
      schedule(() => makeRequest(), i * 100);
    }
  }, [burstSize, makeRequest, schedule]);

  // Start simulation
  const startSimulation = useCallback(() => {
    if (simulationIntervalRef.current) return;

    // Run first burst immediately
    runBurst();

    // Set up recurring bursts
    simulationIntervalRef.current = setInterval(runBurst, burstInterval);
  }, [burstInterval, runBurst]);

  // A running simulation picks up a new burst size or interval straight away
  useEffect(() => {
    if (!simulationIntervalRef.current) return;
    clearInterval(simulationIntervalRef.current);
    simulationIntervalRef.current = setInterval(runBurst, burstInterval);
  }, [burstInterval, runBurst]);

  // Stop simulation, including bursts and retries that are still scheduled
  const stopSimulation = useCallback(() => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    clearPending();
  }, [clearPending]);

  // Reset all data
  const resetSimulation = useCallback(() => {
    stopSimulation();
    setIsRunning(false);
    setRequests([]);
    setChartData([]);
    setCurrentRemaining(config.limit);
    setWindowResetTime(Date.now() + config.windowMs);
    setSessionStartTime(Date.now());
    setTotalRequests(0);
    setSuccessfulRequests(0);
    setThrottledRequests(0);
  }, [config.limit, config.windowMs, stopSimulation]);

  // Handle preset change
  const handlePresetChange = (value: string) => {
    setPreset(value);
    const newConfig = RATE_LIMIT_PRESETS[value];
    setConfig(newConfig);
  };

  // Reset when config changes
  useEffect(() => {
    resetSimulation();
  }, [config, resetSimulation]);

  // Handle window reset
  useEffect(() => {
    const checkWindowReset = () => {
      const now = Date.now();
      if (now >= windowResetTime) {
        setCurrentRemaining(config.limit);
        setWindowResetTime(now + config.windowMs);
      }
    };

    windowResetIntervalRef.current = setInterval(checkWindowReset, 1000);

    return () => {
      if (windowResetIntervalRef.current) {
        clearInterval(windowResetIntervalRef.current);
      }
    };
  }, [windowResetTime, config.limit, config.windowMs]);

  // Update chart data - aggregate by 5-second periods for better readability
  useEffect(() => {
    const updateChart = () => {
      const now = Date.now();
      const sessionDuration = now - sessionStartTime;
      const maxPeriods = Math.max(12, Math.ceil(sessionDuration / 5000)); // At least 12 periods, or session length in 5s chunks

      // Create 5-second periods
      const periods: ChartData[] = [];
      for (let i = 0; i < maxPeriods; i++) {
        const periodStart = sessionStartTime + i * 5000;
        const periodEnd = periodStart + 5000;
        const periodLabel = `${Math.floor(i * 5)}s`;

        periods.push({
          period: periodLabel,
          successful: 0,
          throttled: 0,
          remaining: currentRemaining,
          total: 0,
        });
      }

      // Aggregate requests by 5-second periods
      requests.forEach((request) => {
        if (request.timestamp >= sessionStartTime) {
          const periodIndex = Math.floor((request.timestamp - sessionStartTime) / 5000);

          if (periodIndex >= 0 && periodIndex < periods.length) {
            if (request.success) {
              periods[periodIndex].successful++;
            } else {
              periods[periodIndex].throttled++;
            }
            periods[periodIndex].total++;
          }
        }
      });

      setChartData(periods);
    };

    updateChart();
    chartUpdateIntervalRef.current = setInterval(updateChart, 1000);

    return () => {
      if (chartUpdateIntervalRef.current) {
        clearInterval(chartUpdateIntervalRef.current);
      }
    };
  }, [requests, currentRemaining, sessionStartTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSimulation();
      if (chartUpdateIntervalRef.current) {
        clearInterval(chartUpdateIntervalRef.current);
      }
      if (windowResetIntervalRef.current) {
        clearInterval(windowResetIntervalRef.current);
      }
    };
  }, [stopSimulation]);

  // Handle start/stop
  const handleToggle = () => {
    if (isRunning) {
      setIsRunning(false);
      stopSimulation();
    } else {
      setIsRunning(true);
      startSimulation();
    }
  };

  // Calculate rates
  const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
  const throttleRate = totalRequests > 0 ? (throttledRequests / totalRequests) * 100 : 0;

  // Get rate limit headers
  const getRateLimitHeaders = () => ({
    'X-RateLimit-Limit': config.limit.toString(),
    'X-RateLimit-Remaining': currentRemaining.toString(),
    'X-RateLimit-Reset': Math.floor(windowResetTime / 1000).toString(),
    'X-RateLimit-Window': `${config.windowMs / 1000}s`,
    'Retry-After':
      currentRemaining === 0 ? Math.ceil((windowResetTime - Date.now()) / 1000).toString() : '0',
  });

  const startOver = () => {
    resetSimulation();
    missions.reset();
    setDismissed(false);
  };
  const latestRequest = requests[requests.length - 1];
  const announcement = latestRequest
    ? latestRequest.success
      ? `Request accepted, ${latestRequest.remaining} left`
      : latestRequest.retryAfter === undefined
        ? '429 Too Many Requests, no retry left'
        : `429 Too Many Requests, retry in ${latestRequest.retryAfter / 1000} s`
    : '';
  const strategyInfo = BACKOFF_STRATEGIES[strategy as keyof typeof BACKOFF_STRATEGIES];

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="Rate Limit Simulator"
          icon={Gauge}
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading="Missions"
          meta={
            <>
              {isRunning ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                    SIM_TONE.info.surface,
                    SIM_TONE.info.text
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full motion-safe:animate-pulse',
                      SIM_TONE.info.fill
                    )}
                  />
                  Running
                </span>
              ) : (
                <span className="rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                  Stopped
                </span>
              )}
              <Badge variant="secondary" className="font-mono tabular-nums">
                {currentRemaining}/{config.limit} left
              </Badge>
            </>
          }
          actions={
            <div className="hidden items-center gap-2 lg:flex">
              <Button type="button" className="h-8" onClick={handleToggle}>
                {isRunning ? (
                  <Pause className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4" aria-hidden="true" />
                )}
                {isRunning ? 'Stop' : 'Start'}
              </Button>
              <Button type="button" variant="outline" className="h-8" onClick={resetSimulation}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reset run
              </Button>
            </div>
          }
          goal={
            missions.complete ? (
              'All five done. Keep experimenting with presets and backoff.'
            ) : (
              <>
                {missions.current?.label}{' '}
                <span className="text-muted-foreground">{missions.current?.hint}</span>
              </>
            )
          }
        />

        <SimAnnouncer message={announcement} />

        {missions.complete && !dismissed ? (
          <SimComplete
            title="Missions complete"
            summary="You hit the limit, watched exponential backoff stretch its waits, saw the window reset, caused a retry storm and paced a client to stay under the limit."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Requests sent', value: totalRequests },
              { label: 'Throttled', value: throttledRequests },
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
            columns="lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)_minmax(0,1fr)]"
            minHeight="min-h-[24rem]"
            tab={tab}
            onTabChange={(next) => {
              if (next === 'traffic' || next === 'client' || next === 'headers') setTab(next);
            }}
            tabsLabel="Simulator panels"
            tabOrder={['traffic', 'client', 'headers']}
            panels={[
              {
                id: 'client',
                label: 'Client',
                className: 'space-y-2',
                content: (
                  <>
                    <section className="space-y-3 rounded-lg border bg-card p-3">
                      <h3 className="text-sm font-semibold">Client settings</h3>
                      <div>
                        <label
                          htmlFor="rate-limit-preset"
                          className="mb-1 block text-xs font-medium text-muted-foreground"
                        >
                          Rate limit preset
                        </label>
                        <select
                          id="rate-limit-preset"
                          value={preset}
                          onChange={(event) => handlePresetChange(event.target.value)}
                          className={FIELD}
                        >
                          <option value="demo">Demo (20/30sec)</option>
                          <option value="github">GitHub API (5000/hour)</option>
                          <option value="twitter">Twitter API (300/15min)</option>
                          <option value="stripe">Stripe API (100/sec, live mode)</option>
                          <option value="openai">OpenAI API (3/min)</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="rate-limit-strategy"
                          className="mb-1 block text-xs font-medium text-muted-foreground"
                        >
                          Backoff strategy
                        </label>
                        <select
                          id="rate-limit-strategy"
                          value={strategy}
                          onChange={(event) => setStrategy(event.target.value)}
                          className={FIELD}
                        >
                          {Object.entries(BACKOFF_STRATEGIES).map(([key, item]) => (
                            <option key={key} value={key}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {strategyInfo.description}
                        </p>
                      </div>
                      <div>
                        <label
                          htmlFor="rate-limit-burst-size"
                          className="mb-1 block text-xs font-medium text-muted-foreground"
                        >
                          Burst size: {burstSize} requests
                        </label>
                        <input
                          id="rate-limit-burst-size"
                          type="range"
                          min={1}
                          max={20}
                          step={1}
                          value={burstSize}
                          onChange={(event) => setBurstSize(parseInt(event.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="rate-limit-burst-interval"
                          className="mb-1 block text-xs font-medium text-muted-foreground"
                        >
                          Burst interval: {burstInterval / 1000} s
                        </label>
                        <input
                          id="rate-limit-burst-interval"
                          type="range"
                          min={1000}
                          max={10000}
                          step={500}
                          value={burstInterval}
                          onChange={(event) => setBurstInterval(parseInt(event.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>
                    </section>
                    <SimMissionList missions={missions.missions} />
                  </>
                ),
              },
              {
                id: 'traffic',
                label: 'Traffic',
                className: 'space-y-2',
                content: (
                  <>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        ['Remaining', currentRemaining, 'text-foreground'],
                        ['Successful', successfulRequests, 'text-correct-foreground'],
                        ['Throttled', throttledRequests, 'text-wrong-foreground'],
                        ['Total', totalRequests, 'text-foreground'],
                      ].map(([label, value, tone]) => (
                        <div key={label} className="rounded-md border bg-card px-2 py-1.5">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {label}
                          </div>
                          <div className={cn('font-mono text-lg font-semibold tabular-nums', tone)}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Success rate {successRate.toFixed(1)}% · Throttle rate{' '}
                      {throttleRate.toFixed(1)}%
                    </p>
                    <section className="rounded-lg border bg-card p-3">
                      <h3 className="text-sm font-semibold">Request timeline</h3>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                            <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" />
                            <YAxis stroke="hsl(var(--muted-foreground))" />
                            <Tooltip
                              contentStyle={{
                                background: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                              }}
                            />
                            <Legend />
                            <Bar
                              dataKey="successful"
                              fill="hsl(var(--correct))"
                              name="Successful requests"
                            />
                            <Bar
                              dataKey="throttled"
                              fill="hsl(var(--wrong))"
                              name="Throttled requests"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold">Rate limit remaining</h3>
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                            <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" />
                            <YAxis stroke="hsl(var(--muted-foreground))" />
                            <Tooltip
                              contentStyle={{
                                background: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="remaining"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              name="Rate limit remaining"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </section>
                  </>
                ),
              },
              {
                id: 'headers',
                label: 'Headers',
                className: 'space-y-2',
                content: (
                  <>
                    <section className="rounded-lg border bg-card p-3">
                      <h3 className="mb-2 text-sm font-semibold">Response headers</h3>
                      <div className="space-y-2">
                        {Object.entries(getRateLimitHeaders()).map(([header, value]) => (
                          <div key={header} className="flex items-center justify-between gap-2">
                            <code className="font-mono text-xs">{header}</code>
                            <Badge variant="outline" className="font-mono">
                              {hydrated ? value : ''}
                            </Badge>
                          </div>
                        ))}
                      </div>
                      <details className="mt-3 text-sm">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                          What the headers mean
                        </summary>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <p>
                            <strong>X-RateLimit-Limit:</strong> Maximum requests allowed in the time
                            window
                          </p>
                          <p>
                            <strong>X-RateLimit-Remaining:</strong> Requests remaining in current
                            window
                          </p>
                          <p>
                            <strong>X-RateLimit-Reset:</strong> Unix timestamp when the window
                            resets
                          </p>
                          <p>
                            <strong>X-RateLimit-Window:</strong> Duration of the rate limiting
                            window
                          </p>
                          <p>
                            <strong>Retry-After:</strong> Seconds to wait before retrying (when rate
                            limited)
                          </p>
                        </div>
                      </details>
                    </section>
                    <section className="rounded-lg border bg-card p-3">
                      <h3 className="mb-2 text-sm font-semibold">Request log</h3>
                      <div className="max-h-72 space-y-2 overflow-y-auto">
                        {requests
                          .slice(-20)
                          .reverse()
                          .map((request) => (
                            <div
                              key={request.id}
                              className={cn(
                                'flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs',
                                request.success ? SIM_TONE.success.surface : SIM_TONE.danger.surface
                              )}
                            >
                              {request.success ? (
                                <CircleCheck
                                  className="h-4 w-4 shrink-0 text-correct-foreground"
                                  aria-hidden="true"
                                />
                              ) : (
                                <CircleX
                                  className="h-4 w-4 shrink-0 text-wrong-foreground"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="font-mono text-muted-foreground">
                                {new Date(request.timestamp).toLocaleTimeString()}
                              </span>
                              <span>
                                {request.success ? 'HTTP 200 OK' : 'HTTP 429 Too Many Requests'}
                              </span>
                              <span className="text-muted-foreground">
                                Remaining: {request.remaining}
                              </span>
                              {request.retryAfter !== undefined && (
                                <Badge variant="outline" className="ml-auto shrink-0">
                                  {request.retryAfter === 0
                                    ? 'Retry now'
                                    : `Retry in ${(request.retryAfter / 1000).toFixed(1)}s`}
                                </Badge>
                              )}
                            </div>
                          ))}
                        {requests.length === 0 && (
                          <p className="py-4 text-center text-xs text-muted-foreground">
                            No requests yet. Start the simulation to see request logs.
                          </p>
                        )}
                      </div>
                    </section>
                  </>
                ),
              },
            ]}
          />
        )}
        <SimPhoneBar>
          <Button type="button" className="h-10 flex-1" onClick={handleToggle}>
            {isRunning ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            {isRunning ? 'Stop' : 'Start'}
          </Button>
          <Button type="button" variant="outline" className="h-10" onClick={resetSimulation}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset run
          </Button>
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
