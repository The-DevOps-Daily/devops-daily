import Link from 'next/link';
import type { Metadata } from 'next';
import { Calendar, Database, Target } from 'lucide-react';
import { getPostgresAdventDays, isPreviewBuild, summarize } from '@/lib/advent-postgres';
import { AdventHero, AdventSectionHeader } from '@/components/advent-hero';
import { SectionSeparator } from '@/components/section-separator';
import {
  PostgresAdventCalendar,
  PostgresHeroProgress,
} from '@/components/advent-postgres/calendar';
import { BreadcrumbSchema, FAQSchema } from '@/components/schema-markup';

const YEAR = 2026;
const title = `Advent of Postgres ${YEAR}: 24 Daily SQL Puzzles`;
const description =
  '24 SQL puzzles, one a day from 1 to 24 December, solved on a free Postgres database in your browser. Window functions, JSONB, recursive queries and more.';
const image = {
  url: '/images/advent/advent-of-postgres-2026.jpg',
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
  const preview = isPreviewBuild();

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Advent of Postgres', url: '/advent-of-postgres' },
        ]}
      />
      <FAQSchema questions={faq.map((f) => ({ question: f.q, answer: f.a }))} />

      <AdventHero
        label="advent-of-postgres"
        dates={`December 1-24, ${YEAR}`}
        name="Advent of Postgres"
        year={YEAR}
        description="24 SQL puzzles, one a day from 1 to 24 December. Each one is a small problem from the North Pole platform team: failed deploys, error budgets, on-call rotas, outages. You solve it on a real Postgres database that you get for free, right in the browser."
        stats={[
          { icon: Calendar, text: '24 days' },
          { icon: Database, text: 'SQL puzzles' },
          { icon: Target, text: 'Free Postgres database' },
        ]}
        cta={{ href: '#calendar', label: 'See the calendar' }}
        progress={<PostgresHeroProgress days={days} preview={preview} />}
      />

      <div className="container mx-auto px-4 py-8">
        <SectionSeparator command="cat how-it-works.md" />
        <section aria-labelledby="how" className="mx-auto max-w-5xl">
          <AdventSectionHeader id="how" label="how it works" title="How It Works" />
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
              <li key={h} className="rounded-md border border-border bg-card p-4">
                <p className="mb-1 font-mono text-xs text-muted-foreground">Step {i + 1}</p>
                <p className="mb-1 font-medium">{h}</p>
                <p className="text-sm text-muted-foreground">{p}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div id="calendar" className="scroll-mt-20">
        <div className="container mx-auto px-4">
          <SectionSeparator command="ls /advent-of-postgres/days" />
        </div>
        <section aria-labelledby="calendar-title" className="container mx-auto px-4 py-8">
          <PostgresAdventCalendar days={days} preview={preview} />
        </section>
      </div>

      <div className="container mx-auto px-4 py-8">
        <SectionSeparator command="cat faq.md" />
        <section aria-labelledby="faq" className="mx-auto max-w-5xl">
          <AdventSectionHeader id="faq" label="questions" title="Questions" />
          <dl className="max-w-3xl space-y-5">
            {faq.map((f) => (
              <div key={f.q}>
                <dt className="font-medium">{f.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {/* Sister event */}
      <div className="container mx-auto px-4">
        <p className="mx-auto max-w-4xl text-center text-muted-foreground">
          Prefer infrastructure? Try{' '}
          <Link href="/advent-of-devops" className="font-medium text-primary hover:underline">
            Advent of DevOps
          </Link>
          : 25 hands-on challenges with Docker, Kubernetes, CI/CD and Terraform, one a day through
          December.
        </p>
      </div>

      {/* CTA */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-md border bg-primary/5 px-8 py-10 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready for December?</h2>
            <p className="text-muted-foreground mb-6">
              Day 1 opens on 1 December at 00:00 UTC. Share your answers with{' '}
              <a
                href="https://x.com/thedevopsdaily"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                @thedevopsdaily
              </a>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/advent-of-postgres/day-1"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                <Database className="h-4 w-4" strokeWidth={1.5} />
                Open Day 1
              </Link>
              <Link
                href="#calendar"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-border hover:border-primary/50 hover:bg-muted/30 font-medium transition-colors"
              >
                <Calendar className="h-4 w-4" strokeWidth={1.5} />
                See the calendar
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
