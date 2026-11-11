// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IdempotencyRetryLab from '@/components/games/idempotency-retry-lab';
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
});

describe('Idempotency and Retry Lab', () => {
  it('has no page keys and shows the current mission as its goal', async () => {
    await act(async () => root.render(createElement(IdempotencyRetryLab)));
    expect(container.textContent).not.toContain('Idempotency and Retry Lab');
    expect(container.textContent).toContain('Goal:');
    expect(container.textContent).toContain(
      'Lose a response without an idempotency key and watch the customer pay twice.'
    );
    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(container.textContent).toContain('0/6');
  });

  it('plays every mission, signals once, explores, and starts over', async () => {
    await act(async () => root.render(createElement(IdempotencyRetryLab)));

    await click('Run duplicate checkout');
    expect(container.textContent).toContain('1/6');

    await click('Run keyed checkout');
    expect(container.textContent).toContain('2/6');

    await click('Reuse key with new amount');
    expect(container.textContent).toContain('3/6');

    await click('Send two at once');
    expect(container.textContent).toContain('4/6');

    await click('Run no backoff');
    expect(container.textContent).toContain('4/6');
    await click('Run full jitter');
    expect(container.textContent).toContain('5/6');

    await click('Run down API job');
    expect(container.textContent).toContain('Idempotency and retry lab complete');
    expect(completions).toBe(1);

    await click('Keep exploring');
    expect(completions).toBe(1);
    expect(container.textContent).toContain(
      'All missions complete. Explore any checkout or retry pattern.'
    );
    await click('Reuse key with new amount');
    expect(completions).toBe(1);

    await click('Start over');
    await click('Click again to start over');
    expect(container.textContent).toContain('0/6');
    expect(container.textContent).toContain(
      'Lose a response without an idempotency key and watch the customer pay twice.'
    );
  }, 60_000);
});
