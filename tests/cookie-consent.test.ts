// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
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
