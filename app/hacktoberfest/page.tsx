import { Calendar, GitPullRequest, Users, Star, Github, ArrowRight, CheckCircle2, ExternalLink, Trophy, Zap, BookOpen, Heart } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { InlineSponsors } from '@/components/inline-sponsors';
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

const CHALLENGE_DAYS = [
  {
    day: 1,
    title: 'Add Yourself',
    description: 'Add your profile to the DevOps Engineers Directory. Get a profile page with a backlink to your site.',
    difficulty: 'Beginner',
    time: '5 min',
    icon: Users,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    day: 2,
    title: 'Add Your Favorite Tool',
    description: 'Add a DevOps tool you love to the Toolbox page. Name, description, link, and category.',
    difficulty: 'Beginner',
    time: '5 min',
    icon: Zap,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    day: 3,
    title: 'Fix Something',
    description: 'Find and fix a typo, broken link, or formatting issue in any post or guide.',
    difficulty: 'Beginner',
    time: '10 min',
    icon: CheckCircle2,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    day: 4,
    title: 'Add Quiz Questions',
    description: 'Add 3 multiple-choice questions to an existing quiz. Include explanations for each answer.',
    difficulty: 'Beginner',
    time: '15 min',
    icon: Trophy,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  {
    day: 5,
    title: 'Add Flashcards',
    description: 'Add 5 flashcards to an existing flashcard set. Front/back format in JSON.',
    difficulty: 'Beginner',
    time: '15 min',
    icon: BookOpen,
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
  },
  {
    day: 6,
    title: 'Share a Tip',
    description: 'Add a practical tip or gotcha to an existing blog post or guide. Something you learned the hard way.',
    difficulty: 'Intermediate',
    time: '10 min',
    icon: Star,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
  },
  {
    day: 7,
    title: 'Share Your Stack',
    description: 'Write a short profile of your DevOps setup. What tools you use, how they fit together, and why.',
    difficulty: 'Intermediate',
    time: '15 min',
    icon: Heart,
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
  },
];

const STEPS = [
  { step: 1, title: 'Star the repo', description: 'Star the DevOps Daily repository on GitHub' },
  { step: 2, title: 'Fork it', description: 'Fork the repo to your own GitHub account' },
  { step: 3, title: 'Pick a day', description: 'Choose a challenge and follow the instructions' },
  { step: 4, title: 'Submit a PR', description: 'Open a pull request with your contribution' },
  { step: 5, title: 'Share it', description: 'Share your PR on social media with #DevOpsDaily' },
];

export default function HacktoberfestPage() {
  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Hacktoberfest 2026', url: '/hacktoberfest' },
  ];

  return (
    <>
      <BreadcrumbSchema items={breadcrumbItems} />

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#183d5d]/20 via-background to-[#93c2db]/10" />
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#183d5d]/15 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#93c2db]/10 rounded-full blur-3xl animate-pulse" />
        </div>

        {/* Floating git icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-float"
              style={{
                left: `${8 + (i * 8) % 84}%`,
                top: `${10 + Math.sin(i * 1.5) * 30 + 30}%`,
                animationDelay: `${i * 0.7}s`,
                animationDuration: `${6 + (i % 3) * 2}s`,
              }}
            >
              <GitPullRequest
                className="text-primary/[0.06]"
                size={14 + (i % 4) * 4}
              />
            </div>
          ))}
        </div>

        <div className="container relative mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-sm font-medium text-primary mb-8">
              <Calendar className="w-4 h-4" />
              October 1-7, 2026
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Hacktoberfest 2026
              <br />
              <span className="text-primary">7-Day DevOps Challenge</span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              Contribute to open source in 7 days. No coding required - just JSON and Markdown.
              Each day takes 5-15 minutes and earns you a Hacktoberfest PR.
            </p>

            {/* Hero stats */}
            <div className="flex flex-wrap justify-center gap-6 mb-10">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4 text-primary" />
                <span>7 days</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitPullRequest className="w-4 h-4 text-primary" />
                <span>7 PRs</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="w-4 h-4 text-primary" />
                <span>No coding needed</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4 text-primary" />
                <span>Beginner friendly</span>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="shadow-md shadow-primary/10">
                <a
                  href="https://github.com/The-DevOps-Daily/devops-daily"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <Github className="w-5 h-5 mr-2" />
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
        {/* How It Works */}
        <section className="my-16 max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-10">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            {STEPS.map((s, i) => (
              <div key={s.step} className="relative text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center mx-auto mb-3">
                  {s.step}
                </div>
                <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
                <p className="text-xs text-muted-foreground">{s.description}</p>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="hidden sm:block absolute top-5 -right-2 w-4 h-4 text-muted-foreground/30" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Challenge Cards */}
        <section id="challenges" className="my-16 max-w-5xl mx-auto scroll-mt-20">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-4">
            The 7-Day Challenge
          </h2>
          <p className="text-center text-muted-foreground mb-10 max-w-xl mx-auto">
            One task per day, each building on your familiarity with the project. All contributions are JSON or Markdown edits.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CHALLENGE_DAYS.map((day) => {
              const Icon = day.icon;
              return (
                <div
                  key={day.day}
                  className="group rounded-lg border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${day.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${day.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">Day {day.day}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          {day.difficulty}
                        </span>
                        <span className="text-xs text-muted-foreground/60">{day.time}</span>
                      </div>
                      <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                        {day.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {day.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* What You Get */}
        <section className="my-16 max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-10">
            What You Get
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-lg border bg-card p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <GitPullRequest className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="font-semibold mb-2">Hacktoberfest PRs</h3>
              <p className="text-sm text-muted-foreground">
                Each day counts as a valid Hacktoberfest pull request toward your badge or tree.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="font-semibold mb-2">Your Profile on the Site</h3>
              <p className="text-sm text-muted-foreground">
                Day 1 gives you a profile on our Engineers Directory with a backlink to your own site.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-6 h-6 text-purple-500" />
              </div>
              <h3 className="font-semibold mb-2">Recognition</h3>
              <p className="text-sm text-muted-foreground">
                Top contributors get featured in our newsletter and a shoutout on social media.
              </p>
            </div>
          </div>
        </section>

        {/* Get Set Up */}
        <section className="my-16 max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-8">
            Get Your Environment Ready
          </h2>
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b border-border/80">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
                <div className="w-3 h-3 rounded-full bg-green-400/70" />
              </div>
              <span className="text-xs text-muted-foreground font-mono ml-2">terminal</span>
            </div>
            <div className="p-4 font-mono text-sm space-y-2">
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
                <span className="text-muted-foreground"># Open http://localhost:3000 and start contributing!</span>
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

        {/* Follow Us */}
        <section className="my-16 max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            Stay Updated
          </h2>
          <p className="text-muted-foreground mb-6">
            Follow us for daily challenge reminders, contributor highlights, and DevOps tips.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="https://x.com/thedevopsdaily"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-card hover:border-primary/30 transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              X / Twitter
            </a>
            <a
              href="https://www.linkedin.com/company/thedevopsdaily"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-card hover:border-primary/30 transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              LinkedIn
            </a>
            <a
              href="https://www.instagram.com/thedailydevops"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-card hover:border-primary/30 transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Instagram
            </a>
            <a
              href="https://github.com/The-DevOps-Daily"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-card hover:border-primary/30 transition-colors text-sm"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
          </div>
          <div className="mt-6">
            <Link
              href="/newsletters"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              Subscribe to the newsletter for weekly reminders
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </section>

        {/* Sponsors */}
        <div className="my-16">
          <InlineSponsors variant="compact" />
        </div>

        {/* FAQ */}
        <section className="my-16 max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: 'Do I need to know React or Next.js to participate?',
                a: 'No! Most contributions are JSON or Markdown files. You just need to know how to fork a repo and submit a pull request.',
              },
              {
                q: 'Do I have to complete all 7 days?',
                a: 'No, you can pick whichever days interest you. Each day is an independent contribution.',
              },
              {
                q: 'Do these PRs count toward Hacktoberfest?',
                a: 'Yes! As long as the PRs are accepted and the repo has the hacktoberfest topic, they count toward your Hacktoberfest total.',
              },
              {
                q: 'When does the challenge start?',
                a: 'October 1, 2026. But you can start exploring the repo and setting up your environment anytime before that.',
              },
              {
                q: 'What is the Engineers Directory?',
                a: 'A page on DevOps Daily where you can list yourself as a DevOps engineer with your bio, skills, and links. It gives you a public profile with a backlink to your own site.',
              },
              {
                q: 'Can I contribute outside of the 7-day challenge?',
                a: 'Absolutely! The challenge is just a structured starting point. We welcome all contributions year-round.',
              },
            ].map((faq) => (
              <div key={faq.q} className="rounded-lg border bg-card p-5">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="my-16 max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to contribute?</h2>
          <p className="text-muted-foreground mb-6">
            Star the repo, fork it, and pick your first challenge. See you in October!
          </p>
          <Button asChild size="lg" className="shadow-md shadow-primary/10">
            <a
              href="https://github.com/The-DevOps-Daily/devops-daily"
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <Github className="w-5 h-5 mr-2" />
              Get Started on GitHub
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
        </section>
      </div>
    </>
  );
}
