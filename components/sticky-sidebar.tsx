'use client';

import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useBidirectionalSticky } from '@/hooks/use-bidirectional-sticky';

// Top: 1rem below the header (it follows a headroom header as it hides). When
// the column is taller than the screen it may rise until its bottom is 5rem
// above the screen bottom, clear of the fixed back-to-top button.
const stickyColumn = {
  lg: 'lg:sticky lg:mt-[var(--sb-m,0px)] lg:top-[min(calc(var(--site-header-h,5rem)+1rem),calc(100dvh-5rem-var(--sb-h,0px)))] lg:data-[stick=up]:top-auto lg:data-[stick=up]:bottom-[calc(100dvh-var(--site-header-h,5rem)-1rem-var(--sb-h,0px))]',
  xl: 'xl:sticky xl:mt-[var(--sb-m,0px)] xl:top-[min(calc(var(--site-header-h,5rem)+1rem),calc(100dvh-5rem-var(--sb-h,0px)))] xl:data-[stick=up]:top-auto xl:data-[stick=up]:bottom-[calc(100dvh-var(--site-header-h,5rem)-1rem-var(--sb-h,0px))]',
};
const minWidth = { lg: '1024px', xl: '1280px' };

export function StickySidebar({
  from = 'lg',
  className,
  children,
}: {
  /** Breakpoint where the column sits beside the content and sticks. */
  from?: 'lg' | 'xl';
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useBidirectionalSticky(ref, minWidth[from]);
  return (
    <div
      ref={ref}
      className={cn(
        stickyColumn[from],
        'transition-[top,bottom] duration-200 motion-reduce:transition-none',
        className
      )}
    >
      {children}
    </div>
  );
}
