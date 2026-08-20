import { describe, expect, it } from 'vitest';
import {
  CLEANUP_STEPS,
  PREVIEW_FAILURES,
  PREVIEW_STAGES,
  advancePreviewEnvironment,
  applyPreviewRemediation,
  beginPreviewTeardown,
  createPreviewEnvironmentState,
  getGeneratedIntent,
  getPreviewMetrics,
  recordPreviewReview,
  type PreviewEnvironmentState,
} from '@/lib/games/preview-environment-engine';

function advanceUntilSettled(state: PreviewEnvironmentState): PreviewEnvironmentState {
  let next = state;
  for (let index = 0; index < PREVIEW_STAGES.length + 1; index += 1) {
    next = advancePreviewEnvironment(next);
    if (next.status === 'blocked' || next.status === 'ready') break;
  }
  return next;
}

describe('preview environment lifecycle', () => {
  it('advances one visible control-plane stage at a time', () => {
    let state = createPreviewEnvironmentState();
    expect(state.stageStatuses.intent).toBe('active');

    state = advancePreviewEnvironment(state);
    expect(state.stageStatuses.intent).toBe('complete');
    expect(state.stageStatuses.coordinate).toBe('active');
    expect(state.stageIndex).toBe(1);
  });

  it('creates a ready environment when every stage reconciles', () => {
    const state = advanceUntilSettled(createPreviewEnvironmentState());

    expect(state.status).toBe('ready');
    expect(Object.values(state.stageStatuses).every((status) => status === 'complete')).toBe(true);
    expect(state.lastEvent).toMatch(/Preview ready/);
  });

  it('blocks at the stage owned by the injected failure', () => {
    const state = advanceUntilSettled(
      createPreviewEnvironmentState({ injectedFailure: 'missing-secret' })
    );

    expect(state.status).toBe('blocked');
    expect(state.activeFailure).toBe('missing-secret');
    expect(state.stageStatuses.provision).toBe('failed');
  });

  it('keeps the environment blocked after the wrong remediation', () => {
    const blocked = advanceUntilSettled(
      createPreviewEnvironmentState({ injectedFailure: 'dns-pending' })
    );
    const state = applyPreviewRemediation(blocked, 'rebuild-images');

    expect(state.status).toBe('blocked');
    expect(state.failedRemediationAttempts).toBe(1);
    expect(state.activeFailure).toBe('dns-pending');
  });

  it('resumes reconciliation after the correct remediation', () => {
    const blocked = advanceUntilSettled(
      createPreviewEnvironmentState({ injectedFailure: 'revision-drift' })
    );
    const repaired = applyPreviewRemediation(
      blocked,
      PREVIEW_FAILURES['revision-drift'].correctRemediationId
    );
    const ready = advanceUntilSettled(repaired);

    expect(repaired.status).toBe('running');
    expect(repaired.resolvedFailures).toContain('revision-drift');
    expect(ready.status).toBe('ready');
    expect(ready.stageStatuses.verify).toBe('complete');
  });

  it('records an engineer decision without treating it as production deployment', () => {
    const ready = advanceUntilSettled(createPreviewEnvironmentState());
    const reviewed = recordPreviewReview(ready, 'approve');

    expect(reviewed.status).toBe('reviewed');
    expect(reviewed.reviewDecision).toBe('approve');
    expect(reviewed.lastEvent).toMatch(/production remains a separate reviewed path/i);
  });

  it('tears down every resource through the reconciled cleanup path', () => {
    const ready = advanceUntilSettled(createPreviewEnvironmentState());
    let state = beginPreviewTeardown(ready, 'pr-closed');

    for (let index = 0; index < CLEANUP_STEPS.length; index += 1) {
      state = advancePreviewEnvironment(state);
    }

    expect(state.status).toBe('removed');
    expect(Object.values(state.cleanupStatuses).every((status) => status === 'complete')).toBe(
      true
    );
    expect(state.teardownTrigger).toBe('pr-closed');
  });
});

describe('preview environment trade-offs', () => {
  it('makes a full-stack production-like preview slower and more expensive', () => {
    const lean = getPreviewMetrics(createPreviewEnvironmentState().config);
    const fullStack = getPreviewMetrics(
      createPreviewEnvironmentState({
        mode: 'full-stack',
        services: ['web', 'api', 'worker'],
        dataStrategy: 'masked-snapshot',
        resourceProfile: 'production-like',
        ttlHours: 24,
      }).config
    );

    expect(fullStack.provisionMinutes).toBeGreaterThan(lean.provisionMinutes);
    expect(fullStack.hourlyCost).toBeGreaterThan(lean.hourlyCost);
    expect(fullStack.estimatedRunCost).toBeGreaterThan(lean.estimatedRunCost);
    expect(fullStack.confidenceScore).toBeGreaterThan(lean.confidenceScore);
  });

  it('penalizes shared stage data and a public review link for isolation', () => {
    const isolated = getPreviewMetrics(createPreviewEnvironmentState().config);
    const shared = getPreviewMetrics(
      createPreviewEnvironmentState({
        dataStrategy: 'shared-stage',
        reviewerAccess: 'public-link',
      }).config
    );

    expect(shared.isolationScore).toBeLessThan(isolated.isolationScore);
  });

  it('renders distinct Git intent for label and full-stack modes', () => {
    const single = getGeneratedIntent(createPreviewEnvironmentState().config);
    const fullStack = getGeneratedIntent(
      createPreviewEnvironmentState({
        mode: 'full-stack',
        services: ['web', 'api', 'worker'],
      }).config
    );

    expect(single).toContain('label: preview');
    expect(fullStack).toContain('trigger: fullstack-preview');
    expect(fullStack).toContain('worker: feature/checkout-events');
  });
});
