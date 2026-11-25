import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Clock, Sparkles, ExternalLink } from 'lucide-react';
import { CarbonAds } from '@/components/carbon-ads';
import { sponsorGoKey, sponsorHref, sponsorRel, visibleSponsors } from '@/lib/sponsors';
import { NewsletterForm } from '@/components/footer/newsletter-form';
import { SponsorLogo } from '@/components/sponsor-logo';

interface SponsorSidebarProps {
  className?: string;
  /** Breakpoint where the sidebar sits beside the content and sticks; null never sticks. */
  stickFrom?: 'lg' | 'xl' | null;
  relatedPosts?: Array<{
    title: string;
    slug: string;
    readingTime?: string;
  }>;
}

// The column sticks just below the header (it moves up when a headroom header
// hides) and scrolls on its own when it is taller than the screen, so the
// newsletter button and related posts stay reachable. The bottom padding lets
// its end scroll clear of the fixed back-to-top button.
const stickyColumn = {
  lg: 'lg:sticky lg:top-[calc(var(--site-header-h,5rem)+1rem)] lg:max-h-[calc(100dvh-var(--site-header-h,5rem)-2rem)] lg:overflow-y-auto lg:pb-16',
  xl: 'xl:sticky xl:top-[calc(var(--site-header-h,5rem)+1rem)] xl:max-h-[calc(100dvh-var(--site-header-h,5rem)-2rem)] xl:overflow-y-auto xl:pb-16',
};

export function SponsorSidebar({
  className,
  stickFrom = 'lg',
  relatedPosts = [],
}: SponsorSidebarProps) {
  return (
    <div
      className={cn(
        'space-y-5',
        stickFrom &&
          cn(
            stickyColumn[stickFrom],
            'transition-[top,max-height] duration-200 motion-reduce:transition-none [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.35)_transparent]'
          ),
        className
      )}
    >
      {/* Carbon Ads sits first: the sponsor list below it grows every time a
          sponsor is added, and at four sponsors the ad had been pushed off the
          bottom of a laptop screen entirely. */}
      <CarbonAds />

      {/* Sponsors Section */}
      <div className="relative">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-linear-to-r from-primary/5 to-transparent rounded-xl blur-xl" />

        <div className="relative rounded-xl border border-border/50 overflow-hidden backdrop-blur-sm bg-card/50">
          {/* Header with gradient */}
          <div className="relative bg-linear-to-r from-primary/10 to-primary/5 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Our Sponsors</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              The companies that keep DevOps Daily free. Some links are referral links.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px border-y border-border/40 bg-border/40">
            {visibleSponsors.map((sponsor) => (
              <Link
                key={sponsor.name}
                href={sponsorHref(sponsor, 'sidebar')}
                target="_blank"
                rel={sponsorRel(sponsor)}
                data-go={sponsorGoKey(sponsor, 'sidebar')}
                title={sponsor.tagline ? `${sponsor.name} — ${sponsor.tagline}` : sponsor.name}
                className={cn(
                  // An odd last tile spans both columns, so the grid has no empty cell.
                  // Top-aligned, so a tagline that wraps on a narrow column keeps the logos in line.
                  'group relative isolate flex h-[4.75rem] min-w-0 flex-col items-center justify-start gap-1 bg-card/90 px-2 pt-[0.9rem] transition-all last:odd:col-span-2',
                  sponsor.featured
                    ? 'bg-linear-to-b from-[#2c70ff]/[0.08] to-card/90 shadow-[inset_0_2px_0_rgba(44,112,255,0.55)] hover:from-[#2c70ff]/[0.12]'
                    : 'hover:bg-muted/70'
                )}
              >
                <div className="flex w-full min-w-0 items-center justify-center">
                  <SponsorLogo
                    sponsor={sponsor}
                    width={120}
                    height={40}
                    className={cn(
                      'h-8 w-full max-w-28 object-contain opacity-90 transition-opacity group-hover:opacity-100',
                      sponsor.sidebarClassName
                    )}
                  />
                </div>
                {sponsor.shortTagline && (
                  <span className="text-center text-[10.5px] leading-[1.15] text-muted-foreground">
                    {sponsor.shortTagline}
                  </span>
                )}

                {/* External link indicator */}
                <ExternalLink className="absolute right-1.5 top-1.5 h-3 w-3 text-muted-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </Link>
            ))}
          </div>

          {/* Optional CTA */}
          <div className="px-3 py-2.5">
            <a
              href="/sponsorship"
              className="block text-center text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Become a sponsor →
            </a>
          </div>
        </div>
      </div>

      {/* Newsletter Subscription Section */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <h3 className="font-semibold text-sm mb-2">Stay Updated</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Get the latest DevOps tips and tutorials delivered to your inbox.
        </p>
        <NewsletterForm bare source="sponsor_sidebar" />
      </div>

      {/* Related Posts Section */}
      {relatedPosts.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <div className="bg-muted/50 px-4 py-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="text-primary">●</span>
              Related Posts
            </h3>
          </div>

          <div className="p-2">
            {relatedPosts.map((post, index) => (
              <Link
                key={post.slug}
                href={`/posts/${post.slug}`}
                className="group block p-3 rounded-lg hover:bg-muted transition-all duration-200"
              >
                <h4 className="font-medium line-clamp-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h4>
                {post.readingTime && (
                  <div className="flex items-center text-sm text-muted-foreground mt-1.5">
                    <Clock className="mr-1.5 h-3 w-3" />
                    <span>{post.readingTime}</span>
                  </div>
                )}
                {index < relatedPosts.length - 1 && (
                  <div className="mt-3 border-b border-border/50" />
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
