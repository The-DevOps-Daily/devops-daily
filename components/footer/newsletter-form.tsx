'use client';

import { type ReactNode } from 'react';
import { Mail, ArrowRight } from 'lucide-react';
import { useNewsletterSubscribe } from '../newsletter/use-newsletter-subscribe';

interface Props {
  /** Renders without the wrapping card chrome (used inside hero / popup). */
  bare?: boolean;
  /** Optional headline override. Defaults to "Stay Updated". */
  headline?: ReactNode;
  /** Optional supporting copy override. */
  description?: ReactNode;
  /** Where the user came from — passed through to smtpfast as a tag. */
  source?: string;
}

/**
 * Newsletter signup form, posting to SMTPfast (https://smtpfa.st). Replaces
 * the previous Mailchimp form. Submission goes via fetch so the user stays
 * on devops-daily.com — no popup, no redirect — and we show an inline
 * confirmation card on success.
 */
export function NewsletterForm({ bare, headline, description, source }: Props = {}) {
  const { status, errorMsg, submit } = useNewsletterSubscribe();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(new FormData(event.currentTarget));
  };

  const Body = (
    <>
      {!bare && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-primary" />
            <h4 className="font-bold text-foreground">{headline ?? 'Stay Updated'}</h4>
          </div>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            {description ?? 'Get the latest DevOps insights delivered to your inbox weekly.'}
          </p>
        </>
      )}

      {status === 'ok' ? (
        <div className="rounded-md border border-primary/30 bg-primary/[0.06] px-4 py-3 text-sm text-foreground">
          <p className="font-semibold mb-1">Thanks for subscribing!</p>
          <p className="text-muted-foreground text-xs">
            Check your inbox for a confirmation email — click the link inside to finish signing up.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            name="email"
            required
            placeholder="your@email.com"
            className="w-full px-4 py-3 border border-border/50 bg-background/50 backdrop-blur-sm rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          />

          {/* Honeypot field — bots fill it, smtpfast rejects the submission. */}
          <input
            type="text"
            name="_hp"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px' }}
          />

          {source && <input type="hidden" name="source" value={source} />}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="group inline-flex items-center justify-center w-full px-4 py-3 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === 'submitting' ? 'Subscribing…' : (
              <>
                Subscribe
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

          {status === 'error' && errorMsg && (
            <p className="text-xs text-rose-400">{errorMsg}</p>
          )}
        </form>
      )}
    </>
  );

  if (bare) return Body;

  return (
    <div className="p-6 bg-primary/5 border border-primary/20 rounded-md">
      {Body}
    </div>
  );
}
