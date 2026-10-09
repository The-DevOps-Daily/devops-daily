import { comicMetadata } from '@/lib/comic-metadata';
import { ChapterReader } from '@/components/comics/chapter-reader';
import { chapterOne } from '@/content/comics/git-blame/chapter-01';

export const metadata = comicMetadata(
  `${chapterOne.title} — git blame chapter draft`,
  chapterOne.description,
  '/comics/git-blame/proof/chapter',
  '/comics/og/chapter-01.png',
  true
);

export default function ChapterDraftPage() {
  return <ChapterReader chapter={chapterOne} />;
}
