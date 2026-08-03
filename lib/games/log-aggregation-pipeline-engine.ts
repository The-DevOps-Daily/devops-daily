/**
 * Pure state machine for the log aggregation pipeline simulator.
 *
 * A tick advances one stage, not the whole pipeline. Keeping this logic free
 * from React makes the teaching flow deterministic and lets tests enforce the
 * same conservation rules an operator expects from a real pipeline.
 */

export type PipelineStageId =
  | 'sources'
  | 'collector'
  | 'processor'
  | 'buffer'
  | 'storage'
  | 'query';

export type LogScenarioId = 'healthy' | 'spike' | 'parse-failure' | 'slow-index';
export type ParserMode = 'json' | 'grok';
export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface PipelineStage {
  id: PipelineStageId;
  shortLabel: string;
  title: string;
  role: string;
  watches: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'sources',
    shortLabel: 'Sources',
    title: 'Apps & hosts',
    role: 'Applications, containers, and hosts emit raw log events.',
    watches: 'Watch the incoming rate. A sudden increase is often the first sign of an incident.',
  },
  {
    id: 'collector',
    shortLabel: 'Collect',
    title: 'Fluent Bit',
    role: 'A lightweight agent tails files and forwards each event.',
    watches: 'The source queue grows when agents cannot forward as fast as logs arrive.',
  },
  {
    id: 'processor',
    shortLabel: 'Process',
    title: 'Parse & filter',
    role: 'The processor extracts fields, enriches events, and removes noise.',
    watches: 'Parser rejects mean the incoming format no longer matches the configured parser.',
  },
  {
    id: 'buffer',
    shortLabel: 'Buffer',
    title: 'Durable buffer',
    role: 'A bounded queue absorbs short bursts and decouples parsing from indexing.',
    watches: 'A rising buffer is backpressure. A full buffer turns pressure into dropped logs.',
  },
  {
    id: 'storage',
    shortLabel: 'Index',
    title: 'Search cluster',
    role: 'Elasticsearch-style shards index the accepted, structured events.',
    watches: 'Uneven or saturated shards increase indexing and query latency.',
  },
  {
    id: 'query',
    shortLabel: 'Search',
    title: 'Explore logs',
    role: 'Operators query indexed fields to investigate production behavior.',
    watches:
      'Only indexed logs are searchable; filtered, rejected, and dropped logs never arrive here.',
  },
];

export interface LogScenario {
  id: LogScenarioId;
  label: string;
  summary: string;
  sourceRate: number;
  sourceCapacity: number;
  collectorCapacity: number;
  processorCapacity: number;
  bufferCapacity: number;
  indexCapacity: number;
  parseFailureRate: number;
  noiseRate: number;
}

export const LOG_SCENARIOS: Record<LogScenarioId, LogScenario> = {
  healthy: {
    id: 'healthy',
    label: 'Healthy flow',
    summary: 'Every stage has enough capacity, so queues drain normally.',
    sourceRate: 24,
    sourceCapacity: 100,
    collectorCapacity: 32,
    processorCapacity: 30,
    bufferCapacity: 120,
    indexCapacity: 28,
    parseFailureRate: 0,
    noiseRate: 0.2,
  },
  spike: {
    id: 'spike',
    label: 'Traffic spike',
    summary: 'A burst outruns collection and creates pressure at the edge.',
    sourceRate: 84,
    sourceCapacity: 150,
    collectorCapacity: 38,
    processorCapacity: 34,
    bufferCapacity: 130,
    indexCapacity: 30,
    parseFailureRate: 0,
    noiseRate: 0.18,
  },
  'parse-failure': {
    id: 'parse-failure',
    label: 'Parser mismatch',
    summary: 'A deployment changes the log format and structured parsing rejects events.',
    sourceRate: 30,
    sourceCapacity: 110,
    collectorCapacity: 36,
    processorCapacity: 34,
    bufferCapacity: 120,
    indexCapacity: 30,
    parseFailureRate: 0.45,
    noiseRate: 0.15,
  },
  'slow-index': {
    id: 'slow-index',
    label: 'Slow indexing',
    summary: 'Storage cannot keep up, so the durable buffer absorbs backpressure.',
    sourceRate: 36,
    sourceCapacity: 120,
    collectorCapacity: 40,
    processorCapacity: 38,
    bufferCapacity: 105,
    indexCapacity: 9,
    parseFailureRate: 0,
    noiseRate: 0.12,
  },
};

export interface IndexedLog {
  id: string;
  cycle: number;
  level: LogLevel;
  service: 'api' | 'worker' | 'checkout';
  message: string;
  parser: ParserMode;
  shard: number;
}

export interface PipelineState {
  scenarioId: LogScenarioId;
  parserMode: ParserMode;
  filterNoise: boolean;
  /** The next stage that will run. */
  stageIndex: number;
  cycle: number;
  sourceQueue: number;
  processQueue: number;
  bufferQueue: number;
  generated: number;
  collected: number;
  processed: number;
  filtered: number;
  parseFailed: number;
  indexed: number;
  dropped: number;
  shardLoads: [number, number, number];
  indexedLogs: IndexedLog[];
  lastEvent: string;
}

export interface PipelineSettings {
  scenarioId?: LogScenarioId;
  parserMode?: ParserMode;
  filterNoise?: boolean;
}

export function createPipelineState(settings: PipelineSettings = {}): PipelineState {
  return {
    scenarioId: settings.scenarioId ?? 'healthy',
    parserMode: settings.parserMode ?? 'json',
    filterNoise: settings.filterNoise ?? true,
    stageIndex: 0,
    cycle: 1,
    sourceQueue: 0,
    processQueue: 0,
    bufferQueue: 0,
    generated: 0,
    collected: 0,
    processed: 0,
    filtered: 0,
    parseFailed: 0,
    indexed: 0,
    dropped: 0,
    shardLoads: [0, 0, 0],
    indexedLogs: [],
    lastEvent: 'Ready. Generate a batch to start the pipeline.',
  };
}

function nextStage(state: PipelineState, changes: Partial<PipelineState>): PipelineState {
  const stageIndex = (state.stageIndex + 1) % PIPELINE_STAGES.length;
  return {
    ...state,
    ...changes,
    stageIndex,
    cycle: stageIndex === 0 ? state.cycle + 1 : state.cycle,
  };
}

function deterministicLoss(amount: number, rate: number): number {
  if (amount === 0 || rate === 0) return 0;
  return Math.max(1, Math.floor(amount * rate));
}

const SAMPLE_LOGS: Array<Pick<IndexedLog, 'level' | 'service' | 'message'>> = [
  { level: 'INFO', service: 'api', message: 'request completed status=200 latency=42ms' },
  { level: 'WARN', service: 'worker', message: 'job retry scheduled attempt=2' },
  { level: 'ERROR', service: 'checkout', message: 'payment provider timeout after=3s' },
  { level: 'INFO', service: 'checkout', message: 'cart converted order_id=ord_1042' },
  { level: 'WARN', service: 'api', message: 'rate limit at 82 percent capacity' },
  { level: 'INFO', service: 'worker', message: 'queue batch processed count=24' },
];

function makeIndexedLogs(
  state: PipelineState,
  count: number,
  shardLoads: [number, number, number]
): IndexedLog[] {
  if (count === 0) return state.indexedLogs;

  // Keep the browser table useful without pretending to render every event.
  const sampleCount = Math.min(4, count);
  const added = Array.from({ length: sampleCount }, (_, offset) => {
    const sequence = state.indexed + offset;
    const sample = SAMPLE_LOGS[sequence % SAMPLE_LOGS.length];
    const shard = sequence % shardLoads.length;
    return {
      ...sample,
      id: `log-${state.cycle}-${sequence}`,
      cycle: state.cycle,
      parser: state.parserMode,
      shard,
    };
  });

  return [...added, ...state.indexedLogs].slice(0, 24);
}

export function advancePipeline(state: PipelineState): PipelineState {
  const scenario = LOG_SCENARIOS[state.scenarioId];
  const stage = PIPELINE_STAGES[state.stageIndex].id;

  if (stage === 'sources') {
    const queued = state.sourceQueue + scenario.sourceRate;
    const overflow = Math.max(0, queued - scenario.sourceCapacity);
    return nextStage(state, {
      generated: state.generated + scenario.sourceRate,
      sourceQueue: queued - overflow,
      dropped: state.dropped + overflow,
      lastEvent: overflow
        ? `Sources emitted ${scenario.sourceRate} logs; ${overflow} were dropped before collection.`
        : `Sources emitted ${scenario.sourceRate} raw logs into the collection queue.`,
    });
  }

  if (stage === 'collector') {
    const moved = Math.min(state.sourceQueue, scenario.collectorCapacity);
    return nextStage(state, {
      sourceQueue: state.sourceQueue - moved,
      processQueue: state.processQueue + moved,
      collected: state.collected + moved,
      lastEvent: moved
        ? `Fluent Bit forwarded ${moved} logs to the processor.`
        : 'The collector found no new logs to forward.',
    });
  }

  if (stage === 'processor') {
    const moved = Math.min(state.processQueue, scenario.processorCapacity);
    const filtered = state.filterNoise ? deterministicLoss(moved, scenario.noiseRate) : 0;
    const parseCandidates = moved - filtered;
    const parserPenalty = state.parserMode === 'grok' ? 0.08 : 0;
    const parseFailed = deterministicLoss(
      parseCandidates,
      Math.min(0.9, scenario.parseFailureRate + parserPenalty)
    );
    const accepted = parseCandidates - parseFailed;
    const details = [
      `${accepted} accepted`,
      filtered ? `${filtered} noise filtered` : null,
      parseFailed ? `${parseFailed} parser rejects` : null,
    ]
      .filter(Boolean)
      .join(', ');

    return nextStage(state, {
      processQueue: state.processQueue - moved,
      bufferQueue: state.bufferQueue + accepted,
      processed: state.processed + moved,
      filtered: state.filtered + filtered,
      parseFailed: state.parseFailed + parseFailed,
      lastEvent: moved
        ? `Processor handled ${moved} logs: ${details}.`
        : 'The processor queue is empty.',
    });
  }

  if (stage === 'buffer') {
    const overflow = Math.max(0, state.bufferQueue - scenario.bufferCapacity);
    return nextStage(state, {
      bufferQueue: state.bufferQueue - overflow,
      dropped: state.dropped + overflow,
      lastEvent: overflow
        ? `The buffer reached capacity and dropped ${overflow} oldest logs.`
        : `${state.bufferQueue} logs are safely buffered for indexing.`,
    });
  }

  if (stage === 'storage') {
    const indexedNow = Math.min(state.bufferQueue, scenario.indexCapacity);
    const shardLoads: [number, number, number] = [
      state.shardLoads[0],
      state.shardLoads[1],
      state.shardLoads[2],
    ];
    for (let i = 0; i < indexedNow; i += 1) {
      shardLoads[(state.indexed + i) % shardLoads.length] += 1;
    }

    return nextStage(state, {
      bufferQueue: state.bufferQueue - indexedNow,
      indexed: state.indexed + indexedNow,
      shardLoads,
      indexedLogs: makeIndexedLogs(state, indexedNow, shardLoads),
      lastEvent: indexedNow
        ? `The search cluster indexed ${indexedNow} logs across three shards.`
        : 'The indexer found no buffered logs to write.',
    });
  }

  return nextStage(state, {
    lastEvent: state.indexed
      ? `Search refreshed. ${state.indexed} indexed logs are now queryable.`
      : 'Search refreshed, but no logs have reached the index yet.',
  });
}

export function updatePipelineSettings(
  state: PipelineState,
  settings: PipelineSettings
): PipelineState {
  return createPipelineState({
    scenarioId: settings.scenarioId ?? state.scenarioId,
    parserMode: settings.parserMode ?? state.parserMode,
    filterNoise: settings.filterNoise ?? state.filterNoise,
  });
}

export function getAccountedLogCount(state: PipelineState): number {
  return (
    state.sourceQueue +
    state.processQueue +
    state.bufferQueue +
    state.filtered +
    state.parseFailed +
    state.indexed +
    state.dropped
  );
}

export function getPipelineHealth(state: PipelineState): {
  tone: 'healthy' | 'warning' | 'critical';
  label: string;
  explanation: string;
} {
  const scenario = LOG_SCENARIOS[state.scenarioId];
  const bufferRatio = state.bufferQueue / scenario.bufferCapacity;

  if (state.dropped > 0) {
    return {
      tone: 'critical',
      label: 'Logs are being lost',
      explanation:
        'A bounded queue overflowed. Reduce input, add capacity, or restore the slow stage.',
    };
  }
  if (state.parseFailed > 0) {
    return {
      tone: 'critical',
      label: 'Parser rejects detected',
      explanation:
        'Valid-looking events are failing before indexing. Compare the parser with the new log format.',
    };
  }
  if (bufferRatio >= 0.65 || state.sourceQueue >= scenario.collectorCapacity) {
    return {
      tone: 'warning',
      label: 'Backpressure is building',
      explanation: 'An upstream queue is growing. The buffer buys time, but it is not infinite.',
    };
  }
  return {
    tone: 'healthy',
    label: 'Pipeline is healthy',
    explanation: 'Capacity is keeping up and accepted logs are progressing toward search.',
  };
}
