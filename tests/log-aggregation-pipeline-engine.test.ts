import { describe, expect, it } from 'vitest';
import {
  PIPELINE_STAGES,
  advancePipeline,
  createPipelineState,
  getAccountedLogCount,
  getPipelineHealth,
  processorCapacity,
  updatePipelineSettings,
  type PipelineState,
} from '@/lib/games/log-aggregation-pipeline-engine';

function runSteps(state: PipelineState, steps: number): PipelineState {
  return Array.from({ length: steps }).reduce(advancePipeline, state);
}

function expectConservation(state: PipelineState) {
  expect(getAccountedLogCount(state)).toBe(state.generated);
  expect(state.shardLoads.reduce((sum, load) => sum + load, 0)).toBe(state.indexed);
}

describe('log aggregation pipeline', () => {
  it('advances exactly one visible stage at a time', () => {
    let state = createPipelineState();

    expect(PIPELINE_STAGES[state.stageIndex].id).toBe('sources');
    state = advancePipeline(state);
    expect(PIPELINE_STAGES[state.stageIndex].id).toBe('collector');
    expect(state.generated).toBe(24);
    expect(state.collected).toBe(0);

    state = advancePipeline(state);
    expect(PIPELINE_STAGES[state.stageIndex].id).toBe('processor');
    expect(state.collected).toBe(24);
    expectConservation(state);
  });

  it('moves a healthy batch from sources into searchable shards', () => {
    const state = runSteps(createPipelineState(), PIPELINE_STAGES.length);

    expect(state.indexed).toBeGreaterThan(0);
    expect(state.bufferQueue).toBe(0);
    expect(state.indexedLogs.length).toBeGreaterThan(0);
    expect(state.cycle).toBe(2);
    expectConservation(state);
  });

  it('builds source backlog during a traffic spike', () => {
    const state = runSteps(createPipelineState({ scenarioId: 'spike' }), 2);

    expect(state.sourceQueue).toBe(46);
    expect(state.processQueue).toBe(38);
    expectConservation(state);
  });

  it('shows slow indexing as a growing durable buffer', () => {
    const state = runSteps(
      createPipelineState({ scenarioId: 'slow-index', filterNoise: false }),
      PIPELINE_STAGES.length * 3
    );

    expect(state.indexed).toBe(27);
    expect(state.bufferQueue).toBeGreaterThan(state.indexed);
    expect(state.dropped).toBe(0);
    expectConservation(state);
  });

  it('accounts for parser rejects without leaking events', () => {
    const state = runSteps(
      createPipelineState({ scenarioId: 'parse-failure', filterNoise: false }),
      3
    );

    expect(state.parseFailed).toBeGreaterThan(0);
    expect(state.bufferQueue + state.parseFailed).toBe(state.processed);
    expectConservation(state);
  });

  it('makes the optional noise filter reduce indexed volume', () => {
    const filtered = runSteps(createPipelineState({ filterNoise: true }), 6);
    const unfiltered = runSteps(createPipelineState({ filterNoise: false }), 6);

    expect(filtered.filtered).toBeGreaterThan(0);
    expect(filtered.indexed).toBeLessThan(unfiltered.indexed);
    expectConservation(filtered);
    expectConservation(unfiltered);
  });

  it('resets counters when operational settings change', () => {
    const running = runSteps(createPipelineState(), 4);
    const reset = updatePipelineSettings(running, {
      scenarioId: 'parse-failure',
      parserMode: 'grok',
      filterNoise: false,
    });

    expect(reset.scenarioId).toBe('parse-failure');
    expect(reset.parserMode).toBe('grok');
    expect(reset.filterNoise).toBe(false);
    expect(reset.generated).toBe(0);
    expect(reset.stageIndex).toBe(0);
  });

  it('keeps a healthy pipeline healthy with the slower grok parser', () => {
    let state = createPipelineState({ parserMode: 'grok', filterNoise: false });
    expect(processorCapacity(state)).toBeLessThan(processorCapacity(createPipelineState()));
    for (let i = 0; i < PIPELINE_STAGES.length * 5; i += 1) {
      state = advancePipeline(state);
      expect(getPipelineHealth(state).tone).toBe('healthy');
    }
    expect(state.parseFailed).toBe(0);
    expectConservation(state);
  });

  it('warns when logs wait at the processor for more than a cycle', () => {
    const state = createPipelineState({ scenarioId: 'healthy' });
    const backlog = {
      ...state,
      processQueue: processorCapacity(state) + 1,
      generated: processorCapacity(state) + 1,
    };
    expect(getPipelineHealth(backlog).tone).toBe('warning');
  });

  it('only shows application errors in the search sample during the spike', () => {
    const healthy = runSteps(createPipelineState(), PIPELINE_STAGES.length * 4);
    const spike = runSteps(
      createPipelineState({ scenarioId: 'spike' }),
      PIPELINE_STAGES.length * 4
    );

    expect(healthy.indexedLogs.some((log) => log.level === 'ERROR')).toBe(false);
    expect(spike.indexedLogs.some((log) => log.level === 'ERROR')).toBe(true);
  });
});
