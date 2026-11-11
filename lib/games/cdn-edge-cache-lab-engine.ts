// Pure, deterministic model for the CDN Edge Cache Lab. The lab deliberately
// has no heuristic freshness: only the supplied Cache-Control directives count.

export type City = 'Frankfurt' | 'Virginia' | 'Singapore';
export type PathKind = 'page' | 'asset' | 'cart';
export type CacheOutcome = 'HIT' | 'MISS' | 'REVALIDATED' | 'BYPASS';
export type HeaderPresetId =
  | 'no-store'
  | 'private-60'
  | 'no-cache'
  | 'max-age-60'
  | 'immutable'
  | 's-maxage-300'
  | 'swr-60-120';

export interface HeaderPreset {
  id: HeaderPresetId;
  text: string;
}

export const HEADER_PRESETS: HeaderPreset[] = [
  { id: 'no-store', text: 'no-store' },
  { id: 'private-60', text: 'private, max-age=60' },
  { id: 'no-cache', text: 'no-cache' },
  { id: 'max-age-60', text: 'max-age=60' },
  { id: 'immutable', text: 'public, max-age=31536000, immutable' },
  { id: 's-maxage-300', text: 's-maxage=300, max-age=0' },
  { id: 'swr-60-120', text: 'max-age=60, stale-while-revalidate=120' },
];

export const EDGE_CITIES: City[] = ['Frankfurt', 'Virginia', 'Singapore'];
export const EDGE_ORIGIN_RTT_MS: Record<City, number> = {
  Frankfurt: 5,
  Virginia: 90,
  Singapore: 160,
};
export const VISITOR_EDGE_RTT_MS = 20;
export const ORIGIN_200_WORK_MS = 300;
export const ORIGIN_304_WORK_MS = 30;
export const CLOCK_STEP_SECONDS = 61;

export interface CacheDirectives {
  noStore: boolean;
  private: boolean;
  noCache: boolean;
  maxAge: number | null;
  sMaxage: number | null;
  staleWhileRevalidate: number;
  immutable: boolean;
}

export interface OriginResponse {
  path: string;
  version: number;
  etag: string;
  preset: HeaderPresetId;
  varyCookie: boolean;
}

export interface CacheEntry extends OriginResponse {
  key: string;
  storedAt: number;
}

export interface RequestResult {
  city: City;
  path: string;
  key: string;
  outcome: CacheOutcome;
  status: 200 | 304;
  age: number | null;
  freshnessLifetime: number | null;
  fresh: boolean;
  latencyMs: number;
  originContact: boolean;
  version: number;
}

export interface BatchReadout {
  results: RequestResult[];
  hitRatio: number;
  originRequests: number;
  cityLatencyMs: Record<City, number | null>;
}

export interface LabState {
  now: number;
  deploy: number;
  assetHash: string;
  headers: Record<PathKind, HeaderPresetId>;
  varyCookie: Record<PathKind, boolean>;
  ignoreUtm: boolean;
  edges: Record<City, CacheEntry[]>;
  lastBatch: BatchReadout;
  history: RequestResult[];
  stalePageAfterDeploy: boolean;
  deployedAt: number | null;
  pageFreshAfterDeploy: Record<City, boolean>;
  assetHitAfterDeploy: boolean;
  utmTraffic: boolean;
}

const ASSET_HASHES = ['3f9a1c', '8b21e0', 'c72d49', 'f0ac13'];

export function parseCacheControl(preset: HeaderPresetId): CacheDirectives {
  const text = HEADER_PRESETS.find((item) => item.id === preset)?.text;
  if (!text) throw new Error(`Unknown header preset: ${preset}`);
  const tokens = text.split(',').map((item) => item.trim());
  const value = (name: string) => {
    const token = tokens.find((item) => item.startsWith(`${name}=`));
    return token ? Number(token.slice(name.length + 1)) : null;
  };
  return {
    noStore: tokens.includes('no-store'),
    private: tokens.includes('private'),
    noCache: tokens.includes('no-cache'),
    maxAge: value('max-age'),
    sMaxage: value('s-maxage'),
    staleWhileRevalidate: value('stale-while-revalidate') ?? 0,
    immutable: tokens.includes('immutable'),
  };
}

export function freshnessLifetime(preset: HeaderPresetId): number | null {
  const directives = parseCacheControl(preset);
  return directives.sMaxage ?? directives.maxAge;
}

export function currentAge(entry: CacheEntry, now: number): number {
  return Math.max(0, now - entry.storedAt);
}

export function isFresh(entry: CacheEntry, now: number): boolean {
  const lifetime = freshnessLifetime(entry.preset);
  return lifetime !== null && currentAge(entry, now) < lifetime;
}

export function canStore(preset: HeaderPresetId): boolean {
  const directives = parseCacheControl(preset);
  return !directives.noStore && !directives.private;
}

function splitTarget(target: string): { pathname: string; query: [string, string][] } {
  const [pathname, search = ''] = target.split('?');
  if (!search) return { pathname, query: [] };
  return {
    pathname,
    query: search
      .split('&')
      .filter(Boolean)
      .map((part) => {
        const [key = '', value = ''] = part.split('=');
        return [decodeURIComponent(key), decodeURIComponent(value)];
      }),
  };
}

/** RFC 9111 cache key basis plus this lab's optional UTM removal feature. */
export function cacheKey(
  method: string,
  target: string,
  requestHeaders: { cookie?: string },
  ignoreUtm: boolean,
  varyCookie: boolean
): string {
  const { pathname, query } = splitTarget(target);
  const kept = ignoreUtm ? query.filter(([key]) => !key.startsWith('utm_')) : query;
  const suffix =
    kept.length === 0 ? '' : `?${kept.map(([key, value]) => `${key}=${value}`).join('&')}`;
  const vary = varyCookie ? `|cookie=${requestHeaders.cookie ?? ''}` : '';
  return `${method.toUpperCase()} ${pathname}${suffix}${vary}`;
}

function pathKind(path: string): PathKind {
  if (path === '/index.html') return 'page';
  if (path === '/api/cart') return 'cart';
  return 'asset';
}

function originResponse(state: LabState, target: string): OriginResponse {
  const kind = pathKind(splitTarget(target).pathname);
  const version = kind === 'page' ? state.deploy : kind === 'asset' ? state.deploy : 1;
  const preset = state.headers[kind];
  return {
    path: splitTarget(target).pathname,
    version,
    etag: `\"${kind}-v${version}\"`,
    preset,
    varyCookie: state.varyCookie[kind],
  };
}

function latency(city: City, originContact: boolean, status: 200 | 304): number {
  if (!originContact) return VISITOR_EDGE_RTT_MS;
  return (
    VISITOR_EDGE_RTT_MS +
    EDGE_ORIGIN_RTT_MS[city] +
    (status === 304 ? ORIGIN_304_WORK_MS : ORIGIN_200_WORK_MS)
  );
}

function makeReadout(results: RequestResult[]): BatchReadout {
  const hits = results.filter((result) => result.outcome === 'HIT').length;
  const cityLatencyMs = Object.fromEntries(
    EDGE_CITIES.map((city) => {
      const values = results
        .filter((result) => result.city === city)
        .map((result) => result.latencyMs);
      return [
        city,
        values.length ? values.reduce((total, value) => total + value, 0) / values.length : null,
      ];
    })
  ) as Record<City, number | null>;
  return {
    results,
    hitRatio: results.length ? hits / results.length : 0,
    originRequests: results.filter((result) => result.originContact).length,
    cityLatencyMs,
  };
}

export function createLab(): LabState {
  return {
    now: 0,
    deploy: 1,
    assetHash: ASSET_HASHES[0],
    headers: { page: 'max-age-60', asset: 'immutable', cart: 'private-60' },
    varyCookie: { page: false, asset: false, cart: false },
    ignoreUtm: false,
    edges: { Frankfurt: [], Virginia: [], Singapore: [] },
    lastBatch: makeReadout([]),
    history: [],
    stalePageAfterDeploy: false,
    deployedAt: null,
    pageFreshAfterDeploy: { Frankfurt: false, Virginia: false, Singapore: false },
    assetHitAfterDeploy: false,
    utmTraffic: false,
  };
}

export function setHeader(state: LabState, kind: PathKind, preset: HeaderPresetId): LabState {
  return { ...state, headers: { ...state.headers, [kind]: preset } };
}

export function setVaryCookie(state: LabState, kind: PathKind, enabled: boolean): LabState {
  return { ...state, varyCookie: { ...state.varyCookie, [kind]: enabled } };
}

export function setIgnoreUtm(state: LabState, enabled: boolean): LabState {
  return { ...state, ignoreUtm: enabled };
}

export function advanceClock(state: LabState, seconds: number): LabState {
  return { ...state, now: state.now + Math.max(0, seconds) };
}

export function currentAssetPath(state: LabState): string {
  return `/app.${state.assetHash}.js`;
}

export function deploy(state: LabState): LabState {
  const nextDeploy = state.deploy + 1;
  return {
    ...state,
    deploy: nextDeploy,
    assetHash: ASSET_HASHES[(nextDeploy - 1) % ASSET_HASHES.length],
    deployedAt: state.now,
    pageFreshAfterDeploy: { Frankfurt: false, Virginia: false, Singapore: false },
    assetHitAfterDeploy: false,
  };
}

export function purgePath(state: LabState, path: string): LabState {
  const edges = Object.fromEntries(
    EDGE_CITIES.map((city) => [city, state.edges[city].filter((entry) => entry.path !== path)])
  ) as Record<City, CacheEntry[]>;
  return { ...state, edges };
}

export function request(
  state: LabState,
  city: City,
  target: string,
  requestHeaders: { cookie?: string } = {}
): LabState {
  const origin = originResponse(state, target);
  const key = cacheKey('GET', target, requestHeaders, state.ignoreUtm, origin.varyCookie);
  const existing = state.edges[city].find((entry) => entry.key === key);
  const directives = parseCacheControl(existing?.preset ?? origin.preset);
  const lifetime = existing ? freshnessLifetime(existing.preset) : freshnessLifetime(origin.preset);
  const age = existing ? currentAge(existing, state.now) : null;
  let result: RequestResult;
  let nextEntries = state.edges[city];

  if (!canStore(origin.preset)) {
    result = {
      city,
      path: origin.path,
      key,
      outcome: 'BYPASS',
      status: 200,
      age: null,
      freshnessLifetime: null,
      fresh: false,
      latencyMs: latency(city, true, 200),
      originContact: true,
      version: origin.version,
    };
  } else if (
    existing &&
    isFresh(existing, state.now) &&
    !parseCacheControl(existing.preset).noCache
  ) {
    result = {
      city,
      path: origin.path,
      key,
      outcome: 'HIT',
      status: 200,
      age,
      freshnessLifetime: lifetime,
      fresh: true,
      latencyMs: latency(city, false, 200),
      originContact: false,
      version: existing.version,
    };
  } else if (
    existing &&
    isFresh(existing, state.now) === false &&
    age !== null &&
    lifetime !== null &&
    age < lifetime + directives.staleWhileRevalidate
  ) {
    const refreshed: CacheEntry = { ...origin, key, storedAt: state.now };
    nextEntries = [...nextEntries.filter((entry) => entry.key !== key), refreshed];
    result = {
      city,
      path: origin.path,
      key,
      outcome: 'HIT',
      status: 200,
      age,
      freshnessLifetime: lifetime,
      fresh: false,
      latencyMs: latency(city, false, 200),
      originContact: true,
      version: existing.version,
    };
  } else {
    const unchanged = existing?.etag === origin.etag;
    const status: 200 | 304 = unchanged ? 304 : 200;
    const stored: CacheEntry = { ...origin, key, storedAt: state.now };
    nextEntries = [...nextEntries.filter((entry) => entry.key !== key), stored];
    result = {
      city,
      path: origin.path,
      key,
      outcome: unchanged ? 'REVALIDATED' : 'MISS',
      status,
      age,
      freshnessLifetime: freshnessLifetime(origin.preset),
      fresh: false,
      latencyMs: latency(city, true, status),
      originContact: true,
      version: origin.version,
    };
  }

  const stalePageAfterDeploy =
    state.stalePageAfterDeploy ||
    (origin.path === '/index.html' && state.deployedAt !== null && result.version < state.deploy);
  const pageFreshAfterDeploy = { ...state.pageFreshAfterDeploy };
  if (
    origin.path === '/index.html' &&
    state.deployedAt !== null &&
    result.version === state.deploy
  ) {
    pageFreshAfterDeploy[city] = true;
  }
  return {
    ...state,
    edges: { ...state.edges, [city]: nextEntries },
    lastBatch: makeReadout([result]),
    history: [...state.history, result],
    stalePageAfterDeploy,
    pageFreshAfterDeploy,
    assetHitAfterDeploy:
      state.assetHitAfterDeploy ||
      (origin.path === currentAssetPath(state) && result.outcome === 'HIT'),
  };
}

export function sendTraffic(
  state: LabState,
  options: { utm: boolean; city?: City; target?: string } = { utm: false }
): LabState {
  const cities = options.city ? [options.city] : EDGE_CITIES;
  const target = options.target ?? currentAssetPath(state);
  const results: RequestResult[] = [];
  let next = state;
  for (const city of cities) {
    for (let visit = 0; visit < (options.utm ? 6 : 2); visit += 1) {
      const suffix = options.utm ? `?utm_source=campaign-${visit}` : '';
      next = request(next, city, `${target}${suffix}`, { cookie: `user=${visit % 2}` });
      results.push(next.lastBatch.results[0]);
    }
  }
  return { ...next, lastBatch: makeReadout(results), utmTraffic: options.utm || state.utmTraffic };
}

export function edgeEntries(
  state: LabState,
  city: City
): Array<CacheEntry & { age: number; lifetime: number | null; fresh: boolean }> {
  return state.edges[city].map((entry) => ({
    ...entry,
    age: currentAge(entry, state.now),
    lifetime: freshnessLifetime(entry.preset),
    fresh: isFresh(entry, state.now),
  }));
}

export function missionChecks(state: LabState): Record<string, boolean> {
  return {
    'first-hit': state.history.some(
      (result) => result.city === 'Singapore' && result.outcome === 'HIT'
    ),
    'stale-after-deploy': state.stalePageAfterDeploy,
    'fix-deploys':
      state.deployedAt !== null &&
      EDGE_CITIES.every((city) => state.pageFreshAfterDeploy[city]) &&
      state.assetHitAfterDeploy,
    revalidate: state.history.some((result) => result.status === 304),
    'keep-private':
      (parseCacheControl(state.headers.cart).private ||
        parseCacheControl(state.headers.cart).noStore) &&
      state.history.some((result) => result.path === '/api/cart') &&
      EDGE_CITIES.every((city) => state.edges[city].every((entry) => entry.path !== '/api/cart')),
    'cache-key': state.utmTraffic && state.ignoreUtm && state.lastBatch.hitRatio > 0.8,
  };
}
