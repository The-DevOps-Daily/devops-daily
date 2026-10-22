import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LOGO_MARK } from '@/lib/logo-mark';

interface LogoProps {
  className?: string;
  size?: number | string;
  href?: string;
  showText?: boolean;
  textClassName?: string;
}

// The hover and focus animation lives in app/globals.css (.site-logo).
export function Logo({ className, size = 40, href, showText = false, textClassName }: LogoProps) {
  const box = typeof size === 'number' ? `${size}px` : size;
  const { square } = LOGO_MARK;

  const logo = (
    <div className={cn('flex items-center', className)}>
      {/* `size` is the height of the logo row; the square takes 70% of it so it
          sits in proportion to the wordmark. */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={LOGO_MARK.viewBox}
        style={{ width: `calc(${box} * 0.7)`, height: box }}
        className="shrink-0 text-primary"
        aria-hidden={showText ? true : undefined}
        role={showText ? undefined : 'img'}
        aria-label={showText ? undefined : 'DevOps Daily'}
      >
        <rect
          x={square.x}
          y={square.y}
          width={square.size}
          height={square.size}
          rx={square.radius}
          strokeWidth={1}
          className="fill-zinc-950 stroke-zinc-950 dark:fill-zinc-900 dark:stroke-zinc-700"
        />
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={LOGO_MARK.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path className="site-logo-chevron" d={LOGO_MARK.chevron} />
          <path className="site-logo-cursor" d={LOGO_MARK.cursor} />
        </g>
      </svg>

      {showText && (
        <span className={cn('ml-2.5 text-xl font-bold', textClassName)}>DevOps Daily</span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="site-logo block">
        {logo}
      </Link>
    );
  }

  return logo;
}
