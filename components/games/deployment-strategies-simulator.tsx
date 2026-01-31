'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  RotateCcw,
  Server,
  Users,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type DeploymentStrategy = 'recreate' | 'rolling' | 'blue-green' | 'canary';

interface Pod {
  id: string;
  version: 'v1' | 'v2';
  status: 'running' | 'starting' | 'terminating';
}

interface Step {
  title: string;
  v1Pods: Pod[];
  v2Pods: Pod[];
  trafficSplit: { v1: number; v2: number };
  hasDowntime?: boolean;
  note: string;
}

const createPods = (version: 'v1' | 'v2', count: number, status: Pod['status'] = 'running'): Pod[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${version}-${i}`,
    version,
    status,
  }));

const STRATEGIES: Record<
  DeploymentStrategy,
  {
    name: string;
    description: string;
    steps: Step[];
    pros: string[];
    cons: string[];
  }
> = {
  recreate: {
    name: 'Recreate',
    description: 'Stop all old pods, then start new ones. Simple but causes downtime.',
    steps: [
      {
        title: 'Initial State',
        v1Pods: createPods('v1', 3),
        v2Pods: [],
        trafficSplit: { v1: 100, v2: 0 },
        note: 'All traffic goes to v1',
      },
      {
        title: 'Terminate v1',
        v1Pods: createPods('v1', 3, 'terminating'),
        v2Pods: [],
        trafficSplit: { v1: 0, v2: 0 },
        hasDowntime: true,
        note: 'DOWNTIME - No pods available',
      },
      {
        title: 'Start v2',
        v1Pods: [],
        v2Pods: createPods('v2', 3, 'starting'),
        trafficSplit: { v1: 0, v2: 0 },
        hasDowntime: true,
        note: 'Still starting...',
      },
      {
        title: 'Complete',
        v1Pods: [],
        v2Pods: createPods('v2', 3),
        trafficSplit: { v1: 0, v2: 100 },
        note: 'All traffic to v2',
      },
    ],
    pros: ['Simple', 'Clean state', 'Low cost'],
    cons: ['Downtime', 'No rollback', 'Risky'],
  },
  rolling: {
    name: 'Rolling Update',
    description: 'Replace pods one at a time. Zero downtime with temporary version mixing.',
    steps: [
      {
        title: 'Initial State',
        v1Pods: createPods('v1', 3),
        v2Pods: [],
        trafficSplit: { v1: 100, v2: 0 },
        note: 'All traffic goes to v1',
      },
      {
        title: 'Replace Pod 1',
        v1Pods: createPods('v1', 2),
        v2Pods: createPods('v2', 1, 'starting'),
        trafficSplit: { v1: 100, v2: 0 },
        note: 'v2 pod starting, traffic to v1',
      },
      {
        title: 'Pod 1 Ready',
        v1Pods: createPods('v1', 2),
        v2Pods: createPods('v2', 1),
        trafficSplit: { v1: 67, v2: 33 },
        note: 'Mixed: 67% v1, 33% v2',
      },
      {
        title: 'Replace Pod 2',
        v1Pods: createPods('v1', 1),
        v2Pods: createPods('v2', 2),
        trafficSplit: { v1: 33, v2: 67 },
        note: 'Mixed: 33% v1, 67% v2',
      },
      {
        title: 'Complete',
        v1Pods: [],
        v2Pods: createPods('v2', 3),
        trafficSplit: { v1: 0, v2: 100 },
        note: 'All traffic to v2',
      },
    ],
    pros: ['Zero downtime', 'Gradual rollout', 'Easy rollback'],
    cons: ['Slow', 'Version mixing', 'Complex'],
  },
  'blue-green': {
    name: 'Blue-Green',
    description: 'Run v2 alongside v1, then switch all traffic instantly.',
    steps: [
      {
        title: 'Blue Active',
        v1Pods: createPods('v1', 3),
        v2Pods: [],
        trafficSplit: { v1: 100, v2: 0 },
        note: 'Blue (v1) serves all traffic',
      },
      {
        title: 'Deploy Green',
        v1Pods: createPods('v1', 3),
        v2Pods: createPods('v2', 3, 'starting'),
        trafficSplit: { v1: 100, v2: 0 },
        note: 'Green (v2) starting in parallel',
      },
      {
        title: 'Green Ready',
        v1Pods: createPods('v1', 3),
        v2Pods: createPods('v2', 3),
        trafficSplit: { v1: 100, v2: 0 },
        note: 'Both environments ready',
      },
      {
        title: 'Switch Traffic',
        v1Pods: createPods('v1', 3),
        v2Pods: createPods('v2', 3),
        trafficSplit: { v1: 0, v2: 100 },
        note: 'Instant switch to Green (v2)',
      },
      {
        title: 'Complete',
        v1Pods: [],
        v2Pods: createPods('v2', 3),
        trafficSplit: { v1: 0, v2: 100 },
        note: 'Blue (v1) decommissioned',
      },
    ],
    pros: ['Instant switch', 'Easy rollback', 'No mixing'],
    cons: ['Double resources', 'Expensive', 'Stateful issues'],
  },
  canary: {
    name: 'Canary',
    description: 'Gradually shift traffic from v1 to v2, monitoring for issues.',
    steps: [
      {
        title: 'Initial State',
        v1Pods: createPods('v1', 3),
        v2Pods: [],
        trafficSplit: { v1: 100, v2: 0 },
        note: 'All traffic to v1',
      },
      {
        title: 'Deploy Canary',
        v1Pods: createPods('v1', 3),
        v2Pods: createPods('v2', 1, 'starting'),
        trafficSplit: { v1: 100, v2: 0 },
        note: 'Single canary pod starting',
      },
      {
        title: '10% Traffic',
        v1Pods: createPods('v1', 3),
        v2Pods: createPods('v2', 1),
        trafficSplit: { v1: 90, v2: 10 },
        note: '10% traffic to canary',
      },
      {
        title: '50% Traffic',
        v1Pods: createPods('v1', 2),
        v2Pods: createPods('v2', 2),
        trafficSplit: { v1: 50, v2: 50 },
        note: 'Gradually increasing...',
      },
      {
        title: 'Complete',
        v1Pods: [],
        v2Pods: createPods('v2', 3),
        trafficSplit: { v1: 0, v2: 100 },
        note: 'Full rollout to v2',
      },
    ],
    pros: ['Low risk', 'Gradual', 'Monitorable'],
    cons: ['Slow', 'Complex routing', 'Version mixing'],
  },
};

export default function DeploymentStrategiesSimulator() {
  const [strategy, setStrategy] = useState<DeploymentStrategy>('recreate');
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const config = STRATEGIES[strategy];
  const step = config.steps[currentStep];
  const isLastStep = currentStep === config.steps.length - 1;

  const nextStep = useCallback(() => {
    if (currentStep < config.steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentStep, config.steps.length]);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(nextStep, 2000);
    return () => clearInterval(timer);
  }, [isPlaying, nextStep]);

  useEffect(() => {
    reset();
  }, [strategy]);

  const hasV1Traffic = step.trafficSplit.v1 > 0;
  const hasV2Traffic = step.trafficSplit.v2 > 0;
  const hasAnyTraffic = hasV1Traffic || hasV2Traffic;

  const PodIcon = ({ pod, version }: { pod?: Pod; version: 'v1' | 'v2' }) => {
    const baseColor = version === 'v1' ? 'bg-blue-500' : 'bg-green-500';
    const terminatingColor = 'bg-red-400';
    const borderColor = version === 'v1' ? 'border-blue-300' : 'border-green-300';

    if (!pod) {
      return (
        <div className={cn(
          'w-9 h-9 rounded-lg border-2 border-dashed',
          'border-slate-300 dark:border-slate-600',
          'flex items-center justify-center'
        )}>
          <Server className="w-4 h-4 text-slate-300 dark:text-slate-600" />
        </div>
      );
    }

    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{
          scale: pod.status === 'terminating' ? 0.85 : 1,
          opacity: pod.status === 'terminating' ? 0.5 : 1,
        }}
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center shadow-md relative',
          pod.status === 'terminating' ? terminatingColor : baseColor
        )}
      >
        <Server className="w-4 h-4 text-white" />
        {pod.status === 'starting' && (
          <motion.div
            className={cn('absolute inset-0 rounded-lg border-2', borderColor)}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1 }}
          />
        )}
      </motion.div>
    );
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Deployment Strategies</span>
          <div className="flex gap-2">
            <Button onClick={() => setIsPlaying(!isPlaying)} variant="outline" size="sm">
              {isPlaying ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button onClick={reset} variant="outline" size="sm">
              <RotateCcw className="w-4 h-4 mr-1" /> Reset
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Strategy Selector */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STRATEGIES) as DeploymentStrategy[]).map((s) => (
            <Button
              key={s}
              onClick={() => setStrategy(s)}
              variant={strategy === s ? 'default' : 'outline'}
              size="sm"
            >
              {STRATEGIES[s].name}
            </Button>
          ))}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground">{config.description}</p>

        {/* Step Progress */}
        <div className="flex items-center gap-1">
          {config.steps.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setCurrentStep(i);
                setIsPlaying(false);
              }}
              className={cn(
                'flex-1 h-2 rounded-full transition-colors',
                i === currentStep ? 'bg-primary' : i < currentStep ? 'bg-primary/40' : 'bg-muted'
              )}
            />
          ))}
        </div>

        {/* Step Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            Step {currentStep + 1}: {step.title}
          </h3>
          <Button onClick={nextStep} disabled={isLastStep} size="sm" variant="outline">
            Next <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Main Diagram */}
        <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-6">
          {/* Downtime Overlay */}
          <AnimatePresence>
            {step.hasDowntime && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-red-900/30 rounded-xl flex items-center justify-center z-30"
              >
                <div className="bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-bold">DOWNTIME</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Horizontal Flow Layout */}
          <div className="flex items-center justify-between gap-4">
            {/* Users */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                <Users className="w-7 h-7 text-slate-500 dark:text-slate-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Users</span>
            </div>

            {/* Arrow to LB */}
            <div className="flex-1 flex items-center justify-center relative h-8">
              <div className="w-full h-0.5 bg-slate-300 dark:bg-slate-600" />
              {hasAnyTraffic && (
                <motion.div
                  className="absolute w-3 h-3 rounded-full bg-purple-500"
                  animate={{ left: ['0%', '100%'] }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              )}
              <ArrowRight className="absolute right-0 w-4 h-4 text-slate-400" />
            </div>

            {/* Load Balancer */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-xl bg-purple-500 flex items-center justify-center shadow-lg">
                <Globe className="w-7 h-7 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Load Balancer</span>
            </div>

            {/* Arrow to Pods */}
            <div className="flex-1 flex flex-col items-center justify-center gap-2 relative">
              {/* V1 Arrow */}
              <div className="w-full flex items-center relative h-6">
                <div className={cn(
                  'w-full h-0.5 transition-colors',
                  hasV1Traffic ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
                )} />
                {hasV1Traffic && (
                  <motion.div
                    className="absolute w-2.5 h-2.5 rounded-full bg-blue-500"
                    animate={{ left: ['0%', '100%'] }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                )}
                <ArrowRight className={cn(
                  'absolute right-0 w-4 h-4',
                  hasV1Traffic ? 'text-blue-500' : 'text-slate-400'
                )} />
              </div>
              {/* V2 Arrow */}
              <div className="w-full flex items-center relative h-6">
                <div className={cn(
                  'w-full h-0.5 transition-colors',
                  hasV2Traffic ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'
                )} />
                {hasV2Traffic && (
                  <motion.div
                    className="absolute w-2.5 h-2.5 rounded-full bg-green-500"
                    animate={{ left: ['0%', '100%'] }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear', delay: 0.2 }}
                  />
                )}
                <ArrowRight className={cn(
                  'absolute right-0 w-4 h-4',
                  hasV2Traffic ? 'text-green-500' : 'text-slate-400'
                )} />
              </div>
            </div>

            {/* Pod Columns */}
            <div className="flex gap-4">
              {/* V1 Column */}
              <div className="flex flex-col items-center gap-1">
                <span className={cn(
                  'text-xs font-bold mb-1',
                  hasV1Traffic ? 'text-blue-500' : 'text-slate-400'
                )}>
                  v1 {step.trafficSplit.v1 > 0 && `(${step.trafficSplit.v1}%)`}
                </span>
                <div className="flex flex-col gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <PodIcon key={`v1-${i}`} pod={step.v1Pods[i]} version="v1" />
                  ))}
                </div>
              </div>

              {/* V2 Column */}
              <div className="flex flex-col items-center gap-1">
                <span className={cn(
                  'text-xs font-bold mb-1',
                  hasV2Traffic ? 'text-green-500' : 'text-slate-400'
                )}>
                  v2 {step.trafficSplit.v2 > 0 && `(${step.trafficSplit.v2}%)`}
                </span>
                <div className="flex flex-col gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <PodIcon key={`v2-${i}`} pod={step.v2Pods[i]} version="v2" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Note Badge */}
          <div className="text-center mt-4">
            <span className="inline-block bg-white/90 dark:bg-slate-800/90 px-4 py-1.5 rounded-full text-sm font-medium text-muted-foreground shadow-sm border border-slate-200 dark:border-slate-700">
              {step.note}
            </span>
          </div>
        </div>

        {/* Completion Badge */}
        {isLastStep && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 text-green-500"
          >
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Deployment Complete!</span>
          </motion.div>
        )}

        {/* Pros/Cons */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <h4 className="font-medium text-green-600 dark:text-green-400 mb-2">Pros</h4>
            <ul className="space-y-1 text-muted-foreground text-xs">
              {config.pros.map((pro, i) => (
                <li key={i}>+ {pro}</li>
              ))}
            </ul>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <h4 className="font-medium text-red-600 dark:text-red-400 mb-2">Cons</h4>
            <ul className="space-y-1 text-muted-foreground text-xs">
              {config.cons.map((con, i) => (
                <li key={i}>- {con}</li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
