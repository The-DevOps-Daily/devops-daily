'use client';

import { useMemo, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Layers3,
  Server,
  SlidersHorizontal,
  Sparkles,
  Target,
  TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  SimulatorControlSlider,
  SimulatorModeButton,
} from '@/components/games/simulator-primitives';
import {
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimMissionList,
  SimResetButton,
  SimStage,
  useMissions,
  type Mission,
  type SimTone,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';

type ScenarioId = 'steady' | 'cache' | 'noisy' | 'cold-start' | 'deploy';
type PercentileKey = 'p50' | 'p90' | 'p95' | 'p99';

interface ScenarioConfig {
  title: string;
  subtitle: string;
  baseMs: number;
  jitterMs: number;
  tailMultiplier: number;
  tailShape: number;
  color: string;
  icon: typeof Activity;
}

interface Sample {
  id: number;
  latency: number;
  path: 'fast' | 'normal' | 'slow' | 'tail';
}

interface PercentileStats {
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  slowestOnePercent: number;
  total: number;
}

const SCENARIOS: Record<ScenarioId, ScenarioConfig> = {
  steady: {
    title: 'Healthy API',
    subtitle: 'Most requests cluster tightly. P90, P95, and P99 are close together.',
    baseMs: 78,
    jitterMs: 16,
    tailMultiplier: 0.4,
    tailShape: 0.9,
    color: 'from-emerald-500 to-cyan-600',
    icon: CheckCircle2,
  },
  cache: {
    title: 'Cache Churn',
    subtitle: 'Cache misses add a visible upper band while the median still looks fine.',
    baseMs: 58,
    jitterMs: 22,
    tailMultiplier: 3.2,
    tailShape: 1.15,
    color: 'from-sky-500 to-violet-600',
    icon: Layers3,
  },
  noisy: {
    title: 'Noisy Neighbor',
    subtitle:
      'Shared CPU and disk contention stretch the slow tail without breaking every request.',
    baseMs: 92,
    jitterMs: 34,
    tailMultiplier: 4.8,
    tailShape: 1.35,
    color: 'from-amber-500 to-rose-600',
    icon: AlertTriangle,
  },
  'cold-start': {
    title: 'Cold Starts',
    subtitle: 'A small number of very slow requests dominate P99 and max latency.',
    baseMs: 70,
    jitterMs: 20,
    tailMultiplier: 7.4,
    tailShape: 1.8,
    color: 'from-indigo-500 to-fuchsia-600',
    icon: Sparkles,
  },
  deploy: {
    title: 'Rolling Deploy',
    subtitle: 'Warmup, image pulls, and connection churn create a fat tail during release windows.',
    baseMs: 84,
    jitterMs: 28,
    tailMultiplier: 5.8,
    tailShape: 1.55,
    color: 'from-cyan-500 to-emerald-600',
    icon: Server,
  },
};

const PERCENTILES: Array<{
  key: PercentileKey;
  label: string;
  rank: number;
  description: string;
  color: string;
}> = [
  {
    key: 'p50',
    label: 'P50',
    rank: 50,
    description: 'The median. Half of requests are faster and half are slower.',
    color: '#14b8a6',
  },
  {
    key: 'p90',
    label: 'P90',
    rank: 90,
    description: '90% of requests finish at or below this latency.',
    color: '#0ea5e9',
  },
  {
    key: 'p95',
    label: 'P95',
    rank: 95,
    description: 'Only the slowest 5% are above this line.',
    color: '#f59e0b',
  },
  {
    key: 'p99',
    label: 'P99',
    rank: 99,
    description: 'Only the slowest 1% are above this line.',
    color: '#ef4444',
  },
];

const PERCENTILE_TONE: Record<PercentileKey, { fill: string; text: string }> = {
  p50: { fill: 'bg-correct', text: 'text-correct-foreground' },
  p90: { fill: 'bg-info', text: 'text-info-foreground' },
  p95: { fill: 'bg-partial', text: 'text-partial-foreground' },
  p99: { fill: 'bg-wrong', text: 'text-wrong-foreground' },
};

const PATH_TONE: Record<Sample['path'], string> = {
  fast: 'bg-correct',
  normal: 'bg-info',
  slow: 'bg-partial',
  tail: 'bg-wrong',
};

const DEFAULTS = {
  scenario: 'cache' as ScenarioId,
  requestCount: 400,
  tailPercent: 6,
  jitter: 50,
  selectedPercentile: 'p95' as PercentileKey,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function percentile(sorted: number[], rank: number) {
  if (!sorted.length) return 0;
  const index = clamp(Math.ceil((rank / 100) * sorted.length) - 1, 0, sorted.length - 1);
  return sorted[index];
}

function formatMs(value: number) {
  return `${Math.round(value)}ms`;
}

function classifyPath(latency: number, stats: PercentileStats): Sample['path'] {
  if (latency >= stats.p99) return 'tail';
  if (latency >= stats.p95) return 'slow';
  if (latency <= stats.p50) return 'fast';
  return 'normal';
}

function generateSamples(
  scenarioId: ScenarioId,
  requestCount: number,
  tailPercent: number,
  jitter: number
): Sample[] {
  const scenario = SCENARIOS[scenarioId];
  const jitterScale = jitter / 50;
  const tailRatio = tailPercent / 100;

  return Array.from({ length: requestCount }, (_, index) => {
    const r1 = pseudoRandom(index + scenario.baseMs);
    const r2 = pseudoRandom(index * 3 + scenario.jitterMs);
    const r3 = pseudoRandom(index * 7 + scenario.tailMultiplier);
    const wave = Math.sin(index / 17) * scenario.jitterMs * 0.28;
    const base =
      scenario.baseMs +
      (r1 - 0.5) * scenario.jitterMs * 2 * jitterScale +
      (r2 - 0.5) * scenario.jitterMs * 0.7 +
      wave;
    const isTail = r3 > 1 - tailRatio;
    const tailBoost = isTail
      ? scenario.baseMs *
        scenario.tailMultiplier *
        Math.pow((r3 - (1 - tailRatio)) / Math.max(tailRatio, 0.01), scenario.tailShape)
      : 0;
    const deployWarmup =
      scenarioId === 'deploy' && index % 53 < 7 ? scenario.baseMs * (0.7 + r2 * 1.2) : 0;
    const coldStart =
      scenarioId === 'cold-start' && index % 97 === 0 ? scenario.baseMs * (5 + r1 * 3) : 0;
    const latency = Math.round(clamp(base + tailBoost + deployWarmup + coldStart, 18, 2200));

    return {
      id: index + 1,
      latency,
      path: 'normal',
    };
  });
}

function buildStats(samples: Sample[]): PercentileStats {
  const sorted = [...samples].map((sample) => sample.latency).sort((a, b) => a - b);
  const total = sorted.length;
  const p50 = percentile(sorted, 50);
  const p90 = percentile(sorted, 90);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const avg = sorted.reduce((sum, value) => sum + value, 0) / Math.max(total, 1);
  const max = sorted[total - 1] ?? 0;
  const onePercentCount = Math.max(1, Math.ceil(total * 0.01));
  const slowestOnePercent =
    sorted.slice(-onePercentCount).reduce((sum, value) => sum + value, 0) / onePercentCount;

  return { avg, p50, p90, p95, p99, max, slowestOnePercent, total };
}

function buildHistogram(samples: Sample[], maxLatency: number) {
  const binCount = 18;
  const binSize = Math.ceil(maxLatency / binCount);
  const bins = Array.from({ length: binCount }, (_, index) => ({
    start: index * binSize,
    end: (index + 1) * binSize,
    count: 0,
  }));

  samples.forEach((sample) => {
    const index = clamp(Math.floor(sample.latency / binSize), 0, binCount - 1);
    bins[index].count += 1;
  });

  const peak = Math.max(...bins.map((bin) => bin.count), 1);
  return bins.map((bin) => ({
    ...bin,
    height: Math.max(5, (bin.count / peak) * 100),
  }));
}

function recommended(stats: PercentileStats): PercentileKey {
  if (stats.p99 > stats.p50 * 4) return 'p99';
  if (stats.p95 > stats.p50 * 2) return 'p95';
  return 'p90';
}

const MISSIONS: Mission<{
  scenario: ScenarioId;
  stats: PercentileStats;
  selected: PercentileKey;
  picked: boolean;
}>[] = [
  {
    id: 'tight',
    label: 'Get P95 within 1.3x of P50: a tight, healthy service.',
    hint: 'Healthy API keeps requests close together.',
    check: ({ stats }) => stats.p95 < 1.3 * stats.p50,
  },
  {
    id: 'tail',
    label: 'Find a service where P99 is more than 4x the median.',
    hint: 'Try a scenario with a slow tail.',
    check: ({ stats }) => stats.p99 > 4 * stats.p50,
  },
  {
    id: 'alert',
    label: 'For Noisy Neighbor, pick the percentile you would page on.',
    hint: 'Compare each percentile with P50.',
    check: ({ scenario, stats, selected, picked }) =>
      scenario === 'noisy' && picked && selected === recommended(stats),
  },
  {
    id: 'average-hides',
    label: 'Make P99 pass 500 ms while the average stays under 100 ms.',
    hint: 'Cold Starts, then raise the slow tail a little.',
    check: ({ stats }) => stats.p99 > 500 && stats.avg < 100,
  },
];

function PercentileRuler({
  samples,
  stats,
  selected,
}: {
  samples: Sample[];
  stats: PercentileStats;
  selected: PercentileKey;
}) {
  const sorted = useMemo(() => {
    return [...samples].sort((a, b) => a.latency - b.latency);
  }, [samples]);
  const selectedConfig = PERCENTILES.find((item) => item.key === selected) ?? PERCENTILES[2];
  const selectedIndex = Math.ceil((selectedConfig.rank / 100) * stats.total) - 1;
  const visible = sorted.filter(
    (_, index) => index % Math.max(1, Math.floor(sorted.length / 100)) === 0
  );

  return (
    <div
      role="img"
      aria-label={`Sorted requests: P50 ${formatMs(stats.p50)}, P90 ${formatMs(stats.p90)}, P95 ${formatMs(stats.p95)}, P99 ${formatMs(stats.p99)}`}
      className="rounded-lg border bg-card p-3"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Sorted request ruler</h3>
          <p className="text-xs leading-snug text-muted-foreground">
            Requests are sorted fastest to slowest. Percentiles are rank positions, not averages.
          </p>
        </div>
        <Badge variant="outline" className="font-mono">
          rank {selectedIndex + 1} / {stats.total}
        </Badge>
      </div>

      <div className="relative h-16 rounded-md border bg-muted/30 px-3 py-3">
        <div className="absolute inset-x-3 top-1/2 h-px bg-border" />
        {visible.map((sample, index) => {
          const trueIndex = Math.min(
            sorted.length - 1,
            index * Math.max(1, Math.floor(sorted.length / 100))
          );
          const left = (trueIndex / Math.max(sorted.length - 1, 1)) * 100;
          const size = sample.latency >= stats.p99 ? 10 : sample.latency >= stats.p95 ? 8 : 6;
          const tone =
            sample.latency >= stats.p99
              ? PATH_TONE.tail
              : sample.latency >= stats.p95
                ? PATH_TONE.slow
                : sample.latency >= stats.p90
                  ? PERCENTILE_TONE.p90.fill
                  : PATH_TONE.fast;

          return (
            <span
              key={`${sample.id}-${index}`}
              className={cn(
                'absolute top-1/2 rounded-full border border-background shadow-sm',
                tone
              )}
              style={{
                left: `calc(${left}% + 12px)`,
                width: size,
                height: size,
                transform: 'translate(-50%, -50%)',
              }}
            />
          );
        })}

        {PERCENTILES.slice(1).map((item) => (
          <div
            key={item.key}
            className={cn('absolute bottom-2 top-2 w-px', PERCENTILE_TONE[item.key].fill)}
            style={{ left: `calc(${item.rank}% + 12px)` }}
          >
            <span
              className={cn(
                'absolute -top-1 -translate-x-1/2 rounded-sm bg-card px-1 font-mono text-xs',
                PERCENTILE_TONE[item.key].text
              )}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className={cn('rounded-md border p-2.5', SIM_TONE.success.surface)}>
          <p className={cn('text-xs font-semibold', SIM_TONE.success.text)}>First 90%</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Normal user experience. This is what average dashboards over-emphasize.
          </p>
        </div>
        <div className={cn('rounded-md border p-2.5', SIM_TONE.warning.surface)}>
          <p className={cn('text-xs font-semibold', SIM_TONE.warning.text)}>Next 9%</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Slow requests. P95 is usually where support tickets start to appear.
          </p>
        </div>
        <div className={cn('rounded-md border p-2.5', SIM_TONE.danger.surface)}>
          <p className={cn('text-xs font-semibold', SIM_TONE.danger.text)}>Slowest 1%</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            The tail. P99 tells you whether rare paths are painful.
          </p>
        </div>
      </div>
    </div>
  );
}

function HistogramChart({
  samples,
  stats,
  selected,
}: {
  samples: Sample[];
  stats: PercentileStats;
  selected: PercentileKey;
}) {
  const maxLatency = Math.ceil(stats.max * 1.08);
  const bins = buildHistogram(samples, maxLatency);
  const selectedConfig = PERCENTILES.find((item) => item.key === selected) ?? PERCENTILES[2];

  return (
    <div
      role="img"
      aria-label={`Latency distribution: P50 ${formatMs(stats.p50)}, P90 ${formatMs(stats.p90)}, P95 ${formatMs(stats.p95)}, P99 ${formatMs(stats.p99)}`}
      className="rounded-lg border bg-card p-3"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Latency distribution</h3>
          <p className="text-xs leading-snug text-muted-foreground">
            The bars show request counts by latency bucket. Vertical lines mark percentile cutoffs.
          </p>
        </div>
        <Badge
          className={cn(
            'font-mono',
            PERCENTILE_TONE[selectedConfig.key].fill,
            PERCENTILE_TONE[selectedConfig.key].text
          )}
        >
          {selectedConfig.label} = {formatMs(stats[selected])}
        </Badge>
      </div>

      <div className="relative h-44 overflow-hidden rounded-md border bg-muted/30 p-3 pb-7 lg:h-48">
        <div className="absolute inset-x-3 bottom-7 top-3 grid grid-rows-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="border-t border-dashed border-border/70" />
          ))}
        </div>
        <div className="absolute inset-x-3 bottom-7 top-3 flex items-end gap-1">
          {bins.map((bin, index) => {
            const midpoint = (bin.start + bin.end) / 2;
            const tone =
              midpoint >= stats.p99
                ? PATH_TONE.tail
                : midpoint >= stats.p95
                  ? PATH_TONE.slow
                  : index > bins.length * 0.55
                    ? PATH_TONE.normal
                    : PATH_TONE.fast;
            return (
              <div key={bin.start} className="flex h-full min-w-0 flex-1 items-end">
                <div
                  className={cn(
                    'w-full rounded-t-sm border border-background/80 transition-all',
                    tone
                  )}
                  style={{ height: `${bin.height}%` }}
                  title={`${bin.start}-${bin.end}ms: ${bin.count} requests`}
                />
              </div>
            );
          })}
        </div>

        {PERCENTILES.slice(1).map((item) => {
          const x = clamp((stats[item.key] / maxLatency) * 100, 0, 100);
          return (
            <div
              key={item.key}
              className={cn('absolute bottom-7 top-3 w-px', PERCENTILE_TONE[item.key].fill)}
              style={{ left: `${x}%` }}
            >
              <span
                className={cn(
                  'absolute -top-1 rounded-sm bg-card px-1 font-mono text-xs',
                  PERCENTILE_TONE[item.key].text
                )}
                style={{ transform: 'translateX(-45%)' }}
              >
                {item.label}
              </span>
            </div>
          );
        })}

        <div className="absolute bottom-2 left-3 right-3 flex justify-between text-xs text-muted-foreground">
          <span>0ms</span>
          <span>{formatMs(maxLatency)}</span>
        </div>
      </div>
    </div>
  );
}

function RequestHeatmap({ samples, stats }: { samples: Sample[]; stats: PercentileStats }) {
  const visible = samples.slice(0, 144).map((sample) => ({
    ...sample,
    path: classifyPath(sample.latency, stats),
  }));

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Request stream</h3>
          <p className="text-xs leading-snug text-muted-foreground">
            Each square is one request in arrival order.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 whitespace-nowrap font-mono">
          first {visible.length}
        </Badge>
      </div>
      <div className="grid gap-1 [grid-template-columns:repeat(24,minmax(0,1fr))]">
        {visible.map((sample) => (
          <span
            key={sample.id}
            className={cn(
              'aspect-square rounded-sm border border-background',
              PATH_TONE[sample.path]
            )}
            title={`request ${sample.id}: ${sample.latency}ms`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-correct" /> fast
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-info" /> normal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-partial" /> above P95
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-wrong" /> above P99
        </span>
      </div>
    </div>
  );
}

function ChallengePanel({
  scenario,
  stats,
  selected,
  picked,
}: {
  scenario: ScenarioId;
  stats: PercentileStats;
  selected: PercentileKey;
  picked: boolean;
}) {
  const answer =
    recommended(stats) === 'p99'
      ? 'P99 is the important alarm here. The median is calm, but the slowest 1% are much worse.'
      : recommended(stats) === 'p95'
        ? 'P95 is the useful early-warning metric. A meaningful minority of users are already slow.'
        : 'P90 is enough for this scenario. The tail is present, but it is not dramatically separated.';
  const ScenarioIcon = SCENARIOS[scenario].icon;

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-3 flex items-center gap-2">
        <ScenarioIcon className="h-5 w-5 text-primary" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold">Incident readout</h3>
          <p className="text-xs text-muted-foreground">Which metric would catch the user pain?</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {PERCENTILES.slice(1).map((item) => {
          const value = stats[item.key];
          const usersAbove = 100 - item.rank;
          return (
            <div key={item.key} className="rounded-md border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={cn('font-mono text-sm font-semibold', PERCENTILE_TONE[item.key].text)}
                >
                  {item.label}
                </p>
                <span className="text-sm font-semibold">{formatMs(value)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {usersAbove}% of requests are slower than this cutoff.
              </p>
            </div>
          );
        })}
      </div>
      {!picked ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Which percentile would you page on? Pick one under Highlight a percentile.
        </p>
      ) : selected === recommended(stats) ? (
        <SimFeedback tone="success" label="Right call" className="mt-3">
          <p>{answer}</p>
        </SimFeedback>
      ) : (
        <SimFeedback tone="warning" label="Look again" className="mt-3">
          <p>Compare each percentile with P50: how far apart are they?</p>
        </SimFeedback>
      )}
    </div>
  );
}

export default function LatencyPercentilesSimulator() {
  const [scenario, setScenario] = useState<ScenarioId>(DEFAULTS.scenario);
  const [requestCount, setRequestCount] = useState(DEFAULTS.requestCount);
  const [tailPercent, setTailPercent] = useState(DEFAULTS.tailPercent);
  const [jitter, setJitter] = useState(DEFAULTS.jitter);
  const [selectedPercentile, setSelectedPercentile] = useState<PercentileKey>(
    DEFAULTS.selectedPercentile
  );
  const [picked, setPicked] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [tab, setTab] = useState<'chart' | 'controls' | 'readout'>('chart');

  const samples = useMemo(
    () => generateSamples(scenario, requestCount, tailPercent, jitter),
    [scenario, requestCount, tailPercent, jitter]
  );
  const stats = useMemo(() => buildStats(samples), [samples]);
  const selectedConfig =
    PERCENTILES.find((item) => item.key === selectedPercentile) ?? PERCENTILES[2];
  const tailGap = stats.p99 / Math.max(stats.p50, 1);
  const missionState = useMemo(
    () => ({ scenario, stats, selected: selectedPercentile, picked }),
    [scenario, stats, selectedPercentile, picked]
  );
  const missions = useMissions(MISSIONS, missionState);

  const reset = () => {
    setScenario(DEFAULTS.scenario);
    setRequestCount(DEFAULTS.requestCount);
    setTailPercent(DEFAULTS.tailPercent);
    setJitter(DEFAULTS.jitter);
    setSelectedPercentile(DEFAULTS.selectedPercentile);
  };

  const pickScenario = (id: ScenarioId) => {
    setScenario(id);
    setPicked(false);
  };

  const pickPercentile = (value: PercentileKey) => {
    setSelectedPercentile(value);
    setPicked(true);
  };

  const startOver = () => {
    reset();
    setPicked(false);
    missions.reset();
    setDismissed(false);
  };

  const metricCards: Array<{ label: string; value: number; tone?: SimTone }> = [
    { label: 'Average', value: stats.avg },
    { label: 'P50', value: stats.p50 },
    { label: 'P90', value: stats.p90 },
    {
      label: 'P95',
      value: stats.p95,
      tone: stats.p95 > stats.p50 * 2 ? 'warning' : undefined,
    },
    {
      label: 'P99',
      value: stats.p99,
      tone: tailGap > 4 ? 'danger' : tailGap > 2.5 ? 'warning' : undefined,
    },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame>
        <SimBar
          title="P90, P95 & P99 Latency Simulator"
          icon={Gauge}
          lead={
            <div
              role="group"
              aria-label="Scenario"
              className="grid min-w-0 flex-1 grid-cols-2 gap-1 sm:flex sm:flex-wrap"
            >
              {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
                const item = SCENARIOS[id];
                const Icon = item.icon;
                return (
                  <Button
                    key={id}
                    type="button"
                    size="sm"
                    title={item.subtitle}
                    variant={scenario === id ? 'default' : 'outline'}
                    aria-pressed={scenario === id}
                    onClick={() => pickScenario(id)}
                    className="h-10 min-w-0 justify-start lg:h-8"
                  >
                    <Icon className="hidden h-3.5 w-3.5 shrink-0 sm:block" aria-hidden="true" />
                    <span className="truncate">{item.title}</span>
                  </Button>
                );
              })}
            </div>
          }
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading="Missions"
          meta={
            <Badge variant="secondary" className="font-mono tabular-nums">
              {stats.total} requests
            </Badge>
          }
          goal={
            missions.complete ? (
              'All four done. Keep shaping samples.'
            ) : (
              <>
                {missions.current?.label}{' '}
                <span className="text-muted-foreground">{missions.current?.hint}</span>
              </>
            )
          }
        />

        <SimAnnouncer
          message={`P50 ${formatMs(stats.p50)}, P95 ${formatMs(stats.p95)}, P99 ${formatMs(stats.p99)}, average ${formatMs(stats.avg)}`}
        />

        {missions.complete && !dismissed ? (
          <SimComplete
            title="Missions complete"
            summary="You found a tight service, a long tail, the percentile worth paging on, and a P99 the average hides."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'P99 now', value: formatMs(stats.p99) },
              { label: 'Average now', value: formatMs(stats.avg) },
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
            columns="lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)_minmax(0,1fr)]"
            minHeight="min-h-[24rem]"
            tab={tab}
            onTabChange={(next) => {
              if (next === 'chart' || next === 'controls' || next === 'readout') setTab(next);
            }}
            tabsLabel="Simulator panels"
            tabOrder={['chart', 'controls', 'readout']}
            panels={[
              {
                id: 'controls',
                label: 'Controls',
                content: (
                  <div className="space-y-2">
                    <div className="rounded-lg border bg-card p-3">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                        <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
                        Shape the latency sample
                      </div>
                      <div className="space-y-3">
                        <SimulatorControlSlider
                          label="Requests"
                          value={requestCount}
                          min={100}
                          max={1000}
                          step={100}
                          onChange={setRequestCount}
                        />
                        <SimulatorControlSlider
                          label="Slow tail"
                          value={tailPercent}
                          min={1}
                          max={15}
                          step={1}
                          suffix="%"
                          onChange={setTailPercent}
                        />
                        <SimulatorControlSlider
                          label="Jitter"
                          value={jitter}
                          min={10}
                          max={100}
                          step={5}
                          suffix="%"
                          onChange={setJitter}
                        />
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                        <Target className="h-4 w-4 text-primary" aria-hidden="true" />
                        Highlight a percentile
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {PERCENTILES.map((item) => (
                          <SimulatorModeButton
                            key={item.key}
                            value={item.key}
                            current={selectedPercentile}
                            onClick={pickPercentile}
                          >
                            {item.label}
                          </SimulatorModeButton>
                        ))}
                      </div>
                      <p className="mt-3 text-sm leading-snug text-muted-foreground">
                        <strong className="text-foreground">{selectedConfig.label}</strong> means{' '}
                        {selectedConfig.rank}% of requests finished in{' '}
                        <strong className="text-foreground">
                          {formatMs(stats[selectedPercentile])}
                        </strong>{' '}
                        or less. The remaining {100 - selectedConfig.rank}% were slower.
                      </p>
                      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                        {selectedConfig.description}
                      </p>
                    </div>
                    <SimMissionList missions={missions.missions} />
                  </div>
                ),
              },
              {
                id: 'chart',
                label: 'Chart',
                content: (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                      {metricCards.map((metric) => (
                        <div
                          key={metric.label}
                          className={cn(
                            'rounded-md border bg-card px-2 py-1.5',
                            metric.tone && SIM_TONE[metric.tone].surface
                          )}
                        >
                          <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                            {metric.label}
                            {metric.tone && (
                              <TriangleAlert
                                className={cn('h-3.5 w-3.5', SIM_TONE[metric.tone].iconClass)}
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          <div className="font-mono text-lg font-semibold tabular-nums">
                            {formatMs(metric.value)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <HistogramChart samples={samples} stats={stats} selected={selectedPercentile} />
                    <PercentileRuler
                      samples={samples}
                      stats={stats}
                      selected={selectedPercentile}
                    />
                  </div>
                ),
              },
              {
                id: 'readout',
                label: 'Readout',
                content: (
                  <div className="space-y-2">
                    <ChallengePanel
                      scenario={scenario}
                      stats={stats}
                      selected={selectedPercentile}
                      picked={picked}
                    />
                    <RequestHeatmap samples={samples} stats={stats} />
                    <SimFeedback
                      tone={tailGap > 4 ? 'danger' : tailGap > 2.5 ? 'warning' : 'info'}
                      label="Read the tail before you tune"
                    >
                      <p>
                        P99 is {tailGap.toFixed(1)}x the median in this sample. If average and P50
                        look fine while P99 jumps, optimize the rare slow path: cache misses, cold
                        starts, retries, lock waits, noisy nodes, or downstream calls.
                      </p>
                    </SimFeedback>
                    <details className="rounded-lg border bg-card p-3">
                      <summary className="cursor-pointer text-sm font-semibold">
                        What the numbers say
                      </summary>
                      <div className="mt-3 space-y-2 text-sm leading-snug text-muted-foreground">
                        <p>
                          <strong className="text-foreground">P90:</strong> {formatMs(stats.p90)}{' '}
                          means 90% of sampled requests completed by that point. It describes the
                          upper edge of normal.
                        </p>
                        <p>
                          <strong className="text-foreground">P95:</strong> {formatMs(stats.p95)}{' '}
                          leaves only 5% of requests above it. It is a practical SLO metric because
                          it catches recurring pain without being as jumpy as P99.
                        </p>
                        <p>
                          <strong className="text-foreground">P99:</strong> {formatMs(stats.p99)}{' '}
                          isolates the slowest 1%. In this run, that group averages{' '}
                          <strong className="text-foreground">
                            {formatMs(stats.slowestOnePercent)}
                          </strong>
                          , while the median is only{' '}
                          <strong className="text-foreground">{formatMs(stats.p50)}</strong>.
                        </p>
                      </div>
                    </details>
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
