// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DnsSimulator from '@/components/games/dns-simulator';
import PacketJourney from '@/components/games/packet-journey';
import TcpVsUdpSimulator from '@/components/games/tcp-vs-udp';
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

async function chooseRecordType(value: 'A' | 'MX') {
  const field = container.querySelector('select[aria-label="Record type"]');
  if (!(field instanceof HTMLSelectElement)) throw new Error('no record type select');
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!setValue) throw new Error('no select value setter');
  await act(async () => {
    setValue.call(field, value);
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function finishLookup(steps: number) {
  for (let index = 0; index < steps; index += 1) await click('Step', true);
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
  await act(async () => root.render(createElement(DnsSimulator)));
}

describe('DNS Simulator on the kit', () => {
  it('no hero, no page keys, a goal', async () => {
    await render();
    expect(text()).not.toContain('DNS Resolution Simulator');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/3');

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(text()).toContain('Ready: A example.com');
    expect(text()).toContain('0/3');
  });

  it('one signal, after the last mission', async () => {
    await render();

    await click('Run lookup', true);
    await finishLookup(6);
    expect(text()).toContain('1/3');
    expect(completions).toBe(0);

    await click('New lookup', true);
    await click('Run lookup', true);
    await finishLookup(1);
    expect(text()).toContain('2/3');
    expect(completions).toBe(0);

    await click('New lookup', true);
    await chooseRecordType('MX');
    await click('Run lookup', true);
    await finishLookup(6);
    expect(completions).toBe(1);
    expect(text()).toContain('DNS missions complete');

    await click('Keep exploring', true);
    await click('New lookup', true);
    await click('Run lookup', true);
    await finishLookup(1);
    expect(completions).toBe(1);

    await click('Start over', true);
    await click('Click again to start over', true);
    expect(text()).toContain('0/3');
  }, 60_000);
});

async function renderTcpVsUdp() {
  await act(async () => root.render(createElement(TcpVsUdpSimulator)));
}

async function setTcpRange(label: 'Traffic speed' | 'Packet loss' | 'Jitter', value: number) {
  const field = container.querySelector(`input[aria-label="${label}"]`);
  if (!(field instanceof HTMLInputElement)) throw new Error(`no ${label} range`);
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setValue) throw new Error('no range value setter');
  await act(async () => {
    setValue.call(field, String(value));
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function advanceTcp(milliseconds: number) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 250) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
  }
}

describe('TCP vs UDP on the kit', () => {
  beforeEach(() => {
    window.requestAnimationFrame = (callback) =>
      setTimeout(() => callback(Date.now()), 25) as unknown as number;
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  });

  it('no hero, no page keys, a goal', async () => {
    await renderTcpVsUdp();
    expect(text()).not.toContain('Protocol Simulator');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/3');

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(text()).toContain('Ready to compare delivery behavior.');
    expect(text()).toContain('0/3');
  });

  it('one signal, after the last mission', async () => {
    await renderTcpVsUdp();
    await setTcpRange('Traffic speed', 100);
    await click('Start', true);
    await advanceTcp(10_000);
    expect(text()).toContain('1/3');
    expect(completions).toBe(0);

    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    await setTcpRange('Packet loss', 30);
    await advanceTcp(4_000);
    expect(text()).toContain('2/3');
    expect(completions).toBe(0);

    await click('UDP', true);
    await click('Start', true);
    await advanceTcp(2_000);
    expect(completions).toBe(1);
    expect(text()).toContain('Protocol missions complete');

    await click('Keep exploring', true);
    await advanceTcp(1_000);
    expect(text()).not.toContain('Protocol missions complete');
    expect(completions).toBe(1);

    await click('Start over', true);
    await click('Click again to start over', true);
    expect(text()).toContain('0/3');
    random.mockRestore();
  }, 60_000);
});

async function renderPacketJourney() {
  await act(async () => root.render(createElement(PacketJourney)));
}

async function choosePacketScenario(value: 'https' | 'https-cdn-cache') {
  const field = container.querySelector('select[aria-label="Scenario"]');
  if (!(field instanceof HTMLSelectElement)) throw new Error('no packet scenario select');
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!setValue) throw new Error('no select value setter');
  await act(async () => {
    setValue.call(field, value);
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function finishPacketJourney(nextStages: number) {
  await click('Start', true);
  for (let index = 0; index < nextStages; index += 1) await click('Next', true);
}

describe('Packet Journey on the kit', () => {
  it('no hero, no page keys, a goal', async () => {
    await renderPacketJourney();
    expect(text()).not.toContain('Network Packet Journey');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/3');

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(text()).toContain('Ready: HTTPS + CDN.');
    expect(text()).toContain('0/3');
  });

  it('one signal, after the last mission', async () => {
    await renderPacketJourney();

    await choosePacketScenario('https');
    await finishPacketJourney(12);
    expect(text()).toContain('1/3');
    expect(completions).toBe(0);

    await choosePacketScenario('https-cdn-cache');
    await finishPacketJourney(6);
    expect(text()).toContain('2/3');
    expect(completions).toBe(0);

    await choosePacketScenario('https');
    await click('TLS Handshake', true);
    await click('Start', true);
    await click('Next', true);
    await click('Next', true);
    await click('Next', true);
    expect(completions).toBe(1);
    expect(text()).toContain('Packet Journey missions complete');

    await click('Keep exploring', true);
    await click('Start', true);
    await click('Next', true);
    await click('Next', true);
    await click('Next', true);
    expect(completions).toBe(1);

    await click('Start over', true);
    await click('Click again to start over', true);
    expect(text()).toContain('0/3');
  }, 60_000);
});
