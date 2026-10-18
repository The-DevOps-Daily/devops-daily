import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Clock, Download } from 'lucide-react';
import { MarkdownContent } from '@/components/markdown-content';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import { InlineSponsors } from '@/components/inline-sponsors';
import { AdventDayHeader, AdventDayNav, AdventShareBox } from '@/components/advent-day-parts';
import { PostgresWorkbench } from '@/components/advent-postgres/workbench';
import { PostgresDayGate } from '@/components/advent-postgres/calendar';
import {
  getPostgresAdventDay,
  getPostgresAdventDays,
  isPreviewBuild,
  openAtBuild,
  openedBeforeBuild,
} from '@/lib/advent-postgres';

export const dynamicParams = false;

const SHARE_IMAGE = '/images/advent/advent-of-postgres-2026.jpg';

export async function generateStaticParams() {
  return (await getPostgresAdventDays()).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const day = await getPostgresAdventDay(slug);
  if (!day) return {};
  const open = openAtBuild(day);
  const title = `${open ? day.title : `Day ${day.day}`} | Advent of Postgres`;
  const description = open
    ? day.excerpt
    : `Day ${day.day} of Advent of Postgres opens on ${day.day} December at 00:00 UTC.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/advent-of-postgres/${day.slug}` },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `/advent-of-postgres/${day.slug}`,
      images: [{ url: SHARE_IMAGE, width: 1200, height: 630, alt: 'Advent of Postgres 2026' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [SHARE_IMAGE],
    },
  };
}

export default async function AdventOfPostgresDay({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const day = await getPostgresAdventDay(slug);
  if (!day) notFound();
  const days = await getPostgresAdventDays();
  const open = openAtBuild(day);
  const preview = isPreviewBuild();
  // Already open when the page was built: put the puzzle in the HTML, so readers
  // without JavaScript and search engines see it. Inside the 20 minutes before
  // a day opens, the browser still holds it back until 00:00 UTC.
  const openNow = openedBeforeBuild(day);
  const prev = days.find((d) => d.day === day.day - 1);
  const next = days.find((d) => d.day === day.day + 1);
  const shareUrl = `https://devops-daily.com/advent-of-postgres/${day.slug}`;

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Advent of Postgres', url: '/advent-of-postgres' },
          { name: `Day ${day.day}`, url: `/advent-of-postgres/${day.slug}` },
        ]}
      />
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-9">
            <article className="max-w-4xl">
              <AdventDayHeader
                path={`advent-of-postgres/${day.slug}`}
                day={day.day}
                total={24}
                difficulty={open ? day.difficulty : undefined}
                topics={open ? day.skills : []}
                title={open ? day.title.replace(/^Day \d+: /, '') : `Day ${day.day}`}
                excerpt={open ? day.excerpt : undefined}
                meta={
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Opens {day.day} December 2026, 00:00 UTC
                  </span>
                }
              />

              {!open && <PostgresDayGate publishedAt={day.publishedAt} day={day.day} builtLocked />}
              {open && (
                <PostgresDayGate
                  publishedAt={day.publishedAt}
                  day={day.day}
                  preview={preview}
                  initiallyOpen={openNow}
                >
                  <MarkdownContent content={day.content} />
                  {day.hint && (
                    <details className="mt-6 rounded-md border border-border px-4 py-3 text-sm">
                      <summary className="cursor-pointer font-medium">Stuck? Show a hint</summary>
                      <p className="mt-2 text-muted-foreground">{day.hint}</p>
                    </details>
                  )}
                  <PostgresWorkbench
                    day={day.day}
                    schema={day.schema}
                    answerHash={day.answerHash}
                    answerFormat={day.answerFormat}
                    starterSql={day.starter ?? 'select 1;'}
                  />
                  <p className="text-sm text-muted-foreground">
                    <a
                      href={`/advent-of-postgres/seeds/${day.schema}.sql`}
                      className="inline-flex items-center gap-1 underline underline-offset-4"
                      download
                    >
                      <Download className="h-3.5 w-3.5" /> Download today&apos;s data as SQL
                    </a>{' '}
                    to solve it on your own Postgres (14 or later).
                  </p>
                  <AdventShareBox
                    heading="Solved this puzzle? Share it."
                    text={`I solved Day ${day.day} of Advent of Postgres: ${day.title.replace(/^Day \d+: /, '')}`}
                    url={shareUrl}
                    hashtags="AdventOfPostgres,Postgres"
                  />
                </PostgresDayGate>
              )}

              <InlineSponsors variant="full" className="my-12" />

              <AdventDayNav base="/advent-of-postgres" prev={prev} next={next} />
            </article>
          </div>

          <aside className="lg:col-span-3">
            <SponsorSidebar />
          </aside>
        </div>
      </div>
    </>
  );
}
