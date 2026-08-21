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
 * Analytics has been through two failed consent designs. Gating gtag.js behind
 * a click (31 July) collapsed GA to a couple of hundred visitors a day against
 * ~7k real ones. Consent Mode with analytics storage denied (PR #1548) did not
 * recover it either, because GA only models denied traffic once a property
 * clears Google's thresholds, one of which is 1,000 daily consented users on 7
 * of the previous 28 days. This site does not clear that bar.
 *
 * Analytics now loads unconditionally. These tests lock that in, and check the
 * banner does not claim to offer a choice the code no longer honours.
 */
describe('analytics wiring', () => {
  const layout = readFileSync(join(process.cwd(), 'app', 'layout.tsx'), 'utf-8');
  const analytics = readFileSync(
    join(process.cwd(), 'components', 'site-analytics.tsx'),
    'utf-8',
  );
  const banner = readFileSync(
    join(process.cwd(), 'components', 'cookie-banner.tsx'),
    'utf-8',
  );

  it('loads Google Analytics for every visitor', () => {
    const gaIndex = analytics.indexOf('<GoogleAnalytics');
    expect(gaIndex).toBeGreaterThan(-1);
    // Both regressions worked by returning early above this element.
    expect(analytics.slice(0, gaIndex)).not.toMatch(/return null/);
  });

  it('does not gate analytics on a stored consent choice', () => {
    expect(analytics).not.toContain('cookie-consent');
    expect(analytics).not.toMatch(/consent === 'accepted'/);
  });

  it('no longer sets a Consent Mode default', () => {
    expect(layout).not.toContain('consent-mode-default');
    expect(layout).not.toContain("gtag('consent','default'");
  });

  it('does not offer a reject button that would do nothing', () => {
    // A control that claims to switch analytics off while gtag.js loads
    // regardless is worse than no control at all.
    expect(banner).not.toContain('Allow analytics');
    expect(banner).not.toContain('Continue without');
  });
});
