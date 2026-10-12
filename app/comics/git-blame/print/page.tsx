import { PrintEdition } from '@/components/comics/print-edition';
import { comicMetadata } from '@/lib/comic-metadata';
export const metadata = comicMetadata(
  'git blame — Chapter 1 print edition',
  'The paginated Chapter 1 edition.',
  '/comics/git-blame/print',
  '/comics/og/chapter-01.png',
  true
);
export default function PrintPage() {
  return <PrintEdition />;
}
