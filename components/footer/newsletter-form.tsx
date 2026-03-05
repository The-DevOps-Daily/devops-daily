'use client';

import { useState } from 'react';
import { Mail, ArrowRight, CheckCircle } from 'lucide-react';
import { useNewsletterSubscribe } from '@/hooks/use-newsletter-subscribe';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const { status, subscribe } = useNewsletterSubscribe();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) subscribe(email);
  };

  if (status === 'success') {
    return (
      <div className="p-6 bg-linear-to-br from-primary/5 to-purple-500/5 border border-primary/20 rounded-2xl shadow-lg flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
        <p className="text-sm font-medium text-foreground">
          You&apos;re subscribed! Check your inbox.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-linear-to-br from-primary/5 to-purple-500/5 border border-primary/20 rounded-2xl shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="w-5 h-5 text-primary" />
        <h4 className="font-bold text-foreground">Stay Updated</h4>
      </div>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Get the latest DevOps insights delivered to your inbox weekly.
      </p>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="your@email.com"
          className="w-full px-4 py-3 border border-border/50 bg-background/50 backdrop-blur-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300"
        />

        {status === 'error' && (
          <p className="text-xs text-red-500">Something went wrong. Please try again.</p>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="group inline-flex items-center justify-center w-full px-4 py-3 bg-linear-to-r from-primary to-purple-600 text-white rounded-xl text-sm font-bold hover:from-primary/90 hover:to-purple-600/90 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {status === 'loading' ? 'Subscribing…' : 'Subscribe Now'}
          {status !== 'loading' && (
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
          )}
        </button>
      </form>
    </div>
  );
}
