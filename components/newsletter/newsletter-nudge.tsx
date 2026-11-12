'use client';

import { useEffect, useId, useState } from 'react';
import { Mail, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  hasSubscribed,
  useNewsletterSubscribe,
  type SignupLocation,
} from './use-newsletter-subscribe';
import { TurnstileWidget } from './turnstile-widget';

const DISMISSED_KEY = 'dd-newsletter-nudge-dismissed';
const QUIET_DAYS = 30;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return at > 0 && Date.now() - at < QUIET_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * A small signup box for the moment a reader finishes something: a post, a
 * simulator, a quiz. It stays hidden for subscribers, and for 30 days after
 * "No thanks". It renders after mount, so the server HTML never has it.
 */
export function NewsletterNudge({
  location,
  title,
  text,
  className,
}: {
  location: SignupLocation;
  title: string;
  text: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  const { status, errorMsg, submit } = useNewsletterSubscribe(location);
  const inputId = useId();

  useEffect(() => {
    // Reads localStorage, which the server does not have.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!hasSubscribed() && !dismissedRecently()) setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Private mode: it just shows again next time.
    }
    setShow(false);
  };

  return (
    <section
      aria-label="Newsletter"
      className={cn(
        'relative rounded-lg border border-primary/30 bg-primary/[0.04] p-4',
        className
      )}
    >
      {status !== 'ok' && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="No thanks, hide this"
          className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      <div className="flex items-center gap-2 pr-8">
        <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {status === 'ok' ? (
        <p className="mt-1 text-sm text-muted-foreground" role="status">
          Almost done. Check your inbox and click the link to confirm.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit(new FormData(event.currentTarget));
            }}
            className="mt-3 flex flex-col gap-2 sm:flex-row"
          >
            <label htmlFor={inputId} className="sr-only">
              Email address
            </label>
            <input
              id={inputId}
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {/* Honeypot: bots fill it, smtpfast rejects the submission. */}
            <input
              type="text"
              name="_hp"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px' }}
            />
            <input type="hidden" name="source" value={location} />
            <TurnstileWidget />
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="h-10 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'submitting' ? 'Subscribing…' : 'Subscribe'}
            </button>
          </form>
          {status === 'error' && errorMsg && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {errorMsg}
            </p>
          )}
        </>
      )}
    </section>
  );
}
