'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  CheckCircle2,
  Clock3,
  Code2,
  FastForward,
  ListChecks,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
  Workflow,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SimulatorControlSlider, SimulatorMetricCard } from '@/components/games/simulator-primitives';
import { cn } from '@/lib/utils';

type ScenarioId = 'microtasks' | 'async-await' | 'rejection' | 'promise-all';
type PromiseStatus = 'none' | 'pending' | 'fulfilled' | 'rejected';
type PanelTone = 'default' | 'active' | 'wait' | 'success' | 'danger';

interface PromiseState {
  label: string;
  status: PromiseStatus;
  value: string;
}

interface StepState {
  title: string;
  explanation: string;
  activeLine: number;
  callStack: string[];
  webApis: string[];
  microtasks: string[];
  taskQueue: string[];
  console: string[];
  promise: PromiseState;
  focus: 'code' | 'stack' | 'webapi' | 'microtask' | 'task' | 'console' | 'promise';
}

interface Prediction {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface Scenario {
  id: ScenarioId;
  title: string;
  subtitle: string;
  concept: string;
  code: string[];
  steps: StepState[];
  prediction: Prediction;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'microtasks',
    title: 'Microtasks beat timers',
    subtitle: 'Why Promise callbacks run before setTimeout(..., 0)',
    concept: 'The event loop drains the microtask queue before it takes the next task.',
    code: [
      "console.log('Start');",
      '',
      "setTimeout(() => console.log('Timeout'), 0);",
      '',
      "Promise.resolve('Promise').then(value => {",
      '  console.log(value);',
      '});',
      '',
      "console.log('End');",
    ],
    prediction: {
      question: 'What gets printed first after Start?',
      options: ['Timeout', 'Promise', 'End'],
      answer: 'End',
      explanation:
        'Synchronous code keeps running until the call stack is empty. The promise callback waits in the microtask queue, and the timer waits in the task queue.',
    },
    steps: [
      {
        title: 'Start in global execution',
        explanation: 'The script begins on the call stack. Nothing async has been scheduled yet.',
        activeLine: 1,
        callStack: ['global script', "console.log('Start')"],
        webApis: [],
        microtasks: [],
        taskQueue: [],
        console: ['Start'],
        promise: { label: 'Promise.resolve', status: 'none', value: '-' },
        focus: 'stack',
      },
      {
        title: 'Timer callback leaves JavaScript',
        explanation:
          'setTimeout is handled by the browser or runtime. Its callback cannot run until the current script finishes and a task turn is available.',
        activeLine: 3,
        callStack: ['global script', 'setTimeout(...)'],
        webApis: ['timer: 0ms'],
        microtasks: [],
        taskQueue: [],
        console: ['Start'],
        promise: { label: 'Promise.resolve', status: 'none', value: '-' },
        focus: 'webapi',
      },
      {
        title: 'Promise resolves immediately',
        explanation:
          'Promise.resolve creates a fulfilled promise, but the then handler is not called inline. It is queued as a microtask.',
        activeLine: 5,
        callStack: ['global script', 'Promise.resolve(...).then(...)'],
        webApis: [],
        microtasks: ["then: console.log('Promise')"],
        taskQueue: ["timer: console.log('Timeout')"],
        console: ['Start'],
        promise: { label: 'Promise.resolve', status: 'fulfilled', value: "'Promise'" },
        focus: 'promise',
      },
      {
        title: 'Synchronous code finishes first',
        explanation:
          'The last console.log still runs before queued callbacks because the global script has not finished yet.',
        activeLine: 9,
        callStack: ['global script', "console.log('End')"],
        webApis: [],
        microtasks: ["then: console.log('Promise')"],
        taskQueue: ["timer: console.log('Timeout')"],
        console: ['Start', 'End'],
        promise: { label: 'Promise.resolve', status: 'fulfilled', value: "'Promise'" },
        focus: 'console',
      },
      {
        title: 'Microtask queue drains',
        explanation:
          'Once the call stack is empty, the event loop runs every queued microtask before it touches the task queue.',
        activeLine: 6,
        callStack: ["then callback", "console.log('Promise')"],
        webApis: [],
        microtasks: [],
        taskQueue: ["timer: console.log('Timeout')"],
        console: ['Start', 'End', 'Promise'],
        promise: { label: 'Promise.resolve', status: 'fulfilled', value: "'Promise'" },
        focus: 'microtask',
      },
      {
        title: 'Timer finally gets a turn',
        explanation:
          'Only after the stack and microtask queue are empty does the event loop run the next task.',
        activeLine: 3,
        callStack: ['timer callback', "console.log('Timeout')"],
        webApis: [],
        microtasks: [],
        taskQueue: [],
        console: ['Start', 'End', 'Promise', 'Timeout'],
        promise: { label: 'Promise.resolve', status: 'fulfilled', value: "'Promise'" },
        focus: 'task',
      },
    ],
  },
  {
    id: 'async-await',
    title: 'Await suspends the function',
    subtitle: 'The rest of an async function resumes as a microtask',
    concept: 'await pauses the async function and lets outer synchronous code continue.',
    code: [
      'async function run() {',
      "  console.log('Inside');",
      "  const value = await Promise.resolve('Data');",
      "  console.log(value);",
      '}',
      '',
      "console.log('Before');",
      'run();',
      "console.log('After');",
    ],
    prediction: {
      question: 'When does Data print?',
      options: ['Before After', 'Between Inside and After', 'After the outer script finishes'],
      answer: 'After the outer script finishes',
      explanation:
        'The async function runs until await. Its continuation is queued as a microtask after the awaited promise is fulfilled.',
    },
    steps: [
      {
        title: 'Outer script starts',
        explanation: 'The global script logs Before before invoking the async function.',
        activeLine: 7,
        callStack: ['global script', "console.log('Before')"],
        webApis: [],
        microtasks: [],
        taskQueue: [],
        console: ['Before'],
        promise: { label: 'run()', status: 'pending', value: '-' },
        focus: 'console',
      },
      {
        title: 'Async function runs synchronously at first',
        explanation: 'Calling an async function executes its body immediately until it reaches await.',
        activeLine: 2,
        callStack: ['global script', 'run()', "console.log('Inside')"],
        webApis: [],
        microtasks: [],
        taskQueue: [],
        console: ['Before', 'Inside'],
        promise: { label: 'run()', status: 'pending', value: '-' },
        focus: 'stack',
      },
      {
        title: 'Await pauses run()',
        explanation:
          'The awaited promise is fulfilled, but the remaining function body is moved into the microtask queue.',
        activeLine: 3,
        callStack: ['global script', 'run()', "await Promise.resolve('Data')"],
        webApis: [],
        microtasks: ['resume run() after await'],
        taskQueue: [],
        console: ['Before', 'Inside'],
        promise: { label: 'awaited promise', status: 'fulfilled', value: "'Data'" },
        focus: 'microtask',
      },
      {
        title: 'Outer script keeps going',
        explanation:
          'The async function is suspended, so the caller continues and logs After before the await continuation runs.',
        activeLine: 9,
        callStack: ['global script', "console.log('After')"],
        webApis: [],
        microtasks: ['resume run() after await'],
        taskQueue: [],
        console: ['Before', 'Inside', 'After'],
        promise: { label: 'run()', status: 'pending', value: '-' },
        focus: 'console',
      },
      {
        title: 'Async continuation resumes',
        explanation: 'The microtask restores run() where it paused and assigns the resolved value.',
        activeLine: 4,
        callStack: ['run() continuation', "console.log('Data')"],
        webApis: [],
        microtasks: [],
        taskQueue: [],
        console: ['Before', 'Inside', 'After', 'Data'],
        promise: { label: 'run()', status: 'fulfilled', value: 'undefined' },
        focus: 'microtask',
      },
    ],
  },
  {
    id: 'rejection',
    title: 'Rejections jump to catch',
    subtitle: 'then is skipped, catch handles the error, finally still runs',
    concept: 'A rejected promise bypasses fulfillment handlers until a rejection handler catches it.',
    code: [
      "Promise.reject('Network failed')",
      "  .then(value => console.log('then', value))",
      "  .catch(error => console.log('catch', error))",
      "  .finally(() => console.log('cleanup'));",
      '',
      "console.log('Request started');",
    ],
    prediction: {
      question: 'Which handler runs first?',
      options: ['then', 'catch', 'finally'],
      answer: 'catch',
      explanation:
        'The promise is already rejected, so the fulfillment handler is skipped and the rejection handler is queued as a microtask.',
    },
    steps: [
      {
        title: 'Rejected promise is created',
        explanation: 'Promise.reject returns a rejected promise with the provided reason.',
        activeLine: 1,
        callStack: ['global script', "Promise.reject('Network failed')"],
        webApis: [],
        microtasks: ['catch handler'],
        taskQueue: [],
        console: [],
        promise: { label: 'request promise', status: 'rejected', value: "'Network failed'" },
        focus: 'promise',
      },
      {
        title: 'Synchronous log still runs',
        explanation: 'Handlers are queued. The current script continues and logs Request started.',
        activeLine: 6,
        callStack: ['global script', "console.log('Request started')"],
        webApis: [],
        microtasks: ['catch handler'],
        taskQueue: [],
        console: ['Request started'],
        promise: { label: 'request promise', status: 'rejected', value: "'Network failed'" },
        focus: 'console',
      },
      {
        title: 'catch handles the rejection',
        explanation: 'The skipped then handler does not run. catch receives the rejection reason.',
        activeLine: 3,
        callStack: ['catch callback', "console.log('catch', error)"],
        webApis: [],
        microtasks: ['finally handler'],
        taskQueue: [],
        console: ['Request started', 'catch Network failed'],
        promise: { label: 'chain promise', status: 'fulfilled', value: 'undefined' },
        focus: 'microtask',
      },
      {
        title: 'finally runs for cleanup',
        explanation: 'finally runs after settlement whether the chain resolved or rejected.',
        activeLine: 4,
        callStack: ['finally callback', "console.log('cleanup')"],
        webApis: [],
        microtasks: [],
        taskQueue: [],
        console: ['Request started', 'catch Network failed', 'cleanup'],
        promise: { label: 'chain promise', status: 'fulfilled', value: 'undefined' },
        focus: 'microtask',
      },
    ],
  },
  {
    id: 'promise-all',
    title: 'Promise combinators',
    subtitle: 'Promise.all waits for every input or rejects on the first failure',
    concept: 'Combinators create a new promise that tracks several promises at once.',
    code: [
      'const user = fetchUser();',
      'const repos = fetchRepos();',
      'const billing = fetchBilling();',
      '',
      'Promise.all([user, repos, billing])',
      '  .then(([user, repos, billing]) => renderDashboard())',
      '  .catch(showError);',
    ],
    prediction: {
      question: 'When does Promise.all fulfill?',
      options: ['After the first promise fulfills', 'After every promise fulfills', 'Immediately'],
      answer: 'After every promise fulfills',
      explanation:
        'Promise.all preserves order and fulfills only when all inputs fulfill. One rejection rejects the combined promise.',
    },
    steps: [
      {
        title: 'Three async jobs start',
        explanation: 'Each fetch returns a pending promise while the runtime waits on I/O.',
        activeLine: 1,
        callStack: ['global script', 'fetchUser()', 'fetchRepos()', 'fetchBilling()'],
        webApis: ['network: user', 'network: repos', 'network: billing'],
        microtasks: [],
        taskQueue: [],
        console: [],
        promise: { label: 'Promise.all', status: 'pending', value: '-' },
        focus: 'webapi',
      },
      {
        title: 'First promise resolves',
        explanation: 'Promise.all stores the user result, but it cannot fulfill yet because other inputs are pending.',
        activeLine: 5,
        callStack: [],
        webApis: ['network: repos', 'network: billing'],
        microtasks: ['record user result'],
        taskQueue: [],
        console: [],
        promise: { label: 'Promise.all', status: 'pending', value: '1 of 3 complete' },
        focus: 'promise',
      },
      {
        title: 'Second promise resolves',
        explanation: 'The combined promise is still pending. Promise.all waits for every slot.',
        activeLine: 5,
        callStack: [],
        webApis: ['network: billing'],
        microtasks: ['record repos result'],
        taskQueue: [],
        console: [],
        promise: { label: 'Promise.all', status: 'pending', value: '2 of 3 complete' },
        focus: 'promise',
      },
      {
        title: 'All inputs are fulfilled',
        explanation:
          'When the final promise fulfills, Promise.all queues the then callback with the ordered result array.',
        activeLine: 6,
        callStack: [],
        webApis: [],
        microtasks: ['then: renderDashboard()'],
        taskQueue: [],
        console: [],
        promise: { label: 'Promise.all', status: 'fulfilled', value: '[user, repos, billing]' },
        focus: 'microtask',
      },
      {
        title: 'Dashboard renders',
        explanation: 'The then callback runs as a microtask and receives all three values together.',
        activeLine: 6,
        callStack: ['then callback', 'renderDashboard()'],
        webApis: [],
        microtasks: [],
        taskQueue: [],
        console: ['Dashboard rendered'],
        promise: { label: 'Promise.all', status: 'fulfilled', value: '[user, repos, billing]' },
        focus: 'console',
      },
    ],
  },
];

const PANEL_TONES: Record<PanelTone, string> = {
  default: 'border-border bg-card',
  active: 'border-primary/60 bg-primary/10',
  wait: 'border-sky-500/40 bg-sky-500/10',
  success: 'border-emerald-500/40 bg-emerald-500/10',
  danger: 'border-red-500/40 bg-red-500/10',
};

function getScenario(id: ScenarioId) {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0]!;
}

function statusTone(status: PromiseStatus): PanelTone {
  if (status === 'fulfilled') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'pending') return 'wait';
  return 'default';
}

function statusLabel(status: PromiseStatus) {
  if (status === 'none') return 'not created';
  return status;
}

export default function JavascriptPromisesAsyncSimulator() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('microtasks');
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1100);
  const [prediction, setPrediction] = useState<string | null>(null);

  const scenario = getScenario(scenarioId);
  const activeStepIndex = Math.min(stepIndex, scenario.steps.length - 1);
  const step = scenario.steps[activeStepIndex] ?? scenario.steps[0]!;
  const progress = ((activeStepIndex + 1) / scenario.steps.length) * 100;
  const isCorrect = prediction === scenario.prediction.answer;

  useEffect(() => {
    setStepIndex(0);
    setIsPlaying(false);
    setPrediction(null);
  }, [scenarioId]);

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        if (current >= scenario.steps.length - 1) {
          setIsPlaying(false);
          return current;
        }

        return current + 1;
      });
    }, speed);

    return () => window.clearInterval(timer);
  }, [isPlaying, scenario.steps.length, speed]);

  const consolePreview = useMemo(() => step.console.join(' -> ') || 'waiting...', [step.console]);

  const selectScenario = (nextScenarioId: ScenarioId) => {
    setScenarioId(nextScenarioId);
    setStepIndex(0);
    setIsPlaying(false);
    setPrediction(null);
  };

  const goToStep = (nextStep: number) => {
    setIsPlaying(false);
    setStepIndex(Math.min(Math.max(nextStep, 0), scenario.steps.length - 1));
  };

  const reset = () => {
    setIsPlaying(false);
    setStepIndex(0);
    setPrediction(null);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-md border bg-muted/20 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-primary">
              <Braces className="h-6 w-6" />
            </div>
            <div>
              <p className="font-mono text-xs text-muted-foreground">// event loop lab</p>
              <h2 className="text-2xl font-bold md:text-3xl">
                JavaScript Promises & Async/Await Simulator
              </h2>
            </div>
          </div>
          <p className="max-w-4xl text-sm text-muted-foreground">
            Step through promises, microtasks, timers, rejections, and await continuations. Watch
            callbacks move between the call stack, runtime APIs, queues, promise state, and console.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SimulatorMetricCard
            label="Current step"
            value={`${activeStepIndex + 1}/${scenario.steps.length}`}
            icon={ListChecks}
            detail={step.title}
            tone="default"
          />
          <SimulatorMetricCard
            label="Console order"
            value={step.console.length ? `${step.console.length} logs` : 'No logs'}
            icon={Code2}
            detail={consolePreview}
            tone={step.console.length ? 'good' : 'default'}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="order-2 space-y-4 xl:order-1 xl:sticky xl:top-4 xl:self-start">
          <Card className="hidden xl:block">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5" />
                Scenarios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {SCENARIOS.map((candidate) => {
                const active = candidate.id === scenario.id;

                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => selectScenario(candidate.id)}
                    className={cn(
                      'w-full rounded-md border p-3 text-left transition-colors',
                      active ? 'border-primary/60 bg-primary/10' : 'border-border hover:bg-muted/30'
                    )}
                  >
                    <p className="text-sm font-semibold">{candidate.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {candidate.subtitle}
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="hidden xl:block">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FastForward className="h-5 w-5" />
                Playback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0">
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => goToStep(activeStepIndex - 1)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => setIsPlaying((playing) => !playing)}
                  disabled={activeStepIndex === scenario.steps.length - 1 && !isPlaying}
                >
                  {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={() => goToStep(activeStepIndex + 1)}>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={reset} className="w-full">
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <SimulatorControlSlider
                label="Step speed"
                value={speed}
                min={500}
                max={1800}
                step={100}
                suffix="ms"
                onChange={setSpeed}
              />
              <Progress value={progress} />
            </CardContent>
          </Card>

          <PredictionCard
            prediction={scenario.prediction}
            selected={prediction}
            isCorrect={isCorrect}
            onSelect={setPrediction}
          />
        </div>

        <div className="order-1 space-y-4 xl:order-2">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Workflow className="h-5 w-5" />
                    {scenario.title}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{scenario.concept}</p>
                </div>
                <Badge variant="secondary">step {activeStepIndex + 1}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <CompactScenarioTabs scenarioId={scenario.id} onSelect={selectScenario} />

              <div className="rounded-md border border-primary/25 bg-primary/5 p-4">
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.explanation}</p>
              </div>

              <CompactPlaybackControls
                activeStepIndex={activeStepIndex}
                stepCount={scenario.steps.length}
                isPlaying={isPlaying}
                progress={progress}
                onPrevious={() => goToStep(activeStepIndex - 1)}
                onNext={() => goToStep(activeStepIndex + 1)}
                onTogglePlay={() => setIsPlaying((playing) => !playing)}
                onReset={reset}
              />

              <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.68fr)_minmax(0,1.32fr)]">
                <div className="order-2 xl:order-1">
                  <CodePanel code={scenario.code} activeLine={step.activeLine} />
                </div>
                <div className="order-1 xl:order-2">
                  <EventLoopBoard step={step} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Timer className="h-5 w-5" />
                Mental Model
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 pt-0 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
              <ModelRule
                number="1"
                text="Run synchronous code on the call stack first."
                active={step.focus === 'stack'}
              />
              <ModelRule
                number="2"
                text="Queue promise handlers as microtasks."
                active={step.focus === 'microtask'}
              />
              <ModelRule
                number="3"
                text="Run timers and I/O callbacks as tasks."
                active={step.focus === 'task'}
              />
              <ModelRule
                number="4"
                text="await resumes the async function in a microtask."
                active={scenario.id === 'async-await'}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CompactScenarioTabs({
  scenarioId,
  onSelect,
}: {
  scenarioId: ScenarioId;
  onSelect: (scenarioId: ScenarioId) => void;
}) {
  return (
    <div className="xl:hidden">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4" />
        Scenario
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SCENARIOS.map((candidate) => {
          const active = candidate.id === scenarioId;

          return (
            <button
              key={candidate.id}
              type="button"
              onClick={() => onSelect(candidate.id)}
              className={cn(
                'min-w-[170px] rounded-md border px-3 py-2 text-left transition-colors',
                active ? 'border-primary/60 bg-primary/10' : 'border-border bg-background/80 hover:bg-muted/30'
              )}
            >
              <span className="block text-sm font-semibold">{candidate.title}</span>
              <span className="mt-1 block text-xs leading-snug text-muted-foreground">{candidate.concept}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompactPlaybackControls({
  activeStepIndex,
  stepCount,
  isPlaying,
  progress,
  onPrevious,
  onNext,
  onTogglePlay,
  onReset,
}: {
  activeStepIndex: number;
  stepCount: number;
  isPlaying: boolean;
  progress: number;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-md border bg-background/80 p-3 xl:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="icon" onClick={onPrevious} disabled={activeStepIndex === 0}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          className="min-w-[112px] flex-1 sm:flex-none"
          onClick={onTogglePlay}
          disabled={activeStepIndex === stepCount - 1 && !isPlaying}
        >
          {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onNext}
          disabled={activeStepIndex === stepCount - 1}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onReset} className="ml-auto">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Progress value={progress} className="flex-1" />
        <Badge variant="secondary" className="shrink-0">
          {activeStepIndex + 1}/{stepCount}
        </Badge>
      </div>
    </div>
  );
}

function CodePanel({ code, activeLine }: { code: string[]; activeLine: number }) {
  return (
    <div className="overflow-hidden rounded-md border bg-[#09090b]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <span className="font-mono text-xs text-slate-400">async-lab.js</span>
      </div>
      <div className="overflow-x-auto p-4 font-mono text-sm leading-7 text-slate-200">
        {code.map((line, index) => {
          const lineNumber = index + 1;
          const active = lineNumber === activeLine;

          return (
            <div
              key={`${lineNumber}-${line}`}
              className={cn(
                'grid grid-cols-[2.25rem_minmax(0,1fr)] rounded px-2',
                active && 'bg-primary/20 text-primary'
              )}
            >
              <span className="select-none pr-3 text-right text-slate-500">{lineNumber}</span>
              <span className="whitespace-pre">{line || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventLoopBoard({ step }: { step: StepState }) {
  return (
    <div className="space-y-4 rounded-md border bg-muted/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Event loop trace</p>
          <p className="text-xs text-muted-foreground">
            Follow the current callback from execution to queues and back to output.
          </p>
        </div>
        <Badge variant="secondary">{step.focus}</Badge>
      </div>

      <div className="grid gap-2 rounded-md border bg-background/70 p-3 text-xs text-muted-foreground md:grid-cols-3">
        <FlowRule active={step.focus === 'stack'} label="1. Run the stack" />
        <FlowRule active={step.focus === 'microtask' || step.focus === 'promise'} label="2. Drain microtasks" />
        <FlowRule active={step.focus === 'task' || step.focus === 'webapi'} label="3. Run one task" />
      </div>

      <RuntimePanel
        title="Call Stack"
        icon={<Braces className="h-4 w-4" />}
        items={step.callStack}
        empty="empty stack"
        tone={step.focus === 'stack' ? 'active' : 'default'}
        size="large"
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <RuntimePanel
          title="Microtask Queue"
          icon={<Sparkles className="h-4 w-4" />}
          items={step.microtasks}
          empty="no promise work queued"
          tone={step.focus === 'microtask' ? 'active' : 'default'}
        />
        <RuntimePanel
          title="Task Queue"
          icon={<Timer className="h-4 w-4" />}
          items={step.taskQueue}
          empty="no timer or event tasks"
          tone={step.focus === 'task' ? 'wait' : 'default'}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <RuntimePanel
          title="Runtime APIs"
          icon={<Clock3 className="h-4 w-4" />}
          items={step.webApis}
          empty="no external work"
          tone={step.focus === 'webapi' ? 'wait' : 'default'}
        />
        <RuntimePanel
          title="Promise Inspector"
          icon={<Workflow className="h-4 w-4" />}
          items={[`${step.promise.label}: ${statusLabel(step.promise.status)}`, `value: ${step.promise.value}`]}
          empty="not created"
          tone={statusTone(step.promise.status)}
        />
      </div>

      <RuntimePanel
        title="Console Output"
        icon={<Code2 className="h-4 w-4" />}
        items={step.console}
        empty="nothing logged"
        tone={step.focus === 'console' ? 'success' : 'default'}
        size="large"
      />
    </div>
  );
}

function FlowRule({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 font-medium',
        active ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-muted/20'
      )}
    >
      {label}
    </div>
  );
}

function RuntimePanel({
  title,
  icon,
  items,
  empty,
  tone,
  size = 'normal',
}: {
  title: string;
  icon: ReactNode;
  items: string[];
  empty: string;
  tone: PanelTone;
  size?: 'normal' | 'large';
}) {
  return (
    <div
      className={cn(
        'rounded-md border p-3 transition-colors',
        size === 'large' ? 'min-h-[132px]' : 'min-h-[124px]',
        PANEL_TONES[tone]
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </div>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      <div className="space-y-2">
        {items.length ? (
          items.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="overflow-hidden rounded-md border bg-background/80 px-3 py-2 font-mono text-xs leading-relaxed shadow-sm"
            >
              <span className="break-words">{item}</span>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {empty}
          </div>
        )}
      </div>
    </div>
  );
}

function PredictionCard({
  prediction,
  selected,
  isCorrect,
  onSelect,
}: {
  prediction: Prediction;
  selected: string | null;
  isCorrect: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-5 w-5" />
          Predict It
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <p className="text-sm text-muted-foreground">{prediction.question}</p>
        <div className="space-y-2">
          {prediction.options.map((option) => {
            const chosen = selected === option;
            const correct = selected && option === prediction.answer;

            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelect(option)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  chosen ? 'border-primary/60 bg-primary/10' : 'hover:bg-muted/30',
                  correct && 'border-emerald-500/50 bg-emerald-500/10'
                )}
              >
                <span className="min-w-0 flex-1 break-words">{option}</span>
                {chosen &&
                  (isCorrect ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                  ))}
              </button>
            );
          })}
        </div>
        {selected && (
          <div
            className={cn(
              'rounded-md border p-3 text-sm',
              isCorrect ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'
            )}
          >
            <p className="font-medium">{isCorrect ? 'Correct' : `Not quite. Answer: ${prediction.answer}`}</p>
            <p className="mt-1 text-muted-foreground">{prediction.explanation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModelRule({ number, text, active }: { number: string; text: string; active: boolean }) {
  return (
    <div className={cn('flex gap-3 rounded-md border p-3', active ? 'border-primary/50 bg-primary/10' : 'bg-muted/20')}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        {number}
      </span>
      <span className="leading-relaxed">{text}</span>
    </div>
  );
}
