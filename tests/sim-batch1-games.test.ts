// @vitest-environment jsdom

import { act, createElement, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CronExpressionSimulator from '@/components/games/cron-expression-simulator';
import DockerEscape from '@/components/games/docker-escape';
import DockerUnderTheHoodSimulator from '@/components/games/docker-under-the-hood-simulator';
import ForkBombSimulator from '@/components/games/fork-bomb-simulator';
import K8sRbacSimulator from '@/components/games/k8s-rbac-simulator';
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

function name(b: HTMLButtonElement): string {
  return (b.getAttribute('aria-label') ?? b.textContent ?? '').trim();
}

/** The first enabled button whose name contains `label`, or equals it with `exact`. */
async function click(label: string, exact = false) {
  const b = [...container.querySelectorAll('button')].find(
    (x) => !x.disabled && (exact ? name(x) === label : name(x).includes(label))
  );
  if (!b) throw new Error(`no enabled button "${label}"`);
  await act(async () => b.click());
}

const hasButton = (label: string) =>
  [...container.querySelectorAll('button')].some((b) => name(b) === label);

/** Picks an option in the select labelled `label` (the first copy of the panel). */
async function choose(label: string, value: string) {
  const l = [...container.querySelectorAll('label')].find((x) => x.textContent?.trim() === label);
  const el = l && (document.getElementById(l.htmlFor) as HTMLSelectElement | null);
  if (!el) throw new Error(`no select "${label}"`);
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  await act(async () => {
    setValue?.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/** Moves the range input whose label starts with `label` (the first copy of the panel). */
async function slide(label: string, value: number) {
  const l = [...container.querySelectorAll('label')].find((x) =>
    x.textContent?.trim().startsWith(label)
  );
  const el = l && (document.getElementById(l.htmlFor) as HTMLInputElement | null);
  if (!el) throw new Error(`no slider "${label}"`);
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setValue?.call(el, String(value));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function waitFor(check: () => boolean, ms = 30_000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
  }
}

async function render(Game: ComponentType) {
  await act(async () => root.render(createElement(Game)));
}

beforeEach(() => {
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

describe('Fork Bomb Simulator on the kit', () => {
  it('signals once, when a protection holds, and free play goes on', async () => {
    await render(ForkBombSimulator);
    expect(text()).toContain('Goal: Pick a protection.');

    await slide('Speed', 4);
    await click('ulimit -u');
    expect(text()).toContain('Goal: Press Start with the protection on.');
    await click('Start', true);
    await waitFor(() => hasButton('Keep exploring'));
    expect(text()).toContain('ulimit -u stopped the fork bomb at 100 processes');
    expect(completions).toBe(1);

    // Free play: the stage comes back, and a second contained run does not signal again.
    await click('Keep exploring');
    expect(text()).toContain('System protected');
    await click('Restart', true);
    await waitFor(
      () => !text().includes('Fork bomb running.') && text().includes('System protected')
    );
    expect(hasButton('Keep exploring')).toBe(false);
    expect(completions).toBe(1);
  }, 90_000);

  it('does not signal when the fork bomb crashes the system', async () => {
    await render(ForkBombSimulator);
    await slide('Speed', 4);
    await click('Start', true);
    await waitFor(() => text().includes('System crashed'));
    expect(completions).toBe(0);
    expect(text()).toContain('Goal: Pick a protection.');
  }, 90_000);
});

describe('Cron Expression Simulator on the kit', () => {
  it('signals once, when the fourth example is opened', async () => {
    await render(CronExpressionSimulator);
    expect(text()).toContain('Goal: Open 4 examples');
    expect(text()).toContain('(1 of 4 open)');

    await click('Once a day at midnight');
    await click('The uneven step');
    expect(text()).toContain('(3 of 4 open)');
    expect(completions).toBe(0);

    await click('The even step');
    expect(text()).toContain('Lab complete');
    expect(completions).toBe(1);

    // Free play after the card: more examples, no second signal.
    await click('Keep exploring');
    expect(text()).not.toContain('Lab complete');
    await click('The OR trap');
    expect(text()).not.toContain('Lab complete');
    expect(completions).toBe(1);
  }, 30_000);

  it('does not count the same example twice', async () => {
    await render(CronExpressionSimulator);
    for (let i = 0; i < 3; i++) await click('The uneven step');
    await click('Once a day at midnight');
    expect(text()).toContain('(3 of 4 open)');
    expect(completions).toBe(0);
  }, 30_000);
});

describe('How Docker Works Under the Hood on the kit', () => {
  it('signals once, at the last stage', async () => {
    await render(DockerUnderTheHoodSimulator);
    for (let i = 0; i < 6; i++) await click('Next stage');
    expect(text()).not.toContain('Walkthrough complete');
    expect(completions).toBe(0);

    await click('Next stage');
    expect(text()).toContain('Walkthrough complete');
    expect(text()).toContain('It all runs on the shared kernel');
    expect(completions).toBe(1);

    await click('Previous stage');
    expect(text()).not.toContain('Walkthrough complete');
    expect(completions).toBe(1);
  }, 30_000);

  it('still signals when the last stage is picked directly, as before', async () => {
    await render(DockerUnderTheHoodSimulator);
    await click('Stage 8:');
    expect(text()).toContain('Walkthrough complete');
    expect(completions).toBe(1);
  }, 30_000);
});

describe('Container Security Challenge on the kit', () => {
  it('signals once, when the last scenario is checked', async () => {
    await render(DockerEscape);
    for (let i = 0; i < 6; i++) {
      expect(completions).toBe(0);
      if (i === 0) await click('-v /var/run/docker.sock:/var/run/docker.sock');
      await click(i === 0 ? 'Check 1 selection' : 'Nothing here is dangerous');
      if (i < 5) await click('Next scenario');
    }
    expect(text()).toContain('Challenge complete');
    expect(text()).toContain('1 of 7 escape routes found');
    expect(completions).toBe(1);

    await click('Start again');
    expect(text()).not.toContain('Challenge complete');
    expect(completions).toBe(1);
  }, 30_000);
});

describe('Kubernetes RBAC Simulator on the kit', () => {
  it('shows missions and signals once, when the last one passes', async () => {
    await render(K8sRbacSimulator);
    expect(text()).toContain('Missions 0/5');

    await click('Scenario 2:');
    await choose('Namespace', 'dev');
    await click('Scenario 3:');
    await choose('Namespace', 'dev');
    await click('Scenario 4:');
    await choose('Verb', 'list');
    await click('Scenario 6:');
    await choose('Verb', 'list');
    expect(text()).toContain('Missions 4/5');
    expect(completions).toBe(0);

    await click('Scenario 7:');
    await choose('Namespace', 'prod');
    expect(text()).toContain('Lab complete');
    expect(completions).toBe(1);

    await click('Keep exploring');
    await choose('Namespace', 'dev');
    expect(text()).not.toContain('Lab complete');
    expect(completions).toBe(1);
  }, 30_000);

  it('does not pass a mission on a scenario’s first question', async () => {
    await render(K8sRbacSimulator);
    for (let i = 1; i <= 7; i++) await click(`Scenario ${i}:`);
    expect(text()).toContain('Missions 0/5');
    expect(completions).toBe(0);
  }, 30_000);
});
