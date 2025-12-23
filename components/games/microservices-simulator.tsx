'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Settings,
  Boxes,
  Network,
  ArrowRight,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Service types
type ServiceType = 'api-gateway' | 'user' | 'product' | 'cart' | 'order';
type ServiceStatus = 'healthy' | 'degraded' | 'down';
type TutorialStep = 'welcome' | 'click-service' | 'start-sim' | 'scale-service' | 'toggle-health' | 'complete';

interface Service {
  id: string;
  type: ServiceType;
  name: string;
  description?: string;
  status: ServiceStatus;
  instances: number;
  cpu: number;
  memory: number;
  latency: number;
  position: { x: number; y: number };
}

interface ServiceCall {
  id: string;
  from: string;
  to: string;
  success: boolean;
  latency: number;
}

const SERVICE_TEMPLATES: Record<ServiceType, { name: string; icon: string }> = {
  'api-gateway': { name: 'API Gateway', icon: '🌐' },
  'user': { name: 'User Service', icon: '👤' },
  'product': { name: 'Product Service', icon: '📦' },
  'cart': { name: 'Cart Service', icon: '🛒' },
  'order': { name: 'Order Service', icon: '📋' },
};

export default function MicroservicesSimulator() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = resolvedTheme === 'dark';

  // Game state
  const [isRunning, setIsRunning] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [activeCalls, setActiveCalls] = useState<ServiceCall[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [successfulRequests, setSuccessfulRequests] = useState(0);
  const [failedRequests, setFailedRequests] = useState(0);
  const [averageLatency, setAverageLatency] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showMetrics, setShowMetrics] = useState(true);
  
  // Tutorial state
  const [tutorialMode, setTutorialMode] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('welcome');
  const [showWelcome, setShowWelcome] = useState(true);
  const [narration, setNarration] = useState('Welcome! Click "Start Tutorial" to learn how microservices work.');
  const [showAdvancedServices, setShowAdvancedServices] = useState(false);

  const animationRef = useRef<number>();
  const lastCallTimeRef = useRef<number>(0);
  const lastMetricsUpdateRef = useRef<number>(0);
  const servicesRef = useRef<Service[]>([]);

  useEffect(() => {
    setMounted(true);
    initializeServices();
  }, []);

  // Sync selectedService when services array changes
  useEffect(() => {
    servicesRef.current = services;
    if (selectedService) {
      const updated = services.find((s) => s.id === selectedService.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedService)) {
        setSelectedService(updated);
      }
    }
  }, [services, selectedService]);

  const initializeServices = () => {
    const initialServices: Service[] = [
      {
        id: 'api-gateway-1',
        type: 'api-gateway',
        name: 'API Gateway',
        description: 'Entry point for all requests. Routes traffic to other services.',
        status: 'healthy',
        instances: 2,
        cpu: 30,
        memory: 40,
        latency: 50,
        position: { x: 100, y: 200 },
      },
      {
        id: 'user-1',
        type: 'user',
        name: 'User Service',
        description: 'Handles user authentication and profile management.',
        status: 'healthy',
        instances: 3,
        cpu: 45,
        memory: 60,
        latency: 120,
        position: { x: 300, y: 100 },
      },
      {
        id: 'product-1',
        type: 'product',
        name: 'Product Service',
        description: 'Manages product catalog and inventory queries.',
        status: 'healthy',
        instances: 3,
        cpu: 50,
        memory: 55,
        latency: 100,
        position: { x: 300, y: 300 },
      },
    ];
    setServices(initialServices);
  };

  const addAdvancedServices = () => {
    const advancedServices: Service[] = [
      {
        id: 'cart-1',
        type: 'cart',
        name: 'Cart Service',
        description: 'Manages shopping cart operations.',
        status: 'healthy',
        instances: 2,
        cpu: 35,
        memory: 45,
        latency: 80,
        position: { x: 500, y: 150 },
      },
      {
        id: 'order-1',
        type: 'order',
        name: 'Order Service',
        description: 'Processes and tracks orders.',
        status: 'healthy',
        instances: 3,
        cpu: 55,
        memory: 65,
        latency: 200,
        position: { x: 500, y: 350 },
      },
    ];
    setServices([...services, ...advancedServices]);
    setShowAdvancedServices(true);
    setNarration('Added Cart and Order services! Now you have a complete e-commerce architecture.');
  };

  const removeAdvancedServices = () => {
    setServices((prev) => prev.filter((s) => s.type !== 'cart' && s.type !== 'order'));
    setShowAdvancedServices(false);
    setSelectedService(null);
    setNarration('Removed advanced services. Back to core microservices architecture.');
  };

  const startTutorial = () => {
    setShowWelcome(false);
    setTutorialMode(true);
    setTutorialStep('click-service');
    setNarration('👆 Click on the API Gateway to learn about this service.');
  };

  const advanceTutorial = (currentStep: TutorialStep) => {
    switch (currentStep) {
      case 'click-service':
        setTutorialStep('start-sim');
        setNarration('🎬 Great! Now click the "Start" button to begin the simulation.');
        break;
      case 'start-sim':
        setTutorialStep('scale-service');
        setNarration('⚖️ Perfect! Notice the requests flowing. Now scale up the User Service to handle more load.');
        break;
      case 'scale-service':
        setTutorialStep('toggle-health');
        setNarration('👏 Excellent! Now toggle the health of a service to see how failures affect the system.');
        break;
      case 'toggle-health':
        setTutorialStep('complete');
        setNarration('✅ Tutorial complete! You now understand microservices basics. Try different scenarios!');
        setTimeout(() => setTutorialMode(false), 3000);
        break;
    }
  };

  const skipTutorial = () => {
    setShowWelcome(false);
    setTutorialMode(false);
    setNarration('Click services to view metrics and interact with your architecture.');
  };

  const handleStart = () => {
    if (tutorialMode && tutorialStep === 'start-sim') {
      advanceTutorial('start-sim');
    }
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
    setTutorialMode(false);
    setTutorialStep('welcome');
    setShowWelcome(false);
    setShowAdvancedServices(false);
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

      const now = Date.now();
      
      // Simulate traffic between services
      // Active frequency: send request every 400ms for engaging pace
      if (now - lastCallTimeRef.current > 400) {
        simulateServiceCall();
        lastCallTimeRef.current = now;
      }

      // Update service metrics
      // Update metrics every 200ms for responsive feel
      if (now - lastMetricsUpdateRef.current > 200) {
        setServices((prev) =>
          prev.map((service) => ({
            ...service,
            cpu: Math.min(100, Math.max(10, 
              service.status === 'down' ? 90 + Math.random() * 10 :
              service.status === 'degraded' ? 60 + Math.random() * 20 :
              service.cpu + (Math.random() - 0.5) * 7
            )),
            memory: Math.min(100, Math.max(20, 
              service.status === 'down' ? 85 + Math.random() * 15 :
              service.status === 'degraded' ? 55 + Math.random() * 25 :
              service.memory + (Math.random() - 0.5) * 4
            )),
            latency: service.status === 'down' ? 800 + Math.random() * 400 :
              service.status === 'degraded' ? 400 + Math.random() * 300 :
              120 + Math.random() * 180,
          }))
        );
        lastMetricsUpdateRef.current = now;
      }

      animationRef.current = requestAnimationFrame(simulate);
    };

    simulate();
  };

  const simulateServiceCall = () => {
    const currentServices = servicesRef.current;
    if (currentServices.length < 2) return;

    const fromService = currentServices[Math.floor(Math.random() * currentServices.length)];
    const availableTargets = currentServices.filter((s) => s.id !== fromService.id);
    if (availableTargets.length === 0) return;

    const toService = availableTargets[Math.floor(Math.random() * availableTargets.length)];

    // Factor in service health for success rate
    let successChance = 0.95;
    if (toService.status === 'degraded') successChance = 0.7;
    if (toService.status === 'down') successChance = 0.1;

    // Also factor in fromService health
    if (fromService.status === 'down') successChance *= 0.2;
    else if (fromService.status === 'degraded') successChance *= 0.8;

    const call: ServiceCall = {
      id: `call-${Date.now()}-${Math.random()}`,
      from: fromService.id,
      to: toService.id,
      success: Math.random() < successChance,
      latency: Math.random() * 200 + 300, // 300-500ms range (faster, more dynamic)
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
    }, 1000); // Match faster animation duration
  };

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    if (tutorialMode && tutorialStep === 'click-service') {
      advanceTutorial('click-service');
    }
  };

  const scaleService = (serviceId: string, delta: number) => {
    if (tutorialMode && tutorialStep === 'scale-service' && delta > 0) {
      advanceTutorial('scale-service');
    }
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? { ...s, instances: Math.max(1, Math.min(10, s.instances + delta)) }
          : s
      )
    );
  };

  const toggleServiceHealth = (serviceId: string) => {
    if (tutorialMode && tutorialStep === 'toggle-health') {
      advanceTutorial('toggle-health');
    }
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
      {/* Welcome Modal */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-lg mx-4"
            >
              <Card className="p-6">
                <h2 className="flex items-center gap-2 text-2xl font-bold mb-4">
                  <Boxes className="w-6 h-6" />
                  Welcome to Microservices Simulator!
                </h2>
                <p className="mb-4 text-muted-foreground">
                  Learn how modern applications are built using independent, scalable services.
                  Each service can be deployed, scaled, and maintained separately.
                </p>
                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🎯</div>
                    <div>
                      <div className="font-medium">Interactive Tutorial</div>
                      <div className="text-sm text-muted-foreground">Step-by-step guided tour</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🛠️</div>
                    <div>
                      <div className="font-medium">Hands-On Learning</div>
                      <div className="text-sm text-muted-foreground">Scale services, simulate failures</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">📊</div>
                    <div>
                      <div className="font-medium">Real-Time Metrics</div>
                      <div className="text-sm text-muted-foreground">Monitor performance and health</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={startTutorial} className="flex-1 bg-blue-600 hover:bg-blue-700">
                    Start Tutorial
                  </Button>
                  <Button onClick={skipTutorial} variant="outline" className="flex-1">
                    Skip and Explore
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
          {/* Narration Box */}
          {(tutorialMode || !showWelcome) && (
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-900 dark:text-blue-100">
                {narration}
              </AlertDescription>
            </Alert>
          )}

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
            <div className="grid grid-cols-3 gap-3 p-4 rounded-lg bg-muted/30">
              <div>
                <div className="text-xs text-muted-foreground">Total Requests</div>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold">{totalRequests}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Success Rate</div>
                <div className="flex items-center gap-2">
                  <div className={cn('text-2xl font-bold', successRate >= 95 ? 'text-green-500' : successRate >= 80 ? 'text-yellow-500' : 'text-red-500')}>
                    {successRate.toFixed(1)}%
                  </div>
                  <div className="text-xs">
                    {successRate >= 95 ? '✅ Excellent' : successRate >= 80 ? '⚠️ Warning' : '❌ Critical'}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Successful / Failed</div>
                <div className="flex items-center gap-2">
                  <div className="text-xl font-bold text-green-500">{successfulRequests}</div>
                  <div className="text-muted-foreground">/</div>
                  <div className="text-xl font-bold text-red-500">{failedRequests}</div>
                </div>
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
                <defs>
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

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
                      r="6"
                      fill={call.success ? '#10b981' : '#ef4444'}
                      filter={call.success ? undefined : 'url(#glow)'}
                      initial={{ cx: from.position.x + 60, cy: from.position.y + 40 }}
                      animate={{ cx: to.position.x + 60, cy: to.position.y + 40 }}
                      transition={{ duration: call.latency / 500, ease: 'linear' }} // Faster, more engaging
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
                  animate={(
                    tutorialMode && 
                    ((tutorialStep === 'click-service' && service.type === 'api-gateway') ||
                     (tutorialStep === 'scale-service' && service.type === 'user'))
                  ) ? {
                    scale: [1, 1.1, 1],
                    boxShadow: [
                      '0 0 0 0 rgba(59, 130, 246, 0)',
                      '0 0 0 10px rgba(59, 130, 246, 0.3)',
                      '0 0 0 0 rgba(59, 130, 246, 0)',
                    ],
                  } : service.status === 'down' ? {
                    scale: [1, 0.95, 1],
                    opacity: [1, 0.7, 1],
                  } : service.status === 'degraded' ? {
                    scale: [1, 1.02, 1],
                    boxShadow: [
                      '0 0 0 0 rgba(234, 179, 8, 0)',
                      '0 0 0 6px rgba(234, 179, 8, 0.2)',
                      '0 0 0 0 rgba(234, 179, 8, 0)',
                    ],
                  } : {}}
                  transition={{
                    duration: service.status === 'down' ? 1.5 : service.status === 'degraded' ? 1.8 : 2,
                    repeat: (tutorialMode || service.status !== 'healthy') ? Infinity : 0,
                    ease: 'easeInOut',
                  }}
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
              
              {/* Progressive Disclosure Button */}
              {!tutorialMode && services.length >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-4 right-4"
                >
                  <Button
                    onClick={showAdvancedServices ? removeAdvancedServices : addAdvancedServices}
                    className={cn(
                      'gap-2',
                      showAdvancedServices 
                        ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                    )}
                  >
                    <Network className="w-4 h-4" />
                    {showAdvancedServices ? 'Remove Extra Services' : 'Add More Services'}
                  </Button>
                </motion.div>
              )}
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
                      {selectedService.description && (
                        <p className="text-sm text-muted-foreground mt-1">{selectedService.description}</p>
                      )}
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
