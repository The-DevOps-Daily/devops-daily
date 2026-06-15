import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Bug,
  CheckCircle2,
  GitPullRequest,
  Heart,
  MessageSquare,
  PenLine,
  Scale,
  Sparkles,
  Trophy,
  Wrench,
} from 'lucide-react';
import { PageHero } from '@/components/page-hero';
import { SectionHeader } from '@/components/section-header';
import { SectionSeparator } from '@/components/section-separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Github } from '@/components/icons/social-icons';

// Single source of truth for the launch prize so it is one edit to change.
const WEEKLY_PRIZE = '$50';
const REPO_URL = 'https://github.com/The-DevOps-Daily/devops-daily';
const SUBMIT_URL = `${REPO_URL}/tree/main/content/community`;
const DISCORD_URL = 'https://discord.gg/devopsdaily';

export const metadata: Metadata = {
  title: 'Community Writing Challenge',
  description:
    'Write for DevOps Daily. Publish a technical article to thousands of engineers by opening a pull request, and the most popular community post each week wins a cash prize.',
  alternates: { canonical: '/community' },
  openGraph: {
    title: 'Community Writing Challenge - DevOps Daily',
    description:
      'Open a pull request, get your article published, and win the weekly prize for the most popular community post.',
    type: 'website',
    url: '/community',
    images: [
      {
        url: '/images/pages/community.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Daily Community Writing Challenge',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Community Writing Challenge - DevOps Daily',
    description:
      'Open a pull request, get your article published, and win the weekly prize for the most popular community post.',
    images: ['/images/pages/community.png'],
  },
};

const steps = [
  {
    icon: PenLine,
    title: '1. Write what you know',
    description:
      'A war story, a deep dive, a tool comparison, a postmortem. If you shipped it or debugged it at 3am, it makes a good post.',
  },
  {
    icon: GitPullRequest,
    title: '2. Open a pull request',
    description:
      'Add your article as a Markdown file to our open GitHub repo and open a PR. The same workflow you already use every day.',
  },
  {
    icon: CheckCircle2,
    title: '3. We review and merge',
    description:
      'A maintainer checks it for accuracy and clarity, suggests edits if needed, and publishes it under Community with your byline.',
  },
  {
    icon: Trophy,
    title: '4. Win the week',
    description: `The published community post with the most reader applause from Monday to Sunday wins ${WEEKLY_PRIZE}.`,
  },
];

const topics = [
  {
    icon: Bug,
    title: 'War stories and postmortems',
    description: 'The outage that taught you something. What broke, how you found it, what you changed.',
  },
  {
    icon: BookOpen,
    title: 'Deep dives',
    description: 'How a protocol, a tool, or a piece of infrastructure actually works under the hood.',
  },
  {
    icon: Wrench,
    title: 'Hands-on tutorials',
    description: 'A real setup someone can follow end to end, with the gotchas you hit along the way.',
  },
  {
    icon: Scale,
    title: 'Honest comparisons',
    description: 'Two tools, measured against real use. What you picked, what you would not pick again.',
  },
];

const rules = [
  'Your work must be original and your own. No reposts, no AI-generated filler. If you used an AI assistant, disclose it.',
  'You keep the credit. Every community post carries your byline and links back to you.',
  'A maintainer reviews every submission. Merge decisions are based on accuracy, clarity, and fit.',
  'One prize per week, to the single most-applauded community post published that week.',
  'Be accurate and be kind. Cite sources, do not punch down, and do not post anything you do not have the right to share.',
];

const faqs = [
  {
    q: 'Do I need to be an expert?',
    a: 'No. Some of the best posts come from someone explaining the thing they just learned. If it is true, useful, and your own experience, it belongs here.',
  },
  {
    q: 'What if my pull request is not merged?',
    a: 'You will get review feedback explaining why, usually with concrete edits. Most posts that get declined are factually off or too thin, and both are fixable. Revise and push again.',
  },
  {
    q: 'How is the most popular post decided?',
    a: 'Every community post has a reader applause button with a public count. The post with the most applause from Monday 00:00 to Sunday 23:59 UTC wins that week. Counts are visible on each post, so the leaderboard is transparent.',
  },
  {
    q: 'Can I submit more than one post?',
    a: 'Yes. There is no limit on submissions, though a given week only awards one prize.',
  },
  {
    q: 'How do I get paid?',
    a: `Winners are contacted after the week closes and paid ${WEEKLY_PRIZE} by a standard method such as PayPal or Wise. Where a cash prize is not allowed, we will arrange an equivalent.`,
  },
];

export default function CommunityPage() {
  return (
    <div className="min-h-screen">
      <PageHero
        title="Write for DevOps Daily. Get merged. Get paid."
        accentWord="Get paid"
        badge="New"
        icon={PenLine}
        description={`A weekly writing challenge for the community. Publish a technical article to thousands of engineers by opening a pull request, and the most popular community post each week wins ${WEEKLY_PRIZE}.`}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Community' }]}
        stats={[
          { label: 'weekly prize', value: WEEKLY_PRIZE },
          { label: 'new winner', value: 'Every week' },
          { label: 'open to', value: 'Everyone' },
        ]}
      >
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <a href={SUBMIT_URL} target="_blank" rel="noopener noreferrer">
              <GitPullRequest className="mr-2 h-4 w-4" />
              Submit your post
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
              <MessageSquare className="mr-2 h-4 w-4" />
              Ask in Discord
            </a>
          </Button>
        </div>
      </PageHero>

      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeader
            label="how-it-works"
            title="Four steps from idea to published"
            description="No new accounts, no proprietary editor. If you can open a pull request, you can take part."
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {steps.map((step) => (
              <Card key={step.title} className="h-full">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 p-2.5">
                      <step.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{step.title}</CardTitle>
                      <CardDescription className="mt-1.5">{step.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <SectionSeparator command="cd /community/topics" />

      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeader
            label="what-to-write"
            title="What makes a good community post"
            description="Technical, honest, and grounded in something you actually did. Here is the kind of thing that lands."
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {topics.map((topic) => (
              <Card key={topic.title} className="h-full">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 p-2.5">
                      <topic.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{topic.title}</CardTitle>
                      <CardDescription className="mt-1.5">{topic.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <Card className="border-primary/30 bg-primary/[0.04]">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <Badge variant="secondary" className="mb-1.5 gap-1">
                    <Sparkles className="h-3 w-3" /> How winners are picked
                  </Badge>
                  <CardTitle className="text-xl">The most applauded post wins</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Every published community post carries a reader applause button with a count anyone can
                see. From Monday to Sunday, the post that collects the most applause takes the{' '}
                <span className="font-semibold text-foreground">{WEEKLY_PRIZE}</span> prize for that week.
              </p>
              <p>
                The count is public, so the running leaderboard is never a mystery. It rewards posts that
                genuinely resonate, not just the ones that landed on the busiest day. Share your post,
                bring your readers, and let the applause speak.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <SectionSeparator command="cat /community/rules.md" />

      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <SectionHeader label="the-rules" title="The fine print, kept short" />
          <ul className="space-y-3">
            {rules.map((rule) => (
              <li key={rule} className="flex gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <SectionHeader label="faq" title="Questions, answered" />
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={faq.q} value={`faq-${i}`}>
                <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-24 pt-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold sm:text-3xl">Got something worth writing about?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Open a pull request with your article and join this week&apos;s challenge. Worst case, you get
            a published, edited post with your name on it in front of thousands of engineers.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <a href={SUBMIT_URL} target="_blank" rel="noopener noreferrer">
                <Github className="mr-2 h-4 w-4" />
                Submit your post
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/posts">Read recent posts</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
