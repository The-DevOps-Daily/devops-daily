import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { CertificateBuilder } from '@/components/advent-certificate/certificate-builder';
import { CertificateView } from '@/components/advent-certificate/certificate-view';
import {
  ADVENTS,
  GIVEAWAY_PATH,
  adventTitle,
  certificatePath,
  certificateViewPath,
  type AdventKey,
} from '@/lib/advent-certificate';

function coverImage(adventKey: AdventKey) {
  const advent = ADVENTS[adventKey];
  return {
    url: `/images/advent/${advent.path.slice(1)}-certificate.jpg`,
    width: 1200,
    height: 630,
    alt: `${adventTitle(advent)} certificate of completion`,
  };
}

export function certificatePageMetadata(adventKey: AdventKey): Metadata {
  const advent = ADVENTS[adventKey];
  const title = `${adventTitle(advent)} Certificate`;
  const description = `Finished ${advent.name}? Make your certificate of completion, download it as a PNG, share it on LinkedIn and add it to your profile.`;
  const image = coverImage(adventKey);
  return {
    title,
    description,
    alternates: { canonical: certificatePath(advent) },
    openGraph: {
      type: 'website',
      title,
      description,
      url: certificatePath(advent),
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export function certificateViewMetadata(adventKey: AdventKey): Metadata {
  const advent = ADVENTS[adventKey];
  const title = `${adventTitle(advent)}: Certificate of Completion`;
  const description = `A certificate of completion for ${adventTitle(advent)} from DevOps Daily: ${advent.pitch}.`;
  const image = coverImage(adventKey);
  return {
    title,
    description,
    alternates: { canonical: certificateViewPath(advent) },
    // Each link carries one person's name; none of them belongs in search results.
    robots: { index: false, follow: true },
    openGraph: {
      type: 'website',
      title,
      description,
      url: certificateViewPath(advent),
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export function CertificatePage({ adventKey }: { adventKey: AdventKey }) {
  const advent = ADVENTS[adventKey];
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: advent.name, url: advent.path },
          { name: 'Certificate', url: certificatePath(advent) },
        ]}
      />
      <div className="container mx-auto px-4 py-10 sm:py-14">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <p className="mb-2 font-mono text-xs text-muted-foreground">{`// ${advent.path.slice(1)}/certificate`}</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Your {advent.name} <span className="text-primary">{advent.year}</span> certificate
          </h1>
          <p className="mt-4 text-muted-foreground">
            Finish all {advent.totalDays} days, type your name, and the certificate is yours:
            download it, share it on LinkedIn, or add it to your profile. Then{' '}
            <Link href={GIVEAWAY_PATH} className="font-medium text-primary hover:underline">
              enter the giveaway
            </Link>
            .
          </p>
        </div>
        <div className="mx-auto max-w-6xl">
          <CertificateBuilder adventKey={adventKey} />
        </div>
      </div>
    </>
  );
}

export function CertificateViewPage({ adventKey }: { adventKey: AdventKey }) {
  return (
    <Suspense fallback={<div className="container mx-auto min-h-[60vh] px-4 py-14" />}>
      <CertificateView adventKey={adventKey} />
    </Suspense>
  );
}
