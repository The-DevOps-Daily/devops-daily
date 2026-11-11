// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HttpVersionsLab from '@/components/games/http-versions-lab';
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

beforeEach(() => {
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
  window.scrollBy = () => {};
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.removeEventListener(GAME_COMPLETE_EVENT, countCompletion);
});

async function render() {
  await act(async () => root.render(createElement(HttpVersionsLab)));
}

describe('HTTP versions lab on the kit', () => {
  it('has no page keys, a goal, and the first load controls', async () => {
    await render();
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/5');
    expect(text()).toContain('HTTP/1.1');
    expect(text()).toContain('Round-trip time');
    expect(text()).not.toContain('How to use this simulator');

    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(text()).toContain('Load step: Connect');
  });

  it('plays the missions through the real controls and signals exactly once', async () => {
    await render();
    await click('250 ms', true);
    await click('Play all', true);
    expect(text()).toContain('1/5');
    expect(completions).toBe(0);

    await click('HTTP/2', true);
    await click('Play all', true);
    expect(text()).toContain('2/5');

    await click('Lose one packet', false);
    await click('Play all', true);
    expect(text()).toContain('3/5');
    expect(completions).toBe(0);

    await click('Lose one packet', false);
    await click('Next', true);
    await click('HTTP/3', true);
    await click('Lose one packet', false);
    await click('Play all', true);
    expect(text()).toContain('4/5');
    expect(completions).toBe(0);

    await click('Lose one packet', false);
    await click('Next', true);
    expect(text()).toContain('HTTP versions lab complete');
    expect(completions).toBe(1);

    await click('Keep exploring', true);
    expect(completions).toBe(1);
    await click('Play all', true);
    expect(completions).toBe(1);
  }, 60_000);

  it('Start over clears the missions', async () => {
    await render();
    await click('250 ms', true);
    await click('Play all', true);
    expect(text()).toContain('1/5');
    await click('Start over', true);
    await click('Click again to start over', true);
    expect(text()).toContain('0/5');
    expect(text()).toContain('Load step: Connect');
  }, 60_000);
});
