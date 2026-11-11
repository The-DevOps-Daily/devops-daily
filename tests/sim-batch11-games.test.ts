// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MessageQueueSimulator from '@/components/games/message-queue-simulator';
import SmtpFlowSimulator from '@/components/games/smtp-flow-simulator';
import WebhookDeliverySimulator from '@/components/games/webhook-delivery-simulator';
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

async function setScenario(value: string) {
  const field = container.querySelector('select[aria-label="Scenario"]');
  if (!(field instanceof HTMLSelectElement)) throw new Error('no scenario selector');
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!setValue) throw new Error('no select value setter');
  await act(async () => {
    setValue.call(field, value);
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function clickMode(label: 'Kafka log' | 'Queue') {
  const group = container.querySelector('[role="group"][aria-label="Queue mode"]');
  if (!group) throw new Error('no queue mode group');
  const button = [...group.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (!button) throw new Error(`no mode "${label}"`);
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
  await act(async () => root.render(createElement(MessageQueueSimulator)));
}

async function renderSmtp() {
  await act(async () => root.render(createElement(SmtpFlowSimulator)));
}

async function renderWebhook() {
  await act(async () => root.render(createElement(WebhookDeliverySimulator)));
}

async function setWebhookBehavior(value: string) {
  const field = container.querySelector('select[aria-label="Endpoint response"]');
  if (!(field instanceof HTMLSelectElement)) throw new Error('no endpoint response selector');
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!setValue) throw new Error('no select value setter');
  await act(async () => {
    setValue.call(field, value);
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function settleWebhookVerification() {
  for (let index = 0; index < 20; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
    if (text().includes('Rejected:')) return;
  }
  throw new Error('signature verification did not settle');
}

async function setSmtpScenario(value: 'happy-path' | 'greylist' | 'auth-failure') {
  const field = container.querySelector('select[aria-label="SMTP scenario"]');
  if (!(field instanceof HTMLSelectElement)) throw new Error('no SMTP scenario selector');
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!setValue) throw new Error('no select value setter');
  await act(async () => {
    setValue.call(field, value);
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('Message Queue Simulator on the kit', () => {
  it('no hero, no page keys, a goal', async () => {
    await render();
    expect(text()).not.toContain('Visualize producers, brokers, partitions');
    expect(text()).not.toContain('Message Queue Simulator');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/4');
    const before = text();

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });

    expect(text()).toBe(before);
  });

  it('one signal, after the last mission', async () => {
    await render();

    await click('Step', true);
    expect(text()).toContain('1/4');
    expect(completions).toBe(0);

    await setScenario('lag');
    expect(text()).toContain('1/4');
    await click('Step', true);
    expect(text()).toContain('2/4');
    expect(completions).toBe(0);

    await click('Poison message', true);
    await click('Step', true);
    await click('Step', true);
    await click('Step', true);
    expect(text()).toContain('3/4');
    expect(completions).toBe(0);

    await clickMode('Queue');
    await click('Step', true);
    expect(completions).toBe(1);
    expect(text()).toContain('Message queue missions complete');

    await click('Keep exploring', true);
    expect(text()).not.toContain('Message queue missions complete');
    await click('Step', true);
    expect(completions).toBe(1);

    await click('Start over', true);
    await click('Click again to start over', true);
    expect(text()).toContain('0/4');
    expect(completions).toBe(1);
  }, 60_000);
});

describe('SMTP Flow Simulator on the kit', () => {
  it('no hero, no page keys, a goal', async () => {
    await renderSmtp();
    expect(text()).not.toContain('Watch a message move from application code');
    expect(text()).not.toContain('SMTP Flow Simulator');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/3');
    const before = text();

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });

    expect(text()).toBe(before);
  });

  it('one signal, after the last mission', async () => {
    await renderSmtp();

    for (let index = 0; index < 8; index += 1) await click('Next', true);
    expect(text()).toContain('1/3');
    expect(completions).toBe(0);

    await setSmtpScenario('greylist');
    for (let index = 0; index < 5; index += 1) await click('Next', true);
    expect(text()).toContain('2/3');
    expect(completions).toBe(0);

    await setSmtpScenario('auth-failure');
    await click('Next', true);
    expect(text()).toContain('3/3');
    expect(completions).toBe(1);
    expect(text()).toContain('SMTP missions complete');

    await click('Keep exploring', true);
    expect(text()).not.toContain('SMTP missions complete');
    await click('Previous', true);
    await click('Next', true);
    expect(completions).toBe(1);

    await click('Start over', true);
    await click('Click again to start over', true);
    expect(text()).toContain('0/3');
    expect(completions).toBe(1);
  }, 60_000);
});

describe('Webhook Delivery Simulator on the kit', () => {
  it('no hero, no page keys, a goal', async () => {
    await renderWebhook();
    expect(text()).not.toContain('Follow one message from your app to the receiver.');
    expect(text()).not.toContain('Webhook Delivery Simulator');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/4');
    const before = text();

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });

    expect(text()).toBe(before);
  });

  it('one signal, after the last mission', async () => {
    await renderWebhook();

    await setWebhookBehavior('success');
    await click('Send event', true);
    expect(text()).toContain('1/4');
    expect(completions).toBe(0);

    await setWebhookBehavior('intermittent');
    await click('Send event', true);
    await click('Reveal all attempts', true);
    expect(text()).toContain('2/4');
    expect(completions).toBe(0);

    await click('Verify signature', true);
    await click('Edit body', true);
    await settleWebhookVerification();
    expect(text()).toContain('3/4');
    expect(completions).toBe(0);

    await click('Redeliver same message', true);
    expect(completions).toBe(1);
    expect(text()).toContain('Webhook delivery missions complete');

    await click('Keep exploring', true);
    expect(text()).not.toContain('Webhook delivery missions complete');
    await click('Redeliver same message', true);
    expect(completions).toBe(1);

    await click('Start over', true);
    await click('Click again to start over', true);
    expect(text()).toContain('0/4');
    expect(completions).toBe(1);
  }, 60_000);
});
