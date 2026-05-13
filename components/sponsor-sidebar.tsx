import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Clock, Sparkles, ExternalLink } from 'lucide-react';
import { CarbonAds } from '@/components/carbon-ads';
import { sponsors } from '@/lib/sponsors';
import { NewsletterForm } from '@/components/footer/newsletter-form';

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
                className="group relative flex flex-col items-center p-5 bg-linear-to-b from-background to-muted/50 rounded-md border border-border hover:border-primary/40 hover:bg-muted/30 transition-colors"
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
                    className={cn('h-auto w-auto max-h-12', sponsor.className, sponsor.sidebarClassName)}
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
