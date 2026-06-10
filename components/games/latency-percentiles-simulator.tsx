'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Gauge,
  Layers3,
  LineChart,
  RotateCcw,
  Server,
  SlidersHorizontal,
  Sparkles,
  Target,
  Timer,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  SimulatorAdvisorCard,
  SimulatorControlSlider,
  SimulatorMetricCard,
  SimulatorModeButton,
} from '@/components/games/simulator-primitives';
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
    tailMultiplier: 2.1,
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
    subtitle: 'Shared CPU and disk contention stretch the slow tail without breaking every request.',
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
  jitter: number,
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
    (_, index) => index % Math.max(1, Math.floor(sorted.length / 100)) === 0,
  );

  return (
    <div className="rounded-lg border bg-background p-3">
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
            index * Math.max(1, Math.floor(sorted.length / 100)),
          );
          const left = (trueIndex / Math.max(sorted.length - 1, 1)) * 100;
          const size = sample.latency >= stats.p99 ? 10 : sample.latency >= stats.p95 ? 8 : 6;
          const tone =
            sample.latency >= stats.p99
              ? 'bg-red-500'
              : sample.latency >= stats.p95
                ? 'bg-amber-500'
                : sample.latency >= stats.p90
                  ? 'bg-sky-500'
                  : 'bg-emerald-500';

          return (
            <span
              key={`${sample.id}-${index}`}
              className={cn('absolute top-1/2 rounded-full border border-background shadow-sm', tone)}
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
            className="absolute bottom-2 top-2 w-px"
            style={{ left: `calc(${item.rank}% + 12px)`, backgroundColor: item.color }}
          >
            <span
              className="absolute -top-1 -translate-x-1/2 rounded-sm bg-background px-1 font-mono text-[10px]"
              style={{ color: item.color }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5">
          <p className="text-xs font-semibold text-emerald-600">First 90%</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Normal user experience. This is what average dashboards over-emphasize.
          </p>
        </div>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
          <p className="text-xs font-semibold text-amber-600">Next 9%</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Slow requests. P95 is usually where support tickets start to appear.
          </p>
        </div>
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2.5">
          <p className="text-xs font-semibold text-red-600">Slowest 1%</p>
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
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Latency distribution</h3>
          <p className="text-xs leading-snug text-muted-foreground">
            The bars show request counts by latency bucket. Vertical lines mark percentile cutoffs.
          </p>
        </div>
        <Badge className="font-mono" style={{ backgroundColor: selectedConfig.color }}>
          {selectedConfig.label} = {formatMs(stats[selected])}
        </Badge>
      </div>

      <div className="relative h-56 overflow-hidden rounded-md border bg-linear-to-b from-muted/40 to-background p-3 pb-7">
        <div className="absolute inset-x-3 bottom-7 top-3 grid grid-rows-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="border-t border-dashed border-border/70" />
          ))}
        </div>
        <div className="absolute inset-x-3 bottom-7 top-3 flex items-end gap-1">
          {bins.map((bin, index) => {
            const midpoint = (bin.start + bin.end) / 2;
            const isTail = midpoint >= stats.p95;
            return (
              <div key={bin.start} className="flex h-full min-w-0 flex-1 items-end">
                <div
                  className={cn(
                    'w-full rounded-t-sm border border-background/80 transition-all',
                    isTail
                      ? 'bg-linear-to-t from-red-500 to-amber-400'
                      : index > bins.length * 0.55
                        ? 'bg-linear-to-t from-sky-500 to-cyan-400'
                        : 'bg-linear-to-t from-emerald-500 to-teal-400',
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
              className="absolute bottom-7 top-3 w-px"
              style={{ left: `${x}%`, backgroundColor: item.color }}
            >
              <span
                className="absolute -top-1 rounded-sm bg-background px-1 font-mono text-[10px]"
                style={{ color: item.color, transform: 'translateX(-45%)' }}
              >
                {item.label}
              </span>
            </div>
          );
        })}

        <div className="absolute bottom-2 left-3 right-3 flex justify-between text-[10px] text-muted-foreground">
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
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Request stream</h3>
          <p className="text-xs leading-snug text-muted-foreground">
            Each square is one request in arrival order.
          </p>
        </div>
        <Badge variant="secondary" className="font-mono">
          first {visible.length}
        </Badge>
      </div>
      <div className="grid gap-1 [grid-template-columns:repeat(24,minmax(0,1fr))]">
        {visible.map((sample) => (
          <span
            key={sample.id}
            className={cn(
              'aspect-square rounded-sm border border-background',
              sample.path === 'tail'
                ? 'bg-red-500'
                : sample.path === 'slow'
                  ? 'bg-amber-500'
                  : sample.path === 'fast'
                    ? 'bg-emerald-500'
                    : 'bg-sky-500',
            )}
            title={`request ${sample.id}: ${sample.latency}ms`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> fast
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> normal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> above P95
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> above P99
        </span>
      </div>
    </div>
  );
}

function ChallengePanel({
  scenario,
  stats,
}: {
  scenario: ScenarioId;
  stats: PercentileStats;
}) {
  const answer =
    stats.p99 > stats.p50 * 4
      ? 'P99 is the important alarm here. The median is calm, but the slowest 1% are much worse.'
      : stats.p95 > stats.p50 * 2
        ? 'P95 is the useful early-warning metric. A meaningful minority of users are already slow.'
        : 'P90 is enough for this scenario. The tail is present, but it is not dramatically separated.';
  const ScenarioIcon = SCENARIOS[scenario].icon;

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-3 flex items-center gap-2">
        <div className={cn('rounded-md bg-linear-to-br p-2 text-white', SCENARIOS[scenario].color)}>
          <ScenarioIcon className="h-4 w-4" />
        </div>
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
                <p className="font-mono text-sm font-semibold" style={{ color: item.color }}>
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
      <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-sm text-muted-foreground">
        <strong className="text-foreground">Takeaway:</strong> {answer}
      </div>
    </div>
  );
}

export default function LatencyPercentilesSimulator() {
  const [scenario, setScenario] = useState<ScenarioId>(DEFAULTS.scenario);
  const [requestCount, setRequestCount] = useState(DEFAULTS.requestCount);
  const [tailPercent, setTailPercent] = useState(DEFAULTS.tailPercent);
  const [jitter, setJitter] = useState(DEFAULTS.jitter);
  const [selectedPercentile, setSelectedPercentile] = useState<PercentileKey>(
    DEFAULTS.selectedPercentile,
  );

  const samples = useMemo(
    () => generateSamples(scenario, requestCount, tailPercent, jitter),
    [scenario, requestCount, tailPercent, jitter],
  );
  const stats = useMemo(() => buildStats(samples), [samples]);
  const selectedConfig =
    PERCENTILES.find((item) => item.key === selectedPercentile) ?? PERCENTILES[2];
  const currentScenario = SCENARIOS[scenario];
  const tailGap = stats.p99 / Math.max(stats.p50, 1);

  const reset = () => {
    setScenario(DEFAULTS.scenario);
    setRequestCount(DEFAULTS.requestCount);
    setTailPercent(DEFAULTS.tailPercent);
    setJitter(DEFAULTS.jitter);
    setSelectedPercentile(DEFAULTS.selectedPercentile);
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-primary/20">
        <div className={cn('h-2 bg-linear-to-r', currentScenario.color)} />
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  percentiles are rank cutoffs
                </Badge>
                <Badge variant="secondary" className="font-mono">
                  {stats.total} requests
                </Badge>
              </div>
              <CardTitle className="text-lg sm:text-xl">
                Explore P90, P95, and P99 latency
              </CardTitle>
              <p className="mt-1.5 max-w-3xl text-sm leading-snug text-muted-foreground">
                Generate a latency sample, sort every request, and watch how a tiny slow tail
                changes the numbers your dashboards show.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={reset} className="w-fit gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-5">
            {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
              const item = SCENARIOS[id];
              const Icon = item.icon;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setScenario(id)}
                  className={cn(
                    'rounded-lg border p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40',
                    scenario === id && 'border-primary bg-primary/5',
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div className={cn('rounded-md bg-linear-to-br p-1.5 text-white', item.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-semibold">{item.title}</span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                    {item.subtitle}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Shape the latency sample
              </div>
              <div className="grid gap-4 md:grid-cols-3">
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

            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Target className="h-4 w-4 text-primary" />
                Highlight a percentile
              </div>
              <div className="flex flex-wrap gap-2">
                {PERCENTILES.map((item) => (
                  <SimulatorModeButton
                    key={item.key}
                    value={item.key}
                    current={selectedPercentile}
                    onClick={setSelectedPercentile}
                  >
                    {item.label}
                  </SimulatorModeButton>
                ))}
              </div>
              <p className="mt-3 text-sm leading-snug text-muted-foreground">
                <strong className="text-foreground">{selectedConfig.label}</strong> means{' '}
                {selectedConfig.rank}% of requests finished in{' '}
                <strong className="text-foreground">{formatMs(stats[selectedPercentile])}</strong>{' '}
                or less. The remaining {100 - selectedConfig.rank}% were slower.
              </p>
              <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                {selectedConfig.description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SimulatorMetricCard
          label="Average"
          value={formatMs(stats.avg)}
          icon={Gauge}
          detail="Can hide a painful tail"
        />
        <SimulatorMetricCard
          label="P50"
          value={formatMs(stats.p50)}
          icon={Timer}
          tone="good"
          detail="Median request"
        />
        <SimulatorMetricCard
          label="P90"
          value={formatMs(stats.p90)}
          icon={BarChart3}
          tone="good"
          detail="10% are slower"
        />
        <SimulatorMetricCard
          label="P95"
          value={formatMs(stats.p95)}
          icon={LineChart}
          tone={stats.p95 > stats.p50 * 2 ? 'warn' : 'good'}
          detail="5% are slower"
        />
        <SimulatorMetricCard
          label="P99"
          value={formatMs(stats.p99)}
          icon={Zap}
          tone={tailGap > 4 ? 'bad' : tailGap > 2.5 ? 'warn' : 'good'}
          detail="1% are slower"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <HistogramChart samples={samples} stats={stats} selected={selectedPercentile} />
        <div className="space-y-4">
          <RequestHeatmap samples={samples} stats={stats} />
          <SimulatorAdvisorCard
            title="Read the tail before you tune"
            icon={Activity}
            tone={tailGap > 4 ? 'bad' : tailGap > 2.5 ? 'warn' : 'primary'}
          >
            P99 is {tailGap.toFixed(1)}x the median in this sample. If average and P50 look fine
            while P99 jumps, optimize the rare slow path: cache misses, cold starts, retries, lock
            waits, noisy nodes, or downstream calls.
          </SimulatorAdvisorCard>
        </div>
      </div>

      <PercentileRuler samples={samples} stats={stats} selected={selectedPercentile} />

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <ChallengePanel scenario={scenario} stats={stats} />
        <div className="rounded-lg border bg-background p-3">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">What the numbers say</h3>
          </div>
          <div className="space-y-2 text-sm leading-snug text-muted-foreground">
            <p>
              <strong className="text-foreground">P90:</strong> {formatMs(stats.p90)} means 90%
              of sampled requests completed by that point. It describes the upper edge of normal.
            </p>
            <p>
              <strong className="text-foreground">P95:</strong> {formatMs(stats.p95)} leaves only
              5% of requests above it. It is a practical SLO metric because it catches recurring
              pain without being as jumpy as P99.
            </p>
            <p>
              <strong className="text-foreground">P99:</strong> {formatMs(stats.p99)} isolates
              the slowest 1%. In this run, that group averages{' '}
              <strong className="text-foreground">{formatMs(stats.slowestOnePercent)}</strong>,
              while the median is only <strong className="text-foreground">{formatMs(stats.p50)}</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
