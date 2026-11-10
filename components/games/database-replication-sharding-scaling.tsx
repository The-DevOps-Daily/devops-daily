'use client';

import {
  useMemo,
  useState,
  type ComponentType,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { MotionConfig } from 'framer-motion';
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
  Split,
  TrendingUp,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  SimulatorAdvisorCard,
  SimulatorControlSlider,
  SimulatorFlowLine,
  SimulatorMetricCard,
  SimulatorModeButton,
  SimulatorNodeCard,
} from '@/components/games/simulator-primitives';
import {
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFrame,
  SimMissionList,
  SimResetButton,
  SimStage,
  useMissions,
  type Mission,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';

type ReplicationMode = 'async' | 'sync';
type ReplicationTopology = 'single-leader' | 'multi-leader' | 'leaderless';
type PartitioningMode = 'hash' | 'range';
type ShardKey = 'user_id' | 'region' | 'created_at' | 'tenant_id';
type DbMode = 'replication' | 'sharding' | 'scaling';

type ReplicationState = {
  mode: ReplicationMode;
  topology: ReplicationTopology;
  replicas: number;
  load: number;
  writePercent: number;
  consistency: number;
  primaryDown: boolean;
};
type ShardingState = {
  partitioning: PartitioningMode;
  shardKey: ShardKey;
  shards: number;
  rows: number;
  query: string;
};
type ScalingState = {
  load: number;
  writePercent: number;
  verticalTier: number;
  replicas: number;
  shards: number;
  pooling: boolean;
};

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
  "created_at > now() - '120 days'",
  "tenant_id = 'enterprise-7'",
];

// created_at data covers the last HISTORY_DAYS days. Range partitioning gives
// each shard an equal slice of that history, oldest first.
const HISTORY_DAYS = 360;

function createdAtRange(index: number, shards: number) {
  const span = HISTORY_DAYS / shards;
  return { fromDaysAgo: HISTORY_DAYS - index * span, toDaysAgo: HISTORY_DAYS - (index + 1) * span };
}

function createdAtRangeLabel(index: number, shards: number) {
  const { fromDaysAgo, toDaysAgo } = createdAtRange(index, shards);
  return toDaysAgo === 0
    ? `${fromDaysAgo} days ago to now`
    : `${fromDaysAgo} to ${toDaysAgo} days ago`;
}

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

const REPLICATION_DEFAULTS: ReplicationState = {
  mode: 'async',
  topology: 'single-leader',
  replicas: 3,
  load: 650,
  writePercent: 28,
  consistency: 55,
  primaryDown: false,
};
const SHARDING_DEFAULTS: ShardingState = {
  partitioning: 'hash',
  shardKey: 'user_id',
  shards: 4,
  rows: 120,
  query: querySamples[0],
};
const SCALING_DEFAULTS: ScalingState = {
  load: 1200,
  writePercent: 35,
  verticalTier: 2,
  replicas: 2,
  shards: 2,
  pooling: true,
};

function replicationMetrics(r: ReplicationState) {
  const { consistency, load, mode, primaryDown, replicas, topology, writePercent } = r;
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
    mode === 'sync' ? 12 + pressure * 18 : 80 + pressure * 220 + (100 - consistency) * 2.4;
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
  const staleReadRisk =
    mode === 'async'
      ? clamp(100 - consistency + pressure * 24, 4, 96)
      : clamp(12 - consistency * 0.08, 1, 12);
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
}

function shardingView(s: ShardingState) {
  const { partitioning, query, rows, shardKey, shards } = s;
  // Hashing spreads any high-cardinality key evenly, timestamps included.
  // Only few distinct values (region) or one huge tenant stay skewed.
  const skewByKey: Record<ShardKey, number[]> = {
    user_id: [1.04, 0.98, 1.01, 0.97, 1.02, 1.0],
    region: [1.75, 0.82, 0.7, 0.58, 0.5, 0.43],
    created_at: [0.98, 1.03, 0.99, 1.02, 0.97, 1.01],
    tenant_id: [2.15, 0.62, 0.55, 0.5, 0.46, 0.42],
  };
  const base = Array.from({ length: shards }, (_, index) => {
    const even = rows / shards;
    const skew =
      partitioning === 'hash'
        ? skewByKey[shardKey][index % 6]
        : 0.55 + index * (1.1 / Math.max(shards - 1, 1));
    return Math.round(even * skew);
  });
  const total = base.reduce((sum, value) => sum + value, 0);
  const distribution = base.map((value) => Math.max(4, Math.round((value / total) * rows)));
  const queryColumn = query.split(' ')[0] as ShardKey;
  const isRangeQuery = query.includes('>');
  const windowDays = Number(query.match(/'(\d+) days?'/)?.[1] ?? 0);
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
  const rebalanceCost =
    partitioning === 'hash' ? Math.round(rows / shards) : Math.round(rows * 0.42);
  const shardLoads = { max, avg, hotspot, queryIndex, rebalanceCost };
  // The router can only narrow the query when it filters on the shard key. A
  // range filter on a hashed key still goes everywhere, because hashing
  // scatters nearby values; on range shards it goes to every shard whose
  // slice of history overlaps the window.
  const all = Array.from({ length: shards }, (_, index) => index);
  const targetShards =
    queryColumn !== shardKey
      ? all
      : isRangeQuery
        ? partitioning === 'hash'
          ? all
          : all.filter((index) => createdAtRange(index, shards).toDaysAgo < windowDays)
        : [shardLoads.queryIndex];
  const fansOut = targetShards.length > 1;
  const hotSpotTone: 'bad' | 'warn' | 'good' =
    shardLoads.hotspot > 1.65 ? 'bad' : shardLoads.hotspot > 1.25 ? 'warn' : 'good';
  return {
    distribution,
    shardLoads,
    queryColumn,
    isRangeQuery,
    windowDays,
    targetShards,
    fansOut,
    hotSpotTone,
  };
}

function scalingMetrics(c: ScalingState) {
  const { load, pooling, replicas, shards, verticalTier, writePercent } = c;
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
}

type DbMissionState = {
  rep: ReplicationState & ReturnType<typeof replicationMetrics>;
  shard: ShardingState & ReturnType<typeof shardingView>;
  scale: ScalingState & ReturnType<typeof scalingMetrics>;
};
const MISSIONS: Mission<DbMissionState>[] = [
  {
    id: 'failover',
    label: 'Kill the primary, then keep writes working with split-brain risk under 45%.',
    hint: 'A single leader cannot take writes while it is down.',
    check: ({ rep }) =>
      rep.primaryDown &&
      rep.topology !== 'single-leader' &&
      rep.writeCapacity >= rep.writeQps &&
      rep.splitBrainRisk < 45,
  },
  {
    id: 'low-lag',
    label: 'With the primary up, get replication lag under 50 ms.',
    hint: 'Async replicas trail the leader. Sync commits wait for them.',
    check: ({ rep }) => !rep.primaryDown && rep.lag < 50,
  },
  {
    id: 'hot-shard',
    label: 'Pick a shard key that overloads one shard.',
    hint: 'A key with few values, like region, cannot spread evenly.',
    check: ({ shard }) => shard.shardLoads.hotspot > 1.65,
  },
  {
    id: 'one-shard',
    label: 'Send the last-day query to a single shard.',
    hint: 'Hashing scatters timestamps. Range shards on created_at keep recent rows together.',
    check: ({ shard }) => shard.query === querySamples[2] && shard.targetShards.length === 1,
  },
  {
    id: 'scale',
    label: 'Handle 3,000 qps with under 2% errors for less than $1,050 a month.',
    hint: 'Keep writes at 35% or more. Replicas add only read capacity.',
    check: ({ scale }) =>
      scale.load >= 3000 &&
      scale.writePercent >= 35 &&
      Math.round(scale.errorRate) < 2 &&
      scale.cost < 1050,
  },
];

function ReplicationControls({
  replication,
  setReplication,
}: {
  replication: ReplicationState;
  setReplication: Dispatch<SetStateAction<ReplicationState>>;
}) {
  const { consistency, load, mode, primaryDown, replicas, topology, writePercent } = replication;
  return (
    <>
      <Button
        type="button"
        variant={primaryDown ? 'destructive' : 'outline'}
        size="sm"
        onClick={() => setReplication((r) => ({ ...r, primaryDown: !r.primaryDown }))}
        className="h-10 lg:h-9"
      >
        {primaryDown ? <RefreshCw className="mr-2 h-4 w-4" /> : <X className="mr-2 h-4 w-4" />}
        {primaryDown ? 'Recover primary' : 'Kill primary'}
      </Button>
      <Choice label="Topology">
        <SimulatorModeButton
          value="single-leader"
          current={topology}
          onClick={(value) => setReplication((r) => ({ ...r, topology: value }))}
        >
          Single leader
        </SimulatorModeButton>
        <SimulatorModeButton
          value="multi-leader"
          current={topology}
          onClick={(value) => setReplication((r) => ({ ...r, topology: value }))}
        >
          Multi-leader
        </SimulatorModeButton>
        <SimulatorModeButton
          value="leaderless"
          current={topology}
          onClick={(value) => setReplication((r) => ({ ...r, topology: value }))}
        >
          Leaderless
        </SimulatorModeButton>
      </Choice>
      <Choice label="Commit mode">
        <SimulatorModeButton
          value="async"
          current={mode}
          onClick={(value) => setReplication((r) => ({ ...r, mode: value }))}
        >
          Async
        </SimulatorModeButton>
        <SimulatorModeButton
          value="sync"
          current={mode}
          onClick={(value) => setReplication((r) => ({ ...r, mode: value }))}
        >
          Sync
        </SimulatorModeButton>
      </Choice>
      <NumberButtons
        label="Replicas"
        value={replicas}
        onDown={() => setReplication((r) => ({ ...r, replicas: clamp(r.replicas - 1, 1, 5) }))}
        onUp={() => setReplication((r) => ({ ...r, replicas: clamp(r.replicas + 1, 1, 5) }))}
      />
      <SimulatorControlSlider
        label="Load"
        value={load}
        min={100}
        max={1600}
        step={50}
        suffix=" qps"
        onChange={(value) => setReplication((r) => ({ ...r, load: value }))}
      />
      <SimulatorControlSlider
        label="Writes"
        value={writePercent}
        min={5}
        max={80}
        step={5}
        suffix="%"
        onChange={(value) => setReplication((r) => ({ ...r, writePercent: value }))}
      />
      <SimulatorControlSlider
        label="Consistency preference"
        value={consistency}
        min={0}
        max={100}
        step={5}
        suffix="%"
        onChange={(value) => setReplication((r) => ({ ...r, consistency: value }))}
      />
    </>
  );
}

function ReplicationDiagram({
  replication,
  metrics,
}: {
  replication: ReplicationState;
  metrics: ReturnType<typeof replicationMetrics>;
}) {
  const { consistency, mode, primaryDown, replicas, topology } = replication;
  const leaderLabel =
    topology === 'single-leader'
      ? 'Primary'
      : topology === 'multi-leader'
        ? 'Leader A'
        : 'Coordinator';
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <SimulatorNodeCard
            title={leaderLabel}
            subtitle={
              primaryDown
                ? 'offline, failover needed'
                : `${Math.round(metrics.writeQps)} writes/sec`
            }
            status={primaryDown ? 'down' : metrics.pressure > 95 ? 'hot' : 'healthy'}
            load={metrics.pressure}
            icon={Database}
          />
          {topology === 'multi-leader' && (
            <SimulatorNodeCard
              title="Leader B"
              subtitle="accepts regional writes"
              status={metrics.splitBrainRisk > 50 ? 'lagging' : 'healthy'}
              load={Math.min(metrics.pressure * 0.75, 100)}
              icon={Split}
            />
          )}
        </div>
        <div className="flex items-center">
          <SimulatorFlowLine tone={mode === 'sync' ? 'success' : 'primary'} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: replicas }, (_, index) => (
            <SimulatorNodeCard
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
      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatusBlock
          label="Write path"
          value={
            topology === 'single-leader'
              ? 'leader only'
              : topology === 'multi-leader'
                ? 'regional leaders'
                : 'quorum writes'
          }
        />
        <StatusBlock
          label="Read path"
          value={consistency > 74 ? 'leader/quorum reads' : 'replica reads'}
        />
        <StatusBlock
          label="Failure behavior"
          value={
            primaryDown
              ? topology === 'single-leader'
                ? 'writes unavailable'
                : 'automatic failover'
              : 'normal operation'
          }
        />
      </div>
    </div>
  );
}

function ReplicationReadout({
  replication,
  metrics,
}: {
  replication: ReplicationState;
  metrics: ReturnType<typeof replicationMetrics>;
}) {
  const { mode, primaryDown, topology } = replication;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        <SimulatorMetricCard
          label="Replication lag"
          value={ms(metrics.lag)}
          icon={Clock}
          tone={metrics.lag > 260 ? 'warn' : 'good'}
          detail={
            mode === 'sync'
              ? 'lower lag, higher write latency'
              : 'higher throughput, possible stale reads'
          }
        />
        <SimulatorMetricCard
          label="Write capacity"
          value={`${Math.round(metrics.writeCapacity)} qps`}
          icon={Zap}
          tone={metrics.writeCapacity < metrics.writeQps ? 'bad' : 'good'}
          detail={`${Math.round(metrics.writeQps)} qps requested`}
        />
        <SimulatorMetricCard
          label="Availability"
          value={pct(metrics.availability)}
          icon={ShieldCheck}
          tone={metrics.availability > 98 ? 'good' : metrics.availability > 85 ? 'warn' : 'bad'}
          detail="failover and quorum effects"
        />
        <SimulatorMetricCard
          label="Split-brain risk"
          value={pct(metrics.splitBrainRisk)}
          icon={AlertTriangle}
          tone={metrics.splitBrainRisk > 45 ? 'bad' : metrics.splitBrainRisk > 18 ? 'warn' : 'good'}
          detail="lower with stronger coordination"
        />
      </div>
      <SimulatorAdvisorCard
        title="Operator readout"
        icon={Activity}
        tone={
          primaryDown && topology === 'single-leader'
            ? 'bad'
            : metrics.lag > 260
              ? 'warn'
              : 'primary'
        }
      >
        {primaryDown && topology === 'single-leader'
          ? 'The primary is down and this topology cannot accept writes until a replica is promoted.'
          : metrics.lag > 260
            ? 'Lag is climbing. Move critical reads to the leader, lower write pressure, or increase consistency for safer reads.'
            : 'This setup is healthy for the current workload. Reads are spread out while writes remain coordinated.'}
      </SimulatorAdvisorCard>
    </div>
  );
}

function ShardingControls({
  sharding,
  setSharding,
}: {
  sharding: ShardingState;
  setSharding: Dispatch<SetStateAction<ShardingState>>;
}) {
  const { partitioning, query, rows, shardKey, shards } = sharding;
  return (
    <>
      <Choice label="Partitioning">
        <SimulatorModeButton
          value="hash"
          current={partitioning}
          onClick={(value) => setSharding((s) => ({ ...s, partitioning: value }))}
        >
          Hash
        </SimulatorModeButton>
        <SimulatorModeButton
          value="range"
          current={partitioning}
          onClick={(value) => setSharding((s) => ({ ...s, partitioning: value }))}
        >
          Range
        </SimulatorModeButton>
      </Choice>
      <div>
        <div className="mb-2 text-sm font-medium">Shard key exercise</div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(shardKeyLabels) as ShardKey[]).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={key === shardKey ? 'default' : 'outline'}
              onClick={() => setSharding((s) => ({ ...s, shardKey: key }))}
              className="h-10 break-all px-2 text-xs"
            >
              {shardKeyLabels[key]}
            </Button>
          ))}
        </div>
      </div>
      <SimulatorControlSlider
        label="Rows"
        value={rows}
        min={40}
        max={320}
        step={20}
        suffix="k"
        onChange={(value) => setSharding((s) => ({ ...s, rows: value }))}
      />
      <NumberButtons
        label="Shards"
        value={shards}
        onDown={() => setSharding((s) => ({ ...s, shards: clamp(s.shards - 1, 2, 6) }))}
        onUp={() => setSharding((s) => ({ ...s, shards: clamp(s.shards + 1, 2, 6) }))}
      />
      <div>
        <div className="mb-2 text-sm font-medium">Query simulator</div>
        <div className="grid gap-2">
          {querySamples.map((sample) => (
            <Button
              key={sample}
              type="button"
              size="sm"
              variant={query === sample ? 'default' : 'outline'}
              onClick={() => setSharding((s) => ({ ...s, query: sample }))}
              className="h-auto min-h-10 justify-start whitespace-normal break-all py-2 text-left font-mono text-xs leading-snug"
            >
              {sample}
            </Button>
          ))}
        </div>
      </div>
    </>
  );
}

function ShardingDiagram({
  sharding,
  view,
}: {
  sharding: ShardingState;
  view: ReturnType<typeof shardingView>;
}) {
  const { partitioning, shardKey, shards } = sharding;
  const { distribution, fansOut, shardLoads, targetShards } = view;
  const tone = view.hotSpotTone === 'bad' ? SIM_TONE.danger.surface : SIM_TONE.warning.surface;
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="rounded-lg border bg-card px-3 py-2 text-sm">
          {partitioning === 'hash' ? 'Router hashes' : 'Router finds the range for'}{' '}
          <span className="text-primary">{shardKeyLabels[shardKey]}</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div className="rounded-lg border bg-card px-3 py-2 text-sm">
          Query sent to{' '}
          <span className="text-primary">
            {targetShards.length === shards
              ? `all ${shards} shards`
              : `shard${fansOut ? 's' : ''} ${targetShards.map((index) => index + 1).join(', ')}`}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {distribution.map((count, index) => {
          const load = (count / shardLoads.max) * 100;
          const isQueryShard = targetShards.includes(index);
          const isHot = count / shardLoads.avg > 1.35;
          return (
            <div
              key={index}
              className={cn(
                'rounded-lg border p-4',
                isQueryShard ? 'border-primary bg-primary/15' : isHot ? tone : 'bg-card'
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="whitespace-nowrap font-semibold">Shard {index + 1}</div>
                {isQueryShard && (
                  <Badge className="bg-primary text-primary-foreground">query</Badge>
                )}
              </div>
              <div className="flex h-28 items-end gap-1 rounded-md border bg-muted/30 p-2">
                {Array.from({ length: 9 }, (_, bar) => (
                  <div
                    key={bar}
                    className="flex-1 rounded-t-sm bg-primary"
                    style={{
                      height: `${clamp(load - bar * 5, 12, 100)}%`,
                      opacity: 0.38 + bar * 0.055,
                    }}
                  />
                ))}
              </div>
              {partitioning === 'range' && shardKey === 'created_at' && (
                <div className="mt-3 font-mono text-xs text-muted-foreground">
                  {createdAtRangeLabel(index, shards)}
                </div>
              )}
              <div className="mt-3 text-sm">{count}k rows</div>
              <div className="text-xs text-muted-foreground">{pct(load)} of hottest shard</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShardingReadout({
  sharding,
  view,
}: {
  sharding: ShardingState;
  view: ReturnType<typeof shardingView>;
}) {
  const { partitioning, shardKey } = sharding;
  const { fansOut, hotSpotTone, isRangeQuery, queryColumn, shardLoads, targetShards, windowDays } =
    view;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        <SimulatorMetricCard
          label="Hot spot ratio"
          value={`${shardLoads.hotspot.toFixed(2)}x`}
          icon={AlertTriangle}
          tone={hotSpotTone}
          detail="hottest shard compared with average"
        />
        <SimulatorMetricCard
          label="Rebalance movement"
          value={`${shardLoads.rebalanceCost}k rows`}
          icon={Shuffle}
          tone={partitioning === 'hash' ? 'good' : 'warn'}
          detail={
            partitioning === 'hash'
              ? 'smaller with consistent hashing'
              : 'range splits can move large chunks'
          }
        />
        <SimulatorMetricCard
          label="Query fanout"
          value={`${targetShards.length} shard${fansOut ? 's' : ''}`}
          icon={Network}
          tone={fansOut ? 'warn' : 'good'}
          detail="scatter/gather queries add latency"
        />
      </div>
      <SimulatorAdvisorCard
        title="Routing readout"
        icon={Route}
        tone={hotSpotTone === 'bad' ? 'bad' : hotSpotTone === 'warn' ? 'warn' : 'primary'}
      >
        {hotSpotTone === 'bad'
          ? 'The shard key is concentrating data. Pick a higher-cardinality key or add a routing layer that can split hot tenants.'
          : queryColumn !== shardKey
            ? `This query filters on ${queryColumn}, not the shard key ${shardKey}, so the router must ask every shard and merge the results. A secondary lookup table or a different shard key would keep it on one shard.`
            : isRangeQuery && partitioning === 'hash'
              ? 'Hash partitioning scatters nearby created_at values across shards, so a time-range query fans out to all of them. Range partitioning sends a time window only to the shards that hold it, but sends every new write to the newest shard.'
              : fansOut
                ? `The ${windowDays}-day window crosses a range boundary, so the router sends it to the ${targetShards.length} shards whose slices of history overlap it, and skips the rest.`
                : 'The router can target a single shard, so this query shape stays predictable as the dataset grows.'}
      </SimulatorAdvisorCard>
    </div>
  );
}

function ScalingControls({
  scaling,
  setScaling,
}: {
  scaling: ScalingState;
  setScaling: Dispatch<SetStateAction<ScalingState>>;
}) {
  const { load, pooling, replicas, shards, verticalTier, writePercent } = scaling;
  return (
    <>
      <SimulatorControlSlider
        label="Load"
        value={load}
        min={250}
        max={4200}
        step={50}
        suffix=" qps"
        onChange={(value) => setScaling((s) => ({ ...s, load: value }))}
      />
      <SimulatorControlSlider
        label="Write traffic"
        value={writePercent}
        min={5}
        max={85}
        step={5}
        suffix="%"
        onChange={(value) => setScaling((s) => ({ ...s, writePercent: value }))}
      />
      <SimulatorControlSlider
        label="Vertical tier"
        value={verticalTier}
        min={1}
        max={6}
        step={1}
        suffix="x"
        onChange={(value) => setScaling((s) => ({ ...s, verticalTier: value }))}
      />
      <SimulatorControlSlider
        label="Read replicas"
        value={replicas}
        min={0}
        max={5}
        step={1}
        onChange={(value) => setScaling((s) => ({ ...s, replicas: value }))}
      />
      <SimulatorControlSlider
        label="Write shards"
        value={shards}
        min={1}
        max={6}
        step={1}
        onChange={(value) => setScaling((s) => ({ ...s, shards: value }))}
      />
      <Button
        type="button"
        variant={pooling ? 'default' : 'outline'}
        onClick={() => setScaling((s) => ({ ...s, pooling: !s.pooling }))}
        aria-pressed={pooling}
        className="h-10 w-full lg:h-8"
      >
        <CircuitBoard className="mr-2 h-4 w-4" />
        {pooling ? 'Connection pooling enabled' : 'Enable connection pooling'}
      </Button>
    </>
  );
}

function ScalingDiagram({
  scaling,
  metrics,
}: {
  scaling: ScalingState;
  metrics: ReturnType<typeof scalingMetrics>;
}) {
  const { load, pooling, replicas, shards, verticalTier } = scaling;
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <ArchitectureBlock
          label="App pool"
          value={pooling ? 'pooled' : 'direct'}
          icon={CircuitBoard}
          active={pooling}
        />
        <ArchitectureBlock
          label="Primary tier"
          value={`${verticalTier * 2} vCPU`}
          icon={HardDrive}
          active
        />
        <ArchitectureBlock
          label="Read replicas"
          value={`${replicas}`}
          icon={Server}
          active={replicas > 0}
        />
        <ArchitectureBlock
          label="Write shards"
          value={`${shards}`}
          icon={Layers3}
          active={shards > 1}
        />
      </div>
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Application load</span>
              <Badge className="bg-primary text-primary-foreground">{load} qps</Badge>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
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
          <div className="space-y-3">
            <SimulatorNodeCard
              title="Primary database"
              subtitle={`${Math.round(metrics.writeCapacity)} write qps capacity`}
              status={metrics.writeBottleneck && metrics.pressure > 90 ? 'hot' : 'healthy'}
              load={(metrics.writeQps / Math.max(metrics.writeCapacity, 1)) * 100}
              icon={Database}
            />
            <SimulatorNodeCard
              title="Connection pool"
              subtitle={pooling ? 'reuses client sessions' : 'disabled'}
              status={pooling ? 'routing' : 'lagging'}
              load={pooling ? 38 : 88}
              icon={CircuitBoard}
            />
          </div>
        </div>
        <div className="flex items-center">
          <SimulatorFlowLine tone="success" delay={0.35} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: Math.max(replicas, 1) }, (_, index) => (
            <div key={index}>
              <SimulatorNodeCard
                title={index < replicas ? `Replica ${index + 1}` : 'No replicas'}
                subtitle={index < replicas ? 'read traffic only' : 'reads hit primary'}
                status={index < replicas ? 'healthy' : 'lagging'}
                load={index < replicas ? metrics.readQps / Math.max(replicas, 1) / 3 : 90}
                icon={Server}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScalingReadout({
  scaling,
  metrics,
}: {
  scaling: ScalingState;
  metrics: ReturnType<typeof scalingMetrics>;
}) {
  const { load } = scaling;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        <SimulatorMetricCard
          label="Latency"
          value={ms(metrics.latency)}
          icon={Clock}
          tone={metrics.latency < 140 ? 'good' : metrics.latency < 260 ? 'warn' : 'bad'}
          detail={
            metrics.writeBottleneck ? 'writes are the bottleneck' : 'reads are the bottleneck'
          }
        />
        <SimulatorMetricCard
          label="Throughput"
          value={`${Math.round(metrics.throughput)} qps`}
          icon={Activity}
          tone={metrics.throughput >= load ? 'good' : 'bad'}
          detail={`${Math.round(metrics.pressure)}% pressure`}
        />
        <SimulatorMetricCard
          label="Error rate"
          value={pct(metrics.errorRate)}
          icon={AlertTriangle}
          tone={metrics.errorRate < 2 ? 'good' : metrics.errorRate < 10 ? 'warn' : 'bad'}
          detail="timeouts and saturated connections"
        />
        <SimulatorMetricCard
          label="Cost"
          value={money(metrics.cost)}
          icon={WalletCards}
          tone={metrics.cost < 650 ? 'good' : metrics.cost < 1050 ? 'warn' : 'bad'}
          detail="estimated monthly infrastructure spend"
        />
      </div>
      <SimulatorAdvisorCard
        title="Scaling readout"
        icon={Gauge}
        tone={metrics.errorRate > 10 ? 'bad' : metrics.pressure > 90 ? 'warn' : 'primary'}
      >
        {metrics.errorRate > 10
          ? 'The system is overloaded. Add capacity to the bottleneck path before increasing traffic.'
          : metrics.writeBottleneck
            ? 'Writes are limiting throughput. Read replicas will not fix this; use sharding or a larger primary tier.'
            : 'Read scaling and pooling are absorbing most of the pressure. Cost is the next tradeoff to watch.'}
      </SimulatorAdvisorCard>
    </div>
  );
}

function Choice({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
function NumberButtons({
  label,
  value,
  onDown,
  onUp,
}: {
  label: string;
  value: number;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <Badge variant="secondary">{value}</Badge>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onDown} className="h-10 lg:h-8">
          -
        </Button>
        <Button size="sm" variant="outline" onClick={onUp} className="h-10 lg:h-8">
          +
        </Button>
      </div>
    </div>
  );
}
function StatusBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
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
        active ? 'border-primary/40 bg-primary/10' : 'bg-card'
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

export default function DatabaseReplicationShardingScaling() {
  const [mode, setMode] = useState<DbMode>('replication');
  const [tab, setTab] = useState('controls');
  const [replication, setReplication] = useState<ReplicationState>(REPLICATION_DEFAULTS);
  const [sharding, setSharding] = useState<ShardingState>(SHARDING_DEFAULTS);
  const [scaling, setScaling] = useState<ScalingState>(SCALING_DEFAULTS);
  const [dismissed, setDismissed] = useState(false);
  const replicationView = useMemo(() => replicationMetrics(replication), [replication]);
  const shardView = useMemo(() => shardingView(sharding), [sharding]);
  const scalingView = useMemo(() => scalingMetrics(scaling), [scaling]);
  const missionState = useMemo<DbMissionState>(
    () => ({
      rep: { ...replication, ...replicationView },
      shard: { ...sharding, ...shardView },
      scale: { ...scaling, ...scalingView },
    }),
    [replication, replicationView, scaling, scalingView, sharding, shardView]
  );
  const missions = useMissions(MISSIONS, missionState);
  function startOver() {
    setReplication(REPLICATION_DEFAULTS);
    setSharding(SHARDING_DEFAULTS);
    setScaling(SCALING_DEFAULTS);
    setMode('replication');
    missions.reset();
    setDismissed(false);
  }
  const headline =
    mode === 'replication'
      ? `Lag ${ms(replicationView.lag)}`
      : mode === 'sharding'
        ? `Hot spot ${shardView.shardLoads.hotspot.toFixed(2)}x`
        : money(scalingView.cost);
  const announcement =
    mode === 'replication'
      ? `Lag ${ms(replicationView.lag)}, write capacity ${Math.round(replicationView.writeCapacity)} for ${Math.round(replicationView.writeQps)} writes per second`
      : mode === 'sharding'
        ? `Hot spot ${shardView.shardLoads.hotspot.toFixed(2)}x, query reaches ${shardView.targetShards.length} shard${shardView.fansOut ? 's' : ''}`
        : `Latency ${ms(scalingView.latency)}, ${pct(scalingView.errorRate)} errors at ${money(scalingView.cost)}`;
  const controls =
    mode === 'replication' ? (
      <ReplicationControls replication={replication} setReplication={setReplication} />
    ) : mode === 'sharding' ? (
      <ShardingControls sharding={sharding} setSharding={setSharding} />
    ) : (
      <ScalingControls scaling={scaling} setScaling={setScaling} />
    );
  const diagram =
    mode === 'replication' ? (
      <ReplicationDiagram replication={replication} metrics={replicationView} />
    ) : mode === 'sharding' ? (
      <ShardingDiagram sharding={sharding} view={shardView} />
    ) : (
      <ScalingDiagram scaling={scaling} metrics={scalingView} />
    );
  const readout =
    mode === 'replication' ? (
      <ReplicationReadout replication={replication} metrics={replicationView} />
    ) : mode === 'sharding' ? (
      <ShardingReadout sharding={sharding} view={shardView} />
    ) : (
      <ScalingReadout scaling={scaling} metrics={scalingView} />
    );
  const diagramTitle =
    mode === 'replication'
      ? 'Replication topology'
      : mode === 'sharding'
        ? 'Shard map'
        : 'Scaling lab';
  const diagramDescription =
    mode === 'replication'
      ? 'Writes land on leaders, reads fan out to replicas, and lag appears when durability and latency pull in opposite directions.'
      : mode === 'sharding'
        ? 'Change the partitioning strategy and shard key to see hot spots and query routing.'
        : 'Start with one overloaded database, then combine vertical scaling, read replicas, sharding, and pooling to meet the workload.';
  return (
    <MotionConfig reducedMotion="user">
      <SimFrame>
        <SimBar
          title="Replication, Sharding & Scaling"
          icon={Database}
          lead={
            <div
              role="group"
              aria-label="Mode"
              className="flex w-full flex-wrap gap-1 sm:w-auto sm:min-w-0 sm:flex-1"
            >
              <Button
                type="button"
                size="sm"
                className="h-10 lg:h-8"
                variant={mode === 'replication' ? 'default' : 'outline'}
                aria-pressed={mode === 'replication'}
                onClick={() => setMode('replication')}
              >
                <GitBranch className="h-3.5 w-3.5" />
                Replication
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-10 lg:h-8"
                variant={mode === 'sharding' ? 'default' : 'outline'}
                aria-pressed={mode === 'sharding'}
                onClick={() => setMode('sharding')}
              >
                <Boxes className="h-3.5 w-3.5" />
                Sharding
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-10 lg:h-8"
                variant={mode === 'scaling' ? 'default' : 'outline'}
                aria-pressed={mode === 'scaling'}
                onClick={() => setMode('scaling')}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Scaling
              </Button>
            </div>
          }
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading="Missions"
          meta={
            <Badge variant="secondary" className="tabular-nums">
              {headline}
            </Badge>
          }
          goal={
            missions.current ? (
              <>
                {missions.current.label}{' '}
                <span className="text-muted-foreground">{missions.current.hint}</span>
              </>
            ) : (
              'All five done. Keep tuning.'
            )
          }
        />
        <SimAnnouncer message={announcement} />
        {missions.complete && !dismissed ? (
          <SimComplete
            title="Missions complete"
            summary="You failed over without losing writes, bought low lag with sync replication, overloaded a shard with a poor key, routed a time query to one shard, and scaled to 3,000 qps on a budget."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Monthly cost', value: money(scalingView.cost) },
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
            columns="lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.9fr)]"
            minHeight="min-h-[24rem]"
            tab={tab}
            onTabChange={setTab}
            tabsLabel="Simulator panels"
            panels={[
              {
                id: 'controls',
                label: 'Controls',
                className: 'space-y-2',
                content: (
                  <>
                    <section className="space-y-3 rounded-lg border bg-card p-3">
                      {controls}
                    </section>
                    <SimMissionList missions={missions.missions} />
                  </>
                ),
              },
              {
                id: 'diagram',
                label: 'Diagram',
                content: (
                  <section className="rounded-lg border bg-card p-3">
                    <h3 className="text-sm font-semibold">{diagramTitle}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{diagramDescription}</p>
                    <div className="mt-3">{diagram}</div>
                  </section>
                ),
              },
              {
                id: 'readout',
                label: 'Readout',
                className: 'space-y-2',
                content: <div className="space-y-2">{readout}</div>,
              },
            ]}
          />
        )}
      </SimFrame>
    </MotionConfig>
  );
}
