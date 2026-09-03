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
      <div className="mx-auto max-w-6xl overflow-hidden rounded-lg border border-border/50 bg-muted/20">
        <div className="flex min-h-10 items-center justify-between gap-4 border-b border-border/40 px-4 py-2">
          <span className="text-sm font-semibold text-muted-foreground">Supported by</span>
          <Link
            href="/sponsorship"
            className="whitespace-nowrap text-xs text-muted-foreground transition-colors underline-offset-4 hover:text-foreground hover:underline sm:text-sm"
          >
            Become a sponsor
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-px bg-border/30 sm:grid-cols-3 lg:grid-cols-6">
          {sponsors.map((sponsor) => (
            <Link
              key={sponsor.name}
              href={sponsor.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              title={sponsor.tagline ? `${sponsor.name} — ${sponsor.tagline}` : sponsor.name}
              className="group flex h-14 min-w-0 items-center justify-center bg-background/60 px-3 transition-colors hover:bg-muted/60"
            >
              <SponsorLogo
                sponsor={sponsor}
                width={140}
                height={44}
                className="h-10 w-full max-w-36 object-contain opacity-90 transition-opacity group-hover:opacity-100"
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
