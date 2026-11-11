// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import JavascriptPromisesAsyncSimulator from '@/components/games/javascript-promises-async-simulator';
import PostgresWireProtocolSimulator from '@/components/games/postgres-wire-protocol-simulator';
import RestVsGraphqlSimulator from '@/components/games/rest-vs-graphql-simulator';
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

async function next(count: number) {
  for (let index = 0; index < count; index += 1) await click('Next', true);
}

beforeEach(() => {
  vi.useFakeTimers();
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
  vi.useRealTimers();
});

async function render() {
  await act(async () => root.render(createElement(JavascriptPromisesAsyncSimulator)));
}

async function renderPostgres() {
  await act(async () => root.render(createElement(PostgresWireProtocolSimulator)));
}

async function renderRestVsGraphql() {
  await act(async () => root.render(createElement(RestVsGraphqlSimulator)));
}

async function chooseRestVsGraphqlScenario(value: string) {
  const field = container.querySelector('#rest-graphql-scenario');
  if (!(field instanceof HTMLSelectElement))
    throw new Error('no REST vs GraphQL scenario selector');
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!setValue) throw new Error('no select value setter');
  await act(async () => {
    setValue.call(field, value);
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function runRestVsGraphql(milliseconds: number) {
  await click('Run comparison', true);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

describe('JavaScript Promises and Async/Await on the kit', () => {
  it('no hero, no page keys, a goal', async () => {
    await render();
    expect(text()).not.toContain('JavaScript Promises & Async/Await Simulator');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/4');
    expect(text()).toContain('Start in global execution');

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(text()).toContain('Start in global execution');
    expect(text()).toContain('0/4');
  });

  it('one signal, after the last mission', async () => {
    await render();

    await next(5);
    expect(text()).toContain('1/4');
    expect(completions).toBe(0);

    await click('Await suspends the function', true);
    await next(4);
    expect(text()).toContain('2/4');
    expect(completions).toBe(0);

    await click('Rejections jump to catch', true);
    await next(3);
    expect(text()).toContain('3/4');
    expect(completions).toBe(0);

    await click('Promise combinators', true);
    await next(4);
    expect(completions).toBe(1);
    expect(text()).toContain('Async code mapped');

    await click('Keep exploring', true);
    expect(text()).not.toContain('Async code mapped');
    await click('Promise combinators', true);
    await next(4);
    expect(completions).toBe(1);

    await click('Start over', true);
    await click('Click again to start over', true);
    expect(text()).toContain('0/4');
  }, 60_000);
});

describe('PostgreSQL Wire Protocol Simulator on the kit', () => {
  it('no hero, no page keys, a goal', async () => {
    await renderPostgres();
    expect(text()).not.toContain('Watch every byte between a Postgres client and server.');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/4');
    expect(text()).toContain('Connect and authenticate');

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(text()).toContain('Connect and authenticate');
    expect(text()).toContain('0/4');
  });

  it('one signal, after the last mission', async () => {
    await renderPostgres();

    await next(9);
    expect(text()).toContain('1/4');
    expect(completions).toBe(0);

    await click('Simple', true);
    await next(4);
    expect(text()).toContain('2/4');
    expect(completions).toBe(0);

    await click('Extended', true);
    await next(9);
    expect(text()).toContain('3/4');
    expect(completions).toBe(0);

    await click('Error', true);
    await next(3);
    expect(completions).toBe(1);
    expect(text()).toContain('PostgreSQL wire tour complete');

    await click('Keep exploring', true);
    expect(text()).not.toContain('PostgreSQL wire tour complete');
    await click('Previous', true);
    await click('Next', true);
    expect(completions).toBe(1);

    await click('Start over', true);
    await click('Click again to start over', true);
    expect(text()).toContain('0/4');
  }, 60_000);
});

describe('REST vs GraphQL Simulator on the kit', () => {
  it('no hero, no page keys, a goal', async () => {
    await renderRestVsGraphql();
    expect(text()).not.toContain('Compare data fetching approaches side-by-side');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/3');
    expect(text()).toContain('Compare one user profile over REST and GraphQL.');

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(text()).toContain('Compare one user profile over REST and GraphQL.');
    expect(text()).toContain('0/3');
  });

  it('one signal, after the last mission', async () => {
    await renderRestVsGraphql();

    await runRestVsGraphql(200);
    expect(text()).toContain('1/3');
    expect(text()).toContain('100ms');
    expect(text()).toContain('115ms');
    expect(completions).toBe(0);

    await chooseRestVsGraphqlScenario('user-posts-comments');
    await runRestVsGraphql(800);
    expect(text()).toContain('2/3');
    expect(text()).toContain('300ms');
    expect(completions).toBe(0);

    await chooseRestVsGraphqlScenario('multiple-resources');
    await runRestVsGraphql(200);
    expect(completions).toBe(1);
    expect(text()).toContain('API Bazaar comparison complete');

    await click('Keep exploring', true);
    expect(text()).not.toContain('API Bazaar comparison complete');
    await runRestVsGraphql(200);
    expect(completions).toBe(1);

    await click('Start over', true);
    await click('Click again to start over', true);
    expect(text()).toContain('0/3');
  }, 60_000);
});
