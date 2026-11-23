import Link from 'next/link';
import { Award, BookOpen, CalendarClock, Gift, GraduationCap, Mail, Trophy } from 'lucide-react';
import { Linkedin } from '@/components/icons/social-icons';
import { CertificateCanvas } from '@/components/advent-certificate/certificate-canvas';
import {
  ADVENTS,
  GIVEAWAY_DEADLINE_TEXT,
  GIVEAWAY_DRAW_TEXT,
  LINKEDIN_PAGE_URL,
  certificatePath,
} from '@/lib/advent-certificate';

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

const SAMPLE_DEVOPS = { name: 'Your Name', days: 25, date: '2026-12-25', id: 'AOD26-SAMPLE' };
const SAMPLE_POSTGRES = { name: 'Your Name', days: 24, date: '2026-12-24', id: 'AOP26-SAMPLE' };

const linkClass = 'font-medium text-primary hover:underline';

export function GiveawayHero() {
  return (
    <section aria-labelledby="giveaway-title" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.07] dark:opacity-[0.09]"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent"
      />

      <div className="container mx-auto px-4 py-12 sm:py-16 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] xl:gap-16">
          <div className="text-center lg:text-left">
            <p className="mb-3 font-mono text-xs text-muted-foreground">{'// advent-giveaway'}</p>
            <p className="mb-6 inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-1 font-mono text-xs text-primary tabular-nums">
              <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              Entries close {GIVEAWAY_DEADLINE_TEXT}
            </p>

            <h1
              id="giveaway-title"
              className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl xl:text-6xl"
            >
              Finish an advent, get a certificate,{' '}
              <span className="relative inline-block text-primary">
                win a prize
                <svg
                  aria-hidden="true"
                  className="absolute -bottom-2 left-0 h-3 w-full text-primary/40"
                  viewBox="0 0 120 12"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 9 Q15 2 30 8 Q45 1 60 7 Q75 2 90 9 Q105 4 118 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground lg:mx-0">
              Complete every day of{' '}
              <Link href={ADVENTS.devops.path} className={linkClass}>
                Advent of DevOps
              </Link>{' '}
              or{' '}
              <Link href={ADVENTS.postgres.path} className={linkClass}>
                Advent of Postgres
              </Link>
              , share your certificate on LinkedIn and enter the draw. Every finisher who enters
              gets our ebook.
            </p>

            <div className="mt-8 flex flex-wrap items-stretch justify-center gap-3 lg:justify-start">
              <div
                role="group"
                aria-labelledby="giveaway-certificate-cta"
                className="inline-flex items-stretch overflow-hidden rounded-md border border-border bg-background"
              >
                <span
                  id="giveaway-certificate-cta"
                  className="inline-flex items-center gap-2 px-3 py-3 font-medium sm:px-4"
                >
                  <Award className="h-4 w-4 text-primary" aria-hidden="true" />
                  Get your certificate
                </span>
                <Link
                  href={certificatePath(ADVENTS.devops)}
                  aria-label="Advent of DevOps certificate"
                  className="inline-flex items-center border-l border-border px-3 font-mono text-sm transition-colors hover:bg-muted hover:text-primary sm:px-4"
                >
                  DevOps
                </Link>
                <Link
                  href={certificatePath(ADVENTS.postgres)}
                  aria-label="Advent of Postgres certificate"
                  className="inline-flex items-center border-l border-border px-3 font-mono text-sm transition-colors hover:bg-muted hover:text-primary sm:px-4"
                >
                  Postgres
                </Link>
              </div>
              <a
                href="#enter"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Gift className="h-4 w-4" aria-hidden="true" />
                Enter the giveaway
              </a>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-sm text-muted-foreground lg:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Draw on {GIVEAWAY_DRAW_TEXT}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Gift className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Free, worldwide
              </span>
              <a
                href={LINKEDIN_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-primary"
              >
                <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" aria-hidden="true" />
                Follow on LinkedIn
              </a>
            </div>
          </div>

          <figure className="mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative px-2 pb-6 pt-2 sm:px-4">
              {/* The second advent's certificate peeks out behind the first. */}
              <div
                aria-hidden="true"
                className="absolute inset-x-4 top-6 rotate-3 overflow-hidden rounded-md border border-border bg-white opacity-90 shadow-sm sm:inset-x-6"
              >
                <CertificateCanvas advent={ADVENTS.postgres} data={SAMPLE_POSTGRES} />
              </div>
              <div className="relative -rotate-1 overflow-hidden rounded-md border border-border bg-white shadow-xl dark:shadow-black/40">
                <CertificateCanvas advent={ADVENTS.devops} data={SAMPLE_DEVOPS} />
              </div>
            </div>
            <figcaption className="text-center font-mono text-xs text-muted-foreground">
              {'// sample certificate, yours shows your name'}
            </figcaption>
          </figure>
        </div>

        <h2 id="prizes" className="sr-only">
          Prizes
        </h2>
        <ul aria-labelledby="prizes" className="mt-12 grid gap-4 md:grid-cols-3 lg:mt-16">
          {PRIZES.map(({ icon: Icon, count, name, text, href }) => (
            <li
              key={name}
              className="flex gap-4 rounded-md border border-border bg-card/80 p-4 backdrop-blur-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
                <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-xs text-primary">{count}</p>
                <h3 className="mt-0.5 font-semibold leading-snug">{name}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
                {href && (
                  <Link
                    href={href}
                    className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    About the book
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
