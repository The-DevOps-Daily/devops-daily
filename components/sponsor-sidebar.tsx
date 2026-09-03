import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Clock, Sparkles, ExternalLink } from 'lucide-react';
import { CarbonAds } from '@/components/carbon-ads';
import { sponsors } from '@/lib/sponsors';
import { NewsletterForm } from '@/components/footer/newsletter-form';
import { SponsorLogo } from '@/components/sponsor-logo';

interface SponsorSidebarProps {
  className?: string;
  relatedPosts?: Array<{
    title: string;
    slug: string;
    readingTime?: string;
  }>;
}

export function SponsorSidebar({ className, relatedPosts = [] }: SponsorSidebarProps) {
  return (
    <div className={cn('sticky top-8 space-y-5', className)}>
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
            <p className="text-[10px] text-muted-foreground mt-0.5">
              We earn commissions when you shop through the links below.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px border-y border-border/40 bg-border/40">
            {sponsors.map((sponsor) => (
              <Link
                key={sponsor.name}
                href={sponsor.url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                title={sponsor.tagline ? `${sponsor.name} — ${sponsor.tagline}` : sponsor.name}
                className={cn(
                  'group relative isolate flex h-16 min-w-0 items-center justify-center bg-card/90 px-3 transition-all',
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
