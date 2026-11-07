// @vitest-environment jsdom

import { act, createElement, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DockerTerminalSimulator, {
  LESSONS as DOCKER_LESSONS,
} from '@/components/games/docker-terminal-simulator';
import GitConceptsSimulator from '@/components/games/git-concepts-simulator';
import KubernetesTerminalSimulator, {
  LESSONS as K8S_LESSONS,
} from '@/components/games/kubernetes-terminal-simulator';
import LinuxTerminal, { LESSONS as LINUX_LESSONS } from '@/components/games/linux-terminal';
import MongoDbTerminalSimulator from '@/components/games/mongodb-terminal-simulator';
import PostgresTerminalSimulator, {
  LESSONS as PG_LESSONS,
} from '@/components/games/postgres-terminal-simulator';
import SqlTerminalSimulator, {
  CHALLENGES as SQL_CHALLENGES,
  LESSONS as SQL_LESSONS,
} from '@/components/games/sql-terminal-simulator';
import { useTerminalSimulator } from '@/hooks/use-terminal-simulator';
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
  lessons.flatMap((l) =>
    l.commands.map((c) =>
      Array.isArray(c.expectedCommand) ? c.expectedCommand[0] : c.expectedCommand
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

function press(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  act(() => {
    input().dispatchEvent(event);
  });
  return event;
}

function name(b: HTMLButtonElement): string {
  return (b.getAttribute('aria-label') ?? b.textContent ?? '').trim();
}

async function click(label: string, exact = false) {
  const b = [...container.querySelectorAll('button')].find(
    (x) => !x.disabled && (exact ? name(x) === label : name(x).includes(label))
  );
  if (!b) throw new Error(`no enabled button "${label}"`);
  await act(async () => b.click());
}

async function render(Game: ComponentType) {
  await act(async () => root.render(createElement(Game)));
}

/**
 * Plays every lesson step in order and checks the Opsville signal: none
 * before the last command, exactly one on the render of the last command
 * (before any advance delay runs out), the end card in place of the lab.
 */
async function playToTheEnd(lessons: Lessons, delayMs: number) {
  const cmds = commandsOf(lessons);
  for (const cmd of cmds.slice(0, -1)) {
    await run(cmd);
    await wait(delayMs + 50);
  }
  expect(completions).toBe(0);
  expect(text()).not.toContain('Lab complete');
  expect(text()).toContain(`${cmds.length - 1}/${cmds.length} commands`);

  await run(cmds[cmds.length - 1]);
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

describe('terminal labs on the kit', () => {
  it('Linux: one input, no hero, one signal on the last command', async () => {
    await render(LinuxTerminal);
    expect(container.querySelector('[data-game-intro]')).toBeNull();
    expect(terminalInputs()).toHaveLength(1);
    expect(text()).toContain('Goal: First, let');
    await playToTheEnd(LINUX_LESSONS, 0);

    await click('Keep exploring');
    await run('pwd');
    expect(completions).toBe(1);
    expect(text()).toContain('/home/user');
  }, 60_000);

  it('Linux: Tab completes, and leaves the prompt when there is nothing to complete', async () => {
    await render(LinuxTerminal);
    expect(press('Tab').defaultPrevented).toBe(false);
    await typeInto(input(), 'pw');
    expect(press('Tab').defaultPrevented).toBe(true);
    expect(input().value).toBe('pwd ');
    await typeInto(input(), 'zzz');
    expect(press('Tab').defaultPrevented).toBe(false);
    await typeInto(input(), 'cat zzz');
    expect(press('Tab').defaultPrevented).toBe(false);
    expect(press('Tab', { shiftKey: true }).defaultPrevented).toBe(false);
  }, 60_000);

  it('Docker: one signal on the last command; Tab leaves when nothing matches', async () => {
    await render(DockerTerminalSimulator);
    expect(container.querySelector('[data-game-intro]')).toBeNull();
    await typeInto(input(), 'docker ver');
    expect(press('Tab').defaultPrevented).toBe(true);
    expect(input().value).toBe('docker version ');
    await typeInto(input(), 'kubectl');
    expect(press('Tab').defaultPrevented).toBe(false);
    await typeInto(input(), '');

    await playToTheEnd(DOCKER_LESSONS, 0);
    await click('Keep exploring');
    await run('docker ps');
    expect(completions).toBe(1);
  }, 60_000);

  it('Kubernetes: one signal on the last command, before the advance delay', async () => {
    await render(KubernetesTerminalSimulator);
    expect(text()).not.toContain('// kubectl lab');
    await playToTheEnd(K8S_LESSONS, 700);
    await click('Keep exploring');
    await run('kubectl get pods');
    await wait(800);
    expect(completions).toBe(1);
  }, 60_000);

  it('Kubernetes: Show me types the command but does not run it', async () => {
    await render(KubernetesTerminalSimulator);
    await click('Show me');
    expect(input().value).toBe(commandsOf(K8S_LESSONS)[0]);
    expect(text()).toContain(`0/${commandsOf(K8S_LESSONS).length} commands`);
    await act(async () => {
      input().form?.requestSubmit();
    });
    await wait(750);
    expect(text()).toContain(`1/${commandsOf(K8S_LESSONS).length} commands`);
  }, 60_000);

  it('PostgreSQL: one signal on the last command, and a replay signals again', async () => {
    await render(PostgresTerminalSimulator);
    expect(text()).not.toContain('// psql lab');
    expect(input().placeholder).toBe('\\dt');
    await playToTheEnd(PG_LESSONS, 700);

    await click('Keep exploring');
    expect(text()).toContain('All lessons done');
    await click('Start over', true);
    await click('Click again to start over');
    expect(completions).toBe(1);
    const cmds = commandsOf(PG_LESSONS);
    for (const cmd of cmds.slice(0, -1)) {
      await run(cmd);
      await wait(750);
    }
    expect(completions).toBe(1);
    await run(cmds[cmds.length - 1]);
    expect(completions).toBe(2);
  }, 60_000);

  it('SQL: one signal on the last lesson command; modes and challenges never add one', async () => {
    await render(SqlTerminalSimulator);
    expect(text()).not.toContain('// sql playground');
    await playToTheEnd(SQL_LESSONS, 700);

    // Leaving the card for the challenges closes it for good.
    await click('Challenges', true);
    expect(text()).not.toContain('Lab complete');
    await click('Lessons', true);
    expect(text()).not.toContain('Lab complete');
    expect(completions).toBe(1);

    // Every challenge solved: its own card, and still no second signal.
    await click('Challenges', true);
    for (let i = 0; i < SQL_CHALLENGES.length; i++) {
      await click(`Challenge ${i + 1}:`);
      await run(SQL_CHALLENGES[i].solution);
    }
    expect(text()).toContain('All challenges solved');
    expect(completions).toBe(1);
  }, 60_000);

  it('SQL: the card offers the challenges, and coming back does not show it again', async () => {
    await render(SqlTerminalSimulator);
    await playToTheEnd(SQL_LESSONS, 700);
    await click('Try the challenges');
    expect(text()).toContain('Goal: ' + SQL_CHALLENGES[0].question);
    await click('Lessons', true);
    expect(text()).not.toContain('Lab complete');
    expect(terminalInputs()).toHaveLength(1);
    expect(completions).toBe(1);
  }, 60_000);
});

/** Clicks Run until the lab signals; returns the number of clicks and whether it fired at once. */
async function runUntilSignal(delayMs: number, max = 80) {
  for (let i = 1; i <= max; i++) {
    await click('Run', true);
    if (completions > 0) {
      const atOnce = completions === 1;
      await wait(delayMs + 50);
      return { clicks: i, atOnce };
    }
    await wait(delayMs + 50);
  }
  throw new Error('no signal');
}

describe('the hook for labs not on the kit yet', () => {
  it('Git concepts still signals once, on the last command', async () => {
    await render(GitConceptsSimulator);
    const { atOnce } = await runUntilSignal(500);
    expect(atOnce).toBe(true);
    for (let i = 0; i < 3; i++) {
      await click('Run', true);
      await wait(550);
    }
    expect(completions).toBe(1);
  }, 60_000);

  it('MongoDB still signals once, on the last command', async () => {
    await render(MongoDbTerminalSimulator);
    const { atOnce } = await runUntilSignal(700);
    expect(atOnce).toBe(true);
    for (let i = 0; i < 3; i++) {
      await click('Run', true);
      await wait(750);
    }
    expect(completions).toBe(1);
  }, 60_000);
});

describe('useTerminalSimulator flags', () => {
  const LESSONS = [
    { id: 'a', commands: [{ expectedCommand: 'one', explanation: '' }] },
    { id: 'b', commands: [{ expectedCommand: 'two', explanation: '' }] },
  ];

  function Harness({
    signalOnComplete,
    autoFocus,
  }: {
    signalOnComplete?: boolean;
    autoFocus?: boolean;
  }) {
    const lab = useTerminalSimulator({
      lessons: LESSONS,
      execute: () => ({ output: 'ok' }),
      matches: (cmd, c) => cmd === c.expectedCommand,
      successMessage: () => 'done',
      availableCommands: ['one', 'two'],
      signalOnComplete,
      autoFocus,
    });
    return createElement(
      'form',
      { onSubmit: lab.handleSubmit },
      createElement('input', {
        'aria-label': 'Terminal command',
        ref: lab.inputRef,
        value: lab.inputValue,
        onChange: (e: { target: { value: string } }) => lab.setInputValue(e.target.value),
        onKeyDown: lab.handleKeyDown,
      }),
      createElement('output', null, lab.isComplete ? 'complete' : `${lab.completedCount}`)
    );
  }

  it('signals once by default, when the last command is done', async () => {
    await act(async () => root.render(createElement(Harness)));
    await run('one');
    expect(completions).toBe(0);
    await run('two');
    expect(completions).toBe(1);
    expect(text()).toContain('complete');
    await run('two');
    expect(completions).toBe(1);
  }, 60_000);

  it('leaves the signal to the game with signalOnComplete: false', async () => {
    await act(async () => root.render(createElement(Harness, { signalOnComplete: false })));
    await run('one');
    await run('two');
    expect(text()).toContain('complete');
    expect(completions).toBe(0);
  }, 60_000);

  it('focuses on mount only when asked', async () => {
    await act(async () => root.render(createElement(Harness, { autoFocus: false })));
    expect(document.activeElement).not.toBe(input());
    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(createElement(Harness)));
    expect(document.activeElement).toBe(input());
  }, 60_000);

  it('keeps Tab only when a command matches', async () => {
    await act(async () => root.render(createElement(Harness)));
    await typeInto(input(), 'o');
    expect(press('Tab').defaultPrevented).toBe(true);
    expect(input().value).toBe('one ');
    await typeInto(input(), 'x');
    expect(press('Tab').defaultPrevented).toBe(false);
  }, 60_000);
});
