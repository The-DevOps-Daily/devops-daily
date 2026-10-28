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
  Heart,
  Bot,
} from 'lucide-react';
import { SectionHeader } from '@/components/section-header';
import { SectionSeparator } from '@/components/section-separator';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { SponsorLogo } from '@/components/sponsor-logo';
import { sponsorHistory, sponsorHref, sponsorRel } from '@/lib/sponsors';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sponsorship - Reach 550,000+ Monthly Page Views',
  description:
    'Partner with DevOps Daily to reach 550,000+ monthly page views, 1,500 newsletter subscribers, and an audience of DevOps engineers, SREs, and technical decision-makers.',
  alternates: {
    canonical: '/sponsorship',
  },
  openGraph: {
    title: 'Sponsor DevOps Daily - Reach 550,000+ Monthly Page Views',
    description:
      'Partner with DevOps Daily to connect with DevOps engineers, SREs, and technical decision-makers.',
    url: '/sponsorship',
    type: 'website',
    images: [
      {
        url: '/images/pages/sponsorship.jpg',
        width: 1200,
        height: 630,
        alt: 'DevOps Daily Sponsorship',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sponsor DevOps Daily - Reach 550,000+ Monthly Page Views',
    description:
      'Partner with DevOps Daily to reach DevOps engineers, SREs, and technical decision-makers.',
    images: ['/images/pages/sponsorship.jpg'],
  },
};

const STATS = [
  { value: '24M', label: 'Syndicated impressions', detail: 'daily.dev, 45 days' },
  { value: '550,000+', label: 'Monthly page views', detail: 'browser traffic, bots excluded' },
  { value: '1,500', label: 'Newsletter subs', detail: 'weekly digest' },
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
    metric: '6.6M+ pageviews/yr',
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
    title: 'Read by AI assistants',
    description:
      'ChatGPT, Claude, Perplexity and other AI assistants read our posts every day. Sponsored pieces get the same reach, and your report shows how often AI crawlers read each page we wrote for you.',
    icon: Bot,
  },
  {
    title: 'Measurable lift',
    description:
      'A private live report, updated every day: clicks, logo impressions, page views and newsletter numbers.',
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
      'Logo + tagline in the GitHub README (1k+ stars)',
      'One newsletter mention / month',
      'Social shoutout at start of sponsorship',
      'Live report (impressions, clicks), updated daily',
    ],
    popular: false,
  },
  {
    name: 'Professional',
    price: '$1,500',
    cadence: '/month',
    description: 'Our most popular: prominent reach',
    features: [
      'Everything in Starter',
      'Featured slot at the top of the GitHub README',
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
      'Quarterly performance summary',
    ],
    popular: false,
  },
];

const STEPS = [
  {
    title: 'Pick a package',
    description: 'Tell us about your product and who you want to reach. We suggest the package and the content that fit.',
  },
  {
    title: 'Check your kickoff page',
    description:
      'One private page with everything we need, already filled in from your website. It takes about 3 minutes.',
  },
  {
    title: 'Review before it goes live',
    description:
      'Every article, comparison and newsletter feature goes to you on a preview link first. Measured posts include the method and the raw results.',
  },
  {
    title: 'Watch the numbers',
    description: 'Your live report starts on day one and updates every day, for as long as the content keeps working.',
  },
];

const REPORT_POINTS = [
  'Clicks per placement and per day',
  'Logo impressions that were on screen for at least 1 second, and the click rate',
  'Page views and readers on the pages we write for you',
  'Newsletter recipients, opens and clicks for every issue',
  'AI crawler requests on your pages: how often AI assistants read them',
  'No cookies and no stored IP addresses',
];

const FAQ = [
  {
    q: 'How do you count page views?',
    a: 'From Cloudflare, at the edge, which counts visitors an on-page script never sees because they block trackers. We count only requests that returned an HTML page, so assets and API calls are out, and we exclude declared crawlers and any request claiming a browser version nobody runs any more. The figure above is what is left. It is page views, not people; ask and we will send the daily breakdown behind it.',
  },
  {
    q: 'Will our content show up in AI answers?',
    a: 'Nobody can promise a spot in an AI answer. What we do: write pages AI assistants like to cite (clear structure, measured numbers, sources), and show you how often their crawlers read each one.',
  },
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
    a: 'Very little. Your logo (SVG), a sign-up URL, and for the newsletter an optional banner of about 1200 x 630 px. We can write the newsletter copy and the sponsored posts from your brief, or edit your draft for house voice. Your kickoff page is filled in from your website, so most of it is a check, not a form.',
  },
  {
    q: 'What is in the report?',
    a: 'Clicks on your links per placement and per day, logo impressions (on screen for at least 1 second) with the click rate, page views and readers on the pages we write for you, newsletter recipients, opens and clicks per issue, and every piece we published with its numbers on DevOps Daily, dev.to and daily.dev. It updates every day, and you can download the data as CSV.',
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
        24h and send a media kit + available slots. Once you pick a package, you get your kickoff
        page and your live report link.
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
                550,000+
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
              monthly page views
              <br />
              from engineers who decide what to buy.
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
        {/* Brands we have worked with */}
        <section className="mx-auto my-14 max-w-5xl" aria-labelledby="past-sponsors">
          <p id="past-sponsors" className="mb-10 text-center text-[13px] tracking-[0.01em] text-muted-foreground">
            Brands that have sponsored DevOps Daily
          </p>
          <ul className="mx-auto grid grid-cols-3 items-center gap-x-8 gap-y-10 sm:gap-x-12 lg:flex lg:flex-wrap lg:justify-center lg:gap-x-14">
            {sponsorHistory.map((brand) => (
              <li key={brand.name} className="flex h-12 items-center justify-center lg:w-40">
                <a
                  href={sponsorHref(brand, 'sponsorship')}
                  target="_blank"
                  rel={sponsorRel(brand)}
                  aria-label={brand.name}
                  className="group flex h-full max-w-full items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                >
                  <SponsorLogo
                    sponsor={brand}
                    width={160}
                    height={40}
                    className="w-auto max-w-full object-contain opacity-50 grayscale transition duration-300 group-hover:opacity-100 group-hover:grayscale-0 group-focus-visible:opacity-100 group-focus-visible:grayscale-0 dark:opacity-60"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>

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
            {WHY.map((w, i) => {
              const Icon = w.icon;
              // An odd last card spans both columns, so the grid has no empty cell.
              const wide = WHY.length % 2 === 1 && i === WHY.length - 1;
              return (
                <div key={w.title} className={`bg-card p-5${wide ? ' sm:col-span-2' : ''}`}>
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

          {/* Closes the section on the thing that actually differentiates us
              from an ad network, since that is what sponsors are comparing. */}
          <div className="mt-4 flex flex-col items-center gap-3 rounded-md border bg-card p-5 text-center sm:flex-row sm:justify-center sm:gap-6 sm:text-left">
            <div className="flex items-center gap-2.5">
              <Heart className="h-4 w-4 shrink-0 fill-primary text-primary" strokeWidth={1.5} />
              <span className="text-sm font-semibold">We don&apos;t sell ads.</span>
            </div>
            <span className="hidden h-5 w-px bg-border sm:block" />
            <span className="text-sm text-muted-foreground">
              We write technical content{' '}
              <span className="text-primary">developers want to read.</span>
            </span>
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
            All packages include a private live report, updated every day: clicks, logo impressions, page views and newsletter numbers.
          </p>
        </section>

        <SectionSeparator command="cat how-it-works.md" />

        {/* How it works: the real sequence from yes to the first numbers. */}
        <section className="my-12 max-w-5xl mx-auto">
          <SectionHeader
            label="how it works"
            title="From yes to live numbers"
            description="Little work on your side, and you see every number we see."
          />
          <ol className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="bg-card p-5">
                <p className="mb-2 font-mono text-xs text-primary tabular-nums">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="mb-1 font-semibold">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.description}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div>
              <p className="mb-1 font-mono text-xs text-muted-foreground">{'// your live report'}</p>
              <h3 className="mb-3 text-xl font-bold tracking-tight">Numbers you can check yourself</h3>
              <ul className="space-y-2.5">
                {REPORT_POINTS.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <figure className="m-0">
              <div className="overflow-hidden rounded-md border shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/sponsorship/report-example-light.webp"
                  alt="A DevOps Daily sponsor report: logo impressions, click rate, page views, readers and visitors, with a chart of impressions per day"
                  width={1280}
                  height={860}
                  loading="lazy"
                  className="block h-auto w-full dark:hidden"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/sponsorship/report-example-dark.webp"
                  alt="A DevOps Daily sponsor report: logo impressions, click rate, page views, readers and visitors, with a chart of impressions per day"
                  width={1280}
                  height={860}
                  loading="lazy"
                  className="hidden h-auto w-full dark:block"
                />
              </div>
              <figcaption className="mt-2 text-center font-mono text-xs text-muted-foreground">
                Example report with sample numbers
              </figcaption>
            </figure>
          </div>
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
