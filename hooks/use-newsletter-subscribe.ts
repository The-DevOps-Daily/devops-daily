'use client';

import { useState } from 'react';

export type SubscribeStatus = 'idle' | 'loading' | 'success' | 'error';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useNewsletterSubscribe() {
  const [status, setStatus] = useState<SubscribeStatus>('idle');

  const subscribe = async (email: string) => {
    if (!EMAIL_RE.test(email)) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? 'success' : 'error');
    } catch {
      setStatus('error');
    }
  };

  return { status, subscribe };
}
