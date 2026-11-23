import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import {
  Award,
  BookOpen,
  CalendarClock,
  Gift,
  GraduationCap,
  Mail,
  Share2,
  Trophy,
} from 'lucide-react';
import { Linkedin } from '@/components/icons/social-icons';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { SectionSeparator } from '@/components/section-separator';
import { AdventSectionHeader } from '@/components/advent-hero';
import { GiveawayEntryForm } from '@/components/advent-certificate/giveaway-entry-form';
import { EntryConfirmedNotice } from '@/components/advent-certificate/entry-confirmed-notice';
import {
  ADVENTS,
  GIVEAWAY_DEADLINE_TEXT,
  GIVEAWAY_DRAW_TEXT,
  GIVEAWAY_PATH,
  LINKEDIN_PAGE_URL,
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

const PRIZES = [
  {
    icon: GraduationCap,
    count: '3 winners',
    name: 'DevOps Daily Pro for 1 year',
    text: 'AI mock interviews with feedback, hands-on labs on a real Postgres database, and exam practice at learning.devops-daily.com.',
  },
  {
    icon: Mail,
    count: '3 winners',
    name: 'SMTPfast Growth plan for 12 months',
    text: 'An email API for your apps and side projects: transactional email, broadcasts, signup forms and inbound email.',
  },
  {
    icon: BookOpen,
    count: 'Every finisher who enters',
    name: 'The DevOps Survival Guide ebook',
    text: 'Our ebook on practical DevOps in the age of AI agents. We email it to every confirmed entry after the draw.',
    href: '/books/devops-survival-guide',
  },
];

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

      <div className="container mx-auto px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 font-mono text-xs text-muted-foreground">{'// advent-giveaway'}</p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Finish an advent, <span className="text-primary">win a prize</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Complete{' '}
            <Link href={ADVENTS.devops.path} className="font-medium text-primary hover:underline">
              Advent of DevOps
            </Link>{' '}
            or{' '}
            <Link href={ADVENTS.postgres.path} className="font-medium text-primary hover:underline">
              Advent of Postgres
            </Link>
            , share your certificate on LinkedIn and enter the draw. Every finisher who enters gets
            our ebook.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Entries close 31 Dec 2026
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Gift className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Draw on 5 Jan 2027
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Free, worldwide
            </span>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="#enter"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90"
            >
              Enter the giveaway
            </a>
            <a
              href={LINKEDIN_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-[#0A66C2] px-6 py-3 font-medium text-white hover:bg-[#0A66C2]/90"
            >
              <Linkedin className="h-4 w-4" aria-hidden="true" />
              Follow on LinkedIn
            </a>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <SectionSeparator command="cat prizes.md" />
        <section aria-labelledby="prizes" className="mx-auto max-w-5xl">
          <AdventSectionHeader id="prizes" label="prizes" title="Prizes" />
          <ul className="grid gap-4 md:grid-cols-3">
            {PRIZES.map(({ icon: Icon, count, name, text, href }) => (
              <li key={name} className="flex flex-col rounded-md border border-border bg-card p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/40">
                  <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
                </div>
                <p className="font-mono text-xs text-muted-foreground">{count}</p>
                <h3 className="mt-1 text-lg font-semibold">{name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{text}</p>
                {href && (
                  <Link
                    href={href}
                    className="mt-3 text-sm font-medium text-primary hover:underline"
                  >
                    About the book
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

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
