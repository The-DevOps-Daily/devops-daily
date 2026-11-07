import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, FileText, Library, Mail, PenLine } from 'lucide-react';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema, FAQSchema } from '@/components/schema-markup';
import { SectionHeader } from '@/components/section-header';
import { SectionSeparator } from '@/components/section-separator';
import { toJsonLd } from '@/lib/json-ld';
import { EarlyAccessForm } from './early-access-form';
import { LaunchBar } from './launch-bar';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com';
const PAGE_PATH = '/books/devops-survival-guide';
const IMG = '/images/books/devops-survival-guide';
const SAMPLE_PDF = '/books/the-devops-survival-guide-sample.pdf';

const title = 'The DevOps Survival Guide: Practical DevOps in the Age of AI Agents';
const description =
  'Practical DevOps in the Age of AI Agents. A book on deployments, on-call, security, platforms and agents with production access. Read a free sample.';
const ogImage = {
  url: `${IMG}/share.jpg`,
  width: 1200,
  height: 630,
  alt: 'The DevOps Survival Guide: Practical DevOps in the Age of AI Agents. The book stands on a white plinth next to a DevOps Daily coffee mug.',
};

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: 'website',
    title,
    description,
    url: PAGE_PATH,
    images: [ogImage],
  },
  twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
};

const bookSchema = {
  '@context': 'https://schema.org',
  '@type': 'Book',
  '@id': `${SITE_URL}${PAGE_PATH}#book`,
  name: 'The DevOps Survival Guide',
  alternativeHeadline: 'Practical DevOps in the Age of AI Agents',
  description,
  url: `${SITE_URL}${PAGE_PATH}`,
  image: `${SITE_URL}${IMG}/cover.webp`,
  inLanguage: 'en',
  author: { '@type': 'Organization', name: 'DevOps Daily', url: SITE_URL },
  publisher: { '@type': 'Organization', name: 'DevOps Daily', url: SITE_URL },
  bookEdition: 'First edition',
  copyrightYear: 2026,
  license: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
};

// Chapter titles are the book's headings; each line is quoted or trimmed from the book's text.
const chapters: {
  number: string;
  title: string;
  line: string;
  sample?: boolean;
  tag?: string;
}[] = [
  {
    number: '00',
    title: 'Introduction',
    line: 'Producing code got cheap. Reviewing it, running it, recovering it and explaining it did not.',
    sample: true,
  },
  {
    number: '01',
    title: 'You Just Got Here',
    line: "You don't have to learn it all this week; start with one service and someone who can guide you.",
  },
  {
    number: '02',
    title: 'DevOps Is Not a Job Title',
    line: "What DevOps means and how that shapes the work you're joining.",
  },
  {
    number: '03',
    title: 'The Deployment Mess',
    line: 'A boring deployment has repeatable steps and evidence that the new version works.',
  },
  {
    number: '04',
    title: "Infrastructure That Doesn't Hate You",
    line: "Recording the intended setup while checking the system that's running.",
  },
  {
    number: '05',
    title: 'Monitoring vs. Guessing',
    line: 'A green dashboard is only reassuring when you know what it covers and what it leaves out.',
  },
  {
    number: '06',
    title: 'On-Call Without Trauma',
    line: 'From detecting trouble to responding without exhausting the people on call.',
  },
  {
    number: '07',
    title: 'Security Is Your Job Too',
    line: 'I want the secure path to be the easy path.',
  },
  {
    number: '08',
    title: 'No One Reads Your Docs',
    line: "Keeping knowledge from getting trapped in people's heads.",
  },
  {
    number: '09',
    title: 'Platform Thinking',
    line: 'Building tools that let teams help themselves.',
  },
  {
    number: '10',
    title: 'Tech Debt, But Make It Boring',
    line: 'Making improvements without getting trapped in a rewrite.',
  },
  {
    number: '11',
    title: 'Measuring What Actually Matters',
    line: 'Ask what decision a number supports and what evidence would challenge its apparent improvement.',
  },
  {
    number: '12',
    title: 'Driving Change Without a Fancy Title',
    line: "How to propose improvements when you don't have formal authority.",
  },
  {
    number: '13',
    title: 'The Agent Has Production Access',
    line: 'Agents that can write code, call tools, and sometimes touch production.',
    sample: true,
  },
  {
    number: '14',
    title: "DevOps That Doesn't Burn You Out",
    line: 'A team has to stay healthy enough to make good decisions.',
  },
  {
    number: '+',
    title: 'Work That Outlasts the Hype',
    line: 'Which skills keep paying off whichever tools your team picks, and how to spend your next 90 days.',
    tag: 'career',
  },
];

const backMatter = [
  {
    title: 'Glossary',
    line: 'Short working definitions of terms you will hear in incidents, planning meetings and postmortems.',
  },
  {
    title: 'Further Reading',
    line: "Where to check the book's positions and go deeper.",
  },
  {
    title: 'About This Book',
    line: 'Edition details, and how to report an error or send a question.',
  },
];

const readers = [
  {
    title: 'Early in your career',
    text: 'The center is the first few years, roughly 0-3 years of experience. The scenarios follow a new hire, because a new hire sees what everyone else has stopped noticing.',
  },
  {
    title: 'Experienced engineers',
    text: 'You are usually the one who reviews agent changes, decides what an agent may touch and owns what it ships. Chapters 3, 7 and 13 are a good place to start.',
  },
  {
    title: 'Managers and team leads',
    text: 'Set the rules your team and its agents work under, and see what a newer colleague is dealing with and how to support them.',
  },
];

const cast = [
  { name: 'Alex', role: 'Senior operations engineer, calm in a crisis.' },
  { name: 'Maya', role: 'Developer who automates anything she has to do twice.' },
  { name: 'Sam', role: 'Developer who ships fast and has opinions about it.' },
  { name: 'Nora', role: 'Database engineer who remembers the last rewrite.' },
  { name: 'Chris', role: 'Engineering manager, balancing delivery and reliability.' },
  { name: 'Eli', role: 'Follows the cloud bill until it has an owner.' },
  { name: 'The Agent', role: 'Fast, eager, confident, and sometimes wrong.' },
  { name: 'You', role: 'The new hire.' },
];

// Alt text is the book's own description of each picture.
const illustrations = [
  {
    file: 'first-morning.webp',
    caption: "Introduction: the new hire's first morning.",
    alt: "The new hire's first morning: she arrives with her bag while Alex, sitting on a desk with his mug, nods hello, Maya waves from her laptop, Sam and Chris talk by the window, Nora turns in her chair and Eli studies a wall screen; the Agent, a small robot with a visitor badge, rolls up holding out its clipboard",
  },
  {
    file: 'agent-pull-request.webp',
    caption: 'Chapter 13: the Agent hands Maya a very large change.',
    alt: 'The Agent proudly hands Maya a tall, wobbling stack of printed pages while the new hire pulls one page with a red band out of the middle',
  },
  {
    file: 'agent-waits.webp',
    caption: 'Chapter 13: the Agent waits with a draft while the new hire reads.',
    alt: 'The new hire reads a printed manual and writes in her notebook while the Agent waits beside the desk with a draft on its clipboard',
  },
  {
    file: 'end-of-day.webp',
    caption: 'Chapter 14: six in the evening, and the Agent sleeps on its dock.',
    alt: 'Six in the evening, in warm sunset light: Sam and Maya walk out chatting, Alex and Chris talk in the corridor where Nora and Eli are already heading off, the new hire looks back at the room as she switches off the light by the door, and in the corner the Agent sleeps on its charging dock',
  },
];

const launchDetails = [
  { label: 'Leanpub', value: 'PDF and EPUB, at launch' },
  { label: 'Amazon', value: 'Kindle and paperback, at launch' },
  { label: 'Edition', value: 'First edition, 2026' },
  { label: 'Author', value: 'DevOps Daily' },
];

// Answers come from the book's "About This Book" page and the launch plan above.
const faqs = [
  {
    question: 'What formats will it come in?',
    answer: 'PDF and EPUB on Leanpub, and a Kindle ebook and a paperback on Amazon.',
  },
  {
    question: 'How much will it cost?',
    answer:
      'We will announce the price at launch. The free sample is out now, and you can read it without signing up.',
  },
  {
    question: 'Can I share it?',
    answer:
      'Yes, within the license. The text and illustrations are CC BY-NC-ND 4.0: you can share the book unchanged, for noncommercial use, with credit. The code examples are MIT, so you can copy them into your own scripts and repositories.',
  },
  {
    question: 'Will the book get updates?',
    answer: 'Corrections go into the next edition, and this page will list the errata.',
  },
  {
    question: 'Does it come with templates?',
    answer:
      'Yes. The templates the book describes, such as the service map, the incident runbook and an AGENTS.md starter, go into a free public DevOps Daily repository after launch. This page will link to it.',
  },
];

const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90';
const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-md border border-border px-6 py-3 font-medium transition-colors hover:border-primary/50 hover:bg-muted/30';

export default function DevOpsSurvivalGuidePage() {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Books', url: '/books' },
          { name: 'The DevOps Survival Guide', url: PAGE_PATH },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(bookSchema) }}
      />
      <FAQSchema questions={faqs} />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/[0.05] via-transparent to-transparent"
        />
        <div className="container mx-auto px-4 py-8 sm:py-14">
          <Breadcrumb
            className="mx-auto max-w-5xl"
            items={[
              { label: 'Books', href: '/books' },
              { label: 'The DevOps Survival Guide', isCurrent: true },
            ]}
          />

          <div className="mx-auto grid max-w-5xl items-center gap-6 md:grid-cols-[17rem_1fr] md:gap-10 lg:grid-cols-[20rem_1fr] lg:gap-14">
            <div className="mx-auto w-44 sm:w-52 md:w-full">
              <Image
                src={`${IMG}/cover.webp`}
                alt="Cover of The DevOps Survival Guide: an open, well-worn travel case packed with a map, a pager, a mug, a first-aid kit, a wrench, a network cable, a lantern and a server"
                width={640}
                height={960}
                preload
                sizes="(min-width: 1024px) 20rem, (min-width: 768px) 17rem, 13rem"
                className="h-auto w-full rounded-md border border-border shadow-xl"
              />
            </div>

            {/* On phones the buttons come right after the title, so they show without scrolling. */}
            <div className="flex flex-col items-center text-center md:items-start md:text-left">
              <p className="mb-3 hidden font-mono text-xs text-muted-foreground sm:block">
                {'// books/devops-survival-guide'}
              </p>
              <span className="mb-5 inline-flex items-center rounded-md border border-primary/20 bg-primary/5 px-3 py-1 font-mono text-xs text-primary">
                First edition, 2026
              </span>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-balance sm:text-5xl">
                The DevOps Survival Guide
              </h1>
              <p className="mt-3 text-xl font-semibold text-balance text-primary sm:text-2xl">
                Practical DevOps in the Age of AI Agents
              </p>
              <p className="mt-2 italic text-muted-foreground">
                How to stay sane, ship fast, and sleep again.
              </p>
              <p className="order-1 mt-6 max-w-2xl leading-relaxed text-muted-foreground sm:text-lg md:order-none md:mt-5">
                For engineers doing DevOps work now that agents are part of the team. Each chapter
                opens with a short scenario, gives practical advice, and ends with next steps that
                fit in an ordinary week.
              </p>

              <div className="order-1 mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-sm text-muted-foreground md:order-none md:mt-6 md:justify-start">
                {[
                  { icon: BookOpen, text: '14 chapters' },
                  { icon: PenLine, text: 'By DevOps Daily' },
                  { icon: Library, text: 'Ebook and paperback' },
                ].map(({ icon: Icon, text }) => (
                  <span key={text} className="inline-flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
                    {text}
                  </span>
                ))}
              </div>

              <div
                id="hero-actions"
                className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center md:mt-8 md:justify-start"
              >
                <Link href="#early-access" className={primaryButton}>
                  <Mail className="h-4 w-4" strokeWidth={1.5} />
                  Get it at launch
                </Link>
                <a href={SAMPLE_PDF} target="_blank" rel="noopener" className={secondaryButton}>
                  <FileText className="h-4 w-4" strokeWidth={1.5} />
                  Read a free sample
                </a>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Free sample: the introduction and chapter 13, 29 pages (PDF, 1.5 MB).
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <SectionSeparator command="cat who-its-for.md" />
        <section className="mx-auto max-w-5xl">
          <SectionHeader label="readers" title="Who it's for" />
          <div className="grid gap-4 sm:grid-cols-3">
            {readers.map((reader) => (
              <div key={reader.title} className="rounded-md border border-border bg-card p-5">
                <p className="mb-2 font-medium">{reader.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{reader.text}</p>
              </div>
            ))}
          </div>
        </section>

        <SectionSeparator command="cat table-of-contents.md" />
        <section className="mx-auto max-w-5xl">
          <SectionHeader
            label="contents"
            title="What's in the book"
            description='Chapters 1 to 14 each open with a short scenario and end with "Your Next Steps".'
          />
          {/* Columns, so the list reads top to bottom like a book's contents page. */}
          <ol className="gap-x-12 sm:columns-2">
            {chapters.map((chapter) => (
              <li
                key={chapter.title}
                className="flex break-inside-avoid gap-4 border-b border-border py-4"
              >
                <span className="w-6 shrink-0 pt-0.5 font-mono text-sm tabular-nums text-primary">
                  {chapter.number}
                </span>
                <div className="min-w-0">
                  <p className="font-medium leading-snug">
                    {chapter.title}
                    {chapter.sample && (
                      <a
                        href={SAMPLE_PDF}
                        target="_blank"
                        rel="noopener"
                        className="ml-2 inline-block rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 align-middle font-mono text-xs font-normal text-primary transition-colors hover:border-primary/50"
                      >
                        free sample
                      </a>
                    )}
                    {chapter.tag && (
                      <span className="ml-2 inline-block rounded-md border border-border px-2 py-0.5 align-middle font-mono text-xs font-normal text-muted-foreground">
                        {chapter.tag}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{chapter.line}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mb-3 mt-8 font-mono text-xs text-muted-foreground">{'// at the back'}</p>
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            {backMatter.map((item) => (
              <div key={item.title}>
                <dt className="font-medium">{item.title}</dt>
                <dd className="mt-1 text-muted-foreground">{item.line}</dd>
              </div>
            ))}
          </dl>
        </section>

        <SectionSeparator command="open sample.pdf" />
        <section className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-5 rounded-md border border-primary/30 bg-primary/5 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-background sm:flex">
              <FileText className="h-6 w-6 text-primary" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="mb-1 font-mono text-xs text-muted-foreground">{'// free sample'}</p>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Read the introduction and chapter 13
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                29 pages, including all of The Agent Has Production Access. PDF, 1.5 MB. No sign-up
                needed.
              </p>
            </div>
            <a
              href={SAMPLE_PDF}
              target="_blank"
              rel="noopener"
              className={`${primaryButton} shrink-0`}
            >
              <FileText className="h-4 w-4" strokeWidth={1.5} />
              Read a free sample
            </a>
          </div>
        </section>

        <SectionSeparator command="ls illustrations/" />
        <section className="mx-auto max-w-5xl">
          <SectionHeader
            label="the people you'll meet"
            title="Meet the team"
            description="The scenarios follow one small company and the people you'll work with there."
          />
          <dl className="mb-8 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {cast.map((person) => (
              <div key={person.name}>
                <dt className="font-medium">{person.name}</dt>
                <dd className="text-muted-foreground">{person.role}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-4 sm:grid-cols-2">
            {illustrations.map((illustration) => (
              <figure
                key={illustration.file}
                className="overflow-hidden rounded-md border border-border bg-card"
              >
                <Image
                  src={`${IMG}/${illustration.file}`}
                  alt={illustration.alt}
                  width={1024}
                  height={683}
                  sizes="(min-width: 1024px) 31rem, (min-width: 640px) 50vw, 100vw"
                  className="h-auto w-full"
                />
                <figcaption className="px-4 py-3 text-sm text-muted-foreground">
                  {illustration.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <SectionSeparator command="cat faq.md" />
        <section className="mx-auto max-w-5xl">
          <SectionHeader label="faq" title="Questions" />
          <dl className="grid gap-x-12 gap-y-6 sm:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <dt className="font-medium">{faq.question}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {/* Opsville links to #subscribe and posts may link to #early-access. */}
      <section id="subscribe" className="scroll-mt-20">
        <div className="container mx-auto px-4 pb-16">
          <SectionSeparator command="notify --at-launch" />
          <div
            id="early-access"
            className="mx-auto grid max-w-5xl scroll-mt-20 gap-10 rounded-md border bg-primary/5 p-6 sm:p-10 lg:grid-cols-[3fr_2fr]"
          >
            <div>
              <p className="mb-1 font-mono text-xs text-muted-foreground">{'// early access'}</p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Get it at launch</h2>
              <p className="mb-6 mt-3 text-muted-foreground">
                The book comes out on Leanpub and on Amazon, as a Kindle ebook and a paperback.
                Leave your email and you will hear when it is out.
              </p>
              <EarlyAccessForm />
              <p className="mt-3 text-xs text-muted-foreground">
                You also get the weekly DevOps Daily newsletter. Unsubscribe any time.
              </p>
            </div>

            <div className="lg:border-l lg:border-border lg:pl-10">
              <p className="mb-3 font-mono text-xs text-muted-foreground">{'// at launch'}</p>
              <dl className="space-y-3 text-sm">
                {launchDetails.map((item) => (
                  <div key={item.label} className="flex gap-3">
                    <dt className="w-20 shrink-0 font-medium">{item.label}</dt>
                    <dd className="text-muted-foreground">{item.value}</dd>
                  </div>
                ))}
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 font-medium">License</dt>
                  <dd className="text-muted-foreground">
                    Text and art{' '}
                    <a
                      href="https://creativecommons.org/licenses/by-nc-nd/4.0/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      CC BY-NC-ND 4.0
                    </a>
                    . Code MIT.
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <LaunchBar samplePdf={SAMPLE_PDF} />
    </>
  );
}
