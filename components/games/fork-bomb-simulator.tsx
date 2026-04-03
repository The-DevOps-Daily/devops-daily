'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Play,
  Pause,
  RotateCcw,
  Cpu,
  MemoryStick,
  AlertTriangle,
  Info,
  Zap,
  Skull,
  TreePine,
  Activity,
  ShieldCheck,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Process {
  id: number;
  parentId: number | null;
  x: number;
  y: number;
  depth: number;
  spawned: number; // timestamp tick when spawned
  dead: boolean;
}

type SimState = 'idle' | 'running' | 'crashed' | 'protected';

const MAX_PID_LIMIT = 512;
const MEMORY_PER_PROCESS = 0.4; // MB per process
const TOTAL_MEMORY = 256; // MB simulated
const CPU_PER_PROCESS = 0.3; // % per process base

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
    effective: true,
  },
  {
    id: 'cgroup',
    name: 'cgroups',
    description: 'Kernel-level process limits',
    command: 'echo 100 > /sys/fs/cgroup/pids/user/pids.max',
    effective: true,
  },
  {
    id: 'systemd',
    name: 'systemd',
    description: 'TasksMax in unit files',
    command: 'TasksMax=100 in [Service]',
    effective: true,
  },
];

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
          ? 'bg-red-900/50'
          : process.depth === 0
            ? 'bg-red-500 shadow-lg shadow-red-500/50'
            : process.depth < 3
              ? 'bg-orange-500 shadow-md shadow-orange-500/30'
              : process.depth < 6
                ? 'bg-yellow-500'
                : 'bg-yellow-300/80'
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
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Icon className="w-3 h-3" />
          {label}
        </span>
        <span className={cn('font-mono', danger ? 'text-red-500 font-bold' : 'text-foreground')}>
          {value.toFixed(1)}{unit} / {max}{unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full transition-colors duration-300',
            pct > 90
              ? 'bg-red-500'
              : pct > 70
                ? 'bg-orange-500'
                : pct > 50
                  ? 'bg-yellow-500'
                  : 'bg-emerald-500'
          )}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}

export default function ForkBombSimulator() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [state, setState] = useState<SimState>('idle');
  const [tick, setTick] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [pidLimit, setPidLimit] = useState(MAX_PID_LIMIT);
  const [protection, setProtection] = useState<string | null>(null);
  const [highlightedPart, setHighlightedPart] = useState<number | null>(null);
  const [showExplainer, setShowExplainer] = useState(true);
  const [peakProcesses, setPeakProcesses] = useState(0);
  const [crashTick, setCrashTick] = useState<number | null>(null);
  const nextPid = useRef(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const effectiveLimit = protection ? 100 : pidLimit;

  const memoryUsed = processes.filter((p) => !p.dead).length * MEMORY_PER_PROCESS;
  const cpuUsage = Math.min(100, processes.filter((p) => !p.dead).length * CPU_PER_PROCESS);
  const activeCount = processes.filter((p) => !p.dead).length;

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProcesses([]);
    setState('idle');
    setTick(0);
    nextPid.current = 1;
    setPeakProcesses(0);
    setCrashTick(null);
  }, []);

  const spawnProcess = useCallback(
    (parentId: number | null, parentX: number, parentY: number, depth: number, currentTick: number): Process => {
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.max(2, 20 - depth * 2);
      const x = Math.max(2, Math.min(98, parentX + Math.cos(angle) * spread * (0.5 + Math.random())));
      const y = Math.max(2, Math.min(98, parentY + Math.sin(angle) * spread * (0.5 + Math.random())));

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
    setShowExplainer(false);
  }, [reset, spawnProcess]);

  // Main simulation loop
  useEffect(() => {
    if (state !== 'running') return;

    intervalRef.current = setInterval(() => {
      setTick((t) => t + 1);
      setProcesses((prev) => {
        const alive = prev.filter((p) => !p.dead);
        const currentTick = prev.length > 0 ? Math.max(...prev.map((p) => p.spawned)) + 1 : 1;

        if (alive.length >= effectiveLimit) {
          if (protection) {
            setState('protected');
          } else {
            setState('crashed');
            setCrashTick(currentTick);
          }
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prev;
        }

        // Each alive process tries to fork twice (: | : &)
        const newProcesses: Process[] = [];
        const maxNewPerTick = Math.min(alive.length * 2, effectiveLimit - alive.length);
        let spawned = 0;

        for (const proc of alive) {
          if (spawned >= maxNewPerTick) break;
          // Fork #1
          newProcesses.push(spawnProcess(proc.id, proc.x, proc.y, proc.depth + 1, currentTick));
          spawned++;
          if (spawned >= maxNewPerTick) break;
          // Fork #2
          newProcesses.push(spawnProcess(proc.id, proc.x, proc.y, proc.depth + 1, currentTick));
          spawned++;
        }

        const total = [...prev, ...newProcesses];
        const aliveCount = total.filter((p) => !p.dead).length;
        setPeakProcesses((peak) => Math.max(peak, aliveCount));
        return total;
      });
    }, Math.max(50, 300 / speed));

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state, speed, effectiveLimit, protection, spawnProcess]);

  const timeElapsed = (tick * (300 / speed) / 1000).toFixed(1);

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Zap className="w-6 h-6 text-red-500" />
          <h1 className="text-2xl md:text-3xl font-bold">Fork Bomb Simulator</h1>
          <Zap className="w-6 h-6 text-red-500" />
        </div>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto">
          Visualize how the infamous fork bomb works
          and why it crashes systems in seconds
        </p>
      </div>

      {/* Code Explainer */}
      <AnimatePresence>
        {showExplainer && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="border-red-500/20 bg-red-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-red-500" />
                  How the Fork Bomb Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-center gap-0.5 font-mono text-lg md:text-2xl">
                  {CODE_PARTS.map((part, i) => (
                    <span
                      key={i}
                      onMouseEnter={() => setHighlightedPart(i)}
                      onMouseLeave={() => setHighlightedPart(null)}
                      className={cn(
                        'cursor-help px-1 py-0.5 rounded transition-all duration-200',
                        highlightedPart === i
                          ? 'bg-red-500 text-white scale-110'
                          : 'text-red-500 hover:bg-red-500/10'
                      )}
                    >
                      {part.text}
                    </span>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  {highlightedPart !== null && (
                    <motion.p
                      key={highlightedPart}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-center text-sm text-muted-foreground"
                    >
                      {CODE_PARTS[highlightedPart].label}
                    </motion.p>
                  )}
                </AnimatePresence>
                <p className="text-xs text-muted-foreground text-center">
                  Hover over each part to see what it does. The function calls itself twice, piping to a background copy - exponential growth.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Visualization Panel */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div
                className={cn(
                  'relative w-full aspect-[4/3] overflow-hidden transition-colors duration-500',
                  state === 'crashed'
                    ? 'bg-red-950/80'
                    : state === 'protected'
                      ? 'bg-emerald-950/30'
                      : 'bg-background'
                )}
              >
                {/* Grid lines */}
                <div className="absolute inset-0 opacity-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={`h-${i}`} className="absolute w-full h-px bg-foreground" style={{ top: `${(i + 1) * 10}%` }} />
                  ))}
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={`v-${i}`} className="absolute h-full w-px bg-foreground" style={{ left: `${(i + 1) * 10}%` }} />
                  ))}
                </div>

                {/* Process nodes */}
                {processes.slice(-500).map((proc) => (
                  <ProcessNode key={proc.id} process={proc} tick={tick} />
                ))}

                {/* Idle state */}
                {state === 'idle' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <TreePine className="w-16 h-16 text-muted-foreground/30" />
                    <p className="text-muted-foreground/50 text-sm">Press Start to unleash the fork bomb</p>
                  </div>
                )}

                {/* Crash overlay */}
                <AnimatePresence>
                  {state === 'crashed' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/60 backdrop-blur-sm"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 0.5, repeat: 2 }}
                      >
                        <Skull className="w-20 h-20 text-red-500" />
                      </motion.div>
                      <p className="text-red-400 font-bold text-xl mt-4">SYSTEM CRASHED</p>
                      <p className="text-red-400/70 text-sm mt-1">
                        PID limit ({effectiveLimit}) reached in {timeElapsed}s
                      </p>
                      <p className="text-red-400/50 text-xs mt-1">
                        Peak: {peakProcesses} processes
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Protected overlay */}
                <AnimatePresence>
                  {state === 'protected' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950/60 backdrop-blur-sm"
                    >
                      <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                        <ShieldCheck className="w-20 h-20 text-emerald-500" />
                      </motion.div>
                      <p className="text-emerald-400 font-bold text-xl mt-4">SYSTEM PROTECTED</p>
                      <p className="text-emerald-400/70 text-sm mt-1">
                        Process limit enforced at 100 - system remains stable
                      </p>
                      <p className="text-emerald-400/50 text-xs mt-1">
                        Fork bomb contained after {timeElapsed}s
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Stats overlay */}
                {state === 'running' && (
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <Badge variant="outline" className="font-mono text-xs bg-background/80 backdrop-blur-sm">
                      PID: {activeCount} / {effectiveLimit}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-xs bg-background/80 backdrop-blur-sm">
                      {timeElapsed}s elapsed
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls Panel */}
        <div className="space-y-4">
          {/* Controls */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {state === 'idle' || state === 'crashed' || state === 'protected' ? (
                  <Button onClick={startSimulation} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                    <Play className="w-4 h-4 mr-1" />
                    {state === 'idle' ? 'Start' : 'Restart'}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setState('idle');
                      if (intervalRef.current) clearInterval(intervalRef.current);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    Pause
                  </Button>
                )}
                <Button onClick={reset} variant="outline" size="icon">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

              {/* Speed */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Speed: {speed}x</label>
                <input
                  type="range"
                  min={0.5}
                  max={4}
                  step={0.5}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full accent-red-500"
                  disabled={state === 'running'}
                />
              </div>

              {/* PID Limit */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">PID Limit: {pidLimit}</label>
                <input
                  type="range"
                  min={64}
                  max={1024}
                  step={64}
                  value={pidLimit}
                  onChange={(e) => setPidLimit(Number(e.target.value))}
                  className="w-full accent-red-500"
                  disabled={state === 'running'}
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setShowExplainer(!showExplainer)}
              >
                <Info className="w-3 h-3 mr-1" />
                {showExplainer ? 'Hide' : 'Show'} Code Explainer
              </Button>
            </CardContent>
          </Card>

          {/* System Resources */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4" />
                System Resources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
            </CardContent>
          </Card>

          {/* Protection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Protection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {PROTECTION_METHODS.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setProtection(protection === method.id ? null : method.id)}
                  disabled={state === 'running'}
                  className={cn(
                    'w-full text-left p-2 rounded-lg border text-xs transition-all',
                    protection === method.id
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-border hover:border-emerald-500/50',
                    state === 'running' && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="font-semibold">{method.name}</div>
                  <div className="text-muted-foreground">{method.description}</div>
                  <code className="text-[10px] text-emerald-500 mt-1 block">{method.command}</code>
                </button>
              ))}
              {protection && (
                <p className="text-[10px] text-emerald-500/70 text-center">
                  Process limit capped at 100 - fork bomb will be contained
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Growth Explanation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Why Fork Bombs Are Dangerous
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-1">
                <Zap className="w-4 h-4 text-red-500" />
                Exponential Growth
              </h3>
              <p className="text-muted-foreground">
                Each process spawns 2 more. After 10 iterations: 1,024 processes. After 20: over 1 million.
                Most systems hit their PID limit well before that.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-1">
                <Cpu className="w-4 h-4 text-orange-500" />
                Resource Exhaustion
              </h3>
              <p className="text-muted-foreground">
                Every process consumes CPU time, memory, and a process table entry.
                The kernel scheduler gets overwhelmed trying to context-switch between thousands of processes.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Prevention
              </h3>
              <p className="text-muted-foreground">
                Set process limits with <code className="text-xs bg-secondary px-1 rounded">ulimit -u</code>,
                use cgroups, or configure <code className="text-xs bg-secondary px-1 rounded">TasksMax</code> in
                systemd unit files. Most modern distros set sane defaults.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning */}
      <Alert className="border-red-500/30 bg-red-500/5">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <AlertDescription className="text-xs text-muted-foreground">
          <strong className="text-red-500">Warning:</strong> Never run a fork bomb on a real system.
          It will freeze the machine and require a hard reboot. This simulator safely visualizes the concept
          without actually forking any processes.
        </AlertDescription>
      </Alert>
    </div>
  );
}
