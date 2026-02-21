'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Sparkles, ExternalLink, Heart } from 'lucide-react';
import { sponsors } from '@/lib/sponsors';

interface InlineSponsorsProps {
  className?: string;
  variant?: 'compact' | 'full' | 'banner';
  showCTA?: boolean;
}

export function InlineSponsors({ className, variant = 'full', showCTA = true }: InlineSponsorsProps) {
  if (variant === 'banner') {
    return (
      <div className={cn('my-12', className)}>
        <div className="relative rounded-2xl border border-border/50 overflow-hidden bg-linear-to-br from-primary/5 via-background to-primary/5">
          {/* Decorative elements */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative px-6 py-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Heart className="h-4 w-4 text-primary fill-primary animate-pulse" />
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
               Sponsored by
             </span>
             <Heart className="h-4 w-4 text-primary fill-primary animate-pulse" />
           </div>
            <p className="text-xs text-muted-foreground text-center mb-4">
              We earn commissions when you shop through the links below.
            </p>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {sponsors.map((sponsor) => (
                <Link
                  key={sponsor.name}
                  href={sponsor.url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="group relative flex items-center gap-4 p-4 bg-background/80 backdrop-blur-sm rounded-xl border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1"
                >
                  {/* External link indicator */}
                  <ExternalLink className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Logo */}
                  <div className="shrink-0 h-16 w-24 flex items-center justify-center">
                    <Image
                      src={sponsor.logo || '/placeholder.svg'}
                      alt={sponsor.name}
                      width={120}
                      height={60}
                      className={cn('h-auto w-auto max-h-16', sponsor.className)}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {sponsor.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{sponsor.tagline}</p>
                  </div>
                </Link>
              ))}
            </div>

            {showCTA && (
              <div className="text-center mt-6">
                <Link
                  href="/sponsorship"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Interested in sponsoring? Learn more</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
  return (
    <div className={cn('my-8', className)}>
      <div className="rounded-xl border border-border/50 bg-muted/30 p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Our Sponsors
          </span>
        </div>
         <p className="text-xs text-muted-foreground text-center mb-4">
           We earn commissions when you shop through the links below.
         </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
           {sponsors.map((sponsor) => (
             <Link
               key={sponsor.name}
               href={sponsor.url}
               target="_blank"
               rel="noopener noreferrer sponsored"
               className="group relative inline-flex items-center justify-center px-6 py-3 bg-background rounded-lg border border-border hover:border-primary/50 transition-all duration-200 hover:shadow-md min-w-[180px]"
               title={sponsor.tagline}
             >
               {/* External link indicator positioned absolutely */}
               <ExternalLink className="absolute top-2 right-2 h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

               <Image
                 src={sponsor.logo || '/placeholder.svg'}
                 alt={sponsor.name}
                 width={120}
                 height={60}
                 className={cn('h-auto w-auto max-h-12', sponsor.className)}
               />
             </Link>
           ))}
         </div>

          {showCTA && (
            <div className="mt-4 pt-4 border-t border-border/50 text-center">
              <Link
                href="/sponsorship"
                className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
              >
                <span>Become a sponsor</span>
                <span>→</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full variant (default)
  return (
    <div className={cn('my-12', className)}>
      <div className="relative rounded-2xl border border-border/50 overflow-hidden bg-linear-to-br from-background to-muted/30">
        {/* Decorative background */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-blue-500/5" />

        <div className="relative p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Proudly Sponsored By</span>
           </div>
           <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
              We earn commissions when you shop through the links below.
           </p>
          </div>

          {/* Sponsors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {sponsors.map((sponsor) => (
              <Link
                key={sponsor.name}
                href={sponsor.url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="group relative"
              >
                <div className="relative h-full p-6 rounded-xl border border-border bg-background hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1">
                  {/* Hover gradient overlay */}
                  <div className="absolute inset-0 rounded-xl bg-linear-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* External link indicator */}
                  <ExternalLink className="absolute top-4 right-4 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Content */}
                  <div className="relative space-y-4">
                    {/* Logo */}
                    <div className="h-16 flex items-center">
                      <Image
                        src={sponsor.logo || '/placeholder.svg'}
                        alt={sponsor.name}
                        width={120}
                        height={60}
                        className={cn('h-auto w-auto max-h-16', sponsor.className)}
                      />
                    </div>

                    {/* Details */}
                    <div>
                      <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                        {sponsor.name}
                      </h3>
                      <p className="text-sm text-primary/80 font-medium mb-2">{sponsor.tagline}</p>
                      {sponsor.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {sponsor.description}
                        </p>
                      )}
                    </div>

                    {/* CTA */}
                    <div className="pt-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                        Learn more
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Footer CTA */}
          {showCTA && (
            <div className="text-center mt-8 pt-6 border-t border-border/50">
              <p className="text-sm text-muted-foreground mb-3">
                Want to support DevOps Daily and reach thousands of developers?
              </p>
              <Link
                href="/sponsorship"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary/10 border border-primary/20 text-primary rounded-lg font-medium hover:bg-primary/20 hover:border-primary/30 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                <span>Become a Sponsor</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
