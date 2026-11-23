'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  TURNSTILE_FIELD,
  TurnstileWidget,
  resetTurnstileWidgets,
  waitForTurnstileToken,
} from '@/components/newsletter/turnstile-widget';
import {
  ADVENTS,
  GIVEAWAY_DEADLINE_TEXT,
  cleanName,
  entryDetails,
  isGiveawayOpen,
  nameProblem,
  readStoredCertificate,
  type AdventKey,
} from '@/lib/advent-certificate';

// The SMTPfast signup form for the giveaway, in its own SMTPfast team so entries
// never join the newsletter list. Empty until the form exists: the page then
// says the form opens soon.
export const GIVEAWAY_FORM_ID = '';
const SUBMIT_TIMEOUT_MS = 10_000;

const KEYS: AdventKey[] = ['devops', 'postgres'];

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function GiveawayEntryForm() {
  const [open, setOpen] = useState(true);
  const [ids, setIds] = useState<Partial<Record<AdventKey, string>>>({});
  const [picked, setPicked] = useState<Record<AdventKey, boolean>>({
    devops: false,
    postgres: false,
  });
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setOpen(isGiveawayOpen(new Date()));
      const found: Partial<Record<AdventKey, string>> = {};
      let storedName = '';
      for (const key of KEYS) {
        const cert = readStoredCertificate(ADVENTS[key]);
        if (cert) {
          found[key] = cert.id;
          storedName ||= cert.name;
        }
      }
      setIds(found);
      setPicked({ devops: !!found.devops, postgres: !!found.postgres });
      if (storedName) setName(storedName);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  if (!open) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-6 text-center">
        <p className="font-semibold">Entries are closed.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The form closed on {GIVEAWAY_DEADLINE_TEXT}. Winners are announced on our LinkedIn page.
        </p>
      </div>
    );
  }

  if (!GIVEAWAY_FORM_ID) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center">
        <p className="font-semibold">The entry form opens soon.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Finish the advent and share your certificate in the meantime. Entries are open until{' '}
          {GIVEAWAY_DEADLINE_TEXT}.
        </p>
      </div>
    );
  }

  if (status === 'sent') {
    return (
      <div role="status" className="rounded-md border border-green-500/40 bg-green-500/10 p-6">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
          Almost done: check your email
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {message} Click the link in that email to confirm your entry. Its subject says
          &quot;Confirm your subscription&quot;: it confirms this entry only, and does not sign you
          up for anything else.
        </p>
      </div>
    );
  }

  const nameError = name ? nameProblem(name) : null;
  const anyPicked = picked.devops || picked.postgres;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'sending') return;
    const form = event.currentTarget;
    const problem = nameProblem(name);
    const body = new FormData(form);
    const email = String(body.get('email') ?? '').trim();
    const error =
      problem ??
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Type a valid email address.' : null) ??
      (!anyPicked ? 'Pick the advent you finished.' : null) ??
      (!consent ? 'Tick the box to agree to the rules.' : null);
    if (error) {
      setStatus('error');
      setMessage(error);
      return;
    }
    body.set('first_name', cleanName(name));
    body.set(
      'last_name',
      entryDetails(KEYS.filter((key) => picked[key]).map((key) => ({ key, id: ids[key] })))
    );
    body.set('_sf_page', window.location.href);
    if (!body.get(TURNSTILE_FIELD)) {
      const token = await waitForTurnstileToken(5_000);
      if (token) body.set(TURNSTILE_FIELD, token);
    }

    setStatus('sending');
    setMessage('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
    try {
      const res = await fetch(`https://smtpfa.st/api/forms/${GIVEAWAY_FORM_ID}/submit`, {
        method: 'POST',
        body,
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const apiError =
          typeof json?.error === 'string' && json.error.length < 200 ? json.error : null;
        throw new Error(apiError ?? 'Could not send your entry. Please try again in a minute.');
      }
      setStatus('sent');
      setMessage(typeof json?.message === 'string' ? json.message : 'We sent you an email.');
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof DOMException && err.name === 'AbortError'
          ? 'The request timed out. Check your connection and try again.'
          : err instanceof Error
            ? err.message
            : 'Could not send your entry. Please try again in a minute.'
      );
    } finally {
      clearTimeout(timeout);
      resetTurnstileWidgets();
    }
  };

  const field =
    'mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-md border border-border bg-card p-5 sm:p-6"
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="entry-name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="entry-name"
            type="text"
            autoComplete="name"
            required
            maxLength={70}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!nameError}
            className={field}
          />
          <p
            className={`mt-1 text-xs ${nameError ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
          >
            {nameError ?? 'As on your certificate and LinkedIn.'}
          </p>
        </div>
        <div>
          <label htmlFor="entry-email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="entry-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={field}
          />
          <p className="mt-1 text-xs text-muted-foreground">For the confirmation and your prize.</p>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Which advent did you finish?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {KEYS.map((key) => (
            <label
              key={key}
              className="flex items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-primary/60 has-[:checked]:bg-primary/5"
            >
              <input
                type="checkbox"
                checked={picked[key]}
                onChange={(e) => setPicked((prev) => ({ ...prev, [key]: e.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                <span className="font-medium">{ADVENTS[key].name}</span>
                <span className="block font-mono text-xs text-muted-foreground">
                  {ids[key] ? `certificate ${ids[key]}` : 'no certificate in this browser'}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <input
        type="text"
        name="_hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px opacity-0"
      />

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <span className="text-muted-foreground">
          I follow DevOps Daily on LinkedIn, I shared my certificate, and I agree to the rules
          below. Use my name and email only for this draw.
        </span>
      </label>

      <TurnstileWidget />

      {status === 'error' && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
      >
        {status === 'sending' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {status === 'sending' ? 'Sending...' : 'Enter the giveaway'}
      </button>
    </form>
  );
}
