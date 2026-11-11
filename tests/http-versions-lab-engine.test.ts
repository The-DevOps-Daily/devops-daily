import { describe, expect, it } from 'vitest';
import {
  HTTP1_CONNECTION_LIMIT,
  LINK_MEGABITS_PER_SECOND,
  LOST_REQUEST_ID,
  PAGE_REQUESTS,
  computeLoad,
  createLab,
  missionChecks,
  nextStep,
  playAll,
  protocolDetails,
  setLoss,
  setProtocol,
  setRtt,
  stepLabels,
  transferTimeMs,
} from '@/lib/games/http-versions-lab-engine';

describe('HTTP versions lab engine', () => {
  it('defines one HTML document and twelve 8 to 60 KB assets', () => {
    expect(PAGE_REQUESTS).toHaveLength(13);
    expect(PAGE_REQUESTS[0]).toMatchObject({ id: 'index-html', sizeKb: 14 });
    const assets = PAGE_REQUESTS.slice(1);
    expect(assets).toHaveLength(12);
    expect(assets.every((asset) => asset.sizeKb >= 8 && asset.sizeKb <= 60)).toBe(true);
    expect(PAGE_REQUESTS.find((request) => request.id === LOST_REQUEST_ID)).toMatchObject({
      label: 'app.js',
      sizeKb: 52,
    });
  });

  it('rounds each response transfer time on the fixed 20 Mbit/s link', () => {
    expect(LINK_MEGABITS_PER_SECOND).toBe(20);
    expect(transferTimeMs(14)).toBe(6);
    expect(transferTimeMs(52)).toBe(21);
  });

  it('uses six serial HTTP/1.1 connections and two setup RTTs', () => {
    const result = computeLoad({ protocol: 'http1', rttMs: 250, loss: false });
    expect(result.connectionsOpened).toBe(HTTP1_CONNECTION_LIMIT);
    expect(result.handshakeRoundTrips).toBe(2);
    expect(new Set(result.requests.map((request) => request.lane)).size).toBe(
      HTTP1_CONNECTION_LIMIT
    );
    const assetConnection = result.requests.find((request) => request.id === 'theme-css');
    if (!assetConnection) throw new Error('no theme.css request');
    expect(assetConnection.connectionStart).toBeGreaterThan(0);
    expect(assetConnection.connectionEnd! - assetConnection.connectionStart!).toBe(500);
    for (let lane = 0; lane < HTTP1_CONNECTION_LIMIT; lane++) {
      const laneRequests = result.requests
        .filter((request) => request.lane === lane)
        .sort((a, b) => a.receivingStart - b.receivingStart);
      for (let index = 1; index < laneRequests.length; index++) {
        expect(laneRequests[index].receivingStart).toBeGreaterThanOrEqual(
          laneRequests[index - 1].receivingEnd
        );
      }
    }
  });

  it('multiplexes every asset on one HTTP/2 TCP connection after two setup RTTs', () => {
    const result = computeLoad({ protocol: 'http2', rttMs: 250, loss: false });
    expect(protocolDetails('http2').transport).toBe('TCP + TLS 1.3');
    expect(result.connectionsOpened).toBe(1);
    expect(result.handshakeRoundTrips).toBe(2);
    const assets = result.requests.slice(1);
    expect(new Set(assets.map((request) => request.receivingStart)).size).toBe(1);
    expect(new Set(assets.map((request) => request.lane))).toEqual(new Set([0]));
  });

  it('uses one RTT for a new HTTP/3 QUIC and TLS 1.3 connection', () => {
    const result = computeLoad({ protocol: 'http3', rttMs: 250, loss: false });
    expect(protocolDetails('http3').transport).toBe('QUIC + TLS 1.3');
    expect(result.connectionsOpened).toBe(1);
    expect(result.handshakeRoundTrips).toBe(1);
    expect(result.requests[0].connectionEnd).toBe(250);
  });

  it('models TCP head-of-line blocking for every HTTP/2 asset stream after loss', () => {
    const clean = computeLoad({ protocol: 'http2', rttMs: 100, loss: false });
    const loss = computeLoad({ protocol: 'http2', rttMs: 100, loss: true });
    expect(loss.stalledRequestIds).toEqual(PAGE_REQUESTS.slice(1).map((request) => request.id));
    expect(
      loss.requests
        .filter((request) => request.stalled)
        .every((request) => request.lossDelayMs === 100)
    ).toBe(true);
    expect(loss.totalMs).toBe(clean.totalMs + 100);
  });

  it('makes the lost app.js packet wait one RTT without blocking other HTTP/3 streams', () => {
    const clean = computeLoad({ protocol: 'http3', rttMs: 100, loss: false });
    const loss = computeLoad({ protocol: 'http3', rttMs: 100, loss: true });
    expect(loss.stalledRequestIds).toEqual([LOST_REQUEST_ID]);
    const app = loss.requests.find((request) => request.id === LOST_REQUEST_ID);
    if (!app) throw new Error('no app.js request');
    expect(app.lossDelayMs).toBe(100);
    expect(app.lossAt).not.toBeNull();
    for (const request of loss.requests.filter((request) => request.id !== LOST_REQUEST_ID)) {
      const baseline = clean.requests.find((candidate) => candidate.id === request.id);
      if (!baseline) throw new Error(`no baseline for ${request.id}`);
      expect(request.receivingEnd).toBe(baseline.receivingEnd);
    }
  });

  it('uses the loss step only when loss is enabled and records full loads once', () => {
    let state = createLab();
    expect(stepLabels(state.config)).toEqual(['Connect', 'HTML', 'Assets', 'Done']);
    state = setLoss(state, true);
    expect(stepLabels(state.config)).toEqual(['Connect', 'HTML', 'Assets', 'Lost packet', 'Done']);
    state = playAll(state);
    expect(state.loads).toHaveLength(1);
    expect(playAll(state).loads).toHaveLength(1);
  });

  it('checks the five ordered learning goals from completed loads and stepped setup', () => {
    let state = createLab();
    state = setRtt(state, 250);
    state = playAll(state);
    expect(missionChecks(state).h1).toBe(true);

    state = setProtocol(state, 'http2');
    state = playAll(state);
    expect(missionChecks(state).h2).toBe(true);

    state = setLoss(state, true);
    state = playAll(state);
    expect(missionChecks(state).hol).toBe(true);

    state = setLoss(state, false);
    state = nextStep(state);
    state = setProtocol(state, 'http3');
    state = setLoss(state, true);
    state = playAll(state);
    expect(missionChecks(state).h3).toBe(true);

    state = setLoss(state, false);
    state = nextStep(state);
    expect(missionChecks(state).handshake).toBe(true);
  });
});
