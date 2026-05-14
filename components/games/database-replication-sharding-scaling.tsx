'use client';

import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CircuitBoard,
  Clock,
  Database,
  Gauge,
  GitBranch,
  HardDrive,
  Layers3,
  Network,
  RefreshCw,
  Route,
  Server,
  ShieldCheck,
  Shuffle,
  SlidersHorizontal,
  Split,
  TrendingUp,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type ReplicationMode = 'async' | 'sync';
type ReplicationTopology = 'single-leader' | 'multi-leader' | 'leaderless';
type PartitioningMode = 'hash' | 'range';
type ShardKey = 'user_id' | 'region' | 'created_at' | 'tenant_id';

const shardKeyLabels: Record<ShardKey, string> = {
  user_id: 'user_id',
  region: 'region',
  created_at: 'created_at',
  tenant_id: 'tenant_id',
};

const querySamples = [
  'user_id = 18429',
  "region = 'us-east'",
  "created_at > now() - '1 day'",
  "tenant_id = 'enterprise-7'",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function pct(value: number) {
  return `${Math.round(value)}%`;
}

function ms(value: number) {
  return `${Math.round(value)} ms`;
}

function money(value: number) {
  return `$${Math.round(value)}/mo`;
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  tone?: 'default' | 'good' | 'warn' | 'bad';
  detail?: string;
}

function MetricCard({ label, value, icon: Icon, tone = 'default', detail }: MetricCardProps) {
  const tones = {
    default: 'border-border bg-card',
    good: 'border-emerald-500/30 bg-emerald-500/5',
    warn: 'border-amber-500/30 bg-amber-500/5',
    bad: 'border-red-500/30 bg-red-500/5',
  };

  return (
    <div className={cn('rounded-lg border p-4', tones[tone])}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 break-words text-xl font-semibold tracking-tight sm:text-2xl">{value}</div>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

interface NodeCardProps {
  title: string;
  subtitle: string;
  status?: 'healthy' | 'lagging' | 'down' | 'routing' | 'hot';
  load?: number;
  icon?: ComponentType<{ className?: string }>;
}

function NodeCard({
  title,
  subtitle,
  status = 'healthy',
  load = 40,
  icon: Icon = Database,
}: NodeCardProps) {
  const statusStyles = {
    healthy: 'border-emerald-500/40 bg-emerald-500/10',
    lagging: 'border-amber-500/40 bg-amber-500/10',
    down: 'border-red-500/40 bg-red-500/10 opacity-70',
    routing: 'border-primary/40 bg-primary/10',
    hot: 'border-yellow-500/50 bg-yellow-500/10',
  };

  return (
    <div className={cn('rounded-lg border p-3 shadow-sm backdrop-blur', statusStyles[status])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-md border bg-background/80 p-2">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="break-words text-xs text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        <span
          className={cn(
            'mt-1 h-2.5 w-2.5 rounded-full',
            status === 'down'
              ? 'bg-red-500'
              : status === 'lagging' || status === 'hot'
                ? 'bg-amber-500'
                : 'bg-emerald-500'
          )}
        />
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/80">
        <div
          className={cn(
            'h-full rounded-full',
            load > 85 ? 'bg-red-500' : load > 65 ? 'bg-amber-500' : 'bg-emerald-500'
          )}
          style={{ width: `${clamp(load, 2, 100)}%` }}
        />
      </div>
    </div>
  );
}

function FlowLine({ tone = 'primary', delay = 0 }: { tone?: 'primary' | 'success' | 'warn'; delay?: number }) {
  const color = tone === 'success' ? 'bg-emerald-400' : tone === 'warn' ? 'bg-yellow-400' : 'bg-primary';

  return (
    <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-border">
      <motion.div
        className={cn('absolute top-0 h-1 w-16 rounded-full', color)}
        animate={{ x: ['-30%', '620%'] }}
        transition={{ repeat: Infinity, duration: 1.4, delay, ease: 'linear' }}
      />
    </div>
  );
}

function ModeButton<T extends string>({
  value,
  current,
  onClick,
  children,
}: {
  value: T;
  current: T;
  onClick: (value: T) => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={value === current ? 'default' : 'outline'}
      onClick={() => onClick(value)}
      className="h-8"
    >
      {children}
    </Button>
  );
}

function ReplicationModePanel() {
  const [mode, setMode] = useState<ReplicationMode>('async');
  const [topology, setTopology] = useState<ReplicationTopology>('single-leader');
  const [replicas, setReplicas] = useState(3);
  const [load, setLoad] = useState(650);
  const [writePercent, setWritePercent] = useState(28);
  const [consistency, setConsistency] = useState(55);
  const [primaryDown, setPrimaryDown] = useState(false);

  const metrics = useMemo(() => {
    const readQps = load * (1 - writePercent / 100);
    const writeQps = load * (writePercent / 100);
    const nodes = replicas + 1;
    const readCapacity = topology === 'leaderless' ? nodes * 230 : replicas * 260 + 130;
    const writeCapacity = primaryDown
      ? topology === 'single-leader'
        ? 0
        : replicas * 120
      : topology === 'leaderless'
        ? nodes * 115
        : topology === 'multi-leader'
          ? nodes * 150
          : mode === 'sync'
            ? 190
            : 280;
    const writePressure = writeCapacity === 0 ? 3 : writeQps / writeCapacity;
    const readPressure = readQps / Math.max(readCapacity, 1);
    const pressure = Math.max(writePressure, readPressure);
    const baseLag =
      mode === 'sync'
        ? 12 + pressure * 18
        : 80 + pressure * 220 + (100 - consistency) * 2.4;
    const lag = primaryDown && topology === 'single-leader' ? 0 : baseLag;
    const latency =
      30 +
      pressure * 75 +
      (mode === 'sync' ? consistency * 0.75 : (100 - consistency) * 0.18) +
      (primaryDown ? 90 : 0);
    const availability =
      primaryDown && topology === 'single-leader'
        ? 62
        : primaryDown
          ? 91 - (100 - consistency) * 0.08
          : 99.4 - pressure * 1.1;
    const staleReadRisk = mode === 'async' ? clamp(100 - consistency + pressure * 24, 4, 96) : clamp(12 - consistency * 0.08, 1, 12);
    const splitBrainRisk =
      topology === 'multi-leader' && primaryDown
        ? clamp(72 - consistency * 0.45, 20, 82)
        : topology === 'leaderless'
          ? clamp(35 - consistency * 0.22, 8, 35)
          : 4;

    return {
      readQps,
      writeQps,
      lag,
      latency,
      availability,
      staleReadRisk,
      splitBrainRisk,
      pressure: clamp(pressure * 100, 0, 140),
      writeCapacity,
    };
  }, [consistency, load, mode, primaryDown, replicas, topology, writePercent]);

  const leaderLabel =
    topology === 'single-leader'
      ? 'Primary'
      : topology === 'multi-leader'
        ? 'Leader A'
        : 'Coordinator';

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                Replication topology
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Writes land on leaders, reads fan out to replicas, and lag appears when durability
                and latency pull in opposite directions.
              </p>
            </div>
            <Button
              type="button"
              variant={primaryDown ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setPrimaryDown((value) => !value)}
            >
              {primaryDown ? <RefreshCw className="mr-2 h-4 w-4" /> : <X className="mr-2 h-4 w-4" />}
              {primaryDown ? 'Recover primary' : 'Kill primary'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-linear-to-br from-zinc-950 via-neutral-950 to-stone-950 p-4 text-slate-100">
            <div className="grid gap-4 lg:grid-cols-[1fr_140px_1fr]">
              <div className="space-y-3">
                <NodeCard
                  title={leaderLabel}
                  subtitle={primaryDown ? 'offline, failover needed' : `${Math.round(metrics.writeQps)} writes/sec`}
                  status={primaryDown ? 'down' : metrics.pressure > 95 ? 'hot' : 'healthy'}
                  load={metrics.pressure}
                  icon={Database}
                />
                {topology === 'multi-leader' && (
                  <NodeCard
                    title="Leader B"
                    subtitle="accepts regional writes"
                    status={metrics.splitBrainRisk > 50 ? 'lagging' : 'healthy'}
                    load={Math.min(metrics.pressure * 0.75, 100)}
                    icon={Split}
                  />
                )}
              </div>

              <div className="hidden items-center gap-2 lg:flex">
                <FlowLine tone={mode === 'sync' ? 'success' : 'primary'} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: replicas }, (_, index) => (
                  <NodeCard
                    key={index}
                    title={`Replica ${index + 1}`}
                    subtitle={
                      primaryDown && topology !== 'single-leader'
                        ? index === 0
                          ? 'promoted leader'
                          : 'serving reads'
                        : `${Math.round(metrics.readQps / replicas)} reads/sec`
                    }
                    status={
                      primaryDown && topology === 'single-leader'
                        ? 'lagging'
                        : metrics.lag > 250
                          ? 'lagging'
                          : 'healthy'
                    }
                    load={clamp(metrics.readQps / replicas / 2.6, 8, 100)}
                    icon={Server}
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-slate-400">Write path</div>
                <div className="mt-1 font-medium">
                  {topology === 'single-leader' ? 'leader only' : topology === 'multi-leader' ? 'regional leaders' : 'quorum writes'}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-slate-400">Read path</div>
                <div className="mt-1 font-medium">
                  {consistency > 74 ? 'leader/quorum reads' : 'replica reads'}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-slate-400">Failure behavior</div>
                <div className="mt-1 font-medium">
                  {primaryDown
                    ? topology === 'single-leader'
                      ? 'writes unavailable'
                      : 'automatic failover'
                    : 'normal operation'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4" />
              Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 text-sm font-medium">Topology</div>
              <div className="flex flex-wrap gap-2">
                <ModeButton value="single-leader" current={topology} onClick={setTopology}>
                  Single leader
                </ModeButton>
                <ModeButton value="multi-leader" current={topology} onClick={setTopology}>
                  Multi-leader
                </ModeButton>
                <ModeButton value="leaderless" current={topology} onClick={setTopology}>
                  Leaderless
                </ModeButton>
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">Commit mode</div>
              <div className="flex gap-2">
                <ModeButton value="async" current={mode} onClick={setMode}>
                  Async
                </ModeButton>
                <ModeButton value="sync" current={mode} onClick={setMode}>
                  Sync
                </ModeButton>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Replicas</span>
                <Badge variant="secondary">{replicas}</Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setReplicas((v) => clamp(v - 1, 1, 5))}>
                  -
                </Button>
                <Button size="sm" variant="outline" onClick={() => setReplicas((v) => clamp(v + 1, 1, 5))}>
                  +
                </Button>
              </div>
            </div>

            <ControlSlider label="Load" value={load} min={100} max={1600} step={50} suffix=" qps" onChange={setLoad} />
            <ControlSlider label="Writes" value={writePercent} min={5} max={80} step={5} suffix="%" onChange={setWritePercent} />
            <ControlSlider label="Consistency preference" value={consistency} min={0} max={100} step={5} suffix="%" onChange={setConsistency} />
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <MetricCard
            label="Replication lag"
            value={ms(metrics.lag)}
            icon={Clock}
            tone={metrics.lag > 260 ? 'warn' : 'good'}
            detail={mode === 'sync' ? 'lower lag, higher write latency' : 'higher throughput, possible stale reads'}
          />
          <MetricCard
            label="Write capacity"
            value={`${Math.round(metrics.writeCapacity)} qps`}
            icon={Zap}
            tone={metrics.writeCapacity < metrics.writeQps ? 'bad' : 'good'}
            detail={`${Math.round(metrics.writeQps)} qps requested`}
          />
          <MetricCard
            label="Availability"
            value={pct(metrics.availability)}
            icon={ShieldCheck}
            tone={metrics.availability > 98 ? 'good' : metrics.availability > 85 ? 'warn' : 'bad'}
            detail="failover and quorum effects"
          />
          <MetricCard
            label="Split-brain risk"
            value={pct(metrics.splitBrainRisk)}
            icon={AlertTriangle}
            tone={metrics.splitBrainRisk > 45 ? 'bad' : metrics.splitBrainRisk > 18 ? 'warn' : 'good'}
            detail="lower with stronger coordination"
          />
        </div>

        <AdvisorCard
          title="Operator readout"
          icon={Activity}
          tone={primaryDown && topology === 'single-leader' ? 'bad' : metrics.lag > 260 ? 'warn' : 'primary'}
        >
          {primaryDown && topology === 'single-leader'
            ? 'The primary is down and this topology cannot accept writes until a replica is promoted.'
            : metrics.lag > 260
              ? 'Lag is climbing. Move critical reads to the leader, lower write pressure, or increase consistency for safer reads.'
              : 'This setup is healthy for the current workload. Reads are spread out while writes remain coordinated.'}
        </AdvisorCard>
      </div>
    </div>
  );
}

function ControlSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <Badge variant="secondary" className="shrink-0">
          {value}
          {suffix}
        </Badge>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next ?? value)} />
    </div>
  );
}

function AdvisorCard({
  title,
  icon: Icon,
  children,
  tone = 'primary',
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  tone?: 'primary' | 'warn' | 'bad';
}) {
  const tones = {
    primary: 'border-primary/25 bg-primary/5',
    warn: 'border-yellow-500/30 bg-yellow-500/5',
    bad: 'border-red-500/30 bg-red-500/5',
  };

  return (
    <div className={cn('rounded-lg border p-4', tones[tone])}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function ShardingModePanel() {
  const [partitioning, setPartitioning] = useState<PartitioningMode>('hash');
  const [shardKey, setShardKey] = useState<ShardKey>('user_id');
  const [shards, setShards] = useState(4);
  const [rows, setRows] = useState(120);
  const [query, setQuery] = useState(querySamples[0]);

  const distribution = useMemo(() => {
    const skewByKey: Record<ShardKey, number[]> = {
      user_id: [1.04, 0.98, 1.01, 0.97, 1.02, 1.0],
      region: [1.75, 0.82, 0.7, 0.58, 0.5, 0.43],
      created_at: [0.35, 0.5, 0.72, 1.08, 1.58, 2.1],
      tenant_id: [2.15, 0.62, 0.55, 0.5, 0.46, 0.42],
    };
    const base = Array.from({ length: shards }, (_, index) => {
      const even = rows / shards;
      const skew = partitioning === 'hash' ? skewByKey[shardKey][index % 6] : 0.55 + index * (1.1 / Math.max(shards - 1, 1));
      return Math.round(even * skew);
    });
    const total = base.reduce((sum, value) => sum + value, 0);
    return base.map((value) => Math.max(4, Math.round((value / total) * rows)));
  }, [partitioning, rows, shardKey, shards]);

  const shardLoads = useMemo(() => {
    const max = Math.max(...distribution);
    const avg = distribution.reduce((sum, value) => sum + value, 0) / distribution.length;
    const hotspot = max / avg;
    const queryIndex =
      partitioning === 'hash'
        ? Math.abs([...query].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % shards
        : query.includes('now')
          ? shards - 1
          : query.includes('us-east') || query.includes('enterprise')
            ? 0
            : Math.floor(shards / 2);
    const rebalanceCost = partitioning === 'hash' ? Math.round(rows / shards) : Math.round(rows * 0.42);
    return { max, avg, hotspot, queryIndex, rebalanceCost };
  }, [distribution, partitioning, query, rows, shards]);

  const hotSpotTone = shardLoads.hotspot > 1.65 ? 'bad' : shardLoads.hotspot > 1.25 ? 'warn' : 'good';

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            Shard map
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Change the partitioning strategy and shard key to see hot spots and query routing.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-linear-to-br from-zinc-950 via-neutral-950 to-stone-950 p-4 text-slate-100">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                Router hashes <span className="text-primary">{shardKeyLabels[shardKey]}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500" />
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                Query sent to <span className="text-primary">shard {shardLoads.queryIndex + 1}</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {distribution.map((count, index) => {
                const load = (count / shardLoads.max) * 100;
                const isQueryShard = index === shardLoads.queryIndex;
                const isHot = count / shardLoads.avg > 1.35;
                return (
                  <div
                    key={index}
                    className={cn(
                      'rounded-lg border p-4',
                      isQueryShard
                        ? 'border-primary bg-primary/15'
                        : isHot
                          ? 'border-yellow-400/70 bg-yellow-500/10'
                          : 'border-white/10 bg-white/5'
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="font-semibold">Shard {index + 1}</div>
                      {isQueryShard && <Badge className="bg-primary text-primary-foreground">query</Badge>}
                    </div>
                    <div className="flex h-28 items-end gap-1 rounded-md border border-white/10 bg-black/20 p-2">
                      {Array.from({ length: 9 }, (_, bar) => (
                        <div
                          key={bar}
                          className={cn(
                            'flex-1 rounded-t-sm',
                            isHot ? 'bg-yellow-400' : isQueryShard ? 'bg-primary' : 'bg-emerald-400'
                          )}
                          style={{ height: `${clamp(load - bar * 5, 12, 100)}%`, opacity: 0.38 + bar * 0.055 }}
                        />
                      ))}
                    </div>
                    <div className="mt-3 text-sm text-slate-300">{count}k rows</div>
                    <div className="text-xs text-slate-500">{pct(load)} of hottest shard</div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Route className="h-4 w-4" />
              Partitioning controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 text-sm font-medium">Partitioning</div>
              <div className="flex gap-2">
                <ModeButton value="hash" current={partitioning} onClick={setPartitioning}>
                  Hash
                </ModeButton>
                <ModeButton value="range" current={partitioning} onClick={setPartitioning}>
                  Range
                </ModeButton>
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">Shard key exercise</div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(shardKeyLabels) as ShardKey[]).map((key) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={key === shardKey ? 'default' : 'outline'}
                    onClick={() => setShardKey(key)}
                    className="h-auto min-h-8 break-all px-2 text-xs sm:text-sm"
                  >
                    {shardKeyLabels[key]}
                  </Button>
                ))}
              </div>
            </div>

            <ControlSlider label="Rows" value={rows} min={40} max={320} step={20} suffix="k" onChange={setRows} />

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Shards</span>
                <Badge variant="secondary">{shards}</Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShards((v) => clamp(v - 1, 2, 6))}>
                  -
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShards((v) => clamp(v + 1, 2, 6))}>
                  +
                </Button>
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">Query simulator</div>
              <div className="grid gap-2">
                {querySamples.map((sample) => (
                  <Button
                    key={sample}
                    type="button"
                    size="sm"
                    variant={query === sample ? 'default' : 'outline'}
                    onClick={() => setQuery(sample)}
                    className="h-auto min-h-8 justify-start whitespace-normal break-all py-2 text-left font-mono text-xs leading-snug"
                  >
                    {sample}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <MetricCard
            label="Hot spot ratio"
            value={`${shardLoads.hotspot.toFixed(2)}x`}
            icon={AlertTriangle}
            tone={hotSpotTone}
            detail="hottest shard compared with average"
          />
          <MetricCard
            label="Rebalance movement"
            value={`${shardLoads.rebalanceCost}k rows`}
            icon={Shuffle}
            tone={partitioning === 'hash' ? 'good' : 'warn'}
            detail={partitioning === 'hash' ? 'smaller with consistent hashing' : 'range splits can move large chunks'}
          />
          <MetricCard
            label="Query fanout"
            value={query.includes('created_at') && partitioning === 'hash' ? `${shards} shards` : '1 shard'}
            icon={Network}
            tone={query.includes('created_at') && partitioning === 'hash' ? 'warn' : 'good'}
            detail="scatter/gather queries add latency"
          />
        </div>

        <AdvisorCard title="Routing readout" icon={Route} tone={hotSpotTone === 'bad' ? 'bad' : hotSpotTone === 'warn' ? 'warn' : 'primary'}>
          {hotSpotTone === 'bad'
            ? 'The shard key is concentrating data. Pick a higher-cardinality key or add a routing layer that can split hot tenants.'
            : query.includes('created_at') && partitioning === 'hash'
              ? 'This query fans out under hash partitioning. A time-range index or secondary lookup table would keep it cheaper.'
              : 'The router can target a single shard, so this query shape stays predictable as the dataset grows.'}
        </AdvisorCard>
      </div>
    </div>
  );
}

function ScalingModePanel() {
  const [load, setLoad] = useState(1200);
  const [writePercent, setWritePercent] = useState(35);
  const [verticalTier, setVerticalTier] = useState(2);
  const [replicas, setReplicas] = useState(2);
  const [shards, setShards] = useState(2);
  const [pooling, setPooling] = useState(true);

  const metrics = useMemo(() => {
    const readQps = load * (1 - writePercent / 100);
    const writeQps = load * (writePercent / 100);
    const verticalRead = 340 * verticalTier * (1 + Math.log2(verticalTier) * 0.18);
    const verticalWrite = 170 * verticalTier * (1 + Math.log2(verticalTier) * 0.12);
    const readCapacity = verticalRead + replicas * 300 + (pooling ? 180 : 0);
    const writeCapacity = verticalWrite * shards;
    const readPressure = readQps / readCapacity;
    const writePressure = writeQps / writeCapacity;
    const pressure = Math.max(readPressure, writePressure);
    const latency = 24 + pressure * 130 + (pooling ? -14 : 30) + (verticalTier > 4 ? 22 : 0);
    const errorRate = clamp((pressure - 0.92) * 38, 0, 42);
    const cost = verticalTier * 95 + replicas * 55 + shards * 140 + (pooling ? 30 : 0);
    const throughput = Math.min(load, readCapacity + writeCapacity);
    const writeBottleneck = writePressure > readPressure;
    return {
      readQps,
      writeQps,
      readCapacity,
      writeCapacity,
      pressure: pressure * 100,
      latency,
      errorRate,
      cost,
      throughput,
      writeBottleneck,
    };
  }, [load, pooling, replicas, shards, verticalTier, writePercent]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Scaling lab
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Start with one overloaded database, then combine vertical scaling, read replicas,
            sharding, and pooling to meet the workload.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-linear-to-br from-zinc-950 via-neutral-950 to-stone-950 p-4 text-slate-100">
            <div className="mb-5 grid gap-3 md:grid-cols-4">
              <ArchitectureBlock label="App pool" value={pooling ? 'pooled' : 'direct'} icon={CircuitBoard} active={pooling} />
              <ArchitectureBlock label="Primary tier" value={`${verticalTier * 2} vCPU`} icon={HardDrive} active />
              <ArchitectureBlock label="Read replicas" value={`${replicas}`} icon={Server} active={replicas > 0} />
              <ArchitectureBlock label="Write shards" value={`${shards}`} icon={Layers3} active={shards > 1} />
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_72px_1fr_72px_1fr]">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">Application load</span>
                  <Badge className="bg-primary text-primary-foreground">{load} qps</Badge>
                </div>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="flex justify-between">
                    <span>Reads</span>
                    <span>{Math.round(metrics.readQps)} qps</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Writes</span>
                    <span>{Math.round(metrics.writeQps)} qps</span>
                  </div>
                </div>
              </div>
              <div className="hidden items-center md:flex">
                <FlowLine tone="primary" />
              </div>
              <div className="space-y-3">
                <NodeCard
                  title="Primary database"
                  subtitle={`${Math.round(metrics.writeCapacity)} write qps capacity`}
                  status={metrics.writeBottleneck && metrics.pressure > 90 ? 'hot' : 'healthy'}
                  load={metrics.writeQps / Math.max(metrics.writeCapacity, 1) * 100}
                  icon={Database}
                />
                <NodeCard
                  title="Connection pool"
                  subtitle={pooling ? 'reuses client sessions' : 'disabled'}
                  status={pooling ? 'routing' : 'lagging'}
                  load={pooling ? 38 : 88}
                  icon={CircuitBoard}
                />
              </div>
              <div className="hidden items-center md:flex">
                <FlowLine tone="success" delay={0.35} />
              </div>
              <div className="space-y-3">
                {Array.from({ length: Math.max(replicas, 1) }, (_, index) => (
                  <NodeCard
                    key={index}
                    title={index < replicas ? `Replica ${index + 1}` : 'No replicas'}
                    subtitle={index < replicas ? 'read traffic only' : 'reads hit primary'}
                    status={index < replicas ? 'healthy' : 'lagging'}
                    load={index < replicas ? metrics.readQps / Math.max(replicas, 1) / 3 : 90}
                    icon={Server}
                  />
                )).slice(0, 4)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4" />
              Scaling controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <ControlSlider label="Load" value={load} min={250} max={4200} step={50} suffix=" qps" onChange={setLoad} />
            <ControlSlider label="Write traffic" value={writePercent} min={5} max={85} step={5} suffix="%" onChange={setWritePercent} />
            <ControlSlider label="Vertical tier" value={verticalTier} min={1} max={6} step={1} suffix="x" onChange={setVerticalTier} />
            <ControlSlider label="Read replicas" value={replicas} min={0} max={5} step={1} onChange={setReplicas} />
            <ControlSlider label="Write shards" value={shards} min={1} max={6} step={1} onChange={setShards} />
            <Button
              type="button"
              variant={pooling ? 'default' : 'outline'}
              onClick={() => setPooling((value) => !value)}
              className="w-full"
            >
              <CircuitBoard className="mr-2 h-4 w-4" />
              {pooling ? 'Connection pooling enabled' : 'Enable connection pooling'}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <MetricCard
            label="Latency"
            value={ms(metrics.latency)}
            icon={Clock}
            tone={metrics.latency < 140 ? 'good' : metrics.latency < 260 ? 'warn' : 'bad'}
            detail={metrics.writeBottleneck ? 'writes are the bottleneck' : 'reads are the bottleneck'}
          />
          <MetricCard
            label="Throughput"
            value={`${Math.round(metrics.throughput)} qps`}
            icon={Activity}
            tone={metrics.throughput >= load ? 'good' : 'bad'}
            detail={`${Math.round(metrics.pressure)}% pressure`}
          />
          <MetricCard
            label="Error rate"
            value={pct(metrics.errorRate)}
            icon={AlertTriangle}
            tone={metrics.errorRate < 2 ? 'good' : metrics.errorRate < 10 ? 'warn' : 'bad'}
            detail="timeouts and saturated connections"
          />
          <MetricCard
            label="Cost"
            value={money(metrics.cost)}
            icon={WalletCards}
            tone={metrics.cost < 650 ? 'good' : metrics.cost < 1050 ? 'warn' : 'bad'}
            detail="estimated monthly infrastructure spend"
          />
        </div>

        <AdvisorCard
          title="Scaling readout"
          icon={Gauge}
          tone={metrics.errorRate > 10 ? 'bad' : metrics.pressure > 90 ? 'warn' : 'primary'}
        >
          {metrics.errorRate > 10
            ? 'The system is overloaded. Add capacity to the bottleneck path before increasing traffic.'
            : metrics.writeBottleneck
              ? 'Writes are limiting throughput. Read replicas will not fix this; use sharding or a larger primary tier.'
              : 'Read scaling and pooling are absorbing most of the pressure. Cost is the next tradeoff to watch.'}
        </AdvisorCard>
      </div>
    </div>
  );
}

function ArchitectureBlock({
  label,
  value,
  icon: Icon,
  active,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        active ? 'border-primary/40 bg-primary/10' : 'border-white/10 bg-white/5'
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

export default function DatabaseReplicationShardingScaling() {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/20 bg-linear-to-br from-background via-background to-muted/30">
        <CardContent className="p-0">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-6 sm:p-8">
              <Badge variant="secondary" className="mb-4">
                Interactive architecture lab
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                See how databases survive load, failure, and growth
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                Replication improves availability and read throughput. Sharding distributes data
                and write pressure. Scaling combines both with bigger nodes, pools, and cost
                tradeoffs.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <MiniOutcome icon={GitBranch} label="Replication" value="lag and failover" />
                <MiniOutcome icon={Boxes} label="Sharding" value="hot spots and routing" />
                <MiniOutcome icon={TrendingUp} label="Scaling" value="cost vs capacity" />
              </div>
            </div>
            <div className="relative min-h-[260px] overflow-hidden border-t bg-zinc-950 p-6 text-slate-100 lg:border-l lg:border-t-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,hsl(var(--primary)_/_0.26),transparent_34%),radial-gradient(circle_at_78%_72%,hsl(var(--primary)_/_0.14),transparent_38%)]" />
              <div className="relative grid h-full grid-cols-3 items-center gap-3">
                <NodeCard title="Primary" subtitle="writes" load={66} icon={Database} />
                <div className="space-y-5">
                  <FlowLine tone="primary" />
                  <FlowLine tone="success" delay={0.35} />
                  <FlowLine tone="warn" delay={0.7} />
                </div>
                <div className="space-y-3">
                  <NodeCard title="Shard 1" subtitle="replicated" load={48} icon={Layers3} />
                  <NodeCard title="Shard 2" subtitle="hot tenant" load={86} status="hot" icon={Layers3} />
                  <NodeCard title="Replica" subtitle="reads" load={36} icon={Server} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="replication" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-muted/40 p-1">
          <TabsTrigger value="replication" className="gap-1 px-2 text-xs sm:gap-2 sm:text-sm">
            <GitBranch className="h-4 w-4" />
            Replication
          </TabsTrigger>
          <TabsTrigger value="sharding" className="gap-1 px-2 text-xs sm:gap-2 sm:text-sm">
            <Boxes className="h-4 w-4" />
            Sharding
          </TabsTrigger>
          <TabsTrigger value="scaling" className="gap-1 px-2 text-xs sm:gap-2 sm:text-sm">
            <TrendingUp className="h-4 w-4" />
            Scaling
          </TabsTrigger>
        </TabsList>
        <TabsContent value="replication" className="mt-6">
          <ReplicationModePanel />
        </TabsContent>
        <TabsContent value="sharding" className="mt-6">
          <ShardingModePanel />
        </TabsContent>
        <TabsContent value="scaling" className="mt-6">
          <ScalingModePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MiniOutcome({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
