// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from 'next-themes';
import { SiteThemeProvider } from '@/components/theme-provider';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
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

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.documentElement.className = '';
  localStorage.clear();
});

function Toggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return createElement('button', {
    onClick: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
  });
}

describe('theme switch', () => {
  it('turns transitions off for the switch with a class, not a style sheet', async () => {
    await act(async () => root.render(createElement(SiteThemeProvider, null, createElement(Toggle))));
    const html = document.documentElement;
    expect(html.classList.contains('light')).toBe(true);
    const sheets = document.head.querySelectorAll('style').length;

    await act(async () => container.querySelector('button')!.click());
    expect(html.classList.contains('dark')).toBe(true);
    expect(html.classList.contains('theme-switching')).toBe(true);
    expect(document.head.querySelectorAll('style').length).toBe(sheets);

    // Off again once the switch has been painted.
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
    expect(html.classList.contains('theme-switching')).toBe(false);

    await act(async () => container.querySelector('button')!.click());
    expect(html.classList.contains('light')).toBe(true);
    expect(html.classList.contains('theme-switching')).toBe(true);
  });
});
