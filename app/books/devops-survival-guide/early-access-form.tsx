'use client';

import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNewsletterSubscribe } from '@/components/newsletter/use-newsletter-subscribe';
import { TurnstileWidget } from '@/components/newsletter/turnstile-widget';

export function EarlyAccessForm() {
  const { status, errorMsg, submit } = useNewsletterSubscribe('book_page');

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(new FormData(event.currentTarget));
  };

  if (status === 'ok') {
    return (
      <div
        role="status"
        className="rounded-md border border-primary/30 bg-primary/[0.06] px-4 py-3 text-sm"
      >
        <p className="mb-1 flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
          Almost done
        </p>
        <p className="text-muted-foreground">
          Check your inbox and click the confirmation link. Then you will hear when the book is out.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="early-access-email" className="sr-only">
        Email address
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="early-access-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'submitting' ? (
            'Signing up…'
          ) : (
            <>
              Notify me at launch
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </div>

      {/* Honeypot: bots fill it, smtpfast rejects the submission. */}
      <input
        type="text"
        name="_hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px' }}
      />
      <input type="hidden" name="source" value="book_early_access" />
      <TurnstileWidget />

      {status === 'error' && errorMsg && (
        <p role="alert" className="text-sm text-rose-500">
          {errorMsg}
        </p>
      )}
    </form>
  );
}
