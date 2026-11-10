// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SslTlsHandshakeSimulator from '@/components/games/ssl-tls-handshake-simulator';
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

async function chooseVersion(version: 'TLS 1.2' | 'TLS 1.3') {
  const group = container.querySelector('[role="group"][aria-label="TLS version"]');
  if (!group) throw new Error('no TLS version group');
  const button = [...group.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === version
  );
  if (!button) throw new Error(`no version "${version}"`);
  await act(async () => button.click());
}

async function chooseScenario(value: string) {
  const label = [...container.querySelectorAll('label')].find(
    (candidate) => candidate.textContent?.trim() === 'Failure scenario'
  );
  if (!label) throw new Error('no failure scenario label');
  const id = label.htmlFor;
  const field = id ? container.querySelector(`#${id}`) : null;
  if (!(field instanceof HTMLSelectElement)) throw new Error('no failure scenario select');
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!setValue) throw new Error('no select value setter');
  await act(async () => {
    setValue.call(field, value);
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
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
  await act(async () => root.render(createElement(SslTlsHandshakeSimulator)));
}

describe('SSL/TLS Handshake on the kit', () => {
  it('no hero, no page keys, a goal', async () => {
    await render();
    expect(text()).not.toContain('How to use this simulator');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/4');
    expect(text()).toContain('ClientHello');

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(text()).toContain('ClientHello');
  });

  it('Prev works after auto-play ends', async () => {
    await render();
    await click('Play', true);
    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3500);
      });
    }
    expect(text()).toContain('Secure');
    const previous = [...container.querySelectorAll('button')].find(
      (button) => buttonName(button) === 'Prev'
    );
    if (!previous) throw new Error('no Prev button');
    expect(previous.disabled).toBe(false);
  }, 60_000);

  it('one signal, after the fourth mission', async () => {
    await render();
    await chooseVersion('TLS 1.3');
    await next(4);
    expect(text()).toContain('1/4');
    expect(completions).toBe(0);

    await chooseVersion('TLS 1.2');
    await next(8);
    expect(text()).toContain('2/4');

    await chooseScenario('expired-cert');
    await next(2);
    expect(text()).toContain('3/4');
    expect(completions).toBe(0);

    await chooseScenario('weak-cipher');
    await next(1);
    expect(completions).toBe(1);
    expect(text()).toContain('Handshakes explored');

    await click('Keep exploring', true);
    expect(completions).toBe(1);
    await chooseVersion('TLS 1.3');
    await chooseScenario('none');
    await next(4);
    expect(completions).toBe(1);
  }, 60_000);
});
