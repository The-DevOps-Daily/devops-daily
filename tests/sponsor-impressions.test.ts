// @vitest-environment jsdom

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameSponsors } from '@/components/games/game-sponsors';
import { ImpressionTracker, linkKey } from '@/components/sponsor-impressions';

class FakeObserver {
  static last: FakeObserver;
  observed = new Set<Element>();
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeObserver.last = this;
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.observed.clear();
  }
  show(els: Element[]) {
    const entries = els.map((target) => ({ target, isIntersecting: true, intersectionRatio: 1 }));
    this.callback(entries as unknown as IntersectionObserverEntry[], this as never);
  }
}

let visibility: DocumentVisibilityState = 'visible';
let sendBeacon: ReturnType<typeof vi.fn<(url: string, body: string) => boolean>>;
let tracker: ImpressionTracker;
const preventNavigation = (e: Event) => e.preventDefault();

function beacons() {
  return sendBeacon.mock.calls.map(([url, body]) => {
    expect(url).toBe('https://go.devops-daily.com/e');
    return JSON.parse(body);
  });
}

function link(goKeyOrHref: string): HTMLAnchorElement {
  const all = [...document.querySelectorAll('a')];
  const found = all.find((a) => a.dataset.go === goKeyOrHref || a.href === goKeyOrHref);
  if (!found) throw new Error(`no link ${goKeyOrHref}`);
  return found;
}

function hide() {
  visibility = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  sendBeacon = vi.fn<(url: string, body: string) => boolean>(() => true);
  Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: sendBeacon });
  document.body.innerHTML = renderToStaticMarkup(createElement(GameSponsors));
  document.addEventListener('click', preventNavigation);
  document.addEventListener('auxclick', preventNavigation);
  tracker = new ImpressionTracker();
  tracker.startPage('/games/x');
});

afterEach(() => {
  tracker.stop();
  document.removeEventListener('click', preventNavigation);
  document.removeEventListener('auxclick', preventNavigation);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('sponsor impression beacon', () => {
  it('reads own products from data-go and go links from their href', () => {
    expect(linkKey(link('simulator:smtpfast'))).toBe('simulator:smtpfast');
    expect(linkKey(link('https://go.devops-daily.com/bitrise?p=simulator'))).toBe(
      'simulator:bitrise'
    );
    const bad = document.createElement('a');
    bad.href = 'https://smtpfa.st';
    bad.dataset.go = 'Sidebar smtpfast';
    expect(linkKey(bad)).toBeNull();
  });

  it('puts own product placements in the one beacon per page view, next to go links', () => {
    const links = [...FakeObserver.last.observed];
    expect(links).toHaveLength(6);
    FakeObserver.last.show(links);
    vi.advanceTimersByTime(1000);
    hide();
    expect(beacons()).toEqual([
      {
        page: '/games/x',
        seen: expect.arrayContaining([
          'simulator:bitrise',
          'simulator:devdojo',
          'simulator:smtpfast',
          'simulator:quizapi',
        ]),
      },
    ]);
    expect(beacons()[0].seen).toHaveLength(6);
  });

  it('sends a click on an own product at once, with the impressions not sent yet', () => {
    const own = link('simulator:smtpfast');
    FakeObserver.last.show([own]);
    vi.advanceTimersByTime(1000);
    own.querySelector('img')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(beacons()).toEqual([
      { page: '/games/x', seen: ['simulator:smtpfast'], click: 'simulator:smtpfast' },
    ]);
    hide();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('counts middle clicks, but not right clicks or clicks on go links', () => {
    const own = link('simulator:quizapi');
    own.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 2 }));
    link('https://go.devops-daily.com/bitrise?p=simulator').dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    expect(sendBeacon).not.toHaveBeenCalled();
    own.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(beacons()).toEqual([{ page: '/games/x', seen: [], click: 'simulator:quizapi' }]);
  });
});
