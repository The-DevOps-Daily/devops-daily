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
  ChevronRight,
  Activity,
  Zap,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type DeploymentStrategy = 'recreate' | 'rolling' | 'blue-green' | 'canary';

// Mobile breakpoint helper - component renders differently on mobile
const useMobileView = () => {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return isMobile;
};

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
  isObserving?: boolean;
  isAutomatic?: boolean;
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
      note: 'Starting automatic pod replacement',
    },
    {
      title: 'Start v2 Pod 1',
      v1Pods: createPods('v1', 3),
      v2Pods: createPods('v2', 1, 'starting'),
      trafficSplit: { v1: 100, v2: 0 },
      isAutomatic: true,
      note: 'Auto: New v2 pod starting (v1 stays up)',
    },
    {
      title: 'Pod 1 Ready',
      v1Pods: createPods('v1', 3),
      v2Pods: createPods('v2', 1),
      trafficSplit: { v1: 75, v2: 25 },
      isAutomatic: true,
      note: 'Auto: v2 pod healthy, can remove v1',
    },
    {
      title: 'Remove v1 Pod',
      v1Pods: createPods('v1', 2),
      v2Pods: createPods('v2', 1),
      trafficSplit: { v1: 67, v2: 33 },
      isAutomatic: true,
      note: 'Auto: Terminating old v1 pod',
    },
    {
      title: 'Start v2 Pod 2',
      v1Pods: createPods('v1', 2),
      v2Pods: createPods('v2', 2, 'starting'),
      trafficSplit: { v1: 67, v2: 33 },
      isAutomatic: true,
      note: 'Auto: Starting second v2 pod',
    },
    {
      title: 'Pod 2 Ready',
      v1Pods: createPods('v1', 2),
      v2Pods: createPods('v2', 2),
      trafficSplit: { v1: 50, v2: 50 },
      isAutomatic: true,
      note: 'Auto: Second v2 pod healthy',
    },
    {
      title: 'Remove v1 Pod',
      v1Pods: createPods('v1', 1),
      v2Pods: createPods('v2', 2),
      trafficSplit: { v1: 33, v2: 67 },
      isAutomatic: true,
      note: 'Auto: Terminating second v1 pod',
    },
    {
      title: 'Start v2 Pod 3',
      v1Pods: createPods('v1', 1),
      v2Pods: createPods('v2', 3, 'starting'),
      trafficSplit: { v1: 33, v2: 67 },
      isAutomatic: true,
      note: 'Auto: Starting final v2 pod',
    },
    {
      title: 'Pod 3 Ready',
      v1Pods: createPods('v1', 1),
      v2Pods: createPods('v2', 3),
      trafficSplit: { v1: 25, v2: 75 },
      isAutomatic: true,
      note: 'Auto: Final v2 pod healthy',
    },
    {
      title: 'Complete',
      v1Pods: [],
      v2Pods: createPods('v2', 3),
      trafficSplit: { v1: 0, v2: 100 },
      note: 'All pods replaced automatically',
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
       note: 'Preparing canary deployment',
     },
     {
       title: 'Deploy Canary',
       v1Pods: createPods('v1', 3),
       v2Pods: createPods('v2', 1, 'starting'),
       trafficSplit: { v1: 100, v2: 0 },
       note: 'Deploy single canary pod',
     },
     {
       title: 'Route 10%',
       v1Pods: createPods('v1', 3),
       v2Pods: createPods('v2', 1),
       trafficSplit: { v1: 90, v2: 10 },
       note: 'Manually route 10% to canary',
     },
     {
       title: 'Observe Metrics',
       v1Pods: createPods('v1', 3),
       v2Pods: createPods('v2', 1),
       trafficSplit: { v1: 90, v2: 10 },
       isObserving: true,
       note: 'Monitor error rates, latency, logs...',
     },
     {
       title: 'Increase to 50%',
       v1Pods: createPods('v1', 2),
       v2Pods: createPods('v2', 2),
       trafficSplit: { v1: 50, v2: 50 },
       note: 'Manually increase traffic after validation',
     },
     {
       title: 'Final Check',
       v1Pods: createPods('v1', 2),
       v2Pods: createPods('v2', 2),
       trafficSplit: { v1: 50, v2: 50 },
       isObserving: true,
       note: 'Verify metrics before full rollout',
     },
     {
       title: 'Full Rollout',
       v1Pods: [],
       v2Pods: createPods('v2', 3),
       trafficSplit: { v1: 0, v2: 100 },
       note: 'Manual decision: promote to 100%',
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
  const isMobile = useMobileView();

 const config = STRATEGIES[strategy];
 const safeStep = Math.min(currentStep, config.steps.length - 1);
 const step = config.steps[safeStep];
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
 }, [strategy, reset]);

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
          'w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg border-2 border-dashed',
          'border-slate-300 dark:border-slate-600',
          'flex items-center justify-center'
        )}>
          <Server className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-300 dark:text-slate-600" />
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
          'w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg flex items-center justify-center shadow-md relative',
          pod.status === 'terminating' ? terminatingColor : baseColor
        )}
      >
        <Server className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
        {pod.status === 'starting' && (
          <motion.div
            className={cn('absolute inset-0 rounded-md sm:rounded-lg border-2', borderColor)}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1 }}
          />
        )}
      </motion.div>
    );
  };

  const TrafficLine = ({ active, color }: { active: boolean; color: 'blue' | 'green' | 'purple' }) => {
    const colorClasses = {
      blue: { line: 'bg-blue-400', dot: 'bg-blue-500', arrow: 'text-blue-500' },
      green: { line: 'bg-green-400', dot: 'bg-green-500', arrow: 'text-green-500' },
      purple: { line: 'bg-purple-400', dot: 'bg-purple-500', arrow: 'text-purple-500' },
    };
    const colors = colorClasses[color];

    return (
      <div className="flex-1 flex items-center min-w-[30px]">
        <div className={cn(
          'flex-1 h-0.5 transition-colors',
          active ? colors.line : 'bg-slate-300 dark:bg-slate-600'
        )} />
        {active && (
          <motion.div
            className={cn('absolute w-2 h-2 rounded-full shadow-sm', colors.dot)}
            style={{ left: 0 }}
            animate={{ left: ['0%', 'calc(100% - 8px)'] }}
            transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
          />
        )}
        <ChevronRight className={cn(
          'w-4 h-4 -ml-0.5 flex-shrink-0',
          active ? colors.arrow : 'text-slate-400'
        )} />
      </div>
    );
  };

  return (
    <Card className="w-full max-w-3xl mx-auto overflow-hidden">
      <CardHeader className="pb-3 px-3 sm:px-6">
        <CardTitle className="flex items-center justify-between">
          <span className="text-base sm:text-lg">Deployment Strategies</span>
          <div className="flex gap-1 sm:gap-2">
            <Button onClick={() => setIsPlaying(!isPlaying)} variant="outline" size="sm" className="px-2 sm:px-3">
              {isPlaying ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
              <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'Play'}</span>
            </Button>
            <Button onClick={reset} variant="outline" size="sm" className="px-2 sm:px-3">
              <RotateCcw className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline"> Reset</span>
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
        {/* Strategy Selector */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {(Object.keys(STRATEGIES) as DeploymentStrategy[]).map((s) => (
            <Button
              key={s}
              onClick={() => setStrategy(s)}
              variant={strategy === s ? 'default' : 'outline'}
              size="sm"
              className="text-xs sm:text-sm px-2 sm:px-3"
            >
              {STRATEGIES[s].name}
            </Button>
          ))}
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-muted-foreground">{config.description}</p>

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
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
         <div className="flex flex-wrap items-center gap-2 sm:gap-3">
           <h3 className="font-semibold text-sm sm:text-base">
             Step {currentStep + 1}: {step.title}
           </h3>
           {step.isAutomatic && (
             <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
               <Zap className="w-3 h-3" /> AUTOMATIC
             </span>
           )}
           {step.isObserving && (
             <motion.span
               className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
               animate={{ opacity: [1, 0.5, 1] }}
               transition={{ repeat: Infinity, duration: 1.5 }}
             >
               <Activity className="w-3 h-3" /> OBSERVING
             </motion.span>
           )}
         </div>
         <Button onClick={nextStep} disabled={isLastStep} size="sm" variant="outline">
           Next <ArrowRight className="w-4 h-4 ml-1" />
         </Button>
        </div>

        {/* Main Diagram */}
        <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-3 sm:p-6">
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

          {/* Responsive layout: Vertical on mobile, Horizontal on desktop */}
          <div className={cn(
            'flex gap-3',
            isMobile ? 'flex-col items-center' : 'flex-row items-center'
          )}>
            {/* Users */}
            <div className={cn(
              'flex flex-shrink-0',
              isMobile ? 'flex-row items-center gap-3' : 'flex-col items-center'
            )}>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 dark:text-slate-400" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground sm:mt-1">Users</span>
            </div>

            {/* Line: Users to LB */}
            <div className={cn(
              'flex-1 flex items-center relative',
              isMobile ? 'flex-col min-h-[30px] w-0.5' : 'flex-row min-w-[30px] sm:min-w-[40px]'
            )}>
              <div className={cn(
                'flex-1',
                isMobile ? 'w-0.5 h-full' : 'h-0.5 w-full',
                hasAnyTraffic ? 'bg-purple-400' : 'bg-slate-300 dark:bg-slate-600'
              )} />
              {hasAnyTraffic && (
                <motion.div
                  className="absolute w-2 h-2 rounded-full bg-purple-500 shadow-sm"
                  animate={isMobile ? { top: ['0%', 'calc(100% - 8px)'] } : { left: ['0%', 'calc(100% - 8px)'] }}
                  transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                />
              )}
              <ChevronRight className={cn(
                'w-4 h-4 flex-shrink-0',
                isMobile ? 'rotate-90 -mt-0.5' : '-ml-0.5',
                hasAnyTraffic ? 'text-purple-500' : 'text-slate-400'
              )} />
            </div>

            {/* Load Balancer - Centered */}
            <div className={cn(
              'flex flex-shrink-0',
              isMobile ? 'flex-row items-center gap-2' : 'flex-col items-center'
            )}>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500 flex items-center justify-center shadow-md">
                <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground sm:mt-1">LB</span>
            </div>

            {/* Branching paths from LB to v1/v2 */}
            <div className={cn(
              'flex-1 flex justify-center gap-2 sm:gap-3',
              isMobile ? 'flex-row min-h-[30px]' : 'flex-col min-w-[40px] sm:min-w-[60px]'
            )}>
              {/* V1 Path */}
              <div className={cn(
                'flex items-center relative',
                isMobile ? 'flex-col flex-1' : 'flex-row'
              )}>
                <div className={cn(
                  'flex-1',
                  isMobile ? 'w-0.5 h-full' : 'h-0.5 w-full',
                  hasV1Traffic ? 'bg-blue-400' : 'bg-slate-300 dark:bg-slate-600'
                )} />
                {hasV1Traffic && (
                  <motion.div
                    className="absolute w-2 h-2 rounded-full bg-blue-500 shadow-sm"
                    animate={isMobile ? { top: ['0%', 'calc(100% - 8px)'] } : { left: ['0%', 'calc(100% - 8px)'] }}
                    transition={{ duration: 0.5, repeat: Infinity, ease: 'linear', delay: 0.3 }}
                  />
                )}
                <ChevronRight className={cn(
                  'w-4 h-4 flex-shrink-0',
                  isMobile ? 'rotate-90 -mt-0.5' : '-ml-0.5',
                  hasV1Traffic ? 'text-blue-500' : 'text-slate-400'
                )} />
              </div>
              {/* V2 Path */}
              <div className={cn(
                'flex items-center relative',
                isMobile ? 'flex-col flex-1' : 'flex-row'
              )}>
                <div className={cn(
                  'flex-1',
                  isMobile ? 'w-0.5 h-full' : 'h-0.5 w-full',
                  hasV2Traffic ? 'bg-green-400' : 'bg-slate-300 dark:bg-slate-600'
                )} />
                {hasV2Traffic && (
                  <motion.div
                    className="absolute w-2 h-2 rounded-full bg-green-500 shadow-sm"
                    animate={isMobile ? { top: ['0%', 'calc(100% - 8px)'] } : { left: ['0%', 'calc(100% - 8px)'] }}
                    transition={{ duration: 0.5, repeat: Infinity, ease: 'linear', delay: 0.3 }}
                  />
                )}
                <ChevronRight className={cn(
                  'w-4 h-4 flex-shrink-0',
                  isMobile ? 'rotate-90 -mt-0.5' : '-ml-0.5',
                  hasV2Traffic ? 'text-green-500' : 'text-slate-400'
                )} />
              </div>
            </div>

            {/* Pod columns: v1 on top, v2 on bottom */}
            <div className={cn(
              'flex gap-2 sm:gap-3 flex-shrink-0',
              isMobile ? 'flex-row' : 'flex-col'
            )}>
              {/* V1 Pods Row */}
              <div className={cn(
                'flex items-center gap-1.5 sm:gap-2',
                isMobile ? 'flex-col' : 'flex-row'
              )}>
                <span className={cn(
                  'text-[10px] sm:text-xs font-bold',
                  isMobile ? 'w-auto' : 'w-10 sm:w-12',
                  hasV1Traffic ? 'text-blue-500' : 'text-slate-400'
                )}>
                  v1 {step.trafficSplit.v1 > 0 && `${step.trafficSplit.v1}%`}
                </span>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <PodIcon key={`v1-${i}`} pod={step.v1Pods[i]} version="v1" />
                  ))}
                </div>
              </div>
              {/* V2 Pods Row */}
              <div className={cn(
                'flex items-center gap-1.5 sm:gap-2',
                isMobile ? 'flex-col' : 'flex-row'
              )}>
                <span className={cn(
                  'text-[10px] sm:text-xs font-bold',
                  isMobile ? 'w-auto' : 'w-10 sm:w-12',
                  hasV2Traffic ? 'text-green-500' : 'text-slate-400'
                )}>
                  v2 {step.trafficSplit.v2 > 0 && `${step.trafficSplit.v2}%`}
                </span>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <PodIcon key={`v2-${i}`} pod={step.v2Pods[i]} version="v2" />
                  ))}
                </div>
              </div>
            </div>
          </div>

         {/* Note Badge */}
         <div className="text-center mt-3 sm:mt-4">
           {step.isObserving ? (
             <motion.div
               className="inline-flex items-center gap-1.5 sm:gap-2 bg-amber-50 dark:bg-amber-900/30 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400 shadow-sm border border-amber-200 dark:border-amber-700"
               animate={{ borderColor: ['rgba(251,191,36,0.3)', 'rgba(251,191,36,0.8)', 'rgba(251,191,36,0.3)'] }}
               transition={{ repeat: Infinity, duration: 1.5 }}
             >
               <motion.div
                 animate={{ scale: [1, 1.2, 1] }}
                 transition={{ repeat: Infinity, duration: 1.5 }}
               >
                 <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
               </motion.div>
               <span>{step.note}</span>
             </motion.div>
           ) : step.isAutomatic ? (
             <span className="inline-flex items-center gap-1.5 sm:gap-2 bg-blue-50 dark:bg-blue-900/30 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-700">
               <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
               <span>{step.note}</span>
             </span>
           ) : (
             <span className="inline-block bg-white/90 dark:bg-slate-800/90 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium text-muted-foreground shadow-sm border border-slate-200 dark:border-slate-700">
               {step.note}
             </span>
           )}
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
        <div className="grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
          <div className="p-2 sm:p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <h4 className="font-medium text-green-600 dark:text-green-400 mb-1 sm:mb-2 text-xs sm:text-sm">Pros</h4>
            <ul className="space-y-0.5 sm:space-y-1 text-muted-foreground text-[10px] sm:text-xs">
              {config.pros.map((pro, i) => (
                <li key={i}>+ {pro}</li>
              ))}
            </ul>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <h4 className="font-medium text-red-600 dark:text-red-400 mb-1 sm:mb-2 text-xs sm:text-sm">Cons</h4>
            <ul className="space-y-0.5 sm:space-y-1 text-muted-foreground text-[10px] sm:text-xs">
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
