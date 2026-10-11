import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SectionHeader } from '@/components/section-header';
import { SponsorLogo } from '@/components/sponsor-logo';
import { getSponsors, sponsorHistory, sponsorHref, type Sponsor } from '@/lib/sponsors';
import { cn } from '@/lib/utils';

// The sidebar logos are sized for a narrow column; use the wordmarks from the
// sponsorship page where we have them so the row reads at the same size.
function wordmark(sponsor: Sponsor): Sponsor {
  const brand = sponsorHistory.find((b) => b.name === sponsor.name);
  if (!brand) return { ...sponsor, className: 'h-[30px]' };
  return { ...sponsor, logo: brand.logo, darkLogo: brand.darkLogo, className: brand.className };
}

export function HomeSponsors({ className }: { className?: string }) {
  const sponsors = getSponsors().map(wordmark);

  return (
    <section className={cn('my-16', className)} aria-label="Sponsors">
      <SectionHeader
        label="sponsors"
        title="Supported by"
        description="DevOps Daily stays free because these companies sponsor it."
        viewAllHref="/sponsorship"
        viewAllLabel="Become a sponsor"
      />
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {sponsors.map((sponsor) => (
          <li key={sponsor.name} className="bg-card">
            <a
              href={sponsorHref(sponsor, 'home')}
              target="_blank"
              rel="noopener noreferrer sponsored"
              title={sponsor.tagline ? `${sponsor.name}: ${sponsor.tagline}` : sponsor.name}
              aria-label={sponsor.name}
              className="flex h-20 items-center justify-center px-5 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <SponsorLogo
                sponsor={sponsor}
                width={160}
                height={40}
                className="w-auto max-w-full object-contain"
              />
            </a>
          </li>
        ))}
      </ul>
      <Link
        href="/sponsorship"
        className="sm:hidden inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors mt-4"
      >
        Become a sponsor
        <ArrowRight className="w-4 h-4" />
      </Link>
    </section>
  );
}
