'use client';

import React, { useState, useEffect, useCallback, useId, useRef, useMemo } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import {
  Activity,
  Bomb,
  CircleCheck,
  Cpu,
  MemoryStick,
  Pause,
  Play,
  RotateCcw,
  Settings,
  ShieldCheck,
  Skull,
  TreePine,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimMissionList,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  SimTerminalWindow,
  revealTop,
  useMissions,
  type Mission,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';

interface Process {
  id: number;
  parentId: number | null;
  x: number;
  y: number;
  depth: number;
  spawned: number;
  dead: boolean;
}

interface LogEntry {
  tick: number;
  text: string;
  type: 'fork' | 'error' | 'info';
}

type SimState = 'idle' | 'running' | 'paused' | 'crashed' | 'protected';

const MAX_PID_LIMIT = 512;
// Every protection card sets a per-user limit of 100 processes.
const PROTECTION_LIMIT = 100;
const MEMORY_PER_PROCESS = 0.4;
const TOTAL_MEMORY = 256;
const CPU_PER_PROCESS = 0.3;

const CODE_PARTS = [
  { text: ':', label: 'Function name (yes, just a colon)' },
  { text: '()', label: 'No parameters' },
  { text: '{', label: 'Function body start' },
  { text: ' :', label: 'Call itself (fork #1)' },
  { text: '|', label: 'Pipe output to...' },
  { text: ':', label: 'Another copy of itself (fork #2)' },
  { text: '&', label: 'Run in background' },
  { text: ' }', label: 'Function body end' },
  { text: ';', label: 'End statement' },
  { text: ':', label: 'Execute the function' },
];

const PROTECTION_METHODS = [
  {
    id: 'ulimit',
    name: 'ulimit -u',
    description: 'Limit max user processes',
    command: 'ulimit -u 100',
    limitLog:
      'bash: fork: retry: Resource temporarily unavailable (ulimit -u 100 reached) - fork bomb contained',
  },
  {
    id: 'cgroup',
    name: 'cgroups',
    description: 'Kernel-level process limits',
    command: 'echo 100 > /sys/fs/cgroup/user.slice/user-1000.slice/pids.max',
    limitLog: 'cgroup: fork rejected, pids.max (100) reached - fork bomb contained',
  },
  {
    id: 'systemd',
    name: 'systemd',
    description: 'TasksMax in unit files',
    command: 'TasksMax=100 in [Service]',
    limitLog: 'systemd: TasksMax=100 reached for the unit - fork bomb contained',
  },
];

type MissionState = { protection: string | null; state: SimState };

/** The hidden finish rule, made visible: pick a protection, then Start, and it holds. */
const MISSIONS: Mission<MissionState>[] = [
  {
    id: 'pick',
    label: 'Pick a protection',
    hint: 'ulimit, cgroups or systemd, under Protection.',
    check: (s) => s.protection !== null,
  },
  {
    id: 'start',
    label: 'Press Start with the protection on',
    hint: 'The fork bomb runs until a limit stops it.',
    check: (s) =>
      s.protection !== null &&
      (s.state === 'running' || s.state === 'paused' || s.state === 'protected'),
  },
  {
    id: 'hold',
    label: 'Watch the limit hold before the system runs out',
    hint: `The protection limit (${PROTECTION_LIMIT}) has to be below the PID limit.`,
    check: (s) => s.state === 'protected',
  },
];

const STATE_LABEL: Record<SimState, string> = {
  idle: 'Ready',
  running: 'Forking',
  paused: 'Paused',
  crashed: 'System crashed',
  protected: 'Fork bomb contained',
};

function ConnectionLines({ processes }: { processes: Process[] }) {
  const visible = processes.slice(-300);
  const processMap = useMemo(() => {
    const map = new Map<number, Process>();
    for (const p of visible) map.set(p.id, p);
    return map;
  }, [visible]);

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {visible.map((proc) => {
        if (proc.parentId === null || proc.dead) return null;
        const parent = processMap.get(proc.parentId);
        if (!parent) return null;
        return (
          <line
            key={`line-${proc.id}`}
            x1={`${parent.x}%`}
            y1={`${parent.y}%`}
            x2={`${proc.x}%`}
            y2={`${proc.y}%`}
            className={
              proc.depth < 3
                ? 'stroke-wrong/30'
                : proc.depth < 6
                  ? 'stroke-primary/20'
                  : 'stroke-partial/15'
            }
            strokeWidth={Math.max(0.5, 2 - proc.depth * 0.2)}
          />
        );
      })}
    </svg>
  );
}

function ProcessNode({ process, tick }: { process: Process; tick: number }) {
  const age = tick - process.spawned;
  const pulse = Math.sin(age * 0.5) * 0.15 + 1;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: process.dead ? 0.3 : pulse,
        opacity: process.dead ? 0.2 : Math.max(0.4, 1 - age * 0.01),
      }}
      className={cn(
        'absolute rounded-full',
        process.dead
          ? 'bg-wrong/40'
          : process.depth === 0
            ? 'bg-wrong'
            : process.depth < 3
              ? 'bg-primary'
              : process.depth < 6
                ? 'bg-partial'
                : 'bg-partial/60'
      )}
      style={{
        left: `${process.x}%`,
        top: `${process.y}%`,
        width: Math.max(4, 12 - process.depth),
        height: Math.max(4, 12 - process.depth),
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
}

function ResourceBar({
  label,
  value,
  max,
  unit,
  icon: Icon,
  danger,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  icon: React.ElementType;
  danger: boolean;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </span>
        <span
          className={cn(
            'font-mono tabular-nums',
            danger ? 'font-bold text-wrong-foreground' : 'text-foreground'
          )}
        >
          {value.toFixed(1)}
          {unit} / {max}
          {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn(
            'h-full rounded-full transition-colors duration-300',
            pct > 90 ? 'bg-wrong' : pct > 50 ? 'bg-partial' : 'bg-correct'
          )}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}

function GrowthCounter({ activeCount, state }: { activeCount: number; state: SimState }) {
  const powers = [];
  let val = 1;
  while (val <= activeCount && powers.length < 12) {
    powers.push(val);
    val *= 2;
  }

  if (state === 'idle') return null;

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1"
      aria-label={`${activeCount} processes, doubling each generation`}
    >
      {powers.map((p, i) => (
        <React.Fragment key={p}>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 font-mono text-xs transition-colors duration-300',
              p <= activeCount
                ? 'bg-wrong/15 text-wrong-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {p.toLocaleString()}
          </span>
          {i < powers.length - 1 && (
            <span className="text-xs text-muted-foreground" aria-hidden="true">
              {'>'}
            </span>
          )}
        </React.Fragment>
      ))}
      {activeCount > (powers[powers.length - 1] || 1) && (
        <>
          <span className="text-xs text-muted-foreground" aria-hidden="true">
            {'>'}
          </span>
          <span className="rounded bg-wrong/25 px-1.5 py-0.5 font-mono text-xs font-bold text-wrong-foreground">
            {activeCount.toLocaleString()}
          </span>
        </>
      )}
    </div>
  );
}

function TerminalLog({ logs, running }: { logs: LogEntry[]; running: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <SimTerminalWindow label="process log" status={`${running} running`}>
      <div
        ref={scrollRef}
        role="log"
        aria-label="Process log"
        className="h-28 overflow-y-auto overscroll-contain px-3 py-2 text-xs leading-relaxed [scrollbar-width:thin]"
      >
        {logs.length === 0 && <span className="text-terminal-muted">$ waiting...</span>}
        {logs.map((log, i) => (
          <div
            key={i}
            className={cn(
              log.type === 'error'
                ? 'text-terminal-error'
                : log.type === 'info'
                  ? 'text-terminal-success'
                  : 'text-terminal-foreground'
            )}
          >
            <span className="text-terminal-muted">[{log.tick.toString().padStart(3, '0')}]</span>{' '}
            {log.text}
          </div>
        ))}
      </div>
    </SimTerminalWindow>
  );
}

type Tab = 'stage' | 'controls' | 'learn';

export default function ForkBombSimulator() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [state, setState] = useState<SimState>('idle');
  const [tick, setTick] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [pidLimit, setPidLimit] = useState(MAX_PID_LIMIT);
  const [protection, setProtection] = useState<string | null>(null);
  const [highlightedPart, setHighlightedPart] = useState<number | null>(null);
  const [peakProcesses, setPeakProcesses] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tab, setTab] = useState<Tab>('stage');
  /** "Keep exploring" closes the end card; free play goes on. */
  const [dismissed, setDismissed] = useState(false);
  const nextPid = useRef(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  // A protection only helps if its limit is below the system-wide PID limit;
  // otherwise the system runs out first.
  const contained = protection !== null && PROTECTION_LIMIT < pidLimit;
  const effectiveLimit = contained ? PROTECTION_LIMIT : pidLimit;

  const missionState = useMemo(() => ({ protection, state }), [protection, state]);
  const missions = useMissions(MISSIONS, missionState);

  const activeCount = useMemo(() => processes.filter((p) => !p.dead).length, [processes]);
  const memoryUsed = activeCount * MEMORY_PER_PROCESS;
  const cpuUsage = Math.min(100, activeCount * CPU_PER_PROCESS);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProcesses([]);
    setState('idle');
    setTick(0);
    nextPid.current = 1;
    setPeakProcesses(0);
    setLogs([]);
  }, []);

  const spawnProcess = useCallback(
    (
      parentId: number | null,
      parentX: number,
      parentY: number,
      depth: number,
      currentTick: number
    ): Process => {
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.max(2, 20 - depth * 2);
      const x = Math.max(
        2,
        Math.min(98, parentX + Math.cos(angle) * spread * (0.5 + Math.random()))
      );
      const y = Math.max(
        2,
        Math.min(98, parentY + Math.sin(angle) * spread * (0.5 + Math.random()))
      );

      return {
        id: nextPid.current++,
        parentId,
        x,
        y,
        depth,
        spawned: currentTick,
        dead: false,
      };
    },
    []
  );

  const startSimulation = useCallback(() => {
    reset();
    const root: Process = {
      id: nextPid.current++,
      parentId: null,
      x: 50,
      y: 50,
      depth: 0,
      spawned: 0,
      dead: false,
    };
    setProcesses([root]);
    setState('running');
    setLogs([
      { tick: 0, text: '$ :(){ :|:& };:', type: 'info' },
      { tick: 0, text: 'fork() -> PID 1', type: 'fork' },
    ]);
  }, [reset]);

  // Main simulation loop
  useEffect(() => {
    if (state !== 'running') return;

    intervalRef.current = setInterval(
      () => {
        setTick((t) => {
          const newTick = t + 1;

          setProcesses((prev) => {
            const alive = prev.filter((p) => !p.dead);

            if (alive.length >= effectiveLimit) {
              if (contained) {
                setState('protected');
                const method = PROTECTION_METHODS.find((m) => m.id === protection);
                setLogs((l) => [
                  ...l.slice(-50),
                  {
                    tick: newTick,
                    text: method?.limitLog ?? 'process limit reached - fork bomb contained',
                    type: 'info',
                  },
                ]);
              } else {
                setState('crashed');
                setLogs((l) => [
                  ...l.slice(-50),
                  {
                    tick: newTick,
                    text: `FATAL: fork() failed - Resource temporarily unavailable`,
                    type: 'error',
                  },
                  {
                    tick: newTick,
                    text: `kernel: PID limit (${effectiveLimit}) exhausted. System unresponsive.`,
                    type: 'error',
                  },
                ]);
              }
              if (intervalRef.current) clearInterval(intervalRef.current);
              return prev;
            }

            // Each copy forks twice (the two sides of the pipe) and then exits,
            // so the live count doubles every generation until the limit stops it.
            const newProcesses: Process[] = [];
            const exited = new Set<number>();
            let liveCount = alive.length;
            for (const proc of alive) {
              if (liveCount >= effectiveLimit) break;
              newProcesses.push(spawnProcess(proc.id, proc.x, proc.y, proc.depth + 1, newTick));
              newProcesses.push(spawnProcess(proc.id, proc.x, proc.y, proc.depth + 1, newTick));
              exited.add(proc.id);
              liveCount += 1;
            }

            const total = [
              ...prev.map((p) => (exited.has(p.id) ? { ...p, dead: true } : p)),
              ...newProcesses,
            ];
            const aliveCount = total.filter((p) => !p.dead).length;
            setPeakProcesses((peak) => Math.max(peak, aliveCount));

            // Add log entries (sample to avoid flooding)
            if (newProcesses.length > 0) {
              const sample = newProcesses.slice(0, 2);
              setLogs((l) => [
                ...l.slice(-50),
                ...sample.map((p) => ({
                  tick: newTick,
                  text: `fork() -> PID ${p.id} (parent: ${p.parentId}, depth: ${p.depth})`,
                  type: 'fork' as const,
                })),
                ...(newProcesses.length > 2
                  ? [
                      {
                        tick: newTick,
                        text: `  ...and ${newProcesses.length - 2} more forks`,
                        type: 'fork' as const,
                      },
                    ]
                  : []),
              ]);
            }

            return total;
          });

          return newTick;
        });
      },
      Math.max(50, 300 / speed)
    );

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state, speed, effectiveLimit, contained, protection, spawnProcess]);

  const timeElapsed = ((tick * (300 / speed)) / 1000).toFixed(1);
  const method = PROTECTION_METHODS.find((m) => m.id === protection);
  const busy = state === 'running' || state === 'paused';

  const pause = () => {
    setState('paused');
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const start = () => {
    startSimulation();
    // On phones the controls are their own tab: show the simulation it started.
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      setTab('stage');
      revealTop(tabsRef.current, { onlyIfAbove: true });
    }
  };

  const startOver = () => {
    reset();
    setProtection(null);
    setPidLimit(MAX_PID_LIMIT);
    setSpeed(1);
    setHighlightedPart(null);
    setDismissed(false);
    missions.reset();
    setTab('stage');
  };

  const mainControl = (className?: string) =>
    state === 'paused' ? (
      <Button variant="destructive" onClick={() => setState('running')} className={className}>
        <Play className="h-4 w-4" aria-hidden="true" />
        Resume
      </Button>
    ) : state === 'idle' || state === 'crashed' || state === 'protected' ? (
      <Button variant="destructive" onClick={start} className={className}>
        <Play className="h-4 w-4" aria-hidden="true" />
        {state === 'idle' ? 'Start' : 'Restart'}
      </Button>
    ) : (
      <Button onClick={pause} variant="outline" className={className}>
        <Pause className="h-4 w-4" aria-hidden="true" />
        Pause
      </Button>
    );

  const announce =
    state === 'crashed'
      ? `System crashed. The PID limit of ${effectiveLimit} ran out in ${timeElapsed} seconds.`
      : state === 'protected'
        ? `Fork bomb contained at ${PROTECTION_LIMIT} processes.`
        : state === 'running'
          ? 'Fork bomb running.'
          : '';

  const learn = (
    <div className="space-y-2">
      <SimMissionList missions={missions.missions} />

      <SimTerminalWindow label="the fork bomb, part by part">
        <div className="px-3 pt-3">
          <div
            className="flex flex-wrap items-center justify-center text-lg"
            role="group"
            aria-label="The fork bomb, part by part"
          >
            {CODE_PARTS.map((part, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={highlightedPart === i}
                aria-label={`${part.text.trim()}: ${part.label}`}
                onMouseEnter={() => setHighlightedPart(i)}
                onFocus={() => setHighlightedPart(i)}
                onClick={() => setHighlightedPart(i)}
                className={cn(
                  'min-h-10 min-w-6 whitespace-pre rounded px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  highlightedPart === i
                    ? 'bg-terminal-error/20 text-terminal-error'
                    : 'text-terminal-input hover:bg-terminal-bar'
                )}
              >
                {part.text}
              </button>
            ))}
          </div>
          <p className="min-h-12 py-2 text-center text-sm text-terminal-foreground">
            {highlightedPart !== null
              ? CODE_PARTS[highlightedPart].label
              : 'Tap or hover each part to see what it does.'}
          </p>
        </div>
      </SimTerminalWindow>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The function calls itself twice, piping into a background copy, so the number of processes
        doubles with every generation.
      </p>

      <details className="rounded-lg border bg-card p-2.5 text-sm">
        <summary className="cursor-pointer select-none font-semibold">
          Why fork bombs are dangerous
        </summary>
        <div className="mt-2 space-y-2">
          <div>
            <h4 className="flex items-center gap-1.5 font-medium">
              <Zap className="h-4 w-4 text-wrong-foreground" aria-hidden="true" />
              Exponential growth
            </h4>
            <p className="text-muted-foreground">
              Each process spawns 2 more. After 10 iterations: 1,024 processes. After 20: over 1
              million. Most systems hit their PID limit well before that.
            </p>
          </div>
          <div>
            <h4 className="flex items-center gap-1.5 font-medium">
              <Cpu className="h-4 w-4 text-partial-foreground" aria-hidden="true" />
              Resource exhaustion
            </h4>
            <p className="text-muted-foreground">
              Every process consumes CPU time, memory, and a process table entry. The kernel
              scheduler gets overwhelmed trying to context-switch between thousands of processes.
            </p>
          </div>
          <div>
            <h4 className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-4 w-4 text-correct-foreground" aria-hidden="true" />
              Prevention
            </h4>
            <p className="text-muted-foreground">
              Set process limits with{' '}
              <code className="rounded bg-muted px-1 font-mono">ulimit -u</code>, use cgroups, or
              configure <code className="rounded bg-muted px-1 font-mono">TasksMax</code> in systemd
              unit files. Most modern distros set sane defaults.
            </p>
          </div>
        </div>
      </details>

      <SimFeedback tone="danger" label="Never run a fork bomb on a real system">
        <p>
          It will freeze the machine and require a hard reboot. This simulator shows the idea
          without forking any real processes.
        </p>
      </SimFeedback>
    </div>
  );

  const simulation = (
    <div className="space-y-2">
      <GrowthCounter activeCount={activeCount} state={state} />
      <div
        className={cn(
          'relative aspect-[16/10] w-full overflow-hidden rounded-lg border transition-colors duration-500 motion-reduce:transition-none',
          state === 'crashed'
            ? 'border-wrong/40 bg-wrong/10'
            : state === 'protected'
              ? 'border-correct/40 bg-correct/10'
              : 'bg-card'
        )}
      >
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.06]" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={`h-${i}`}
              className="absolute h-px w-full bg-foreground"
              style={{ top: `${(i + 1) * 10}%` }}
            />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={`v-${i}`}
              className="absolute h-full w-px bg-foreground"
              style={{ left: `${(i + 1) * 10}%` }}
            />
          ))}
        </div>

        <ConnectionLines processes={processes} />

        {processes.slice(-500).map((proc) => (
          <ProcessNode key={proc.id} process={proc} tick={tick} />
        ))}

        {state === 'idle' && processes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <TreePine className="h-12 w-12 text-muted-foreground/40" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Press Start to unleash the fork bomb</p>
          </div>
        )}

        <AnimatePresence>
          {state === 'crashed' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 p-4 text-center backdrop-blur-sm"
            >
              <Skull className="h-12 w-12 text-wrong-foreground" aria-hidden="true" />
              <p className="mt-3 text-xl font-bold text-wrong-foreground">System crashed</p>
              <p className="mt-1 text-sm">
                PID limit ({effectiveLimit}) reached in {timeElapsed}s
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Peak: {peakProcesses} processes</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {state === 'protected' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 p-4 text-center backdrop-blur-sm"
            >
              <ShieldCheck className="h-12 w-12 text-correct-foreground" aria-hidden="true" />
              <p className="mt-3 text-xl font-bold text-correct-foreground">System protected</p>
              <p className="mt-1 text-sm">
                Process limit enforced at {PROTECTION_LIMIT}: the system stays stable
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Fork bomb contained after {timeElapsed}s
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {state === 'running' && (
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            <Badge variant="outline" className="bg-card/90 font-mono text-xs">
              PID: {activeCount} / {effectiveLimit}
            </Badge>
            <Badge variant="outline" className="bg-card/90 font-mono text-xs">
              {timeElapsed}s elapsed
            </Badge>
          </div>
        )}

        {(state === 'running' || state === 'paused' || state === 'idle') &&
          processes.length > 0 && (
            <div className="absolute bottom-2 right-2 flex flex-wrap items-center gap-2 rounded bg-card/90 px-2 py-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-wrong" /> root
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" /> gen 1-2
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-partial" /> gen 3-5
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-partial/60" /> gen 6+
              </span>
            </div>
          )}
      </div>

      <TerminalLog logs={logs} running={activeCount} />
    </div>
  );

  const controls = (k: string) => (
    <div className="space-y-2">
      <section
        aria-labelledby={`${uid}-${k}-controls`}
        className="space-y-2 rounded-lg border bg-card p-2.5"
      >
        <h3 id={`${uid}-${k}-controls`} className="flex items-center gap-2 text-sm font-semibold">
          <Settings className="h-4 w-4" aria-hidden="true" />
          Controls
        </h3>
        <div className="flex gap-2">
          {mainControl('h-10 flex-1')}
          <Button
            onClick={reset}
            variant="outline"
            size="icon"
            className="h-10 w-10"
            aria-label="Reset the simulation"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="space-y-1">
          <label htmlFor={`${uid}-${k}-speed`} className="flex justify-between text-sm">
            <span>Speed</span>
            <span className="font-mono tabular-nums">{speed}x</span>
          </label>
          <input
            id={`${uid}-${k}-speed`}
            type="range"
            min={0.5}
            max={4}
            step={0.5}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="h-6 w-full accent-primary disabled:opacity-50"
            disabled={busy}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={`${uid}-${k}-pid`} className="flex justify-between text-sm">
            <span>PID limit</span>
            <span className="font-mono tabular-nums">{pidLimit}</span>
          </label>
          <input
            id={`${uid}-${k}-pid`}
            type="range"
            min={64}
            max={1024}
            step={64}
            value={pidLimit}
            onChange={(e) => setPidLimit(Number(e.target.value))}
            className="h-6 w-full accent-primary disabled:opacity-50"
            disabled={busy}
          />
        </div>
      </section>

      <section
        aria-labelledby={`${uid}-${k}-protection`}
        className="rounded-lg border bg-card p-2.5"
      >
        <h3 id={`${uid}-${k}-protection`} className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-correct-foreground" aria-hidden="true" />
          Protection
        </h3>
        <div className="mt-2 space-y-2" role="group" aria-labelledby={`${uid}-${k}-protection`}>
          {PROTECTION_METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={protection === m.id}
              onClick={() => setProtection(protection === m.id ? null : m.id)}
              disabled={busy}
              className={cn(
                'w-full rounded-md border p-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                protection === m.id ? 'border-correct/60 bg-correct/10' : 'hover:border-correct/40'
              )}
            >
              <span className="flex items-center justify-between gap-2 font-semibold">
                {m.name}
                {protection === m.id && (
                  <CircleCheck className="h-4 w-4 text-correct-foreground" aria-hidden="true" />
                )}
              </span>
              <span className="block text-muted-foreground">{m.description}</span>
              <code className="mt-1 block font-mono text-xs text-correct-foreground [overflow-wrap:anywhere]">
                {m.command}
              </code>
            </button>
          ))}
        </div>
        {protection && contained && (
          <SimFeedback tone="success" label="This will hold" className="mt-2">
            <p>Process limit capped at {PROTECTION_LIMIT}: the fork bomb will be contained.</p>
          </SimFeedback>
        )}
        {protection && !contained && (
          <SimFeedback tone="warning" label="This will not hold" className="mt-2">
            <p>
              The {PROTECTION_LIMIT}-process limit is not below the system PID limit ({pidLimit}),
              so the system runs out first.
            </p>
          </SimFeedback>
        )}
      </section>

      <section
        aria-labelledby={`${uid}-${k}-resources`}
        className="space-y-2 rounded-lg border bg-card p-2.5"
      >
        <h3 id={`${uid}-${k}-resources`} className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4" aria-hidden="true" />
          System resources
        </h3>
        <ResourceBar
          label="Processes"
          value={activeCount}
          max={effectiveLimit}
          unit=""
          icon={TreePine}
          danger={activeCount > effectiveLimit * 0.8}
        />
        <ResourceBar
          label="CPU"
          value={cpuUsage}
          max={100}
          unit="%"
          icon={Cpu}
          danger={cpuUsage > 80}
        />
        <ResourceBar
          label="Memory"
          value={memoryUsed}
          max={TOTAL_MEMORY}
          unit="MB"
          icon={MemoryStick}
          danger={memoryUsed > TOTAL_MEMORY * 0.8}
        />
      </section>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="Fork Bomb Simulator"
          icon={Bomb}
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={STATE_LABEL[state]}
          meta={
            <>
              <Badge variant="outline">{method ? method.name : 'No protection'}</Badge>
              <Badge variant="secondary" className="font-mono">
                PID limit {pidLimit}
              </Badge>
            </>
          }
          actions={<div className="hidden lg:flex">{mainControl('h-8')}</div>}
          goal={
            missions.complete
              ? 'Done. Keep exploring: try a PID limit below 100, or no protection at all.'
              : `${missions.current?.label}.`
          }
        />

        <SimAnnouncer message={announce} />

        {state === 'protected' && !dismissed ? (
          <SimComplete
            title="Fork bomb contained"
            summary={`${method?.name ?? 'The protection'} stopped the fork bomb at ${PROTECTION_LIMIT} processes, below the system PID limit of ${pidLimit}, so the machine stayed up.`}
            stats={[
              { label: 'Contained at', value: String(PROTECTION_LIMIT), note: 'processes' },
              { label: 'Time', value: `${timeElapsed}s` },
              { label: 'Peak', value: String(peakProcesses), note: 'processes' },
              { label: 'PID limit', value: String(pidLimit) },
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
            columns="lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)_minmax(0,0.95fr)]"
            minHeight="min-h-[24rem]"
            tab={tab}
            onTabChange={(t) => setTab(t as Tab)}
            anchorRef={tabsRef}
            tabsLabel="Fork bomb panels"
            tabOrder={['stage', 'controls', 'learn']}
            panels={[
              { id: 'learn', label: 'How it works', content: learn },
              { id: 'stage', label: 'Simulation', content: simulation },
              {
                id: 'controls',
                label: 'Controls',
                content: controls('d'),
                mobile: controls('m'),
              },
            ]}
          />
        )}

        <SimPhoneBar>
          <span className="mr-auto font-mono text-xs tabular-nums text-muted-foreground">
            PID {activeCount} / {effectiveLimit}
          </span>
          {mainControl('h-10')}
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
