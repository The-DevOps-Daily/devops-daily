// @vitest-environment jsdom

import { act, createElement, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GitConceptsSimulator, { LESSONS } from '@/components/games/git-concepts-simulator';
import GitMergeConflictSimulator from '@/components/games/git-merge-conflict-simulator';
import GitOpsWorkflow from '@/components/games/gitops-workflow';
import { GAME_COMPLETE_EVENT } from '@/lib/games/game-complete';
import { LESSONS as CONFLICT_LESSONS, TOTAL_STEPS } from '@/lib/games/git-conflict-engine';

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

async function clickOption(option: string) {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) =>
      !candidate.disabled &&
      [...candidate.querySelectorAll('span')].some((span) => span.textContent?.trim() === option)
  );
  if (!button) throw new Error(`no enabled option "${option}"`);
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
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0) as unknown as number;
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

describe('Git Merge Conflict on the kit', () => {
  it('plays every lesson through the UI; one signal, on the last step', async () => {
    await render(GitMergeConflictSimulator);
    expect(container.querySelector('[data-game-intro]')).toBeNull();
    expect(text()).not.toContain('// CONFLICT (content)');
    expect(terminalInputs()).toHaveLength(1);
    expect(text()).toContain('Goal: ');

    for (let actions = 0; !text().includes('Lab complete') && actions < 200; actions++) {
      if (
        [...container.querySelectorAll('button')].some(
          (button) => !button.disabled && name(button).includes('Next lesson')
        )
      ) {
        await click('Next lesson');
      } else if (
        [...container.querySelectorAll('button')].some(
          (button) => !button.disabled && name(button).includes('Show a solution')
        )
      ) {
        await click('Show a solution');
        await click('Save', true);
      } else {
        await click('Show me');
        await act(async () => {
          input().form?.requestSubmit();
        });
      }

      if (!text().includes('Lab complete')) expect(completions).toBe(0);
      else expect(completions).toBe(1);
    }

    expect(text()).toContain('Lab complete');
    expect(completions).toBe(1);
    expect(text()).toContain(`${TOTAL_STEPS}/${TOTAL_STEPS}`);
    expect(terminalInputs()).toHaveLength(0);

    await click('Keep exploring');
    await run('git status');
    expect(completions).toBe(1);
  }, 60_000);

  it('Show me types the command but does not run it', async () => {
    await render(GitMergeConflictSimulator);
    await click('Show me');
    expect(input().value).toBe(CONFLICT_LESSONS[0].steps[0].command);
    expect(text()).toContain(`0/${TOTAL_STEPS} steps`);
  });

  it('Restart lesson keeps finished steps', async () => {
    await render(GitMergeConflictSimulator);
    await click('Show me');
    await act(async () => {
      input().form?.requestSubmit();
    });
    await click('Restart lesson');
    expect(text()).toContain(`1/${TOTAL_STEPS} steps`);
    expect(text()).toContain(CONFLICT_LESSONS[0].intro[0].content);
  });
});

describe('GitOps Workflow on the kit', () => {
  it('no hero, no gradient page, the board has a goal', async () => {
    await render(GitOpsWorkflow);
    expect(container.querySelector('[class*="min-h-screen"], [class*="bg-gradient"]')).toBeNull();
    expect(text()).not.toContain('GitOps Learning');
    expect(text()).toContain('Goal: ');
    await click('Start Learning');
    expect(text()).toContain('Deploy a commit');
    await click('Create New Commit');
    expect(completions).toBe(0);
    await wait(3000);
    expect(completions).toBe(0);
  });

  it('one signal, on View Results', async () => {
    await render(GitOpsWorkflow);
    await click('Start Learning');
    await click('Continue to Challenges');

    for (const [option, last] of [
      ['Automatically reconcile to match Git (3 replicas)', false],
      ['Revert the Git commit and let GitOps sync', false],
      ['Automatic sync with self-heal and prune', true],
    ] as const) {
      await clickOption(option);
      expect(text()).toContain('Correct');
      expect(completions).toBe(0);
      await click(last ? 'View Results' : 'Next Challenge', true);
    }

    expect(completions).toBe(1);
    expect(text()).toContain('Challenges complete');
    expect(text()).toContain('3/3');
    await click('Try again', true);
    expect(text()).toContain('Start Learning');
    expect(completions).toBe(1);
  });

  it('a wrong answer says Not quite and still counts toward the end', async () => {
    await render(GitOpsWorkflow);
    await click('Start Learning');
    await click('Continue to Challenges');
    await clickOption('Leave it as is - manual changes are fine');
    expect(text()).toContain('Not quite');
    expect(text()).toContain('Your answer');
    await click('Next Challenge', true);
    await clickOption('Revert the Git commit and let GitOps sync');
    await click('Next Challenge', true);
    await clickOption('Automatic sync with self-heal and prune');
    expect(completions).toBe(0);
    await click('View Results', true);
    expect(completions).toBe(1);
    expect(text()).toContain('You answered 2 of 3 challenges correctly.');
  });
});
