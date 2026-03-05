'use client';

import { useState } from 'react';
import { EMAIL_RE, submitToBrevo } from '@/lib/newsletter';

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
      setStatus('error');
    }
  };

  return { status, subscribe };
}
