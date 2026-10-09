import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Download } from 'lucide-react';
import { PageHero } from '@/components/page-hero';
import { comicButtonClasses as buttonVariants } from '@/components/comics/button-style';
import { gitBlame } from '@/content/comics/git-blame/series';
import { comicMetadata, ComicSeriesSchema } from '@/lib/comic-metadata';

export const metadata = comicMetadata(
  'git blame — DevOps Comic Series',
  gitBlame.tagline,
  '/comics/git-blame',
  '/comics/og/git-blame.png'
);

export default function GitBlamePage() {
  return (
    <div className="[overflow-wrap:anywhere]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(ComicSeriesSchema()).replace(/</g, '\\u003c'),
        }}
      />
      <div className="[&_*]:animate-none">
        <PageHero
          title={gitBlame.title}
          description={gitBlame.tagline}
          icon={BookOpen}
          breadcrumbs={[{ label: 'Comics', href: '/comics' }, { label: 'git blame' }]}
          badge="A DevOps Daily original"
        >
          <div className="flex flex-wrap gap-3">
            <Link href="/comics/git-blame/chapter-01" className={buttonVariants()}>
              Start reading <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a href={gitBlame.pdf} download className={buttonVariants({ variant: 'outline' })}>
              <Download className="size-4" aria-hidden="true" />{' '}
              {gitBlame.preview ? 'Download preview PDF' : 'Download chapter PDF'}
            </a>
          </div>
        </PageHero>
      </div>
      <div className="container mx-auto px-4 py-10 sm:py-14 max-w-6xl">
        <section
          className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center"
          aria-labelledby="shipit-title"
        >
          <Image
            src="/comics/git-blame/chapter-01/scene-07-480.webp"
            alt="The ShipIt team closes their laptops together after the incident."
            width={480}
            height={600}
            unoptimized
            className="w-full max-w-sm mx-auto rounded-xl border"
          />
          <div>
            <p className="text-primary text-sm font-medium">Welcome to ShipIt</p>
            <h2 id="shipit-title" className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight">
              Good engineers. Complicated Fridays.
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">{gitBlame.description}</p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Stories first, engineering underneath. Each chapter follows one familiar problem, with
              an optional explanation when the story is over.
            </p>
          </div>
        </section>
        <section id="chapters" className="mt-14 scroll-mt-8" aria-labelledby="volume-title">
          <p className="text-sm text-primary font-medium">Volume 1</p>
          <h2 id="volume-title" className="mt-2 text-3xl font-bold">
            {gitBlame.volume}
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2">
            {gitBlame.chapters.map((chapter) => (
              <li key={chapter.slug} className="rounded-lg border bg-card p-6">
                <p className="text-sm text-muted-foreground">
                  Chapter {chapter.number} ·{' '}
                  {chapter.available ? (gitBlame.preview ? 'Preview' : 'Available') : 'Coming soon'}
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                  {chapter.available ? (
                    <Link
                      href={`/comics/git-blame/${chapter.slug}`}
                      className="hover:text-primary underline-offset-4 hover:underline"
                    >
                      {chapter.title}
                    </Link>
                  ) : (
                    chapter.title
                  )}
                </h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">{chapter.description}</p>
                <p className="mt-4 text-xs text-primary font-medium">{chapter.topic}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="mt-14" aria-labelledby="cast-title">
          <h2 id="cast-title" className="text-2xl font-bold">
            Meet the team
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gitBlame.cast.map((person) => (
              <div key={person.name} className="border-l-2 border-primary/30 pl-4">
                <h3 className="font-semibold">{person.name}</h3>
                <p className="mt-1 text-sm text-primary">{person.role}</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {person.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
