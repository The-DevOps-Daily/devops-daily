import type { Metadata } from 'next';
import { ChapterReader } from '@/components/comics/chapter-reader';
import { chapterOne } from '@/content/comics/git-blame/chapter-01';

export const metadata: Metadata = {
  title: `${chapterOne.title} — git blame chapter draft`,
  description: chapterOne.description,
  alternates: { canonical: '/comics/git-blame/proof/chapter' },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function ChapterDraftPage() {
  return <ChapterReader chapter={chapterOne} />;
}
