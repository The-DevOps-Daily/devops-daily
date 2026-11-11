// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CdnEdgeCacheLab from '@/components/games/cdn-edge-cache-lab';
import { GAME_COMPLETE_EVENT } from '@/lib/games/game-complete';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let completions: number;
const countCompletion = () => completions++;

function buttonName(button: HTMLButtonElement): string {
  return (button.getAttribute('aria-label') ?? button.textContent ?? '').trim();
}

async function click(label: string, exact = true) {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) =>
      !candidate.disabled &&
      (exact ? buttonName(candidate) === label : buttonName(candidate).includes(label))
  );
  if (!button) throw new Error(`no enabled button ${label}`);
  await act(async () => button.click());
}

beforeEach(() => {
  vi.useFakeTimers();
  completions = 0;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
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
  window.addEventListener(GAME_COMPLETE_EVENT, countCompletion);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.removeEventListener(GAME_COMPLETE_EVENT, countCompletion);
  vi.useRealTimers();
});

describe('CDN Edge Cache Lab', () => {
  it('plays every mission through controls, signals once, explores, and starts over', async () => {
    await act(async () => root.render(createElement(CdnEdgeCacheLab)));
    expect(container.textContent).toContain('Goal:');
    expect(container.textContent).toContain('Get a cache HIT at the Singapore edge.');

    await click('Send traffic');
    expect(container.textContent).toContain('1/6');

    await click('/index.html');
    await click('Send traffic');
    await click('Deploy v2');
    await click('Send traffic');
    expect(container.textContent).toContain('HIT v1');
    expect(container.textContent).toContain('2/6');

    await click('Purge /index.html');
    await click('Send traffic');
    await click('Asset');
    await click('Send traffic');
    expect(container.textContent).toContain('3/6');

    await click('/index.html');
    await click('Wait 61 s');
    await click('Send traffic');
    expect(container.textContent).toContain('4/6');

    await click('/api/cart');
    await click('Send traffic');
    expect(container.textContent).toContain('BYPASS');
    expect(container.textContent).toContain('5/6');

    await click('Asset');
    await click('utm_ links off');
    await click('Send traffic');
    expect(container.textContent).toContain('7 keys');
    await click('Ignore utm_ in cache key off');
    await click('Send traffic');

    expect(container.textContent).toContain('Edge cache lab complete');
    expect(completions).toBe(1);
    await click('Keep exploring');
    expect(completions).toBe(1);
    expect(container.textContent).toContain(
      'All missions complete. Explore any cache policy or traffic pattern.'
    );
    await click('Start over');
    await click('Click again to start over');
    expect(container.textContent).toContain('0/6');
    expect(container.textContent).toContain('Get a cache HIT at the Singapore edge.');
  }, 60_000);
});
