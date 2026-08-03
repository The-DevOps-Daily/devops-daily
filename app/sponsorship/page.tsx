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
  Eye,
  Code2,
  Boxes,
  ShieldCheck,
  Server,
  Cloud,
  UserRound,
  PenLine,
  Globe,
  Link2,
  Search,
  Scale,
  Heart,
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
  { value: '23.7M', label: 'Syndicated impressions', detail: 'daily.dev, 45 days to 2 Aug 2026', icon: Eye },
  { value: '20,000+', label: 'Monthly readers', detail: 'devops-daily.com', icon: Users },
  { value: '1,500', label: 'Newsletter subscribers', detail: 'weekly, every Monday', icon: Mail },
  { value: '600+', label: 'Content pieces', detail: 'posts, guides, labs', icon: TrendingUp },
];

/** Roles from the reader survey, with an icon each for the audience row. */
const AUDIENCE_ICONS: Record<string, typeof Code2> = {
  'DevOps / Platform engineers': Code2,
  'Site reliability engineers (SRE)': ShieldCheck,
  'Cloud / infra architects': Cloud,
  'Backend / fullstack engineers': Server,
  'Engineering managers / leadership': UserRound,
};

/** The path a sponsored piece travels, which is the product being sold. */
const DISTRIBUTION = [
  { label: 'We write the technical piece', icon: PenLine },
  { label: 'Published on DevOps Daily', icon: Globe },
  { label: 'Amplified on daily.dev', icon: Link2 },
  { label: 'Featured in the newsletter', icon: Mail },
  { label: 'Indexed by search engines', icon: Search },
];

const WHAT_WE_CREATE = [
  {
    title: 'Technical tutorials',
    description:
      'Hands-on guides that solve a real problem, with your product used the way someone actually would.',
    icon: BookOpen,
  },
  {
    title: 'Comparison pages',
    description:
      'Side-by-side evaluations that catch people mid-decision. The highest-intent traffic we have.',
    icon: Scale,
  },
  {
    title: 'Interactive simulators',
    description:
      'Browser simulators that teach a primitive by making the reader operate it. Your product taught, not advertised.',
    icon: Gamepad2,
  },
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
      'Priority response over email',
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
        {/* Hero. The rocket is decorative line art, drawn inline rather than
            shipped as an asset so it inherits the accent colour and stays
            crisp at any size. aria-hidden: it carries no meaning. */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-8 sm:p-10">
          <svg
            aria-hidden="true"
            viewBox="0 0 300 300"
            className="pointer-events-none absolute -right-8 bottom-0 hidden h-full w-auto text-primary lg:block"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <g className="text-primary/70" transform="rotate(35 172 120)">
              <path d="M172 36C192 58 204 90 204 124c0 22-4 40-10 54h-44c-6-14-10-32-10-54 0-34 12-66 32-88z" />
              <circle cx="172" cy="106" r="15" />
              <path d="M140 132c-18 10-30 30-32 52 12-2 26-10 35-20" />
              <path d="M204 132c18 10 30 30 32 52-12-2-26-10-35-20" />
              <path d="M152 178h40l-6 20h-28z" />
              <path d="M160 206l-12 38" />
              <path d="M172 208l-4 42" />
              <path d="M184 206l10 38" />
            </g>
            <g className="text-primary/50">
              <path d="M96 288c-18 0-24-20-10-30-4-20 18-34 34-24 8-20 38-24 50-4 18-8 38 6 34 26 16 4 16 32-2 32z" />
              <path d="M18 296c-12 0-16-14-7-21-3-14 12-24 23-17 6-14 26-16 34-3z" />
            </g>
          </svg>

          <div className="relative">
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-primary">
              Media kit 2026
            </span>
          </div>

          <h1 className="relative mt-8 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:max-w-[62%]">
            Reach the DevOps audience that{' '}
            <span className="text-primary">drives decisions</span>
          </h1>

          <p className="relative mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            DevOps Daily is where developers, platform engineers, SREs and technical leaders go
            while they are deciding what to build with.
          </p>

          <div className="relative mt-7 flex flex-wrap gap-3">
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
                <stat.icon className="h-6 w-6 text-primary" />
                <div className="mt-4 text-3xl font-bold leading-none tracking-tight">
                  {stat.value}
                </div>
                <div className="mt-3 text-sm font-medium">{stat.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Audience */}
        <div className="mt-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-5 font-mono text-[11px] uppercase tracking-[0.15em] text-primary">
              Who we reach
            </h2>
            <div className="grid grid-cols-2 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
              {AUDIENCE.map((role) => {
                const Icon = AUDIENCE_ICONS[role.label] ?? Code2;
                return (
                  <div
                    key={role.label}
                    className="flex flex-col items-center px-2 text-center lg:border-r lg:border-border lg:last:border-r-0"
                  >
                    <Icon className="h-6 w-6 text-primary" />
                    {/* flex-1 keeps the percentages on one line when a role label wraps */}
                    <span className="mt-3 flex-1 text-xs leading-snug">{role.label}</span>
                    <span className="mt-1.5 font-mono text-sm font-semibold text-primary">
                      {role.share}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
              From our reader survey. An engaged technical audience actively evaluating tools.
            </p>
          </div>

          {/* Distribution, as the chain it actually is. */}
          <div className="mt-6 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-5 font-mono text-[11px] uppercase tracking-[0.15em] text-primary">
              How your content gets distributed
            </h2>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {DISTRIBUTION.map((step, i) => (
                <div key={step.label} className="relative">
                  <div className="flex h-full flex-col items-center rounded-lg border border-border bg-background p-4 text-center">
                    <step.icon className="h-5 w-5 text-primary" />
                    <span className="mt-3 text-xs leading-snug">{step.label}</span>
                  </div>
                  {i < DISTRIBUTION.length - 1 && (
                    <ArrowRight
                      aria-hidden="true"
                      className="absolute -right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-primary/50 lg:block"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 p-3">
                <Users className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-xs">Developers discover your product</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 p-3">
                <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-xs">Evergreen traffic keeps compounding</span>
              </div>
            </div>
          </div>
        </div>

        {/* What we create */}
        <div className="mt-6">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-primary">
            What we create
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {WHAT_WE_CREATE.map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-card p-6">
                <item.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 text-sm font-semibold text-primary">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
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

        {/* The positioning statement, given its own bar so it lands. */}
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center sm:flex-row sm:justify-center sm:gap-6 sm:text-left">
          <div className="flex items-center gap-2.5">
            <Heart className="h-4 w-4 shrink-0 fill-primary text-primary" />
            <span className="text-sm font-semibold">We don&apos;t sell ads.</span>
          </div>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <span className="text-sm text-muted-foreground">
            We write technical content <span className="text-primary">developers want to read.</span>
          </span>
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
