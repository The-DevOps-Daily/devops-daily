'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Network, Pause, Play } from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
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

interface Scenario {
  id: string;
  title: string;
  description: string;
  problem: string;
  solution: string;
  visual: 'before' | 'after-sidecar' | 'mtls' | 'traffic-split' | 'retry' | 'circuit-breaker';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

const SCENARIOS: Scenario[] = [
  {
    id: 'intro',
    title: '🎯 The Problem: Insecure Communication',
    description: 'Your services talk directly without encryption',
    problem:
      "Two services are sending data over the network. But there's a problem: anyone can read the messages! No encryption, no authentication, no control.",
    solution:
      "This is risky in production. One compromised service could impersonate another. Let's see how a service mesh solves this.",
    visual: 'before',
    difficulty: 'beginner',
  },
  {
    id: 'sidecar',
    title: '✨ The Solution: Sidecar Proxies',
    description: 'Add a security guard next to each service',
    problem:
      "We can't modify every service's code to add security. That would take months and break things!",
    solution:
      "Service mesh deploys a 'sidecar proxy' next to each service. It intercepts all traffic and handles security automatically. Your code stays unchanged!",
    visual: 'after-sidecar',
    difficulty: 'beginner',
  },
  {
    id: 'mtls',
    title: '🔐 Feature 1: Automatic Encryption',
    description: 'Every request is encrypted with mTLS',
    problem: 'Hackers can read your network traffic and steal sensitive data.',
    solution:
      "The sidecars automatically encrypt ALL traffic using mTLS (mutual TLS). Both services verify each other's identity. No code changes required!",
    visual: 'mtls',
    difficulty: 'intermediate',
  },
  {
    id: 'traffic-split',
    title: '🎛️ Feature 2: Safe Deployments',
    description: 'Test new versions without risking everything',
    problem:
      'You deployed v2.0 and it crashed. Now all users are affected. How do you test safely in production?',
    solution:
      'The mesh can route 90% of traffic to the stable version and 10% to the new one. If v2.0 has bugs, only 10% of users see them. Instant rollback!',
    visual: 'traffic-split',
    difficulty: 'intermediate',
  },
  {
    id: 'retry',
    title: '🔄 Feature 3: Smart Retries',
    description: 'Automatically retry failed requests',
    problem:
      'Networks are unreliable. Random failures happen. Your users see errors even though the service is working.',
    solution:
      'The sidecar automatically retries failed requests with backoff, up to a set limit. Most short network blips never reach your users, but retries are bounded: at a 50% failure rate with 2 retries, about 1 in 8 requests still fails.',
    visual: 'retry',
    difficulty: 'advanced',
  },
  {
    id: 'circuit-breaker',
    title: '🛡️ Feature 4: Circuit Breaker',
    description: 'Stop hitting a failing service',
    problem:
      'One slow service is taking down your entire system. Every request waits 30 seconds before timing out. Disaster!',
    solution:
      'When failures exceed a threshold, the circuit breaker "trips" and stops sending requests. Gives the service time to recover. Prevents cascading failures.',
    visual: 'circuit-breaker',
    difficulty: 'advanced',
  },
];

type ServiceMeshMissionState = {
  playedScenarioIds: ReadonlySet<string>;
  circuitState: 'closed' | 'open';
};

const MISSIONS: Mission<ServiceMeshMissionState>[] = [
  {
    id: 'mtls',
    label: 'Watch the sidecars encrypt a request with mutual TLS.',
    hint: 'Press step 3, Automatic Encryption, then Play until the request reaches Orders API.',
    check: (state) => state.playedScenarioIds.has('mtls'),
  },
  {
    id: 'canary',
    label: 'Watch 10% of the traffic go to the new version.',
    hint: 'Press step 4, Safe Deployments, then Play until the requests reach both versions.',
    check: (state) => state.playedScenarioIds.has('traffic-split'),
  },
  {
    id: 'retries',
    label: 'Watch a retry save a failed call.',
    hint: 'Press step 5, Smart Retries, then Play until the retried call gets through.',
    check: (state) => state.playedScenarioIds.has('retry'),
  },
  {
    id: 'breaker',
    label: 'Open the circuit breaker while a service keeps failing.',
    hint: 'Press step 6, Circuit Breaker, then Play until the breaker opens.',
    check: (state) => state.circuitState === 'open',
  },
];

function ServiceNode({
  x,
  y,
  label,
  detail,
  failing = false,
  sidecar = true,
}: {
  x: number;
  y: number;
  label: string;
  detail: string;
  failing?: boolean;
  sidecar?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="112" height="64" rx="8" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="7" y="7" width="98" height="18" rx="4" className="fill-primary/15" />
      <text x="56" y="20" textAnchor="middle" className="fill-foreground text-xs font-semibold">
        {label}
      </text>
      <text x="56" y="43" textAnchor="middle" className="fill-muted-foreground text-xs">
        {detail}
      </text>
      <text
        x="56"
        y="57"
        textAnchor="middle"
        className={
          failing || !sidecar ? 'fill-wrong-foreground text-xs' : 'fill-correct-foreground text-xs'
        }
      >
        {failing ? 'failing' : sidecar ? 'sidecar proxy' : 'no sidecar'}
      </text>
    </g>
  );
}

export default function ServiceMeshSimulator() {
  const [currentScenario, setCurrentScenario] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [circuitState, setCircuitState] = useState<'closed' | 'open'>('closed');
  const [playedScenarioIds, setPlayedScenarioIds] = useState<Set<string>>(() => new Set());
  const [dismissed, setDismissed] = useState(false);
  const [tab, setTab] = useState<'diagram' | 'details'>('diagram');

  const scenario = SCENARIOS[currentScenario];
  const scenarioIdRef = useRef(scenario.id);

  useEffect(() => {
    scenarioIdRef.current = scenario.id;
  }, [scenario.id]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setAnimationProgress((prev) => {
        const next = (prev + 1) % 100;
        if (next === 99)
          setPlayedScenarioIds((before) => new Set(before).add(scenarioIdRef.current));
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Reset animation when scenario changes
  useEffect(() => {
    // Reset animation progress but keep playing state
    setAnimationProgress(0);
    setCircuitState('closed');
  }, [currentScenario]);

  // Circuit breaker state management
  useEffect(() => {
    if (scenario.visual === 'circuit-breaker') {
      if (isPlaying && animationProgress > 50) {
        setCircuitState('open');
      } else {
        setCircuitState('closed');
      }
    }
  }, [animationProgress, isPlaying, scenario.visual]);

  const handleNext = () => {
    if (currentScenario < SCENARIOS.length - 1) {
      setCurrentScenario(currentScenario + 1);
    }
  };

  const handlePrevious = () => {
    if (currentScenario > 0) {
      setCurrentScenario(currentScenario - 1);
    }
  };

  const handleReset = () => {
    setAnimationProgress(0);
    setIsPlaying(false);
  };

  const missionState = useMemo(
    () => ({ playedScenarioIds, circuitState }),
    [circuitState, playedScenarioIds]
  );
  const missions = useMissions(MISSIONS, missionState);
  const startOver = () => {
    handleReset();
    setPlayedScenarioIds(new Set());
    missions.reset();
    setDismissed(false);
  };
  const protectedTraffic = scenario.visual === 'mtls';
  const hasSplit = scenario.visual === 'traffic-split';
  const hasRetry = scenario.visual === 'retry';
  const breakerOpen = scenario.visual === 'circuit-breaker' && circuitState === 'open';
  const packetX = 124 + (animationProgress / 100) * 128;
  const controls = (phone: boolean) => (
    <>
      <Button
        type="button"
        variant="outline"
        className={phone ? 'h-10 flex-1' : 'h-10 lg:h-8'}
        onClick={handlePrevious}
        disabled={currentScenario === 0}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span className={phone ? 'sr-only' : undefined}>Previous</span>
      </Button>
      <Button
        type="button"
        className={phone ? 'h-10 flex-1' : 'h-10 lg:h-8'}
        onClick={() => setIsPlaying(!isPlaying)}
        aria-pressed={isPlaying}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Play className="h-4 w-4" aria-hidden="true" />
        )}
        {isPlaying ? 'Pause' : 'Play'}
      </Button>
      <Button
        type="button"
        variant="outline"
        className={phone ? 'h-10 flex-1' : 'h-10 lg:h-8'}
        onClick={handleNext}
        disabled={currentScenario === SCENARIOS.length - 1}
      >
        <span className={phone ? 'sr-only' : undefined}>Next</span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </>
  );
  const diagram = (
    <section className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Traffic path</h3>
        <span className="text-xs text-muted-foreground">
          {isPlaying ? 'Traffic is moving' : 'Traffic is paused'}
        </span>
      </div>
      <svg
        viewBox="0 0 390 196"
        className="mx-auto block h-auto w-full max-w-[390px]"
        role="img"
        aria-label="Service mesh traffic diagram"
      >
        <ServiceNode
          x={8}
          y={66}
          label="Frontend"
          detail={scenario.visual === 'before' ? 'plain HTTP' : 'app container'}
          sidecar={scenario.visual !== 'before'}
        />
        {hasSplit ? (
          <>
            <path
              d="M120 88 H164 L206 48 M120 108 H164 L206 148"
              className="fill-none stroke-primary"
              strokeWidth="3"
            />
            <text x="160" y="64" className="fill-muted-foreground text-xs">
              90%
            </text>
            <text x="160" y="142" className="fill-muted-foreground text-xs">
              10%
            </text>
            <ServiceNode x={220} y={16} label="Orders v1" detail="stable" />
            <ServiceNode x={220} y={116} label="Orders v2" detail="canary" />
          </>
        ) : (
          <>
            <path
              d="M120 98 H270"
              className={
                breakerOpen ? 'fill-none stroke-wrong-foreground' : 'fill-none stroke-primary'
              }
              strokeWidth="3"
              strokeDasharray={breakerOpen ? '7 5' : undefined}
            />
            <ServiceNode
              x={270}
              y={66}
              label="Orders API"
              detail={scenario.visual === 'before' ? 'plain HTTP' : 'app container'}
              sidecar={scenario.visual !== 'before'}
              failing={scenario.visual === 'circuit-breaker'}
            />
          </>
        )}
        {isPlaying && !breakerOpen && (
          <circle cx={packetX} cy="98" r="6" className="fill-primary" />
        )}
        {protectedTraffic && (
          <text
            x="195"
            y="84"
            textAnchor="middle"
            className="fill-correct-foreground text-xs font-semibold"
          >
            mTLS
          </text>
        )}
        {hasRetry && (
          <text
            x="195"
            y="84"
            textAnchor="middle"
            className="fill-partial-foreground text-xs font-semibold"
          >
            retry
          </text>
        )}
        {breakerOpen && (
          <text
            x="195"
            y="84"
            textAnchor="middle"
            className="fill-wrong-foreground text-xs font-semibold"
          >
            open
          </text>
        )}
      </svg>
      <p className="text-xs text-muted-foreground">
        {breakerOpen
          ? 'Requests stop while the host recovers.'
          : protectedTraffic
            ? 'Both workloads authenticate and encrypt traffic.'
            : hasRetry
              ? 'Retries are bounded before failures reach callers.'
              : 'Sidecars can apply traffic policy without changing application code.'}
      </p>
    </section>
  );
  const details = (
    <div className="space-y-2">
      <section className="rounded-lg border bg-card p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Scenario
        </p>
        <h3 className="mt-1 text-sm font-semibold">
          {scenario.title.replace(/^\p{Extended_Pictographic}️?\s*/u, '')}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{scenario.description}</p>
        <p className="mt-3 text-sm">
          <strong>Problem:</strong> {scenario.problem}
        </p>
        <p className="mt-2 text-sm">
          <strong>Mesh response:</strong> {scenario.solution}
        </p>
      </section>
      <SimMissionList missions={missions.missions} />
      <details className="rounded-lg border bg-card p-3">
        <summary className="cursor-pointer text-sm font-medium">How this simulation works</summary>
        <p className="mt-2 text-sm text-muted-foreground">
          Play a scenario through one traffic cycle to record it. mTLS authenticates both workloads
          and encrypts traffic; retry policies need limits so they do not multiply load; Istio calls
          its circuit-breaking protection outlier detection.
        </p>
      </details>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="Service Mesh"
          icon={Network}
          steps={SCENARIOS.map((item) => ({
            title: item.title.replace(/^\p{Extended_Pictographic}️?\s*/u, ''),
            status: playedScenarioIds.has(item.id)
              ? 'done'
              : item.id === scenario.id
                ? 'started'
                : 'todo',
            statusLabel: playedScenarioIds.has(item.id) ? 'played' : 'not played',
          }))}
          current={currentScenario}
          onStep={setCurrentScenario}
          stepNoun="Scenario"
          stepsLabel="Service mesh scenarios"
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={scenario.title.replace(/^\p{Extended_Pictographic}️?\s*/u, '')}
          actions={<div className="flex items-center gap-1">{controls(false)}</div>}
          goal={
            missions.complete ? (
              'All four missions are complete. Replay any scenario, or start over.'
            ) : (
              <>
                <strong>{missions.current?.label}</strong>{' '}
                <span className="text-muted-foreground">{missions.current?.hint}</span>
              </>
            )
          }
        />
        <SimAnnouncer
          message={`${scenario.description}. ${isPlaying ? 'Traffic is moving.' : 'Traffic is paused.'}`}
        />
        {missions.complete && !dismissed ? (
          <SimComplete
            title="Service mesh missions complete"
            summary="You protected traffic with mTLS, shifted a canary, observed a retry, and stopped calls to a failing host."
            stats={[
              { label: 'Missions', value: '4/4' },
              { label: 'Scenarios played', value: `${playedScenarioIds.size}/6` },
              { label: 'Breaker', value: 'Opened' },
            ]}
            actions={
              <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
                Keep exploring
              </Button>
            }
            onPlayAgain={startOver}
            playAgainLabel="Start over"
          />
        ) : (
          <SimStage
            columns="lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
            minHeight="min-h-[17rem]"
            tab={tab}
            onTabChange={(next) => setTab(next as 'diagram' | 'details')}
            tabsLabel="Service mesh panels"
            panels={[
              { id: 'diagram', label: 'Diagram', content: diagram },
              { id: 'details', label: 'Details', content: details },
            ]}
          />
        )}
        <SimPhoneBar>{controls(true)}</SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
