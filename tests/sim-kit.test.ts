// @vitest-environment jsdom

import { act, createElement, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbedClient } from '@/app/games/[slug]/embed/embed-client';
import { SimComplete } from '@/components/games/sim/sim-complete';
import { SimFrame, SimResetButton, SimStage } from '@/components/games/sim/sim-frame';
import GenericQuiz from '@/components/games/generic-quiz';
import dockerQuiz from '@/content/quizzes/docker-quiz.json';
import type { QuizConfig } from '@/lib/quiz-types';
import { SimGameProvider } from '@/components/games/sim/sim-game';
import { LAB_TERMINAL_HEIGHT, SimLabLayout } from '@/components/games/sim/sim-lab';
import { SimTerminal, resultLine, type SimTerminalLine } from '@/components/games/sim/sim-terminal';
import { missionProgress, passedMissions, useMissions } from '@/components/games/sim/use-missions';
import { EmbedProvider, useEmbed, type EmbedInfo } from '@/lib/games/embed-context';
import { GAME_COMPLETE_EVENT } from '@/lib/games/game-complete';

let pathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let completions: number;
const countCompletion = () => completions++;
let coarsePointer = false;

async function render(element: ReactElement) {
  await act(async () => root.render(element));
}

function button(text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((b) =>
    (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(text)
  );
  if (!found) throw new Error(`no button "${text}"`);
  return found;
}

async function click(el: HTMLElement) {
  await act(async () => el.click());
}

beforeEach(() => {
  completions = 0;
  coarsePointer = false;
  window.addEventListener(GAME_COMPLETE_EVENT, countCompletion);
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes('pointer: coarse') ? coarsePointer : false,
    media: query,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  window.scrollBy = () => {};
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.removeEventListener(GAME_COMPLETE_EVENT, countCompletion);
  window.history.replaceState(null, '', '/');
  vi.useRealTimers();
});

const info = {
  slug: 'demo',
  title: 'Demo Simulator',
  level: 'Beginner' as const,
  teaches: ['One', 'Two', 'Three'],
  next: { title: 'Next Game', href: '/games/next-game' },
};

const card = () =>
  createElement(SimGameProvider, { info }, createElement(SimComplete, { title: 'Done' }));

describe('SimComplete', () => {
  it('signals the end once, however often it renders', async () => {
    await render(createElement(SimComplete, { title: 'Lab complete' }));
    await render(createElement(SimComplete, { title: 'Lab complete', summary: 'Changed' }));
    await render(createElement(SimComplete, { title: 'Lab complete', stats: [] }));
    expect(completions).toBe(1);
  });

  it('does not signal a losing end or an early look', async () => {
    await render(createElement(SimComplete, { title: 'Server down', tone: 'danger' }));
    await render(createElement(SimComplete, { title: 'Results', tone: 'neutral' }));
    expect(completions).toBe(0);
  });

  it('signals once when a shown card becomes a finished game', async () => {
    await render(createElement(SimComplete, { title: 'Results', signal: false }));
    expect(completions).toBe(0);
    await render(createElement(SimComplete, { title: 'Results', signal: true }));
    await render(createElement(SimComplete, { title: 'Results', signal: true, summary: 'x' }));
    expect(completions).toBe(1);
  });

  it('moves focus to its heading', async () => {
    await render(createElement(SimComplete, { title: 'Lab complete' }));
    expect(document.activeElement?.tagName).toBe('H2');
    expect(document.activeElement?.textContent).toContain('Lab complete');
  });

  it("uses the page's topics and next game by default", async () => {
    await render(card());
    expect(container.textContent).toContain('What you learned');
    expect(container.textContent).toContain('Three');
    const next = container.querySelector('a[href="/games/next-game"]');
    expect(next?.textContent).toContain('Next: Next Game');
    expect(next?.getAttribute('target')).toBeNull();
  });

  it('inside Opsville points to the quiz instead of another game', async () => {
    await render(createElement(EmbedProvider, { host: 'opsville', theme: 'dark' }, card()));
    expect(container.querySelector('a[href="/games/next-game"]')).toBeNull();
    expect(container.textContent).toContain('take the quiz');
  });

  it('opens links in a new tab in other embeds', async () => {
    await render(createElement(EmbedProvider, { host: 'other' }, card()));
    const next = container.querySelector('a[href="/games/next-game"]');
    expect(next?.getAttribute('target')).toBe('_blank');
  });
});

describe('embed context', () => {
  let seen: EmbedInfo | null = null;
  function Probe() {
    seen = useEmbed();
    return null;
  }

  it('is the site when there is no provider', async () => {
    await render(createElement(Probe));
    expect(seen).toMatchObject({ host: 'site', embedded: false, inOpsville: false });
  });

  it('is Opsville, dark and compact in the Opsville embed', async () => {
    pathname = '/games/demo/embed';
    window.history.replaceState(
      null,
      '',
      '/games/demo/embed?embed=opsville&theme=dark&run=k3x9q2m7'
    );
    await render(createElement(EmbedClient, { slug: 'demo', title: 'Demo', GameComponent: Probe }));
    expect(seen).toMatchObject({
      host: 'opsville',
      theme: 'dark',
      embedded: true,
      inOpsville: true,
    });
  });

  it('is another site for a plain embed, with its theme', async () => {
    pathname = '/games/demo/embed';
    window.history.replaceState(null, '', '/games/demo/embed?theme=light');
    await render(createElement(EmbedClient, { slug: 'demo', title: 'Demo', GameComponent: Probe }));
    expect(seen).toMatchObject({
      host: 'other',
      theme: 'light',
      embedded: true,
      inOpsville: false,
    });
  });
});

describe('SimTerminal', () => {
  const onKeyDown = vi.fn();
  const onSubmit = vi.fn();

  function Terminal({
    initial = '',
    autoFocus = false,
  }: {
    initial?: string;
    autoFocus?: boolean;
  }) {
    const [value, setValue] = useState(initial);
    const lines: SimTerminalLine[] = [
      { type: 'input', content: 'ls' },
      { type: 'output', content: 'a.txt\nb.txt' },
    ];
    return createElement(SimTerminal, {
      label: '~/repo',
      status: 'main',
      lines,
      value,
      onChange: setValue,
      onSubmit,
      onKeyDown,
      autoFocus,
    });
  }

  function input(): HTMLInputElement {
    return container.querySelector('input[aria-label="Terminal command"]') as HTMLInputElement;
  }

  function press(key: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    act(() => {
      input().dispatchEvent(event);
    });
    return event;
  }

  beforeEach(() => {
    onKeyDown.mockReset();
    onSubmit.mockReset();
  });

  it('lets Tab leave an empty prompt', async () => {
    await render(createElement(Terminal));
    const event = press('Tab');
    expect(event.defaultPrevented).toBe(false);
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it('passes Tab on to completion when there is text, but never Shift+Tab', async () => {
    await render(createElement(Terminal, { initial: 'git sta' }));
    press('Tab');
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    press('Tab', { shiftKey: true });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('passes history and Ctrl+C on, and keeps Escape for the page', async () => {
    await render(createElement(Terminal, { initial: 'x' }));
    press('ArrowUp');
    press('ArrowDown');
    press('c', { ctrlKey: true });
    expect(onKeyDown.mock.calls.map(([e]) => e.key)).toEqual(['ArrowUp', 'ArrowDown', 'c']);
    press('Escape');
    expect(onKeyDown).toHaveBeenCalledTimes(3);
  });

  it('submits the typed command on Enter', async () => {
    await render(createElement(Terminal, { initial: 'docker ps' }));
    await act(async () => {
      input().form?.requestSubmit();
    });
    expect(onSubmit).toHaveBeenCalledWith('docker ps');
  });

  it('labels the input and keeps the output in a log', async () => {
    await render(createElement(Terminal));
    expect(input().getAttribute('autocomplete')).toBe('off');
    expect(input().getAttribute('spellcheck')).toBe('false');
    expect(container.querySelector('[role="log"]')?.textContent).toContain('a.txt');
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('a.txt');
  });

  it('focuses without scrolling on a mouse, never on a touch screen', async () => {
    const focus = vi.spyOn(HTMLInputElement.prototype, 'focus');
    coarsePointer = true;
    await render(createElement(Terminal, { autoFocus: true }));
    expect(focus).not.toHaveBeenCalled();
    act(() => root.unmount());
    root = createRoot(container);
    coarsePointer = false;
    await render(createElement(Terminal, { autoFocus: true }));
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    focus.mockRestore();
  });

  it('announces the result of the last command only', () => {
    expect(
      resultLine([
        { type: 'input', content: 'kubectl get pods' },
        { type: 'output', content: '\nNAME READY\nweb 1/1' },
        { type: 'success', content: 'Step done' },
      ])
    ).toBe('Step done');
    expect(resultLine([{ type: 'input', content: 'clear' }])).toBe('');
    expect(
      resultLine([
        { type: 'input', content: 'x' },
        { type: 'error', content: 'command not found: x' },
      ])
    ).toBe('command not found: x');
  });
});

describe('SimResetButton', () => {
  it('asks once, then starts over', async () => {
    const onReset = vi.fn();
    await render(createElement(SimResetButton, { onReset }));
    await click(button('Start over'));
    expect(onReset).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Start over?');
    await click(button('Click again to start over'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('forgets the question after 3 seconds', async () => {
    vi.useFakeTimers();
    const onReset = vi.fn();
    await render(createElement(SimResetButton, { onReset }));
    await click(button('Start over'));
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    await click(button('Start over'));
    expect(onReset).not.toHaveBeenCalled();
  });
});

describe('missions', () => {
  type State = { p99: number; avg: number };
  const missions = [
    { id: 'fast', label: 'Get P99 under 500 ms', check: (s: State) => s.p99 < 500 },
    { id: 'avg', label: 'Keep the average under 100 ms', check: (s: State) => s.avg < 100 },
  ];

  it('keeps a mission done after the state changes back', () => {
    let done = passedMissions(missions, { p99: 400, avg: 150 }, new Set());
    expect([...done]).toEqual(['fast']);
    done = passedMissions(missions, { p99: 900, avg: 80 }, done);
    expect([...done].sort()).toEqual(['avg', 'fast']);
    expect(missionProgress(missions, done)).toMatchObject({ done: 2, total: 2, complete: true });
  });

  it('marks the first open mission as current', () => {
    const p = missionProgress(missions, new Set(['avg']));
    expect(p.current?.id).toBe('fast');
    expect(p.complete).toBe(false);
  });

  it('a check that throws has not passed', () => {
    const bad = [{ id: 'x', label: 'x', check: () => JSON.parse('{') as boolean }];
    expect(passedMissions(bad, {}, new Set()).size).toBe(0);
  });

  it('useMissions follows the state and resets', async () => {
    let api: ReturnType<typeof useMissions<State>> | null = null;
    let setState: (s: State) => void = () => {};
    function Sandbox() {
      const [state, set] = useState<State>({ p99: 900, avg: 150 });
      setState = set;
      api = useMissions(missions, state);
      return null;
    }
    await render(createElement(Sandbox));
    expect(api!.done).toBe(0);
    await act(async () => setState({ p99: 450, avg: 150 }));
    expect(api!.done).toBe(1);
    await act(async () => setState({ p99: 450, avg: 90 }));
    expect(api!.complete).toBe(true);
    await act(async () => api!.reset());
    expect(api!.done).toBe(2);
    await act(async () => setState({ p99: 900, avg: 150 }));
    await act(async () => api!.reset());
    expect(api!.done).toBe(0);
  });
});

describe('SimStage', () => {
  it('caps the columns at the fill height: the screen under the bar and any site header in view', async () => {
    await render(
      createElement(
        SimFrame,
        null,
        createElement(SimStage, {
          panels: [
            { id: 'a', label: 'A', content: 'one' },
            { id: 'b', label: 'B', content: 'two' },
          ],
          columns: 'lg:grid-cols-2',
          tab: 'a',
          onTabChange: () => {},
        })
      )
    );
    const frame = container.querySelector<HTMLElement>('[data-sim-frame]');
    const fill = frame?.style.getPropertyValue('--sim-fill-h') ?? '';
    expect(fill).toContain('max(var(--site-header-h, 0px), var(--site-header-visible, 0px))');
    expect(fill).toContain('var(--sim-embed-top, 12px)');
    expect(fill).toContain('var(--sim-bar-h)');
    expect(frame?.style.getPropertyValue('--sim-bar-h')).toMatch(/^\d+px$/);
    const grid = container.querySelector<HTMLElement>('.lg\\:grid');
    expect(grid?.className).toContain('max-h-[var(--sim-fill-h)]');
  });
});

describe('SimLabLayout', () => {
  it('fills the fill height on lg, with the terminal taking the free height', async () => {
    await render(
      createElement(
        SimFrame,
        null,
        createElement(SimLabLayout, {
          terminal: createElement(SimTerminal, {
            label: 'kubectl',
            lines: [],
            value: '',
            onChange: () => {},
            onSubmit: () => {},
            heightClassName: LAB_TERMINAL_HEIGHT,
          }),
          aside: 'side',
        })
      )
    );
    const lab = container.querySelector<HTMLElement>('[data-sim-frame] > .grid');
    expect(lab?.className).toContain('lg:h-[var(--sim-fill-h)]');
    // The row is the lab's height, so a long log scrolls instead of growing the lab.
    expect(lab?.className).toContain('lg:grid-rows-[minmax(0,1fr)]');
    expect(lab?.firstElementChild?.className).toContain('lg:flex-col');
    // No fixed cap on lg: the terminal is as tall as the lab.
    expect(LAB_TERMINAL_HEIGHT).toContain('lg:h-auto lg:flex-1');
  });
});

describe('embed route', () => {
  it('tells the frame what sits above the game', async () => {
    pathname = '/games/demo/embed';
    const Game = () => createElement(SimFrame, null, 'game');
    window.history.replaceState(null, '', '/games/demo/embed?embed=opsville&theme=dark');
    await render(createElement(EmbedClient, { slug: 'demo', title: 'Demo', GameComponent: Game }));
    let pad = container.querySelector('[data-sim-frame]')?.closest('[class*="--sim-embed-top"]');
    expect(pad?.className).toContain('md:[--sim-embed-top:12px]');

    window.history.replaceState(null, '', '/games/demo/embed?theme=light');
    await render(createElement(EmbedClient, { slug: 'demo', title: 'Demo', GameComponent: Game }));
    pad = container.querySelector('[data-sim-frame]')?.closest('[class*="--sim-embed-top"]');
    // 16px of padding and the 37px title bar.
    expect(pad?.className).toContain('[--sim-embed-top:53px]');
  });
});

describe('GenericQuiz on a /quizzes page', () => {
  const quiz = dockerQuiz as QuizConfig;

  it('leaves the title, description and stats to the page', async () => {
    await render(createElement(GenericQuiz, { quizConfig: quiz, detailsOnPage: true }));
    const text = container.textContent ?? '';
    expect(container.querySelector('h2')).toBeNull();
    expect(text).not.toContain(quiz.description);
    expect(text).not.toContain(`${quiz.totalPoints} points`);
    expect(text).toContain('Start Quiz');
  });

  it('keeps them when nothing around it names the quiz', async () => {
    await render(createElement(GenericQuiz, { quizConfig: quiz }));
    expect(container.querySelector('h2')?.textContent).toBe(quiz.title);
    expect(container.textContent).toContain(`${quiz.totalPoints} points`);
  });
});
