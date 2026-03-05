'use client';

import { useState } from 'react';
import { BREVO_FORM_URL, EMAIL_RE, submitToBrevo } from '@/lib/newsletter';

export type SubscribeStatus = 'idle' | 'loading' | 'success' | 'error';

export function useNewsletterSubscribe() {
  const [status, setStatus] = useState<SubscribeStatus>('idle');

  const subscribe = async (email: string) => {
    if (!EMAIL_RE.test(email)) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    try {
      await submitToBrevo(email);
      setStatus('success');
    } catch {
      const w = window.open(BREVO_FORM_URL, '_blank');
      if (!w) {
        console.warn('[newsletter] Popup blocked. Direct user to:', BREVO_FORM_URL);
      }
      setStatus('error');
    }
  };

  return { status, subscribe };
}
