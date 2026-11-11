import { describe, expect, it } from 'vitest';
import {
  advanceClock,
  cacheKey,
  canStore,
  createLab,
  currentAssetPath,
  deploy,
  edgeEntries,
  freshnessLifetime,
  HEADER_PRESETS,
  parseCacheControl,
  purgePath,
  request,
  sendTraffic,
  setHeader,
  setIgnoreUtm,
} from '@/lib/games/cdn-edge-cache-lab-engine';

describe('CDN Edge Cache Lab engine', () => {
  it('uses method, target URI including query, and Vary headers in the cache key', () => {
    expect(cacheKey('GET', '/index.html?lang=en&utm_source=newsletter', {}, false, false)).toBe(
      'GET /index.html?lang=en&utm_source=newsletter'
    );
    expect(cacheKey('GET', '/index.html?lang=en&utm_source=newsletter', {}, true, false)).toBe(
      'GET /index.html?lang=en'
    );
    expect(cacheKey('GET', '/index.html', { cookie: 'user=a' }, false, true)).toBe(
      'GET /index.html|cookie=user=a'
    );
    expect(cacheKey('GET', '/index.html', { cookie: 'user=b' }, false, true)).not.toBe(
      cacheKey('GET', '/index.html', { cookie: 'user=a' }, false, true)
    );
  });

  it('does not store no-store or private shared-cache responses, but stores no-cache', () => {
    let state = setHeader(createLab(), 'cart', 'no-store');
    state = request(state, 'Frankfurt', '/api/cart');
    expect(state.lastBatch.results[0].outcome).toBe('BYPASS');
    expect(edgeEntries(state, 'Frankfurt')).toHaveLength(0);
    expect(canStore('private-60')).toBe(false);

    state = setHeader(state, 'page', 'no-cache');
    state = request(state, 'Frankfurt', '/index.html');
    expect(edgeEntries(state, 'Frankfurt')).toHaveLength(1);
    expect(parseCacheControl('no-cache').noCache).toBe(true);
  });

  it('prefers s-maxage for shared-cache freshness and tracks Age from storage time', () => {
    let state = setHeader(createLab(), 'page', 's-maxage-300');
    state = request(state, 'Frankfurt', '/index.html');
    state = advanceClock(state, 299);
    state = request(state, 'Frankfurt', '/index.html');
    const result = state.lastBatch.results[0];
    expect(freshnessLifetime('s-maxage-300')).toBe(300);
    expect(result.outcome).toBe('HIT');
    expect(result.age).toBe(299);
    expect(result.freshnessLifetime).toBe(300);
    state = advanceClock(state, 1);
    state = request(state, 'Frankfurt', '/index.html');
    expect(state.lastBatch.results[0].outcome).toBe('REVALIDATED');
  });

  it('uses a fresh stored response as a hit, then conditionally revalidates it with 304', () => {
    let state = setHeader(createLab(), 'page', 'max-age-60');
    state = request(state, 'Virginia', '/index.html');
    state = request(state, 'Virginia', '/index.html');
    expect(state.lastBatch.results[0]).toMatchObject({
      outcome: 'HIT',
      originContact: false,
      latencyMs: 20,
    });
    state = advanceClock(state, 60);
    state = request(state, 'Virginia', '/index.html');
    expect(state.lastBatch.results[0]).toMatchObject({
      outcome: 'REVALIDATED',
      status: 304,
      originContact: true,
      latencyMs: 140,
    });
  });

  it('uses a 200 response when a conditional request finds deployed content changed', () => {
    let state = setHeader(createLab(), 'page', 'max-age-60');
    state = request(state, 'Frankfurt', '/index.html');
    state = deploy(state);
    state = advanceClock(state, 60);
    state = request(state, 'Frankfurt', '/index.html');
    expect(state.lastBatch.results[0]).toMatchObject({
      outcome: 'MISS',
      status: 200,
      version: 2,
      latencyMs: 325,
    });
  });

  it('serves stale while revalidating during stale-while-revalidate, then refreshes the edge', () => {
    let state = setHeader(createLab(), 'page', 'swr-60-120');
    state = request(state, 'Singapore', '/index.html');
    state = deploy(state);
    state = advanceClock(state, 61);
    state = request(state, 'Singapore', '/index.html');
    expect(state.lastBatch.results[0]).toMatchObject({
      outcome: 'HIT',
      fresh: false,
      version: 1,
      latencyMs: 20,
    });
    expect(edgeEntries(state, 'Singapore')[0]).toMatchObject({ version: 2, age: 0 });
    state = advanceClock(state, 180);
    state = request(state, 'Singapore', '/index.html');
    expect(state.lastBatch.results[0].originContact).toBe(true);
  });

  it('purges a path at every edge and gives a deployed asset a new hashed URL', () => {
    let state = sendTraffic(createLab(), { utm: false, target: '/index.html' });
    expect(
      ['Frankfurt', 'Virginia', 'Singapore'].every(
        (city) => edgeEntries(state, city as 'Frankfurt').length > 0
      )
    ).toBe(true);
    state = purgePath(state, '/index.html');
    expect(
      ['Frankfurt', 'Virginia', 'Singapore'].every(
        (city) => edgeEntries(state, city as 'Frankfurt').length === 0
      )
    ).toBe(true);
    expect(currentAssetPath(state)).toBe('/app.3f9a1c.js');
    expect(currentAssetPath(deploy(state))).toBe('/app.8b21e0.js');
  });

  it('uses the documented illustrative latency model and exact header presets', () => {
    let state = request(createLab(), 'Singapore', '/index.html');
    expect(state.lastBatch.results[0].latencyMs).toBe(480);
    state = request(state, 'Singapore', '/index.html');
    expect(state.lastBatch.results[0].latencyMs).toBe(20);
    expect(HEADER_PRESETS.map((preset) => preset.text)).toEqual([
      'no-store',
      'private, max-age=60',
      'no-cache',
      'max-age=60',
      'public, max-age=31536000, immutable',
      's-maxage=300, max-age=0',
      'max-age=60, stale-while-revalidate=120',
    ]);
  });

  it('collapses UTM variants only when the CDN setting is enabled', () => {
    let state = sendTraffic(createLab(), { utm: true, target: '/index.html' });
    expect(state.lastBatch.hitRatio).toBe(0);
    state = setIgnoreUtm(state, true);
    state = sendTraffic(state, { utm: true, target: '/index.html' });
    expect(state.lastBatch.hitRatio).toBeGreaterThan(0.8);
  });
});
