'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  RotateCcw,
  Server,
  Database,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  HardDrive,
  XCircle,
  ArrowRight,
  Info,
  Keyboard,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// DR Strategy types
type DRStrategy = 'hot' | 'warm' | 'cold';
type DisasterType = 'datacenter' | 'ransomware' | 'database' | 'hardware';
type Phase = 'normal' | 'disaster' | 'detection' | 'failover' | 'recovery' | 'restored';

interface SimulationStep {
  phase: Phase;
  title: string;
  description: string;
  primaryStatus: 'online' | 'offline' | 'degraded';
  drStatus: 'standby' | 'activating' | 'active' | 'syncing';
  dataFlow: 'primary' | 'switching' | 'dr' | 'none';
  elapsedMinutes: number;
}

// Strategy configurations
const STRATEGIES: Record<DRStrategy, {
  name: string;
  description: string;
  rtoMinutes: number;
  rpoMinutes: number;
  monthlyCost: number;
  syncType: string;
  pros: string[];
  cons: string[];
}> = {
  hot: {
    name: 'Hot Site',
    description: 'Fully operational duplicate with real-time data sync. Instant failover.',
    rtoMinutes: 5,
    rpoMinutes: 0,
    monthlyCost: 15000,
    syncType: 'Real-time replication',
    pros: ['Near-zero downtime', 'No data loss', 'Automatic failover possible'],
    cons: ['Very expensive', 'Requires constant maintenance', 'Double infrastructure'],
  },
  warm: {
    name: 'Warm Site',
    description: 'Hardware ready, data synced periodically. Balance of cost and speed.',
    rtoMinutes: 60,
    rpoMinutes: 15,
    monthlyCost: 5000,
    syncType: 'Hourly backups',
    pros: ['Good balance', 'Reasonable cost', 'Pre-configured systems'],
    cons: ['Some data loss possible', 'Manual intervention needed', '1-4 hour recovery'],
  },
  cold: {
    name: 'Cold Site',
    description: 'Basic facility with power/network. Systems must be set up during disaster.',
    rtoMinutes: 480,
    rpoMinutes: 1440,
    monthlyCost: 1000,
    syncType: 'Daily/weekly backups',
    pros: ['Lowest cost', 'Simple to maintain', 'Good for non-critical systems'],
    cons: ['Long recovery time', 'Significant data loss', 'Manual setup required'],
  },
};

// Disaster scenarios
const DISASTERS: Record<DisasterType, {
  name: string;
  description: string;
  severity: 'high' | 'critical';
  icon: React.ReactNode;
}> = {
  datacenter: {
    name: 'Data Center Outage',
    description: 'Complete power failure at primary site',
    severity: 'critical',
    icon: <Server className="w-5 h-5" />,
  },
  ransomware: {
    name: 'Ransomware Attack',
    description: 'Encryption of critical systems',
    severity: 'critical',
    icon: <Shield className="w-5 h-5" />,
  },
  database: {
    name: 'Database Corruption',
    description: 'Critical data corruption detected',
    severity: 'high',
    icon: <Database className="w-5 h-5" />,
  },
  hardware: {
    name: 'Hardware Failure',
    description: 'Critical server malfunction',
    severity: 'high',
    icon: <HardDrive className="w-5 h-5" />,
  },
};

// Generate simulation steps based on strategy
const generateSteps = (strategy: DRStrategy): SimulationStep[] => {
  const config = STRATEGIES[strategy];
  const baseSteps: SimulationStep[] = [
    {
      phase: 'normal',
      title: 'Normal Operations',
      description: 'Primary site handling all traffic. DR site on standby.',
      primaryStatus: 'online',
      drStatus: 'standby',
      dataFlow: 'primary',
      elapsedMinutes: 0,
    },
    {
      phase: 'disaster',
      title: 'Disaster Strikes!',
      description: 'Primary site goes offline. Systems unavailable.',
      primaryStatus: 'offline',
      drStatus: 'standby',
      dataFlow: 'none',
      elapsedMinutes: 0,
    },
    {
      phase: 'detection',
      title: 'Detection & Assessment',
      description: 'Monitoring alerts triggered. Team assessing situation.',
      primaryStatus: 'offline',
      drStatus: 'standby',
      dataFlow: 'none',
      elapsedMinutes: strategy === 'hot' ? 1 : strategy === 'warm' ? 5 : 15,
    },
    {
      phase: 'failover',
      title: 'Failover Initiated',
      description: strategy === 'hot' 
        ? 'Automatic failover to hot site in progress.'
        : strategy === 'warm'
        ? 'Manual failover started. Activating warm site systems.'
        : 'Cold site activation started. Installing and configuring systems.',
      primaryStatus: 'offline',
      drStatus: 'activating',
      dataFlow: 'switching',
      elapsedMinutes: strategy === 'hot' ? 2 : strategy === 'warm' ? 15 : 120,
    },
    {
      phase: 'recovery',
      title: 'Systems Coming Online',
      description: 'DR site systems booting. Data being restored.',
      primaryStatus: 'offline',
      drStatus: 'syncing',
      dataFlow: 'switching',
      elapsedMinutes: strategy === 'hot' ? 4 : strategy === 'warm' ? 45 : 360,
    },
    {
      phase: 'restored',
      title: 'Service Restored',
      description: `Operations resumed from DR site. Total recovery: ${config.rtoMinutes} min. Data loss: ${config.rpoMinutes} min.`,
      primaryStatus: 'offline',
      drStatus: 'active',
      dataFlow: 'dr',
      elapsedMinutes: config.rtoMinutes,
    },
  ];
  return baseSteps;
};

// Info tooltip component
const InfoTooltip = ({ term, explanation }: { term: string; explanation: string }) => (
  <span className="group relative inline-flex items-center">
    <span className="font-semibold underline decoration-dotted cursor-help">{term}</span>
    <Info className="w-3 h-3 ml-1 text-muted-foreground" />
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border">
      {explanation}
    </span>
  </span>
);

// Site visualization component
const SiteCard = ({ 
  title, 
  status, 
  isActive,
  icon 
}: { 
  title: string; 
  status: string; 
  isActive: boolean;
  icon: React.ReactNode;
}) => {
  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    standby: 'bg-yellow-500',
    activating: 'bg-blue-500 animate-pulse',
    active: 'bg-green-500',
    syncing: 'bg-blue-500 animate-pulse',
    degraded: 'bg-orange-500',
  };

  return (
    <motion.div
      className={cn(
        'p-4 rounded-lg border-2 transition-all duration-300',
        isActive ? 'border-green-500 bg-green-500/10' : 'border-border bg-card'
      )}
      animate={{ scale: isActive ? 1.02 : 1 }}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'p-2 rounded-lg',
          isActive ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'
        )}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="font-medium">{title}</div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={cn('w-2 h-2 rounded-full', statusColors[status as keyof typeof statusColors] || 'bg-gray-500')} />
            <span className="capitalize">{status}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function BCDRSimulator() {
  const [strategy, setStrategy] = useState<DRStrategy>('warm');
  const [disaster, setDisaster] = useState<DisasterType>('datacenter');
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  const steps = generateSteps(strategy);
  const config = STRATEGIES[strategy];
  const disasterConfig = DISASTERS[disaster];
  const step = steps[Math.min(currentStep, steps.length - 1)];
  const isLastStep = currentStep >= steps.length - 1;

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentStep, steps.length]);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setIsPlaying(false);
  }, []);

  // Auto-advance simulation
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(nextStep, 2500);
    return () => clearInterval(timer);
  }, [isPlaying, nextStep]);

  // Reset when strategy changes
  useEffect(() => {
    reset();
  }, [strategy, reset]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (showIntro) {
          setShowIntro(false);
        } else {
          setIsPlaying((prev) => !prev);
        }
      }
      if (e.key === 'ArrowRight' && !isPlaying && currentStep < steps.length - 1) {
        setCurrentStep((s) => s + 1);
      }
      if (e.key === 'ArrowLeft' && !isPlaying && currentStep > 0) {
        setCurrentStep((s) => s - 1);
      }
      if (e.key === 'r' || e.key === 'R') {
        reset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentStep, steps.length, showIntro, reset]);

  // Intro screen
  if (showIntro) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            What is BCDR?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            <strong>Business Continuity & Disaster Recovery (BCDR)</strong> ensures your systems 
            can survive and recover from disasters like outages, cyberattacks, or hardware failures.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-blue-500" />
                <InfoTooltip term="RTO" explanation="Recovery Time Objective" />
              </div>
              <p className="text-sm text-muted-foreground">
                Maximum acceptable <strong>downtime</strong>. How long can your business survive without this system?
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-5 h-5 text-green-500" />
                <InfoTooltip term="RPO" explanation="Recovery Point Objective" />
              </div>
              <p className="text-sm text-muted-foreground">
                Maximum acceptable <strong>data loss</strong>. How much data can you afford to lose?
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg border bg-primary/5">
            <h4 className="font-semibold mb-3">In this simulator, you will:</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Choose a <strong>DR Strategy</strong> (Hot, Warm, or Cold site)</li>
              <li>Select a <strong>Disaster Scenario</strong></li>
              <li>Watch the <strong>Recovery Process</strong> unfold step-by-step</li>
              <li>Compare <strong>RTO, RPO, and Cost</strong> trade-offs</li>
            </ol>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Keyboard className="w-4 h-4" />
              <span>Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Space</kbd> to start</span>
            </div>
            <Button onClick={() => setShowIntro(false)} className="gap-2">
              Start Simulator <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Strategy & Disaster Selection */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* DR Strategy Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">DR Strategy</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(STRATEGIES) as DRStrategy[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStrategy(s)}
                  disabled={isPlaying}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    strategy === s
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50',
                    isPlaying && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="font-medium text-sm">{STRATEGIES[s].name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    RTO: {STRATEGIES[s].rtoMinutes}min
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Disaster Scenario Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Disaster Scenario</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(DISASTERS) as DisasterType[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDisaster(d)}
                  disabled={isPlaying}
                  className={cn(
                    'p-3 rounded-lg border-2 transition-all',
                    disaster === d
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50',
                    isPlaying && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {DISASTERS[d].icon}
                    <span className="text-sm font-medium">{DISASTERS[d].name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Simulation Visualization */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {disasterConfig.icon}
              {disasterConfig.name} Recovery
            </CardTitle>
            <Badge variant={step.phase === 'restored' ? 'default' : step.phase === 'normal' ? 'secondary' : 'destructive'}>
              {step.phase === 'restored' ? 'Recovered' : step.phase === 'normal' ? 'Normal' : 'In Progress'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
            {steps.map((s, idx) => (
              <div key={idx} className="flex items-center flex-1 min-w-0">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0',
                    idx < currentStep
                      ? 'bg-green-500 text-white'
                      : idx === currentStep
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {idx < currentStep ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                </div>
                {idx < steps.length - 1 && (
                  <div className={cn(
                    'h-1 flex-1 mx-1',
                    idx < currentStep ? 'bg-green-500' : 'bg-muted'
                  )} />
                )}
              </div>
            ))}
          </div>

          {/* Current Step Info */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center p-4 rounded-lg bg-muted/50"
            >
              <h3 className="text-xl font-bold mb-2">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
              {step.elapsedMinutes > 0 && (
                <div className="mt-2 text-sm">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Elapsed: {step.elapsedMinutes} min
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Site Visualization */}
          <div className="grid grid-cols-2 gap-4">
            <SiteCard
              title="Primary Site"
              status={step.primaryStatus}
              isActive={step.dataFlow === 'primary'}
              icon={<Server className="w-5 h-5" />}
            />
            <SiteCard
              title={`DR Site (${config.name})`}
              status={step.drStatus}
              isActive={step.dataFlow === 'dr'}
              icon={<Shield className="w-5 h-5" />}
            />
          </div>

          {/* Data Flow Indicator */}
          <div className="flex items-center justify-center gap-4 p-3 rounded-lg bg-muted/30">
            <span className="text-sm text-muted-foreground">Traffic Flow:</span>
            {step.dataFlow === 'primary' && (
              <span className="flex items-center gap-2 text-green-500">
                <Zap className="w-4 h-4" /> Primary Site
              </span>
            )}
            {step.dataFlow === 'switching' && (
              <span className="flex items-center gap-2 text-blue-500 animate-pulse">
                <ArrowRight className="w-4 h-4" /> Switching to DR...
              </span>
            )}
            {step.dataFlow === 'dr' && (
              <span className="flex items-center gap-2 text-green-500">
                <CheckCircle className="w-4 h-4" /> DR Site Active
              </span>
            )}
            {step.dataFlow === 'none' && (
              <span className="flex items-center gap-2 text-red-500">
                <XCircle className="w-4 h-4" /> Service Unavailable
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" onClick={reset} className="gap-2">
              <RotateCcw className="w-4 h-4" /> Reset
            </Button>
            <Button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={isLastStep}
              className="gap-2"
            >
              {isPlaying ? (
                <><Pause className="w-4 h-4" /> Pause</>
              ) : (
                <><Play className="w-4 h-4" /> {currentStep === 0 ? 'Start Disaster' : 'Continue'}</>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={nextStep}
              disabled={isPlaying || isLastStep}
              className="gap-2"
            >
              Step <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Keyboard hints */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded">Space</kbd> Play/Pause</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded">←</kbd> <kbd className="px-1.5 py-0.5 bg-muted rounded">→</kbd> Step</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded">R</kbd> Reset</span>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Comparison */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Strategy Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Strategy</th>
                  <th className="text-center p-2">RTO</th>
                  <th className="text-center p-2">RPO</th>
                  <th className="text-center p-2">Cost/mo</th>
                  <th className="text-left p-2 hidden sm:table-cell">Best For</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(STRATEGIES) as DRStrategy[]).map((s) => (
                  <tr
                    key={s}
                    className={cn(
                      'border-b last:border-0',
                      strategy === s && 'bg-primary/5'
                    )}
                  >
                    <td className="p-2 font-medium">{STRATEGIES[s].name}</td>
                    <td className="p-2 text-center">
                      <Badge variant={STRATEGIES[s].rtoMinutes <= 5 ? 'default' : STRATEGIES[s].rtoMinutes <= 60 ? 'secondary' : 'outline'}>
                        {STRATEGIES[s].rtoMinutes}min
                      </Badge>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant={STRATEGIES[s].rpoMinutes === 0 ? 'default' : STRATEGIES[s].rpoMinutes <= 15 ? 'secondary' : 'outline'}>
                        {STRATEGIES[s].rpoMinutes === 0 ? 'Zero' : STRATEGIES[s].rpoMinutes + 'min'}
                      </Badge>
                    </td>
                    <td className="p-2 text-center">
                      <span className="flex items-center justify-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {STRATEGIES[s].monthlyCost.toLocaleString()}
                      </span>
                    </td>
                    <td className="p-2 text-muted-foreground hidden sm:table-cell">
                      {s === 'hot' && 'Mission-critical systems'}
                      {s === 'warm' && 'Important business apps'}
                      {s === 'cold' && 'Non-critical, archival'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Selected Strategy Details */}
          <div className="mt-4 p-4 rounded-lg bg-muted/30 border">
            <h4 className="font-medium mb-3">Selected: {config.name}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-medium text-green-500 mb-1 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Pros
                </h5>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {config.pros.map((p, i) => <li key={i}>• {p}</li>)}
                </ul>
              </div>
              <div>
                <h5 className="text-sm font-medium text-red-500 mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Cons
                </h5>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {config.cons.map((c, i) => <li key={i}>• {c}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
