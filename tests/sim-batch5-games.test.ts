// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PromqlPlayground from '@/components/games/promql-playground';
import { GAME_COMPLETE_EVENT } from '@/lib/games/game-complete';

vi.mock('next/navigation', () => ({
  usePathname: () => '/games/demo',
  useSearchParams: () => new URLSearchParams(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let completions: number;
const countCompletion = () => completions++;
const text = () => container.textContent ?? '';

function name(button: HTMLButtonElement): string {
  return (button.getAttribute('aria-label') ?? button.textContent ?? '').trim();
}

async function click(label: string, exact = false) {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) =>
      !candidate.disabled && (exact ? name(candidate) === label : name(candidate).includes(label))
  );
  if (!button) throw new Error(`no enabled button "${label}"`);
  await act(async () => button.click());
}

function textarea(): HTMLTextAreaElement {
  const field = container.querySelector('textarea');
  if (!field) throw new Error('no query textarea');
  return field;
}

async function runQuery(value: string) {
  const field = textarea();
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (!setValue) throw new Error('no textarea value setter');
  await act(async () => {
    setValue.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click('Run query', true);
}

function scalarValue(): number {
  const scalarLabel = [...container.querySelectorAll('p')].find(
    (candidate) => candidate.textContent === 'Scalar'
  );
  if (!scalarLabel) throw new Error('no scalar result');
  const value = scalarLabel.nextElementSibling?.textContent;
  if (!value) throw new Error('no scalar value');
  return Number(value);
}

beforeEach(() => {
  vi.useFakeTimers();
  completions = 0;
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
  await act(async () => root.render(createElement(PromqlPlayground)));
}

describe('PromQL Playground on the kit', () => {
  it('the error-rate tutorial query is a percentage', async () => {
    await render();
    await runQuery(
      'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100'
    );
    const percentage = scalarValue();
    expect(percentage).toBeGreaterThan(0.2);
    expect(percentage).toBeLessThan(1);

    await runQuery(
      'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))'
    );
    const fraction = scalarValue();
    expect(fraction).toBeCloseTo(percentage / 100, 4);
  });

  it('no hero, a goal, keys only in the editor', async () => {
    await render();
    expect(text()).not.toContain('Prometheus Query Builder');
    expect(text()).not.toContain('New to PromQL');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('Show only the POST requests.');

    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })
      );
    });
    expect(text()).not.toContain('4 series');

    await act(async () => {
      textarea().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })
      );
    });
    expect(text()).toContain('4 series');
  });

  it('one signal, after the fifth mission', async () => {
    await render();
    await runQuery('http_requests_total{method="GET"}');
    expect(completions).toBe(0);
    expect(text()).toContain('0/5');

    await runQuery('http_requests_total{method="POST"}');
    await runQuery('rate(http_requests_total[5m])');
    await runQuery('sum(rate(http_requests_total[5m]))');
    await runQuery('sum by(instance) (rate(http_requests_total[5m]))');
    expect(completions).toBe(0);
    expect(text()).toContain('4/5');

    await runQuery(
      'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100'
    );
    expect(completions).toBe(1);
    expect(text()).toContain('Missions complete');

    await click('Keep exploring', true);
    expect(completions).toBe(1);
    await runQuery(
      'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100'
    );
    expect(completions).toBe(1);
  });

  it('a tutorial loads its query', async () => {
    await render();
    const tutorial = [...container.querySelectorAll('button')].find((button) =>
      (button.textContent ?? '').includes('Filter What You See')
    );
    if (!tutorial) throw new Error('no Filter What You See tutorial');
    await act(async () => tutorial.click());
    expect(textarea().value).toBe('http_requests_total{method="GET"}');
  });
});
