import { Button } from '@/components/ui/button';
import {
  Target,
  TrendingUp,
  Award,
  CheckCircle2,
  Mail,
  BarChart,
  Users,
  Newspaper,
  Gamepad2,
  BookOpen,
  Rocket,
  ArrowRight,
} from 'lucide-react';
import { SectionHeader } from '@/components/section-header';
import { SectionSeparator } from '@/components/section-separator';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { sponsors } from '@/lib/sponsors';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sponsorship - Reach 20,000+ DevOps Engineers',
  description:
    'Partner with DevOps Daily to reach 20,000+ monthly readers, 1,500 newsletter subscribers, and 23.7M syndicated impressions across an audience of DevOps engineers, SREs, and technical decision-makers.',
  alternates: {
    canonical: '/sponsorship',
  },
  openGraph: {
    title: 'Sponsor DevOps Daily - Reach 20,000+ DevOps Engineers',
    description:
      'Partner with DevOps Daily to connect with 20,000+ DevOps engineers, SREs, and technical decision-makers monthly.',
    url: '/sponsorship',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Daily Sponsorship',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sponsor DevOps Daily - Reach 20,000+ DevOps Engineers',
    description:
      'Partner with DevOps Daily to reach 20,000+ DevOps engineers, SREs, and technical decision-makers monthly.',
    images: ['/og-image.png'],
  },
};

// Figures a sponsor could ask us to back up, so each one names what it
// measures and over what window. Syndicated reach is listed separately from
// owned audience on purpose: rolling them into one number reads better and
// falls apart the moment someone asks which is which.
const STATS = [
  { value: '23.7M', label: 'Syndicated impressions', detail: 'daily.dev, 45 days to 2 Aug 2026' },
  { value: '20,000+', label: 'Monthly readers', detail: 'devops-daily.com' },
  { value: '1,500', label: 'Newsletter subscribers', detail: 'weekly, every Monday' },
  { value: '600+', label: 'Content pieces', detail: 'posts, guides, labs' },
];

const AUDIENCE = [
  { label: 'DevOps / Platform engineers', share: '42%' },
  { label: 'Site reliability engineers (SRE)', share: '18%' },
  { label: 'Cloud / infra architects', share: '14%' },
  { label: 'Backend / fullstack engineers', share: '16%' },
  { label: 'Engineering managers / leadership', share: '10%' },
];

const CHANNELS = [
  {
    title: 'Weekly Newsletter',
    description:
      '1,500 engineers get a curated DevOps digest every Monday. Sponsored slot with copy you control.',
    icon: Newspaper,
    metric: '45%+ open rate',
  },
  {
    title: 'Interactive Simulators',
    description:
      '30+ simulators pulling 10k+ sessions/month. Inline sponsor mention on the most popular ones.',
    icon: Gamepad2,
    metric: '10k+ sessions/mo',
  },
  {
    title: 'Long-form Guides & Posts',
    description:
      '550+ indexed articles drawing AI-search and SEO traffic from engineers actively solving problems.',
    icon: BookOpen,
    metric: '500k+ pageviews/yr',
  },
  {
    title: 'Roadmap & Toolbox',
    description:
      'Career roadmap and curated tool directory reached by engineers evaluating stacks and skills.',
    icon: Target,
    metric: 'Evergreen traffic',
  },
];

const WHY = [
  {
    title: 'Engineers who decide',
    description:
      '65% of our audience influences tooling, vendor, or platform purchase decisions at their org.',
    icon: TrendingUp,
  },
  {
    title: 'Trust, not ads',
    description:
      'Your brand appears inside practical tutorials and interactive learning, not as a banner. Credibility transfers.',
    icon: Award,
  },
  {
    title: 'Focused, not fragmented',
    description:
      'No generic reach. Every visitor is here for DevOps, containers, cloud, CI/CD, SRE, or infra. Zero waste.',
    icon: Target,
  },
  {
    title: 'Measurable lift',
    description:
      'UTM tracking, click reports, share-of-voice against the relevant article, shared monthly with you.',
    icon: BarChart,
  },
];

const PACKAGES = [
  {
    name: 'Starter',
    price: '$500',
    cadence: '/month',
    description: 'Awareness across the site',
    features: [
      'Logo + tagline on all post pages',
      'One newsletter mention / month',
      'Social shoutout at start of sponsorship',
      'Monthly report (impressions, clicks)',
    ],
    popular: false,
  },
  {
    name: 'Professional',
    price: '$1,500',
    cadence: '/month',
    description: 'Our most popular — prominent reach',
    features: [
      'Everything in Starter',
      'Homepage + roadmap placement',
      'Dedicated newsletter slot (weekly)',
      'One sponsored tutorial or tool spotlight post',
      'Simulator/game inline mention on 3 pages',
      'Priority response + monthly call',
    ],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: '',
    description: 'Category ownership + custom content',
    features: [
      'Everything in Professional',
      'Exclusive category sponsorship (K8s, cloud, CI/CD)',
      'Custom content series (4+ pieces)',
      'Co-branded webinar or live workshop',
      'First look at new simulator slots',
      'Quarterly strategy session',
    ],
    popular: false,
  },
];

const FAQ = [
  {
    q: 'Who reads DevOps Daily?',
    a: 'Mostly practicing DevOps/Platform engineers, SREs, and cloud architects, 2+ years in. 85% are mid-to-staff level, 65% influence tooling decisions at their org.',
  },
  {
    q: 'Do you accept non-DevOps sponsors?',
    a: "Only if there's a clear fit with our audience (e.g. developer tools, cloud infra, observability, security). We don't run general tech or consumer ads.",
  },
  {
    q: "What kind of copy / creative do you need?",
    a: 'For newsletter: 1-2 short paragraphs + a CTA link. For site placements: logo + tagline. For sponsored posts: we can write it based on your brief, or you provide the draft and we edit for house voice.',
  },
  {
    q: 'Is there a minimum commitment?',
    a: 'Starter and Professional are month-to-month. Enterprise is typically quarterly. Cancel anytime with 30 days notice.',
  },
  {
    q: 'How do I start?',
    a: (
      <>
        Email{' '}
        <a
          href="mailto:info@devops-daily.com?subject=Sponsorship Inquiry"
          className="text-primary hover:underline"
        >
          info@devops-daily.com
        </a>{' '}
        with a sentence about your product and the audience you want to reach. We respond within
        24h and send a media kit + available slots.
      </>
    ),
  },
];

export default function SponsorshipPage() {
  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Sponsorship', url: '/sponsorship' },
  ];

  return (
    <>
      <BreadcrumbSchema items={breadcrumbItems} />

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="rounded-xl border border-border bg-card p-8 sm:p-10">
          <div className="flex items-start justify-between gap-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-primary">
              Media kit 2026
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">devops-daily.com</span>
          </div>

          <h1 className="mt-8 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Reach the DevOps audience that{' '}
            <span className="text-primary">drives decisions</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            DevOps Daily is where developers, platform engineers, SREs and technical leaders go
            while they are deciding what to build with.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild>
              <a href="mailto:sponsorship@devops-daily.com">
                <Mail className="mr-2 h-4 w-4" />
                sponsorship@devops-daily.com
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="#packages">
                See packages
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* Reach. Each figure names what it measures and over what window, so
            none of it falls apart when a sponsor asks what is behind it. */}
        <div className="mt-6">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-primary">
            Our reach
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-card p-5">
                <div className="text-3xl font-bold leading-none tracking-tight">{stat.value}</div>
                <div className="mt-3 text-sm font-medium">{stat.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Audience */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-5 font-mono text-[11px] uppercase tracking-[0.15em] text-primary">
              Who we reach
            </h2>
            <div className="space-y-3">
              {AUDIENCE.map((role) => (
                <div key={role.label}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-sm">{role.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">{role.share}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: role.share }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
              From our reader survey. Engineers who evaluate tools as part of the job.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-5 font-mono text-[11px] uppercase tracking-[0.15em] text-primary">
              How your content gets distributed
            </h2>
            <ol className="space-y-2.5">
              {[
                'We write the technical piece',
                'Published on DevOps Daily',
                'Amplified on daily.dev',
                'Featured in the weekly newsletter',
                'Indexed by search engines, compounding',
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-mono text-[10px] text-primary">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-snug">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
              We do not sell banner ads. We write technical content developers want to read.
            </p>
          </div>
        </div>

        {/* Why */}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {WHY.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-xl border border-border bg-card p-6">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Channels */}
        <div className="mt-6">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-primary">
            Where your brand appears
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {CHANNELS.map((channel) => {
              const Icon = channel.icon;
              return (
                <div key={channel.title} className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-start justify-between gap-4">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {channel.metric}
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">{channel.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {channel.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Packages */}
        <div id="packages" className="mt-6 scroll-mt-24">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-primary">
            Packages
          </h2>
          <div className="grid gap-3 lg:grid-cols-3">
            {PACKAGES.map((pkg) => (
              <div
                key={pkg.name}
                className={
                  pkg.popular
                    ? 'rounded-xl border border-primary/40 bg-primary/5 p-6'
                    : 'rounded-xl border border-border bg-card p-6'
                }
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{pkg.name}</h3>
                  {pkg.popular && (
                    <span className="rounded-full border border-primary/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-primary">
                      Most picked
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight">{pkg.price}</span>
                  <span className="text-sm text-muted-foreground">{pkg.cadence}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{pkg.description}</p>
                <ul className="mt-5 space-y-2 border-t border-border pt-5">
                  {pkg.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="leading-snug text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Custom packages available. Tell us what you are launching and we will work out what fits.
          </p>
        </div>

        {/* Current sponsors */}
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.15em] text-primary">
            Current sponsors
          </h2>
          <div className="flex flex-wrap items-center gap-6">
            {sponsors.map((sponsor) => (
              <span key={sponsor.name} className="text-sm font-medium text-muted-foreground">
                {sponsor.name}
              </span>
            ))}
          </div>
        </div>

        <SectionSeparator command="cat /sponsorship/faq.md" />

        {/* FAQ */}
        <div className="mt-6">
          <SectionHeader label="faq" title="Questions we get asked" />
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-sm font-semibold">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-8 text-center">
          <Rocket className="mx-auto h-6 w-6 text-primary" />
          <h2 className="mt-4 text-xl font-bold">Let us build something great together.</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Tell us what you are launching and who you need to reach. We reply within a day.
          </p>
          <Button asChild className="mt-6">
            <a href="mailto:sponsorship@devops-daily.com">
              <Mail className="mr-2 h-4 w-4" />
              sponsorship@devops-daily.com
            </a>
          </Button>
        </div>
      </div>
    </>
  );
}
