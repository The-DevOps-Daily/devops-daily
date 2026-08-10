'use client';

import { useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import Script from 'next/script';
import { GoogleAnalytics } from '@next/third-parties/google';
import { COOKIE_CONSENT_EVENT, getCookieConsent, type CookieConsent } from '@/lib/cookie-consent';

/**
 * gtag pushes its `arguments` object, not an array, and the two are not
 * interchangeable. Writing it out here rather than calling `window.gtag`
 * means a consent update still queues correctly if it happens before
 * gtag.js has finished loading. GA drains the queue on load.
 */
function gtag(..._args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

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

  // Consent Mode: the default is set before gtag.js in the root layout, and
  // this raises it once someone allows analytics. Rejecting is already the
  // default, so there is nothing to send for that case.
  useEffect(() => {
    if (consent === 'accepted') {
      gtag('consent', 'update', { analytics_storage: 'granted' });
    }
  }, [consent]);

  return (
    <>
      {/* Loads for every visitor. Consent Mode keeps it cookieless until the
          visitor allows analytics, so we still get aggregate numbers instead
          of counting only the few people who click the banner. */}
      <GoogleAnalytics gaId="G-DRHMSC6G9R" />

      {/* Ahrefs stays behind explicit consent. It is a separate vendor and
          Consent Mode does not govern it. */}
      {consent === 'accepted' && (
        <Script
          id="ahrefs-analytics"
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="DDU3onGEafDWd/obeLf2Pw"
          strategy="lazyOnload"
        />
      )}
    </>
  );
}
