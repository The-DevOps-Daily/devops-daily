'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { GO_LINKS_ORIGIN } from '@/lib/sponsors';

const VISIBLE_RATIO = 0.5;
const VISIBLE_MS = 1000;
const MAX_SEEN = 16;
// Our own products link direct and carry data-go="placement:slug" instead.
const SPONSOR_LINKS = `a[href^="${GO_LINKS_ORIGIN}/"], a[data-go]`;
const GO_KEY = /^[a-z0-9-]{1,48}:[a-z0-9-]{1,64}$/;

/**
 * Counts sponsor logo impressions for the sponsor reports on
 * go.devops-daily.com. A sponsor link counts once per page view when at least
 * half of it is on screen for a second while the tab is visible. A page
 * written for a sponsor carries data-sponsor-campaign, which also counts a
 * view. Everything for one page view goes in one beacon, sent when the reader
 * hides or leaves the page, so the worker writes about one row per page view.
 * A click on one of our own products, which link direct instead of through a
 * go link, sends the beacon at once with the click in it, so the worker can
 * count it like a go link click. No cookies and nothing stored in the browser.
 */
export function SponsorImpressions() {
  const pathname = usePathname();
  const tracker = useRef<ImpressionTracker | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || typeof navigator.sendBeacon !== 'function')
      return;
    const t = new ImpressionTracker();
    tracker.current = t;
    return () => {
      t.stop();
      tracker.current = null;
    };
  }, []);

  useEffect(() => {
    tracker.current?.startPage(pathname);
  }, [pathname]);

  return null;
}

export function linkKey(el: Element): string | null {
  if (!(el instanceof HTMLAnchorElement)) return null;
  const own = el.dataset.go;
  if (own !== undefined) return GO_KEY.test(own) ? own : null;
  try {
    const url = new URL(el.href);
    const slug = url.pathname.slice(1);
    const placement = url.searchParams.get('p');
    return url.origin === GO_LINKS_ORIGIN && slug && placement ? `${placement}:${slug}` : null;
  } catch {
    return null;
  }
}

export class ImpressionTracker {
  private page = '';
  private campaign: string | null = null;
  private viewSent = false;
  private seen = new Set<string>();
  private unsent = new Set<string>();
  private onScreen = new Set<Element>();
  private timers = new Map<Element, number>();
  private scanTimer = 0;
  private io = new IntersectionObserver((entries) => this.onIntersect(entries), {
    threshold: [0, VISIBLE_RATIO],
  });
  // Client-side navigation and lazy sections add sponsor links after load.
  private mo = new MutationObserver(() => {
    window.clearTimeout(this.scanTimer);
    this.scanTimer = window.setTimeout(this.scan, 250);
  });

  constructor() {
    this.mo.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.flush);
    document.addEventListener('click', this.onClick, true);
    document.addEventListener('auxclick', this.onClick, true);
  }

  startPage(path: string) {
    this.flush();
    this.page = path;
    this.campaign = null;
    this.viewSent = false;
    this.seen.clear();
    this.unsent.clear();
    this.clearTimers();
    this.onScreen.clear();
    // Observing again reports each link's current state, so the new page
    // starts from what is on screen now.
    this.io.disconnect();
    this.scan();
  }

  stop() {
    this.flush();
    this.clearTimers();
    this.io.disconnect();
    this.mo.disconnect();
    window.clearTimeout(this.scanTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.flush);
    document.removeEventListener('click', this.onClick, true);
    document.removeEventListener('auxclick', this.onClick, true);
  }

  private scan = () => {
    const tagged = document.querySelector<HTMLElement>('[data-sponsor-campaign]');
    if (tagged?.dataset.sponsorCampaign) this.campaign = tagged.dataset.sponsorCampaign;
    document.querySelectorAll(SPONSOR_LINKS).forEach((el) => this.io.observe(el));
  };

  private onIntersect(entries: IntersectionObserverEntry[]) {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO) {
        this.onScreen.add(entry.target);
        this.arm(entry.target);
      } else {
        this.onScreen.delete(entry.target);
        this.disarm(entry.target);
      }
    }
  }

  private arm(el: Element) {
    if (document.visibilityState !== 'visible' || this.timers.has(el)) return;
    const key = linkKey(el);
    if (!key || this.seen.has(key)) return;
    this.timers.set(
      el,
      window.setTimeout(() => {
        this.timers.delete(el);
        if (document.visibilityState !== 'visible' || !this.onScreen.has(el)) return;
        this.seen.add(key);
        this.unsent.add(key);
      }, VISIBLE_MS)
    );
  }

  private disarm(el: Element) {
    window.clearTimeout(this.timers.get(el));
    this.timers.delete(el);
  }

  private clearTimers() {
    for (const timer of this.timers.values()) window.clearTimeout(timer);
    this.timers.clear();
  }

  // A hidden tab pauses the one-second count; coming back starts it again for
  // the links that are still on screen.
  private onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      this.clearTimers();
      this.flush();
    } else {
      for (const el of this.onScreen) this.arm(el);
    }
  };

  // A left click, or a middle click that opens a new tab. sendBeacon queues the
  // request and returns, so the navigation does not wait for it.
  private onClick = (event: MouseEvent) => {
    if (event.type === 'auxclick' && event.button !== 1) return;
    const link = (event.target as Element | null)?.closest?.('a[data-go]');
    // A go link counts its own clicks when the worker redirects it.
    if (!(link instanceof HTMLAnchorElement) || link.href.startsWith(`${GO_LINKS_ORIGIN}/`)) return;
    const click = linkKey(link);
    if (click) this.send(click);
  };

  private flush = () => this.send(null);

  private send(click: string | null) {
    const campaign = this.viewSent ? null : this.campaign;
    if (!this.page || (this.unsent.size === 0 && !campaign && !click)) return;
    const seen = [...this.unsent].slice(0, MAX_SEEN);
    const body: { page: string; seen: string[]; campaign?: string; click?: string } = {
      page: this.page,
      seen,
    };
    if (campaign) body.campaign = campaign;
    if (click) body.click = click;
    // A string body goes as text/plain, which needs no CORS preflight.
    if (navigator.sendBeacon(`${GO_LINKS_ORIGIN}/e`, JSON.stringify(body))) {
      for (const key of seen) this.unsent.delete(key);
      if (campaign) this.viewSent = true;
    }
  }
}
