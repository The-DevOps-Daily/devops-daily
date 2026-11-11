'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  GitBranch,
  Inbox,
  Layers,
  MessageSquare,
  MessageSquareWarning,
  Package,
  Pause,
  Play,
  Plus,
  Server,
  Trash2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  SIM_TONE,
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
import {
  MAX_DELIVERY_ATTEMPTS,
  REBALANCE_TICKS,
  activeConsumers as countActiveConsumers,
  addConsumer as addConsumerToState,
  backlogOf,
  createQueueState,
  injectPoison,
  produceMessages,
  removeConsumer as removeConsumerFromState,
  shortId,
  stepQueue,
  type QueueMode,
  type QueueState,
  type ScenarioId,
} from '@/lib/games/message-queue-engine';
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

type SimulatorState = QueueState;

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
    note: `In Kafka, a consumer joining or leaving makes the group rebalance: partitions change owner and the group stops consuming for a moment. Here a rebalance pauses the whole group for ${REBALANCE_TICKS} ticks, like the classic eager protocol. RabbitMQ consumers attach and leave without pausing the others.`,
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
    description: `A poison message fails every delivery; after ${MAX_DELIVERY_ATTEMPTS} attempts it moves to a dead letter queue for inspection.`,
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

const createState = (scenario: Scenario): SimulatorState => createQueueState(scenario);

function getScenario(id: ScenarioId) {
  return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0];
}

function isScenarioId(value: string): value is ScenarioId {
  return scenarios.some((scenario) => scenario.id === value);
}

interface MissionState {
  state: SimulatorState;
  scenario: Scenario;
  backlog: number;
  capacity: number;
  consumedModes: Record<QueueMode, boolean>;
}

const MISSIONS: Mission<MissionState>[] = [
  {
    id: 'flow',
    label: 'Send messages and watch consumers take them.',
    hint: 'Press Start, or Step to move the clock one tick.',
    check: ({ state, scenario }) => state.tick > 1 && state.processed > scenario.consumerRate,
  },
  {
    id: 'backlog',
    label: 'Let the queue back up and watch the lag grow.',
    hint: 'Press Remove to take a consumer away, or pick a flooding scenario in the menu, then Start.',
    check: ({ state, backlog, capacity }) => state.tick > 1 && backlog > capacity * 2,
  },
  {
    id: 'dlq',
    label: 'Send a message to the dead-letter queue.',
    hint: 'Press Poison message, then Start: a message that keeps failing moves to the DLQ after its last retry.',
    check: ({ state }) => state.dlq > 0,
  },
  {
    id: 'compare',
    label: 'Switch between the queue and the log and compare how they deliver.',
    hint: 'Press Queue, then Kafka log, and run each: a queue removes a message once it is acked; a log keeps it for every consumer group.',
    check: ({ consumedModes }) => consumedModes.kafka && consumedModes.rabbitmq,
  },
];

export default function MessageQueueSimulator() {
  const [mode, setMode] = useState<QueueMode>('kafka');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('normal');
  const scenario = useMemo(() => getScenario(scenarioId), [scenarioId]);
  const [state, setState] = useState<SimulatorState>(() => createState(scenario));
  const [tab, setTab] = useState('flow');
  const [dismissed, setDismissed] = useState(false);
  const [consumedModes, setConsumedModes] = useState<Record<QueueMode, boolean>>({
    kafka: false,
    rabbitmq: false,
  });

  const backlog = backlogOf(state);
  // Kafka consumers beyond the partition count sit idle; RabbitMQ consumers
  // compete on the same queue, so each one adds capacity.
  const activeConsumers = countActiveConsumers(state, mode);
  const rebalancing = state.rebalanceTicksLeft > 0;
  const idleConsumers = state.consumers - activeConsumers;
  const capacity = activeConsumers * scenario.consumerRate;
  const lagSeverity = Math.min(100, Math.round((backlog / Math.max(state.produced, 1)) * 100));
  // Nothing is consumed while a Kafka group rebalances.
  const throughput = rebalancing
    ? 0
    : Math.min(capacity, scenario.produceRate + Math.max(0, backlog - 4));
  const health =
    backlog > capacity * 4 || state.dlq > 2
      ? 'degraded'
      : backlog > capacity * 2 || state.dlq > 0 || state.poison !== null || rebalancing
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

  const produce = useCallback(() => {
    setState((current) => produceMessages(current, scenario, modeCopy[mode].broker));
  }, [mode, scenario]);

  const step = useCallback(() => {
    const next = stepQueue(state, scenario, mode);
    setState(next);
    if (next.processed > state.processed) {
      setConsumedModes((current) => (current[mode] ? current : { ...current, [mode]: true }));
    }
  }, [mode, scenario, state]);

  const addConsumer = useCallback(() => {
    setState((current) => addConsumerToState(current, mode));
  }, [mode]);

  const removeConsumer = useCallback(() => {
    setState((current) => removeConsumerFromState(current, mode));
  }, [mode]);

  const triggerFailure = useCallback(() => {
    setState((current) => injectPoison(current));
  }, []);

  useEffect(() => {
    setState(createState(scenario));
  }, [scenario, mode]);

  useEffect(() => {
    if (!state.isPlaying) return;

    const timer = window.setTimeout(step, 1100);
    return () => window.clearTimeout(timer);
  }, [state.isPlaying, state.tick, step]);

  const missionState = useMemo(
    () => ({ state, scenario, backlog, capacity, consumedModes }),
    [backlog, capacity, consumedModes, scenario, state]
  );
  const missions = useMissions(MISSIONS, missionState);

  const startOver = useCallback(() => {
    reset();
    setConsumedModes({ kafka: false, rabbitmq: false });
    missions.reset();
    setDismissed(false);
  }, [missions, reset]);

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="Message queue"
          icon={MessageSquare}
          lead={
            <>
              <div className="flex items-center gap-1" role="group" aria-label="Queue mode">
                {(['kafka', 'rabbitmq'] as const).map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant={mode === item ? 'default' : 'outline'}
                    className="h-10 px-2 text-xs lg:h-8"
                    aria-pressed={mode === item}
                    onClick={() => setMode(item)}
                  >
                    {item === 'kafka' ? (
                      <Layers className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <GitBranch className="h-4 w-4" aria-hidden="true" />
                    )}
                    {item === 'kafka' ? 'Kafka log' : 'Queue'}
                  </Button>
                ))}
              </div>
              <select
                aria-label="Scenario"
                value={scenarioId}
                onChange={(event) => {
                  const next = event.target.value;
                  if (isScenarioId(next)) setScenarioId(next);
                }}
                className="h-10 min-w-0 rounded-md border bg-background px-2 text-xs lg:h-8"
              >
                {scenarios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </>
          }
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={
            state.isPlaying
              ? `${mode === 'kafka' ? 'Log' : 'Queue'} clock is running`
              : `Tick ${state.tick}: ${scenario.title}`
          }
          actions={
            <>
              <Button
                type="button"
                className="hidden h-10 lg:flex lg:h-8"
                variant={state.isPlaying ? 'outline' : 'default'}
                onClick={() =>
                  setState((current) => ({ ...current, isPlaying: !current.isPlaying }))
                }
              >
                {state.isPlaying ? (
                  <Pause className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4" aria-hidden="true" />
                )}
                {state.isPlaying ? 'Pause' : 'Start'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="hidden h-10 lg:flex lg:h-8"
                onClick={step}
              >
                <Zap className="h-4 w-4" aria-hidden="true" />
                Step
              </Button>
            </>
          }
          goal={
            missions.complete ? (
              'All four missions are complete. Keep exploring queue behavior.'
            ) : (
              <>
                {missions.current?.label}{' '}
                <span className="text-muted-foreground">{missions.current?.hint}</span>
              </>
            )
          }
        />

        <SimAnnouncer
          message={`Tick ${state.tick}. ${backlog} messages waiting; ${state.processed} consumed.`}
        />

        {missions.complete && !dismissed ? (
          <SimComplete
            title="Message queue missions complete"
            summary="You sent messages through both delivery models, grew lag, and isolated a poison message."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Consumed', value: state.processed },
              { label: 'DLQ', value: state.dlq },
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
            columns="lg:grid-cols-[minmax(0,1.3fr)_minmax(17rem,0.7fr)]"
            minHeight="min-h-[22rem]"
            tab={tab}
            onTabChange={(next) => {
              if (next === 'flow' || next === 'details') setTab(next);
            }}
            tabsLabel="Message queue panels"
            panels={[
              {
                id: 'flow',
                label: 'Message flow',
                className: 'space-y-2',
                content: (
                  <section className="rounded-lg border bg-card p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">Producer to consumer flow</h3>
                        <p className="text-xs text-muted-foreground">{modeCopy[mode].storage}</p>
                      </div>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {rebalancing
                          ? 'Consumers rebalancing'
                          : `${activeConsumers} active${idleConsumers > 0 ? `, ${idleConsumers} idle` : ''}`}
                      </span>
                    </div>
                    <svg
                      viewBox="0 0 390 244"
                      role="img"
                      aria-label={`${modeCopy[mode].title} carrying messages from producers to consumers`}
                      className="mx-auto block h-auto w-full max-w-[390px]"
                    >
                      <line
                        x1="90"
                        y1="116"
                        x2="132"
                        y2="116"
                        className="stroke-border"
                        strokeWidth="2"
                      />
                      <line
                        x1="252"
                        y1="116"
                        x2="294"
                        y2="116"
                        className="stroke-border"
                        strokeWidth="2"
                      />
                      <line
                        x1="354"
                        y1="116"
                        x2="366"
                        y2="116"
                        className="stroke-border"
                        strokeWidth="2"
                      />
                      <path d="M126 111l8 5-8 5" className="fill-muted-foreground" />
                      <path d="M288 111l8 5-8 5" className="fill-muted-foreground" />
                      <path d="M360 111l8 5-8 5" className="fill-muted-foreground" />
                      <rect
                        x="8"
                        y="72"
                        width="82"
                        height="88"
                        rx="8"
                        className="fill-muted stroke-border"
                      />
                      <rect
                        x="132"
                        y="36"
                        width="120"
                        height="160"
                        rx="8"
                        className="fill-primary/10 stroke-primary"
                      />
                      <rect
                        x="294"
                        y="72"
                        width="60"
                        height="88"
                        rx="8"
                        className="fill-muted stroke-border"
                      />
                      <rect
                        x="366"
                        y="92"
                        width="12"
                        height="48"
                        rx="4"
                        className={cn(SIM_TONE.danger.surface, 'stroke-border')}
                      />
                      <text
                        x="49"
                        y="98"
                        textAnchor="middle"
                        className="fill-foreground text-xs font-semibold"
                      >
                        Producers
                      </text>
                      <text
                        x="49"
                        y="116"
                        textAnchor="middle"
                        className="fill-muted-foreground text-xs"
                      >
                        {scenario.produceRate}/tick
                      </text>
                      {visibleMessages.slice(0, 2).map((message, index) => (
                        <text
                          key={message.id}
                          x="49"
                          y={136 + index * 12}
                          textAnchor="middle"
                          className="fill-muted-foreground text-xs"
                        >
                          {message.id} {message.key}
                        </text>
                      ))}
                      <text
                        x="192"
                        y="57"
                        textAnchor="middle"
                        className="fill-foreground text-xs font-semibold"
                      >
                        {modeCopy[mode].title}
                      </text>
                      {partitionLoads.slice(0, 4).map((partition, index) => (
                        <g key={partition.id} transform={`translate(142 ${70 + index * 28})`}>
                          <rect
                            width="100"
                            height="20"
                            rx="4"
                            className="fill-background stroke-border"
                          />
                          <text x="5" y="14" className="fill-foreground text-xs">
                            {mode === 'kafka' ? 'P' : 'Q'}
                            {partition.id}: {partition.pending} waiting
                          </text>
                        </g>
                      ))}
                      <text
                        x="324"
                        y="98"
                        textAnchor="middle"
                        className="fill-foreground text-xs font-semibold"
                      >
                        Consumers
                      </text>
                      <text
                        x="324"
                        y="116"
                        textAnchor="middle"
                        className="fill-muted-foreground text-xs"
                      >
                        {rebalancing ? 'paused' : `${activeConsumers} acking`}
                      </text>
                      <text
                        x="372"
                        y="82"
                        textAnchor="middle"
                        className="fill-foreground text-xs font-semibold"
                      >
                        DLQ
                      </text>
                      <text
                        x="372"
                        y="158"
                        textAnchor="middle"
                        className="fill-muted-foreground text-xs"
                      >
                        {state.dlq}
                      </text>
                    </svg>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <div className="rounded-md bg-muted/50 p-2">
                        <MessageSquare
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Produced</p>
                        <p className="font-mono text-lg font-semibold tabular-nums">
                          {state.produced}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <CheckCircle2
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Consumed</p>
                        <p className="font-mono text-lg font-semibold tabular-nums">
                          {state.processed}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <p className="mt-1 text-xs text-muted-foreground">Lag</p>
                        <p className="font-mono text-lg font-semibold tabular-nums">{backlog}</p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <MessageSquareWarning
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Failures</p>
                        <p className="font-mono text-lg font-semibold tabular-nums">
                          {state.failed}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <Inbox className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <p className="mt-1 text-xs text-muted-foreground">DLQ</p>
                        <p className="font-mono text-lg font-semibold tabular-nums">{state.dlq}</p>
                      </div>
                    </div>
                  </section>
                ),
              },
              {
                id: 'details',
                label: 'Details',
                className: 'space-y-2',
                content: (
                  <>
                    <SimMissionList missions={missions.missions} />
                    <section className="rounded-lg border bg-card p-3">
                      <h3 className="text-sm font-semibold">Queue controls</h3>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 text-xs lg:h-8"
                          onClick={produce}
                        >
                          <Package className="h-4 w-4" aria-hidden="true" />
                          Produce
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 text-xs lg:h-8"
                          onClick={triggerFailure}
                        >
                          <MessageSquareWarning className="h-4 w-4" aria-hidden="true" />
                          Poison message
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 text-xs lg:h-8"
                          onClick={addConsumer}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Consumer
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 text-xs lg:h-8"
                          onClick={removeConsumer}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Remove
                        </Button>
                      </div>
                    </section>
                    <section className="rounded-lg border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">Consumer lag</h3>
                        <span className="font-mono text-sm font-semibold tabular-nums">
                          {lagSeverity}%
                        </span>
                      </div>
                      <Progress className="mt-2" value={lagSeverity} />
                      <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                          {health}: throughput {throughput}/tick, capacity {capacity}/tick, backlog{' '}
                          {backlog}.
                        </span>
                      </div>
                    </section>
                    <section className="rounded-lg border bg-card p-3">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" aria-hidden="true" />
                        <h3 className="text-sm font-semibold">
                          {mode === 'kafka' ? 'Partition ownership' : 'Queue bindings'}
                        </h3>
                      </div>
                      <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                        {partitionLoads.map((partition) => (
                          <li
                            key={partition.id}
                            className="flex justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5"
                          >
                            <span>
                              {mode === 'kafka'
                                ? `Partition ${partition.id}`
                                : `Queue ${partition.id}`}
                            </span>
                            <span className="font-mono">{partition.owner}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                    <section className="rounded-lg border bg-card p-3">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4" aria-hidden="true" />
                        <h3 className="text-sm font-semibold">Event log</h3>
                      </div>
                      <div className="mt-2 space-y-1 rounded-md bg-muted/50 p-2 font-mono text-xs text-muted-foreground">
                        {state.log.map((entry, index) => (
                          <p key={`${entry}-${index}`}>
                            {String(state.tick - index).padStart(2, '0')} | {entry}
                          </p>
                        ))}
                      </div>
                    </section>
                    <details className="rounded-lg border bg-card p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        How delivery differs
                      </summary>
                      <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                        <p>{modeCopy[mode].delivery}</p>
                        <p>{modeCopy[mode].consumer}</p>
                        <p>{scenario.note}</p>
                      </div>
                    </details>
                  </>
                ),
              },
            ]}
          />
        )}

        <SimPhoneBar>
          <Button
            type="button"
            className="h-10 flex-1"
            variant={state.isPlaying ? 'outline' : 'default'}
            onClick={() => setState((current) => ({ ...current, isPlaying: !current.isPlaying }))}
          >
            {state.isPlaying ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            {state.isPlaying ? 'Pause' : 'Start'}
          </Button>
          <Button type="button" variant="outline" className="h-10" onClick={step}>
            <Zap className="h-4 w-4" aria-hidden="true" />
            Step
          </Button>
          <SimResetButton onReset={startOver} />
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
