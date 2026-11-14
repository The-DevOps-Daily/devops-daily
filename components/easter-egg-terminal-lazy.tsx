'use client';

import { lazy, Suspense, useState } from 'react';
import { EasterEggTrigger } from '@/components/easter-egg-trigger';

// The terminal, its dialog and the confetti load on the first click.
const EasterEggTerminal = lazy(() =>
  import('@/components/easter-egg-terminal').then((m) => ({ default: m.EasterEggTerminal }))
);

export function LazyEasterEggTerminal({ variant = 'icon' }: { variant?: 'icon' | 'text' }) {
  const [opened, setOpened] = useState(false);
  const trigger = <EasterEggTrigger variant={variant} onClick={() => setOpened(true)} />;
  if (!opened) return trigger;
  return (
    <Suspense fallback={trigger}>
      <EasterEggTerminal variant={variant} defaultOpen />
    </Suspense>
  );
}
