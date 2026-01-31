'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Play,
  RotateCcw,
  Server,
  Users,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';

type DeploymentStrategy = 'recreate' | 'rolling' | 'blue-green' | 'canary';

interface Pod {
  version: 'v1' | 'v2';
  status: 'running' | 'starting' | 'terminating';
}

interface Step {
  title: string;
  pods: Pod[];
  traffic: ('v1' | 'v2' | 'down')[];
  note?: string;
}

const STRATEGIES: Record<DeploymentStrategy, {
  name: string;
  description: string;
  steps: Step[];
  pros: string[];
  cons: string[];
}> = {
  recreate: {
    name: 'Recreate',
    description: 'Stop all old pods, then start all new pods. Simple but causes downtime.',
    steps: [
      {
        title: 'Initial State',
        pods: [
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
        ],
        traffic: ['v1', 'v1', 'v1'],
        note: 'All traffic goes to v1 pods',
      },
      {
        title: 'Terminate v1',
        pods: [
          { version: 'v1', status: 'terminating' },
          { version: 'v1', status: 'terminating' },
          { version: 'v1', status: 'terminating' },
        ],
        traffic: ['down', 'down', 'down'],
        note: '\u26a0\ufe0f DOWNTIME - No pods available',
      },
      {
        title: 'Start v2',
        pods: [
          { version: 'v2', status: 'starting' },
          { version: 'v2', status: 'starting' },
          { version: 'v2', status: 'starting' },
        ],
        traffic: ['down', 'down', 'down'],
        note: '\u26a0\ufe0f Still starting up...',
      },
      {
        title: 'Complete',
        pods: [
          { version: 'v2', status: 'running' },
          { version: 'v2', status: 'running' },
          { version: 'v2', status: 'running' },
        ],
        traffic: ['v2', 'v2', 'v2'],
        note: '\u2713 All traffic now goes to v2',
      },
    ],
    pros: ['Simple', 'Clean state', 'Low cost'],
    cons: ['Downtime', 'No rollback', 'Risky'],
  },
  rolling: {
    name: 'Rolling Update',
    description: 'Replace pods one at a time. Zero downtime but temporary version mixing.',
    steps: [
      {
        title: 'Initial State',
        pods: [
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
        ],
        traffic: ['v1', 'v1', 'v1'],
        note: 'All traffic goes to v1 pods',
      },
      {
        title: 'Replace Pod 1',
        pods: [
          { version: 'v2', status: 'starting' },
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
        ],
        traffic: ['v1', 'v1'],
        note: 'Traffic continues to remaining v1 pods',
      },
      {
        title: 'Pod 1 Ready',
        pods: [
          { version: 'v2', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
        ],
        traffic: ['v2', 'v1', 'v1'],
        note: 'Mixed traffic: 33% v2, 67% v1',
      },
      {
        title: 'Replace Pod 2',
        pods: [
          { version: 'v2', status: 'running' },
          { version: 'v2', status: 'starting' },
          { version: 'v1', status: 'running' },
        ],
        traffic: ['v2', 'v1'],
        note: 'Traffic to healthy pods only',
      },
      {
        title: 'Pod 2 Ready',
        pods: [
          { version: 'v2', status: 'running' },
          { version: 'v2', status: 'running' },
          { version: 'v1', status: 'running' },
        ],
        traffic: ['v2', 'v2', 'v1'],
        note: 'Mixed traffic: 67% v2, 33% v1',
      },
      {
        title: 'Complete',
        pods: [
          { version: 'v2', status: 'running' },
          { version: 'v2', status: 'running' },
          { version: 'v2', status: 'running' },
        ],
        traffic: ['v2', 'v2', 'v2'],
        note: '\u2713 All traffic now goes to v2',
      },
    ],
    pros: ['Zero downtime', 'Gradual', 'Easy rollback'],
    cons: ['Version mixing', 'Slower', 'Needs compatibility'],
  },
  'blue-green': {
    name: 'Blue-Green',
    description: 'Run two identical environments. Switch traffic instantly.',
    steps: [
      {
        title: 'Initial State',
        pods: [
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
        ],
        traffic: ['v1', 'v1', 'v1'],
        note: 'Blue environment (v1) is live',
      },
      {
        title: 'Deploy Green',
        pods: [
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v2', status: 'starting' },
          { version: 'v2', status: 'starting' },
          { version: 'v2', status: 'starting' },
        ],
        traffic: ['v1', 'v1', 'v1'],
        note: 'Green (v2) starting, Blue still serves traffic',
      },
      {
        title: 'Green Ready',
        pods: [
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v2', status: 'running' },
          { version: 'v2', status: 'running' },
          { version: 'v2', status: 'running' },
        ],
        traffic: ['v1', 'v1', 'v1'],
        note: 'Both environments ready, Blue still live',
      },
      {
        title: 'Switch Traffic',
        pods: [
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v2', status: 'running' },
          { version: 'v2', status: 'running' },
          { version: 'v2', status: 'running' },
        ],
        traffic: ['v2', 'v2', 'v2'],
        note: '\u26a1 Instant switch! Green (v2) is now live',
      },
      {
        title: 'Complete',
        pods: [
          { version: 'v2', status: 'running' },
          { version: 'v2', status: 'running' },
          { version: 'v2', status: 'running' },
        ],
        traffic: ['v2', 'v2', 'v2'],
        note: '\u2713 Blue environment removed',
      },
    ],
    pros: ['Instant rollback', 'Zero downtime', 'Full testing'],
    cons: ['Double cost', 'DB migrations hard', 'Resource heavy'],
  },
  canary: {
    name: 'Canary',
    description: 'Send small percentage of traffic to new version, gradually increase.',
    steps: [
      {
        title: 'Initial State',
        pods: [
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
        ],
        traffic: ['v1', 'v1', 'v1'],
        note: '100% traffic to v1',
      },
      {
        title: 'Deploy Canary',
        pods: [
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v2', status: 'running' },
        ],
        traffic: ['v1', 'v1', 'v1', 'v2'],
        note: '\ud83d\udc24 10% traffic to canary (v2)',
      },
      {
        title: 'Increase to 25%',
        pods: [
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v2', status: 'running' },
        ],
        traffic: ['v1', 'v1', 'v1', 'v2'],
        note: '\ud83d\udcca Monitoring metrics... 25% to v2',
      },
      {
        title: 'Increase to 50%',
        pods: [
          { version: 'v1', status: 'running' },
          { version: 'v1', status: 'running' },
          { version: 'v2', status: 'running' },
          { version: 'v2', status: 'running' },
        ],
        traffic: ['v1', 'v1', 'v2', 'v2'],
        note: '\ud83d\udcca Looks good! 50% to v2',
      },
      {
        title: 'Complete Rollout',
        pods: [
          { version: 'v2', status: 'running' },
          { version: 'v2', status: 'running' },
          { version: 'v2', status: 'running' },
        ],
        traffic: ['v2', 'v2', 'v2'],
        note: '\u2713 100% traffic to v2, v1 removed',
      },
    ],
    pros: ['Low risk', 'Real testing', 'Data-driven'],
    cons: ['Complex routing', 'Slow', 'Needs monitoring'],
  },
};

function PodBox({ pod }: { pod: Pod }) {
  const bgColor = pod.version === 'v1' ? 'bg-blue-500' : 'bg-green-500';
  const borderColor = {
    running: 'border-transparent',
    starting: 'border-amber-400',
    terminating: 'border-red-400',
  }[pod.status];
  const opacity = pod.status === 'terminating' ? 'opacity-50' : 'opacity-100';

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`relative w-12 h-12 rounded-lg ${bgColor} ${opacity} border-2 ${borderColor} flex flex-col items-center justify-center shadow-lg`}
    >
      <Server className="w-5 h-5 text-white" />
      <span className="text-[10px] font-bold text-white">{pod.version}</span>
      {pod.status === 'starting' && (
        <motion.div
          className="absolute inset-0 rounded-lg border-2 border-amber-400"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1 }}
        />
      )}
    </motion.div>
  );
}

function TrafficIndicator({ target }: { target: 'v1' | 'v2' | 'down' }) {
  if (target === 'down') {
    return (
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 0.5 }}
        className="w-2 h-2 rounded-full bg-red-500"
      />
    );
  }
  const color = target === 'v1' ? 'bg-blue-400' : 'bg-green-400';
  return (
    <motion.div
      animate={{ x: [0, 4, 0] }}
      transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut' }}
      className={`w-2 h-2 rounded-full ${color}`}
    />
  );
}

export default function DeploymentStrategiesSimulator() {
  const [strategy, setStrategy] = useState<DeploymentStrategy>('rolling');
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

  const reset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  // Auto-play
  React.useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(nextStep, 2000);
    return () => clearTimeout(timer);
  }, [isPlaying, nextStep]);

  // Reset when strategy changes
  React.useEffect(() => {
    reset();
  }, [strategy]);

  const v1Pods = step.pods.filter((p) => p.version === 'v1');
  const v2Pods = step.pods.filter((p) => p.version === 'v2');
  const trafficToV1 = step.traffic.filter((t) => t === 'v1').length;
  const trafficToV2 = step.traffic.filter((t) => t === 'v2').length;
  const hasDowntime = step.traffic.some((t) => t === 'down');

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Deployment Strategies</span>
          <div className="flex gap-2">
            <Button
              onClick={() => (isPlaying ? setIsPlaying(false) : setIsPlaying(true))}
              size="sm"
              disabled={isLastStep}
            >
              <Play className="w-4 h-4 mr-1" />
              {isPlaying ? 'Playing...' : 'Auto-Play'}
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
          {config.steps.map((s, i) => (
            <button
              key={i}
              onClick={() => { setCurrentStep(i); setIsPlaying(false); }}
              className={`flex-1 h-2 rounded-full transition-colors ${
                i === currentStep
                  ? 'bg-primary'
                  : i < currentStep
                    ? 'bg-primary/40'
                    : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step Title & Note */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Step {currentStep + 1}: {step.title}</h3>
          <Button
            onClick={nextStep}
            disabled={isLastStep}
            size="sm"
            variant="outline"
          >
            Next <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Main Visualization */}
        <div className="relative bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-6">
          {/* Downtime Overlay */}
          {hasDowntime && (
            <div className="absolute inset-0 bg-red-900/20 rounded-xl flex items-center justify-center z-10">
              <div className="bg-red-500/90 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">DOWNTIME</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            {/* Users */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                <Users className="w-7 h-7 text-slate-500" />
              </div>
              <span className="text-xs text-muted-foreground">Users</span>
            </div>

            {/* Traffic Flow */}
            <div className="flex-1 flex flex-col items-center gap-1">
              <div className="flex gap-1">
                {step.traffic.slice(0, 5).map((t, i) => (
                  <TrafficIndicator key={i} target={t} />
                ))}
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
              <div className="text-xs text-muted-foreground">
                {hasDowntime ? (
                  <span className="text-red-500">No traffic</span>
                ) : (
                  <>
                    {trafficToV1 > 0 && <span className="text-blue-500">{Math.round((trafficToV1 / step.traffic.length) * 100)}% v1</span>}
                    {trafficToV1 > 0 && trafficToV2 > 0 && ' / '}
                    {trafficToV2 > 0 && <span className="text-green-500">{Math.round((trafficToV2 / step.traffic.length) * 100)}% v2</span>}
                  </>
                )}
              </div>
            </div>

            {/* Pods */}
           <div className="flex gap-6">
             {/* V1 Pods - Fixed width for symmetry */}
             <div className="w-14 flex flex-col items-center gap-2">
               <span className={`text-xs font-medium ${v1Pods.length > 0 ? 'text-blue-500' : 'text-muted-foreground/30'}`}>v1</span>
               <div className="flex flex-col gap-2 min-h-[148px]">
                 {v1Pods.map((pod, i) => (
                   <PodBox key={`v1-${i}`} pod={pod} />
                 ))}
               </div>
             </div>
             {/* V2 Pods - Fixed width for symmetry */}
             <div className="w-14 flex flex-col items-center gap-2">
               <span className={`text-xs font-medium ${v2Pods.length > 0 ? 'text-green-500' : 'text-muted-foreground/30'}`}>v2</span>
               <div className="flex flex-col gap-2 min-h-[148px]">
                 {v2Pods.map((pod, i) => (
                   <PodBox key={`v2-${i}`} pod={pod} />
                   ))}
               </div>
             </div>
           </div>
          </div>

          {/* Note */}
          {step.note && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {step.note}
            </div>
          )}
        </div>

        {/* Completion Badge */}
        {isLastStep && (
          <div className="flex items-center justify-center gap-2 text-green-500">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Deployment Complete!</span>
          </div>
        )}

        {/* Pros/Cons */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <h4 className="font-medium text-green-500 mb-2">\u2713 Pros</h4>
            <ul className="space-y-1 text-muted-foreground text-xs">
              {config.pros.map((pro, i) => (
                <li key={i}>\u2022 {pro}</li>
              ))}
            </ul>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <h4 className="font-medium text-red-500 mb-2">\u2717 Cons</h4>
            <ul className="space-y-1 text-muted-foreground text-xs">
              {config.cons.map((con, i) => (
                <li key={i}>\u2022 {con}</li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
