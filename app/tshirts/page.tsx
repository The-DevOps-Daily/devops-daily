import type { Metadata } from 'next';
import { Shirt, Sparkles } from 'lucide-react';
import { PageHero } from '@/components/page-hero';
import { Badge } from '@/components/ui/badge';
import { TshirtGallery } from '@/components/tshirt-gallery';
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
          <TshirtGallery designs={tshirtDesigns} />

          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground">
            These designs are free to use and print for personal and commercial purposes, no
            attribution required. Click any design to see it larger and switch between light-shirt and
            dark-shirt versions. SVG scales to any size for print; PNG drops straight into a
            print-on-demand tool. Made by DevOps Daily.
          </p>
        </div>
      </section>
    </div>
  );
}
