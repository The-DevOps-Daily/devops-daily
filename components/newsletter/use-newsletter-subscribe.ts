'use client';

import { useState } from 'react';

const FORM_ID = 'cmomznsaf0001utvb88nateg7';
const SUBMIT_URL = `https://smtpfa.st/api/forms/${FORM_ID}/submit`;
// Cap how long we wait for smtpfast before giving the user back control.
// A hung endpoint with no timeout leaves the button stuck on "Subscribing..."
// indefinitely; 10s is long enough for a normal slow network and short
// enough that the user is not staring at a frozen spinner.
const SUBMIT_TIMEOUT_MS = 10_000;

export type SubscribeStatus = 'idle' | 'submitting' | 'ok' | 'error';

const FRIENDLY_ERROR =
  'Could not subscribe right now. Please try again in a minute.';

/**
 * Client-side newsletter signup that posts to SMTPfast and exposes
 * idle / submitting / ok / error state. Each call site renders its own
 * UI (terminal aesthetic, sidebar widget, popup, etc.) and just calls
 * submit() with the form's FormData.
 *
 * Replaces the previous Mailchimp form-action redirects so the user
 * stays on devops-daily.com after submitting.
 */
export function useNewsletterSubscribe() {
  const [status, setStatus] = useState<SubscribeStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async (formData: FormData) => {
    if (status === 'submitting') return;
    setStatus('submitting');
    setErrorMsg(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      if (!res.ok) {
        // smtpfast usually returns JSON errors but a 5xx from the upstream
        // proxy can be plain HTML. Catch both so the user never sees raw
        // markup or a parse error in the toast.
        const body = await res.json().catch(() => ({}));
        const apiError =
          typeof body?.error === 'string' && body.error.length < 200
            ? body.error
            : null;
        throw new Error(apiError || FRIENDLY_ERROR);
      }
      setStatus('ok');
    } catch (err) {
      setStatus('error');
      const aborted =
        err instanceof DOMException && err.name === 'AbortError';
      setErrorMsg(
        aborted
          ? 'The request timed out. Check your connection and try again.'
          : err instanceof Error && err.message
            ? err.message
            : FRIENDLY_ERROR,
      );
    } finally {
      clearTimeout(timeout);
    }
  };

  return { status, errorMsg, submit };
}
