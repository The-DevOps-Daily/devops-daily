import Link from 'next/link';
import type { Metadata } from 'next';
import { Database } from 'lucide-react';
import { getPostgresAdventDays, summarize } from '@/lib/advent-postgres';
import { PostgresAdventCalendar } from '@/components/advent-postgres/calendar';
import { BreadcrumbSchema, FAQSchema } from '@/components/schema-markup';

const title = 'Advent of Postgres 2026: 24 Daily SQL Puzzles';
const description =
  '24 SQL puzzles, one a day from 1 to 24 December, solved on a free Postgres database in your browser. Window functions, JSONB, recursive queries and more.';
const image = {
  url: '/images/advent/advent-of-postgres.png',
  width: 1200,
  height: 630,
  alt: 'Advent of Postgres 2026: 24 SQL puzzles, 1 to 24 December',
};

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/advent-of-postgres' },
  openGraph: { type: 'website', title, description, url: '/advent-of-postgres', images: [image] },
  twitter: { card: 'summary_large_image', title, description, images: [image.url] },
};

const faq = [
  {
    q: 'What database do I get?',
    a: 'A real Postgres database on Neon, created for you when you press "Create my free database". It takes about five seconds and needs no account. Each day loads its data into its own schema, so you keep one database for the whole month.',
  },
  {
    q: 'How long does it last?',
    a: 'An unclaimed database lasts 72 hours. To keep it for the whole event, press "Keep it for the month" and claim it into a free Neon account. A few later puzzles use Neon branches, which need a claimed database.',
  },
  {
    q: 'Can I use my own tools?',
    a: 'Yes. "Connect with psql" shows the connection string, and every day also has a plain SQL file, so you can load the data into any Postgres 14 or later and solve it locally.',
  },
  {
    q: 'Does DevOps Daily see my queries?',
    a: 'No. Your browser sends queries straight to your own database on Neon. Our small API only asks Neon to create the database and the claim link, and it stores nothing.',
  },
  {
    q: 'How are answers checked?',
    a: 'In your browser, against a hash of the right answer. Your progress is saved in this browser only.',
  },
];

export default async function AdventOfPostgresPage() {
  const days = (await getPostgresAdventDays()).map(summarize);

  return (
    <div className="container mx-auto px-4 py-12 md:py-16">
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Advent of Postgres', url: '/advent-of-postgres' },
        ]}
      />
      <FAQSchema questions={faq.map((f) => ({ question: f.q, answer: f.a }))} />
      <header className="mx-auto mb-12 max-w-3xl text-center">
        <p className="mb-3 font-mono text-xs text-muted-foreground">{'// advent-of-postgres'}</p>
        <h1 className="mb-5 text-4xl font-bold tracking-tight sm:text-5xl">
          Advent of Postgres 2026
        </h1>
        <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
          24 SQL puzzles, one a day from 1 to 24 December. Each one is a small problem from the
          North Pole platform team: failed deploys, error budgets, on-call rotas, outages. You solve
          it on a real Postgres database that you get for free, right in the browser.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="#calendar"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Database className="h-4 w-4" /> See the calendar
          </Link>
        </div>
      </header>

      <section aria-labelledby="how" className="mx-auto mb-14 max-w-4xl">
        <h2 id="how" className="mb-6 text-2xl font-semibold">
          How it works
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            [
              'Open the day',
              'A new puzzle opens at 00:00 UTC each day. Read the story and the tables.',
            ],
            [
              'Write SQL',
              'Create your free database with one click. The day’s data loads by itself, and you run queries on the page or with psql.',
            ],
            [
              'Submit the answer',
              'One answer per day. The early days are short; the later ones need window functions, ranges and recursive queries.',
            ],
          ].map(([h, p], i) => (
            <li key={h} className="rounded-md border border-border p-4">
              <p className="mb-1 font-mono text-xs text-muted-foreground">Step {i + 1}</p>
              <p className="mb-1 font-medium">{h}</p>
              <p className="text-sm text-muted-foreground">{p}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="calendar"
        aria-labelledby="calendar-title"
        className="mx-auto mb-14 max-w-5xl scroll-mt-20"
      >
        <h2 id="calendar-title" className="mb-6 text-2xl font-semibold">
          The calendar
        </h2>
        <PostgresAdventCalendar days={days} />
      </section>

      <section aria-labelledby="faq" className="mx-auto max-w-3xl">
        <h2 id="faq" className="mb-6 text-2xl font-semibold">
          Questions
        </h2>
        <dl className="space-y-5">
          {faq.map((f) => (
            <div key={f.q}>
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
