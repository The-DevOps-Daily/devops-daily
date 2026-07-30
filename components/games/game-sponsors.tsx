'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { sponsors } from '@/lib/sponsors';
import { SponsorLogo } from '@/components/sponsor-logo';

interface GameSponsorsProps {
  className?: string;
}

/**
 * Slim, inline sponsor bar for game/simulator pages.
 * Placed above the game component, full width, minimal design.
 */
export function GameSponsors({ className }: GameSponsorsProps) {
  return (
    <div className={cn('w-full mb-6', className)}>
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 py-4 px-6 rounded-lg border border-border/40 bg-muted/20">
        <span className="text-sm font-semibold text-muted-foreground">Supported by</span>
        {sponsors.map((sponsor) => (
          <Link
            key={sponsor.name}
            href={sponsor.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="group flex items-center gap-2 px-4 py-2 rounded-md hover:bg-muted/50 transition-all"
          >
            <SponsorLogo
              sponsor={sponsor}
              width={140}
              height={44}
              className="h-10 w-auto opacity-90 group-hover:opacity-100 transition-opacity"
            />
          </Link>
        ))}
        <span className="text-muted-foreground/40 hidden sm:inline">|</span>
        <Link
          href="/sponsorship"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
        >
          Become a sponsor
        </Link>
      </div>
    </div>
  );
}
