import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { gitBlame } from '@/content/comics/git-blame/series';
import { comicButtonClasses as buttonVariants } from '@/components/comics/button-style';

export function ChapterNavigation({ chapterId }: { chapterId: string }) {
  const index = gitBlame.chapters.findIndex((chapter) => chapter.slug === chapterId);
  const previous = gitBlame.chapters[index - 1];
  const next = gitBlame.chapters[index + 1];
  return (
    <nav
      aria-label="Chapter navigation"
      className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-5 text-foreground"
    >
      <Link href="/comics/git-blame#chapters" className={buttonVariants({ variant: 'outline' })}>
        <ArrowLeft className="size-4" aria-hidden="true" /> Series contents
      </Link>
      {previous?.available && (
        <Link href={`/comics/git-blame/${previous.slug}`} className="text-sm underline">
          Previous: {previous.title}
        </Link>
      )}
      {next?.available ? (
        <Link href={`/comics/git-blame/${next.slug}`} className={buttonVariants()}>
          Next chapter <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        next && (
          <p className="text-sm text-muted-foreground">
            Next: {next.title}
            <span className="block text-xs mt-1">Coming soon</span>
          </p>
        )
      )}
    </nav>
  );
}
