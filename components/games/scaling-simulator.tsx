'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  Pause,
  RotateCcw,
  Server,
  Cpu,
  HardDrive,
  Zap,
  DollarSign,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  Settings,
  Info,
} from 'lucide-react';

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
    budget: 500,
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
    scaleUpDelay: 30,
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
  const [trafficHistory, setTrafficHistory] = useState<number[]>([]);
  const [responseTimeHistory, setResponseTimeHistory] = useState<number[]>([]);
  const [showEducation, setShowEducation] = useState(false);
  const [activeTab, setActiveTab] = useState('vertical');
  const [gameResult, setGameResult] = useState<'playing' | 'won' | 'lost'>('playing');
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

    // Server startup time (30 seconds simulation)
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
      setServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, status: 'stopping' } : s))
      );
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
      setServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, status: 'stopping' } : s))
      );
      setTimeout(() => {
        setServers((prev) =>
          prev.map((s) =>
            s.id === serverId ? { ...s, ...upgrade, status: 'starting' } : s
          )
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
      setTime((t) => {
        const newTime = t + 1;
        if (newTime >= scenario.duration) {
          setIsRunning(false);
          // Check win condition
          if (metrics.uptime >= 95 && totalCost() <= scenario.budget) {
            setGameResult('won');
          } else {
            setGameResult('lost');
          }
        }
        return newTime;
      });

      // Calculate current traffic
      const currentTraffic = scenario.trafficPattern(time);
      setTrafficHistory((prev) => [...prev.slice(-60), currentTraffic]);

      // Distribute load across healthy servers
      const healthyServers = servers.filter((s) => s.status === 'healthy');
      if (healthyServers.length === 0) {
        setMetrics((prev) => ({
          ...prev,
          failedRequests: prev.failedRequests + currentTraffic,
          totalRequests: prev.totalRequests + currentTraffic,
          currentRPS: currentTraffic,
          uptime: Math.max(0, prev.uptime - 5),
        }));
        return;
      }

      const totalCapacity = healthyServers.reduce(
        (sum, s) => sum + calculateServerCapacity(s),
        0
      );
      const overallLoad = currentTraffic / totalCapacity;

      // Update server loads
      setServers((prev) =>
        prev.map((s) => {
          if (s.status !== 'healthy') return s;
          const serverCapacity = calculateServerCapacity(s);
          const serverLoad = hasLoadBalancer
            ? currentTraffic / healthyServers.length / serverCapacity
            : currentTraffic / serverCapacity;
          return {
            ...s,
            currentLoad: Math.min(serverLoad, 2),
            requestsHandled: s.requestsHandled + Math.floor(currentTraffic / healthyServers.length),
            status: serverLoad > 1.5 ? 'overloaded' : 'healthy',
          };
        })
      );

      // Calculate response time and update metrics
      const avgLoad =
        healthyServers.reduce((sum, s) => sum + s.currentLoad, 0) / healthyServers.length;
      const responseTime = calculateResponseTime(avgLoad);
      setResponseTimeHistory((prev) => [...prev.slice(-60), responseTime]);

      const failedThisSecond =
        overallLoad > 1 ? Math.floor((overallLoad - 1) * currentTraffic) : 0;
      const successfulThisSecond = currentTraffic - failedThisSecond;

      setMetrics((prev) => {
        const newTotal = prev.totalRequests + currentTraffic;
        const newSuccessful = prev.successfulRequests + successfulThisSecond;
        const newFailed = prev.failedRequests + failedThisSecond;
        return {
          totalRequests: newTotal,
          successfulRequests: newSuccessful,
          failedRequests: newFailed,
          avgResponseTime: Math.round(
            (prev.avgResponseTime * prev.totalRequests + responseTime * currentTraffic) /
              newTotal
          ),
          currentRPS: currentTraffic,
          uptime: newTotal > 0 ? (newSuccessful / newTotal) * 100 : 100,
        };
      });

      // Auto-scaling logic
      if (scalingConfig.autoScalingEnabled && hasLoadBalancer) {
        const avgCpuUsage = avgLoad * 100;

        // Scale up to meet minimum instances requirement
        if (healthyServers.length < scalingConfig.minInstances) {
          if (!scaleUpTimer.current) {
            scaleUpTimer.current = window.setTimeout(() => {
              addServer();
              scaleUpTimer.current = null;
            }, (scalingConfig.scaleUpDelay * 1000) / speed);
          }
        }
        // Scale up based on CPU threshold
        else if (avgCpuUsage > scalingConfig.cpuThreshold && healthyServers.length < scalingConfig.maxInstances) {
          if (!scaleUpTimer.current) {
            scaleUpTimer.current = window.setTimeout(() => {
              addServer();
              scaleUpTimer.current = null;
            }, (scalingConfig.scaleUpDelay * 1000) / speed);
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
            scaleDownTimer.current = window.setTimeout(() => {
              const serverToRemove = healthyServers[healthyServers.length - 1];
              if (serverToRemove) removeServer(serverToRemove.id);
              scaleDownTimer.current = null;
            }, (scalingConfig.scaleDownDelay * 1000) / speed);
          }
        } else if (scaleDownTimer.current) {
          clearTimeout(scaleDownTimer.current);
          scaleDownTimer.current = null;
        }
      }
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [isRunning, time, scenario, servers, hasLoadBalancer, scalingConfig, speed, addServer, removeServer, metrics, totalCost]);

  // Immediately scale to minInstances when auto-scaling is enabled
  useEffect(() => {
    if (!scalingConfig.autoScalingEnabled || !hasLoadBalancer) return;
    
    const healthyServers = servers.filter((s) => s.status === 'healthy' || s.status === 'starting');
    if (healthyServers.length < scalingConfig.minInstances) {
      // Add servers one at a time with a small delay
      const timer = setTimeout(() => {
        addServer();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [scalingConfig.autoScalingEnabled, scalingConfig.minInstances, hasLoadBalancer, servers, addServer]);

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
      scaleUpDelay: 30,
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
    // Add initial server after reset
    setTimeout(() => {
      setServers([{
        id: `server-${Date.now()}`,
        cpuCores: 2,
        ramGB: 4,
        diskType: 'SSD',
        networkGbps: 1,
        currentLoad: 0,
        requestsHandled: 0,
        status: 'healthy',
        startTime: 0,
      }]);
    }, 0);
  }, []);

  const currentCost = totalCost();
  const budgetUsed = (currentCost / scenario.budget) * 100;

  return (
    <div className="space-y-6">
      <Card className="max-w-7xl mx-auto">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Horizontal vs Vertical Scaling Simulator
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Learn scaling strategies by managing traffic under real-world conditions
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEducation(!showEducation)}
            >
              <Info className="h-4 w-4 mr-1" />
              {showEducation ? 'Hide' : 'Show'} Guide
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Educational Panel */}
          {showEducation && (
            <div className="grid gap-4 md:grid-cols-2 p-4 bg-muted/30 rounded-lg">
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Vertical Scaling (Scale Up)
                </h3>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>✓ Increase resources on existing server</li>
                  <li>✓ Simple, no architecture changes</li>
                  <li>✓ No data sync issues</li>
                  <li>✗ Hard limits (biggest machine)</li>
                  <li>✗ Single point of failure</li>
                  <li>✗ Downtime during upgrades</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Server className="h-4 w-4 text-green-500" />
                  Horizontal Scaling (Scale Out)
                </h3>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>✓ Add more servers</li>
                  <li>✓ Nearly unlimited scaling</li>
                  <li>✓ No single point of failure</li>
                  <li>✓ Zero-downtime scaling</li>
                  <li>✗ Requires load balancer</li>
                  <li>✗ More complex architecture</li>
                </ul>
              </div>
            </div>
          )}

          {/* Scenario Selection */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Scenario:</span>
              <div className="flex gap-2 flex-wrap">
                {SCENARIOS.map((s) => (
                  <Button
                    key={s.id}
                    variant={scenario.id === s.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setScenario(s);
                      reset();
                    }}
                    disabled={isRunning}
                  >
                    <Badge
                      variant="secondary"
                      className={`mr-2 text-xs ${
                        s.difficulty === 'Easy'
                          ? 'bg-green-500/20 text-green-600'
                          : s.difficulty === 'Medium'
                            ? 'bg-yellow-500/20 text-yellow-600'
                            : s.difficulty === 'Hard'
                              ? 'bg-orange-500/20 text-orange-600'
                              : 'bg-red-500/20 text-red-600'
                      }`}
                    >
                      {s.difficulty}
                    </Badge>
                    {s.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <Button
              onClick={() => setIsRunning(!isRunning)}
              variant={isRunning ? 'destructive' : 'default'}
              size="sm"
              disabled={gameResult !== 'playing'}
            >
              {isRunning ? (
                <Pause className="h-4 w-4 mr-1" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              {isRunning ? 'Pause' : 'Start'}
            </Button>
            <Button onClick={reset} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-1" /> Reset
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm">Speed:</span>
              {[1, 2, 5, 10].map((s) => (
                <Button
                  key={s}
                  variant={speed === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSpeed(s)}
                >
                  {s}x
                </Button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Time: </span>
                <span className="font-mono">
                  {time}s / {scenario.duration}s
                </span>
              </div>
            </div>
          </div>

          {/* Game Result */}
          {gameResult !== 'playing' && (
            <div
              className={`p-4 rounded-lg border ${
                gameResult === 'won'
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-2">
                {gameResult === 'won' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-semibold">
                  {gameResult === 'won' ? 'Success!' : 'Challenge Failed'}
                </span>
              </div>
              <p className="text-sm mt-2 text-muted-foreground">
                {gameResult === 'won'
                  ? `You maintained ${metrics.uptime.toFixed(1)}% uptime within budget ($${currentCost}/$${scenario.budget})`
                  : `Uptime: ${metrics.uptime.toFixed(1)}% (target: 95%) | Cost: $${currentCost}/$${scenario.budget}`}
              </p>
            </div>
          )}

          {/* Main Dashboard */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Current Traffic
              </div>
              <div className="text-2xl font-bold">{metrics.currentRPS} req/s</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="h-4 w-4" />
                Avg Response Time
              </div>
              <div
                className={`text-2xl font-bold ${
                  metrics.avgResponseTime > scenario.targetResponseTime
                    ? 'text-red-500'
                    : 'text-green-500'
                }`}
              >
                {metrics.avgResponseTime}ms
              </div>
              <div className="text-xs text-muted-foreground">
                Target: {'<'}{scenario.targetResponseTime}ms
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4" />
                Uptime
              </div>
              <div
                className={`text-2xl font-bold ${
                  metrics.uptime < 95 ? 'text-red-500' : 'text-green-500'
                }`}
              >
                {metrics.uptime.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">Target: {'>'}95%</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Monthly Cost
              </div>
              <div
                className={`text-2xl font-bold ${
                  currentCost > scenario.budget ? 'text-red-500' : 'text-green-500'
                }`}
              >
                ${currentCost}
              </div>
              <div className="text-xs text-muted-foreground">Budget: ${scenario.budget}</div>
            </div>
          </div>

          {/* Budget Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Budget Usage</span>
              <span
                className={budgetUsed > 100 ? 'text-red-500' : ''}
              >
                ${currentCost} / ${scenario.budget}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  budgetUsed > 100
                    ? 'bg-red-500'
                    : budgetUsed > 80
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(budgetUsed, 100)}%` }}
              />
            </div>
          </div>

          {/* Scaling Controls */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="vertical">Vertical Scaling</TabsTrigger>
              <TabsTrigger value="horizontal">Horizontal Scaling</TabsTrigger>
              <TabsTrigger value="auto">Auto-Scaling</TabsTrigger>
            </TabsList>

            <TabsContent value="vertical" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upgrade individual server specs. Note: Upgrades require ~30s downtime.
              </p>
              {servers.map((server, index) => (
                <div
                  key={server.id}
                  className="p-4 rounded-lg border bg-card space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      <span className="font-medium">Server {index + 1}</span>
                      <Badge
                        variant="secondary"
                        className={`${
                          server.status === 'healthy'
                            ? 'bg-green-500/20 text-green-600'
                            : server.status === 'overloaded'
                              ? 'bg-red-500/20 text-red-600'
                              : 'bg-yellow-500/20 text-yellow-600'
                        }`}
                      >
                        {server.status}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ${calculateServerCost(server)}/mo
                    </span>
                  </div>

                  {/* Load Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Load</span>
                      <span>{Math.round(server.currentLoad * 100)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          server.currentLoad > 1
                            ? 'bg-red-500'
                            : server.currentLoad > 0.8
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(server.currentLoad * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Upgrade Options */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Cpu className="h-3 w-3" /> CPU Cores
                      </label>
                      <div className="flex items-center gap-1 mt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={server.cpuCores <= 2 || isRunning}
                          onClick={() =>
                            upgradeServer(server.id, {
                              cpuCores: server.cpuCores / 2,
                            })
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-mono">{server.cpuCores}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={server.cpuCores >= 16 || isRunning}
                          onClick={() =>
                            upgradeServer(server.id, {
                              cpuCores: server.cpuCores * 2,
                            })
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Zap className="h-3 w-3" /> RAM (GB)
                      </label>
                      <div className="flex items-center gap-1 mt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={server.ramGB <= 4 || isRunning}
                          onClick={() =>
                            upgradeServer(server.id, { ramGB: server.ramGB / 2 })
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-mono">{server.ramGB}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={server.ramGB >= 64 || isRunning}
                          onClick={() =>
                            upgradeServer(server.id, { ramGB: server.ramGB * 2 })
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <HardDrive className="h-3 w-3" /> Disk
                      </label>
                      <div className="flex gap-1 mt-1">
                        {(['HDD', 'SSD', 'NVMe'] as const).map((disk) => (
                          <Button
                            key={disk}
                            size="sm"
                            variant={server.diskType === disk ? 'default' : 'outline'}
                            disabled={isRunning}
                            onClick={() => upgradeServer(server.id, { diskType: disk })}
                          >
                            {disk}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Capacity</label>
                      <div className="font-mono text-lg">
                        {calculateServerCapacity(server)} req/s
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="horizontal" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Add or remove servers. Requires a load balancer for traffic distribution.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant={hasLoadBalancer ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setHasLoadBalancer(!hasLoadBalancer)}
                  >
                    {hasLoadBalancer ? 'LB Active' : 'Add Load Balancer'}
                    <Badge variant="secondary" className="ml-2">
                      +${PRICING.loadBalancer}/mo
                    </Badge>
                  </Button>
                </div>
              </div>

              {!hasLoadBalancer && servers.length > 1 && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm">
                  <AlertTriangle className="h-4 w-4 inline mr-2 text-yellow-500" />
                  Without a load balancer, all traffic goes to the first server!
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {servers.map((server, index) => (
                  <div
                    key={server.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      server.status === 'healthy'
                        ? 'border-green-500/30 bg-green-500/5'
                        : server.status === 'overloaded'
                          ? 'border-red-500/30 bg-red-500/5'
                          : 'border-yellow-500/30 bg-yellow-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        <span className="font-medium">Server {index + 1}</span>
                      </div>
                      {servers.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeServer(server.id)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge
                          variant="secondary"
                          className={`${
                            server.status === 'healthy'
                              ? 'bg-green-500/20 text-green-600'
                              : server.status === 'overloaded'
                                ? 'bg-red-500/20 text-red-600'
                                : 'bg-yellow-500/20 text-yellow-600'
                          }`}
                        >
                          {server.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Load</span>
                        <span>{Math.round(server.currentLoad * 100)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Requests</span>
                        <span>{server.requestsHandled.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Capacity</span>
                        <span>{calculateServerCapacity(server)} req/s</span>
                      </div>
                    </div>
                  </div>
                ))}
              <Button
                variant="outline"
                className="h-full min-h-[150px] border-dashed"
                onClick={addServer}
                 disabled={servers.length >= scalingConfig.maxInstances}
              >
                <Plus className="h-6 w-6 mr-2" />
                Add Server
                <Badge variant="secondary" className="ml-2">
                   {servers.length >= scalingConfig.maxInstances
                     ? `Max ${scalingConfig.maxInstances}`
                     : '+$20/mo'}
                </Badge>
              </Button>
                {servers.length > 1 && (
                  <Button
                    variant="outline"
                    className="h-full min-h-[150px] border-dashed border-red-500/50 hover:bg-red-500/10"
                    onClick={() => removeServer(servers[servers.length - 1].id)}
                  >
                    <Minus className="h-6 w-6 mr-2" />
                    Remove Server
                    <Badge variant="secondary" className="ml-2 bg-red-500/20 text-red-600">
                      -$20/mo
                    </Badge>
                  </Button>
                )}
             </div>
           </TabsContent>

            <TabsContent value="auto" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Configure automatic scaling based on CPU threshold.
                </p>
                <Button
                  variant={scalingConfig.autoScalingEnabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={() =>
                    setScalingConfig((prev) => ({
                      ...prev,
                      autoScalingEnabled: !prev.autoScalingEnabled,
                    }))
                  }
                  disabled={!hasLoadBalancer}
                >
                  {scalingConfig.autoScalingEnabled ? 'Enabled' : 'Enable Auto-Scaling'}
                  <Badge variant="secondary" className="ml-2">
                    +${PRICING.autoScaling}/mo
                  </Badge>
                </Button>
              </div>

              {!hasLoadBalancer && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm">
                  <AlertTriangle className="h-4 w-4 inline mr-2 text-yellow-500" />
                  Auto-scaling requires a load balancer to be enabled first.
                </div>
              )}

              {hasLoadBalancer && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">CPU Threshold (%)</label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Scale up when CPU exceeds this threshold
                      </p>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[scalingConfig.cpuThreshold]}
                          onValueChange={([value]) =>
                            setScalingConfig((prev) => ({ ...prev, cpuThreshold: value }))
                          }
                          min={50}
                          max={90}
                          step={5}
                          className="flex-1"
                        />
                        <span className="w-12 text-right font-mono">
                          {scalingConfig.cpuThreshold}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Min Instances</label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[scalingConfig.minInstances]}
                          onValueChange={([value]) =>
                            setScalingConfig((prev) => ({ ...prev, minInstances: value }))
                          }
                          min={1}
                          max={5}
                          step={1}
                          className="flex-1"
                        />
                        <span className="w-12 text-right font-mono">
                          {scalingConfig.minInstances}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Max Instances</label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[scalingConfig.maxInstances]}
                          onValueChange={([value]) =>
                            setScalingConfig((prev) => ({ ...prev, maxInstances: value }))
                          }
                          min={2}
                          max={20}
                          step={1}
                          className="flex-1"
                        />
                        <span className="w-12 text-right font-mono">
                          {scalingConfig.maxInstances}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Current Configuration
                    </h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge
                          variant="secondary"
                          className={
                            scalingConfig.autoScalingEnabled
                              ? 'bg-green-500/20 text-green-600'
                              : 'bg-gray-500/20 text-gray-600'
                          }
                        >
                          {scalingConfig.autoScalingEnabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Scale Up Trigger</span>
                        <span>CPU {'>'} {scalingConfig.cpuThreshold}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Scale Down Trigger</span>
                        <span>CPU {'<'} {scalingConfig.cpuThreshold / 2}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Instance Range</span>
                        <span>
                          {scalingConfig.minInstances} - {scalingConfig.maxInstances}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Current Instances</span>
                        <span>{servers.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Traffic Visualization */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Traffic Pattern (Last 60s)</h3>
            <div className="h-24 bg-muted/30 rounded-lg p-2 flex items-end gap-[2px]">
              {trafficHistory.map((traffic, i) => (
                <div
                  key={i}
                  className="flex-1 bg-blue-500 rounded-t transition-all"
                  style={{
                    height: `${Math.min((traffic / 5000) * 100, 100)}%`,
                    minHeight: '2px',
                  }}
                />
              ))}
              {trafficHistory.length === 0 && (
                <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                  Start simulation to see traffic
                </div>
              )}
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="text-muted-foreground">Total Requests</div>
              <div className="text-xl font-bold">
                {metrics.totalRequests.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="text-muted-foreground">Successful</div>
              <div className="text-xl font-bold text-green-500">
                {metrics.successfulRequests.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="text-muted-foreground">Failed</div>
              <div className="text-xl font-bold text-red-500">
                {metrics.failedRequests.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="text-muted-foreground">Active Servers</div>
              <div className="text-xl font-bold">
                {servers.filter((s) => s.status === 'healthy').length} / {servers.length}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
