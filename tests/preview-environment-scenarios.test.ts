import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PREVIEW_FAILURES,
  advancePreviewEnvironment,
  applyPreviewRemediation,
  createPreviewEnvironmentState,
} from '../lib/games/preview-environment-engine';

// Every failure the engine knows must be reachable: the simulator only injects
// a failure through the pull request the learner opens.
describe('preview environment pull requests', () => {
  it('give every engine failure at least one pull request that triggers it', () => {
    const source = readFileSync(
      path.join(__dirname, '../components/games/preview-environment-simulator.tsx'),
      'utf8'
    );
    const used = new Set([...source.matchAll(/^\s{4}failure: '([a-z-]+)',$/gm)].map((m) => m[1]));
    for (const id of Object.keys(PREVIEW_FAILURES)) {
      expect(used, `no pull request triggers ${id}`).toContain(id);
    }
  });

  it('right-sizing a quota failure moves the preview to the balanced profile', () => {
    let state = createPreviewEnvironmentState({
      mode: 'single-service',
      services: ['api'],
      dataStrategy: 'synthetic',
      resourceProfile: 'production-like',
      reviewerAccess: 'team-sso',
      ttlHours: 6,
      revisionGate: true,
      injectedFailure: 'quota-exceeded',
    });
    for (let i = 0; i < 12 && state.status !== 'blocked'; i++)
      state = advancePreviewEnvironment(state);
    expect(state.activeFailure).toBe('quota-exceeded');
    state = applyPreviewRemediation(state, 'right-size-preview');
    expect(state.status).toBe('running');
    expect(state.config.resourceProfile).toBe('balanced');
  });
});
