// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AwsVpcSimulator from '@/components/games/aws-vpc-simulator';
import MicroservicesSimulator from '@/components/games/microservices-simulator';
import ServiceMeshSimulator from '@/components/games/service-mesh-simulator';
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

async function render() {
  await act(async () => root.render(createElement(AwsVpcSimulator)));
}

async function renderMicroservices() {
  await act(async () => root.render(createElement(MicroservicesSimulator)));
}

async function renderServiceMesh() {
  await act(async () => root.render(createElement(ServiceMeshSimulator)));
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function runScenario(scenario: string, nextCount: number) {
  await click(scenario, true);
  await click('Run', true);
  for (let index = 0; index < nextCount; index += 1) await click('Next', true);
  await click('Finish', true);
}

beforeEach(() => {
  completions = 0;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
  window.addEventListener(GAME_COMPLETE_EVENT, countCompletion);
  window.matchMedia = () => ({
    matches: false,
    media: '',
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  });
  Element.prototype.scrollTo = () => {};
  Element.prototype.scrollBy = () => {};
  Element.prototype.scrollIntoView = () => {};
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.removeEventListener(GAME_COMPLETE_EVENT, countCompletion);
});

describe('AWS VPC Simulator on the kit', () => {
  it('no hero, no page keys, a goal', async () => {
    await render();
    expect(text()).not.toContain('AWS VPC Builder');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/4');

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(text()).toContain('0/4');
    expect(text()).not.toContain('Traffic step 2');
  });

  it('signals once after the last mission', async () => {
    await render();

    await click('Public Web Server', true);
    await runScenario('Internet → Public EC2', 3);
    expect(text()).toContain('1/4');
    expect(completions).toBe(0);

    await click('Private with NAT', true);
    await runScenario('Private EC2 → Internet', 4);
    expect(text()).toContain('2/4');
    expect(completions).toBe(0);

    await click('Full Architecture', true);
    await runScenario('Public EC2 → Private EC2', 3);
    expect(text()).toContain('3/4');
    expect(completions).toBe(0);

    await click('Private with NAT', true);
    await click('NAT Gateway', true);
    await click('Private EC2 → Internet', true);
    await click('Run', true);
    expect(text()).toContain('VPC routes mapped');
    expect(completions).toBe(1);

    await click('Keep exploring', true);
    expect(text()).not.toContain('VPC routes mapped');
    await click('Run', true);
    expect(completions).toBe(1);

    await click('Start over', true);
    await click('Click again to start over', true);
    expect(text()).toContain('0/4');
  }, 60_000);
});

describe('Microservices Simulator on the kit', () => {
  let random: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    random = vi.spyOn(Math, 'random').mockReturnValue(0);
    window.requestAnimationFrame = (callback) =>
      setTimeout(() => callback(Date.now()), 16) as unknown as number;
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  });

  afterEach(() => {
    random.mockRestore();
    vi.useRealTimers();
  });

  it('no hero, no page keys, a goal', async () => {
    await renderMicroservices();
    expect(text()).not.toContain('Welcome to Microservices Simulator');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/4');

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(text()).toContain('0/4');
    expect(text()).toContain('Traffic is paused');
  });

  it('one signal, after the last mission', async () => {
    await renderMicroservices();

    await click('Start', true);
    await advance(500);
    expect(text()).toContain('1/4');
    expect(completions).toBe(0);

    await click('Add instance', true);
    expect(text()).toContain('2/4');
    expect(completions).toBe(0);

    await click('Cycle health', true);
    await click('Cycle health', true);
    random.mockReturnValue(0.99);
    await advance(500);
    expect(text()).toContain('3/4');
    expect(completions).toBe(0);

    await click('Cycle health', true);
    random.mockReturnValue(0);
    await advance(500);
    expect(text()).toContain('Service recovery mapped');
    expect(completions).toBe(1);

    await click('Keep exploring', true);
    expect(text()).not.toContain('Service recovery mapped');
    await click('Cycle health', true);
    await click('Cycle health', true);
    await click('Cycle health', true);
    await advance(500);
    expect(completions).toBe(1);

    await click('Start over', true);
    await click('Click again to start over', true);
    expect(text()).toContain('0/4');
  }, 60_000);
});

describe('Service Mesh Simulator on the kit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function playScenario(label: string) {
    await click(label);
    await click('Play', true);
    await advance(5000);
    await click('Pause', true);
  }

  it('no hero, no page keys, a goal', async () => {
    await renderServiceMesh();
    expect(text()).not.toContain('Service Mesh Traffic Simulator');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/4');
    expect(text()).toContain('The Problem: Insecure Communication');

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(text()).toContain('The Problem: Insecure Communication');
    expect(text()).toContain('0/4');
  });

  it('one signal, after the last mission', async () => {
    await renderServiceMesh();

    await playScenario('Scenario 3:');
    expect(text()).toContain('1/4');
    expect(completions).toBe(0);

    await playScenario('Scenario 4:');
    expect(text()).toContain('2/4');
    expect(completions).toBe(0);

    await playScenario('Scenario 5:');
    expect(text()).toContain('3/4');
    expect(completions).toBe(0);

    await click('Scenario 6:');
    await click('Play', true);
    await advance(2600);
    expect(text()).toContain('Service mesh missions complete');
    expect(completions).toBe(1);

    await click('Keep exploring', true);
    expect(text()).not.toContain('Service mesh missions complete');
    await click('Pause', true);
    await click('Play', true);
    await advance(2600);
    expect(completions).toBe(1);

    await click('Start over', true);
    await click('Click again to start over', true);
    expect(text()).toContain('0/4');
  }, 60_000);
});
