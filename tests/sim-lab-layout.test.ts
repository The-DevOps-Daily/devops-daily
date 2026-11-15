// @vitest-environment jsdom

import { act, createElement, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimFrame } from '@/components/games/sim/sim-frame';
import {
  LAB_SHELL_HEIGHT,
  SimLabMain,
  SimLabPanel,
  SimLabTop,
  labLines,
  useSimLab,
} from '@/components/games/sim/sim-lab';
import { SimTerminal, type SimTerminalLine } from '@/components/games/sim/sim-terminal';
import { useTerminalSimulator } from '@/hooks/use-terminal-simulator';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let lg = false;

async function render(element: ReactElement) {
  await act(async () => root.render(element));
}

const input = () =>
  container.querySelector('input[aria-label="Terminal command"]') as HTMLInputElement;
const stepCard = () => container.querySelector('section[aria-label="Current step"]');

function buttonNamed(text: string, scope: ParentNode = container): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find((b) =>
    (b.getAttribute('aria-label') ?? b.textContent ?? '').trim().startsWith(text)
  );
  if (!found) throw new Error(`no button "${text}"`);
  return found;
}

async function typeInto(el: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setValue?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function run(cmd: string) {
  await typeInto(input(), cmd);
  await act(async () => {
    input().form?.requestSubmit();
  });
}

beforeEach(() => {
  lg = false;
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes('min-width: 1024px') ? lg : false,
    media: query,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('SimTerminal with an inline prompt', () => {
  function Terminal({ lines }: { lines: SimTerminalLine[] }) {
    const [value, setValue] = useState('');
    return createElement(SimTerminal, {
      label: '~',
      lines,
      prompt: 'user@host:~$',
      value,
      onChange: setValue,
      onSubmit: () => {},
      inline: true,
    });
  }

  const lines: SimTerminalLine[] = [
    { type: 'input', content: 'cd docs', prompt: 'user@host:~$' },
    { type: 'input', content: 'ls', prompt: 'user@host:~/docs$' },
    { type: 'output', content: 'a.txt' },
  ];

  it('puts the prompt after the log, in one scroll box, and keeps each line its prompt', async () => {
    await render(createElement(Terminal, { lines }));
    const log = container.querySelector('[role="log"]')!;
    expect(log.contains(input())).toBe(false);
    const box = log.parentElement!;
    expect(box.className).toContain('overflow-auto');
    expect(box.className).toContain('overscroll-contain');
    expect(box.lastElementChild?.contains(input())).toBe(true);
    expect(log.textContent).toContain('user@host:~$ cd docs');
    expect(log.textContent).toContain('user@host:~/docs$ ls');
    expect(input().getAttribute('aria-label')).toBe('Terminal command');
  });

  it('focuses the prompt on a click anywhere in the window', async () => {
    await render(createElement(Terminal, { lines }));
    const titleBar = container.querySelector('.bg-terminal-bar')!;
    await act(async () => {
      titleBar.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    expect(document.activeElement).toBe(input());
  });

  it('on lg, keeps the wheel off the page once the terminal is in view', async () => {
    lg = true;
    await render(createElement(Terminal, { lines }));
    const box = container.querySelector('[role="log"]')!.parentElement!;
    // jsdom has no layout: the box is at its top and its end at once, and in view.
    const down = new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true });
    box.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    // Below the fold, the wheel scrolls the page to it.
    const rect = vi
      .spyOn(box, 'getBoundingClientRect')
      .mockReturnValue({ top: 300, bottom: 1000 } as DOMRect);
    const below = new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true });
    box.dispatchEvent(below);
    expect(below.defaultPrevented).toBe(false);
    rect.mockRestore();
    lg = false;
    const phone = new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true });
    box.dispatchEvent(phone);
    expect(phone.defaultPrevented).toBe(false);
  });

  it('keeps the fixed prompt when inline is off', async () => {
    await render(
      createElement(SimTerminal, {
        label: '~',
        lines,
        value: '',
        onChange: () => {},
        onSubmit: () => {},
      })
    );
    const log = container.querySelector('[role="log"]')!;
    expect(log.className).toContain('overflow-auto');
    expect(log.nextElementSibling?.contains(input())).toBe(true);
  });
});

describe('SimLabMain', () => {
  const LESSONS = [
    {
      id: 'nav',
      title: 'Navigation',
      description: 'Move around',
      commands: [
        {
          instruction: 'Print the directory.',
          hint: 'Use pwd',
          expectedCommand: 'pwd',
          explanation: 'pwd prints where you are.',
        },
        {
          instruction: 'List the files.',
          hint: 'Use ls',
          expectedCommand: ['ls', 'ls -a'],
          explanation: 'ls lists files.',
        },
      ],
    },
    {
      id: 'files',
      title: 'Files',
      commands: [
        {
          instruction: 'Make a file.',
          hint: 'Use touch',
          expectedCommand: 'touch a',
          explanation: 'touch makes a file.',
        },
      ],
    },
  ];

  function Lab({ withPanel = false }: { withPanel?: boolean }) {
    const lab = useTerminalSimulator({
      lessons: LESSONS,
      execute: () => ({ output: '' }),
      matches: (cmd, c) =>
        Array.isArray(c.expectedCommand)
          ? c.expectedCommand.includes(cmd)
          : cmd === c.expectedCommand,
      successMessage: () => 'done',
      prompt: '$',
      signalOnComplete: false,
      autoFocus: false,
    });
    const ui = useSimLab(lab);
    const command = lab.currentCommand;
    return createElement(
      SimFrame,
      null,
      createElement(SimLabTop, { title: 'Lab', lessons: LESSONS, lab, ui }),
      createElement(SimLabMain, {
        lessons: LESSONS,
        lab,
        ui,
        task: command?.instruction,
        hint: command?.hint,
        showMe: command ? [command.expectedCommand].flat()[0] : undefined,
        terminal: createElement(SimTerminal, {
          label: 'lab',
          lines: labLines(lab.terminalHistory, []),
          value: lab.inputValue,
          onChange: lab.setInputValue,
          onSubmit: lab.submitCommand,
          inputRef: lab.inputRef,
          inline: true,
          heightClassName: LAB_SHELL_HEIGHT,
        }),
        panels: withPanel
          ? [
              createElement(SimLabPanel, { key: 'ref', title: 'Quick reference' }, 'ref body'),
              createElement(
                SimLabPanel,
                { key: 'tree', title: 'Files', defaultOpen: true },
                'tree body'
              ),
            ]
          : undefined,
      })
    );
  }

  it('fills the screen under the top row on lg, with the terminal spanning both rows', async () => {
    await render(createElement(Lab));
    const lab = container.querySelector<HTMLElement>('[data-sim-frame] > .flex.flex-col')!;
    expect(lab.className).toContain(
      'lg:h-[calc(100dvh-var(--sim-embed-top,12px)-var(--sim-bar-h)-2rem)]'
    );
    expect(lab.className).toContain('lg:grid-rows-[minmax(0,auto)_minmax(0,1fr)]');
    // Card, terminal, rest: the phone order is the DOM order.
    const [head, terminal, rest] = [...lab.children];
    expect(head.contains(stepCard())).toBe(true);
    expect(terminal.contains(input())).toBe(true);
    expect(terminal.className).toContain('lg:row-span-2');
    expect(rest.className).toContain('lg:overflow-y-auto');
    expect(container.querySelectorAll('input[aria-label="Terminal command"]')).toHaveLength(1);
  });

  it('opens the hint inside the step card and keeps focus where it was', async () => {
    await render(createElement(Lab));
    expect(stepCard()?.textContent).toContain('Step 1 of 2');
    expect(stepCard()?.textContent).toContain('Print the directory.');
    const hint = buttonNamed('Hint', stepCard()!);
    const panel = document.getElementById(hint.getAttribute('aria-controls')!)!;
    expect(panel.hidden).toBe(true);
    // A mouse press on the button does not take focus from the terminal.
    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    hint.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    await act(async () => hint.click());
    expect(hint.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
    expect(stepCard()!.contains(panel)).toBe(true);
    expect(panel.textContent).toBe('Use pwd');
  });

  it('shows the step just done and marks the steps of the lesson', async () => {
    await render(createElement(Lab));
    expect(container.textContent).not.toContain('Done:');
    await run('pwd');
    expect(container.textContent).toContain('Done: pwd');
    expect(container.textContent).toContain('pwd prints where you are.');
    const steps = [...container.querySelectorAll('ol li')].slice(0, 2);
    expect(steps[0].textContent).toBe('Done: Print the directory.');
    expect(steps[1].getAttribute('aria-current')).toBe('step');
    expect(stepCard()?.textContent).toContain('Step 2 of 2');

    // The last step of a lesson is shown as done in the next one.
    await run('ls');
    expect(stepCard()?.textContent).toContain('Make a file.');
    expect(container.textContent).toContain('Done: ls');
  });

  it('Show me types the command, the picker lists the lessons, start over is in the top row', async () => {
    await render(createElement(Lab));
    await act(async () => buttonNamed('Show me', stepCard()!).click());
    expect(input().value).toBe('pwd');
    expect(container.textContent).toContain('0/3 commands');
    // The picker reads "Lesson 1 of 2" on phones and "All lessons" from sm up.
    const picker = container.querySelector('button[aria-haspopup="menu"]');
    expect(picker?.textContent).toContain('All lessons');
    expect(picker?.textContent).toContain('Lesson 1 of 2');
    expect(buttonNamed('Start over')).toBeTruthy();
  });

  it('closes the side panels on phones; on lg opens the ones with defaultOpen', async () => {
    await render(createElement(Lab, { withPanel: true }));
    const ref = buttonNamed('Quick reference');
    const tree = buttonNamed('Files');
    // Collapsible on lg too: the toggle is not hidden there.
    expect(ref.className).not.toContain('lg:hidden');
    expect(ref.getAttribute('aria-expanded')).toBe('false');
    expect(tree.getAttribute('aria-expanded')).toBe('false');
    const body = (b: HTMLButtonElement) =>
      document.getElementById(b.getAttribute('aria-controls')!)!;
    expect(body(tree).className).toContain('hidden lg:block');
    expect(body(ref).className).not.toContain('lg:block');
    await act(async () => ref.click());
    expect(ref.getAttribute('aria-expanded')).toBe('true');
    expect(body(ref).className).toContain('block');

    act(() => root.unmount());
    root = createRoot(container);
    lg = true;
    await render(createElement(Lab, { withPanel: true }));
    expect(buttonNamed('Files').getAttribute('aria-expanded')).toBe('true');
    expect(buttonNamed('Quick reference').getAttribute('aria-expanded')).toBe('false');
    // The step list is no drawer on lg.
    expect(buttonNamed('Steps').className).toContain('lg:hidden');
  });
});
