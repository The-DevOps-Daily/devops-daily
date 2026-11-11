// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoadBalancerSimulator from '@/components/games/load-balancer-simulator';
import CachingSimulator from '@/components/games/caching-simulator';
import ScalingSimulator from '@/components/games/scaling-simulator';
import { GAME_COMPLETE_EVENT } from '@/lib/games/game-complete';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let completions: number;
const countCompletion = () => completions++;
const text = () => container.textContent ?? '';

function buttonName(button: HTMLButtonElement): string {
  return (button.getAttribute('aria-label') ?? button.textContent ?? '').trim();
}

async function click(label: string, exact = false) {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) =>
      !candidate.disabled &&
      (exact ? buttonName(candidate) === label : buttonName(candidate).includes(label))
  );
  if (!button) throw new Error(`no enabled button "${label}"`);
  await act(async () => button.click());
}

async function advance(milliseconds: number) {
  await act(async () => {
    vi.advanceTimersByTime(milliseconds);
  });
}

async function chooseAlgorithm(label: string) {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) =>
      candidate.getAttribute('aria-pressed') !== null && buttonName(candidate) === label
  );
  if (!button) throw new Error(`no algorithm "${label}"`);
  await act(async () => button.click());
}

async function reset() {
  await click('Start over', true);
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => buttonName(candidate) === 'Click again to start over'
  );
  if (!button) throw new Error('no reset confirmation');
  await act(async () => button.click());
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  completions = 0;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
  window.addEventListener(GAME_COMPLETE_EVENT, countCompletion);
  window.matchMedia = vi.fn((query: string) => ({
    matches: false,
    media: query,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollTo = () => {};
  Element.prototype.scrollBy = () => {};
  Element.prototype.scrollIntoView = () => {};
  window.scrollBy = () => {};
  window.requestAnimationFrame = (callback) =>
    setTimeout(() => callback(0), 0) as unknown as number;
  window.cancelAnimationFrame = (id) => clearTimeout(id);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.removeEventListener(GAME_COMPLETE_EVENT, countCompletion);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function render() {
  await act(async () => root.render(createElement(LoadBalancerSimulator)));
}

describe('Load Balancer Simulator on the kit', () => {
  it('no hero, no page keys, a goal', async () => {
    await render();
    expect(text()).not.toContain('Load Balancer Simulator');
    expect(text()).not.toContain('Keyboard shortcuts');
    expect(text()).not.toContain('Server Failure Simulation');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/4');

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(text()).toContain('Ready to route traffic');
    expect(
      [...container.querySelectorAll('button')].some((button) => buttonName(button) === 'Start')
    ).toBe(true);
  });

  it('one signal, after the last mission', async () => {
    await render();
    await click('Start', true);
    await advance(2_600);
    expect(text()).toContain('1/4');
    expect(completions).toBe(0);

    await chooseAlgorithm('Least Connections');
    await advance(2_600);
    expect(text()).toContain('2/4');
    expect(completions).toBe(0);

    await chooseAlgorithm('IP Hash');
    await advance(2_600);
    expect(text()).toContain('3/4');
    expect(completions).toBe(0);

    await click('Server 1: online', true);
    await advance(2_600);
    expect(text()).toContain('Load balancing missions complete');
    expect(completions).toBe(1);

    await click('Keep exploring', true);
    expect(text()).not.toContain('Load balancing missions complete');
    await advance(2_600);
    expect(completions).toBe(1);

    await reset();
    expect(text()).toContain('0/4');
  }, 60_000);
});

async function renderCaching() {
  await act(async () => root.render(createElement(CachingSimulator)));
}

async function requestCacheItem(label: string) {
  await click(label);
  await advance(1_800);
}

async function fillAndEvict() {
  for (const item of ['User Profile', 'Product List', 'Settings', 'Dashboard', 'Messages']) {
    await requestCacheItem(item);
  }
}

async function chooseCachePolicy(label: string) {
  const group = container.querySelector('[role="group"][aria-label="Eviction policy"]');
  if (!group) throw new Error('no eviction policy group');
  const button = [...group.querySelectorAll('button')].find(
    (candidate) => buttonName(candidate) === label
  );
  if (!button) throw new Error(`no eviction policy "${label}"`);
  await act(async () => button.click());
}

async function startCachingOver() {
  await click('Start over', true);
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => buttonName(candidate) === 'Click again to start over'
  );
  if (!button) throw new Error('no caching reset confirmation');
  await act(async () => button.click());
}

describe('Caching Simulator on the kit', () => {
  it('no hero, no page keys, a goal', async () => {
    await renderCaching();
    expect(text()).not.toContain('Cache Simulator');
    expect(text()).not.toContain('Press 1-6');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/4');
    expect(text()).toContain('Watch the cache decide');

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(text()).toContain('Watch the cache decide');
    expect(text()).toContain('0/4');
  });

  it('one signal, after the last mission', async () => {
    await renderCaching();

    await requestCacheItem('User Profile');
    await requestCacheItem('User Profile');
    expect(text()).toContain('1/4');
    expect(completions).toBe(0);

    await fillAndEvict();
    expect(text()).toContain('2/4');
    expect(completions).toBe(0);

    await chooseCachePolicy('LFU');
    await fillAndEvict();
    expect(text()).toContain('3/4');
    expect(completions).toBe(0);

    await chooseCachePolicy('FIFO');
    await fillAndEvict();
    expect(completions).toBe(1);
    expect(text()).toContain('Caching missions complete');

    await click('Keep exploring', true);
    expect(text()).not.toContain('Caching missions complete');
    await requestCacheItem('Analytics');
    expect(completions).toBe(1);

    await startCachingOver();
    expect(text()).toContain('0/4');
  }, 60_000);
});

async function renderScaling() {
  await act(async () => root.render(createElement(ScalingSimulator)));
}

async function scalingTab(label: string) {
  const tab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (!tab) throw new Error(`no ${label} tab`);
  await act(async () => tab.click());
}

async function scaleUpCpu() {
  await click('Increase CPU for Server 1', true);
  await advance(3_100);
}

describe('Scaling Simulator on the kit', () => {
  it('no hero, no page keys, a goal', async () => {
    await renderScaling();
    expect(text()).not.toContain('Horizontal vs Vertical Scaling Simulator');
    expect(text()).not.toContain('Learn scaling strategies by managing traffic');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/3');

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(text()).toContain('0/3');
    expect(
      [...container.querySelectorAll('button')].some((button) => buttonName(button) === 'Start')
    ).toBe(true);
  });

  it('one signal, after the last mission', async () => {
    await renderScaling();

    await scaleUpCpu();
    expect(text()).toContain('1/3');
    expect(completions).toBe(0);

    await scalingTab('Horizontal');
    expect(text()).toContain('Add load balancer');
    await click('Add load balancer');
    await click('Add server');
    await advance(3_100);
    expect(text()).toContain('2/3');
    expect(completions).toBe(0);

    await click('Remove Server 2', true);
    await advance(2_100);
    await scalingTab('Vertical');
    await scaleUpCpu();
    await scaleUpCpu();
    await click('10x', true);
    await click('Start', true);
    for (let tick = 0; tick < 200; tick += 1) {
      await advance(100);
    }

    expect(text()).toContain('Scaling missions complete');
    expect(completions).toBe(1);
    await click('Keep exploring', true);
    expect(text()).not.toContain('Scaling missions complete');
    // A finished scenario starts again after Reset; the missions stay done and nothing signals twice.
    await click('Reset', true);
    await click('Start', true);
    expect(completions).toBe(1);

    await reset();
    expect(text()).toContain('0/3');
  }, 60_000);
});
