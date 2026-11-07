'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  CircleCheck,
  Eye,
  Globe,
  Keyboard,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Server,
  TriangleAlert,
  Users,
  Zap,
} from 'lucide-react';
import { MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  SIM_CATEGORY,
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFrame,
  SimMissionList,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  useMissions,
  type Mission,
} from '@/components/games/sim';
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
  isObserving?: boolean;
  isAutomatic?: boolean;
  note: string;
}
const createPods = (
  version: 'v1' | 'v2',
  count: number,
  status: Pod['status'] = 'running'
): Pod[] => Array.from({ length: count }, (_, i) => ({ id: `${version}-${i}`, version, status }));

const STRATEGIES: Record<
  DeploymentStrategy,
  { name: string; description: string; steps: Step[]; pros: string[]; cons: string[] }
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

const STRATEGY_KEYS: DeploymentStrategy[] = ['recreate', 'rolling', 'blue-green', 'canary'];
const MISSIONS: Mission<{ strategy: DeploymentStrategy; step: number; last: number }>[] = [
  {
    id: 'recreate',
    label: 'Play Recreate to the end',
    hint: 'Watch what users get between v1 and v2.',
    check: (s) => s.strategy === 'recreate' && s.step === s.last,
  },
  {
    id: 'rolling',
    label: 'Play Rolling Update to the end',
    hint: 'Pods are replaced one at a time.',
    check: (s) => s.strategy === 'rolling' && s.step === s.last,
  },
  {
    id: 'blue-green',
    label: 'Play Blue-Green to the end',
    hint: 'Both versions run before traffic moves.',
    check: (s) => s.strategy === 'blue-green' && s.step === s.last,
  },
  {
    id: 'canary',
    label: 'Play Canary to the end',
    hint: 'A small share of users tries v2 first.',
    check: (s) => s.strategy === 'canary' && s.step === s.last,
  },
];
const COMPARISON = STRATEGY_KEYS.map((key) => ({
  key,
  name: STRATEGIES[key].name,
  steps: STRATEGIES[key].steps.length,
  downtime: STRATEGIES[key].steps.some((s) => s.hasDowntime),
  mixed: STRATEGIES[key].steps.some((s) => s.trafficSplit.v1 > 0 && s.trafficSplit.v2 > 0),
}));

function PodIcon({ pod, version }: { pod?: Pod; version: 'v1' | 'v2' }) {
  const category = version === 'v1' ? SIM_CATEGORY.sky : SIM_CATEGORY.emerald;
  const icon =
    version === 'v1' ? 'text-sky-700 dark:text-sky-300' : 'text-emerald-700 dark:text-emerald-300';
  const classes = !pod
    ? 'border border-dashed border-border'
    : pod.status === 'terminating'
      ? SIM_TONE.danger.surface
      : cn(
          category.fill,
          category.border,
          'border',
          pod.status === 'starting' && 'border-dashed opacity-70'
        );
  const label = pod ? `${version} pod, ${pod.status}` : 'empty slot';
  const body = (
    <Server
      className={cn(
        'h-3.5 w-3.5 sm:h-4 sm:w-4',
        pod?.status === 'terminating'
          ? 'text-wrong-foreground'
          : pod
            ? icon
            : 'text-muted-foreground/50'
      )}
      aria-hidden="true"
    />
  );
  if (!pod)
    return (
      <div
        role="img"
        aria-label={label}
        className={cn('grid h-6 w-6 place-items-center rounded-md sm:h-8 sm:w-8', classes)}
      >
        {body}
      </div>
    );
  return (
    <motion.div
      role="img"
      aria-label={label}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{
        scale: pod.status === 'terminating' ? 0.85 : 1,
        opacity: pod.status === 'terminating' ? 0.6 : 1,
      }}
      className={cn('grid h-6 w-6 place-items-center rounded-md border sm:h-8 sm:w-8', classes)}
    >
      {body}
    </motion.div>
  );
}

function TrafficLine({
  active,
  tone,
  playing,
}: {
  active: boolean;
  tone: 'primary' | 'sky' | 'emerald';
  playing: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const colors = {
    primary: { line: 'bg-primary', arrow: 'text-primary', dot: 'bg-primary' },
    sky: { line: 'bg-sky-500', arrow: 'text-sky-600 dark:text-sky-400', dot: 'bg-sky-500' },
    emerald: {
      line: 'bg-emerald-500',
      arrow: 'text-emerald-600 dark:text-emerald-400',
      dot: 'bg-emerald-500',
    },
  }[tone];
  return (
    <div className="relative flex min-w-4 flex-1 items-center sm:min-w-10">
      <div className={cn('h-0.5 flex-1', active ? colors.line : 'bg-border')} />
      {active && playing && !reducedMotion && (
        <motion.span
          className={cn('absolute h-1.5 w-1.5 rounded-full', colors.dot)}
          animate={{ left: ['0%', 'calc(100% - 22px)'] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
      )}
      <ChevronRight
        className={cn('-ml-0.5 h-4 w-4 shrink-0', active ? colors.arrow : 'text-muted-foreground')}
        aria-hidden="true"
      />
    </div>
  );
}

export default function DeploymentStrategiesSimulator() {
  const [strategy, setStrategy] = useState<DeploymentStrategy>('recreate');
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [tab, setTab] = useState<'diagram' | 'strategies'>('diagram');
  const config = STRATEGIES[strategy];
  const safeStep = Math.min(currentStep, config.steps.length - 1);
  const step = config.steps[safeStep];
  const isLastStep = currentStep === config.steps.length - 1;
  const nextStep = useCallback(() => {
    if (currentStep < config.steps.length - 1) setCurrentStep((s) => s + 1);
    else setIsPlaying(false);
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
  const pickStrategy = (s: DeploymentStrategy) => {
    setStrategy(s);
    setCurrentStep(0);
    setIsPlaying(false);
  };
  const goToStep = (i: number) => {
    setCurrentStep(i);
    setIsPlaying(false);
  };
  const previousStep = () => {
    setIsPlaying(false);
    setCurrentStep((s) => Math.max(0, s - 1));
  };
  const missionState = useMemo(
    () => ({ strategy, step: currentStep, last: config.steps.length - 1 }),
    [strategy, currentStep, config.steps.length]
  );
  const missions = useMissions(MISSIONS, missionState);
  const doneIds = new Set(
    missions.missions.filter((mission) => mission.done).map((mission) => mission.id)
  );
  const startOver = () => {
    missions.reset();
    setDismissed(false);
    pickStrategy('recreate');
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
      target.isContentEditable ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    )
      return;
    if (event.key === 'ArrowRight' && currentStep < config.steps.length - 1) {
      event.preventDefault();
      setIsPlaying(false);
      setCurrentStep((s) => s + 1);
    } else if (event.key === 'ArrowLeft' && currentStep > 0) {
      event.preventDefault();
      setIsPlaying(false);
      setCurrentStep((s) => s - 1);
    } else {
      const selected = STRATEGY_KEYS[Number(event.key) - 1];
      if (selected) {
        event.preventDefault();
        pickStrategy(selected);
      }
    }
  };
  const hasV1Traffic = step.trafficSplit.v1 > 0;
  const hasV2Traffic = step.trafficSplit.v2 > 0;
  const hasAnyTraffic = hasV1Traffic || hasV2Traffic;
  const playLabel = isPlaying ? 'Pause' : isLastStep ? 'Replay' : 'Play';
  const PlayIcon = isPlaying ? Pause : isLastStep ? RotateCcw : Play;
  const togglePlay = () => {
    if (isPlaying) setIsPlaying(false);
    else if (isLastStep) {
      reset();
      setIsPlaying(true);
    } else setIsPlaying(true);
  };
  const stepButtons = (size: 'bar' | 'phone') => (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={size === 'bar' ? 'h-8 w-8 px-0' : 'h-10 w-10 px-0'}
        onClick={previousStep}
        disabled={safeStep === 0}
        aria-label="Previous step"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="sm"
        className={size === 'bar' ? 'h-8' : 'h-10 flex-1'}
        onClick={togglePlay}
      >
        <PlayIcon className="h-4 w-4" aria-hidden="true" /> {playLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={size === 'bar' ? 'h-8 w-8 px-0' : 'h-10 w-10 px-0'}
        onClick={nextStep}
        disabled={isLastStep}
        aria-label="Next step"
      >
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </>
  );
  const diagram = (
    <section className="space-y-3 rounded-lg border bg-card p-3">
      <div className="rounded-md bg-muted/50 p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex shrink-0 flex-col items-center gap-1">
            <div
              className={cn(
                'grid h-10 w-10 place-items-center rounded-full border sm:h-12 sm:w-12',
                SIM_CATEGORY.neutral.fill,
                SIM_CATEGORY.neutral.border
              )}
            >
              <Users className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" aria-hidden="true" />
            </div>
            <span className="text-xs text-muted-foreground">Users</span>
          </div>
          <TrafficLine active={hasAnyTraffic} tone="primary" playing={isPlaying} />
          <div className="flex shrink-0 flex-col items-center gap-1">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-primary/40 bg-primary/15 sm:h-12 sm:w-12">
              <Globe className="h-4 w-4 text-primary sm:h-5 sm:w-5" aria-hidden="true" />
            </div>
            <span className="text-xs text-muted-foreground">LB</span>
          </div>
          <div className="min-w-40 flex-1 space-y-2">
            {(['v1', 'v2'] as const).map((version) => {
              const active = version === 'v1' ? hasV1Traffic : hasV2Traffic;
              const pods = version === 'v1' ? step.v1Pods : step.v2Pods;
              const color =
                version === 'v1'
                  ? 'text-sky-700 dark:text-sky-300'
                  : 'text-emerald-700 dark:text-emerald-300';
              return (
                <div key={version} className="flex min-w-0 items-center gap-1.5">
                  <TrafficLine
                    active={active}
                    tone={version === 'v1' ? 'sky' : 'emerald'}
                    playing={isPlaying}
                  />
                  <span
                    className={cn(
                      'w-[3.25rem] shrink-0 whitespace-nowrap text-xs font-semibold',
                      active ? color : 'text-muted-foreground'
                    )}
                  >
                    {version}
                    {active ? ` ${step.trafficSplit[version]}%` : ''}
                  </span>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((index) => (
                      <PodIcon key={`${version}-${index}`} pod={pods[index]} version={version} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex justify-center">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium',
            step.hasDowntime
              ? cn(SIM_TONE.danger.surface, SIM_TONE.danger.text)
              : step.isObserving
                ? cn(SIM_TONE.warning.surface, SIM_TONE.warning.text)
                : step.isAutomatic
                  ? cn(SIM_TONE.info.surface, SIM_TONE.info.text)
                  : 'bg-card text-muted-foreground'
          )}
        >
          {step.hasDowntime ? (
            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          ) : step.isObserving ? (
            <Eye className="h-4 w-4" aria-hidden="true" />
          ) : step.isAutomatic ? (
            <Zap className="h-4 w-4" aria-hidden="true" />
          ) : null}
          {step.hasDowntime && <strong>Downtime:</strong>} {step.note}
        </span>
      </div>
    </section>
  );
  const about = (
    <section className="space-y-2 rounded-lg border bg-card p-3">
      <h3 className="text-sm font-semibold">{config.name}</h3>
      <p className="text-sm text-muted-foreground">{config.description}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className={cn('rounded-md border p-2', SIM_TONE.success.surface)}>
          <h4
            className={cn('text-xs font-semibold uppercase tracking-wide', SIM_TONE.success.text)}
          >
            Pros
          </h4>
          <ul className="space-y-0.5 text-sm">
            {config.pros.map((pro) => (
              <li key={pro}>{pro}</li>
            ))}
          </ul>
        </div>
        <div className={cn('rounded-md border p-2', SIM_TONE.danger.surface)}>
          <h4 className={cn('text-xs font-semibold uppercase tracking-wide', SIM_TONE.danger.text)}>
            Cons
          </h4>
          <ul className="space-y-0.5 text-sm">
            {config.cons.map((con) => (
              <li key={con}>{con}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
  const progress = (
    <div className="space-y-2">
      <SimMissionList missions={missions.missions} title="Strategies" />
      <p className="hidden text-xs leading-relaxed text-muted-foreground lg:block">
        <Keyboard className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
        While the simulator has focus,{' '}
        <kbd className="rounded border bg-muted px-1 font-mono">←</kbd> and{' '}
        <kbd className="rounded border bg-muted px-1 font-mono">→</kbd> step and{' '}
        <kbd className="rounded border bg-muted px-1 font-mono">1</kbd> to{' '}
        <kbd className="rounded border bg-muted px-1 font-mono">4</kbd> pick a strategy.
      </p>
    </div>
  );
  return (
    <MotionConfig reducedMotion="user">
      <div onKeyDown={onKeyDown}>
        <SimFrame phoneBar>
          <SimBar
            title="Deployment Strategies"
            icon={Rocket}
            lead={
              <div
                role="group"
                aria-label="Strategy"
                className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap"
              >
                {STRATEGY_KEYS.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    className="h-10 lg:h-8"
                    onClick={() => pickStrategy(s)}
                    variant={strategy === s ? 'default' : 'outline'}
                    aria-pressed={strategy === s}
                  >
                    {STRATEGIES[s].name}
                    {doneIds.has(s) && (
                      <>
                        <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only"> (played)</span>
                      </>
                    )}
                  </Button>
                ))}
              </div>
            }
            steps={config.steps.map((item, index) => ({
              title: item.title,
              status: index < safeStep || (index === safeStep && isLastStep) ? 'done' : 'todo',
              statusLabel:
                index < safeStep ? 'seen' : index === safeStep ? 'current' : 'not seen yet',
            }))}
            current={safeStep}
            onStep={goToStep}
            stepNoun="Step"
            stepsLabel={`${config.name} steps`}
            tools={<SimResetButton onReset={startOver} />}
            progress={{ current: safeStep + 1, total: config.steps.length }}
            heading={step.title}
            meta={
              <>
                {step.isAutomatic && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold',
                      SIM_TONE.info.surface,
                      SIM_TONE.info.text
                    )}
                  >
                    <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                    Automatic
                  </span>
                )}
                {step.isObserving && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold',
                      SIM_TONE.warning.surface,
                      SIM_TONE.warning.text
                    )}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    Observing
                  </span>
                )}
              </>
            }
            actions={<div className="hidden items-center gap-2 lg:flex">{stepButtons('bar')}</div>}
            goal={
              missions.complete
                ? 'All four strategies played. Replay any of them, or start over.'
                : 'Play all four strategies to their last step and compare how each moves users from v1 to v2.'
            }
          />
          <SimAnnouncer
            message={`${config.name}, step ${safeStep + 1} of ${config.steps.length}: ${step.title}. ${step.note}`}
          />
          {missions.complete && !dismissed ? (
            <SimComplete
              title="All four strategies played"
              summary="Recreate was the only strategy with downtime. Rolling Update and Canary sent users to v1 and v2 at the same time; Blue-Green moved them all at once."
              stats={[
                { label: 'Strategies', value: '4/4' },
                {
                  label: 'With downtime',
                  value: `${COMPARISON.filter((comparison) => comparison.downtime).length} of 4`,
                },
              ]}
              actions={
                <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
                  Keep exploring
                </Button>
              }
              onPlayAgain={startOver}
              playAgainLabel="Start over"
            >
              <section className="rounded-lg border bg-card p-3">
                <h3 className="text-sm font-semibold">How they compare</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-1.5 pr-3 font-medium">Strategy</th>
                        <th className="py-1.5 pr-3 font-medium">Steps</th>
                        <th className="py-1.5 pr-3 font-medium">Downtime</th>
                        <th className="py-1.5 font-medium">v1 and v2 at once</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON.map((comparison) => (
                        <tr key={comparison.key} className="border-b last:border-0">
                          <td className="py-1.5 pr-3 font-medium">{comparison.name}</td>
                          <td className="py-1.5 pr-3 font-mono tabular-nums">{comparison.steps}</td>
                          <td className="py-1.5 pr-3">
                            <span className="inline-flex items-center gap-1">
                              {comparison.downtime ? (
                                <TriangleAlert
                                  className="h-4 w-4 text-wrong-foreground"
                                  aria-hidden="true"
                                />
                              ) : (
                                <CircleCheck
                                  className="h-4 w-4 text-correct-foreground"
                                  aria-hidden="true"
                                />
                              )}
                              {comparison.downtime ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="py-1.5">{comparison.mixed ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </SimComplete>
          ) : (
            <SimStage
              columns="lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]"
              minHeight="min-h-[16rem]"
              tab={tab}
              onTabChange={(next) => setTab(next as 'diagram' | 'strategies')}
              tabsLabel="Simulator panels"
              panels={[
                {
                  id: 'diagram',
                  label: 'Diagram',
                  content: (
                    <div className="space-y-2">
                      {diagram}
                      {about}
                    </div>
                  ),
                },
                { id: 'strategies', label: 'Strategies', content: progress },
              ]}
            />
          )}
          <SimPhoneBar>{stepButtons('phone')}</SimPhoneBar>
        </SimFrame>
      </div>
    </MotionConfig>
  );
}
