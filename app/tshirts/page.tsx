import type { Metadata } from 'next';
import { Download, Shirt, Sparkles } from 'lucide-react';
import { PageHero } from '@/components/page-hero';
import { Badge } from '@/components/ui/badge';
import { tshirtDesigns } from '@/lib/tshirts';

export const metadata: Metadata = {
  title: 'Free DevOps T-Shirt Designs',
  description:
    'Free, print-ready t-shirt designs with funny developer, DevOps, and SRE quotes. Download the SVG or PNG and print your own. Free to use, no attribution required.',
  alternates: { canonical: '/tshirts' },
  openGraph: {
    title: 'Free DevOps T-Shirt Designs - DevOps Daily',
    description:
      'Print-ready developer and DevOps t-shirt designs. Download the SVG or PNG and print your own, free, no attribution required.',
    type: 'website',
    url: '/tshirts',
    images: [
      {
        url: '/images/pages/tshirts.png',
        width: 1200,
        height: 630,
        alt: 'Free DevOps T-Shirt Designs',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free DevOps T-Shirt Designs - DevOps Daily',
    description:
      'Print-ready developer and DevOps t-shirt designs. Download the SVG or PNG and print your own, free.',
    images: ['/images/pages/tshirts.png'],
  },
};

export default function TshirtsPage() {
  return (
    <div className="min-h-screen">
      <PageHero
        title="Free DevOps T-Shirt Designs"
        accentWord="Free"
        badge="New"
        icon={Shirt}
        description="Funny developer, DevOps, and SRE quotes as clean, print-ready designs. Download the SVG or PNG and print your own. Free to use, no attribution required."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'T-Shirts' }]}
        stats={[
          { label: 'designs', value: tshirtDesigns.length },
          { label: 'price', value: 'Free' },
          { label: 'formats', value: 'SVG + PNG' },
        ]}
      >
        <div className="mt-6">
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="h-3 w-3" />
            Free to use and print, no attribution required
          </Badge>
        </div>
      </PageHero>

      <section className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tshirtDesigns.map((d) => (
              <div
                key={d.slug}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40"
              >
                {/* Designs are dark ink on transparent, so preview on a fixed light panel */}
                <div className="flex aspect-[4/5] items-center justify-center bg-[#f8fafc] p-6">
                  <img
                    src={d.png}
                    alt={d.title}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border p-3">
                  <span className="truncate text-sm font-medium" title={d.title}>
                    {d.title}
                  </span>
                  <div className="flex shrink-0 gap-1.5">
                    <a
                      href={d.svg}
                      download
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <Download className="h-3 w-3" /> SVG
                    </a>
                    <a
                      href={d.png}
                      download
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <Download className="h-3 w-3" /> PNG
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground">
            These designs are free to use and print for personal and commercial purposes, no
            attribution required. SVG scales to any size for print; PNG drops straight into a
            print-on-demand tool. Designed for light-coloured shirts (dark ink on a transparent
            background). Made by DevOps Daily.
          </p>
        </div>
      </section>
    </div>
  );
}
