import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Wrench } from 'lucide-react';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { ToolsIndexList } from '@/components/tools/tools-index-list';

export const metadata: Metadata = {
  title: 'DevOps Tools and Calculators | DevOps Daily',
  description:
    'Free DevOps utilities that run entirely in your browser: CIDR calculator, JWT decoder, base64 and URL encoder, UUID generator, cron expression parser, and more. No sign-up, no server.',
  alternates: { canonical: '/tools' },
  openGraph: {
    title: 'DevOps Tools and Calculators',
    description:
      'Free browser-based DevOps utilities: CIDR, JWT, base64, UUID, cron, and more.',
    url: '/tools',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'DevOps Tools' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevOps Tools and Calculators',
    description: 'Free browser-based DevOps utilities.',
    images: ['/og-image.png'],
  },
};

export default function ToolsIndexPage() {
  const breadcrumbItems = [{ label: 'Tools', href: '/tools', isCurrent: true }];
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Tools', url: '/tools' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

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

        <div className="container relative mx-auto px-4 py-12 md:py-16">
          <Breadcrumb items={breadcrumbItems} />
          <div className="max-w-3xl">
            <p className="text-xs font-mono text-muted-foreground mb-3">// tools</p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] mb-4">
              DevOps utilities and{' '}
              <span className="text-primary relative inline-block">
                calculators
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
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
              Free, fast, browser-only DevOps tools. No sign-up, no data sent anywhere. Built to
              replace the half-broken, ad-infested ones that rank for these queries.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <ToolsIndexList />

        {/* Cross-link to /toolbox */}
        <section className="my-8 rounded-md border bg-muted/30 p-5 flex items-start gap-4">
          <Wrench className="w-5 h-5 text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1">Looking for third-party tools?</h3>
            <p className="text-sm text-muted-foreground mb-2">
              The calculators above are things we built. For curated links to external DevOps
              tools, see the DevOps Toolbox.
            </p>
            <Link
              href="/toolbox"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Browse the DevOps Toolbox
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        <section className="my-16 max-w-2xl mx-auto text-center">
          <h2 className="text-lg font-semibold mb-2">Want a tool we haven&apos;t built?</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Tell us what you&apos;re reaching for elsewhere. If it&apos;s DevOps-relevant and runs
            in a browser, it belongs here.
          </p>
          <Link
            href="https://github.com/The-DevOps-Daily/devops-daily/issues/new?title=Tool+request%3A+"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Request a tool on GitHub
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </div>
    </>
  );
}
