'use client';

import { useState } from 'react';

const FORM_ID = 'cmomznsaf0001utvb88nateg7';
const SUBMIT_URL = `https://smtpfa.st/api/forms/${FORM_ID}/submit`;

export type SubscribeStatus = 'idle' | 'submitting' | 'ok' | 'error';

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

    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Subscription failed (${res.status})`);
      }
      setStatus('ok');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  return { status, errorMsg, submit };
}
