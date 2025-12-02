'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Sparkles, RotateCcw, HelpCircle, CheckCircle2, XCircle, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type TaintEffect = 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';

type NodeSpec = {
  id: string;
  name: string;
  capacity: { cpu: number; memory: number };
  taints?: Array<{ key: string; value?: string; effect: TaintEffect }>;
  labels?: Record<string, string>;
  zone?: string;
};

type PodSpec = {
  id: string;
  name: string;
  request: { cpu: number; memory: number };
  limit?: { cpu: number; memory: number };
  qos: 'Guaranteed' | 'Burstable' | 'BestEffort';
  labels?: Record<string, string>;
  tolerations?: Array<{
    key: string;
    operator?: 'Exists' | 'Equal';
    value?: string;
    effect?: TaintEffect;
  }>;
  nodeSelector?: Record<string, string>;
  affinity?: { requiredLabels?: Record<string, string> };
  antiAffinity?: { notWithNames?: string[]; notWithLabels?: Record<string, string> };
  topologySpread?: { key: 'topology.kubernetes.io/zone'; maxSkew: number };
};

type Placement = { podId: string; nodeId: string };

type ConstraintResult = { ok: boolean; errors: string[] };

type LevelSpec = {
  id: string;
  title: string;
  description: string;
  nodes: NodeSpec[];
  pods: PodSpec[];
  timeSec?: number;
  stars: { nodesUsedOptimal: number; timeBonusSec: number };
};

const INITIAL_LEVELS: LevelSpec[] = [
  {
    id: 'level-1',
    title: 'Level 1: Requests & Limits',
    description:
      'Place all Pods without exceeding node capacity. Learn requests and basic bin-packing.',
    nodes: [
      {
        id: 'node-a',
        name: 'node-a',
        zone: 'us-east-1a',
        capacity: { cpu: 2500, memory: 4096 },
        labels: { 'node-type': 'general' },
      },
      {
        id: 'node-b',
        name: 'node-b',
        zone: 'us-east-1b',
        capacity: { cpu: 2500, memory: 4096 },
        labels: { 'node-type': 'general' },
      },
    ],
    pods: [
      {
        id: 'api',
        name: 'api',
        request: { cpu: 1000, memory: 1024 },
        qos: 'Burstable',
        labels: { app: 'api' },
      },
      {
        id: 'web-1',
        name: 'web-1',
        request: { cpu: 600, memory: 512 },
        qos: 'Burstable',
        labels: { app: 'web' },
      },
      {
        id: 'web-2',
        name: 'web-2',
        request: { cpu: 600, memory: 512 },
        qos: 'Burstable',
        labels: { app: 'web' },
      },
      {
        id: 'db',
        name: 'db',
        request: { cpu: 1500, memory: 2048 },
        qos: 'Guaranteed',
        labels: { app: 'db' },
      },
      {
        id: 'cache',
        name: 'cache',
        request: { cpu: 500, memory: 1024 },
        qos: 'Burstable',
        labels: { app: 'cache' },
      },
    ],
    timeSec: 180,
    stars: { nodesUsedOptimal: 2, timeBonusSec: 60 },
  },
  {
    id: 'level-2',
    title: 'Level 2: Taints, Dedicated Nodes & Anti-Affinity',
    description:
      'Dedicated GPU and DB nodes require tolerations. Web replicas should not co-locate. Place trainer on GPU, DB on dedicated node.',
    nodes: [
      {
        id: 'node-a',
        name: 'node-a',
        zone: 'us-east-1a',
        capacity: { cpu: 2500, memory: 4096 },
        labels: { 'node-type': 'general' },
      },
      {
        id: 'node-b',
        name: 'node-b (gpu)',
        zone: 'us-east-1b',
        capacity: { cpu: 5000, memory: 8192 },
        labels: { 'node-type': 'gpu' },
        taints: [{ key: 'gpu', value: 'true', effect: 'NoSchedule' }],
      },
      {
        id: 'node-c',
        name: 'node-c (db)',
        zone: 'us-east-1c',
        capacity: { cpu: 2500, memory: 4096 },
        labels: { role: 'database' },
        taints: [{ key: 'dedicated', value: 'database', effect: 'NoSchedule' }],
      },
      {
        id: 'node-d',
        name: 'node-d',
        zone: 'us-east-1a',
        capacity: { cpu: 2500, memory: 4096 },
        labels: { 'node-type': 'general' },
      },
    ],
    pods: [
      {
        id: 'trainer',
        name: 'trainer',
        request: { cpu: 2000, memory: 3072 },
        qos: 'Burstable',
        labels: { app: 'trainer' },
        tolerations: [{ key: 'gpu', operator: 'Exists', effect: 'NoSchedule' }],
        nodeSelector: { 'node-type': 'gpu' },
      },
      {
        id: 'db',
        name: 'db',
        request: { cpu: 1500, memory: 2048 },
        qos: 'Guaranteed',
        labels: { app: 'db' },
        nodeSelector: { role: 'database' },
        tolerations: [{ key: 'dedicated', value: 'database', effect: 'NoSchedule' }],
      },
      {
        id: 'web-1',
        name: 'web-1',
        request: { cpu: 600, memory: 512 },
        qos: 'Burstable',
        labels: { app: 'web' },
        antiAffinity: { notWithLabels: { app: 'web' } },
      },
      {
        id: 'web-2',
        name: 'web-2',
        request: { cpu: 600, memory: 512 },
        qos: 'Burstable',
        labels: { app: 'web' },
        antiAffinity: { notWithLabels: { app: 'web' } },
      },
      {
        id: 'api',
        name: 'api',
        request: { cpu: 800, memory: 1024 },
        qos: 'Burstable',
        labels: { app: 'api' },
      },
    ],
    timeSec: 210,
    stars: { nodesUsedOptimal: 3, timeBonusSec: 60 },
  },
  {
    id: 'level-3',
    title: 'Level 3: Node Selectors & Affinity',
    description: 'Match pods to correct hardware with node selectors and required affinity labels.',
    nodes: [
      {
        id: 'node-a',
        name: 'node-a',
        zone: 'us-east-1a',
        capacity: { cpu: 2500, memory: 4096 },
        labels: { disk: 'ssd', arch: 'amd64' },
      },
      {
        id: 'node-b',
        name: 'node-b',
        zone: 'us-east-1b',
        capacity: { cpu: 2500, memory: 4096 },
        labels: { disk: 'hdd', arch: 'arm64' },
      },
      {
        id: 'node-c',
        name: 'node-c',
        zone: 'us-east-1c',
        capacity: { cpu: 2500, memory: 4096 },
        labels: { disk: 'ssd', arch: 'arm64' },
      },
    ],
    pods: [
      {
        id: 'search',
        name: 'search',
        request: { cpu: 1200, memory: 1024 },
        qos: 'Burstable',
        labels: { app: 'search' },
        nodeSelector: { disk: 'ssd' },
      },
      {
        id: 'etl',
        name: 'etl',
        request: { cpu: 1000, memory: 1024 },
        qos: 'Burstable',
        labels: { app: 'etl' },
        affinity: { requiredLabels: { arch: 'amd64' } },
      },
      {
        id: 'api',
        name: 'api',
        request: { cpu: 800, memory: 1024 },
        qos: 'Burstable',
        labels: { app: 'api' },
      },
      {
        id: 'worker',
        name: 'worker',
        request: { cpu: 1000, memory: 512 },
        qos: 'BestEffort',
        labels: { app: 'worker' },
      },
    ],
    timeSec: 210,
    stars: { nodesUsedOptimal: 3, timeBonusSec: 50 },
  },
  {
    id: 'level-4',
    title: 'Level 4: Topology Spread Across Zones',
    description: 'Distribute replicas evenly across zones (max skew 1).',
    nodes: [
      {
        id: 'node-a',
        name: 'node-a',
        zone: 'us-east-1a',
        capacity: { cpu: 2500, memory: 4096 },
        labels: { 'node-type': 'general' },
      },
      {
        id: 'node-b',
        name: 'node-b',
        zone: 'us-east-1b',
        capacity: { cpu: 2500, memory: 4096 },
        labels: { 'node-type': 'general' },
      },
      {
        id: 'node-c',
        name: 'node-c',
        zone: 'us-east-1c',
        capacity: { cpu: 2500, memory: 4096 },
        labels: { 'node-type': 'general' },
      },
    ],
    pods: [
      {
        id: 'api-1',
        name: 'api-1',
        request: { cpu: 700, memory: 512 },
        qos: 'Burstable',
        labels: { app: 'api' },
        topologySpread: { key: 'topology.kubernetes.io/zone', maxSkew: 1 },
      },
      {
        id: 'api-2',
        name: 'api-2',
        request: { cpu: 700, memory: 512 },
        qos: 'Burstable',
        labels: { app: 'api' },
        topologySpread: { key: 'topology.kubernetes.io/zone', maxSkew: 1 },
      },
      {
        id: 'api-3',
        name: 'api-3',
        request: { cpu: 700, memory: 512 },
        qos: 'Burstable',
        labels: { app: 'api' },
        topologySpread: { key: 'topology.kubernetes.io/zone', maxSkew: 1 },
      },
      {
        id: 'api-4',
        name: 'api-4',
        request: { cpu: 700, memory: 512 },
        qos: 'Burstable',
        labels: { app: 'api' },
        topologySpread: { key: 'topology.kubernetes.io/zone', maxSkew: 1 },
      },
    ],
    timeSec: 180,
    stars: { nodesUsedOptimal: 3, timeBonusSec: 45 },
  },
];

function getAllocatedForNode(nodeId: string, placements: Placement[], pods: PodSpec[]) {
  return placements
    .filter((p) => p.nodeId === nodeId)
    .reduce(
      (totals, p) => {
        const pod = pods.find((pp) => pp.id === p.podId);
        if (!pod) return totals;
        return {
          cpu: totals.cpu + (pod.request.cpu || 0),
          memory: totals.memory + (pod.request.memory || 0),
        };
      },
      { cpu: 0, memory: 0 }
    );
}

function labelsMatch(
  selector: Record<string, string> | undefined,
  labels: Record<string, string> | undefined
) {
  if (!selector) return true;
  if (!labels) return false;
  return Object.entries(selector).every(([k, v]) => labels[k] === v);
}

function hasTolerationForTaint(
  pod: PodSpec,
  taint: { key: string; value?: string; effect: TaintEffect }
) {
  const tolerations = pod.tolerations || [];
  return tolerations.some((tol) => {
    if (tol.key !== taint.key) return false;
    if (tol.operator === 'Exists') return true;
    if (tol.operator === 'Equal' || !tol.operator) {
      return (tol.value ?? '') === (taint.value ?? '');
    }
    return false;
  });
}

function validatePlacement(
  pod: PodSpec,
  node: NodeSpec,
  currentPlacements: Placement[],
  specs: { pods: PodSpec[]; nodes: NodeSpec[] }
): ConstraintResult {
  const errors: string[] = [];

  // Capacity
  const allocated = getAllocatedForNode(node.id, currentPlacements, specs.pods);
  if (allocated.cpu + pod.request.cpu > node.capacity.cpu) {
    errors.push('Exceeds CPU capacity');
  }
  if (allocated.memory + pod.request.memory > node.capacity.memory) {
    errors.push('Exceeds Memory capacity');
  }

  // Taints & Tolerations
  for (const taint of node.taints || []) {
    if (taint.effect === 'NoSchedule' && !hasTolerationForTaint(pod, taint)) {
      errors.push(`Node taint ${taint.key}=${taint.value ?? ''} requires toleration`);
    }
  }

  // NodeSelector
  if (!labelsMatch(pod.nodeSelector, node.labels)) {
    errors.push('NodeSelector labels not satisfied');
  }

  // Affinity (basic requiredLabels)
  if (pod.affinity?.requiredLabels && !labelsMatch(pod.affinity.requiredLabels, node.labels)) {
    errors.push('Affinity required labels not satisfied');
  }

  // Anti-Affinity (names)
  if (pod.antiAffinity?.notWithNames?.length) {
    const nodePods = currentPlacements.filter((p) => p.nodeId === node.id).map((p) => p.podId);
    if (nodePods.some((np) => pod.antiAffinity!.notWithNames!.includes(np))) {
      errors.push('Anti-affinity: conflicting pod present on node');
    }
  }

  // Anti-Affinity (labels) - simple same-node check
  if (pod.antiAffinity?.notWithLabels) {
    const nodePodObjs = currentPlacements
      .filter((p) => p.nodeId === node.id)
      .map((p) => specs.pods.find((pp) => pp.id === p.podId))
      .filter((pp): pp is PodSpec => Boolean(pp));
    const required = pod.antiAffinity.notWithLabels;
    for (const other of nodePodObjs) {
      const match = Object.entries(required).every(([k, v]) => other.labels?.[k] === v);
      if (match) {
        errors.push('Anti-affinity (labels): avoid co-locating similar pods');
        break;
      }
    }
  }

  // Topology spread (zone)
  if (pod.topologySpread) {
    const zones = new Map<string, number>();
    for (const n of specs.nodes) zones.set(n.zone || 'unknown', 0);
    for (const place of currentPlacements) {
      const n = specs.nodes.find((nn) => nn.id === place.nodeId);
      if (!n) continue;
      const z = n.zone || 'unknown';
      zones.set(z, (zones.get(z) || 0) + 1);
    }
    const zoneCounts = Array.from(zones.values());
    const min = Math.min(...zoneCounts);
    const z = node.zone || 'unknown';
    const nextCount = (zones.get(z) || 0) + 1;
    const maxSkew = pod.topologySpread.maxSkew;
    const newMax = Math.max(nextCount, ...zoneCounts);
    const newMin = Math.min(min, nextCount);
    if (newMax - newMin > maxSkew) {
      errors.push(`Topology spread skew > ${maxSkew}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function qosBadgeColor(qos: PodSpec['qos']) {
  switch (qos) {
    case 'Guaranteed':
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/30';
    case 'Burstable':
      return 'bg-blue-500/10 text-blue-700 border-blue-500/30 dark:bg-blue-400/10 dark:text-blue-300 dark:border-blue-400/30';
    case 'BestEffort':
      return 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/30';
    default:
      return 'bg-secondary text-secondary-foreground';
  }
}

export default function K8sScheduler() {
  const [levelIndex, setLevelIndex] = useState(0);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [secondsLeft, setSecondsLeft] = useState<number | undefined>(INITIAL_LEVELS[0].timeSec);
  const [victory, setVictory] = useState(false);
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [podSheetOpen, setPodSheetOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const level = INITIAL_LEVELS[levelIndex];

  // Start/Reset timer when level changes
  useMemo(() => {
    if (timerRef.current) clearInterval(timerRef.current as unknown as number);
    if (typeof level.timeSec === 'number') {
      setSecondsLeft(level.timeSec);
      const id = setInterval(() => {
        setSecondsLeft((s) => (typeof s === 'number' && s > 0 ? s - 1 : 0));
      }, 1000);
      timerRef.current = id as unknown as NodeJS.Timeout;
    } else {
      setSecondsLeft(undefined);
    }
    setPlacements([]);
    setSelectedPodId(null);
    setErrors([]);
    setVictory(false);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current as unknown as number);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelIndex]);

  const unplacedPods = useMemo(() => {
    const placedIds = new Set(placements.map((p) => p.podId));
    return level.pods.filter((p) => !placedIds.has(p.id));
  }, [placements, level.pods]);

  const nodesWithUsage = useMemo(() => {
    return level.nodes.map((n) => {
      const alloc = getAllocatedForNode(n.id, placements, level.pods);
      return { node: n, used: alloc };
    });
  }, [placements, level.nodes, level.pods]);

  const allPlaced = unplacedPods.length === 0;

  // Victory detection
  useMemo(() => {
    if (allPlaced && !victory) {
      setVictory(true);
      if (timerRef.current) clearInterval(timerRef.current as unknown as number);
    }
  }, [allPlaced, victory]);

  function tryPlace(podId: string, nodeId: string) {
    if (placements.some((p) => p.podId === podId)) {
      setErrors(['Pod already placed. Tap it on a node to remove, then place again.']);
      return;
    }
    const pod = level.pods.find((p) => p.id === podId)!;
    const node = level.nodes.find((n) => n.id === nodeId)!;
    const result = validatePlacement(pod, node, placements, {
      pods: level.pods,
      nodes: level.nodes,
    });
    if (result.ok) {
      setPlacements((prev) => [...prev, { podId, nodeId }]);
      setErrors([]);
      setSelectedPodId(null);
    } else {
      setErrors(result.errors);
    }
  }

  function removePlacement(podId: string) {
    setPlacements((prev) => prev.filter((p) => p.podId !== podId));
    setErrors([]);
    setVictory(false);
  }

  function resetLevel() {
    setPlacements([]);
    setSelectedPodId(null);
    setErrors([]);
    setVictory(false);
    if (typeof level.timeSec === 'number') setSecondsLeft(level.timeSec);
  }

  function nextLevel() {
    if (levelIndex < INITIAL_LEVELS.length - 1) {
      setLevelIndex((i) => i + 1);
    } else {
      // loop
      setLevelIndex(0);
    }
  }

  // Scoring
  const nodesUsed = useMemo(() => new Set(placements.map((p) => p.nodeId)).size, [placements]);
  const starCount = useMemo(() => {
    let stars = 1;
    if (allPlaced) stars = 1;
    const optimal = level.stars.nodesUsedOptimal;
    if (allPlaced && nodesUsed <= optimal + 0) stars = 2;
    if (allPlaced && nodesUsed <= optimal && (secondsLeft ?? 0) >= level.stars.timeBonusSec)
      stars = 3;
    return stars;
  }, [allPlaced, nodesUsed, level.stars, secondsLeft]);

  // Layout helpers
  const isSelected = (id: string) => selectedPodId === id;
  const selectPod = (id: string) => {
    setSelectedPodId((cur) => (cur === id ? null : id));
    setPodSheetOpen(true);
  };

  function useWindowSizeLocal() {
    const [size, setSize] = useState({ width: 0, height: 0 });
    useEffect(() => {
      const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
      onResize();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, []);
    return size;
  }
  const { width, height } = useWindowSizeLocal();

  return (
    <div className="w-full">
      <div className="w-full mb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-linear-to-r from-sky-500/10 to-cyan-500/10 border border-sky-500/20">
          <Sparkles className="w-4 h-4 text-sky-500" />
          <span className="text-sm text-muted-foreground">{level.title}</span>
        </div>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">{level.description}</p>
      </div>

      {/* Top stats row: Time and Score (independent of pods/nodes) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Time</span>
            <Badge variant="outline">
              {typeof secondsLeft === 'number' ? `${secondsLeft}s` : 'Free Play'}
            </Badge>
          </div>
          {typeof secondsLeft === 'number' && (
            <div className="mt-3">
              <Progress value={Math.max(0, ((secondsLeft ?? 0) / (level.timeSec || 1)) * 100)} />
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Score</span>
            <div className="flex gap-1">
              {[1, 2, 3].map((s) => (
                <Award
                  key={s}
                  className={cn(
                    'w-4 h-4',
                    s <= starCount ? 'text-yellow-500' : 'text-muted-foreground/40'
                  )}
                />
              ))}
            </div>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">Nodes used: {nodesUsed}</div>
        </Card>
      </div>

      {/* Layout grid: left (pods), right (board) */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-4 items-start">
        {/* Left column: pods & details */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Remaining Pods</span>
            <Badge variant="secondary">{unplacedPods.length}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {unplacedPods.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPod(p.id)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/podId', p.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setSelectedPodId(p.id);
                }}
                onDragEnd={() => setDragOverNodeId(null)}
                className={cn(
                  'px-3 py-1 rounded-full border text-sm transition-colors cursor-grab active:cursor-grabbing select-none touch-none',
                  qosBadgeColor(p.qos),
                  isSelected(p.id) && 'ring-2 ring-offset-2 ring-sky-400'
                )}
                aria-pressed={isSelected(p.id)}
              >
                {p.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {p.request.cpu}m / {p.request.memory}Mi
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 overflow-auto rounded-lg border bg-muted/30 p-3">
            {selectedPodId ? (
              (() => {
                const pod = level.pods.find((pp) => pp.id === selectedPodId)!;
                return (
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="font-medium">Selected: {pod.name}</div>
                      <Badge className={cn('text-xs', qosBadgeColor(pod.qos))}>{pod.qos}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Requests: {pod.request.cpu}m CPU, {pod.request.memory}Mi Mem
                    </div>
                    {(pod.nodeSelector || pod.tolerations || pod.affinity || pod.antiAffinity) && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {pod.nodeSelector && (
                          <Badge variant="outline">
                            selector:{' '}
                            {Object.entries(pod.nodeSelector)
                              .map(([k, v]) => `${k}=${v}`)
                              .join(', ')}
                          </Badge>
                        )}
                        {pod.tolerations && pod.tolerations.length > 0 && (
                          <Badge variant="outline">tolerations: {pod.tolerations.length}</Badge>
                        )}
                        {pod.affinity?.requiredLabels && (
                          <Badge variant="outline">affinity: required labels</Badge>
                        )}
                        {pod.antiAffinity?.notWithNames &&
                          pod.antiAffinity.notWithNames.length > 0 && (
                            <Badge variant="outline">
                              anti-affinity: {pod.antiAffinity.notWithNames.length}
                            </Badge>
                          )}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="text-xs text-muted-foreground">
                Tap a pod to see constraints and node compatibility.
              </div>
            )}
          </div>
        </Card>
        {/* Board to the right on desktop */}
        <div className="sm:col-start-2 -mt-4 sm:mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 select-none">
            {nodesWithUsage.map(({ node, used }) => {
              const cpuPct = Math.min(100, Math.round((used.cpu / node.capacity.cpu) * 100));
              const memPct = Math.min(100, Math.round((used.memory / node.capacity.memory) * 100));
              const nodePods = placements
                .filter((p) => p.nodeId === node.id)
                .map((p) => level.pods.find((pp) => pp.id === p.podId))
                .filter((p): p is PodSpec => Boolean(p));
              return (
                <Card key={node.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{node.name}</div>
                      <div className="text-xs text-muted-foreground">
                        zone: {node.zone || 'unknown'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(node.taints || []).map((t, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          taint: {t.key}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs mb-1 text-muted-foreground">
                        CPU {used.cpu}m / {node.capacity.cpu}m
                      </div>
                      <div className="h-2 rounded bg-muted overflow-hidden relative">
                        <div
                          className="h-full bg-linear-to-r from-sky-500 to-cyan-500 dark:from-sky-400 dark:to-cyan-400"
                          style={{ width: `${cpuPct}%` }}
                        />
                        {selectedPodId && (
                          <div
                            className="absolute inset-y-0 left-0 h-2 bg-sky-500/30 dark:bg-sky-400/25"
                            style={{
                              width: `${Math.min(100, Math.round(((used.cpu + (level.pods.find((pp) => pp.id === selectedPodId)?.request.cpu || 0)) / node.capacity.cpu) * 100))}%`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs mb-1 text-muted-foreground">
                        Mem {used.memory}Mi / {node.capacity.memory}Mi
                      </div>
                      <div className="h-2 rounded bg-muted overflow-hidden relative">
                        <div
                          className="h-full bg-linear-to-r from-fuchsia-500 to-pink-500 dark:from-fuchsia-400 dark:to-pink-400"
                          style={{ width: `${memPct}%` }}
                        />
                        {selectedPodId && (
                          <div
                            className="absolute inset-y-0 left-0 h-2 bg-pink-500/30 dark:bg-pink-400/25"
                            style={{
                              width: `${Math.min(100, Math.round(((used.memory + (level.pods.find((pp) => pp.id === selectedPodId)?.request.memory || 0)) / node.capacity.memory) * 100))}%`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Drop zone */}
                  <div
                    className={cn(
                      'mt-4',
                      (selectedPodId || dragOverNodeId === node.id) &&
                        'outline outline-1 outline-muted/40 rounded-lg outline-offset-2',
                      dragOverNodeId === node.id && 'outline-2 outline-sky-400'
                    )}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverNodeId(node.id);
                    }}
                    onDragLeave={() => setDragOverNodeId((cur) => (cur === node.id ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const podId = e.dataTransfer.getData('text/podId');
                      setDragOverNodeId(null);
                      if (podId) tryPlace(podId, node.id);
                    }}
                  >
                    <div className="text-xs text-muted-foreground mb-2">Placed Pods</div>
                    <div className="flex flex-wrap gap-2 min-h-[48px]">
                      {nodePods.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => removePlacement(p.id)}
                          title="Remove from node"
                          className={cn(
                            'px-3 py-1 rounded-full border text-sm select-none hover:opacity-90 transition',
                            qosBadgeColor(p.qos)
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tap-to-place area for mobile */}
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={!selectedPodId}
                      onClick={() => selectedPodId && tryPlace(selectedPodId, node.id)}
                    >
                      {selectedPodId
                        ? `Place "${level.pods.find((p) => p.id === selectedPodId)?.name}" on ${node.name}`
                        : 'Select a Pod to place'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Errors */}
      <AnimatePresence initial={false}>
        {errors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-700">
              <div className="flex items-center gap-2 font-medium">
                <XCircle className="w-4 h-4" />
                Invalid placement
              </div>
              <ul className="mt-2 pl-5 list-disc text-sm">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer controls */}
      <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={resetLevel}>
            <RotateCcw className="w-4 h-4 mr-2" /> Reset Level
          </Button>
          <Button variant="ghost" onClick={() => setShowHowTo(true)}>
            <HelpCircle className="w-4 h-4 mr-2" /> How to play
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap w-full md:w-auto">
          <Button variant="outline" onClick={() => setLevelIndex(0)} disabled={levelIndex === 0}>
            Level 1
          </Button>
          <Button variant="outline" onClick={() => setLevelIndex(1)} disabled={levelIndex === 1}>
            Level 2
          </Button>
          <Button variant="outline" onClick={() => setLevelIndex(2)} disabled={levelIndex === 2}>
            Level 3
          </Button>
          <Button onClick={nextLevel} disabled={!allPlaced} className="w-full sm:w-auto">
            {allPlaced ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Next Level
              </>
            ) : (
              'Place all Pods to continue'
            )}
          </Button>
        </div>
      </div>

      {/* Victory */}
      <AnimatePresence>
        {victory && (
          <div className="fixed inset-x-0 bottom-6 z-50 mx-auto w-[calc(100%-2rem)] md:w-auto">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <div className="mx-auto max-w-xl p-4 rounded-xl border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 shadow-lg">
                <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-5 h-5" /> Level complete!
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Nodes used: {nodesUsed} • Stars: {starCount}/3
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={resetLevel}>
                      Replay
                    </Button>
                    <Button size="sm" onClick={nextLevel}>
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confetti */}
      <AnimatePresence>
        {victory && <Confetti width={width} height={height} numberOfPieces={220} recycle={false} />}
      </AnimatePresence>

      {/* How to play dialog */}
      <Dialog open={showHowTo} onOpenChange={setShowHowTo}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>How to play</DialogTitle>
            <DialogDescription>
              Place all Pods onto Nodes without breaking Kubernetes scheduling rules.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium">1. Select a Pod</span>
              <div className="text-muted-foreground">Tap a pod, or drag it on desktop.</div>
            </div>
            <div>
              <span className="font-medium">2. Pick a Node</span>
              <div className="text-muted-foreground">
                Nodes highlight green/red to show whether placement is allowed. Capacity bars show a
                light preview of resources after placement.
              </div>
            </div>
            <div>
              <span className="font-medium">3. Follow the rules</span>
              <ul className="mt-1 list-disc list-inside text-muted-foreground">
                <li>Do not exceed CPU/Memory capacity.</li>
                <li>Match taints with tolerations when required.</li>
                <li>Respect node selectors and affinity/anti-affinity.</li>
                <li>Keep topology spread balanced across zones.</li>
              </ul>
            </div>
            <div>
              <span className="font-medium">Pro tips</span>
              <ul className="mt-1 list-disc list-inside text-muted-foreground">
                <li>Tap a placed pod to remove it.</li>
                <li>Use fewer nodes and finish faster for more stars.</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
