'use client';

import { useNewsletterSubscribe } from './use-newsletter-subscribe';

/**
 * Terminal-styled newsletter signup used on the homepage hero. Mimics a
 * shell prompt + cursor for visual continuity with the rest of the
 * landing-page CLI aesthetic, but submits via fetch to SMTPfast so the
 * user stays on devops-daily.com after subscribing.
 */
export function TerminalNewsletterSignup() {
  const { status, errorMsg, submit } = useNewsletterSubscribe();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(new FormData(event.currentTarget));
  };

  if (status === 'ok') {
    return (
      <div className="pl-4 pt-1 pb-2">
        <div className="text-foreground">
          <span className="text-green-500">✔</span> Subscribed. Check your inbox for a confirmation email.
        </div>
      </div>
    );
  }

  return (
    <>
      <form
        onSubmit={onSubmit}
        className="flex flex-col sm:flex-row gap-2 pl-4"
      >
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="flex-1 bg-background border border-input px-3 py-2 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <input
          type="text"
          name="_hp"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px' }}
        />
        <input type="hidden" name="source" value="homepage_hero" />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="px-4 py-2 bg-foreground text-background rounded text-sm font-semibold font-mono hover:bg-foreground/90 transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status === 'submitting' ? 'Subscribing…' : 'Subscribe'}
        </button>
      </form>
      {status === 'error' && errorMsg && (
        <p className="pl-4 text-xs text-rose-400">{errorMsg}</p>
      )}
    </>
  );
}
