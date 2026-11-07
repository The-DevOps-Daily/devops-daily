'use client';

import { useEffect, useState } from 'react';
import { FileText, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Bottom bar on small screens: the sign-up form sits at the end of a long page,
 * so keep it and the sample one tap away. It shows once the hero buttons scroll
 * out of view and hides again when the sign-up section comes into view.
 */
export function LaunchBar({ samplePdf }: { samplePdf: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('hero-actions');
    const signup = document.getElementById('early-access');
    if (!hero || !signup) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const pastHero = hero.getBoundingClientRect().bottom < 0;
      const beforeSignup = signup.getBoundingClientRect().top > window.innerHeight;
      setVisible(pastHero && beforeSignup);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      inert={!visible}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform duration-200 supports-[backdrop-filter]:bg-background/80 motion-reduce:transition-none lg:hidden',
        visible ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <div className="mx-auto grid max-w-screen-sm grid-cols-[auto_1fr] gap-2 px-3 py-2.5">
        <a
          href={samplePdf}
          target="_blank"
          rel="noopener"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:border-primary/50"
        >
          <FileText className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          Free sample
        </a>
        <a
          href="#early-access"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Mail className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          Notify me at launch
        </a>
      </div>
    </div>
  );
}
