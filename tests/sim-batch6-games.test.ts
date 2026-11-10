// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SslTlsHandshakeSimulator from '@/components/games/ssl-tls-handshake-simulator';
import DbIndexingSimulator from '@/components/games/db-indexing-simulator';
import DatabaseReplicationShardingScaling from '@/components/games/database-replication-sharding-scaling';
import MongodbTerminalSimulator from '@/components/games/mongodb-terminal-simulator';
import TerraformTerminalSimulator from '@/components/games/terraform-terminal-simulator';
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

function terminalInput(): HTMLInputElement {
  const inputs = [
    ...container.querySelectorAll<HTMLInputElement>('input[aria-label="Terminal command"]'),
  ];
  if (inputs.length !== 1) throw new Error(`expected one terminal input, found ${inputs.length}`);
  return inputs[0];
}

async function typeIntoTerminal(value: string) {
  const input = terminalInput();
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setValue) throw new Error('no input value setter');
  await act(async () => {
    setValue.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submitTerminal() {
  const input = terminalInput();
  if (!input.form) throw new Error('no terminal form');
  await act(async () => input.form?.requestSubmit());
}

async function runMongoCommand(command: string) {
  await typeIntoTerminal(command);
  await submitTerminal();
}

async function runTerraformCommand(command: string) {
  await typeIntoTerminal(command);
  await submitTerminal();
}

async function editTerraformVariables() {
  await click('variables.tf', true);
  await click('Edit', true);
  const textarea = container.querySelector('textarea[aria-label="Edit variables.tf"]');
  if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('no variables.tf editor');
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (!setValue) throw new Error('no textarea value setter');
  await act(async () => {
    setValue.call(textarea, textarea.value.replace('t3.micro', 't3.small'));
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click('Done', true);
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function showAndRunMongoCommand() {
  await click('Show me', true);
  await runMongoCommand(terminalInput().value);
}

async function finishMongoLab() {
  for (let command = 0; command < 12; command += 1) {
    await showAndRunMongoCommand();
    await advance(750);
  }
  expect(completions).toBe(0);
  await showAndRunMongoCommand();
}

async function chooseVersion(version: 'TLS 1.2' | 'TLS 1.3') {
  const group = container.querySelector('[role="group"][aria-label="TLS version"]');
  if (!group) throw new Error('no TLS version group');
  const button = [...group.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === version
  );
  if (!button) throw new Error(`no version "${version}"`);
  await act(async () => button.click());
}

async function chooseScenario(value: string) {
  const label = [...container.querySelectorAll('label')].find(
    (candidate) => candidate.textContent?.trim() === 'Failure scenario'
  );
  if (!label) throw new Error('no failure scenario label');
  const id = label.htmlFor;
  const field = id ? container.querySelector(`#${id}`) : null;
  if (!(field instanceof HTMLSelectElement)) throw new Error('no failure scenario select');
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!setValue) throw new Error('no select value setter');
  await act(async () => {
    setValue.call(field, value);
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function next(count: number) {
  for (let index = 0; index < count; index += 1) await click('Next', true);
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
  await act(async () => root.render(createElement(SslTlsHandshakeSimulator)));
}

async function renderDatabase() {
  await act(async () => root.render(createElement(DbIndexingSimulator)));
}

async function renderReplicationShardingScaling() {
  await act(async () => root.render(createElement(DatabaseReplicationShardingScaling)));
}

async function chooseDatabaseMode(mode: 'Replication' | 'Sharding' | 'Scaling') {
  const group = container.querySelector('[role="group"][aria-label="Mode"]');
  if (!group) throw new Error('no database mode group');
  const button = [...group.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === mode
  );
  if (!button) throw new Error(`no database mode "${mode}"`);
  await act(async () => button.click());
}

async function chooseSimulatorMode(label: string) {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => !candidate.disabled && candidate.textContent?.trim() === label
  );
  if (!button) throw new Error(`no simulator mode "${label}"`);
  await act(async () => button.click());
}

function databaseSlider(label: string) {
  const thumb = [...container.querySelectorAll<HTMLElement>('[role="slider"]')].find(
    (candidate) => {
      const labelId = candidate.getAttribute('aria-labelledby');
      return labelId ? document.getElementById(labelId)?.textContent?.trim() === label : false;
    }
  );
  if (!thumb) throw new Error(`no ${label} slider`);
  return thumb;
}

async function moveDatabaseSlider(label: string, key: string, count = 1) {
  for (let index = 0; index < count; index += 1) {
    const thumb = databaseSlider(label);
    await act(async () => {
      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    });
  }
}

async function advanceDatabase() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2500);
  });
}

describe('SSL/TLS Handshake on the kit', () => {
  it('no hero, no page keys, a goal', async () => {
    await render();
    expect(text()).not.toContain('How to use this simulator');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/4');
    expect(text()).toContain('ClientHello');

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    expect(text()).toContain('ClientHello');
  });

  it('Prev works after auto-play ends', async () => {
    await render();
    await click('Play', true);
    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3500);
      });
    }
    expect(text()).toContain('Secure');
    const previous = [...container.querySelectorAll('button')].find(
      (button) => buttonName(button) === 'Prev'
    );
    if (!previous) throw new Error('no Prev button');
    expect(previous.disabled).toBe(false);
  }, 60_000);

  it('one signal, after the fourth mission', async () => {
    await render();
    await chooseVersion('TLS 1.3');
    await next(4);
    expect(text()).toContain('1/4');
    expect(completions).toBe(0);

    await chooseVersion('TLS 1.2');
    await next(8);
    expect(text()).toContain('2/4');

    await chooseScenario('expired-cert');
    await next(2);
    expect(text()).toContain('3/4');
    expect(completions).toBe(0);

    await chooseScenario('weak-cipher');
    await next(1);
    expect(completions).toBe(1);
    expect(text()).toContain('Handshakes explored');

    await click('Keep exploring', true);
    expect(completions).toBe(1);
    await chooseVersion('TLS 1.3');
    await chooseScenario('none');
    await next(4);
    expect(completions).toBe(1);
  }, 60_000);
});

describe('Database Indexing on the kit', () => {
  it('no hero, no page keys, a goal', async () => {
    await renderDatabase();
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/5');
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(text()).toContain('Run a query to see how the database found the rows.');
  });

  it('the index rows show only real single indexes', async () => {
    await renderDatabase();
    await click('Add index on (age, city)', true);
    const ageRow = [...container.querySelectorAll('div')].find(
      (element) => element.textContent?.trim() === 'ageAdd'
    );
    if (!ageRow) throw new Error('no age index row');
    expect(ageRow.textContent).not.toContain('Indexed');
    expect(
      [...container.querySelectorAll('button')].some(
        (button) => button.getAttribute('aria-label') === 'Add index on age'
      )
    ).toBe(true);
  });

  it('Start over stops a running query', async () => {
    await renderDatabase();
    await click('Run query', true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await click('Start over', true);
    await click('Click again to start over', true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(text()).toContain('0/5');
    expect(text()).toContain('Run a query to see how the database found the rows.');
  }, 60_000);

  it('one signal, after the fifth mission', async () => {
    await renderDatabase();
    await click('Run query', true);
    await advanceDatabase();
    expect(text()).toContain('1/5');
    await click('Add index on email', true);
    await click('Run query', true);
    await advanceDatabase();
    await click('Add index on age', true);
    await click('Age Range', true);
    await click('Run query', true);
    await advanceDatabase();
    await click('Add index on (age, city)', true);
    await click('Age + City', true);
    await click('Run query', true);
    await advanceDatabase();
    await click('City + Age', true);
    await click('Run query', true);
    await advanceDatabase();
    expect(text()).toContain('4/5');
    expect(completions).toBe(0);
    await click('Find by City', true);
    await click('Run query', true);
    await advanceDatabase();
    expect(completions).toBe(1);
    expect(text()).toContain('Missions complete');
    await click('Keep exploring', true);
    await click('Run query', true);
    await advanceDatabase();
    expect(completions).toBe(1);
  }, 60_000);
});

describe('Database Replication, Sharding and Scaling on the kit', () => {
  it('no hero, a goal, state survives a mode switch', async () => {
    await renderReplicationShardingScaling();
    expect(text()).not.toContain('See how databases survive load');
    expect(text()).toContain('Goal: ');
    expect(text()).toContain('0/5');

    await chooseDatabaseMode('Sharding');
    await chooseSimulatorMode('Range');
    await chooseDatabaseMode('Scaling');
    await chooseDatabaseMode('Sharding');

    const range = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Range'
    );
    if (!range) throw new Error('no Range button');
    expect(range.getAttribute('aria-pressed')).toBe('true');
  });

  it('one signal, after the fifth mission', async () => {
    await renderReplicationShardingScaling();
    await click('Kill primary', true);
    await chooseSimulatorMode('Leaderless');
    expect(text()).toContain('1/5');

    await click('Recover primary', true);
    await chooseSimulatorMode('Sync');
    expect(text()).toContain('2/5');

    await chooseDatabaseMode('Sharding');
    await click('region', true);
    expect(text()).toContain('3/5');

    await chooseSimulatorMode('Range');
    await click('created_at', true);
    await click("created_at > now() - '1 day'", true);
    expect(text()).toContain('4/5');
    expect(completions).toBe(0);

    await chooseDatabaseMode('Scaling');
    await moveDatabaseSlider('Load', 'ArrowRight', 36);
    await moveDatabaseSlider('Vertical tier', 'ArrowRight');
    expect(completions).toBe(1);
    expect(text()).toContain('Missions complete');

    await click('Keep exploring', true);
    expect(completions).toBe(1);
  }, 60_000);
});

describe('MongoDB Terminal on the kit', () => {
  it('no hero, one terminal input, no Run button', async () => {
    await act(async () => root.render(createElement(MongodbTerminalSimulator)));
    expect(text()).not.toContain('mongo shell playground');
    expect(container.querySelectorAll('input[aria-label="Terminal command"]')).toHaveLength(1);
    expect(
      [...container.querySelectorAll('button')].some((button) => buttonName(button) === 'Run')
    ).toBe(false);
  });

  it('one signal on the last command, before the advance delay', async () => {
    await act(async () => root.render(createElement(MongodbTerminalSimulator)));
    await finishMongoLab();

    expect(completions).toBe(1);
    expect(text()).toContain('Lab complete');
    await click('Keep exploring', true);
    expect(completions).toBe(1);
  }, 60_000);

  it('challenges never signal, and coming back does not show the card again', async () => {
    await act(async () => root.render(createElement(MongodbTerminalSimulator)));
    await finishMongoLab();
    expect(completions).toBe(1);

    await click('Try the challenges', true);
    expect(completions).toBe(1);
    await click('Lessons', true);
    expect(text()).not.toContain('Lab complete');
    expect(completions).toBe(1);
  }, 60_000);
});

describe('Terraform Terminal on the kit', () => {
  it('no hero, one terminal input', async () => {
    await act(async () => root.render(createElement(TerraformTerminalSimulator)));

    expect(text()).not.toContain('Terraform Basics Lab');
    expect(container.querySelectorAll('input[aria-label="Terminal command"]')).toHaveLength(1);
  });

  it('Make a change needs a real change', async () => {
    await act(async () => root.render(createElement(TerraformTerminalSimulator)));
    await runTerraformCommand('terraform init');
    await runTerraformCommand('terraform validate');
    await runTerraformCommand('terraform plan');
    await runTerraformCommand('terraform apply -auto-approve');

    expect(text()).toContain('Step 1 of 2');
    await runTerraformCommand('terraform plan');
    expect(text()).toContain('Step 1 of 2');

    await editTerraformVariables();
    await runTerraformCommand('terraform plan');
    expect(text()).toContain('Step 2 of 2');
  }, 60_000);

  it('one signal, on the ninth command', async () => {
    await act(async () => root.render(createElement(TerraformTerminalSimulator)));
    await runTerraformCommand('terraform init');
    await runTerraformCommand('terraform validate');
    await runTerraformCommand('terraform plan');
    await runTerraformCommand('terraform apply -auto-approve');
    await editTerraformVariables();
    await runTerraformCommand('terraform plan');
    await runTerraformCommand('terraform apply -auto-approve');
    await runTerraformCommand('terraform state list');
    await runTerraformCommand('terraform output');

    expect(completions).toBe(0);
    await runTerraformCommand('terraform destroy -auto-approve');
    expect(completions).toBe(1);
    expect(text()).toContain('Lab complete');

    await click('Keep exploring', true);
    expect(completions).toBe(1);
    await runTerraformCommand('terraform plan');
    expect(completions).toBe(1);
  }, 60_000);
});
