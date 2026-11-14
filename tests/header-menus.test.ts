// @vitest-environment jsdom

import { act, createElement, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DropdownTrigger } from '@/components/header/dropdown-trigger';
import { MobileMenu } from '@/components/header/mobile-menu';

// The dropdown's code never arrives here, like a click during a slow download.
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: ComponentProps<'a'>) =>
    createElement('a', { href, ...rest }, children),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('header dropdown trigger', () => {
  const Icon = () => null;

  it('stays open when hovered and clicked while the menu code is still loading', async () => {
    await act(async () =>
      root.render(createElement(DropdownTrigger, { label: 'Tools', sections: [], icon: Icon }))
    );
    const wrapper = container.firstElementChild as HTMLElement;
    const button = container.querySelector('button') as HTMLButtonElement;
    const isOpen = () => button.classList.contains('shadow-sm');

    await act(async () => {
      wrapper.dispatchEvent(
        new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })
      );
    });
    expect(isOpen()).toBe(true);

    await act(async () => button.click());
    expect(isOpen()).toBe(true);
  });
});

describe('mobile menu', () => {
  let menuButton: HTMLButtonElement;
  const render = (isOpen: boolean) =>
    act(async () =>
      root.render(
        createElement(MobileMenu, {
          isOpen,
          onClose: () => {},
          returnFocusRef: { current: menuButton },
        })
      )
    );
  const wrapper = () => container.firstElementChild as HTMLElement;
  const hidden = () => wrapper().getAttribute('aria-hidden') === 'true';
  const inert = () => wrapper().hasAttribute('inert');
  const afterPaint = () => act(async () => vi.advanceTimersByTime(50));

  beforeEach(() => {
    menuButton = document.createElement('button');
    document.body.appendChild(menuButton);
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
  });
  afterEach(() => menuButton.remove());

  it('keeps the inert toggle out of the tap, one paint later', async () => {
    await render(false);
    expect(hidden()).toBe(true);
    expect(inert()).toBe(true);

    // Opening: announced at once, focusable after the first paint.
    await render(true);
    expect(hidden()).toBe(false);
    expect(inert()).toBe(true);
    await afterPaint();
    expect(inert()).toBe(false);

    // Closing: aria-hidden and inert land together, after the first paint.
    await render(false);
    expect(hidden()).toBe(false);
    expect(inert()).toBe(false);
    await afterPaint();
    expect(hidden()).toBe(true);
    expect(inert()).toBe(true);
  });

  it('moves focus out of the menu when it closes', async () => {
    await render(true);
    await afterPaint();
    const link = wrapper().querySelector('a') as HTMLAnchorElement;
    link.focus();
    expect(document.activeElement).toBe(link);

    await render(false);
    expect(document.activeElement).toBe(menuButton);
    await afterPaint();
    expect(wrapper().contains(document.activeElement)).toBe(false);
  });
});
