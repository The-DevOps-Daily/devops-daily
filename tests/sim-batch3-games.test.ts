// @vitest-environment jsdom

import { act, createElement, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GitConceptsSimulator, { LESSONS } from '@/components/games/git-concepts-simulator';
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

type Lessons = readonly { commands: readonly { expectedCommand: string | string[] }[] }[];

/** The first accepted command of every step, in lesson order. */
const commandsOf = (lessons: Lessons) =>
  lessons.flatMap((lesson) =>
    lesson.commands.map((command) =>
      Array.isArray(command.expectedCommand) ? command.expectedCommand[0] : command.expectedCommand
    )
  );

function terminalInputs(): HTMLInputElement[] {
  return [...container.querySelectorAll<HTMLInputElement>('input[aria-label="Terminal command"]')];
}

function input(): HTMLInputElement {
  const all = terminalInputs();
  if (all.length !== 1) throw new Error(`expected one terminal input, found ${all.length}`);
  return all[0];
}

async function typeInto(el: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setValue?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Types a command and presses Enter. Does not wait for the hook's advance delay. */
async function run(cmd: string) {
  await typeInto(input(), cmd);
  await act(async () => {
    input().form?.requestSubmit();
  });
}

async function wait(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

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

async function render(Game: ComponentType) {
  await act(async () => root.render(createElement(Game)));
}

/** Plays every step and checks that the completion signal occurs on the final command. */
async function playToTheEnd(lessons: Lessons, delayMs: number) {
  const commands = commandsOf(lessons);
  for (const command of commands.slice(0, -1)) {
    await run(command);
    await wait(delayMs + 50);
  }
  expect(completions).toBe(0);
  expect(text()).not.toContain('Lab complete');
  expect(text()).toContain(`${commands.length - 1}/${commands.length} commands`);

  await run(commands[commands.length - 1]);
  expect(completions).toBe(1);
  expect(text()).toContain('Lab complete');
  expect(terminalInputs()).toHaveLength(0);

  await wait(delayMs + 50);
  expect(completions).toBe(1);
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

describe('Git Concepts on the kit', () => {
  it('one input, no hero, one signal on the last command', async () => {
    await render(GitConceptsSimulator);
    expect(container.querySelector('[data-game-intro]')).toBeNull();
    expect(text()).not.toContain('// git mental model lab');
    expect(terminalInputs()).toHaveLength(1);
    expect(text()).toContain(`Goal: ${LESSONS[0].commands[0].instruction.slice(0, 20)}`);
    await playToTheEnd(LESSONS, 500);

    await click('Keep exploring');
    await run('git status');
    await wait(600);
    expect(completions).toBe(1);
  }, 60_000);

  it('Show me types the command but does not run it', async () => {
    await render(GitConceptsSimulator);
    await click('Show me');
    expect(input().value).toBe(commandsOf(LESSONS)[0]);
    expect(text()).toContain(`0/${commandsOf(LESSONS).length} commands`);
    await act(async () => {
      input().form?.requestSubmit();
    });
    await wait(550);
    expect(text()).toContain(`1/${commandsOf(LESSONS).length} commands`);
  }, 60_000);

  it('Start over after the end signals again on a second run', async () => {
    await render(GitConceptsSimulator);
    await playToTheEnd(LESSONS, 500);
    await click('Keep exploring');
    await click('Start over', true);
    await click('Click again to start over');
    expect(completions).toBe(1);

    const commands = commandsOf(LESSONS);
    for (const command of commands.slice(0, -1)) {
      await run(command);
      await wait(550);
    }
    expect(completions).toBe(1);
    await run(commands[commands.length - 1]);
    expect(completions).toBe(2);
  }, 60_000);
});
