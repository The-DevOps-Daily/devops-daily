'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Play,
  Pause,
  RotateCcw,
  Database,
  Server,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Settings,
  Boxes,
  Network,
  ArrowRight,
  Info,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Service types
type ServiceType = 'api-gateway' | 'user' | 'product' | 'cart' | 'order' | 'payment' | 'inventory' | 'notification';
type ServiceStatus = 'healthy' | 'degraded' | 'down';
type CommunicationType = 'sync' | 'async';

interface Service {
  id: string;
  type: ServiceType;
  name: string;
  status: ServiceStatus;
  instances: number;
  cpu: number;
  memory: number;
  requestsPerSecond: number;
  errorRate: number;
  latency: number;
  position: { x: number; y: number };
}

interface ServiceCall {
  id: string;
  from: string;
  to: string;
  type: CommunicationType;
  success: boolean;
  latency: number;
}

const SERVICE_TEMPLATES: Record<ServiceType, { name: string; color: string; icon: string }> = {
  'api-gateway': { name: 'API Gateway', color: '#3b82f6', icon: '🌐' },
  'user': { name: 'User Service', color: '#8b5cf6', icon: '👤' },
  'product': { name: 'Product Service', color: '#ec4899', icon: '📦' },
  'cart': { name: 'Cart Service', color: '#f59e0b', icon: '🛒' },
  'order': { name: 'Order Service', color: '#10b981', icon: '📋' },
  'payment': { name: 'Payment Service', color: '#ef4444', icon: '💳' },
  'inventory': { name: 'Inventory Service', color: '#06b6d4', icon: '📊' },
  'notification': { name: 'Notification Service', color: '#6366f1', icon: '📧' },
};

const SCENARIOS = [
  { id: 'basic', name: 'Basic Setup', description: 'Start with core services' },
  { id: 'load', name: 'High Load', description: 'Handle traffic spikes' },
  { id: 'failure', name: 'Service Failure', description: 'Test resilience' },
  { id: 'cascade', name: 'Cascade Failure', description: 'Prevent cascading failures' },
];

export default function MicroservicesSimulator() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = resolvedTheme === 'dark';

  // Game state
  const [isRunning, setIsRunning] = useState(false);
  const [scenario, setScenario] = useState('basic');
  const [services, setServices] = useState<Service[]>([]);
  const [activeCalls, setActiveCalls] = useState<ServiceCall[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [successfulRequests, setSuccessfulRequests] = useState(0);
  const [failedRequests, setFailedRequests] = useState(0);
  const [averageLatency, setAverageLatency] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showMetrics, setShowMetrics] = useState(true);
  const [communicationType, setCommunicationType] = useState<CommunicationType>('sync');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    setMounted(true);
    initializeServices();
  }, []);

  const initializeServices = () => {
    const initialServices: Service[] = [
      {
        id: 'api-gateway-1',
        type: 'api-gateway',
        name: 'API Gateway',
        status: 'healthy',
        instances: 2,
        cpu: 30,
        memory: 40,
        requestsPerSecond: 100,
        errorRate: 0,
        latency: 50,
        position: { x: 100, y: 200 },
      },
      {
        id: 'user-1',
        type: 'user',
        name: 'User Service',
        status: 'healthy',
        instances: 3,
        cpu: 45,
        memory: 60,
        requestsPerSecond: 80,
        errorRate: 0,
        latency: 120,
        position: { x: 300, y: 100 },
      },
      {
        id: 'product-1',
        type: 'product',
        name: 'Product Service',
        status: 'healthy',
        instances: 3,
        cpu: 50,
        memory: 55,
        requestsPerSecond: 120,
        errorRate: 0,
        latency: 100,
        position: { x: 300, y: 300 },
      },
      {
        id: 'cart-1',
        type: 'cart',
        name: 'Cart Service',
        status: 'healthy',
        instances: 2,
        cpu: 35,
        memory: 45,
        requestsPerSecond: 60,
        errorRate: 0,
        latency: 80,
        position: { x: 500, y: 150 },
      },
      {
        id: 'order-1',
        type: 'order',
        name: 'Order Service',
        status: 'healthy',
        instances: 3,
        cpu: 55,
        memory: 65,
        requestsPerSecond: 50,
        errorRate: 0,
        latency: 200,
        position: { x: 500, y: 350 },
      },
    ];
    setServices(initialServices);
  };

  const handleStart = () => {
    setIsRunning(true);
    startSimulation();
  };

  const handlePause = () => {
    setIsRunning(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setTotalRequests(0);
    setSuccessfulRequests(0);
    setFailedRequests(0);
    setAverageLatency(0);
    setActiveCalls([]);
    initializeServices();
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const startSimulation = () => {
    const simulate = () => {
      if (!isRunning) return;

      // Simulate traffic between services
      if (Math.random() < 0.3) {
        simulateServiceCall();
      }

      // Update service metrics
      setServices((prev) =>
        prev.map((service) => ({
          ...service,
          cpu: Math.min(100, Math.max(10, service.cpu + (Math.random() - 0.5) * 10)),
          memory: Math.min(100, Math.max(20, service.memory + (Math.random() - 0.5) * 5)),
          requestsPerSecond: Math.max(0, service.requestsPerSecond + (Math.random() - 0.5) * 20),
        }))
      );

      animationRef.current = requestAnimationFrame(simulate);
    };

    simulate();
  };

  const simulateServiceCall = () => {
    if (services.length < 2) return;

    const fromService = services[Math.floor(Math.random() * services.length)];
    const availableTargets = services.filter((s) => s.id !== fromService.id);
    if (availableTargets.length === 0) return;

    const toService = availableTargets[Math.floor(Math.random() * availableTargets.length)];

    // Factor in service health for success rate
    let successChance = 0.95;
    if (toService.status === 'degraded') successChance = 0.7;
    if (toService.status === 'down') successChance = 0.1;

    const call: ServiceCall = {
      id: `call-${Date.now()}-${Math.random()}`,
      from: fromService.id,
      to: toService.id,
      type: communicationType,
      success: Math.random() < successChance,
      latency: Math.random() * 300 + 50,
    };

    setActiveCalls((prev) => [...prev, call]);
    setTotalRequests((prev) => prev + 1);

    if (call.success) {
      setSuccessfulRequests((prev) => prev + 1);
    } else {
      setFailedRequests((prev) => prev + 1);
    }

    setAverageLatency((prev) => {
      const total = totalRequests;
      return (prev * total + call.latency) / (total + 1);
    });

    // Remove call after animation
    setTimeout(() => {
      setActiveCalls((prev) => prev.filter((c) => c.id !== call.id));
    }, 2000);
  };

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
  };

  const scaleService = (serviceId: string, delta: number) => {
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? { ...s, instances: Math.max(1, Math.min(10, s.instances + delta)) }
          : s
      )
    );
  };

  const toggleServiceHealth = (serviceId: string) => {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== serviceId) return s;
        const statusCycle: ServiceStatus[] = ['healthy', 'degraded', 'down'];
        const currentIndex = statusCycle.indexOf(s.status);
        return { ...s, status: statusCycle[(currentIndex + 1) % statusCycle.length] };
      })
    );
  };

  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-yellow-500';
      case 'down': return 'text-red-500';
    }
  };

  const getStatusIcon = (status: ServiceStatus) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4" />;
      case 'down': return <XCircle className="w-4 h-4" />;
    }
  };

  useEffect(() => {
    if (isRunning) {
      startSimulation();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning]);

  if (!mounted) return null;

  const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;

  return (
    <div className="w-full mx-auto px-4">
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Boxes className="w-6 h-6" />
                Microservices Architecture Simulator
              </CardTitle>
              <CardDescription className="mt-2">
                Design and deploy microservices. See communication patterns, handle failures, and scale independently.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm">
              Interactive Learning
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={isRunning ? handlePause : handleStart}
              className={cn(
                'gap-2',
                isRunning ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'
              )}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isRunning ? 'Pause' : 'Start'}
            </Button>

            <Button onClick={handleReset} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Scenario:</label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="px-3 py-1 text-sm border rounded-md bg-background"
                disabled={isRunning}
              >
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Communication:</label>
              <Button
                variant={communicationType === 'sync' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCommunicationType('sync')}
              >
                Sync
              </Button>
              <Button
                variant={communicationType === 'async' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCommunicationType('async')}
              >
                Async
              </Button>
            </div>

            <Button
              onClick={() => setShowMetrics(!showMetrics)}
              variant="outline"
              size="sm"
              className="ml-auto"
            >
              <Activity className="w-4 h-4 mr-2" />
              {showMetrics ? 'Hide' : 'Show'} Metrics
            </Button>
          </div>

          {/* Metrics Dashboard */}
          {showMetrics && (
            <div className="grid grid-cols-2 gap-3 p-4 rounded-lg lg:grid-cols-4 bg-muted/30">
              <div>
                <div className="text-xs text-muted-foreground">Total Requests</div>
                <div className="text-2xl font-bold">{totalRequests}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Success Rate</div>
                <div className={cn('text-2xl font-bold', successRate >= 95 ? 'text-green-500' : successRate >= 80 ? 'text-yellow-500' : 'text-red-500')}>
                  {successRate.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Avg Latency</div>
                <div className="text-2xl font-bold">{averageLatency.toFixed(0)}ms</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Active Services</div>
                <div className="text-2xl font-bold">{services.length}</div>
              </div>
            </div>
          )}

          {/* Main 2-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Services Canvas (2/3 width) */}
            <div className="lg:col-span-2">
          <div className="relative p-6 border rounded-lg bg-muted/20" style={{ minHeight: '600px' }}>
            <div className="absolute inset-0">
              {/* Service connections */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {services.map((from) =>
                  services
                    .filter((to) => to.id !== from.id)
                    .map((to) => (
                      <line
                        key={`${from.id}-${to.id}`}
                        x1={from.position.x + 60}
                        y1={from.position.y + 40}
                        x2={to.position.x + 60}
                        y2={to.position.y + 40}
                        stroke={isDark ? '#333' : '#ddd'}
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                    ))
                )}

                {/* Active calls animation */}
                {activeCalls.map((call) => {
                  const from = services.find((s) => s.id === call.from);
                  const to = services.find((s) => s.id === call.to);
                  if (!from || !to) return null;

                  return (
                    <motion.circle
                      key={call.id}
                      r="4"
                      fill={call.success ? '#10b981' : '#ef4444'}
                      initial={{ cx: from.position.x + 60, cy: from.position.y + 40 }}
                      animate={{ cx: to.position.x + 60, cy: to.position.y + 40 }}
                      transition={{ duration: call.latency / 1000, ease: 'linear' }}
                    />
                  );
                })}
              </svg>

              {/* Services */}
              {services.map((service) => (
                <motion.div
                  key={service.id}
                  className="absolute cursor-pointer"
                  style={{
                    left: service.position.x,
                    top: service.position.y,
                  }}
                  onClick={() => handleServiceClick(service)}
                  whileHover={{ scale: 1.05 }}
                >
                  <Card
                    className={cn(
                      'w-32 p-2 border-2 transition-all',
                      selectedService?.id === service.id && 'ring-2 ring-blue-500',
                      service.status === 'healthy' && 'border-green-500/50',
                      service.status === 'degraded' && 'border-yellow-500/50',
                      service.status === 'down' && 'border-red-500/50'
                    )}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">{SERVICE_TEMPLATES[service.type].icon}</div>
                      <div className="text-xs font-medium truncate">{service.name}</div>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <span className={cn('text-xs', getStatusColor(service.status))}>
                          {getStatusIcon(service.status)}
                        </span>
                        <span className="text-xs text-muted-foreground">x{service.instances}</span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
            </div>

            {/* Right: Service Details (1/3 width) */}
            <div className="space-y-4">
          {/* Service Details Panel */}
          <AnimatePresence>
            {selectedService && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Card className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-semibold">
                        <span className="text-2xl">{SERVICE_TEMPLATES[selectedService.type].icon}</span>
                        {selectedService.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className={getStatusColor(selectedService.status)}>
                          {selectedService.status}
                        </Badge>
                        <Badge variant="secondary">{selectedService.instances} instances</Badge>
                      </div>
                    </div>
                    <Button onClick={() => setSelectedService(null)} variant="ghost" size="sm">
                      ×
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <div className="text-xs text-muted-foreground">CPU Usage</div>
                      <div className="text-xl font-bold">{selectedService.cpu.toFixed(0)}%</div>
                      <div className="w-full h-2 mt-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${selectedService.cpu}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Memory</div>
                      <div className="text-xl font-bold">{selectedService.memory.toFixed(0)}%</div>
                      <div className="w-full h-2 mt-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${selectedService.memory}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Latency</div>
                      <div className="text-xl font-bold">{selectedService.latency.toFixed(0)}ms</div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => scaleService(selectedService.id, 1)}
                      variant="outline"
                      size="sm"
                      disabled={selectedService.instances >= 10}
                    >
                      Scale Up
                    </Button>
                    <Button
                      onClick={() => scaleService(selectedService.id, -1)}
                      variant="outline"
                      size="sm"
                      disabled={selectedService.instances <= 1}
                    >
                      Scale Down
                    </Button>
                    <Button
                      onClick={() => toggleServiceHealth(selectedService.id)}
                      variant="outline"
                      size="sm"
                    >
                      Toggle Health
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

              {!selectedService && (
                <Card className="p-4 bg-muted/20">
                  <h3 className="flex items-center gap-2 mb-3 text-sm font-semibold">
                    <Info className="w-4 h-4" />
                    How to Use
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Click services to view metrics</li>
                    <li>• Scale them up/down to handle load</li>
                    <li>• Toggle health to simulate failures</li>
                    <li>• Watch requests flow between services</li>
                  </ul>
                </Card>
              )}
            </div>
          </div>

          {/* Learning Tips */}
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              <strong>Learning Tips:</strong> Click services to view metrics. Scale them up/down to handle load.
              Toggle health to simulate failures. Watch how independent services communicate and recover.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
