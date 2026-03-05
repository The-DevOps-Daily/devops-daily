'use client';

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { useNewsletterSubscribe } from '@/hooks/use-newsletter-subscribe';

export function NewsletterInlineForm() {
  const [email, setEmail] = useState('');
  const { status, subscribe } = useNewsletterSubscribe();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) subscribe(email);
  };

  if (status === 'success') {
    return (
      <div className="flex items-center gap-2 py-2">
        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
        <p className="text-sm font-medium">You&apos;re subscribed! Check your inbox.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder="you@example.com"
        className="w-full px-3 py-2 border border-border bg-background rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {status === 'error' && (
        <p className="text-xs text-red-500">Something went wrong. Please try again.</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="inline-flex items-center justify-center w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? 'Subscribing…' : 'Subscribe to Newsletter'}
      </button>
    </form>
  );
}
