export const COOKIE_CONSENT_KEY = 'cookie-consent';
export const COOKIE_CONSENT_EVENT = 'devops-daily:cookie-consent';

export type CookieConsent = 'accepted' | 'rejected';

export function getCookieConsent(): CookieConsent | null {
  const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
  if (stored === 'accepted' || stored === 'rejected') return stored;

  // Migrate the previous accept-only preference.
  if (localStorage.getItem('cookieAccepted') === 'true') {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    localStorage.removeItem('cookieAccepted');
    return 'accepted';
  }

  return null;
}

export function setCookieConsent(consent: CookieConsent) {
  localStorage.setItem(COOKIE_CONSENT_KEY, consent);
  window.dispatchEvent(new CustomEvent<CookieConsent>(COOKIE_CONSENT_EVENT, { detail: consent }));
}
