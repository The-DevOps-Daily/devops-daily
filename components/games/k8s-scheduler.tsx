'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Boxes, CircleCheck, CircleX, Star, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SIM_CATEGORY,
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimHowTo,
  SimResetButton,
  SimStage,
  revealTop,
} from '@/components/games/sim';

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
        limit: { cpu: 1500, memory: 2048 },
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
        limit: { cpu: 1500, memory: 2048 },
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
        qos: 'Burstable',
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

  // Topology spread (zone): count only pods matching the selector (the pod's own labels),
  // then require matching pods in this zone + 1 - global minimum <= maxSkew
  if (pod.topologySpread) {
    const zones = new Map<string, number>();
    for (const n of specs.nodes) zones.set(n.zone || 'unknown', 0);
    for (const place of currentPlacements) {
      const n = specs.nodes.find((nn) => nn.id === place.nodeId);
      const other = specs.pods.find((pp) => pp.id === place.podId);
      if (!n || !other || !labelsMatch(pod.labels, other.labels)) continue;
      const z = n.zone || 'unknown';
      zones.set(z, (zones.get(z) || 0) + 1);
    }
    const globalMin = Math.min(...Array.from(zones.values()));
    const z = node.zone || 'unknown';
    const maxSkew = pod.topologySpread.maxSkew;
    if ((zones.get(z) || 0) + 1 - globalMin > maxSkew) {
      errors.push(`Topology spread skew > ${maxSkew}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function qosBadgeColor(qos: PodSpec['qos']) {
  switch (qos) {
    case 'Guaranteed':
      return `${SIM_CATEGORY.emerald.fill} ${SIM_CATEGORY.emerald.border} text-emerald-800 dark:text-emerald-300`;
    case 'Burstable':
      return `${SIM_CATEGORY.sky.fill} ${SIM_CATEGORY.sky.border} text-sky-800 dark:text-sky-300`;
    case 'BestEffort':
      return `${SIM_CATEGORY.violet.fill} ${SIM_CATEGORY.violet.border} text-violet-800 dark:text-violet-300`;
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
  const [best, setBest] = useState<Record<number, number>>({});
  const [dismissed, setDismissed] = useState(false);
  const [tab, setTab] = useState<'board' | 'pod'>('board');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [tabsAnchor, setTabsAnchor] = useState<HTMLDivElement | null>(null);

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

  if (victory && allPlaced && (best[levelIndex] ?? 0) < starCount)
    setBest({ ...best, [levelIndex]: starCount });

  const cleared = INITIAL_LEVELS.filter((_, i) => best[i] !== undefined).length;
  const allCleared = cleared === INITIAL_LEVELS.length;
  const totalStars = Object.values(best).reduce((total, stars) => total + stars, 0);
  const levelTitle = level.title.replace(/^Level \d+: /, '');

  useEffect(() => {
    if (!victory) return;
    requestAnimationFrame(() => resultRef.current?.focus({ preventScroll: true }));
  }, [victory]);

  const isSelected = (id: string) => selectedPodId === id;
  const selectPod = (id: string) => {
    setSelectedPodId((cur) => (cur === id ? null : id));
    if (!window.matchMedia('(min-width: 1024px)').matches) setTab('board');
  };

  function startOver() {
    setBest({});
    setDismissed(false);
    setLevelIndex(0);
    resetLevel();
  }

  const remainingPods = (
    <section className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Pods to place</h3>
        <Badge variant="secondary">{unplacedPods.length}</Badge>
      </div>
      {unplacedPods.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {unplacedPods.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPod(p.id)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/podId', p.id);
                e.dataTransfer.effectAllowed = 'move';
                setSelectedPodId(p.id);
              }}
              onDragEnd={() => setDragOverNodeId(null)}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm lg:min-h-8',
                qosBadgeColor(p.qos),
                isSelected(p.id) && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
              )}
              aria-pressed={isSelected(p.id)}
            >
              <span>{p.name}</span>
              <span className="font-mono text-xs">
                {p.request.cpu}m / {p.request.memory}Mi
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">All pods placed.</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Colour shows the QoS class:{' '}
        <span className="text-emerald-800 dark:text-emerald-300">Guaranteed</span>,{' '}
        <span className="text-sky-800 dark:text-sky-300">Burstable</span>,{' '}
        <span className="text-violet-800 dark:text-violet-300">BestEffort</span>.
      </p>
    </section>
  );

  const selectedPodPanel = (
    <section className="rounded-lg border bg-card p-3 text-sm">
      {selectedPodId ? (
        (() => {
          const pod = level.pods.find((pp) => pp.id === selectedPodId)!;
          return (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Selected: {pod.name}</h3>
                <Badge className={cn('text-xs', qosBadgeColor(pod.qos))}>{pod.qos}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Requests: {pod.request.cpu}m CPU, {pod.request.memory}Mi Mem
              </p>
              <p className="text-xs text-muted-foreground">
                {pod.limit
                  ? `Limits: ${pod.limit.cpu}m CPU, ${pod.limit.memory}Mi Mem`
                  : 'Limits: none'}
              </p>
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
                  {pod.antiAffinity?.notWithNames && pod.antiAffinity.notWithNames.length > 0 && (
                    <Badge variant="outline">
                      anti-affinity: {pod.antiAffinity.notWithNames.length}
                    </Badge>
                  )}
                </div>
              )}
            </>
          );
        })()
      ) : (
        <p className="text-xs text-muted-foreground">
          Select a pod to see its constraints and where it fits.
        </p>
      )}
    </section>
  );

  const feedback =
    errors.length > 0 ? (
      <SimFeedback tone="danger" label="Can't place it here" role="alert">
        <ul className="list-disc pl-5">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </SimFeedback>
    ) : victory ? (
      <SimFeedback ref={resultRef} tabIndex={-1} tone="success" label="Level cleared">
        <p>
          Nodes used: {nodesUsed}. Stars: {starCount} of 3.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 lg:h-8"
            onClick={resetLevel}
          >
            Replay
          </Button>
          {levelIndex < INITIAL_LEVELS.length - 1 ? (
            <Button type="button" size="sm" className="h-10 lg:h-8" onClick={nextLevel}>
              Next level
            </Button>
          ) : (
            (() => {
              const nextUncleared = INITIAL_LEVELS.findIndex(
                (_, index) => best[index] === undefined
              );
              return nextUncleared >= 0 ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-10 lg:h-8"
                  onClick={() => setLevelIndex(nextUncleared)}
                >
                  Go to level {nextUncleared + 1}
                </Button>
              ) : null;
            })()
          )}
        </div>
      </SimFeedback>
    ) : selectedPodId ? (
      <SimFeedback
        tone="hint"
        label={`Placing ${level.pods.find((p) => p.id === selectedPodId)?.name}`}
      >
        <p>Pick a node that shows Fits.</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 lg:h-8"
          onClick={() => setSelectedPodId(null)}
        >
          Cancel
        </Button>
      </SimFeedback>
    ) : null;

  const nodeGrid = (
    <div className="grid gap-2 md:grid-cols-2">
      {nodesWithUsage.map(({ node, used }) => {
        const cpuPct = Math.min(100, Math.round((used.cpu / node.capacity.cpu) * 100));
        const memPct = Math.min(100, Math.round((used.memory / node.capacity.memory) * 100));
        const nodePods = placements
          .filter((p) => p.nodeId === node.id)
          .map((p) => level.pods.find((pp) => pp.id === p.podId))
          .filter((p): p is PodSpec => Boolean(p));
        const selectedPod = unplacedPods.find((p) => p.id === selectedPodId);
        const fit = selectedPod
          ? validatePlacement(selectedPod, node, placements, {
              pods: level.pods,
              nodes: level.nodes,
            })
          : null;
        return (
          <section
            key={node.id}
            className={cn(
              'space-y-2.5 rounded-lg border bg-card p-3',
              fit?.ok && 'border-correct/60',
              fit && !fit.ok && 'border-wrong/60'
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{node.name}</h3>
                <p className="text-xs text-muted-foreground">zone: {node.zone || 'unknown'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {(node.taints || []).map((taint, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    taint: {taint.key}
                  </Badge>
                ))}
                {fit && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold',
                      fit.ok
                        ? `${SIM_TONE.success.surface} ${SIM_TONE.success.text}`
                        : `${SIM_TONE.danger.surface} ${SIM_TONE.danger.text}`
                    )}
                  >
                    {fit.ok ? (
                      <CircleCheck className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <CircleX className="h-4 w-4" aria-hidden="true" />
                    )}
                    {fit.ok ? 'Fits' : 'Does not fit'}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs tabular-nums text-muted-foreground">
                  CPU {used.cpu}m / {node.capacity.cpu}m
                </p>
                <div className="relative h-2 overflow-hidden rounded bg-muted">
                  {selectedPodId && (
                    <div
                      className="absolute inset-y-0 left-0 bg-sky-500/30"
                      style={{
                        width: `${Math.min(100, Math.round(((used.cpu + (level.pods.find((pp) => pp.id === selectedPodId)?.request.cpu || 0)) / node.capacity.cpu) * 100))}%`,
                      }}
                    />
                  )}
                  <div className="relative h-full bg-sky-500" style={{ width: `${cpuPct}%` }} />
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs tabular-nums text-muted-foreground">
                  Mem {used.memory}Mi / {node.capacity.memory}Mi
                </p>
                <div className="relative h-2 overflow-hidden rounded bg-muted">
                  {selectedPodId && (
                    <div
                      className="absolute inset-y-0 left-0 bg-violet-500/30"
                      style={{
                        width: `${Math.min(100, Math.round(((used.memory + (level.pods.find((pp) => pp.id === selectedPodId)?.request.memory || 0)) / node.capacity.memory) * 100))}%`,
                      }}
                    />
                  )}
                  <div className="relative h-full bg-violet-500" style={{ width: `${memPct}%` }} />
                </div>
              </div>
            </div>

            <div
              className={cn(
                'rounded-lg',
                (selectedPodId || dragOverNodeId === node.id) &&
                  'outline outline-1 outline-muted/40 outline-offset-2',
                dragOverNodeId === node.id && 'outline-2 outline-primary'
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
              <div className="flex min-h-8 flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Placed pods{nodePods.length === 0 && ': none yet'}
                </span>
                {nodePods.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => removePlacement(p.id)}
                    aria-label={`Remove ${p.name} from ${node.name}`}
                    className={cn(
                      'min-h-10 rounded-full border px-3 text-sm lg:min-h-8',
                      qosBadgeColor(p.qos)
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 w-full lg:h-8"
              disabled={!selectedPodId}
              onClick={() => selectedPodId && tryPlace(selectedPodId, node.id)}
            >
              {selectedPodId
                ? `Place "${level.pods.find((p) => p.id === selectedPodId)?.name}" on ${node.name}`
                : 'Select a pod to place'}
            </Button>
          </section>
        );
      })}
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame>
        <SimBar
          title="Kubernetes Scheduler Challenge"
          icon={Boxes}
          steps={INITIAL_LEVELS.map((item, index) => ({
            title: item.title.replace(/^Level \d+: /, ''),
            status:
              best[index] === 3
                ? 'perfect'
                : best[index] !== undefined
                  ? 'done'
                  : index === levelIndex && placements.length > 0
                    ? 'started'
                    : 'todo',
            statusLabel:
              best[index] !== undefined
                ? `cleared, ${best[index]} of 3 stars`
                : index === levelIndex && placements.length > 0
                  ? 'in progress'
                  : 'not cleared',
          }))}
          current={levelIndex}
          onStep={(index) => setLevelIndex(index)}
          stepNoun="Level"
          stepsLabel="Levels"
          tools={
            <SimResetButton onReset={resetLevel} label="Reset level" confirmLabel="Reset level?" />
          }
          progress={{ current: levelIndex + 1, total: INITIAL_LEVELS.length }}
          heading={levelTitle}
          meta={
            <>
              <Badge variant="outline" className="tabular-nums">
                <Timer className="mr-1 h-4 w-4" aria-hidden="true" />
                {typeof secondsLeft === 'number' ? `${secondsLeft}s` : 'Free play'}
              </Badge>
              <span className="flex gap-0.5">
                <span className="sr-only">{starCount} of 3 stars</span>
                {[1, 2, 3].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      'h-4 w-4',
                      star <= starCount ? 'fill-primary text-primary' : 'text-muted-foreground/40'
                    )}
                    aria-hidden="true"
                  />
                ))}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                Nodes used: {nodesUsed}
              </span>
            </>
          }
          goal={level.description}
        >
          <SimHowTo summary="How to play">
            <ul className="list-disc space-y-1 pl-5">
              <li>Select a pod: tap it, or drag it onto a node on desktop.</li>
              <li>Pick a node: it shows Fits or Does not fit, and bars preview requests.</li>
              <li>
                Follow capacity, taints and tolerations, selectors and affinity, anti-affinity, and
                zone spread.
              </li>
              <li>Tap a placed pod to take it off its node.</li>
              <li>Fewer nodes and a faster finish earn more stars.</li>
            </ul>
          </SimHowTo>
        </SimBar>

        <SimAnnouncer
          message={
            errors.length > 0
              ? errors.join('. ')
              : victory
                ? `Level cleared, ${starCount} of 3 stars`
                : ''
          }
        />

        {allCleared && !dismissed ? (
          <SimComplete
            title="All four levels cleared"
            summary={`You scheduled every pod on all ${INITIAL_LEVELS.length} levels and earned ${totalStars} of ${INITIAL_LEVELS.length * 3} stars.`}
            stats={[
              { label: 'Levels', value: `${cleared}/${INITIAL_LEVELS.length}` },
              { label: 'Stars', value: `${totalStars}/${INITIAL_LEVELS.length * 3}` },
              {
                label: 'Perfect levels',
                value: INITIAL_LEVELS.filter((_, index) => best[index] === 3).length,
              },
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
            columns="lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)]"
            minHeight="min-h-[22rem]"
            tab={tab}
            onTabChange={(nextTab) => {
              setTab(nextTab as 'board' | 'pod');
              revealTop(tabsAnchor, { onlyIfAbove: true });
            }}
            tabsLabel="Scheduler panels"
            tabOrder={['board', 'pod']}
            anchorRef={setTabsAnchor}
            panels={[
              {
                id: 'pod',
                label: 'Pod details',
                content: (
                  <div className="space-y-2">
                    {remainingPods}
                    {selectedPodPanel}
                  </div>
                ),
                mobile: selectedPodPanel,
              },
              {
                id: 'board',
                label: 'Board',
                content: (
                  <div className="space-y-2">
                    {feedback}
                    {nodeGrid}
                  </div>
                ),
                mobile: (
                  <div className="space-y-2">
                    {remainingPods}
                    {feedback}
                    {nodeGrid}
                  </div>
                ),
              },
            ]}
          />
        )}
      </SimFrame>
    </MotionConfig>
  );
}
