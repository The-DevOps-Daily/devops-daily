'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  GitBranch,
  Inbox,
  Layers,
  ListRestart,
  MessageSquare,
  MessageSquareWarning,
  Package,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Server,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type QueueMode = 'kafka' | 'rabbitmq';
type ScenarioId = 'normal' | 'lag' | 'rebalance' | 'ordering' | 'dlq' | 'backpressure';

interface Scenario {
  id: ScenarioId;
  title: string;
  badge: string;
  description: string;
  produceRate: number;
  consumerRate: number;
  defaultConsumers: number;
  defaultPartitions: number;
  failureEvery?: number;
  note: string;
}

interface SimulatorState {
  produced: number;
  processed: number;
  failed: number;
  dlq: number;
  tick: number;
  consumers: number;
  partitions: number;
  isPlaying: boolean;
  log: string[];
}

const scenarios: Scenario[] = [
  {
    id: 'normal',
    title: 'Normal operation',
    badge: 'healthy',
    description: 'Producers publish steadily and consumers keep up with the backlog.',
    produceRate: 6,
    consumerRate: 3,
    defaultConsumers: 2,
    defaultPartitions: 3,
    note: 'A balanced queue keeps lag low because consumer capacity roughly matches producer throughput.',
  },
  {
    id: 'lag',
    title: 'Consumer lag',
    badge: 'lag',
    description: 'A slow consumer group falls behind while the broker keeps accepting messages.',
    produceRate: 9,
    consumerRate: 2,
    defaultConsumers: 2,
    defaultPartitions: 4,
    note: 'Lag is not always an outage. It becomes dangerous when the backlog grows faster than it drains.',
  },
  {
    id: 'rebalance',
    title: 'Rebalancing',
    badge: 'join/leave',
    description: 'Consumers join or leave and ownership shifts across partitions or queues.',
    produceRate: 7,
    consumerRate: 3,
    defaultConsumers: 2,
    defaultPartitions: 4,
    note: 'Rebalancing increases capacity, but it can pause processing while ownership changes.',
  },
  {
    id: 'ordering',
    title: 'Ordering guarantees',
    badge: 'per-key',
    description: 'Messages with the same key stay ordered inside one partition or queue path.',
    produceRate: 5,
    consumerRate: 2,
    defaultConsumers: 2,
    defaultPartitions: 3,
    note: 'Kafka ordering is per partition. RabbitMQ ordering is per queue path and can change with parallel consumers.',
  },
  {
    id: 'dlq',
    title: 'Dead letter handling',
    badge: 'poison',
    description: 'Poison messages fail retries and move to a dead letter queue for inspection.',
    produceRate: 6,
    consumerRate: 3,
    defaultConsumers: 2,
    defaultPartitions: 3,
    failureEvery: 2,
    note: 'DLQs keep one bad message from blocking the whole stream, but they still need alerting and replay tooling.',
  },
  {
    id: 'backpressure',
    title: 'Backpressure',
    badge: 'overload',
    description: 'Producers overwhelm consumer capacity and the broker becomes a pressure buffer.',
    produceRate: 12,
    consumerRate: 2,
    defaultConsumers: 2,
    defaultPartitions: 4,
    note: 'Backpressure is the signal that producers, consumers, or the broker need flow control.',
  },
];

const modeCopy: Record<
  QueueMode,
  {
    title: string;
    broker: string;
    storage: string;
    routing: string;
    delivery: string;
    consumer: string;
  }
> = {
  kafka: {
    title: 'Kafka topic',
    broker: 'Topic log',
    storage: 'Append-only partitions retain messages by offset.',
    routing: 'Key hash chooses a partition; ordering is preserved within that partition.',
    delivery: 'Consumers commit offsets after processing for at-least-once delivery.',
    consumer: 'Consumer groups share partitions. One partition is read by one consumer in a group.',
  },
  rabbitmq: {
    title: 'RabbitMQ exchange',
    broker: 'Exchange + queues',
    storage: 'Queues hold messages until consumers ack or reject them.',
    routing: 'Direct, fanout, and topic exchanges route messages through bindings.',
    delivery: 'Acknowledgments remove messages; nacks can retry or dead-letter.',
    consumer: 'Consumers compete on queues. Prefetch controls how many messages each can hold.',
  },
};

const messageKeys = ['orders', 'billing', 'email', 'audit', 'metrics', 'alerts'];

function createState(scenario: Scenario): SimulatorState {
  return {
    produced: scenario.produceRate * 2,
    processed: scenario.consumerRate,
    failed: 0,
    dlq: 0,
    tick: 1,
    consumers: scenario.defaultConsumers,
    partitions: scenario.defaultPartitions,
    isPlaying: false,
    log: [
      `producer published ${scenario.produceRate * 2} messages`,
      `consumer group started with ${scenario.defaultConsumers} consumers`,
    ],
  };
}

function getScenario(id: ScenarioId) {
  return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0];
}

function shortId(value: number) {
  return `m-${String(value).padStart(3, '0')}`;
}

function getStatusColor(value: number, warning: number, danger: number) {
  if (value >= danger) return 'text-red-500';
  if (value >= warning) return 'text-amber-500';
  return 'text-emerald-500';
}

export default function MessageQueueSimulator() {
  const [mode, setMode] = useState<QueueMode>('kafka');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('normal');
  const scenario = useMemo(() => getScenario(scenarioId), [scenarioId]);
  const [state, setState] = useState<SimulatorState>(() => createState(scenario));

  const backlog = Math.max(state.produced - state.processed - state.dlq, 0);
  const capacity = state.consumers * scenario.consumerRate;
  const lagSeverity = Math.min(100, Math.round((backlog / Math.max(state.produced, 1)) * 100));
  const throughput = Math.min(capacity, scenario.produceRate + Math.max(0, backlog - 4));
  const health =
    backlog > capacity * 4 || state.failed > 4
      ? 'degraded'
      : backlog > capacity * 2 || state.failed > 0
        ? 'watch'
        : 'healthy';

  const partitionLoads = useMemo(() => {
    return Array.from({ length: state.partitions }, (_, index) => {
      const key = messageKeys[index % messageKeys.length];
      const pending = Math.max(
        0,
        Math.floor(backlog / state.partitions) + ((state.produced + index) % 3) - 1
      );
      const owner = state.consumers === 0 ? 'paused' : `consumer-${(index % state.consumers) + 1}`;

      return {
        id: index,
        key,
        pending,
        owner,
        offset: Math.max(0, Math.floor(state.processed / state.partitions) + index),
      };
    });
  }, [backlog, state.consumers, state.partitions, state.processed, state.produced]);

  const visibleMessages = useMemo(() => {
    const count = Math.min(8, Math.max(3, backlog + state.dlq));
    return Array.from({ length: count }, (_, index) => ({
      id: shortId(Math.max(1, state.produced - index)),
      key: messageKeys[(state.produced + index) % messageKeys.length],
      failed: index < state.dlq && scenario.id === 'dlq',
    }));
  }, [backlog, scenario.id, state.dlq, state.produced]);

  const reset = useCallback(() => {
    setState(createState(scenario));
  }, [scenario]);

  const appendLog = useCallback((current: SimulatorState, entry: string) => {
    return [entry, ...current.log].slice(0, 7);
  }, []);

  const produce = useCallback(() => {
    setState((current) => ({
      ...current,
      produced: current.produced + scenario.produceRate,
      log: appendLog(current, `produced ${scenario.produceRate} messages to ${modeCopy[mode].broker}`),
    }));
  }, [appendLog, mode, scenario.produceRate]);

  const step = useCallback(() => {
    setState((current) => {
      const currentBacklog = Math.max(current.produced - current.processed - current.dlq, 0);
      const maxProcessed = Math.min(currentBacklog, current.consumers * scenario.consumerRate);
      const shouldFail =
        scenario.failureEvery !== undefined && current.tick % scenario.failureEvery === 0 && maxProcessed > 0;
      const failures = shouldFail ? 1 : 0;
      const processed = Math.max(0, maxProcessed - failures);
      const nextProduced =
        scenario.id === 'backpressure' || scenario.id === 'lag'
          ? current.produced + scenario.produceRate
          : current.produced + Math.ceil(scenario.produceRate / 2);
      const rebalanceNote =
        scenario.id === 'rebalance' && current.tick % 3 === 0
          ? `rebalance assigned ${current.partitions} ${mode === 'kafka' ? 'partitions' : 'queues'}`
          : `processed ${processed}, backlog ${Math.max(currentBacklog - processed - failures, 0)}`;
      const failureNote = failures > 0 ? `moved ${failures} poison message to DLQ` : rebalanceNote;

      return {
        ...current,
        produced: nextProduced,
        processed: current.processed + processed,
        failed: current.failed + failures,
        dlq: current.dlq + failures,
        tick: current.tick + 1,
        log: appendLog(current, failureNote),
      };
    });
  }, [appendLog, mode, scenario.consumerRate, scenario.failureEvery, scenario.id, scenario.produceRate]);

  const addConsumer = useCallback(() => {
    setState((current) => ({
      ...current,
      consumers: Math.min(5, current.consumers + 1),
      log: appendLog(current, `consumer-${Math.min(5, current.consumers + 1)} joined group`),
    }));
  }, [appendLog]);

  const removeConsumer = useCallback(() => {
    setState((current) => ({
      ...current,
      consumers: Math.max(1, current.consumers - 1),
      log: appendLog(current, `consumer left; ${Math.max(1, current.consumers - 1)} remain`),
    }));
  }, [appendLog]);

  const triggerFailure = useCallback(() => {
    setState((current) => ({
      ...current,
      failed: current.failed + 1,
      dlq: current.dlq + 1,
      log: appendLog(current, 'poison message retried and sent to DLQ'),
    }));
  }, [appendLog]);

  useEffect(() => {
    setState(createState(scenario));
  }, [scenario, mode]);

  useEffect(() => {
    if (!state.isPlaying) return;

    const timer = window.setTimeout(step, 1100);
    return () => window.clearTimeout(timer);
  }, [state.isPlaying, state.tick, step]);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-md border bg-muted/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-primary">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <p className="font-mono text-xs text-muted-foreground">// message queue lab</p>
              <h2 className="text-2xl font-bold md:text-3xl">Message Queue Simulator</h2>
            </div>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Visualize producers, brokers, partitions, queues, consumer groups, lag, rebalancing,
            backpressure, and dead letter handling across Kafka and RabbitMQ style systems.
          </p>
        </div>

        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 gap-2">
              {(['kafka', 'rabbitmq'] as const).map((item) => (
                <Button
                  key={item}
                  variant={mode === item ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode(item)}
                  className="justify-start"
                >
                  {item === 'kafka' ? (
                    <Layers className="mr-2 h-4 w-4" />
                  ) : (
                    <GitBranch className="mr-2 h-4 w-4" />
                  )}
                  {item === 'kafka' ? 'Kafka' : 'RabbitMQ'}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{modeCopy[mode].storage}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {scenarios.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setScenarioId(item.id)}
            className={cn(
              'rounded-md border p-3 text-left transition-colors',
              item.id === scenarioId
                ? 'border-primary/60 bg-primary/10'
                : 'border-border hover:border-primary/40 hover:bg-muted/30'
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{item.title}</span>
              <Badge variant={item.id === scenarioId ? 'default' : 'secondary'} className="text-[10px]">
                {item.badge}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-5 w-5" />
                  Live Message Flow
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={produce}>
                    <Plus className="mr-1 h-4 w-4" />
                    Produce
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setState((current) => ({ ...current, isPlaying: !current.isPlaying }))}
                  >
                    {state.isPlaying ? (
                      <Pause className="mr-1 h-4 w-4" />
                    ) : (
                      <Play className="mr-1 h-4 w-4" />
                    )}
                    {state.isPlaying ? 'Pause' : 'Play'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={step}>
                    <Zap className="mr-1 h-4 w-4" />
                    Step
                  </Button>
                  <Button size="sm" variant="ghost" onClick={reset}>
                    <RotateCcw className="mr-1 h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto_1.3fr_auto_1fr_auto_0.85fr]">
                <FlowNode
                  title="Producers"
                  icon={<Package className="h-5 w-5" />}
                  subtitle={`${scenario.produceRate}/tick`}
                  tone="blue"
                >
                  {visibleMessages.slice(0, 3).map((message) => (
                    <MessagePill key={message.id} id={message.id} label={message.key} />
                  ))}
                </FlowNode>

                <FlowArrow />

                <FlowNode
                  title={modeCopy[mode].title}
                  icon={<Server className="h-5 w-5" />}
                  subtitle={modeCopy[mode].broker}
                  tone="primary"
                >
                  <div className="grid gap-2">
                    {partitionLoads.map((partition) => (
                      <div key={partition.id} className="rounded-md border bg-background/70 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs">
                            {mode === 'kafka' ? `partition-${partition.id}` : `queue-${partition.id}`}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {partition.pending} pending
                          </Badge>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, partition.pending * 18)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          key: {partition.key} / owner: {partition.owner}
                        </p>
                      </div>
                    ))}
                  </div>
                </FlowNode>

                <FlowArrow />

                <FlowNode
                  title="Consumers"
                  icon={<Users className="h-5 w-5" />}
                  subtitle={`${state.consumers} active`}
                  tone="emerald"
                >
                  <div className="grid gap-2">
                    {Array.from({ length: state.consumers }, (_, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-md border bg-background/70 p-2"
                      >
                        <span className="text-sm font-medium">consumer-{index + 1}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {mode === 'kafka' ? 'offset commit' : 'manual ack'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </FlowNode>

                <FlowArrow />

                <FlowNode
                  title="DLQ"
                  icon={<Inbox className="h-5 w-5" />}
                  subtitle={`${state.dlq} failed`}
                  tone={state.dlq > 0 ? 'red' : 'muted'}
                >
                  {state.dlq > 0 ? (
                    visibleMessages
                      .slice(0, Math.min(3, state.dlq))
                      .map((message) => <MessagePill key={message.id} id={message.id} label="poison" failed />)
                  ) : (
                    <p className="text-xs text-muted-foreground">No poison messages yet.</p>
                  )}
                </FlowNode>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <MetricCard label="Produced" value={state.produced} icon={<MessageSquare className="h-4 w-4" />} />
                <MetricCard label="Processed" value={state.processed} icon={<CheckCircle2 className="h-4 w-4" />} />
                <MetricCard label="Lag" value={backlog} icon={<Clock className="h-4 w-4" />} danger={backlog > capacity * 3} />
                <MetricCard label="DLQ" value={state.dlq} icon={<XCircle className="h-4 w-4" />} danger={state.dlq > 0} />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-5 w-5" />
                  {mode === 'kafka' ? 'Partition Ownership' : 'Queue Bindings'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0">
                {partitionLoads.map((partition) => (
                  <div key={partition.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {mode === 'kafka' ? `Partition ${partition.id}` : `Queue ${partition.id}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {mode === 'kafka'
                            ? `offset ${partition.offset}, key ${partition.key}`
                            : `binding ${partition.key}.*, ${partition.pending} ready`}
                        </p>
                      </div>
                      <Badge variant="secondary">{partition.owner}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListRestart className="h-5 w-5" />
                  Event Log
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="rounded-md border bg-[#171717] p-3 font-mono text-sm">
                  <div className="space-y-2">
                    {state.log.map((entry, index) => (
                      <p key={`${entry}-${index}`} className={index === 0 ? 'text-green-400' : 'text-slate-300'}>
                        {String(state.tick - index).padStart(2, '0')} | {entry}
                      </p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-5 w-5" />
                Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={addConsumer}>
                  <Plus className="mr-1 h-4 w-4" />
                  Consumer
                </Button>
                <Button size="sm" variant="outline" onClick={removeConsumer}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Remove
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={triggerFailure} className="w-full">
                <MessageSquareWarning className="mr-1 h-4 w-4" />
                Trigger poison message
              </Button>

              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Consumer lag</span>
                  <span className={cn('text-sm font-semibold', getStatusColor(lagSeverity, 35, 65))}>
                    {lagSeverity}%
                  </span>
                </div>
                <Progress value={lagSeverity} />
              </div>

              <div className="rounded-md border p-3">
                <p className="mb-1 text-xs font-mono text-muted-foreground">// selected scenario</p>
                <p className="font-medium">{scenario.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{scenario.note}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5" />
                Delivery Guarantees
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              <Guarantee label="At most once" detail="Ack before work; fast but messages can disappear." />
              <Guarantee label="At least once" detail="Ack after work; safe but handlers must be idempotent." active />
              <Guarantee label="Exactly once" detail="Requires broker and consumer coordination, not just a retry loop." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <div
                className={cn(
                  'rounded-md border p-3',
                  health === 'healthy' && 'border-emerald-500/30 bg-emerald-500/10',
                  health === 'watch' && 'border-amber-500/30 bg-amber-500/10',
                  health === 'degraded' && 'border-red-500/30 bg-red-500/10'
                )}
              >
                <p className="text-sm font-medium capitalize">{health}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Throughput {throughput}/tick, capacity {capacity}/tick, backlog {backlog}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">{modeCopy[mode].delivery}</p>
              <p className="text-sm text-muted-foreground">{modeCopy[mode].consumer}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ComparisonCard
          title="Kafka mental model"
          icon={<Layers className="h-5 w-5" />}
          points={[
            'Topics are append-only logs split into partitions.',
            'Offsets are the consumer group checkpoint.',
            'Scaling is limited by partition count per consumer group.',
            'Ordering is reliable only inside a partition.',
          ]}
        />
        <ComparisonCard
          title="RabbitMQ mental model"
          icon={<GitBranch className="h-5 w-5" />}
          points={[
            'Exchanges route messages into queues through bindings.',
            'Messages leave a queue when they are acknowledged.',
            'Prefetch and ack mode control backpressure.',
            'DLX policies route rejected or expired messages to dead letter queues.',
          ]}
        />
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="hidden items-center justify-center text-muted-foreground lg:flex">
      <ArrowRight className="h-6 w-6" />
    </div>
  );
}

function FlowNode({
  title,
  subtitle,
  icon,
  tone,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  tone: 'blue' | 'primary' | 'emerald' | 'red' | 'muted';
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'min-h-52 rounded-md border p-3',
        tone === 'blue' && 'border-blue-500/30 bg-blue-500/10',
        tone === 'primary' && 'border-primary/30 bg-primary/10',
        tone === 'emerald' && 'border-emerald-500/30 bg-emerald-500/10',
        tone === 'red' && 'border-red-500/30 bg-red-500/10',
        tone === 'muted' && 'border-border bg-muted/20'
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-md border bg-background/70 p-1.5">{icon}</div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MessagePill({ id, label, failed = false }: { id: string; label: string; failed?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md border bg-background/80 px-2 py-1.5 text-xs',
        failed ? 'border-red-500/40 text-red-400' : 'border-border text-foreground'
      )}
    >
      <span className="font-mono">{id}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  danger = false,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  danger?: boolean;
}) {
  return (
    <div className={cn('rounded-md border bg-card p-3', danger && 'border-amber-500/40 bg-amber-500/10')}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Guarantee({ label, detail, active = false }: { label: string; detail: string; active?: boolean }) {
  return (
    <div className={cn('rounded-md border p-2.5', active && 'border-primary/40 bg-primary/10')}>
      <div className="flex items-center gap-2">
        {active ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
        <span className="font-medium">{label}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function ComparisonCard({
  title,
  icon,
  points,
}: {
  title: string;
  icon: ReactNode;
  points: string[];
}) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ul className="space-y-2 text-sm text-muted-foreground">
          {points.map((point) => (
            <li key={point} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
