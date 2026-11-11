// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GraphqlDataloaderLab from '@/components/games/graphql-dataloader-lab';
import { GAME_COMPLETE_EVENT } from '@/lib/games/game-complete';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let completions: number;
const countCompletion = () => completions++;

function text() {
  return container.textContent ?? '';
}

function buttonName(button: HTMLButtonElement): string {
  return (button.getAttribute('aria-label') ?? button.textContent ?? '').trim();
}

async function click(label: string, exact = false) {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
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
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  window.scrollBy = () => {};
  Element.prototype.scrollBy = () => {};
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  window.addEventListener(GAME_COMPLETE_EVENT, countCompletion);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.removeEventListener(GAME_COMPLETE_EVENT, countCompletion);
  vi.restoreAllMocks();
});

async function render() {
  await act(async () => root.render(createElement(GraphqlDataloaderLab)));
}

describe('GraphQL N+1 and DataLoader Lab on the kit', () => {
  it('has no page keys and starts with the mission goal', async () => {
    await render();
    expect(text()).toContain('Goal: Ask for posts and their authors, and count the queries.');
    expect(text()).toContain('0/6');
    expect(text()).not.toContain('How to use this simulator');
  });

  it('plays each mission through the visible controls and signals once', async () => {
    await render();
    await click('Run query', true);
    expect(text()).toContain('1/6');
    expect(text()).toContain('11 queries in this run');

    await click('Comments', true);
    await click('Comment authors', true);
    await click('Run query', true);
    expect(text()).toContain('2/6');
    expect(text()).toContain('51 queries in this run');

    await click('Use User DataLoader', true);
    await click('Run query', true);
    expect(text()).toContain('3/6');

    await click('Use Comments DataLoader', true);
    await click('Run query', true);
    expect(text()).toContain('4/6');
    expect(text()).toContain('4 queries in this run');

    await click('Shared by all requests', true);
    await click('Run query', true);
    await click('Viewer: Bo', true);
    await click('Run query', true);
    expect(text()).toContain('5/6');
    expect(text()).toContain('ada@blog.example');

    await click('Per request', true);
    await click('Run query', true);
    expect(completions).toBe(1);
    expect(text()).toContain('DataLoader lessons complete');

    await click('Keep exploring', true);
    expect(completions).toBe(1);
    await click('Start over', true);
    await click('Click again to start over', true);
    expect(text()).toContain('0/6');
  }, 60_000);
});
