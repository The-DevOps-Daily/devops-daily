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
        note: 'Green ready, still serving Blue',
      },
      {
        title: 'Switch Traffic',
        v1Pods: createPods('v1', 3),
        v2Pods: createPods('v2', 3),
        trafficSplit: { v1: 0, v2: 100 },
        note: 'Instant switch to Green!',
      },
      {
        title: 'Cleanup',
        v1Pods: [],
        v2Pods: createPods('v2', 3),
        trafficSplit: { v1: 0, v2: 100 },
        note: 'Blue terminated (or kept for rollback)',
      },
    ],
    pros: ['Instant switch', 'Easy rollback', 'Zero downtime'],
    cons: ['2x resources', 'Complex setup', 'DB migrations'],
  },
  canary: {
    name: 'Canary',
    description: 'Gradually shift traffic from v1 to v2 while monitoring.',
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
        note: 'Canary pod starting',
      },
      {
        title: '10% Canary',
        v1Pods: createPods('v1', 3),
        v2Pods: createPods('v2', 1),
        trafficSplit: { v1: 90, v2: 10 },
        note: '10% traffic to canary - monitoring...',
      },
      {
        title: '50% Canary',
        v1Pods: createPods('v1', 2),
        v2Pods: createPods('v2', 2),
        trafficSplit: { v1: 50, v2: 50 },
        note: '50% traffic - looking good!',
      },
      {
        title: 'Complete',
        v1Pods: [],
        v2Pods: createPods('v2', 3),
        trafficSplit: { v1: 0, v2: 100 },
        note: 'Full rollout to v2',
      },
    ],
    pros: ['Gradual rollout', 'Controlled risk', 'Metrics-driven'],
    cons: ['Slow', 'Complex routing', 'Needs monitoring'],
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
    if (!isLastStep) {
      setCurrentStep((s) => s + 1);
    } else {
      setIsPlaying(false);
    }
  }, [isLastStep]);

  const reset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(nextStep, 2000);
    return () => clearInterval(interval);
  }, [isPlaying, nextStep]);

  useEffect(() => {
    reset();
  }, [strategy]);

  const hasV1Traffic = step.trafficSplit.v1 > 0;
  const hasV2Traffic = step.trafficSplit.v2 > 0;
  const hasAnyTraffic = hasV1Traffic || hasV2Traffic;

  const PodSlot = ({ pod, version }: { pod?: Pod; version: 'v1' | 'v2' }) => {
    const bgColor = version === 'v1' ? 'bg-blue-500' : 'bg-green-500';
    const terminatingColor = 'bg-red-400';

    return (
      <div className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {pod && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: pod.status === 'terminating' ? 0.85 : 1,
                opacity: pod.status === 'terminating' ? 0.5 : 1,
              }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`w-full h-full rounded-md flex items-center justify-center shadow-md relative ${pod.status === 'terminating' ? terminatingColor : bgColor}`}
            >
              <Server className="w-4 h-4 text-white" />
              {pod.status === 'starting' && (
                <motion.div
                  className="absolute inset-0 rounded-md border-2 border-amber-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
              className={`flex-1 h-2 rounded-full transition-colors ${i === currentStep ? 'bg-primary' : i < currentStep ? 'bg-primary/40' : 'bg-muted'}`}
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
        <div className="relative bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-xl overflow-hidden">
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

          {/* SVG Diagram */}
          <svg className="w-full" viewBox="0 0 500 200" preserveAspectRatio="xMidYMid meet">
            {/* Users Icon */}
            <g transform="translate(50, 100)">
              <circle cx="0" cy="0" r="24" className="fill-slate-200 dark:fill-slate-600" />
              <foreignObject x="-12" y="-12" width="24" height="24">
                <div className="flex items-center justify-center w-full h-full">
                  <Users className="w-5 h-5 text-slate-500" />
                </div>
              </foreignObject>
              <text x="0" y="40" textAnchor="middle" className="fill-current text-muted-foreground text-[10px] font-medium">Users</text>
            </g>

            {/* Users to LB Line */}
            <line x1="80" y1="100" x2="145" y2="100" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" className="text-slate-300 dark:text-slate-500" />
            {hasAnyTraffic && (
              <motion.circle
                cx="80"
                cy="100"
                r="4"
                className="fill-purple-500"
                animate={{ cx: [80, 145] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            )}

            {/* Load Balancer */}
            <g transform="translate(175, 100)">
              <rect x="-28" y="-28" width="56" height="56" rx="10" className="fill-purple-500" />
              <foreignObject x="-16" y="-16" width="32" height="32">
                <div className="flex items-center justify-center w-full h-full">
                  <Globe className="w-7 h-7 text-white" />
                </div>
              </foreignObject>
              <text x="0" y="46" textAnchor="middle" className="fill-current text-muted-foreground text-[9px] font-medium">Load Balancer</text>
            </g>

            {/* LB to V1 Line */}
            <line
              x1="205"
              y1="85"
              x2="295"
              y2="50"
              stroke={hasV1Traffic ? '#3b82f6' : 'currentColor'}
              strokeWidth={hasV1Traffic ? 3 : 2}
              strokeDasharray={hasV1Traffic ? '0' : '4 2'}
              className={hasV1Traffic ? '' : 'text-slate-300 dark:text-slate-500'}
            />
            {hasV1Traffic && (
              <motion.circle
                cx="205"
                cy="85"
                r="4"
                className="fill-blue-500"
                animate={{ cx: [205, 295], cy: [85, 50] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
              />
            )}

            {/* LB to V2 Line */}
            <line
              x1="205"
              y1="115"
              x2="295"
              y2="150"
              stroke={hasV2Traffic ? '#22c55e' : 'currentColor'}
              strokeWidth={hasV2Traffic ? 3 : 2}
              strokeDasharray={hasV2Traffic ? '0' : '4 2'}
              className={hasV2Traffic ? '' : 'text-slate-300 dark:text-slate-500'}
            />
            {hasV2Traffic && (
              <motion.circle
                cx="205"
                cy="115"
                r="4"
                className="fill-green-500"
                animate={{ cx: [205, 295], cy: [115, 150] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: 'linear', delay: 0.15 }}
              />
            )}

            {/* V1 Label */}
            <text
              x="350"
              y="30"
              textAnchor="middle"
              className={`text-[11px] font-bold ${step.v1Pods.length > 0 ? 'fill-blue-500' : 'fill-slate-400'}`}
            >
              v1 {step.trafficSplit.v1 > 0 ? `(${step.trafficSplit.v1}%)` : ''}
            </text>

            {/* V2 Label */}
            <text
              x="420"
              y="30"
              textAnchor="middle"
              className={`text-[11px] font-bold ${step.v2Pods.length > 0 ? 'fill-green-500' : 'fill-slate-400'}`}
            >
              v2 {step.trafficSplit.v2 > 0 ? `(${step.trafficSplit.v2}%)` : ''}
            </text>
          </svg>

          {/* Pod Columns - Absolute positioned on right side */}
          <div className="absolute top-9 right-6 flex gap-6">
            {/* V1 Column */}
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2].map((slotIdx) => (
                <PodSlot key={`v1-${slotIdx}`} pod={step.v1Pods[slotIdx]} version="v1" />
              ))}
            </div>

            {/* V2 Column */}
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2].map((slotIdx) => (
                <PodSlot key={`v2-${slotIdx}`} pod={step.v2Pods[slotIdx]} version="v2" />
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="text-center pb-3">
            <span className="bg-white/90 dark:bg-slate-800/90 px-4 py-1.5 rounded-full text-sm font-medium text-muted-foreground shadow-sm">
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
                <li key={i}>- {pro}</li>
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
