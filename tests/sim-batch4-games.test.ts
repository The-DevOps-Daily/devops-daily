// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeploymentStrategiesSimulator from '@/components/games/deployment-strategies-simulator';
import KubernetesNetworkingCniSimulator from '@/components/games/kubernetes-networking-cni-simulator';
import K8sScheduler from '@/components/games/k8s-scheduler';
import OAuthOidcFlowSimulator from '@/components/games/oauth-oidc-flow-simulator';
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

async function wait(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function toEnd() {
  for (let clicks = 0; clicks < 20; clicks++) {
    const next = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => name(button) === 'Next step'
    );
    if (!next) throw new Error('no Next step button');
    if (next.disabled) return;
    await act(async () => next.click());
  }
  throw new Error('Next step did not become disabled');
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
  await act(async () => root.render(createElement(DeploymentStrategiesSimulator)));
}

describe('Deployment Strategies on the kit', () => {
  it('no card, no gradient, a goal', async () => {
    await render();
    expect(container.querySelector('[class*="bg-gradient"], [class*="min-h-screen"]')).toBeNull();
    expect(text()).toContain('Goal: ');
    expect(text()).not.toContain('Space play/pause');
    const recreate = [...container.querySelectorAll('button')].find(
      (button) => name(button) === 'Recreate'
    );
    if (!recreate) throw new Error('no Recreate button');
    expect(recreate.getAttribute('aria-pressed')).toBe('true');
  });

  it('one signal, after the fourth strategy', async () => {
    await render();
    await toEnd();
    expect(completions).toBe(0);
    await click('Rolling Update', true);
    await click('Play', true);
    for (let step = 0; step < 12; step++) await wait(2000);
    expect(
      [...container.querySelectorAll('button')].some((button) => name(button) === 'Replay')
    ).toBe(true);
    expect(completions).toBe(0);
    await click('Blue-Green', true);
    await toEnd();
    expect(completions).toBe(0);
    await click('Canary', true);
    await toEnd();
    expect(completions).toBe(1);
    expect(text()).toContain('All four strategies played');
    expect(text()).toContain('How they compare');
    await click('Keep exploring', true);
    expect(text()).not.toContain('How they compare');
    expect(completions).toBe(1);
    await click('Recreate');
    await toEnd();
    expect(completions).toBe(1);
    await click('Start over', true);
    await click('Click again to start over', true);
    const recreate = [...container.querySelectorAll('button')].find((button) =>
      name(button).includes('Recreate')
    );
    if (!recreate) throw new Error('no Recreate button');
    expect(recreate.getAttribute('aria-pressed')).toBe('true');
    expect(text()).toContain('0/4');
    expect(completions).toBe(1);
  }, 60_000);

  it('switching strategy resets the step in the same render', async () => {
    await render();
    await click('Rolling Update', true);
    await click('Next step');
    await click('Next step');
    await click('Next step');
    await click('Recreate', true);
    const recreate = [...container.querySelectorAll('button')].find(
      (button) => name(button) === 'Recreate'
    );
    if (!recreate) throw new Error('no Recreate button');
    expect(recreate.textContent).not.toContain('(played)');
    expect(text()).toContain('1/4');
  });

  it('keys work only inside the game', async () => {
    await render();
    const inside = container.querySelector('button');
    if (!inside) throw new Error('no button inside game');
    await act(async () =>
      inside.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }))
    );
    const blueGreen = [...container.querySelectorAll('button')].find(
      (button) => name(button) === 'Blue-Green'
    );
    if (!blueGreen) throw new Error('no Blue-Green button');
    expect(blueGreen.getAttribute('aria-pressed')).toBe('true');
    await act(async () =>
      inside.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    );
    expect(
      [...container.querySelectorAll('button')].some((button) => name(button) === 'Play')
    ).toBe(true);
    await act(async () =>
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      )
    );
    expect(text()).toContain('1/5');
  });
});

async function renderScheduler() {
  await act(async () => root.render(createElement(K8sScheduler)));
}

async function placePod(podName: string, nodeName: string) {
  const pod = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) =>
      button.getAttribute('aria-pressed') !== null &&
      (button.textContent ?? '').trim().startsWith(podName)
  );
  if (!pod) throw new Error(`no pod chip "${podName}"`);
  await act(async () => pod.click());

  const placement = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => name(button) === `Place "${podName}" on ${nodeName}`
  );
  if (!placement) throw new Error(`no placement for "${podName}" on ${nodeName}`);
  await act(async () => placement.click());
}

async function clearLevel(placements: Array<[string, string]>) {
  for (const [pod, node] of placements) await placePod(pod, node);
}

describe('Kubernetes Scheduler on the kit', () => {
  const levelPlacements: Array<Array<[string, string]>> = [
    [
      ['db', 'node-a'],
      ['api', 'node-a'],
      ['web-1', 'node-b'],
      ['web-2', 'node-b'],
      ['cache', 'node-b'],
    ],
    [
      ['trainer', 'node-b (gpu)'],
      ['db', 'node-c (db)'],
      ['web-1', 'node-a'],
      ['web-2', 'node-d'],
      ['api', 'node-a'],
    ],
    [
      ['etl', 'node-a'],
      ['search', 'node-a'],
      ['api', 'node-b'],
      ['worker', 'node-b'],
    ],
    [
      ['api-1', 'node-a'],
      ['api-2', 'node-b'],
      ['api-3', 'node-c'],
      ['api-4', 'node-a'],
    ],
  ];

  it('no hero, no confetti, a goal', async () => {
    await renderScheduler();
    expect(container.querySelector('[class*="bg-linear"], [class*="fixed"]')).toBeNull();
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('1/4');
  });

  it('a wrong node explains why, next to the board', async () => {
    await renderScheduler();
    await placePod('db', 'node-a');
    await placePod('api', 'node-a');
    await placePod('web-1', 'node-a');
    expect(text()).toContain("Can't place it here");
    expect(text()).toContain('Exceeds CPU capacity');
    expect(completions).toBe(0);
  });

  it('one signal, after the fourth level', async () => {
    await renderScheduler();
    for (let level = 0; level < 3; level++) {
      await clearLevel(levelPlacements[level]);
      expect(completions).toBe(0);
      expect(text()).toContain('Level cleared');
      await click('Next level', true);
    }

    await clearLevel(levelPlacements[3]);
    expect(completions).toBe(1);
    expect(text()).toContain('All four levels cleared');
    await click('Keep exploring', true);
    expect(text()).toContain('Level cleared');
    expect(completions).toBe(1);
    await click('Reset level', true);
    await click('Click again to reset level', true);
    await clearLevel(levelPlacements[3]);
    expect(completions).toBe(1);
  }, 60_000);

  it('the level pills jump between levels', async () => {
    await renderScheduler();
    const levelThree = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      (button.getAttribute('aria-label') ?? '').startsWith('Level 3:')
    );
    if (!levelThree) throw new Error('no Level 3 pill');
    await act(async () => levelThree.click());
    expect(text()).toContain('3/4');
  });
});

async function renderCni() {
  await act(async () => root.render(createElement(KubernetesNetworkingCniSimulator)));
}

function packetScenarioButtons() {
  const section = [...container.querySelectorAll<HTMLElement>('section')].find(
    (candidate) => candidate.querySelector('h3')?.textContent === 'Packet scenarios'
  );
  if (!section) throw new Error('no Packet scenarios section');
  const buttons = [...section.querySelectorAll<HTMLButtonElement>('button')].filter(
    (button) => button.getAttribute('aria-pressed') !== null
  );
  if (buttons.length !== 8) throw new Error(`expected 8 scenario buttons, found ${buttons.length}`);
  return buttons;
}

async function walkCurrentCniScenario() {
  for (let clicks = 0; clicks < 20; clicks++) {
    const next = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => name(button) === 'Next hop'
    );
    if (!next) {
      const scenario = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => name(button) === 'Next scenario'
      );
      if (scenario) return;
      throw new Error('no CNI next button');
    }
    await act(async () => next.click());
  }
  throw new Error('Next hop did not become Next scenario');
}

describe('Kubernetes CNI Simulator on the kit', () => {
  it('no hero, a goal, scoped keys', async () => {
    await renderCni();
    expect(text()).not.toContain('// packet path lab');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/8 done');

    await act(async () =>
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      )
    );
    expect(text()).toContain('1/4');

    const inside = container.querySelector<HTMLButtonElement>('button');
    if (!inside) throw new Error('no CNI button');
    await act(async () =>
      inside.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    );
    expect(text()).toContain('2/4');
  });

  it('one signal, after the eighth scenario', async () => {
    await renderCni();
    const scenarios = packetScenarioButtons();
    for (const [index, scenario] of scenarios.entries()) {
      await act(async () => scenario.click());
      await walkCurrentCniScenario();
      if (index < scenarios.length - 1) expect(completions).toBe(0);
    }
    expect(completions).toBe(1);
    expect(text()).toContain('All 8 packet paths walked');
    await click('Keep exploring', true);
    expect(completions).toBe(1);

    const first = packetScenarioButtons()[0];
    if (!first) throw new Error('no first scenario');
    await act(async () => first.click());
    await walkCurrentCniScenario();
    expect(completions).toBe(1);
  }, 60_000);

  it('Next scenario goes to the first scenario not walked', async () => {
    await renderCni();
    await walkCurrentCniScenario();
    await click('Next scenario', true);
    const second = packetScenarioButtons()[1];
    if (!second) throw new Error('no second scenario');
    expect(second.getAttribute('aria-pressed')).toBe('true');
    expect(text()).toContain('1/');
  });
});

async function renderOAuthOidc() {
  await act(async () => root.render(createElement(OAuthOidcFlowSimulator)));
}

async function runOAuthOidcAction() {
  const action = [...container.querySelectorAll<HTMLButtonElement>('[data-sim-action]')].find(
    (button) => !button.disabled
  );
  if (!action) throw new Error('no enabled OAuth/OIDC action');
  await act(async () => action.click());
  await wait(600);
}

describe('OAuth/OIDC Flow on the kit', () => {
  it('no hero, a goal, the explanation in the bar', async () => {
    await renderOAuthOidc();
    expect(text()).not.toContain('// oauth oidc lab');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/');
    await click('Explain', true);
    expect(text()).toContain('Why this step');
    await click('Explain', true);
    expect(text()).not.toContain('Why this step');
  });

  it('one signal, on the last step', async () => {
    await renderOAuthOidc();
    for (let clicks = 0; clicks < 40; clicks++) {
      if (text().includes('15/15')) break;
      await runOAuthOidcAction();
      expect(completions).toBe(text().includes('15/15') ? 1 : 0);
    }
    if (!text().includes('15/15'))
      throw new Error('OAuth/OIDC flow did not complete after 40 clicks');
    expect(completions).toBe(1);
    expect(text()).toContain('Lab complete');
    await click('Keep exploring', true);
    expect(completions).toBe(1);
    expect(text()).toContain('Protocol flow');
  }, 60_000);

  it('a lesson pill jumps to that lesson', async () => {
    await renderOAuthOidc();
    const lessonThree = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => (button.getAttribute('aria-label') ?? '').startsWith('Lesson 3:')
    );
    if (!lessonThree) throw new Error('no Lesson 3 pill');
    await act(async () => lessonThree.click());
    expect(text()).toContain('Scopes & Refresh');
  });
});
