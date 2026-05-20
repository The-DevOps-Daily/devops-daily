'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, X } from 'lucide-react';

/**
 * Renders a one-off confirmation banner on the newsletters archive when
 * a user has just confirmed their subscription via smtpfast. Point the
 * smtpfast form's "confirmation redirect" at
 * `https://devops-daily.com/newsletters?confirmed=1` (or any page that
 * mounts this component) and they will see the banner above the archive
 * list when they land.
 *
 * Self-clears the `confirmed` query param on dismiss so refresh doesn't
 * re-show the banner. The router.replace runs without a scroll jump so
 * the user's reading position is preserved.
 */
export function NewsletterConfirmationBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  const confirmed = searchParams.get('confirmed') === '1';

  // Strip the param after 8s so the URL is clean even if the user does
  // not dismiss. Eight seconds is long enough to read the banner and
  // short enough that copy-paste of the page URL never goes around with
  // a stale confirmation flag.
  useEffect(() => {
    if (!confirmed || dismissed) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('confirmed');
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }, 8000);
    return () => clearTimeout(t);
  }, [confirmed, dismissed, pathname, router, searchParams]);

  if (!confirmed || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="container mx-auto px-4 max-w-3xl mt-4"
    >
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-3 sm:px-5 sm:py-4">
        <CheckCircle2
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            You&apos;re subscribed.
          </p>
          <p className="text-xs leading-5 text-emerald-700/80 dark:text-emerald-200/80 mt-0.5">
            Thanks for confirming. Next Monday&apos;s issue is on the way.
            Browse past issues below while you wait.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 -m-1 p-1 rounded-md text-emerald-700/70 hover:text-emerald-700 dark:text-emerald-200/70 dark:hover:text-emerald-200 transition-colors"
          aria-label="Dismiss confirmation message"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
