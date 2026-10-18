import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { MarkdownContent } from '@/components/markdown-content';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { PostgresWorkbench } from '@/components/advent-postgres/workbench';
import { PostgresDayGate } from '@/components/advent-postgres/calendar';
import { getPostgresAdventDay, getPostgresAdventDays } from '@/lib/advent-postgres';

export const dynamicParams = false;

const SHARE_IMAGE = '/images/advent/advent-of-postgres.png';

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
  const title = `${day.title} | Advent of Postgres`;
  return {
    title: { absolute: title },
    description: day.excerpt,
    alternates: { canonical: `/advent-of-postgres/${day.slug}` },
    openGraph: {
      type: 'article',
      title,
      description: day.excerpt,
      url: `/advent-of-postgres/${day.slug}`,
      images: [{ url: SHARE_IMAGE, width: 1200, height: 630, alt: 'Advent of Postgres 2026' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: day.excerpt,
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
  const prev = days.find((d) => d.day === day.day - 1);
  const next = days.find((d) => d.day === day.day + 1);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Advent of Postgres', url: '/advent-of-postgres' },
          { name: `Day ${day.day}`, url: `/advent-of-postgres/${day.slug}` },
        ]}
      />
      <nav className="mb-6 text-sm">
        <Link href="/advent-of-postgres" className="text-muted-foreground hover:text-foreground">
          Advent of Postgres
        </Link>
        <span className="text-muted-foreground"> / Day {day.day} of 24</span>
      </nav>

      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          {day.difficulty && (
            <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
              {day.difficulty}
            </span>
          )}
          {day.skills?.map((s) => (
            <span
              key={s}
              className="rounded-full border border-border px-3 py-1 text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{day.title}</h1>
      </header>

      <PostgresDayGate publishedAt={day.publishedAt} day={day.day}>
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
      </PostgresDayGate>

      <nav className="mt-12 flex justify-between border-t border-border pt-6 text-sm">
        {prev ? (
          <Link
            href={`/advent-of-postgres/${prev.slug}`}
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ChevronLeft className="h-4 w-4" /> Day {prev.day}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/advent-of-postgres/${next.slug}`}
            className="inline-flex items-center gap-1 hover:underline"
          >
            Day {next.day} <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
