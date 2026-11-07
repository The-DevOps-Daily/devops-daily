// @vitest-environment jsdom

import { act, createElement, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbedClient } from '@/app/games/[slug]/embed/embed-client';
import GitQuiz from '@/components/games/git-quiz';
import { HideInGameEmbed } from '@/components/hide-in-game-embed';
import { SiteThemeProvider, useResolvedTheme } from '@/components/theme-provider';
import gitQuizJson from '@/content/quizzes/git-quiz.json';
import { embedThemeFromSearch, isGameEmbedPath } from '@/lib/games/embed-theme';
import { GAME_COMPLETE_EVENT } from '@/lib/games/game-complete';
import { getQuizById } from '@/lib/quiz-loader';

let pathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

// What Opsville opens: /games/<slug>/embed?embed=opsville&theme=dark&hideTitle=true&run=<id>
const OPSVILLE_QUERY = '?embed=opsville&theme=dark&hideTitle=true&run=k3x9q2m7p4w8z1v6';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function ShownTheme() {
  return createElement('p', { id: 'shown-theme' }, useResolvedTheme() ?? 'none');
}

async function render(path: string, element: ReturnType<typeof createElement>) {
  pathname = path.split('?')[0];
  window.history.replaceState(null, '', path);
  await act(async () => root.render(element));
}

function embed(Game: ComponentType = ShownTheme) {
  return createElement(
    SiteThemeProvider,
    null,
    createElement(EmbedClient, { slug: 'git-quiz', title: 'Git Command Quiz', GameComponent: Game })
  );
}

async function press(key: string) {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addListener() {},
    removeListener() {},
  })) as unknown as typeof window.matchMedia;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.history.replaceState(null, '', '/');
});

describe('game embed theme', () => {
  it('matches only the embed route', () => {
    expect(isGameEmbedPath('/games/git-quiz/embed')).toBe(true);
    expect(isGameEmbedPath('/games/git-quiz/embed/')).toBe(true);
    expect(isGameEmbedPath('/games/git-quiz')).toBe(false);
    expect(isGameEmbedPath('/games/embed')).toBe(false);
    expect(isGameEmbedPath(null)).toBe(false);
  });

  it('reads ?theme=, dark by default and the visitor theme for auto', () => {
    expect(embedThemeFromSearch('')).toBe('dark');
    expect(embedThemeFromSearch('?theme=dark')).toBe('dark');
    expect(embedThemeFromSearch('?theme=light')).toBe('light');
    expect(embedThemeFromSearch('?theme=auto')).toBeUndefined();
  });

  it("shows the embed's theme and keeps the visitor's saved one", async () => {
    localStorage.setItem('theme', 'light');

    await render(`/games/git-quiz/embed${OPSVILLE_QUERY}`, embed());

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(container.querySelector('#shown-theme')?.textContent).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(Object.keys(localStorage)).toEqual(['theme']);
  });

  it('saves nothing for a visitor with no saved theme', async () => {
    await render('/games/git-quiz/embed?theme=light', embed());

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(localStorage.length).toBe(0);
  });

  it('leaves the theme to the visitor everywhere else', async () => {
    localStorage.setItem('theme', 'light');

    await render('/games/git-quiz?theme=dark', embed());

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(container.querySelector('#shown-theme')?.textContent).toBe('light');
  });
});

describe('site extras in a game embed', () => {
  const extras = () =>
    createElement(HideInGameEmbed, null, createElement('p', { id: 'extra' }, 'popup'));

  it('are not rendered on the embed route', async () => {
    await render(`/games/git-quiz/embed${OPSVILLE_QUERY}`, extras());
    expect(container.querySelector('#extra')).toBeNull();
  });

  it('are rendered on the game page', async () => {
    await render('/games/git-quiz', extras());
    expect(container.querySelector('#extra')).not.toBeNull();
  });
});

describe('git-quiz embed', () => {
  it('uses the same quiz data as /games/git-quiz', async () => {
    expect(gitQuizJson).toEqual(await getQuizById('git-quiz'));
  });

  it('signals the end of the quiz once', async () => {
    const done = vi.fn();
    window.addEventListener(GAME_COMPLETE_EVENT, done);

    await render(`/games/git-quiz/embed${OPSVILLE_QUERY}`, embed(GitQuiz));
    await press('Enter');
    expect(container.textContent).toContain(`Question 1 of ${gitQuizJson.questions.length}`);

    for (let i = 0; i < gitQuizJson.questions.length; i++) {
      expect(done).not.toHaveBeenCalled();
      await press('1');
      await press('Enter');
      await press('n');
    }

    expect(done).toHaveBeenCalledOnce();
    window.removeEventListener(GAME_COMPLETE_EVENT, done);
  });
});
