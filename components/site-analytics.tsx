'use client';

import { useSyncExternalStore } from 'react';
import Script from 'next/script';
import { GoogleAnalytics } from '@next/third-parties/google';
import { COOKIE_CONSENT_EVENT, getCookieConsent, type CookieConsent } from '@/lib/cookie-consent';

export function SiteAnalytics() {
  const consent = useSyncExternalStore<CookieConsent | null>(
    (onStoreChange) => {
      window.addEventListener(COOKIE_CONSENT_EVENT, onStoreChange);
      window.addEventListener('storage', onStoreChange);
      return () => {
        window.removeEventListener(COOKIE_CONSENT_EVENT, onStoreChange);
        window.removeEventListener('storage', onStoreChange);
      };
    },
    getCookieConsent,
    () => null
  );

  if (consent !== 'accepted') return null;

  return (
    <>
      <GoogleAnalytics gaId="G-DRHMSC6G9R" />
      <Script
        id="ahrefs-analytics"
        src="https://analytics.ahrefs.com/analytics.js"
        data-key="DDU3onGEafDWd/obeLf2Pw"
        strategy="lazyOnload"
      />
    </>
  );
}
