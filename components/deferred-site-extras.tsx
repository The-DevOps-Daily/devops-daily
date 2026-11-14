'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const BookPromotionPopup = dynamic(
  () => import('@/components/book-promotion-popup').then((module) => module.BookPromotionPopup),
  { ssr: false }
);
const KonamiCodeListener = dynamic(
  () => import('@/components/konami-code-listener').then((module) => module.KonamiCodeListener),
  { ssr: false }
);
const KeyboardShortcuts = dynamic(
  () => import('@/components/keyboard-shortcuts').then((module) => module.KeyboardShortcuts),
  { ssr: false }
);
const BackToTop = dynamic(
  () => import('@/components/back-to-top').then((module) => module.BackToTop),
  { ssr: false }
);

// The book popup shows three minutes in. Its code (framer-motion, confetti)
// loads shortly before that instead of with the page.
const BOOK_POPUP_DELAY_MS = 180_000;
const BOOK_POPUP_PRELOAD_MS = 20_000;

function BookPromotionGate() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      if (
        localStorage.getItem('book-promo-dismissed') ||
        localStorage.getItem('book-promo-subscribed')
      )
        return;
    } catch {
      return;
    }
    const timer = window.setTimeout(
      () => setMounted(true),
      BOOK_POPUP_DELAY_MS - BOOK_POPUP_PRELOAD_MS
    );
    return () => window.clearTimeout(timer);
  }, []);

  return mounted ? <BookPromotionPopup delayMs={BOOK_POPUP_PRELOAD_MS} /> : null;
}

export function DeferredSiteExtras() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const callbackId = idleWindow.requestIdleCallback(() => setReady(true), { timeout: 1_500 });
      return () => idleWindow.cancelIdleCallback?.(callbackId);
    }

    const timeoutId = window.setTimeout(() => setReady(true), 1_000);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!ready) return null;

  return (
    <>
      <BookPromotionGate />
      <KonamiCodeListener />
      <KeyboardShortcuts />
      <BackToTop />
    </>
  );
}
