import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Sparkles, ExternalLink } from 'lucide-react';
import { CarbonAds } from '@/components/carbon-ads';
import { sponsors } from '@/lib/sponsors';

interface SponsorSidebarProps {
  className?: string;
}

export function SponsorSidebar({ className }: SponsorSidebarProps) {
  return (
    <div className={cn('sticky top-8 space-y-6', className)}>
      {/* Sponsors Section */}
      <div className="relative">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-linear-to-r from-primary/5 to-transparent rounded-xl blur-xl" />

        <div className="relative rounded-xl border border-border/50 overflow-hidden backdrop-blur-sm bg-card/50">
          {/* Header with gradient */}
         <div className="relative bg-linear-to-r from-primary/10 to-primary/5 px-4 py-3">
           <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold">Our Sponsors</span>
            </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              We earn commissions when you shop through the links below.
            </p>
         </div>

          <div className="p-4 space-y-3">
            {sponsors.map((sponsor) => (
              <Link
                key={sponsor.name}
                href={sponsor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex flex-col items-center p-5 bg-linear-to-b from-background to-muted/50 rounded-lg border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
              >
                {/* Subtle background pattern */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent rounded-lg" />
                </div>

                {/* External link indicator */}
                <ExternalLink className="absolute top-2 right-2 h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Logo */}
                <div className="relative z-10 h-12 flex items-center justify-center mb-3">
                  <Image
                    src={sponsor.logo || '/placeholder.svg'}
                    alt={sponsor.name}
                    width={120}
                    height={60}
                    className={cn('h-auto w-auto max-h-12', sponsor.className)}
                  />
                </div>

                {/* Sponsor info */}
                <div className="relative z-10 text-center">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {sponsor.name}
                  </p>
                  {sponsor.tagline && (
                    <p className="text-xs text-muted-foreground mt-1">{sponsor.tagline}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Optional CTA */}
          <div className="px-4 pb-4">
            <a
              href="/sponsorship"
              className="block text-center text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Become a sponsor →
            </a>
          </div>
        </div>
      </div>

      {/* Carbon Ads Section */}
      <CarbonAds />
      {/* Newsletter Subscription Section */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <h3 className="font-semibold text-sm mb-2">Stay Updated</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Get the latest DevOps tips and tutorials delivered to your inbox.
        </p>
        <form
          action="https://devops-daily.us2.list-manage.com/subscribe/post?u=d1128776b290ad8d08c02094f&amp;id=fd76a4e93f&amp;f_id=0022c6e1f0"
          method="post"
          target="_blank"
          noValidate
          className="space-y-3"
        >
          <input
            type="email"
            name="EMAIL"
            id="mce-EMAIL"
            required
            placeholder="you@example.com"
            className="w-full px-3 py-2 border border-border bg-background rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {/* Honeypot bot field */}
          <div style={{ position: 'absolute', left: '-5000px' }} aria-hidden="true">
            <input
              type="text"
              name="b_d1128776b290ad8d08c02094f_fd76a4e93f"
              tabIndex={-1}
              defaultValue=""
            />
          </div>

          <button
            type="submit"
            name="subscribe"
            className="inline-flex items-center justify-center w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Subscribe to Newsletter
          </button>
        </form>
      </div>
    </div>
  );
}
