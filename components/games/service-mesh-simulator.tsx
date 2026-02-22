'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Network, Play, Pause, RotateCcw, Lock, Zap, Activity, AlertTriangle, Shield } from 'lucide-react';

type ServiceStatus = 'healthy' | 'degraded' | 'failing';
type CircuitBreakerState = 'closed' | 'open' | 'half-open';

interface Service {
  id: string;
  name: string;
  version: string;
  status: ServiceStatus;
  x: number; // Position for visualization
  y: number;
}

interface TrafficRequest {
  id: string;
  from: string;
  to: string;
  status: 'in-flight' | 'success' | 'failed' | 'retrying';
  progress: number; // 0-100
  isMtls: boolean;
  attempt: number;
}

interface Scenario {
  id: string;
  title: string;
  description: string;
  setup: () => void;
}

export default function ServiceMeshSimulator() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [trafficSplit, setTrafficSplit] = useState([90]); // 90% to v1, 10% to v2
  const [circuitBreakerState, setCircuitBreakerState] = useState<CircuitBreakerState>('closed');
  const [enableMtls, setEnableMtls] = useState(true);
  const [enableRetries, setEnableRetries] = useState(true);
  const [failureRate, setFailureRate] = useState([10]); // 10% failures
  const [requests, setRequests] = useState<TrafficRequest[]>([]);
  const [activeScenario, setActiveScenario] = useState('normal');
  const [meshType, setMeshType] = useState<'istio' | 'linkerd'>('istio');

  const services: Service[] = useMemo(
    () => [
      { id: 'frontend', name: 'Frontend', version: 'v1', status: 'healthy', x: 20, y: 50 },
      { id: 'api-v1', name: 'API', version: 'v1', status: 'healthy', x: 50, y: 35 },
      { id: 'api-v2', name: 'API', version: 'v2', status: 'healthy', x: 50, y: 65 },
      { id: 'database', name: 'Database', version: 'v1', status: 'healthy', x: 80, y: 50 },
    ],
    []
  );

  const [serviceStates, setServiceStates] = useState<Record<string, ServiceStatus>>({
    frontend: 'healthy',
    'api-v1': 'healthy',
    'api-v2': 'healthy',
    database: 'healthy',
  });

  const scenarios: Scenario[] = [
    {
      id: 'normal',
      title: '👍 Normal Traffic',
      description: 'All services healthy, traffic flowing smoothly with mTLS',
      setup: () => {
        setServiceStates({
          frontend: 'healthy',
          'api-v1': 'healthy',
          'api-v2': 'healthy',
          database: 'healthy',
        });
        setCircuitBreakerState('closed');
        setFailureRate([0]);
        setTrafficSplit([90]);
        setEnableMtls(true);
        setEnableRetries(true);
      },
    },
    {
      id: 'canary',
      title: '🐦 Canary Deployment',
      description: 'Gradually shift traffic from v1 to v2 (50/50 split)',
      setup: () => {
        setServiceStates({
          frontend: 'healthy',
          'api-v1': 'healthy',
          'api-v2': 'healthy',
          database: 'healthy',
        });
        setCircuitBreakerState('closed');
        setFailureRate([5]);
        setTrafficSplit([50]);
        setEnableMtls(true);
        setEnableRetries(true);
      },
    },
    {
      id: 'circuit-breaker',
      title: '⚡ Circuit Breaker',
      description: 'API v2 fails, circuit breaker trips to protect the system',
      setup: () => {
        setServiceStates({
          frontend: 'healthy',
          'api-v1': 'healthy',
          'api-v2': 'failing',
          database: 'healthy',
        });
        setCircuitBreakerState('open');
        setFailureRate([80]);
        setTrafficSplit([10]);
        setEnableMtls(true);
        setEnableRetries(false);
      },
    },
    {
      id: 'retry-storm',
      title: '🌀 Retry Storm',
      description: 'Database degraded, aggressive retries amplify the load',
      setup: () => {
        setServiceStates({
          frontend: 'healthy',
          'api-v1': 'healthy',
          'api-v2': 'healthy',
          database: 'degraded',
        });
        setCircuitBreakerState('half-open');
        setFailureRate([40]);
        setTrafficSplit([90]);
        setEnableMtls(true);
        setEnableRetries(true);
      },
    },
  ];

  // Generate traffic requests
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      // Create new request from frontend to API
      const shouldRouteToV2 = Math.random() * 100 > trafficSplit[0];
      const targetApi = shouldRouteToV2 ? 'api-v2' : 'api-v1';
      const targetStatus = serviceStates[targetApi];

      const willFail =
        Math.random() * 100 < failureRate[0] ||
        targetStatus === 'failing' ||
        circuitBreakerState === 'open';

      const newRequest: TrafficRequest = {
        id: `req-${Date.now()}-${Math.random()}`,
        from: 'frontend',
        to: targetApi,
        status: willFail && !enableRetries ? 'failed' : 'in-flight',
        progress: 0,
        isMtls: enableMtls,
        attempt: 1,
      };

      setRequests((prev) => [...prev, newRequest]);
    }, 800);

    return () => clearInterval(interval);
  }, [isPlaying, trafficSplit, serviceStates, failureRate, circuitBreakerState, enableMtls, enableRetries]);

  // Animate requests
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setRequests((prev) =>
        prev
          .map((req) => {
            if (req.status === 'success' || req.status === 'failed') {
              return req.progress >= 100 ? null : { ...req, progress: req.progress + 10 };
            }

            const newProgress = req.progress + 5;

            if (newProgress >= 100) {
              // Check if request succeeds or fails
              const targetStatus = serviceStates[req.to];
              const shouldFail =
                Math.random() * 100 < failureRate[0] ||
                targetStatus === 'failing' ||
                circuitBreakerState === 'open';

              if (shouldFail && enableRetries && req.attempt < 3) {
                return { ...req, status: 'retrying', progress: 0, attempt: req.attempt + 1 };
              }

              return { ...req, status: shouldFail ? 'failed' : 'success', progress: 100 };
            }

            return { ...req, progress: newProgress };
          })
          .filter(Boolean) as TrafficRequest[]
      );
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, serviceStates, failureRate, circuitBreakerState, enableRetries]);

  const handleScenarioChange = (scenarioId: string) => {
    const scenario = scenarios.find((s) => s.id === scenarioId);
    if (scenario) {
      setActiveScenario(scenarioId);
      scenario.setup();
      setRequests([]);
      setIsPlaying(false);
    }
  };

  const handleReset = () => {
    setRequests([]);
    setIsPlaying(false);
    const scenario = scenarios.find((s) => s.id === activeScenario);
    if (scenario) scenario.setup();
  };

  const stats = useMemo(() => {
    const total = requests.length;
    const success = requests.filter((r) => r.status === 'success').length;
    const failed = requests.filter((r) => r.status === 'failed').length;
    const retrying = requests.filter((r) => r.status === 'retrying').length;
    const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : '0';

    return { total, success, failed, retrying, successRate };
  }, [requests]);

  return (
    <div className="w-full max-w-6xl">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="w-8 h-8 text-blue-500" />
              <CardTitle className="text-2xl">Service Mesh Traffic Simulator</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Zap className="w-3 h-3" />
                {meshType === 'istio' ? 'Istio' : 'Linkerd'}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => setMeshType(meshType === 'istio' ? 'linkerd' : 'istio')}>
                Switch Mesh
              </Button>
            </div>
          </div>
          <CardDescription>
            Visualize traffic flow, mTLS, circuit breakers, and retries in a service mesh
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Scenario Selection */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Scenarios</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {scenarios.map((scenario) => (
                <Button
                  key={scenario.id}
                  variant={activeScenario === scenario.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleScenarioChange(scenario.id)}
                  className="justify-start text-left h-auto py-2"
                >
                  <div>
                    <div className="font-medium">{scenario.title}</div>
                    <div className="text-xs text-muted-foreground">{scenario.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Mesh Visualization */}
          <div className="relative border rounded-lg bg-muted/20 h-96">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Draw connections */}
              <line x1="20" y1="50" x2="45" y2="35" stroke="currentColor" strokeWidth="0.2" opacity="0.3" />
              <line x1="20" y1="50" x2="45" y2="65" stroke="currentColor" strokeWidth="0.2" opacity="0.3" />
              <line x1="55" y1="35" x2="78" y2="50" stroke="currentColor" strokeWidth="0.2" opacity="0.3" />
              <line x1="55" y1="65" x2="78" y2="50" stroke="currentColor" strokeWidth="0.2" opacity="0.3" />

              {/* Animate traffic requests */}
              {requests.map((req) => {
                const fromService = services.find((s) => s.id === req.from);
                const toService = services.find((s) => s.id === req.to);
                if (!fromService || !toService) return null;

                const x = fromService.x + (toService.x - fromService.x) * (req.progress / 100);
                const y = fromService.y + (toService.y - fromService.y) * (req.progress / 100);

                const color =
                  req.status === 'success'
                    ? 'green'
                    : req.status === 'failed'
                    ? 'red'
                    : req.status === 'retrying'
                    ? 'orange'
                    : 'blue';

                return (
                  <g key={req.id}>
                    <circle cx={x} cy={y} r="0.8" fill={color} opacity="0.8">
                      <animate attributeName="r" from="0.8" to="1.2" dur="0.5s" repeatCount="indefinite" />
                    </circle>
                    {req.isMtls && (
                      <circle cx={x} cy={y} r="1.5" stroke="gold" strokeWidth="0.2" fill="none" opacity="0.6" />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Service Nodes */}
            {services.map((service) => {
              const status = serviceStates[service.id];
              const statusColor =
                status === 'healthy' ? 'bg-green-500' : status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500';

              return (
                <div
                  key={service.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${service.x}%`, top: `${service.y}%` }}
                >
                  <div className="relative">
                    {/* Sidecar Proxy */}
                    <div className="absolute -left-8 -top-2 w-6 h-6 border-2 border-purple-500 rounded bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                      <Shield className="w-3 h-3 text-purple-600" />
                    </div>

                    {/* Service Pod */}
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-16 h-16 rounded-lg ${statusColor} bg-opacity-20 border-2 border-current flex flex-col items-center justify-center`}>
                        <div className="text-xs font-semibold text-center">{service.name}</div>
                        <div className="text-[10px] opacity-70">{service.version}</div>
                      </div>
                      {enableMtls && (
                        <div className="flex items-center gap-1 text-[10px] text-yellow-600">
                          <Lock className="w-2.5 h-2.5" />
                          <span>mTLS</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Circuit Breaker Indicator */}
            {circuitBreakerState !== 'closed' && (
              <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-orange-100 dark:bg-orange-950 border border-orange-500 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-semibold text-orange-600">
                  Circuit Breaker: {circuitBreakerState.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={() => setIsPlaying(!isPlaying)} size="sm">
              {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              {isPlaying ? 'Pause' : 'Start'}
            </Button>
            <Button onClick={handleReset} variant="outline" size="sm">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>

            {/* Stats */}
            <div className="flex gap-4 ml-auto text-sm">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <span>Total: {stats.total}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Success: {stats.success}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span>Failed: {stats.failed}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                <span>Retrying: {stats.retrying}</span>
              </div>
              <Badge variant="outline">{stats.successRate}% Success Rate</Badge>
            </div>
          </div>

          {/* Configuration */}
          <Tabs defaultValue="traffic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="traffic">Traffic</TabsTrigger>
              <TabsTrigger value="resilience">Resilience</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="traffic" className="space-y-4">
              <div>
                <label className="text-sm font-medium">Traffic Split (v1/v2)</label>
                <div className="flex items-center gap-4 mt-2">
                  <Slider value={trafficSplit} onValueChange={setTrafficSplit} max={100} step={10} className="flex-1" />
                  <span className="text-sm font-mono">
                    {trafficSplit[0]}% / {100 - trafficSplit[0]}%
                  </span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="resilience" className="space-y-4">
              <div>
                <label className="text-sm font-medium">Failure Rate</label>
                <div className="flex items-center gap-4 mt-2">
                  <Slider value={failureRate} onValueChange={setFailureRate} max={100} step={5} className="flex-1" />
                  <span className="text-sm font-mono">{failureRate[0]}%</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  variant={enableRetries ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEnableRetries(!enableRetries)}
                >
                  Retries: {enableRetries ? 'ON' : 'OFF'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCircuitBreakerState(
                      circuitBreakerState === 'closed'
                        ? 'open'
                        : circuitBreakerState === 'open'
                        ? 'half-open'
                        : 'closed'
                    )
                  }
                >
                  Circuit Breaker: {circuitBreakerState.toUpperCase()}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <div className="flex items-center gap-4">
                <Button variant={enableMtls ? 'default' : 'outline'} size="sm" onClick={() => setEnableMtls(!enableMtls)}>
                  <Lock className="w-4 h-4 mr-2" />
                  mTLS: {enableMtls ? 'ON' : 'OFF'}
                </Button>
              </div>
              <div className="p-4 text-sm border rounded-lg bg-muted/30">
                <p className="font-semibold mb-2">mTLS (Mutual TLS)</p>
                <p className="text-muted-foreground">
                  When enabled, all service-to-service communication is encrypted and authenticated with certificates. The
                  service mesh automatically rotates certificates and verifies identities.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
