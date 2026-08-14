'use client';

import Script from 'next/script';
import { GoogleAnalytics } from '@next/third-parties/google';

/**
 * Analytics for the site.
 *
 * This deliberately carries no consent gating. Two earlier attempts at it both
 * measured far less than the site actually gets: gating gtag.js entirely (31
 * July) collapsed GA to a couple of hundred visitors a day, and Consent Mode
 * with analytics storage denied by default (PR #1548) did not recover it,
 * because GA only models denied traffic once a property clears Google's
 * thresholds, one of which is 1,000 daily consented users on 7 of the previous
 * 28 days. This site does not clear that, so denied pageviews stayed invisible.
 *
 * Cloudflare remains the source of truth for traffic volume. It is server side,
 * so it counts adblocked visitors that no script here ever will.
 */
export function SiteAnalytics() {
  return (
    <>
      <GoogleAnalytics gaId="G-DRHMSC6G9R" />

      {/* lazyOnload so it does not compete with first paint or early
          interactions (INP). */}
      <Script
        id="ahrefs-analytics"
        src="https://analytics.ahrefs.com/analytics.js"
        data-key="DDU3onGEafDWd/obeLf2Pw"
        strategy="lazyOnload"
      />
    </>
  );
}
