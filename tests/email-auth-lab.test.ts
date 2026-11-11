// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EmailAuthLab from '@/components/games/email-auth-lab';
import { GAME_COMPLETE_EVENT } from '@/lib/games/game-complete';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let completions: number;
const countCompletion = () => completions++;

function buttonName(button: HTMLButtonElement): string {
  return (button.getAttribute('aria-label') ?? button.textContent ?? '').trim();
}

async function click(label: string, exact = false) {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) =>
      !candidate.disabled &&
      (exact ? buttonName(candidate) === label : buttonName(candidate).includes(label))
  );
  if (!button) throw new Error(`no enabled button ${label}`);
  await act(async () => button.click());
}

async function select(label: string, value: string) {
  const field = container.querySelector(`select[aria-label="${label}"]`);
  if (!(field instanceof HTMLSelectElement)) throw new Error(`no select ${label}`);
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!setValue) throw new Error('no select value setter');
  await act(async () => {
    setValue.call(field, value);
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
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
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
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

describe('Email Authentication Lab', () => {
  it('plays every mission through the controls and signals completion once', async () => {
    await act(async () => root.render(createElement(EmailAuthLab)));
    expect(container.textContent).toContain('Make SPF pass for your own bounce domain.');
    expect(container.textContent).toContain('0/6');

    await click('Use custom MAIL FROM bounce.shop.example');
    await select('SPF TXT record', 'esp-hard');
    await click('Send Direct', true);
    expect(container.textContent).toContain('1/6');
    await select('DKIM signing domain', 'shop.example');
    await click('Publish s1._domainkey.shop.example');
    await click('Send Direct', true);
    await select('DMARC record', 'none');
    await click('Send Direct', true);
    await click('Path: Forwarded', true);
    await click('Send Forwarded', true);
    await select('DMARC record', 'reject');
    await click('List rewrites From and sets Reply-To');
    await click('Path: Mailing list', true);
    await click('Send Mailing list', true);
    await select('SPF TXT record', 'too-many-includes');
    await click('Path: Direct', true);
    await click('Send Direct', true);

    expect(container.textContent).toContain('Email authentication mapped');
    expect(completions).toBe(1);
    await click('Keep exploring', true);
    expect(completions).toBe(1);
    expect(container.textContent).toContain('6/6');
    await click('Start over', true);
    await click('Click again to start over', true);
    expect(container.textContent).toContain('0/6');
  }, 60_000);
});
