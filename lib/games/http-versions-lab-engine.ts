// A deliberately small, deterministic model of one page load. It is not a
// browser trace: its job is to make connection setup, multiplexing and loss
// recovery comparable in one visual surface.

export type HttpProtocol = 'http1' | 'http2' | 'http3';
export type RttMs = 20 | 100 | 250;

export interface PageRequest {
  id: string;
  label: string;
  kind: 'html' | 'css' | 'js' | 'image';
  sizeKb: number;
}

export interface LoadConfig {
  protocol: HttpProtocol;
  rttMs: RttMs;
  loss: boolean;
}

export interface WaterfallRequest extends PageRequest {
  lane: number;
  connectionStart: number | null;
  connectionEnd: number | null;
  waitingStart: number;
  receivingStart: number;
  receivingEnd: number;
  transferMs: number;
  lossAt: number | null;
  lossDelayMs: number;
  stalled: boolean;
}

export interface LoadResult {
  config: LoadConfig;
  requests: WaterfallRequest[];
  totalMs: number;
  connectionsOpened: number;
  handshakeRoundTrips: number;
  stalledRequestIds: string[];
  lossDescription: string | null;
}

export interface LabState {
  config: LoadConfig;
  step: number;
  loads: LoadResult[];
  steppedSetup: Record<'http2' | 'http3', boolean>;
}

export const LINK_MEGABITS_PER_SECOND = 20;
export const BYTES_PER_KILOBYTE = 1000;
export const HTTP1_CONNECTION_LIMIT = 6;
export const LOST_REQUEST_ID = 'app-js';
/** The lost packet leaves about 6 KB into app.js, while every stream is still receiving. */
export const LOSS_AFTER_MS = transferTimeMs(6);
export const RTT_OPTIONS: RttMs[] = [20, 100, 250];

export const PROTOCOLS: Array<{
  id: HttpProtocol;
  label: string;
  connections: number;
  handshakeRoundTrips: number;
  transport: string;
}> = [
  {
    id: 'http1',
    label: 'HTTP/1.1',
    connections: HTTP1_CONNECTION_LIMIT,
    handshakeRoundTrips: 2,
    transport: 'TCP + TLS 1.3',
  },
  {
    id: 'http2',
    label: 'HTTP/2',
    connections: 1,
    handshakeRoundTrips: 2,
    transport: 'TCP + TLS 1.3',
  },
  {
    id: 'http3',
    label: 'HTTP/3',
    connections: 1,
    handshakeRoundTrips: 1,
    transport: 'QUIC + TLS 1.3',
  },
];

export const PAGE_REQUESTS: PageRequest[] = [
  { id: 'index-html', label: 'index.html', kind: 'html', sizeKb: 14 },
  { id: 'styles-css', label: 'styles.css', kind: 'css', sizeKb: 24 },
  { id: 'theme-css', label: 'theme.css', kind: 'css', sizeKb: 12 },
  { id: 'runtime-js', label: 'runtime.js', kind: 'js', sizeKb: 18 },
  { id: 'framework-js', label: 'framework.js', kind: 'js', sizeKb: 44 },
  { id: 'app-js', label: 'app.js', kind: 'js', sizeKb: 52 },
  { id: 'logo-svg', label: 'logo.svg', kind: 'image', sizeKb: 8 },
  { id: 'hero-webp', label: 'hero.webp', kind: 'image', sizeKb: 60 },
  { id: 'card-one-webp', label: 'card-1.webp', kind: 'image', sizeKb: 16 },
  { id: 'card-two-webp', label: 'card-2.webp', kind: 'image', sizeKb: 20 },
  { id: 'card-three-webp', label: 'card-3.webp', kind: 'image', sizeKb: 18 },
  { id: 'avatar-webp', label: 'avatar.webp', kind: 'image', sizeKb: 10 },
  { id: 'footer-webp', label: 'footer.webp', kind: 'image', sizeKb: 9 },
];

export const SIMPLIFICATIONS = [
  'A simplified model: DNS, server work, congestion control, packet sizes, priorities, caches, and connection reuse across navigations are out of scope.',
  'The fixed 20 Mbit/s link uses decimal KB and shares capacity fairly between simultaneous responses; HTTP/1.1 also serializes requests on each connection.',
  'HTTP/1.1 pipelining, HTTP/2 HPACK, HTTP/3 QPACK, server push, and QUIC 0-RTT resumption are not modelled.',
  'Every request waits one RTT for its first byte. The lost model packet is about 6 KB into app.js and is retransmitted one RTT later, like fast retransmit.',
];

export const MISSION_COPY = [
  {
    id: 'h1',
    label: 'Load the page over HTTP/1.1 and count the connections.',
    hint: 'Pick HTTP/1.1 and press Play all. Browsers open up to six connections to one origin; the other requests wait in line.',
  },
  {
    id: 'h2',
    label: 'Load it over HTTP/2 at 250 ms RTT and beat HTTP/1.1.',
    hint: 'Pick 250 ms and press Play all on HTTP/1.1, then pick HTTP/2 and press Play all again: one connection, every request at once.',
  },
  {
    id: 'hol',
    label: 'Lose one packet on HTTP/2 and see every stream stall.',
    hint: 'On HTTP/2 turn on Lose one packet and press Play all. TCP delivers bytes in order, so every stream waits for the resend.',
  },
  {
    id: 'h3',
    label: 'Repeat the loss on HTTP/3: only one stream waits.',
    hint: 'Pick HTTP/3 with Lose one packet on and press Play all. QUIC recovers loss per stream.',
  },
  {
    id: 'handshake',
    label: 'Compare the setup: two round trips for TCP and TLS, one for QUIC.',
    hint: 'On HTTP/2 press Next once from Connect and see where the first request starts, then do the same on HTTP/3.',
  },
] as const;

export function protocolDetails(protocol: HttpProtocol) {
  const details = PROTOCOLS.find((item) => item.id === protocol);
  if (!details) throw new Error(`Unknown protocol ${protocol}`);
  return details;
}

/** Response time on a 20 Mbit/s link, rounded once to milliseconds. */
export function transferTimeMs(sizeKb: number): number {
  return Math.round((sizeKb * BYTES_PER_KILOBYTE * 8) / (LINK_MEGABITS_PER_SECOND * 1000));
}

export function stepLabels(config: LoadConfig): string[] {
  return config.loss
    ? ['Connect', 'HTML', 'Assets', 'Lost packet', 'Done']
    : ['Connect', 'HTML', 'Assets', 'Done'];
}

function withRequest(
  request: PageRequest,
  values: Omit<WaterfallRequest, keyof PageRequest | 'transferMs'>
): WaterfallRequest {
  return { ...request, ...values, transferMs: transferTimeMs(request.sizeKb) };
}

function connectionDelay(config: LoadConfig): number {
  return protocolDetails(config.protocol).handshakeRoundTrips * config.rttMs;
}

function http1Load(config: LoadConfig): WaterfallRequest[] {
  const rtt = config.rttMs;
  const setupMs = connectionDelay(config);
  const html = PAGE_REQUESTS[0];
  const htmlStart = setupMs + rtt;
  const htmlEnd = htmlStart + transferTimeMs(html.sizeKb);
  const scheduled = new Map<string, WaterfallRequest>();
  scheduled.set(
    html.id,
    withRequest(html, {
      lane: 0,
      connectionStart: 0,
      connectionEnd: setupMs,
      waitingStart: setupMs,
      receivingStart: htmlStart,
      receivingEnd: htmlEnd,
      lossAt: null,
      lossDelayMs: 0,
      stalled: false,
    })
  );

  const queues = Array.from({ length: HTTP1_CONNECTION_LIMIT }, () => [] as PageRequest[]);
  for (const [assetIndex, request] of PAGE_REQUESTS.slice(1).entries()) {
    queues[assetIndex % HTTP1_CONNECTION_LIMIT].push(request);
  }
  const positions = Array.from({ length: HTTP1_CONNECTION_LIMIT }, () => 0);
  // Lane 0 reuses the HTML connection; the others open when the HTML has arrived.
  const readyAt = Array.from({ length: HTTP1_CONNECTION_LIMIT }, (_, lane) =>
    lane === 0 ? htmlEnd : htmlEnd + setupMs
  );
  const active: Array<{
    lane: number;
    request: PageRequest;
    remaining: number;
    firstByteAt: number;
  }> = [];
  let time = htmlEnd;

  while (scheduled.size < PAGE_REQUESTS.length) {
    for (let lane = 0; lane < HTTP1_CONNECTION_LIMIT; lane++) {
      if (active.some((item) => item.lane === lane)) continue;
      const request = queues[lane][positions[lane]];
      if (!request || readyAt[lane] > time) continue;
      // No pipelining: the request goes out now and its first byte is one RTT away.
      active.push({
        lane,
        request,
        remaining: transferTimeMs(request.sizeKb),
        firstByteAt: time + rtt,
      });
    }
    const receiving = active.filter((item) => item.firstByteAt <= time);
    const events = [
      ...readyAt.filter(
        (ready, lane) =>
          ready > time &&
          positions[lane] < queues[lane].length &&
          !active.some((item) => item.lane === lane)
      ),
      ...active.filter((item) => item.firstByteAt > time).map((item) => item.firstByteAt),
    ];
    if (receiving.length > 0) {
      events.push(time + Math.min(...receiving.map((item) => item.remaining)) * receiving.length);
    }
    if (events.length === 0) throw new Error('HTTP/1.1 schedule stalled');
    const next = Math.min(...events);
    for (const item of receiving) item.remaining -= (next - time) / receiving.length;
    time = next;
    for (let index = active.length - 1; index >= 0; index--) {
      const item = active[index];
      if (item.firstByteAt > time || item.remaining > 0.000001) continue;
      const lost = config.loss && item.request.id === LOST_REQUEST_ID;
      const lossDelayMs = lost ? rtt : 0;
      const connectionStart = positions[item.lane] === 0 && item.lane > 0 ? htmlEnd : null;
      scheduled.set(
        item.request.id,
        withRequest(item.request, {
          lane: item.lane,
          connectionStart,
          connectionEnd: connectionStart === null ? null : connectionStart + setupMs,
          waitingStart: htmlEnd,
          receivingStart: item.firstByteAt,
          receivingEnd: Math.round(time) + lossDelayMs,
          lossAt: lost ? item.firstByteAt + LOSS_AFTER_MS : null,
          lossDelayMs,
          stalled: lost,
        })
      );
      readyAt[item.lane] = time + lossDelayMs;
      positions[item.lane] += 1;
      active.splice(index, 1);
    }
  }
  return PAGE_REQUESTS.map((request) => {
    const result = scheduled.get(request.id);
    if (!result) throw new Error(`Unscheduled request ${request.id}`);
    return result;
  });
}

/** Streams share the link fairly; returns each finish time and when the lost packet is sent. */
function multiplexedSchedule(requests: PageRequest[], start: number) {
  const active = requests.map((request) => ({
    id: request.id,
    remaining: transferTimeMs(request.sizeKb),
    sent: 0,
  }));
  const endTimes = new Map<string, number>();
  let time = start;
  let lossTime = start;
  while (active.length > 0) {
    const lost = active.find((item) => item.id === LOST_REQUEST_ID);
    const untilLoss =
      lost && lost.sent < LOSS_AFTER_MS ? (LOSS_AFTER_MS - lost.sent) * active.length : Infinity;
    const shortest = Math.min(...active.map((item) => item.remaining));
    const elapsed = Math.min(shortest * active.length, untilLoss);
    const share = elapsed / active.length;
    for (const item of active) {
      item.remaining -= share;
      item.sent += share;
    }
    time += elapsed;
    if (elapsed === untilLoss) lossTime = time;
    for (let index = active.length - 1; index >= 0; index--) {
      if (active[index].remaining > 0.000001) continue;
      endTimes.set(active[index].id, Math.round(time));
      active.splice(index, 1);
    }
  }
  return { endTimes, lossTime: Math.round(lossTime) };
}

function multiplexedLoad(config: LoadConfig): WaterfallRequest[] {
  const rtt = config.rttMs;
  const setupMs = connectionDelay(config);
  const html = PAGE_REQUESTS[0];
  const htmlStart = setupMs + rtt;
  const htmlEnd = htmlStart + transferTimeMs(html.sizeKb);
  // Every asset is requested at once when the HTML has arrived; first bytes come one RTT later.
  const assetsStart = htmlEnd + rtt;
  const assets = PAGE_REQUESTS.slice(1);
  const { endTimes, lossTime } = multiplexedSchedule(assets, assetsStart);
  const requests: WaterfallRequest[] = [
    withRequest(html, {
      lane: 0,
      connectionStart: 0,
      connectionEnd: setupMs,
      waitingStart: setupMs,
      receivingStart: htmlStart,
      receivingEnd: htmlEnd,
      lossAt: null,
      lossDelayMs: 0,
      stalled: false,
    }),
  ];
  for (const request of assets) {
    const cleanEnd = endTimes.get(request.id) ?? assetsStart;
    // HTTP/2 shares one TCP byte stream: every stream still receiving when the packet
    // is lost waits for its retransmission. QUIC holds back only the stream that lost it.
    const stalled =
      config.loss &&
      (config.protocol === 'http2'
        ? cleanEnd > lossTime
        : config.protocol === 'http3' && request.id === LOST_REQUEST_ID);
    const lossDelayMs = stalled ? rtt : 0;
    requests.push(
      withRequest(request, {
        lane: 0,
        connectionStart: null,
        connectionEnd: null,
        waitingStart: htmlEnd,
        receivingStart: assetsStart,
        receivingEnd: cleanEnd + lossDelayMs,
        lossAt: stalled ? lossTime : null,
        lossDelayMs,
        stalled,
      })
    );
  }
  return requests;
}

export function computeLoad(config: LoadConfig): LoadResult {
  const details = protocolDetails(config.protocol);
  const requests = config.protocol === 'http1' ? http1Load(config) : multiplexedLoad(config);
  const stalledRequestIds = requests
    .filter((request) => request.stalled)
    .map((request) => request.id);
  return {
    config,
    requests,
    totalMs: Math.max(...requests.map((request) => request.receivingEnd)),
    connectionsOpened: details.connections,
    handshakeRoundTrips: details.handshakeRoundTrips,
    stalledRequestIds,
    lossDescription: config.loss
      ? config.protocol === 'http1'
        ? 'The app.js connection waits one RTT for retransmission.'
        : config.protocol === 'http2'
          ? 'TCP head-of-line blocking pauses every stream still receiving until the lost app.js packet is resent.'
          : 'Only the app.js QUIC stream waits one RTT for retransmission.'
      : null,
  };
}

export function createLab(): LabState {
  return {
    config: { protocol: 'http1', rttMs: 100, loss: false },
    step: 0,
    loads: [],
    steppedSetup: { http2: false, http3: false },
  };
}

export function setProtocol(state: LabState, protocol: HttpProtocol): LabState {
  return { ...state, config: { ...state.config, protocol }, step: 0 };
}

export function setRtt(state: LabState, rttMs: RttMs): LabState {
  return { ...state, config: { ...state.config, rttMs }, step: 0 };
}

export function setLoss(state: LabState, loss: boolean): LabState {
  return { ...state, config: { ...state.config, loss }, step: 0 };
}

function recordLoad(state: LabState): LabState {
  return { ...state, loads: [...state.loads, computeLoad(state.config)] };
}

export function goToStep(state: LabState, step: number): LabState {
  const last = stepLabels(state.config).length - 1;
  return { ...state, step: Math.max(0, Math.min(last, step)) };
}

export function previousStep(state: LabState): LabState {
  return goToStep(state, state.step - 1);
}

export function nextStep(state: LabState): LabState {
  const last = stepLabels(state.config).length - 1;
  if (state.step >= last) return state;
  const steppedSetup = { ...state.steppedSetup };
  if (state.step === 0 && state.config.protocol !== 'http1')
    steppedSetup[state.config.protocol] = true;
  const next = { ...state, step: state.step + 1, steppedSetup };
  return next.step === last ? recordLoad(next) : next;
}

export function playAll(state: LabState): LabState {
  const last = stepLabels(state.config).length - 1;
  if (state.step === last) return state;
  return recordLoad({ ...state, step: last });
}

export function latestLoad(
  state: LabState,
  predicate: (load: LoadResult) => boolean
): LoadResult | null {
  for (let index = state.loads.length - 1; index >= 0; index--) {
    if (predicate(state.loads[index])) return state.loads[index];
  }
  return null;
}

export function missionChecks(
  state: LabState
): Record<(typeof MISSION_COPY)[number]['id'], boolean> {
  const h1 = latestLoad(
    state,
    (load) => load.config.protocol === 'http1' && load.config.rttMs === 250
  );
  const h2 = latestLoad(
    state,
    (load) => load.config.protocol === 'http2' && load.config.rttMs === 250 && !load.config.loss
  );
  const lossH2 = latestLoad(state, (load) => load.config.protocol === 'http2' && load.config.loss);
  const lossH3 = latestLoad(state, (load) => load.config.protocol === 'http3' && load.config.loss);
  return {
    h1: state.loads.some((load) => load.config.protocol === 'http1'),
    h2: Boolean(h1 && h2 && h2.totalMs < h1.totalMs),
    hol: Boolean(lossH2 && lossH2.stalledRequestIds.length > 1),
    h3: Boolean(lossH3 && lossH3.stalledRequestIds.length === 1),
    handshake: state.steppedSetup.http2 && state.steppedSetup.http3,
  };
}

export function visibleRequestIds(config: LoadConfig, step: number): Set<string> {
  const labels = stepLabels(config);
  const current = labels[Math.max(0, Math.min(step, labels.length - 1))];
  if (current === 'Connect') return new Set(['index-html']);
  if (current === 'HTML') return new Set(['index-html']);
  return new Set(PAGE_REQUESTS.map((request) => request.id));
}
