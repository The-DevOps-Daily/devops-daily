'use client';

import { useEffect, useRef } from 'react';
import type { AnimationItem } from 'lottie-web';

interface LottiePlayerProps {
  /** Public path to the animation JSON (see scripts/generate-lottie-animations.mjs). */
  path: string;
  loop?: boolean;
  className?: string;
  /** Accessible description; omit to mark the animation decorative. */
  ariaLabel?: string;
}

/**
 * Lazy Lottie wrapper: the player (lottie_light, SVG renderer only) loads via
 * dynamic import on mount, so pages without animations pay nothing. Under
 * prefers-reduced-motion the animation renders parked on its final frame
 * instead of playing.
 */
export function LottiePlayer({ path, loop = true, className, ariaLabel }: LottiePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let anim: AnimationItem | undefined;
    let cancelled = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    import('lottie-web/build/player/lottie_light').then((mod) => {
      if (cancelled) return;
      anim = mod.default.loadAnimation({
        container,
        renderer: 'svg',
        loop: !reducedMotion && loop,
        autoplay: !reducedMotion,
        path,
      });
      if (reducedMotion) {
        anim.addEventListener('DOMLoaded', () => {
          anim?.goToAndStop(Math.max(anim.totalFrames - 1, 0), true);
        });
      }
    });

    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [path, loop]);

  return (
    <div
      ref={containerRef}
      className={className}
      role={ariaLabel ? 'img' : 'presentation'}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    />
  );
}
