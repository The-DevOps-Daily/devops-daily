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
  UserPlus,
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
import { Github, Twitter, Linkedin } from '@/components/icons/social-icons';

// Single source of truth for the prize, so the whole page updates from one edit.
const PRIZE_EACH = '$10';
const WEEKLY_WINNERS = 5;
const PRIZE_SUMMARY = `${PRIZE_EACH} each for ${WEEKLY_WINNERS} winners`;
const REPO_URL = 'https://github.com/The-DevOps-Daily/devops-daily';
const SUBMIT_URL = `${REPO_URL}/tree/main/content/community`;
const DISCORD_URL = 'https://discord.gg/devopsdaily';
const X_URL = 'https://x.com/thedevopsdaily';
const LINKEDIN_URL = 'https://www.linkedin.com/company/thedevopsdaily';

export const metadata: Metadata = {
  title: 'Community Writing Challenge',
  description:
    'Write for DevOps Daily. Publish a technical article to thousands of engineers by opening a pull request, and the most popular community posts each week win a cash prize.',
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
      'Add your article as a Markdown file to our open GitHub repo and open a PR. The same workflow you already use every day. Writing with Claude Code? The repo ships a /write-post skill that scaffolds a draft in our format for you.',
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
    description: `Each week the ${WEEKLY_WINNERS} most popular community posts each win ${PRIZE_EACH}. Five winners, every week.`,
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
  'You keep ownership of what you write. Publishing here grants us the right to host it; your byline stays on it and links back to you.',
  'A maintainer reviews every submission. Merge decisions are based on accuracy, clarity, and fit.',
  `${WEEKLY_WINNERS} prizes per week, ${PRIZE_EACH} each, to the week's most popular community posts.`,
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
    q: 'How are the popular posts decided?',
    a: `Popularity is measured by reader engagement (views and reader response) over the week, Monday 00:00 to Sunday 23:59 UTC. The ${WEEKLY_WINNERS} community posts that resonate most that week each win. Sharing your post and bringing your own readers genuinely helps.`,
  },
  {
    q: 'Can I submit more than one post?',
    a: 'Yes, there is no limit on submissions. A single author can also place more than once in a week if multiple posts land.',
  },
  {
    q: 'Can I use AI to help write it?',
    a: 'Yes, as a tool, not a ghostwriter. The experience and judgement must be yours, and you must disclose AI assistance. If you use Claude Code, the repo ships a /write-post skill that scaffolds a draft in our house format and style, which is the fastest way to start.',
  },
  {
    q: 'Do I get an author profile?',
    a: 'Yes. Once your first post is merged, you can add yourself to our Experts directory with a bio, links, and your specialties, so readers (and potential clients) can find you.',
  },
  {
    q: 'How do I get paid?',
    a: `Winners are contacted after the week closes and paid ${PRIZE_EACH} by a standard method such as PayPal or Wise. Where a cash prize is not allowed, we will arrange an equivalent.`,
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
        description={`A weekly writing challenge for the community. Publish a technical article to thousands of engineers by opening a pull request. Every week, the ${WEEKLY_WINNERS} most popular community posts each win ${PRIZE_EACH}.`}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Community' }]}
        stats={[
          { label: 'weekly prizes', value: `${WEEKLY_WINNERS} × ${PRIZE_EACH}` },
          { label: 'new winners', value: 'Every week' },
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
                  <CardTitle className="text-xl">Five winners every week</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Each week, from Monday to Sunday, the{' '}
                <span className="font-semibold text-foreground">{WEEKLY_WINNERS} most popular community
                posts</span> each win <span className="font-semibold text-foreground">{PRIZE_EACH}</span>.
                Popularity comes down to reader engagement over the week, so the writing that genuinely
                helps people is what gets rewarded.
              </p>
              <p>
                Five winners instead of one means more people get paid and more writers have a real shot,
                especially early on. Share your post and bring your own readers, it counts.
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

      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <UserPlus className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">Get merged, then claim your author profile</CardTitle>
                  <CardDescription className="mt-1.5">
                    Once your first post is published, add yourself to our{' '}
                    <Link href="/experts" className="text-primary underline-offset-4 hover:underline">
                      Experts directory
                    </Link>
                    : a profile page with your bio, links, and specialties, so readers and potential
                    clients can find you. It is another pull request, and we will help you set it up.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-4">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-muted/30 p-8 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">Do not miss a challenge</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            We announce each week&apos;s winners and call for the next round on X and LinkedIn. Follow
            along so you know when the clock resets.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline">
              <a href={X_URL} target="_blank" rel="noopener noreferrer">
                <Twitter className="mr-2 h-4 w-4" />
                Follow on X
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
                <Linkedin className="mr-2 h-4 w-4" />
                Follow on LinkedIn
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
                <MessageSquare className="mr-2 h-4 w-4" />
                Join Discord
              </a>
            </Button>
          </div>
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
