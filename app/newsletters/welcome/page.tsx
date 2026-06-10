import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WelcomeContent } from './_components/welcome-content';

export const metadata: Metadata = {
  title: "You're subscribed",
  description:
    "Welcome to the DevOps Daily newsletter. Here's what to expect, what every Monday issue looks like, and where to start while you wait for your first one.",
  alternates: { canonical: '/newsletters/welcome' },
  // No follow / no index — this is a transactional landing page reached
  // via the smtpfast confirmation + unsubscribe redirects. It must not
  // compete with /newsletters in search and must not be linked by
  // crawlers from the archive list.
  robots: { index: false, follow: false },
};

export default function NewsletterWelcomePage() {
  return (
    <div className="min-h-screen">
      <Suspense
        fallback={
          <div className="container mx-auto px-4 py-20 max-w-3xl text-center">
            <div className="h-12" />
          </div>
        }
      >
        <WelcomeContent />
      </Suspense>
    </div>
  );
}
