import type { Metadata } from 'next';
import { gitBlame } from '@/content/comics/git-blame/series';

export function comicMetadata(
  title: string,
  description: string,
  route: string,
  image: string,
  draft = gitBlame.preview
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: route },
    openGraph: {
      siteName: 'DevOps Daily',
      locale: 'en_US',
      title: `${title} | DevOps Daily`,
      description,
      url: route,
      type: 'website',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | DevOps Daily`,
      description,
      images: [image],
    },
    robots: { index: !draft, follow: !draft, googleBot: { index: !draft, follow: !draft } },
  };
}

export function ComicSeriesSchema() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWorkSeries',
    name: gitBlame.title,
    description: gitBlame.description,
    url: `${base}/comics/git-blame`,
    inLanguage: 'en',
    publisher: { '@type': 'Organization', name: 'DevOps Daily', url: base },
    hasPart: gitBlame.chapters
      .filter((chapter) => chapter.available)
      .map((chapter) => ({
        '@type': 'CreativeWork',
        name: chapter.title,
        url: `${base}/comics/git-blame/${chapter.slug}`,
      })),
  };
}
