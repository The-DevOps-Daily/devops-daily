import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Award, Mail, Share2, Trophy } from 'lucide-react';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { SectionSeparator } from '@/components/section-separator';
import { AdventSectionHeader } from '@/components/advent-hero';
import { GiveawayEntryForm } from '@/components/advent-certificate/giveaway-entry-form';
import { EntryConfirmedNotice } from '@/components/advent-certificate/entry-confirmed-notice';
import { GiveawayHero } from '@/components/advent-certificate/giveaway-hero';
import {
  ADVENTS,
  GIVEAWAY_DEADLINE_TEXT,
  GIVEAWAY_DRAW_TEXT,
  GIVEAWAY_PATH,
  certificatePath,
} from '@/lib/advent-certificate';

const title = 'Advent Giveaway 2026: Finish an Advent, Win a Prize';
const description =
  'Finish Advent of DevOps or Advent of Postgres, share your certificate on LinkedIn and enter the draw. Every finisher who enters gets our ebook. Free and open worldwide.';
const image = {
  url: '/images/advent/advent-giveaway.jpg',
  width: 1200,
  height: 630,
  alt: 'DevOps Daily Advent giveaway 2026',
};

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: GIVEAWAY_PATH },
  openGraph: { type: 'website', title, description, url: GIVEAWAY_PATH, images: [image] },
  twitter: { card: 'summary_large_image', title, description, images: [image.url] },
};

const RULES = [
  'DevOps Daily runs this giveaway. It is free and open worldwide, and you do not need to buy anything.',
  'To enter, complete Advent of DevOps 2026 or Advent of Postgres 2026, follow DevOps Daily on LinkedIn, share your certificate on LinkedIn with #AdventOfDevOps or #AdventOfPostgres, then send the entry form below and confirm your email.',
  'One entry per person, even if you finish both advents. One prize per person.',
  `Entries close on ${GIVEAWAY_DEADLINE_TEXT}.`,
  `On ${GIVEAWAY_DRAW_TEXT} we draw 6 winners at random from all confirmed entries: 3 win a year of DevOps Daily Pro and 3 win 12 months of the SMTPfast Growth plan.`,
  'We announce the winners on our LinkedIn page and contact them by email. If a winner does not reply within 14 days, we draw another entry for that prize.',
  'We may check your LinkedIn post before we send a prize, so keep it public until then.',
  'Every confirmed entry gets The DevOps Survival Guide ebook by email after the draw.',
  'Prizes cannot be exchanged, transferred or paid out in cash.',
  'This giveaway is not sponsored, endorsed or run by LinkedIn.',
];

const STEPS = [
  {
    icon: Trophy,
    title: 'Finish an advent',
    text: 'Complete every day of Advent of DevOps (25) or Advent of Postgres (24).',
  },
  {
    icon: Award,
    title: 'Get your certificate',
    text: 'Type your name on the certificate page. Download it or copy its link.',
  },
  {
    icon: Share2,
    title: 'Follow and share',
    text: 'Follow DevOps Daily on LinkedIn and share your certificate with the advent hashtag.',
  },
  {
    icon: Mail,
    title: 'Enter and confirm',
    text: 'Send the form below, then click the link in the email we send you.',
  },
];

export default function AdventGiveawayPage() {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Advent Giveaway', url: GIVEAWAY_PATH },
        ]}
      />
      <Suspense fallback={null}>
        <EntryConfirmedNotice />
      </Suspense>

      <GiveawayHero />

      <div className="container mx-auto px-4 py-8">
        <SectionSeparator command="cat how-to-enter.md" />
        <section aria-labelledby="how" className="mx-auto max-w-5xl">
          <AdventSectionHeader id="how" label="how to enter" title="How to Enter" />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title: step, text }, i) => (
              <li key={step} className="rounded-md border border-border bg-card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" strokeWidth={1.5} aria-hidden="true" />
                  <span className="font-mono text-xs text-muted-foreground">Step {i + 1}</span>
                </div>
                <p className="font-medium">{step}</p>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-muted-foreground">
            Certificates:{' '}
            <Link href={certificatePath(ADVENTS.devops)} className="text-primary hover:underline">
              Advent of DevOps
            </Link>{' '}
            ·{' '}
            <Link href={certificatePath(ADVENTS.postgres)} className="text-primary hover:underline">
              Advent of Postgres
            </Link>
          </p>
        </section>
      </div>

      <div id="enter" className="container mx-auto scroll-mt-20 px-4 py-8">
        <SectionSeparator command="./enter.sh" />
        <section aria-labelledby="entry" className="mx-auto max-w-3xl">
          <AdventSectionHeader
            id="entry"
            label="entry form"
            title="Enter the Giveaway"
            description="We only ask for your name and email. If you win, we email you and may ask for the link to your LinkedIn post."
          />
          <GiveawayEntryForm />
        </section>
      </div>

      <div className="container mx-auto px-4 py-8 pb-16">
        <SectionSeparator command="cat rules.md" />
        <section aria-labelledby="rules" className="mx-auto max-w-3xl">
          <AdventSectionHeader id="rules" label="rules" title="Rules" />
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-foreground">
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
          <p className="mt-6 rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <strong className="text-foreground">Privacy.</strong> We use your name and email only
            for this draw and to send the prizes and the ebook. We delete them after the prizes go
            out, and they never join our newsletter list. See also our{' '}
            <Link href="/privacy" className="text-primary hover:underline">
              privacy policy
            </Link>
            .
          </p>
        </section>
      </div>
    </>
  );
}
