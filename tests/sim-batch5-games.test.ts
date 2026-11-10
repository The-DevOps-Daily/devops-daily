// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PromqlPlayground from '@/components/games/promql-playground';
import LogAggregationPipelineSimulator from '@/components/games/log-aggregation-pipeline-simulator';
import LatencyPercentilesSimulator from '@/components/games/latency-percentiles-simulator';
import RateLimitSimulator from '@/components/games/rate-limit-simulator';
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
  }, 60_000);

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
  }, 60_000);

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

async function renderLogPipeline() {
  await act(async () => root.render(createElement(LogAggregationPipelineSimulator)));
}

function scenario(name: string): HTMLButtonElement {
  const group = container.querySelector('[role="group"][aria-label="Scenario"]');
  if (!group) throw new Error('no Scenario group');
  const button = [...group.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === name
  );
  if (!button) throw new Error(`no scenario "${name}"`);
  return button;
}

async function pickScenario(label: string) {
  await act(async () => scenario(label).click());
}

async function stepPipeline(count: number) {
  for (let index = 0; index < count; index += 1) {
    await click('Step', true);
  }
}

async function runPipeline(count: number) {
  await click('Run flow', true);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1050 * count);
  });
  await click('Pause', true);
}

async function inspectPipelineStage(label: string) {
  const button = [...container.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.trim().startsWith(label)
  );
  if (!button) throw new Error(`no pipeline stage "${label}"`);
  await act(async () => button.click());
}

async function openSearchLogs() {
  await click('Search', true);
  await click('Search logs', true);
}

async function chooseLevel(level: string) {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) =>
      candidate.getAttribute('aria-pressed') !== null && candidate.textContent?.trim() === level
  );
  if (!button) throw new Error(`no level "${level}"`);
  await act(async () => button.click());
}

describe('Log Aggregation Pipeline on the kit', () => {
  it('no hero, a goal, scenarios in the bar', async () => {
    await renderLogPipeline();
    expect(text()).not.toContain('Production log pipeline');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/5');
    expect(scenario('Healthy flow').getAttribute('aria-pressed')).toBe('true');
  });

  it('a mission needs the right stage, not only the event', async () => {
    await renderLogPipeline();
    await pickScenario('Parser mismatch');
    await stepPipeline(3);
    await inspectPipelineStage('Sources');
    expect(text()).toContain('0/5');
    await inspectPipelineStage('Process');
    expect(text()).toContain('1/5');
  }, 60_000);

  it('one signal, after the fifth mission', async () => {
    await renderLogPipeline();

    await runPipeline(5);
    await openSearchLogs();
    expect(completions).toBe(0);

    await pickScenario('Traffic spike');
    await runPipeline(13);
    await inspectPipelineStage('Sources');
    expect(completions).toBe(0);

    await pickScenario('Parser mismatch');
    await runPipeline(3);
    await inspectPipelineStage('Process');
    expect(completions).toBe(0);

    await pickScenario('Slow indexing');
    await runPipeline(15);
    await inspectPipelineStage('Index');
    expect(completions).toBe(0);

    await pickScenario('Traffic spike');
    await runPipeline(5);
    await openSearchLogs();
    await chooseLevel('ERROR');
    expect(completions).toBe(1);
    expect(text()).toContain('Missions complete');

    await click('Keep exploring', true);
    expect(completions).toBe(1);
  }, 60_000);
});

async function renderLatency() {
  await act(async () => root.render(createElement(LatencyPercentilesSimulator)));
}

function percentileButton(label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (!button) throw new Error(`no percentile button "${label}"`);
  return button;
}

function slider(label: string): HTMLElement {
  const labelElement = [...container.querySelectorAll('span')].find(
    (candidate) => candidate.textContent === label
  );
  const labelId = labelElement?.id;
  if (!labelId) throw new Error(`no slider label "${label}"`);
  const thumb = container.querySelector(`[role="slider"][aria-labelledby="${labelId}"]`);
  if (!thumb) throw new Error(`no slider "${label}"`);
  return thumb;
}

async function moveSlider(label: string, key: 'ArrowLeft' | 'ArrowRight') {
  const thumb = slider(label);
  await act(async () => {
    thumb.focus();
    thumb.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

describe('Latency Simulator on the kit', () => {
  it('no hero, a goal, nothing done at the defaults', async () => {
    await renderLatency();
    expect(text()).not.toContain('Explore P90, P95, and P99 latency');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/4');
    expect(scenario('Cache Churn').getAttribute('aria-pressed')).toBe('true');
    await moveSlider('Slow tail', 'ArrowRight');
    expect(slider('Slow tail').getAttribute('aria-valuenow')).toBe('7');
  });

  it('the readout waits for a pick', async () => {
    await renderLatency();
    await pickScenario('Noisy Neighbor');
    expect(text()).toContain('Which percentile would you page on?');

    await act(async () => percentileButton('P95').click());
    expect(text()).toContain('Look again');

    await act(async () => percentileButton('P99').click());
    expect(text()).toContain('Right call');
    const alert = [...container.querySelectorAll('li')].find((item) =>
      item.textContent?.includes('For Noisy Neighbor, pick the percentile you would page on.')
    );
    if (!alert) throw new Error('no alert mission');
    expect(alert.textContent).toContain('(done)');
  }, 60_000);

  it('one signal, after the fourth mission', async () => {
    await renderLatency();

    await pickScenario('Healthy API');
    await pickScenario('Noisy Neighbor');
    await act(async () => percentileButton('P99').click());
    expect(completions).toBe(0);
    expect(text()).toContain('3/4');

    await pickScenario('Cold Starts');
    expect(text()).not.toContain('Missions complete');
    expect(slider('Slow tail').getAttribute('aria-valuenow')).toBe('6');
    await moveSlider('Slow tail', 'ArrowRight');
    expect(completions).toBe(1);
    expect(text()).toContain('Missions complete');

    await click('Keep exploring', true);
    expect(completions).toBe(1);
  }, 60_000);
});

async function renderRateLimit() {
  await act(async () => root.render(createElement(RateLimitSimulator)));
}

async function setSelect(label: string, value: string) {
  const labelElement = [...container.querySelectorAll('label')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  const field = labelElement?.htmlFor ? container.querySelector(`#${labelElement.htmlFor}`) : null;
  if (!(field instanceof HTMLSelectElement)) throw new Error(`no select "${label}"`);
  await act(async () => {
    field.value = value;
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function setRange(label: string, value: number) {
  const labelElement = [...container.querySelectorAll('label')].find((candidate) =>
    candidate.textContent?.trim().startsWith(label)
  );
  const field = labelElement?.htmlFor ? container.querySelector(`#${labelElement.htmlFor}`) : null;
  if (!(field instanceof HTMLInputElement)) throw new Error(`no range "${label}"`);
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setValue) throw new Error('no range value setter');
  await act(async () => {
    setValue.call(field, String(value));
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function wait(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

describe('Rate Limit Simulator on the kit', () => {
  it('no hero, no page-wide keys, a goal', async () => {
    await renderRateLimit();
    expect(text()).not.toContain('Learn rate limiting, backoff strategies');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/5');

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });
    expect(
      [...container.querySelectorAll('button')].some((button) => name(button) === 'Start')
    ).toBe(true);
  });

  it('one signal, after the fifth mission', async () => {
    await renderRateLimit();
    await click('Start', true);
    for (let elapsed = 0; elapsed < 20_000; elapsed += 500) await wait(500);
    expect(text()).toContain('2/5');
    expect(completions).toBe(0);

    for (let elapsed = 20_000; elapsed < 35_000; elapsed += 500) await wait(500);
    expect(text()).toContain('3/5');

    await setSelect('Backoff strategy', 'none');
    for (let elapsed = 0; elapsed < 20_000; elapsed += 500) await wait(500);
    expect(text()).toContain('4/5');
    expect(completions).toBe(0);

    await setRange('Burst size:', 1);
    await setRange('Burst interval:', 2000);
    for (
      let elapsed = 0;
      elapsed < 120_000 && !text().includes('Missions complete');
      elapsed += 500
    ) {
      await wait(500);
    }
    if (!text().includes('Missions complete')) throw new Error('missions did not complete');
    expect(completions).toBe(1);

    await click('Keep exploring', true);
    expect(completions).toBe(1);
    for (let elapsed = 0; elapsed < 10_000; elapsed += 500) await wait(500);
    expect(completions).toBe(1);
  }, 60_000);
});
