// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_KEY,
  getCookieConsent,
  setCookieConsent,
} from '@/lib/cookie-consent';

describe('cookie consent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('migrates the previous accept-only preference', () => {
    localStorage.setItem('cookieAccepted', 'true');

    expect(getCookieConsent()).toBe('accepted');
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('accepted');
    expect(localStorage.getItem('cookieAccepted')).toBeNull();
  });

  it('stores and broadcasts a new preference', () => {
    const listener = vi.fn();
    window.addEventListener(COOKIE_CONSENT_EVENT, listener);

    setCookieConsent('rejected');

    expect(getCookieConsent()).toBe('rejected');
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(COOKIE_CONSENT_EVENT, listener);
  });
});

/**
 * The 31 July consent change stopped GA loading at all without a click, so
 * the site counted only the few visitors who accepted the banner. Cloudflare
 * showed ~7k uniques a day while GA reported a couple of hundred.
 *
 * The fix is Google Consent Mode: gtag.js loads for everyone, with analytics
 * storage denied until consent. These lock in the parts that broke.
 */
describe('analytics consent wiring', () => {
  const layout = readFileSync(join(process.cwd(), 'app', 'layout.tsx'), 'utf-8');
  const analytics = readFileSync(
    join(process.cwd(), 'components', 'site-analytics.tsx'),
    'utf-8',
  );

  it('loads Google Analytics for every visitor, not only after consent', () => {
    // The regression was `if (consent !== 'accepted') return null;` above the
    // GoogleAnalytics element, which made the whole component render nothing.
    const gaIndex = analytics.indexOf('<GoogleAnalytics');
    expect(gaIndex).toBeGreaterThan(-1);
    const beforeGa = analytics.slice(0, gaIndex);
    expect(beforeGa).not.toMatch(/return null/);
  });

  it('sets a Consent Mode default before gtag.js runs', () => {
    expect(layout).toContain('consent-mode-default');
    // beforeInteractive is what puts it ahead of gtag.js. Without it the
    // default can land after the first ping and the ping sets a cookie.
    expect(layout).toMatch(/id="consent-mode-default"[\s\S]{0,120}beforeInteractive/);
    expect(layout).toContain("gtag('consent','default'");
  });

  it('denies analytics storage by default and grants it on consent', () => {
    expect(layout).toContain("analytics_storage:c==='accepted'?'granted':'denied'");
    expect(analytics).toContain("gtag('consent', 'update', { analytics_storage: 'granted' })");
  });

  it('reads the stored choice in the default, so a returning visitor is not downgraded', () => {
    // Someone who already accepted must start granted, or their first
    // pageview of every session is recorded cookielessly.
    expect(layout).toContain("localStorage.getItem('cookie-consent')");
    expect(layout).toContain("localStorage.getItem('cookieAccepted')");
  });

  it('keeps advertising signals denied, since the site does not run ads', () => {
    for (const key of ['ad_storage', 'ad_user_data', 'ad_personalization']) {
      expect(layout).toContain(`${key}:'denied'`);
    }
  });
});
