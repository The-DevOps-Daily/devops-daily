import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { gitBlame } from '@/content/comics/git-blame/series';
import { comicButtonClasses as buttonVariants } from '@/components/comics/button-style';

export function SeriesCard() {
  return (
    <article className="grid [overflow-wrap:anywhere] rounded-xl border bg-card md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Link
        href="/comics/git-blame"
        className="bg-[#f6f0df] p-6 flex items-center justify-center"
        aria-label="Explore git blame"
      >
        <Image
          src="/comics/git-blame/chapter-01/scene-01-480.webp"
          alt="Sam and Maya in ShipIt’s warm, lived-in office."
          width={480}
          height={600}
          className="w-full max-w-xs rounded-lg"
          unoptimized
        />
      </Link>
      <div className="min-w-0 p-6 sm:p-10 flex flex-col justify-center gap-5">
        <p className="text-sm font-medium text-primary flex items-center gap-2">
          <BookOpen className="size-4" aria-hidden="true" /> A DevOps Daily original
        </p>
        <div>
          <h2 className="text-4xl font-bold tracking-tight">
            <Link href="/comics/git-blame">{gitBlame.title}</Link>
          </h2>
          <p className="mt-3 text-lg font-medium">{gitBlame.tagline}</p>
        </div>
        <p className="text-muted-foreground leading-relaxed">{gitBlame.description}</p>
        <p className="text-sm text-muted-foreground">
          Volume 1 · {gitBlame.volume} ·{' '}
          {gitBlame.preview ? 'Chapter 1 preview' : 'Chapter 1 available'}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/comics/git-blame/chapter-01" className={buttonVariants()}>
            Read Chapter 1 <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link href="/comics/git-blame" className={buttonVariants({ variant: 'outline' })}>
            Explore the series
          </Link>
        </div>
      </div>
    </article>
  );
}
