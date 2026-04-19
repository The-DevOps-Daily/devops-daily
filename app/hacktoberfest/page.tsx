import {
  Calendar,
  GitPullRequest,
  Users,
  Star,
  Github,
  ArrowRight,
  CheckCircle2,
  Trophy,
  Zap,
  BookOpen,
  Heart,
  FileCode,
  Clock,
  Award,
  Megaphone,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BreadcrumbSchema, FAQSchema } from '@/components/schema-markup';
import { InlineSponsors } from '@/components/inline-sponsors';
import { HacktoberfestCountdown } from '@/components/hacktoberfest/countdown';
import { SectionHeader } from '@/components/section-header';
import { SectionSeparator } from '@/components/section-separator';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hacktoberfest 2026 - 7-Day DevOps Contribution Challenge | DevOps Daily',
  description:
    'Join the DevOps Daily Hacktoberfest 2026 challenge! 7 days of beginner-friendly open source contributions. Add your profile, fix bugs, contribute quizzes, flashcards, and more. No coding required.',
  alternates: {
    canonical: '/hacktoberfest',
  },
  openGraph: {
    type: 'website',
    title: 'Hacktoberfest 2026 - 7-Day DevOps Contribution Challenge',
    description:
      'Join the DevOps Daily Hacktoberfest 2026 challenge! 7 days of beginner-friendly open source contributions. No coding required.',
    url: '/hacktoberfest',
    images: [
      {
        url: '/images/hacktoberfest/hacktoberfest-og.png',
        width: 1200,
        height: 630,
        alt: 'Hacktoberfest 2026 - DevOps Daily',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hacktoberfest 2026 - 7-Day DevOps Contribution Challenge',
    description:
      'Join the DevOps Daily Hacktoberfest 2026 challenge! 7 days of beginner-friendly open source contributions.',
    images: ['/images/hacktoberfest/hacktoberfest-og.png'],
  },
};

interface ChallengeDay {
  day: number;
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  time: string;
  icon: LucideIcon;
  bonus?: boolean;
}

const CHALLENGE_DAYS: ChallengeDay[] = [
  {
    day: 1,
    title: 'Add Yourself',
    description:
      'Add your profile to the DevOps Experts directory. Get a profile page with a backlink to your site.',
    difficulty: 'Beginner',
    time: '5 min',
    icon: Users,
  },
  {
    day: 2,
    title: 'Add Your Favorite Tool',
    description:
      'Add a DevOps tool you love to the Toolbox page. Name, description, link, and category.',
    difficulty: 'Beginner',
    time: '5 min',
    icon: Zap,
  },
  {
    day: 3,
    title: 'Add a Quiz Question',
    description:
      'Add 1 multiple-choice question to an existing quiz. Include an explanation for the answer.',
    difficulty: 'Beginner',
    time: '5 min',
    icon: Trophy,
  },
  {
    day: 4,
    title: 'Add a Flashcard',
    description: 'Add 1-2 flashcards to an existing flashcard set. Front/back format in JSON.',
    difficulty: 'Beginner',
    time: '5 min',
    icon: BookOpen,
  },
  {
    day: 5,
    title: 'Share a Tip',
    description:
      'Add a practical tip or gotcha to an existing blog post or guide. Something you learned the hard way.',
    difficulty: 'Beginner',
    time: '10 min',
    icon: Star,
  },
  {
    day: 6,
    title: 'Find & Fix Something',
    description:
      'Browse the site and fix a typo, broken link, outdated info, or formatting issue you spot.',
    difficulty: 'Intermediate',
    time: '10 min',
    icon: CheckCircle2,
  },
  {
    day: 7,
    title: 'Share Your Stack',
    description:
      'Write a short profile of your DevOps setup. What tools you use, how they fit together, and why.',
    difficulty: 'Intermediate',
    time: '15 min',
    icon: Heart,
  },
  {
    day: 8,
    title: 'Bonus: Build Something',
    description:
      'Go big! Create a new quiz, write a tool comparison, build a checklist, or contribute a game/simulator.',
    difficulty: 'Advanced',
    time: '30+ min',
    icon: Trophy,
    bonus: true,
  },
];

const FAQ_ITEMS = [
  {
    question: 'Do I need to know React or Next.js to participate?',
    answer:
      'No! Most contributions are JSON or Markdown files. You just need to know how to fork a repo and submit a pull request.',
  },
  {
    question: 'Do I have to complete all 7 days?',
    answer: 'No, you can pick whichever days interest you. Each day is an independent contribution.',
  },
  {
    question: 'Do these PRs count toward Hacktoberfest?',
    answer:
      'Yes! As long as the PRs are accepted and the repo has the hacktoberfest topic, they count toward your Hacktoberfest total.',
  },
  {
    question: 'When does the challenge start?',
    answer:
      'October 1, 2026. But you can start exploring the repo and setting up your environment anytime before that.',
  },
  {
    question: 'What is the Experts Directory?',
    answer:
      'A page on DevOps Daily where you can list yourself as a DevOps expert with your bio, skills, and links. It gives you a public profile with a backlink to your own site.',
  },
  {
    question: 'Can I contribute outside of the 7-day challenge?',
    answer:
      'Absolutely! The challenge is just a structured starting point. We welcome all contributions year-round.',
  },
];

const TEMPLATES = [
  {
    day: 'Day 1',
    title: 'Expert Profile',
    file: 'content/experts/your-name.json',
    template: `{
  "name": "Your Name",
  "title": "DevOps Engineer",
  "bio": "Short bio about yourself...",
  "avatar": "/images/experts/your-name.jpg",
  "skills": ["Docker", "Kubernetes", "Terraform"],
  "location": "City, Country",
  "website": "https://yoursite.com",
  "github": "your-github",
  "linkedin": "your-linkedin",
  "available": true
}`,
  },
  {
    day: 'Day 4',
    title: 'Quiz Question',
    file: 'content/quizzes/<quiz-name>.json',
    template: `{
  "question": "What command lists running containers?",
  "options": [
    "docker ps",
    "docker list",
    "docker show",
    "docker containers"
  ],
  "correct": 0,
  "explanation": "docker ps lists running containers. Add -a to see all."
}`,
  },
  {
    day: 'Day 5',
    title: 'Flashcard',
    file: 'content/flashcards/<set-name>.json',
    template: `{
  "front": "What is a Kubernetes Pod?",
  "back": "The smallest deployable unit in Kubernetes. A pod wraps one or more containers that share storage and network."
}`,
  },
];

const STEPS: { step: number; title: string; description: string; icon: LucideIcon }[] = [
  {
    step: 1,
    title: 'Star the repo',
    description: 'Star the DevOps Daily repository on GitHub',
    icon: Star,
  },
  {
    step: 2,
    title: 'Fork it',
    description: 'Fork the repo to your own GitHub account',
    icon: GitPullRequest,
  },
  {
    step: 3,
    title: 'Pick a day',
    description: 'Choose a challenge and follow the instructions',
    icon: Calendar,
  },
  {
    step: 4,
    title: 'Submit a PR',
    description: 'Open a pull request with your contribution',
    icon: CheckCircle2,
  },
  {
    step: 5,
    title: 'Share it',
    description: 'Share your PR on social media with #DevOpsDaily',
    icon: Megaphone,
  },
];

export default function HacktoberfestPage() {
  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Hacktoberfest 2026', url: '/hacktoberfest' },
  ];

  return (
    <>
      <BreadcrumbSchema items={breadcrumbItems} />
      <FAQSchema questions={FAQ_ITEMS} />

      {/* Hero */}
      <div className="relative overflow-hidden">
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
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent" />

        <div className="container relative mx-auto px-4 py-16 md:py-20">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs font-mono text-muted-foreground mb-3">// hacktoberfest</p>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-primary/20 bg-primary/5 text-xs font-mono text-primary mb-6 tabular-nums">
              <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
              October 1-7, 2026
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Hacktoberfest 2026
              <br />
              <span className="text-primary relative inline-block">
                DevOps Challenge
                <svg
                  className="absolute -bottom-2 left-0 w-full h-3 text-primary/40"
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 9 Q25 2 50 8 Q75 1 100 7 Q125 2 150 9 Q175 4 198 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              Contribute to open source in 7 days. No coding required, just JSON and Markdown.
              Each day takes 5-15 minutes and earns you a Hacktoberfest PR.
            </p>

            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-10 font-mono text-sm text-muted-foreground tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                7 days + bonus
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GitPullRequest className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                8 PRs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                No coding needed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                Beginner friendly
              </span>
            </div>

            <div className="flex justify-center mb-10">
              <HacktoberfestCountdown />
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <a
                  href="https://github.com/The-DevOps-Daily/devops-daily"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <Github className="w-5 h-5 mr-2" strokeWidth={1.5} />
                  Star & Fork the Repo
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#challenges">View Challenges</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <SectionSeparator command="ls /hacktoberfest/requirements" />

        {/* What You'll Need */}
        <section className="my-12 max-w-3xl mx-auto">
          <SectionHeader label="what you need" title="What You Need" />
          <div className="grid gap-px sm:grid-cols-3 bg-border border rounded-md overflow-hidden">
            <div className="bg-card p-5">
              <Github className="w-5 h-5 text-primary mb-3" strokeWidth={1.5} />
              <h3 className="font-semibold text-sm mb-1">GitHub Account</h3>
              <p className="text-xs text-muted-foreground">
                Free account to fork repos and submit PRs
              </p>
            </div>
            <div className="bg-card p-5">
              <FileCode className="w-5 h-5 text-primary mb-3" strokeWidth={1.5} />
              <h3 className="font-semibold text-sm mb-1">Text Editor</h3>
              <p className="text-xs text-muted-foreground">
                VS Code, Vim, or any editor for JSON/Markdown
              </p>
            </div>
            <div className="bg-card p-5">
              <Clock className="w-5 h-5 text-primary mb-3" strokeWidth={1.5} />
              <h3 className="font-semibold text-sm mb-1 font-mono tabular-nums">5-15 min/day</h3>
              <p className="text-xs text-muted-foreground">Each challenge is quick and focused</p>
            </div>
          </div>
        </section>

        <SectionSeparator command="cat how-it-works.md" />

        {/* How It Works */}
        <section className="my-12 max-w-4xl mx-auto">
          <SectionHeader label="how it works" title="How It Works" />
          <div className="flex flex-col gap-3 sm:hidden">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.step} className="flex items-center gap-4">
                  <div className="relative flex-shrink-0 w-12 h-12 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                    <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-background border border-primary/30 text-primary text-[10px] font-mono tabular-nums font-semibold flex items-center justify-center">
                      {s.step}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{s.title}</h3>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden sm:block">
            <div className="relative">
              <div className="absolute top-6 left-[10%] right-[10%] h-px bg-border" />
              <div className="grid grid-cols-5 gap-4">
                {STEPS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.step} className="text-center relative">
                      <div className="relative w-12 h-12 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3 z-10 bg-background">
                        <Icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-background border border-primary/30 text-primary text-[10px] font-mono tabular-nums font-semibold flex items-center justify-center">
                          {s.step}
                        </span>
                      </div>
                      <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <SectionSeparator command="ls /hacktoberfest/challenges" />

        {/* Challenge Cards */}
        <section id="challenges" className="my-12 max-w-5xl mx-auto scroll-mt-20">
          <SectionHeader
            label="challenges"
            title="The Challenge"
            description="One task per day, each building on your familiarity with the project. All contributions are JSON or Markdown edits."
          />

          {(() => {
            const regularDays = CHALLENGE_DAYS.filter((d) => !d.bonus);
            const bonusDay = CHALLENGE_DAYS.find((d) => d.bonus);
            const regularRemainder = regularDays.length % 2;
            return (
              <>
                <div className="grid gap-px sm:grid-cols-2 bg-border border rounded-md overflow-hidden">
                  {regularDays.map((day) => {
                    const Icon = day.icon;
                    return (
                      <Link
                        key={day.day}
                        href={`/hacktoberfest/day-${day.day}`}
                        className="group bg-card p-5 transition-colors hover:bg-muted/40"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 font-mono text-xs text-muted-foreground tabular-nums">
                              <span>Day {day.day}</span>
                              <span className="text-muted-foreground/60">·</span>
                              <span>{day.difficulty}</span>
                              <span className="text-muted-foreground/60">·</span>
                              <span>{day.time}</span>
                            </div>
                            <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                              {day.title}
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {day.description}
                            </p>
                            <div className="flex items-center gap-1 mt-2 text-xs text-primary/80">
                              <span>View full instructions</span>
                              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  {regularRemainder === 1 && (
                    <div aria-hidden="true" className="bg-card hidden sm:block" />
                  )}
                </div>
                {bonusDay && (
                  <Link
                    href={`/hacktoberfest/day-${bonusDay.day}`}
                    className="group block mt-px rounded-md border bg-primary/5 p-5 transition-colors hover:bg-primary/10"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-md bg-primary/15 flex items-center justify-center">
                        <bonusDay.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 font-mono text-xs text-muted-foreground tabular-nums">
                          <span>Day {bonusDay.day}</span>
                          <span className="text-muted-foreground/60">·</span>
                          <span>{bonusDay.difficulty}</span>
                          <span className="text-muted-foreground/60">·</span>
                          <span>{bonusDay.time}</span>
                          <span className="text-muted-foreground/60">·</span>
                          <span className="text-primary font-semibold">bonus</span>
                        </div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          {bonusDay.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {bonusDay.description}
                        </p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-primary/80">
                          <span>View full instructions</span>
                          <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  </Link>
                )}
              </>
            );
          })()}
        </section>

        <SectionSeparator command="cat rewards.md" />

        {/* Rewards */}
        <section className="my-12 max-w-4xl mx-auto">
          <SectionHeader
            label="rewards"
            title="Rewards"
            description="Every contribution earns you something. Complete all 8 days for a chance to win prizes."
          />
          <div className="grid gap-px sm:grid-cols-2 bg-border border rounded-md overflow-hidden">
            <div className="bg-card p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <GitPullRequest className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Hacktoberfest PRs</h3>
                <p className="text-xs text-muted-foreground">
                  Each day counts toward your Hacktoberfest badge or tree.
                </p>
              </div>
            </div>
            <div className="bg-card p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Expert Profile + Backlink</h3>
                <p className="text-xs text-muted-foreground">
                  Day 1 gives you a public profile on our{' '}
                  <Link href="/experts" className="text-primary hover:underline">
                    Experts Directory
                  </Link>
                  .
                </p>
              </div>
            </div>
            <div className="bg-card p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Featured Profile</h3>
                <p className="text-xs text-muted-foreground">
                  Top 3 contributors get a highlighted profile on the experts page for a month.
                </p>
              </div>
            </div>
            <div className="bg-card p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Megaphone className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Newsletter Shoutout</h3>
                <p className="text-xs text-muted-foreground">
                  Contributors get featured in the DevOps Daily weekly newsletter.
                </p>
              </div>
            </div>
            <div className="sm:col-span-2 bg-primary/5 border-t border-primary/20 p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Complete All 8 Days</h3>
                <p className="text-xs text-muted-foreground">
                  Everyone who finishes all 8 days gets DevOps Daily stickers shipped to them, plus
                  a chance to win DigitalOcean credit in our raffle.
                </p>
              </div>
            </div>
          </div>
        </section>

        <SectionSeparator command="cd /local-setup" />

        {/* Get Set Up */}
        <section className="my-12 max-w-3xl mx-auto">
          <SectionHeader label="setup" title="Get Your Environment Ready" />
          <div className="rounded-md border bg-card overflow-hidden font-mono text-sm">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b border-border/80">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
                <div className="w-3 h-3 rounded-full bg-green-400/70" />
              </div>
              <span className="text-xs text-muted-foreground ml-2">terminal</span>
            </div>
            <div className="p-4 space-y-2">
              <div>
                <span className="text-muted-foreground"># Fork the repo on GitHub, then:</span>
              </div>
              <div>
                <span className="text-green-500">$</span>{' '}
                <span>git clone https://github.com/YOUR_USERNAME/devops-daily.git</span>
              </div>
              <div>
                <span className="text-green-500">$</span> <span>cd devops-daily</span>
              </div>
              <div>
                <span className="text-green-500">$</span> <span>pnpm install</span>
              </div>
              <div>
                <span className="text-green-500">$</span> <span>pnpm dev</span>
              </div>
              <div className="pt-2">
                <span className="text-muted-foreground">
                  # Open http://localhost:3000 and start contributing
                </span>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Need a cloud dev environment?{' '}
            <a
              href="https://m.do.co/c/2a9bba940f39"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Get $200 free credit on DigitalOcean
            </a>{' '}
            to spin up a droplet.
          </p>
        </section>

        <SectionSeparator command="ls /share-templates" />

        {/* Share Your Progress */}
        <section className="my-12 max-w-3xl mx-auto">
          <SectionHeader
            label="share"
            title="Share Your Progress"
            description={`Each day you contribute, share your PR on social media. Tag us and use #DevOpsDaily, we repost the best ones.`}
          />
          <div className="space-y-3">
            <div className="rounded-md border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-2 font-mono">// x / twitter</p>
              <p className="text-sm text-foreground font-mono bg-muted/50 rounded-md p-3 leading-relaxed whitespace-pre-wrap">
                {`I just completed Day [X] of the @thedevopsdaily Hacktoberfest challenge!

[What you did]

Join the challenge: devops-daily.com/hacktoberfest

#Hacktoberfest #DevOpsDaily #OpenSource`}
              </p>
            </div>
            <div className="rounded-md border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-2 font-mono">// linkedin</p>
              <p className="text-sm text-foreground font-mono bg-muted/50 rounded-md p-3 leading-relaxed whitespace-pre-wrap">
                {`Day [X] of the DevOps Daily Hacktoberfest challenge done!

[What you contributed and what you learned]

It's beginner-friendly and takes just 5-15 minutes per day. Check it out: devops-daily.com/hacktoberfest

#Hacktoberfest #DevOps #OpenSource`}
              </p>
            </div>
          </div>
        </section>

        <SectionSeparator command="ls /templates" />

        {/* Templates */}
        <section className="my-12 max-w-5xl mx-auto">
          <SectionHeader
            label="templates"
            title="Contribution Templates"
            description="Copy these templates to get started. Each one shows the exact JSON structure you need."
          />
          <div className="grid gap-px md:grid-cols-3 bg-border border rounded-md overflow-hidden">
            {TEMPLATES.map((tmpl) => (
              <div key={tmpl.day} className="bg-card">
                <div className="flex items-center justify-between px-4 py-2.5 bg-muted/60 border-b border-border/60">
                  <span className="text-xs font-semibold font-mono">
                    {tmpl.day}: {tmpl.title}
                  </span>
                  <FileCode className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <div className="p-3">
                  <p className="text-[10px] text-muted-foreground font-mono mb-2">{tmpl.file}</p>
                  <pre className="text-[11px] font-mono text-muted-foreground overflow-x-auto leading-relaxed">
                    {tmpl.template}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </section>

        <SectionSeparator command="cat faq.md" />

        {/* FAQ */}
        <section className="my-12 max-w-3xl mx-auto">
          <SectionHeader label="faq" title="Frequently Asked Questions" />
          <div className="space-y-3">
            {FAQ_ITEMS.map((faq) => (
              <div key={faq.question} className="rounded-md border bg-card p-5">
                <h3 className="font-semibold mb-2">{faq.question}</h3>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sponsors */}
        <div className="my-12">
          <InlineSponsors variant="compact" />
        </div>

        {/* Final CTA */}
        <section className="my-16 max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to contribute?</h2>
          <p className="text-muted-foreground mb-6">
            Star the repo, fork it, and pick your first challenge. See you in October.
          </p>
          <Button asChild size="lg">
            <a
              href="https://github.com/The-DevOps-Daily/devops-daily"
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <Github className="w-5 h-5 mr-2" strokeWidth={1.5} />
              Get Started on GitHub
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
        </section>
      </div>
    </>
  );
}
