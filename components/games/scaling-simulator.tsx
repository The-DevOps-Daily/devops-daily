'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MotionConfig } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
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
import { Play, Pause, Server, TrendingUp, Plus, Minus } from 'lucide-react';

// Types
interface ServerInstance {
  id: string;
  cpuCores: number;
  ramGB: number;
  diskType: 'HDD' | 'SSD' | 'NVMe';
  networkGbps: number;
  currentLoad: number;
  requestsHandled: number;
  status: 'healthy' | 'overloaded' | 'starting' | 'stopping';
  startTime: number;
}

interface ScalingConfig {
  autoScalingEnabled: boolean;
  minInstances: number;
  maxInstances: number;
  cpuThreshold: number;
  scaleUpDelay: number;
  scaleDownDelay: number;
}

interface Metrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  currentRPS: number;
  uptime: number;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  trafficPattern: (time: number) => number;
  budget: number;
  targetResponseTime: number;
  duration: number;
}

// Pricing (monthly cost approximations)
const PRICING = {
  cpu: { 2: 15, 4: 30, 8: 60, 16: 120 },
  ram: { 4: 10, 8: 20, 16: 40, 32: 80, 64: 160 },
  disk: { HDD: 5, SSD: 15, NVMe: 30 },
  network: { 1: 0, 10: 25 },
  loadBalancer: 25,
  autoScaling: 10,
};

// Every added server starts as 2 cores, 4 GB RAM, SSD, 1 Gbps
const NEW_SERVER_COST = PRICING.cpu[2] + PRICING.ram[4] + PRICING.disk.SSD + PRICING.network[1];

// Scenarios
const SCENARIOS: Scenario[] = [
  {
    id: 'gradual',
    name: 'Gradual Growth',
    description: 'Linear traffic increase from 100 to 500 users/sec',
    difficulty: 'Easy',
    trafficPattern: (time) => Math.min(100 + time * 2, 500),
    budget: 200,
    targetResponseTime: 200,
    duration: 200,
  },
  {
    id: 'spike',
    name: 'Sudden Spike',
    description: 'Traffic jumps from 100 to 1000 users/sec instantly',
    difficulty: 'Medium',
    trafficPattern: (time) => (time < 30 ? 100 : 1000),
    budget: 300,
    targetResponseTime: 200,
    duration: 150,
  },
  {
    id: 'variable',
    name: 'Variable Load',
    description: 'Unpredictable traffic: 50 → 500 → 100 → 800',
    difficulty: 'Hard',
    trafficPattern: (time) => {
      const phase = Math.floor(time / 40) % 4;
      const patterns = [50, 500, 100, 800];
      return patterns[phase];
    },
    budget: 350,
    targetResponseTime: 200,
    duration: 200,
  },
  {
    id: 'blackfriday',
    name: 'Black Friday',
    description: 'Massive spike: 100 → 5000 users/sec with budget constraints',
    difficulty: 'Expert',
    trafficPattern: (time) => {
      if (time < 20) return 100;
      if (time < 40) return 100 + (time - 20) * 245;
      return 5000;
    },
    // The cheapest setup that meets both targets: a load balancer plus three
    // 16-core/4 GB/NVMe servers and one 16-core/4 GB/SSD server
    budget: 650,
    targetResponseTime: 300,
    duration: 180,
  },
];

// Helper functions
const calculateServerCapacity = (server: ServerInstance): number => {
  const cpuFactor = server.cpuCores * 50;
  const ramFactor = server.ramGB * 10;
  const diskFactor = server.diskType === 'NVMe' ? 1.5 : server.diskType === 'SSD' ? 1.2 : 1;
  return Math.floor(cpuFactor + ramFactor) * diskFactor;
};

const calculateServerCost = (server: ServerInstance): number => {
  const cpuCost = PRICING.cpu[server.cpuCores as keyof typeof PRICING.cpu] || 15;
  const ramCost = PRICING.ram[server.ramGB as keyof typeof PRICING.ram] || 10;
  const diskCost = PRICING.disk[server.diskType];
  const networkCost = PRICING.network[server.networkGbps as keyof typeof PRICING.network] || 0;
  return cpuCost + ramCost + diskCost + networkCost;
};

const calculateResponseTime = (load: number): number => {
  if (load < 0.5) return 50 + load * 100;
  if (load < 0.8) return 100 + (load - 0.5) * 200;
  if (load < 1) return 160 + (load - 0.8) * 500;
  return 260 + (load - 1) * 1000;
};

type ScalingMissionState = {
  servers: ServerInstance[];
  hasLoadBalancer: boolean;
  gameResult: 'playing' | 'won' | 'lost';
};

const MISSIONS: Mission<ScalingMissionState>[] = [
  {
    id: 'scale-up',
    label: 'Scale up: give a server more CPU or RAM.',
    hint: 'Vertical scaling makes one machine bigger.',
    check: ({ servers }) => servers.some((server) => server.cpuCores > 2 || server.ramGB > 4),
  },
  {
    id: 'scale-out',
    label: 'Scale out: add a server behind a load balancer.',
    hint: 'Horizontal scaling adds machines.',
    check: ({ servers, hasLoadBalancer }) => servers.length >= 2 && hasLoadBalancer,
  },
  {
    id: 'win',
    label: 'Get through a traffic scenario without going over budget.',
    hint: 'Watch the cost line as the rush comes in.',
    check: ({ gameResult }) => gameResult === 'won',
  },
];

export default function ScalingSimulator() {
  // State
  const [scenario, setScenario] = useState<Scenario>(SCENARIOS[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [servers, setServers] = useState<ServerInstance[]>([]);
  const [hasLoadBalancer, setHasLoadBalancer] = useState(false);
  const [scalingConfig, setScalingConfig] = useState<ScalingConfig>({
    autoScalingEnabled: false,
    minInstances: 1,
    maxInstances: 10,
    cpuThreshold: 70,
    scaleUpDelay: 5,
    scaleDownDelay: 300,
  });
  const [metrics, setMetrics] = useState<Metrics>({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    currentRPS: 0,
    uptime: 100,
  });
  const [budget, setBudget] = useState(0);
  const [peakCost, setPeakCost] = useState(0);
  const [trafficHistory, setTrafficHistory] = useState<number[]>([]);
  const [responseTimeHistory, setResponseTimeHistory] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState('vertical');
  const [gameResult, setGameResult] = useState<'playing' | 'won' | 'lost'>('playing');
  const [dismissed, setDismissed] = useState(false);
  const [tab, setTab] = useState<'rack' | 'charts' | 'details'>('rack');
  const scaleUpTimer = useRef<number | null>(null);
  const scaleDownTimer = useRef<number | null>(null);

  // Initialize with one server
  useEffect(() => {
    if (servers.length === 0) {
      addServer();
    }
  }, []);

  // Calculate total costs
  const totalCost = useCallback(() => {
    let cost = servers.reduce((sum, s) => sum + calculateServerCost(s), 0);
    if (hasLoadBalancer) cost += PRICING.loadBalancer;
    if (scalingConfig.autoScalingEnabled) cost += PRICING.autoScaling;
    return cost;
  }, [servers, hasLoadBalancer, scalingConfig.autoScalingEnabled]);

  // Add a new server
  const addServer = useCallback(() => {
    // Limit to maxInstances servers
    if (servers.length >= scalingConfig.maxInstances) {
      return;
    }
    const newServer: ServerInstance = {
      id: `server-${Date.now()}`,
      cpuCores: 2,
      ramGB: 4,
      diskType: 'SSD',
      networkGbps: 1,
      currentLoad: 0,
      requestsHandled: 0,
      status: servers.length === 0 ? 'healthy' : 'starting',
      startTime: time,
    };
    setServers((prev) => [...prev, newServer]);

    // Server startup time (3 simulated seconds)
    if (servers.length > 0) {
      setTimeout(() => {
        setServers((prev) =>
          prev.map((s) => (s.id === newServer.id ? { ...s, status: 'healthy' } : s))
        );
      }, 3000 / speed);
    }
  }, [servers.length, time, speed, scalingConfig.maxInstances]);

  // Remove a server
  const removeServer = useCallback(
    (serverId: string) => {
      if (servers.length <= 1) return;
      setServers((prev) => prev.map((s) => (s.id === serverId ? { ...s, status: 'stopping' } : s)));
      setTimeout(() => {
        setServers((prev) => prev.filter((s) => s.id !== serverId));
      }, 2000 / speed);
    },
    [servers.length, speed]
  );

  // Upgrade server specs
  const upgradeServer = useCallback(
    (serverId: string, upgrade: Partial<ServerInstance>) => {
      // Vertical scaling requires downtime
      setServers((prev) => prev.map((s) => (s.id === serverId ? { ...s, status: 'stopping' } : s)));
      setTimeout(() => {
        setServers((prev) =>
          prev.map((s) => (s.id === serverId ? { ...s, ...upgrade, status: 'starting' } : s))
        );
      }, 1500 / speed);
      setTimeout(() => {
        setServers((prev) =>
          prev.map((s) => (s.id === serverId ? { ...s, status: 'healthy' } : s))
        );
      }, 3000 / speed);
    },
    [speed]
  );

  // Game loop
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      // Spending counts at its peak, so downsizing before the end does not hide it
      const peak = Math.max(peakCost, totalCost());
      setPeakCost(peak);

      // Record this tick, then judge the run on the completed tick's numbers
      const finishTick = (next: Metrics) => {
        setMetrics(next);
        setTime(time + 1);
        if (time + 1 >= scenario.duration) {
          setIsRunning(false);
          const won =
            next.uptime >= 95 &&
            next.avgResponseTime <= scenario.targetResponseTime &&
            peak <= scenario.budget;
          setGameResult(won ? 'won' : 'lost');
        }
      };

      // Calculate current traffic
      const currentTraffic = scenario.trafficPattern(time);
      setTrafficHistory((prev) => [...prev.slice(-60), currentTraffic]);

      // Distribute load across running servers. Overloaded servers keep serving,
      // so they go back to healthy when their load drops
      const healthyServers = servers.filter(
        (s) => s.status === 'healthy' || s.status === 'overloaded'
      );
      if (healthyServers.length === 0) {
        const newTotal = metrics.totalRequests + currentTraffic;
        finishTick({
          ...metrics,
          failedRequests: metrics.failedRequests + currentTraffic,
          totalRequests: newTotal,
          currentRPS: currentTraffic,
          uptime: newTotal > 0 ? (metrics.successfulRequests / newTotal) * 100 : 100,
        });
        return;
      }

      // The load balancer splits traffic equally (round robin). Without one, all
      // traffic goes to the first server
      const trafficFor = (index: number) =>
        hasLoadBalancer ? currentTraffic / healthyServers.length : index === 0 ? currentTraffic : 0;

      // Calculate what the new server loads will be
      const newServerLoads = healthyServers.map(
        (s, index) => trafficFor(index) / calculateServerCapacity(s)
      );
      const avgLoad = hasLoadBalancer
        ? newServerLoads.reduce((sum, load) => sum + load, 0) / newServerLoads.length
        : newServerLoads[0];

      // Update server loads in state
      setServers((prev) =>
        prev.map((s) => {
          const index = healthyServers.findIndex((h) => h.id === s.id);
          if (index === -1 || (s.status !== 'healthy' && s.status !== 'overloaded')) return s;
          const serverLoad = newServerLoads[index];
          return {
            ...s,
            currentLoad: Math.min(serverLoad, 2),
            requestsHandled: s.requestsHandled + Math.floor(trafficFor(index)),
            status: serverLoad > 1.5 ? 'overloaded' : 'healthy',
          };
        })
      );

      // Calculate response time and update metrics
      const responseTime = calculateResponseTime(avgLoad);
      setResponseTimeHistory((prev) => [...prev.slice(-60), responseTime]);

      // Each server fails whatever it is sent beyond its own capacity
      const failedThisSecond = Math.floor(
        healthyServers.reduce(
          (sum, s, index) => sum + Math.max(0, trafficFor(index) - calculateServerCapacity(s)),
          0
        )
      );
      const successfulThisSecond = currentTraffic - failedThisSecond;

      const newTotal = metrics.totalRequests + currentTraffic;
      const newSuccessful = metrics.successfulRequests + successfulThisSecond;
      finishTick({
        totalRequests: newTotal,
        successfulRequests: newSuccessful,
        failedRequests: metrics.failedRequests + failedThisSecond,
        avgResponseTime: Math.round(
          (metrics.avgResponseTime * metrics.totalRequests + responseTime * currentTraffic) /
            newTotal
        ),
        currentRPS: currentTraffic,
        uptime: newTotal > 0 ? (newSuccessful / newTotal) * 100 : 100,
      });

      // Auto-scaling logic
      if (scalingConfig.autoScalingEnabled && hasLoadBalancer) {
        const avgCpuUsage = avgLoad * 100;

        // Scale up to meet minimum instances requirement
        if (healthyServers.length < scalingConfig.minInstances) {
          if (!scaleUpTimer.current) {
            scaleUpTimer.current = window.setTimeout(
              () => {
                addServer();
                scaleUpTimer.current = null;
              },
              (scalingConfig.scaleUpDelay * 1000) / speed
            );
          }
        }
        // Scale up based on CPU threshold
        else if (
          avgCpuUsage > scalingConfig.cpuThreshold &&
          healthyServers.length < scalingConfig.maxInstances
        ) {
          if (!scaleUpTimer.current) {
            scaleUpTimer.current = window.setTimeout(
              () => {
                addServer();
                scaleUpTimer.current = null;
              },
              (scalingConfig.scaleUpDelay * 1000) / speed
            );
          }
        } else if (scaleUpTimer.current) {
          clearTimeout(scaleUpTimer.current);
          scaleUpTimer.current = null;
        }

        if (
          avgCpuUsage < scalingConfig.cpuThreshold / 2 &&
          healthyServers.length > scalingConfig.minInstances
        ) {
          if (!scaleDownTimer.current) {
            scaleDownTimer.current = window.setTimeout(
              () => {
                const serverToRemove = healthyServers[healthyServers.length - 1];
                if (serverToRemove) removeServer(serverToRemove.id);
                scaleDownTimer.current = null;
              },
              (scalingConfig.scaleDownDelay * 1000) / speed
            );
          }
        } else if (scaleDownTimer.current) {
          clearTimeout(scaleDownTimer.current);
          scaleDownTimer.current = null;
        }
      }
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [
    isRunning,
    time,
    scenario,
    servers,
    hasLoadBalancer,
    scalingConfig,
    speed,
    addServer,
    removeServer,
    metrics,
    totalCost,
    peakCost,
  ]);

  // Immediately scale to minInstances when auto-scaling is enabled
  useEffect(() => {
    if (!scalingConfig.autoScalingEnabled || !hasLoadBalancer) return;

    const healthyServers = servers.filter(
      (s) => s.status === 'healthy' || s.status === 'overloaded' || s.status === 'starting'
    );

    // Scale up if below minimum
    if (healthyServers.length < scalingConfig.minInstances) {
      const timer = setTimeout(() => {
        addServer();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    scalingConfig.autoScalingEnabled,
    scalingConfig.minInstances,
    hasLoadBalancer,
    servers,
    addServer,
    removeServer,
  ]);

  // Reset game
  const reset = useCallback(() => {
    setIsRunning(false);
    setTime(0);
    setServers([]);
    setHasLoadBalancer(false);
    setScalingConfig({
      autoScalingEnabled: false,
      minInstances: 1,
      maxInstances: 10,
      cpuThreshold: 70,
      scaleUpDelay: 5,
      scaleDownDelay: 300,
    });
    setMetrics({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      currentRPS: 0,
      uptime: 100,
    });
    setTrafficHistory([]);
    setResponseTimeHistory([]);
    setGameResult('playing');
    setPeakCost(0);
    // Add initial server after reset
    setTimeout(() => {
      setServers([
        {
          id: `server-${Date.now()}`,
          cpuCores: 2,
          ramGB: 4,
          diskType: 'SSD',
          networkGbps: 1,
          currentLoad: 0,
          requestsHandled: 0,
          status: 'healthy',
          startTime: 0,
        },
      ]);
    }, 0);
  }, []);

  const currentCost = totalCost();
  const budgetUsed = (currentCost / scenario.budget) * 100;
  const missionState = useMemo(
    () => ({ servers, hasLoadBalancer, gameResult }),
    [servers, hasLoadBalancer, gameResult]
  );
  const missions = useMissions(MISSIONS, missionState);

  const startOver = () => {
    reset();
    missions.reset();
    setDismissed(false);
  };

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="Scaling Simulator"
          icon={TrendingUp}
          lead={
            <label className="flex items-center gap-2 text-sm font-medium">
              Scenario
              <select
                aria-label="Scenario"
                value={scenario.id}
                disabled={isRunning}
                onChange={(event) => {
                  const nextScenario = SCENARIOS.find((item) => item.id === event.target.value);
                  if (!nextScenario) return;
                  setScenario(nextScenario);
                  reset();
                  missions.reset();
                  setDismissed(false);
                }}
                className="h-10 min-w-0 rounded-md border bg-background px-2 text-sm lg:h-8"
              >
                {SCENARIOS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}: {item.difficulty}
                  </option>
                ))}
              </select>
            </label>
          }
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={isRunning ? 'Traffic rush in progress' : 'Build the service for the rush'}
          actions={
            <RunControls
              isRunning={isRunning}
              gameResult={gameResult}
              speed={speed}
              onSpeed={setSpeed}
              onToggle={() => setIsRunning(!isRunning)}
              onReset={startOver}
            />
          }
          meta={
            <Badge variant="secondary" className="font-mono tabular-nums">
              {time}s / {scenario.duration}s
            </Badge>
          }
          goal={
            missions.complete ? (
              'All three done. Keep tuning the service.'
            ) : (
              <>
                {missions.current?.label}{' '}
                <span className="text-muted-foreground">{missions.current?.hint}</span>
              </>
            )
          }
        />
        <SimAnnouncer
          message={`${servers.length} server${servers.length === 1 ? '' : 's'}, ${metrics.currentRPS} requests per second, and ${Math.round(budgetUsed)} percent of budget in use.`}
        />

        {missions.complete && !dismissed ? (
          <SimComplete
            title="Scaling missions complete"
            summary="You made a server bigger, put more machines behind a load balancer, and completed a traffic rush within budget."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Peak cost', value: `$${peakCost}` },
              { label: 'Uptime', value: `${metrics.uptime.toFixed(1)}%` },
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
            columns="lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)]"
            minHeight="min-h-[26rem]"
            tab={tab}
            onTabChange={(next) => {
              if (next === 'rack' || next === 'charts' || next === 'details') setTab(next);
            }}
            tabsLabel="Scaling simulator panels"
            panels={[
              {
                id: 'rack',
                label: 'Server rack',
                content: (
                  <div className="space-y-2">
                    {gameResult === 'lost' && (
                      <SimFeedback tone="danger" label="Challenge failed">
                        <p>
                          Uptime: {metrics.uptime.toFixed(1)}% · Average response:{' '}
                          {metrics.avgResponseTime}ms · Peak cost: ${peakCost}/${scenario.budget}
                        </p>
                      </SimFeedback>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Metric label="Traffic" value={`${metrics.currentRPS} req/s`} />
                      <Metric
                        label="Response"
                        value={`${metrics.avgResponseTime}ms`}
                        tone={
                          metrics.avgResponseTime > scenario.targetResponseTime
                            ? 'danger'
                            : 'success'
                        }
                      />
                      <Metric
                        label="Uptime"
                        value={`${metrics.uptime.toFixed(1)}%`}
                        tone={metrics.uptime < 95 ? 'danger' : 'success'}
                      />
                      <Metric
                        label="Monthly cost"
                        value={`$${currentCost}`}
                        tone={currentCost > scenario.budget ? 'danger' : 'success'}
                      />
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-medium">Budget usage</span>
                        <span>
                          ${currentCost} / ${scenario.budget}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full transition-[width] ${budgetUsed > 100 ? SIM_TONE.danger.fill : SIM_TONE.success.fill}`}
                          style={{ width: `${Math.min(budgetUsed, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">Live server rack</h3>
                        <Badge variant="secondary">
                          {hasLoadBalancer ? 'Load balancer active' : 'No load balancer'}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {servers.map((server, index) => (
                          <div key={server.id} className="rounded-md border bg-muted/30 p-2">
                            <div className="flex justify-between gap-2 text-sm font-medium">
                              <span className="flex items-center gap-2">
                                <Server className="h-4 w-4 text-primary" aria-hidden="true" />
                                Server {index + 1}
                              </span>
                              <span>{server.status}</span>
                            </div>
                            <div className="mt-1 grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                              <span>{server.cpuCores} CPU</span>
                              <span>{server.ramGB} GB RAM</span>
                              <span>{calculateServerCapacity(server)} req/s</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                id: 'charts',
                label: 'Live charts',
                content: (
                  <div className="space-y-2">
                    <Chart
                      title="Traffic pattern"
                      values={trafficHistory}
                      ceiling={5000}
                      empty="Start the simulation to see traffic."
                    />
                    <Chart
                      title="Response time"
                      values={responseTimeHistory}
                      ceiling={Math.max(scenario.targetResponseTime * 2, 400)}
                      empty="Response times appear with the first tick."
                      tone={
                        responseTimeHistory.some((value) => value > scenario.targetResponseTime)
                          ? 'danger'
                          : 'success'
                      }
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Metric
                        label="Total requests"
                        value={metrics.totalRequests.toLocaleString()}
                      />
                      <Metric
                        label="Successful"
                        value={metrics.successfulRequests.toLocaleString()}
                      />
                      <Metric label="Failed" value={metrics.failedRequests.toLocaleString()} />
                      <Metric
                        label="Healthy servers"
                        value={`${servers.filter((server) => server.status === 'healthy').length} / ${servers.length}`}
                      />
                    </div>
                  </div>
                ),
              },
              {
                id: 'details',
                label: 'Scaling controls',
                content: (
                  <div className="space-y-2">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="grid h-auto w-full grid-cols-3">
                        <TabsTrigger
                          value="vertical"
                          className="h-10 text-xs"
                          onClick={() => setActiveTab('vertical')}
                        >
                          Vertical
                        </TabsTrigger>
                        <TabsTrigger
                          value="horizontal"
                          className="h-10 text-xs"
                          onClick={() => setActiveTab('horizontal')}
                        >
                          Horizontal
                        </TabsTrigger>
                        <TabsTrigger
                          value="auto"
                          className="h-10 text-xs"
                          onClick={() => setActiveTab('auto')}
                        >
                          Autoscaling
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="vertical" className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Upgrade one machine. Changes take it through a short restart.
                        </p>
                        {servers.map((server, index) => (
                          <div key={server.id} className="space-y-3 rounded-lg border bg-card p-3">
                            <div className="flex justify-between gap-2">
                              <h3 className="font-medium">Server {index + 1}</h3>
                              <span className="text-sm text-muted-foreground">
                                ${calculateServerCost(server)}/mo
                              </span>
                            </div>
                            <Adjuster
                              label="CPU cores"
                              value={server.cpuCores}
                              down={`Decrease CPU for Server ${index + 1}`}
                              up={`Increase CPU for Server ${index + 1}`}
                              disableDown={server.cpuCores <= 2 || isRunning}
                              disableUp={server.cpuCores >= 16 || isRunning}
                              onDown={() =>
                                upgradeServer(server.id, { cpuCores: server.cpuCores / 2 })
                              }
                              onUp={() =>
                                upgradeServer(server.id, { cpuCores: server.cpuCores * 2 })
                              }
                            />
                            <Adjuster
                              label="RAM (GB)"
                              value={server.ramGB}
                              down={`Decrease RAM for Server ${index + 1}`}
                              up={`Increase RAM for Server ${index + 1}`}
                              disableDown={server.ramGB <= 4 || isRunning}
                              disableUp={server.ramGB >= 64 || isRunning}
                              onDown={() => upgradeServer(server.id, { ramGB: server.ramGB / 2 })}
                              onUp={() => upgradeServer(server.id, { ramGB: server.ramGB * 2 })}
                            />
                          </div>
                        ))}
                      </TabsContent>
                      <TabsContent value="horizontal" className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Add machines and distribute requests through a load balancer.
                        </p>
                        <Button
                          type="button"
                          variant={hasLoadBalancer ? 'default' : 'outline'}
                          className="h-10 w-full"
                          aria-pressed={hasLoadBalancer}
                          onClick={() => setHasLoadBalancer(!hasLoadBalancer)}
                        >
                          {hasLoadBalancer ? 'Load balancer active' : 'Add load balancer'} · $
                          {PRICING.loadBalancer}/mo
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-full"
                          onClick={addServer}
                          disabled={servers.length >= scalingConfig.maxInstances}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Add server · +${NEW_SERVER_COST}/mo
                        </Button>
                        {servers.length > 1 &&
                          servers.map((server, index) => (
                            <Button
                              key={server.id}
                              type="button"
                              variant="outline"
                              className="h-10 w-full justify-between"
                              onClick={() => removeServer(server.id)}
                            >
                              Remove Server {index + 1}
                              <Minus className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          ))}
                      </TabsContent>
                      <TabsContent value="auto" className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Set CPU thresholds and instance bounds for automatic changes.
                        </p>
                        <Button
                          type="button"
                          variant={scalingConfig.autoScalingEnabled ? 'default' : 'outline'}
                          className="h-10 w-full"
                          aria-pressed={scalingConfig.autoScalingEnabled}
                          onClick={() =>
                            setScalingConfig((prev) => ({
                              ...prev,
                              autoScalingEnabled: !prev.autoScalingEnabled,
                            }))
                          }
                          disabled={!hasLoadBalancer}
                        >
                          {scalingConfig.autoScalingEnabled
                            ? 'Autoscaling enabled'
                            : 'Enable autoscaling'}{' '}
                          · +${PRICING.autoScaling}/mo
                        </Button>
                        {!hasLoadBalancer && (
                          <SimFeedback tone="warning" label="Load balancer required">
                            <p>Enable it in Horizontal scaling before turning on autoscaling.</p>
                          </SimFeedback>
                        )}
                        <div className="space-y-3 rounded-lg border bg-card p-3">
                          <Range
                            label="CPU threshold"
                            value={scalingConfig.cpuThreshold}
                            min={50}
                            max={90}
                            step={5}
                            suffix="%"
                            onChange={(value) =>
                              setScalingConfig((prev) => ({ ...prev, cpuThreshold: value }))
                            }
                          />
                          <Range
                            label="Min instances"
                            value={scalingConfig.minInstances}
                            min={1}
                            max={5}
                            step={1}
                            onChange={(value) =>
                              setScalingConfig((prev) => ({ ...prev, minInstances: value }))
                            }
                          />
                          <Range
                            label="Max instances"
                            value={scalingConfig.maxInstances}
                            min={2}
                            max={20}
                            step={1}
                            onChange={(value) =>
                              setScalingConfig((prev) => ({ ...prev, maxInstances: value }))
                            }
                          />
                        </div>
                      </TabsContent>
                    </Tabs>
                    <SimMissionList missions={missions.missions} />
                    <details className="rounded-lg border bg-card p-3">
                      <summary className="cursor-pointer text-sm font-semibold">
                        Scaling guide
                      </summary>
                      <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                        <p>
                          Vertical scaling increases CPU or RAM on one server, but upgrades briefly
                          take that machine out of service.
                        </p>
                        <p>
                          Horizontal scaling adds servers. A load balancer turns that larger rack
                          into shared capacity and better resilience.
                        </p>
                        <p>
                          Autoscaling follows the configured CPU threshold. Cost is measured at its
                          peak, so shrinking at the end does not erase spending.
                        </p>
                      </div>
                    </details>
                  </div>
                ),
              },
            ]}
          />
        )}
        <SimPhoneBar>
          <RunControls
            isRunning={isRunning}
            gameResult={gameResult}
            speed={speed}
            onSpeed={setSpeed}
            onToggle={() => setIsRunning(!isRunning)}
            onReset={startOver}
          />
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}

function RunControls({
  isRunning,
  gameResult,
  speed,
  onSpeed,
  onToggle,
  onReset,
}: {
  isRunning: boolean;
  gameResult: 'playing' | 'won' | 'lost';
  speed: number;
  onSpeed: (speed: number) => void;
  onToggle: () => void;
  onReset: () => void;
}) {
  return (
    <>
      <Button
        type="button"
        variant={isRunning ? 'destructive' : 'default'}
        className="h-10 flex-1 lg:h-8"
        onClick={onToggle}
        disabled={gameResult !== 'playing'}
      >
        {isRunning ? (
          <Pause className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Play className="h-4 w-4" aria-hidden="true" />
        )}
        {isRunning ? 'Pause' : 'Start'}
      </Button>
      <Button type="button" variant="outline" className="h-10 flex-1 lg:h-8" onClick={onReset}>
        Reset
      </Button>
      <div className="hidden items-center gap-1 lg:flex" role="group" aria-label="Speed">
        {[1, 2, 5, 10].map((item) => (
          <Button
            key={item}
            type="button"
            variant={speed === item ? 'default' : 'outline'}
            className="h-8 min-w-8 px-2"
            aria-pressed={speed === item}
            onClick={() => onSpeed(item)}
          >
            {item}x
          </Button>
        ))}
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
}) {
  return (
    <div className={`rounded-lg border bg-card p-2 ${tone ? SIM_TONE[tone].surface : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Chart({
  title,
  values,
  ceiling,
  empty,
  tone = 'info',
}: {
  title: string;
  values: number[];
  ceiling: number;
  empty: string;
  tone?: 'success' | 'danger' | 'info';
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 flex h-28 items-end gap-px rounded-md bg-muted p-2">
        {values.length > 0 ? (
          values.map((value, index) => (
            <div
              key={index}
              className={`min-w-px flex-1 rounded-t ${SIM_TONE[tone].fill}`}
              style={{ height: `${Math.max((value / ceiling) * 100, 2)}%` }}
            />
          ))
        ) : (
          <p className="m-auto text-sm text-muted-foreground">{empty}</p>
        )}
      </div>
    </div>
  );
}

function Adjuster({
  label,
  value,
  down,
  up,
  disableDown,
  disableUp,
  onDown,
  onUp,
}: {
  label: string;
  value: number;
  down: string;
  up: string;
  disableDown: boolean;
  disableUp: boolean;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-10 w-10 p-0 lg:h-8 lg:w-8"
          aria-label={down}
          disabled={disableDown}
          onClick={onDown}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </Button>
        <span className="w-10 text-center font-mono text-sm">{value}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-10 w-10 p-0 lg:h-8 lg:w-8"
          aria-label={up}
          disabled={disableUp}
          onClick={onUp}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between gap-2">
        <label className="text-sm font-medium">{label}</label>
        <span className="font-mono text-sm">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([next]) => onChange(next)}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}
