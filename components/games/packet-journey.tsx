'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { useResolvedTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Cpu,
  Database,
  GitBranch,
  Globe,
  Layers,
  Lock,
  Network,
  Pause,
  Play,
  Radio,
  Server,
  Timer,
  XCircle,
  Zap,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';

// Journey stage interface
interface JourneyStage {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  duration: number; // in ms
  details: string[];
  x: number;
  y: number;
}

// Packet interface
interface Packet {
  id: string;
  currentStage: number;
  progress: number;
  data: string;
}

// Connection setup happens once, on the way out. The response travels back
// over the open connection, so it does not repeat these stages.
const SETUP_STAGE_IDS = new Set(['dns', 'tcp', 'tls']);

// The deepest stage does its work once; every other stage that is not setup
// is passed again on the way back.
function roundTripMs(stages: Array<{ id: string; duration: number }>): number {
  const oneWay = stages.reduce((sum, s) => sum + s.duration, 0);
  const back = stages
    .slice(0, -1)
    .filter((s) => !SETUP_STAGE_IDS.has(s.id))
    .reduce((sum, s) => sum + s.duration, 0);
  return oneWay + back;
}

// The stage the response reaches next on its way back to the browser.
function prevReturnIndex(stages: Array<{ id: string }>, from: number): number {
  let i = from - 1;
  while (i > 0 && SETUP_STAGE_IDS.has(stages[i].id)) i--;
  return i;
}

// Scenario types
type ScenarioType = 'http' | 'https' | 'https-cdn' | 'https-cdn-cache';

const scenarios: Record<ScenarioType, { name: string; description: string; stages: string[] }> = {
  http: {
    name: 'Basic HTTP',
    description: 'Simple unencrypted HTTP request',
    stages: ['browser', 'dns', 'tcp', 'loadbalancer', 'webserver', 'appserver', 'database'],
  },
  https: {
    name: 'HTTPS',
    description: 'Encrypted HTTPS with TLS',
    stages: ['browser', 'dns', 'tcp', 'tls', 'loadbalancer', 'webserver', 'appserver', 'database'],
  },
  'https-cdn': {
    name: 'HTTPS + CDN',
    description: 'With CDN edge server',
    stages: [
      'browser',
      'dns',
      'tcp',
      'tls',
      'cdn',
      'loadbalancer',
      'webserver',
      'appserver',
      'database',
    ],
  },
  'https-cdn-cache': {
    name: 'HTTPS + CDN (Cached)',
    description: 'CDN cache hit - fastest!',
    stages: ['browser', 'dns', 'tcp', 'tls', 'cdn'],
  },
};

// All possible stages
const allStages: Record<string, Omit<JourneyStage, 'x' | 'y'>> = {
  browser: {
    id: 'browser',
    name: 'Browser',
    description: 'User initiates request',
    icon: <Globe className="w-6 h-6" />,
    color: '#3b82f6',
    duration: 10,
    details: [
      'Parse URL',
      'Check browser cache',
      'Create HTTP request',
      'Add headers (User-Agent, Accept, etc.)',
    ],
  },
  dns: {
    id: 'dns',
    name: 'DNS Resolution',
    description: 'Convert domain to IP',
    icon: <Radio className="w-6 h-6" />,
    color: '#8b5cf6',
    duration: 50,
    details: [
      'Check local DNS cache',
      'Query recursive resolver',
      'Root DNS → TLD DNS → Authoritative DNS',
      'Receive IP address (e.g., 172.67.154.128)',
    ],
  },
  tcp: {
    id: 'tcp',
    name: 'TCP Handshake',
    description: '3-way handshake',
    icon: <GitBranch className="w-6 h-6" />,
    color: '#06b6d4',
    duration: 30,
    details: [
      '1. SYN: Client → Server',
      '2. SYN-ACK: Server → Client',
      '3. ACK: Client → Server',
      'Connection established!',
    ],
  },
  tls: {
    id: 'tls',
    name: 'TLS Handshake',
    description: 'Establish encryption',
    icon: <Lock className="w-6 h-6" />,
    color: '#10b981',
    duration: 100,
    details: [
      'ClientHello: versions, ciphers, key share',
      'ServerHello: chosen cipher and key share',
      'Certificate chain (encrypted in TLS 1.3)',
      'Verify the certificate, derive session keys',
    ],
  },
  cdn: {
    id: 'cdn',
    name: 'CDN / Edge',
    description: 'Content delivery network',
    icon: <Cloud className="w-6 h-6" />,
    color: '#f59e0b',
    duration: 20,
    details: [
      'Check edge cache',
      'Cache-Control & ETag headers',
      'HIT: Return cached response',
      'MISS: Forward to origin',
    ],
  },
  loadbalancer: {
    id: 'loadbalancer',
    name: 'Load Balancer',
    description: 'Distribute traffic',
    icon: <Network className="w-6 h-6" />,
    color: '#ec4899',
    duration: 5,
    details: [
      'Health check backends',
      'Algorithm: Round-robin/Least-conn',
      'Session persistence (sticky)',
      'Forward to healthy backend',
    ],
  },
  webserver: {
    id: 'webserver',
    name: 'Web Server',
    description: 'nginx/Apache',
    icon: <Server className="w-6 h-6" />,
    color: '#ef4444',
    duration: 10,
    details: [
      'Parse HTTP request',
      'Check static files',
      'Apply rate limiting',
      'Proxy to application server',
    ],
  },
  appserver: {
    id: 'appserver',
    name: 'Application',
    description: 'Business logic',
    icon: <Cpu className="w-6 h-6" />,
    color: '#f97316',
    duration: 50,
    details: [
      'Route request to handler',
      'Authenticate & authorize',
      'Execute business logic',
      'Query database if needed',
    ],
  },
  database: {
    id: 'database',
    name: 'Database',
    description: 'Data persistence',
    icon: <Database className="w-6 h-6" />,
    color: '#14b8a6',
    duration: 30,
    details: [
      'Connection pool: Get connection',
      'Parse & optimize query',
      'Execute query, fetch rows',
      'Return connection to pool',
    ],
  },
};

type PacketMissionState = {
  scenario: ScenarioType;
  journeyComplete: boolean;
  failureOccurred: boolean;
};
const MISSIONS: Mission<PacketMissionState>[] = [
  {
    id: 'https',
    label: 'Follow an HTTPS request to the server and back.',
    hint: 'Pick HTTPS and step through every stage.',
    check: ({ scenario, journeyComplete }) =>
      journeyComplete && scenarios[scenario].stages.includes('tls'),
  },
  {
    id: 'cdn-cache',
    label: 'Let the CDN answer from its cache, then compare the round trip.',
    hint: 'Pick the CDN cache scenario: the request never reaches the server.',
    check: ({ scenario, journeyComplete }) => journeyComplete && scenario === 'https-cdn-cache',
  },
  {
    id: 'failure',
    label: 'Break the journey on purpose and see where it stops.',
    hint: 'Inject a failure, then run the request.',
    check: ({ failureOccurred }) => failureOccurred,
  },
];

export default function PacketJourney() {
  const resolvedTheme = useResolvedTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = resolvedTheme === 'dark';

  // Handle theme hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  const [scenario, setScenario] = useState<ScenarioType>('https-cdn');
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);
  const [journeyComplete, setJourneyComplete] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [injectFailure, setInjectFailure] = useState<string | null>(null);
  const [failureOccurred, setFailureOccurred] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [manualMode, setManualMode] = useState(true); // Start in manual mode for better learning
  const [tab, setTab] = useState('journey');
  const [dismissed, setDismissed] = useState(false);

  const animationFrameRef = useRef<number>(0);
  const lastFrameTime = useRef<number>(Date.now());
  const stageTimes = useRef<Array<{ stage: string; duration: number }>>([]);

  // Build current journey stages - VERTICAL LAYOUT
  const journeyStages = scenarios[scenario].stages.map((stageId, index, array) => {
    const stage = allStages[stageId];
    const totalStages = array.length;
    const spacing = 80 / (totalStages + 1); // Distribute evenly in vertical space
    return { ...stage, x: 50, y: 10 + (index + 1) * spacing };
  });

  // Calculate total journey time
  const totalJourneyTime = journeyStages.reduce((sum, stage) => sum + stage.duration, 0);
  const roundTripTime = roundTripMs(journeyStages);

  // Start journey
  const startJourney = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
    setCurrentStageIndex(0);
    setStageProgress(manualMode ? 1 : 0); // In manual mode, start at 100% of first stage
    setJourneyComplete(false);
    setFailureOccurred(false);
    setIsReturning(false);
    stageTimes.current = [];
    lastFrameTime.current = Date.now();
    // Step mode jumps straight to each stage, so an injected failure fires on arrival.
    if (manualMode && injectFailure && journeyStages[0]?.id === injectFailure) {
      setFailureOccurred(true);
      setIsRunning(false);
    }
  }, [manualMode, injectFailure, journeyStages]);

  // Manual advance to next stage
  const nextStage = useCallback(() => {
    if (!isRunning) {
      startJourney();
      return;
    }

    const currentStage = journeyStages[currentStageIndex];
    if (!currentStage) return;

    // Record stage completion
    if (!stageTimes.current.find((s) => s.stage === currentStage.name)) {
      stageTimes.current.push({
        stage: currentStage.name,
        duration: currentStage.duration,
      });
    }

    // Determine next stage
    if (!isReturning) {
      // Going forward (outbound journey)
      if (currentStageIndex < journeyStages.length - 1) {
        setCurrentStageIndex((prev) => prev + 1);
        setStageProgress(1); // Manual mode always at 100%
        if (injectFailure && journeyStages[currentStageIndex + 1].id === injectFailure) {
          setFailureOccurred(true);
          setIsRunning(false);
        }
      } else {
        // Reached the end, start return journey
        setIsReturning(true);
        if (journeyStages.length > 1) {
          setCurrentStageIndex(prevReturnIndex(journeyStages, currentStageIndex));
          setStageProgress(1);
        } else {
          setJourneyComplete(true);
          setIsRunning(false);
        }
      }
    } else {
      // Going backward (return journey)
      if (currentStageIndex > 0) {
        setCurrentStageIndex(prevReturnIndex(journeyStages, currentStageIndex));
        setStageProgress(1);
      } else {
        // Reached the beginning, journey complete
        setJourneyComplete(true);
        setIsRunning(false);
      }
    }
  }, [isRunning, currentStageIndex, journeyStages, isReturning, startJourney, injectFailure]);

  // Pause/Resume
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Reset
  const resetJourney = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setCurrentStageIndex(0);
    setStageProgress(0);
    setJourneyComplete(false);
    setFailureOccurred(false);
    setIsReturning(false);
    setInjectFailure(null);
    stageTimes.current = [];
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  // Change scenario
  const handleScenarioChange = useCallback(
    (newScenario: ScenarioType) => {
      setScenario(newScenario);
      resetJourney();
    },
    [resetJourney]
  );

  // Animation loop (only in auto mode)
  useEffect(() => {
    if (!isRunning || isPaused || journeyComplete || failureOccurred || manualMode) return;

    const animate = () => {
      const now = Date.now();
      const deltaTime = now - lastFrameTime.current;
      lastFrameTime.current = now;

      const currentStage = journeyStages[currentStageIndex];
      if (!currentStage) {
        setIsRunning(false);
        return;
      }

      // Check for failure injection
      if (injectFailure && currentStage.id === injectFailure && stageProgress > 0.3) {
        setFailureOccurred(true);
        setIsRunning(false);
        return;
      }

      // Calculate progress - multiply duration by 3 to slow down animation for visibility
      // speedMultiplier of 1 = normal speed (3x slower than real-time for better UX)
      const effectiveDuration = currentStage.duration * 3;
      const newProgress = stageProgress + (deltaTime * speedMultiplier) / effectiveDuration;

      if (newProgress >= 1) {
        // Stage complete
        stageTimes.current.push({
          stage: currentStage.name,
          duration: currentStage.duration,
        });

        // Determine next stage
        if (!isReturning) {
          // Going forward (outbound journey)
          if (currentStageIndex < journeyStages.length - 1) {
            // Move to next stage
            setCurrentStageIndex((prev) => prev + 1);
            setStageProgress(0);
          } else {
            // Reached the end, start return journey
            setIsReturning(true);
            if (journeyStages.length === 1) {
              // Only one stage, complete immediately
              setJourneyComplete(true);
              setIsRunning(false);
              return;
            }
            setCurrentStageIndex(prevReturnIndex(journeyStages, currentStageIndex));
            setStageProgress(0);
          }
        } else {
          // Going backward (return journey)
          if (currentStageIndex > 0) {
            // Move to previous stage
            setCurrentStageIndex(prevReturnIndex(journeyStages, currentStageIndex));
            setStageProgress(0);
          } else {
            // Reached the beginning, journey complete
            setJourneyComplete(true);
            setIsRunning(false);
            return;
          }
        }
      } else {
        setStageProgress(newProgress);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    isRunning,
    isPaused,
    currentStageIndex,
    stageProgress,
    journeyStages,
    speedMultiplier,
    injectFailure,
    journeyComplete,
    failureOccurred,
    isReturning,
    manualMode,
  ]);

  // Get packet position - memoized to prevent unnecessary recalculations
  const packetPos = React.useMemo(() => {
    if (!journeyStages.length || currentStageIndex >= journeyStages.length) return { x: 50, y: 50 };
    const currentStage = journeyStages[currentStageIndex];
    if (!currentStage) return { x: 50, y: 50 };
    const nextStage = isReturning
      ? currentStageIndex > 0
        ? journeyStages[currentStageIndex - 1]
        : currentStage
      : currentStageIndex < journeyStages.length - 1
        ? journeyStages[currentStageIndex + 1]
        : currentStage;
    const x = currentStage.x + (nextStage.x - currentStage.x) * stageProgress;
    const y = currentStage.y + (nextStage.y - currentStage.y) * stageProgress;
    return { x, y };
  }, [currentStageIndex, stageProgress, journeyStages, isReturning]);

  const missionState = React.useMemo(
    () => ({ scenario, journeyComplete, failureOccurred }),
    [scenario, journeyComplete, failureOccurred]
  );
  const missions = useMissions(MISSIONS, missionState);
  const currentStage = journeyStages[currentStageIndex];
  const announcement = failureOccurred
    ? `Journey stopped at ${currentStage?.name ?? 'the selected stage'}.`
    : journeyComplete
      ? `Round trip complete in ${roundTripTime} milliseconds.`
      : isRunning
        ? `${isReturning ? 'Returning through' : 'Sending through'} ${currentStage?.name ?? 'the route'}.`
        : `Ready: ${scenarios[scenario].name}.`;
  const startOver = () => {
    resetJourney();
    missions.reset();
    setDismissed(false);
  };
  const runAction = (phone = false) => {
    const className = phone ? 'h-10 flex-1' : 'h-8';
    if (manualMode)
      return (
        <Button type="button" className={className} onClick={nextStage} disabled={journeyComplete}>
          {isRunning ? (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
          {isRunning ? 'Next' : 'Start'}
        </Button>
      );
    return (
      <Button
        type="button"
        className={className}
        onClick={isRunning ? togglePause : startJourney}
        disabled={journeyComplete}
      >
        {isRunning && !isPaused ? (
          <Pause className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Play className="h-4 w-4" aria-hidden="true" />
        )}
        {isRunning ? (isPaused ? 'Resume' : 'Pause') : 'Start'}
      </Button>
    );
  };

  // Prevent theme flash on mount
  if (!mounted) return null;

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="Packet Journey"
          icon={Network}
          lead={
            <div
              className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
              data-theme={isDark ? 'dark' : 'light'}
            >
              <label className="sr-only" htmlFor="packet-journey-scenario">
                Scenario
              </label>
              <select
                id="packet-journey-scenario"
                aria-label="Scenario"
                value={scenario}
                onChange={(event) => handleScenarioChange(event.target.value as ScenarioType)}
                className="h-10 min-w-0 max-w-full rounded-md border bg-background px-2 text-sm lg:h-8"
              >
                {(Object.keys(scenarios) as ScenarioType[]).map((key) => (
                  <option key={key} value={key}>
                    {scenarios[key].name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant={manualMode ? 'default' : 'outline'}
                aria-pressed={manualMode}
                onClick={() => {
                  setManualMode(true);
                  resetJourney();
                }}
                className="h-10 lg:h-8"
              >
                <Layers className="h-4 w-4" aria-hidden="true" /> Step
              </Button>
              <Button
                type="button"
                variant={!manualMode ? 'default' : 'outline'}
                aria-pressed={!manualMode}
                onClick={() => {
                  setManualMode(false);
                  resetJourney();
                }}
                className="h-10 lg:h-8"
              >
                <Zap className="h-4 w-4" aria-hidden="true" /> Auto
              </Button>
            </div>
          }
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={
            currentStage
              ? `${isReturning ? 'Returning via' : 'At'} ${currentStage.name}`
              : 'Ready to trace the route'
          }
          meta={
            <Badge variant="secondary" className="font-mono tabular-nums">
              {roundTripTime}ms round trip
            </Badge>
          }
          actions={
            <div className="hidden items-center gap-2 lg:flex">
              {runAction()}
              <Button type="button" variant="outline" className="h-8" onClick={resetJourney}>
                Reset
              </Button>
            </div>
          }
          goal={
            missions.complete ? (
              'All three missions are complete. Keep exploring the route.'
            ) : (
              <>
                {missions.current?.label}{' '}
                <span className="text-muted-foreground">{missions.current?.hint}</span>
              </>
            )
          }
        />
        <SimAnnouncer message={announcement} />
        {missions.complete && !dismissed ? (
          <SimComplete
            title="Packet Journey missions complete"
            summary="You traced encrypted traffic to an origin and back, saw a CDN cache answer at the edge, and stopped a request at a chosen hop."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Round trip', value: `${roundTripTime}ms` },
              { label: 'Stages', value: journeyStages.length },
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
            columns="lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
            minHeight="min-h-[25rem]"
            tab={tab}
            onTabChange={(next) => {
              if (next === 'journey' || next === 'details') setTab(next);
            }}
            tabsLabel="Packet journey panels"
            panels={[
              {
                id: 'journey',
                label: 'Journey',
                className: 'space-y-2',
                content: (
                  <section
                    className="rounded-lg border bg-card p-3"
                    data-packet-position={`${packetPos.x},${packetPos.y}`}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">Request path</h3>
                        <p className="text-xs text-muted-foreground">
                          {isRunning
                            ? isReturning
                              ? 'Response is travelling back to Browser.'
                              : 'Request is travelling toward the response.'
                            : 'Start a run, then follow each hop.'}
                        </p>
                      </div>
                      {failureOccurred ? (
                        <Badge variant="outline" className="border-wrong/50 text-wrong-foreground">
                          <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Stopped
                        </Badge>
                      ) : journeyComplete ? (
                        <Badge
                          variant="outline"
                          className="border-correct/50 text-correct-foreground"
                        >
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Complete
                        </Badge>
                      ) : (
                        <Badge variant="outline">{isReturning ? 'Response' : 'Request'}</Badge>
                      )}
                    </div>
                    <div className="hidden overflow-hidden rounded-md border bg-muted/20 p-3 sm:block">
                      <div className="relative">
                        <div className="absolute left-4 right-4 top-8 border-t border-dashed border-muted-foreground/40" />
                        <div
                          className="relative grid gap-1"
                          style={{
                            gridTemplateColumns: `repeat(${journeyStages.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {journeyStages.map((stage, index) => {
                            const active = isRunning && currentStageIndex === index;
                            const passed =
                              currentStageIndex > index ||
                              (isReturning && currentStageIndex <= index);
                            const failed = failureOccurred && stage.id === injectFailure;
                            return (
                              <div key={stage.id} className="min-w-0 text-center">
                                <div
                                  className={cn(
                                    'relative mx-auto flex h-16 w-16 items-center justify-center rounded-lg border bg-card',
                                    active && 'border-primary bg-primary/10 ring-2 ring-primary/30',
                                    passed && !active && 'border-correct/50 bg-correct/10',
                                    failed && 'border-wrong/50 bg-wrong/10'
                                  )}
                                >
                                  {stage.icon}
                                  {active && !failureOccurred && (
                                    <motion.span
                                      layoutId="packet-marker"
                                      className="absolute -bottom-2 h-3 w-3 rounded-full bg-primary"
                                      aria-label="Packet marker"
                                    />
                                  )}
                                </div>
                                <p className="mt-2 truncate text-xs font-medium">{stage.name}</p>
                                <p className="text-xs text-muted-foreground">{stage.duration}ms</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <ol className="space-y-2 sm:hidden">
                      {journeyStages.map((stage, index) => {
                        const active = isRunning && currentStageIndex === index;
                        const passed =
                          currentStageIndex > index || (isReturning && currentStageIndex <= index);
                        const failed = failureOccurred && stage.id === injectFailure;
                        return (
                          <li
                            key={stage.id}
                            className={cn(
                              'flex min-w-0 items-center gap-3 rounded-md border p-2',
                              active && 'border-primary bg-primary/10',
                              passed && !active && 'border-correct/50 bg-correct/10',
                              failed && 'border-wrong/50 bg-wrong/10'
                            )}
                          >
                            <div className="relative shrink-0 rounded-md border bg-card p-1.5">
                              {stage.icon}
                              {active && !failureOccurred && (
                                <motion.span
                                  layoutId="packet-marker"
                                  className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary"
                                  aria-label="Packet marker"
                                />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{stage.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {stage.description} · {stage.duration}ms
                              </p>
                            </div>
                            {failed && (
                              <XCircle
                                className="ml-auto h-4 w-4 shrink-0 text-wrong-foreground"
                                aria-hidden="true"
                              />
                            )}
                          </li>
                        );
                      })}
                    </ol>
                    {(journeyComplete || failureOccurred) && (
                      <div
                        className={cn(
                          'mt-3 flex items-start gap-2 rounded-md border p-2 text-sm',
                          failureOccurred
                            ? 'border-wrong/50 bg-wrong/10'
                            : 'border-correct/50 bg-correct/10'
                        )}
                      >
                        {failureOccurred ? (
                          <XCircle
                            className="mt-0.5 h-4 w-4 shrink-0 text-wrong-foreground"
                            aria-hidden="true"
                          />
                        ) : (
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0 text-correct-foreground"
                            aria-hidden="true"
                          />
                        )}
                        <p>
                          {failureOccurred
                            ? `Failure at ${currentStage?.name ?? 'the selected'} stage. The request cannot continue.`
                            : `Round trip complete: ${roundTripTime}ms. The response reused the TCP and TLS connection.`}
                        </p>
                      </div>
                    )}
                  </section>
                ),
              },
              {
                id: 'details',
                label: 'Details',
                className: 'space-y-2',
                content: (
                  <>
                    <section className="rounded-lg border bg-card p-3">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <Activity className="h-4 w-4 text-primary" aria-hidden="true" /> Current hop
                      </h3>
                      {currentStage && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            {currentStage.icon}
                            <div>
                              <p className="text-sm font-medium">{currentStage.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {currentStage.description}
                              </p>
                            </div>
                          </div>
                          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {currentStage.details.map((detail) => (
                              <li key={detail} className="flex gap-2">
                                <CheckCircle2
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                                  aria-hidden="true"
                                />
                                {detail}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </section>
                    <section className="rounded-lg border bg-card p-3">
                      <h3 className="mb-2 text-sm font-semibold">Failure injection</h3>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant={injectFailure === null ? 'default' : 'outline'}
                          aria-pressed={injectFailure === null}
                          onClick={() => setInjectFailure(null)}
                          className="h-10 lg:h-8"
                        >
                          None
                        </Button>
                        {journeyStages.slice(1, -1).map((stage) => (
                          <Button
                            key={stage.id}
                            type="button"
                            size="sm"
                            variant={injectFailure === stage.id ? 'default' : 'outline'}
                            aria-pressed={injectFailure === stage.id}
                            onClick={() => setInjectFailure(stage.id)}
                            className="h-10 lg:h-8"
                          >
                            {stage.name}
                          </Button>
                        ))}
                      </div>
                    </section>
                    <section className="rounded-lg border bg-card p-3">
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <Timer className="h-4 w-4 text-primary" aria-hidden="true" /> Timing
                        waterfall
                      </h3>
                      <div className="space-y-1.5">
                        {journeyStages.map((stage, index) => {
                          const cumulativeTime = journeyStages
                            .slice(0, index + 1)
                            .reduce((sum, item) => sum + item.duration, 0);
                          return (
                            <div
                              key={stage.id}
                              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs"
                            >
                              <span className="truncate">{stage.name}</span>
                              <span className="font-mono text-muted-foreground">
                                {cumulativeTime}ms
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        One way: {totalJourneyTime}ms · round trip: {roundTripTime}ms
                      </p>
                    </section>
                    {!manualMode && (
                      <section className="rounded-lg border bg-card p-3">
                        <h3 className="mb-2 text-sm font-semibold">Auto-play speed</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {[0.5, 1, 2, 4].map((speed) => (
                            <Button
                              key={speed}
                              type="button"
                              size="sm"
                              variant={speedMultiplier === speed ? 'default' : 'outline'}
                              aria-pressed={speedMultiplier === speed}
                              onClick={() => setSpeedMultiplier(speed)}
                              className="h-10 lg:h-8"
                            >
                              {speed}x
                            </Button>
                          ))}
                        </div>
                      </section>
                    )}
                    <SimMissionList missions={missions.missions} />
                    <details className="rounded-lg border bg-card p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        How the route works
                      </summary>
                      <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                        <p>
                          DNS finds the IP address, TCP opens a connection, and TLS establishes
                          encryption before the request can reach a CDN, load balancer, or server.
                        </p>
                        <p>
                          The response returns over the open connection, so it skips DNS, TCP, and
                          TLS setup. A CDN cache hit stops at the edge instead of travelling to the
                          origin.
                        </p>
                      </div>
                    </details>
                  </>
                ),
              },
            ]}
          />
        )}
        <SimPhoneBar>
          {runAction(true)}
          <Button type="button" variant="outline" className="h-10" onClick={resetJourney}>
            Reset
          </Button>
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
