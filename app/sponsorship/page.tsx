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
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sponsorship - Reach 25,000+ DevOps Engineers | DevOps Daily',
  description:
    'Partner with DevOps Daily to reach 25,000+ monthly readers, 5,000+ newsletter subscribers, and a highly engaged audience of DevOps engineers, SREs, and technical decision-makers.',
  alternates: {
    canonical: '/sponsorship',
  },
  openGraph: {
    title: 'Sponsor DevOps Daily - Reach 25,000+ DevOps Engineers',
    description:
      'Partner with DevOps Daily to connect with 25,000+ DevOps engineers, SREs, and technical decision-makers monthly.',
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
    title: 'Sponsor DevOps Daily - Reach 25,000+ DevOps Engineers',
    description:
      'Partner with DevOps Daily to reach 25,000+ DevOps engineers, SREs, and technical decision-makers monthly.',
    images: ['/og-image.png'],
  },
};

const STATS = [
  { value: '25,000+', label: 'Monthly readers', detail: 'organic + newsletter' },
  { value: '5,000+', label: 'Newsletter subs', detail: 'weekly digest' },
  { value: '600+', label: 'Content pieces', detail: 'posts, guides, labs' },
  { value: '85%', label: 'Senior engineers', detail: 'mid-to-staff level' },
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
      '5,000+ engineers get a curated DevOps digest every Monday. Sponsored slot with copy you control.',
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

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-[0.07] dark:opacity-[0.09]"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
          }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent" />

        <div className="container relative mx-auto px-4 py-16 md:py-20">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs font-mono text-muted-foreground mb-3">// sponsorship</p>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-primary/20 bg-primary/5 text-xs font-mono text-primary mb-6">
              <Rocket className="w-3.5 h-3.5" strokeWidth={1.5} />
              Limited slots available
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Reach{' '}
              <span className="text-primary relative inline-block">
                25,000+
                <svg
                  className="absolute -bottom-2 left-0 w-full h-3 text-primary/40"
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 9 Q25 2 50 8 Q75 1 100 7 Q125 2 150 9 Q175 4 198 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{' '}
              DevOps engineers
              <br />
              who decide what to buy.
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              DevOps Daily is where practicing platform engineers, SREs, and cloud architects come
              to learn by doing. Your product lives inside real tutorials and interactive labs, not
              next to cat videos.
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <a
                  href="mailto:info@devops-daily.com?subject=Sponsorship Inquiry"
                  className="group"
                >
                  <Mail className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  Get the media kit
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#packages">See packages</a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <SectionSeparator command="cat audience.csv" />

        {/* Stats */}
        <section className="my-12 max-w-5xl mx-auto">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border rounded-md overflow-hidden">
            {STATS.map((s) => (
              <div key={s.label} className="bg-card p-5">
                <dt className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                  {s.label}
                </dt>
                <dd className="text-2xl sm:text-3xl font-bold tabular-nums mt-1 text-foreground">
                  {s.value}
                </dd>
                <dd className="text-xs text-muted-foreground/80 mt-0.5 font-mono">{s.detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Audience breakdown */}
        <section className="my-12 max-w-3xl mx-auto">
          <SectionHeader
            label="audience"
            title="Who you're reaching"
            description="Breakdown of who visits, based on reader surveys and subscription sign-ups."
          />
          <ul className="space-y-2 font-mono text-sm">
            {AUDIENCE.map((a) => (
              <li
                key={a.label}
                className="flex items-center justify-between gap-4 rounded-md border bg-card px-4 py-3"
              >
                <span className="text-foreground">{a.label}</span>
                <span className="text-primary tabular-nums font-semibold">{a.share}</span>
              </li>
            ))}
          </ul>
        </section>

        <SectionSeparator command="ls /placement-channels" />

        {/* Channels */}
        <section className="my-12 max-w-5xl mx-auto">
          <SectionHeader
            label="channels"
            title="Where your brand shows up"
            description="Four distinct surfaces, each with its own audience and format."
          />
          <div className="grid gap-px sm:grid-cols-2 bg-border border rounded-md overflow-hidden">
            {CHANNELS.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.title} className="bg-card p-5">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="flex-shrink-0 w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h3 className="font-semibold">{c.title}</h3>
                        <span className="text-[11px] font-mono tabular-nums text-primary shrink-0">
                          {c.metric}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {c.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <SectionSeparator command="cat why-sponsor.md" />

        {/* Why Sponsor */}
        <section className="my-12 max-w-4xl mx-auto">
          <SectionHeader label="why sponsor" title="Why sponsor DevOps Daily" />
          <div className="grid gap-px sm:grid-cols-2 bg-border border rounded-md overflow-hidden">
            {WHY.map((w) => {
              const Icon = w.icon;
              return (
                <div key={w.title} className="bg-card p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{w.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {w.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <SectionSeparator command="ls /packages" />

        {/* Packages */}
        <section id="packages" className="my-12 max-w-5xl mx-auto scroll-mt-20">
          <SectionHeader
            label="packages"
            title="Sponsorship packages"
            description="Start with awareness, scale to category ownership. Cancel anytime."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PACKAGES.map((pkg) => (
              <div
                key={pkg.name}
                className={`relative rounded-md border bg-card p-6 flex flex-col ${
                  pkg.popular
                    ? 'border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20'
                    : 'border-border'
                }`}
              >
                {pkg.popular && (
                  <span className="absolute -top-2.5 right-4 px-2 py-0.5 text-[10px] font-mono tabular-nums uppercase tracking-wider text-primary bg-background border border-primary/40 rounded">
                    most popular
                  </span>
                )}
                <p className="text-xs font-mono text-muted-foreground mb-1">// {pkg.name.toLowerCase()}</p>
                <h3 className="text-xl font-bold mb-1">{pkg.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{pkg.description}</p>
                <div className="mb-5 font-mono tabular-nums">
                  <span className="text-3xl font-bold text-foreground">{pkg.price}</span>
                  {pkg.cadence && (
                    <span className="text-sm text-muted-foreground">{pkg.cadence}</span>
                  )}
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {pkg.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2
                        className="h-4 w-4 text-primary mt-0.5 shrink-0"
                        strokeWidth={1.5}
                      />
                      <span className="text-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant={pkg.popular ? 'default' : 'outline'}
                  className="w-full"
                >
                  <a
                    href={`mailto:info@devops-daily.com?subject=Sponsorship Inquiry - ${pkg.name}`}
                  >
                    {pkg.price === 'Custom' ? 'Get a quote' : `Start with ${pkg.name}`}
                  </a>
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-6 font-mono">
            All packages include monthly reporting with impressions, clicks, and top-referring content.
          </p>
        </section>

        <SectionSeparator command="cat faq.md" />

        {/* FAQ */}
        <section className="my-12 max-w-3xl mx-auto">
          <SectionHeader label="faq" title="Frequently asked" />
          <div className="space-y-3">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-md border bg-card p-5">
                <h3 className="font-semibold mb-2">{f.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="my-16 max-w-3xl mx-auto">
          <div className="rounded-md border bg-primary/5 p-8 text-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary" strokeWidth={1.5} />
              <p className="text-xs font-mono text-primary uppercase tracking-wider">
                Let&apos;s talk
              </p>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Ready to reach engineers who build?
            </h2>
            <p className="text-muted-foreground mb-6">
              Tell us about your product and who you want to reach. We respond within 24 hours with
              a media kit and available slots.
            </p>
            <Button asChild size="lg">
              <a
                href="mailto:info@devops-daily.com?subject=Sponsorship Inquiry"
                className="group"
              >
                <Mail className="mr-2 h-4 w-4" strokeWidth={1.5} />
                info@devops-daily.com
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
