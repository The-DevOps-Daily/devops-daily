import { ChapterReader } from '@/components/comics/chapter-reader';
import { chapterOne } from '@/content/comics/git-blame/chapter-01';
import { comicMetadata } from '@/lib/comic-metadata';

export const metadata = comicMetadata(
  `${chapterOne.title} — git blame Chapter 1`,
  chapterOne.description,
  '/comics/git-blame/chapter-01',
  '/comics/og/chapter-01.png'
);

export default function ChapterOnePage() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: chapterOne.title,
    description: chapterOne.description,
    url: `${base}/comics/git-blame/chapter-01`,
    image: `${base}/comics/og/chapter-01.png`,
    inLanguage: 'en',
    isAccessibleForFree: true,
    isPartOf: { '@type': 'CreativeWorkSeries', name: 'git blame', url: `${base}/comics/git-blame` },
    publisher: { '@type': 'Organization', name: 'DevOps Daily', url: base },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />
      <ChapterReader chapter={chapterOne} />
    </>
  );
}
