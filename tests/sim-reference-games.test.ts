// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IncidentCommanderSimulator from '@/components/games/incident-commander-simulator';
import TerraformPuzzle from '@/components/games/terraform-puzzle';
import { GAME_COMPLETE_EVENT } from '@/lib/games/game-complete';
import { SCENARIOS } from '@/lib/games/incident-commander-scenarios';
import { evaluate, isSolving } from '@/lib/games/terraform-puzzle-engine';
import { PUZZLES } from '@/lib/games/terraform-puzzle-puzzles';

vi.mock('next/navigation', () => ({
  usePathname: () => '/games/demo',
  useSearchParams: () => new URLSearchParams(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let completions: number;
const countCompletion = () => completions++;

function buttons(text: string): HTMLButtonElement[] {
  return [...container.querySelectorAll('button')].filter((b) =>
    (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(text)
  );
}

async function click(text: string) {
  const b = buttons(text).find((x) => !x.disabled);
  if (!b) throw new Error(`no enabled button "${text}"`);
  await act(async () => b.click());
}

/** Radix tabs switch on mousedown. */
async function tab(text: string) {
  const t = [...container.querySelectorAll('[role="tab"]')].find((x) =>
    x.textContent?.includes(text)
  );
  if (!t) throw new Error(`no tab "${text}"`);
  await act(async () => {
    t.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
  });
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

describe('Terraform State Puzzle on the kit', () => {
  async function solve(index: number) {
    const p = PUZZLES[index];
    const checks = p.inspects.map((i) => i.id);
    const option = p.options.find((o) => isSolving(evaluate(p, o.id, checks).verdict));
    if (!option) throw new Error(`puzzle ${p.id} has no solving option`);
    for (const i of p.inspects) await click(i.label);
    await click(option.label);
    await click('Try this fix');
  }

  it('signals Opsville once, when the last puzzle is solved', async () => {
    await act(async () => root.render(createElement(TerraformPuzzle)));
    for (let i = 0; i < PUZZLES.length; i++) {
      await solve(i);
      expect(completions).toBe(0);
      await click(i === PUZZLES.length - 1 ? 'See your results' : 'Next puzzle');
    }
    expect(container.textContent).toContain('Every state is fixed.');
    expect(completions).toBe(1);

    // Showing the card again signals again; the embed route still sends Opsville
    // one message per run, because it latches the first one.
    await click('Back to the puzzles');
    await click('Results');
    expect(completions).toBe(2);
  }, 60_000);

  it('does not signal an early look at the results', async () => {
    await act(async () => root.render(createElement(TerraformPuzzle)));
    await solve(0);
    await click('Results');
    expect(container.textContent).toContain('Some puzzles are still open.');
    expect(completions).toBe(0);
  });

  it('keeps the goal in view and asks before starting over', async () => {
    await act(async () => root.render(createElement(TerraformPuzzle)));
    expect(container.textContent).toContain(`Goal: ${PUZZLES[0].goal}`);
    await solve(0);
    await click('Start over');
    expect(container.textContent).toContain('Solved 1/8');
    await click('Click again to start over');
    expect(container.textContent).not.toContain('Solved 1/8');
  });
});

describe('Incident Commander on the kit', () => {
  async function takePage(title: string) {
    const index = SCENARIOS.findIndex((s) => s.title === title);
    const pageButton = buttons('Take the page')[index];
    if (!pageButton) throw new Error(`no scenario "${title}"`);
    await act(async () => pageButton.click());
  }

  it('signals Opsville once, when the review of a resolved incident opens', async () => {
    await act(async () => root.render(createElement(IncidentCommanderSimulator)));
    await takePage('Three changes, one incident');
    await tab('Mitigate');
    await click('Turn the new-pricing flag off');
    await click('Send to Priya');
    await click('Advance 1 min');
    await click('Advance 1 min');
    await click('Start monitoring');
    for (let i = 0; i < 8; i++) await click('Advance 1 min');
    await click('Resolve');
    expect(container.textContent).toContain('The incident is resolved.');
    expect(completions).toBe(0);

    await click('See the incident review');
    expect(container.textContent).toContain('Incident review');
    expect(container.textContent).toContain('What you learned');
    expect(completions).toBe(1);
  }, 30_000);

  it('does not signal when time runs out', async () => {
    await act(async () => root.render(createElement(IncidentCommanderSimulator)));
    await takePage('Three changes, one incident');
    for (let i = 0; i < 60; i++) await click('Advance 1 min');
    await click('See the incident review');
    expect(container.textContent).toContain('Not resolved in time');
    expect(completions).toBe(0);
  }, 60_000);
});
