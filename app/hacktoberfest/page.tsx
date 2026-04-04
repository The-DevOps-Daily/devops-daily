import { Calendar, GitPullRequest, Users, Star, Github, ArrowRight, CheckCircle2, ExternalLink, Trophy, Zap, BookOpen, Heart, FileCode, Clock, Award, Megaphone, Mail } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BreadcrumbSchema, FAQSchema } from '@/components/schema-markup';
import { InlineSponsors } from '@/components/inline-sponsors';
import { HacktoberfestCountdown } from '@/components/hacktoberfest/countdown';
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
    description: 'Add your profile to the DevOps Experts directory. Get a profile page with a backlink to your site.',
    share: 'Share your new expert profile on X and tag @thedevopsdaily!',
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
    share: 'Tell everyone about your favorite tool - post your PR and tag @thedevopsdaily!',
    difficulty: 'Beginner',
    time: '5 min',
    icon: Zap,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    day: 3,
    title: 'Add a Quiz Question',
    description: 'Add 1 multiple-choice question to an existing quiz. Include an explanation for the answer.',
    share: 'Challenge your followers with your quiz question - share it with #DevOpsDaily!',
    difficulty: 'Beginner',
    time: '5 min',
    icon: Trophy,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  {
    day: 4,
    title: 'Add a Flashcard',
    description: 'Add 1-2 flashcards to an existing flashcard set. Front/back format in JSON.',
    share: 'Share a DevOps concept you think everyone should know - tag @thedevopsdaily!',
    difficulty: 'Beginner',
    time: '5 min',
    icon: BookOpen,
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
  },
  {
    day: 5,
    title: 'Share a Tip',
    description: 'Add a practical tip or gotcha to an existing blog post or guide. Something you learned the hard way.',
    share: 'Share your hard-earned DevOps tip on LinkedIn and tag DevOps Daily!',
    difficulty: 'Beginner',
    time: '10 min',
    icon: Star,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
  },
  {
    day: 6,
    title: 'Find & Fix Something',
    description: 'Browse the site and fix a typo, broken link, outdated info, or formatting issue you spot.',
    share: 'Found and fixed a bug in an open source project! Share your detective work with #Hacktoberfest!',
    difficulty: 'Intermediate',
    time: '10 min',
    icon: CheckCircle2,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    day: 7,
    title: 'Share Your Stack',
    description: 'Write a short profile of your DevOps setup. What tools you use, how they fit together, and why.',
    share: 'Show off your DevOps stack! Post it on X/LinkedIn and tag @thedevopsdaily!',
    difficulty: 'Intermediate',
    time: '15 min',
    icon: Heart,
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
  },
  {
    day: 8,
    title: 'Bonus: Build Something',
    description: 'Go big! Create a new quiz, write a tool comparison, build a checklist, or contribute a game/simulator.',
    share: 'Completed all 8 days of the DevOps Daily Hacktoberfest challenge! #DevOpsDaily #Hacktoberfest',
    difficulty: 'Advanced',
    time: '30+ min',
    icon: Trophy,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    bonus: true,
  },
];

const FAQ_ITEMS = [
  {
    question: 'Do I need to know React or Next.js to participate?',
    answer: 'No! Most contributions are JSON or Markdown files. You just need to know how to fork a repo and submit a pull request.',
  },
  {
    question: 'Do I have to complete all 7 days?',
    answer: 'No, you can pick whichever days interest you. Each day is an independent contribution.',
  },
  {
    question: 'Do these PRs count toward Hacktoberfest?',
    answer: 'Yes! As long as the PRs are accepted and the repo has the hacktoberfest topic, they count toward your Hacktoberfest total.',
  },
  {
    question: 'When does the challenge start?',
    answer: 'October 1, 2026. But you can start exploring the repo and setting up your environment anytime before that.',
  },
  {
    question: 'What is the Experts Directory?',
    answer: 'A page on DevOps Daily where you can list yourself as a DevOps expert with your bio, skills, and links. It gives you a public profile with a backlink to your own site.',
  },
  {
    question: 'Can I contribute outside of the 7-day challenge?',
    answer: 'Absolutely! The challenge is just a structured starting point. We welcome all contributions year-round.',
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
      <FAQSchema questions={FAQ_ITEMS} />

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
              <span className="text-primary relative inline-block">
                DevOps Challenge
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-primary/40" viewBox="0 0 200 12" preserveAspectRatio="none">
                  <path d="M2 9 Q25 2 50 8 Q75 1 100 7 Q125 2 150 9 Q175 4 198 7" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              Contribute to open source in 7 days. No coding required - just JSON and Markdown.
              Each day takes 5-15 minutes and earns you a Hacktoberfest PR.
            </p>

            {/* Hero stats */}
            <div className="flex flex-wrap justify-center gap-6 mb-10">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4 text-primary" />
                <span>7 days + bonus</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitPullRequest className="w-4 h-4 text-primary" />
                <span>8 PRs</span>
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

            {/* Countdown */}
            <div className="flex justify-center mb-10">
              <HacktoberfestCountdown />
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
        {/* What You'll Need */}
        <section className="my-16 max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-8">
            What You Need
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-4 text-center">
              <Github className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
              <h3 className="font-semibold text-sm mb-1">GitHub Account</h3>
              <p className="text-xs text-muted-foreground">Free account to fork repos and submit PRs</p>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <FileCode className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
              <h3 className="font-semibold text-sm mb-1">Text Editor</h3>
              <p className="text-xs text-muted-foreground">VS Code, Vim, or any editor for JSON/Markdown</p>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
              <h3 className="font-semibold text-sm mb-1">5-15 min/day</h3>
              <p className="text-xs text-muted-foreground">Each challenge is quick and focused</p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="my-16 max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-10">
            How It Works
          </h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 sm:gap-0">
            {STEPS.map((s, i) => (
              <div key={s.step} className="flex items-center gap-3 sm:flex-col sm:gap-0 sm:text-center flex-1">
                <div className="flex items-center gap-0 sm:flex-col">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center sm:mb-3 flex-shrink-0">
                    {s.step}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="hidden sm:block w-full h-0.5 bg-primary/20 mt-0 absolute" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-0.5">{s.title}</h3>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="hidden sm:block absolute top-5 -right-3 w-4 h-4 text-primary/30" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Challenge Cards */}
        <section id="challenges" className="my-16 max-w-5xl mx-auto scroll-mt-20">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-4">
            The Challenge
          </h2>
          <p className="text-center text-muted-foreground mb-10 max-w-xl mx-auto">
            One task per day, each building on your familiarity with the project. All contributions are JSON or Markdown edits.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CHALLENGE_DAYS.map((day) => {
              const Icon = day.icon;
              return (
                <Link
                  key={day.day}
                  href={`/hacktoberfest/day-${day.day}`}
                  className={`group rounded-lg border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-sm ${day.bonus ? 'md:col-span-2 border-yellow-500/20 bg-yellow-500/[0.02]' : ''}`}
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
                        {day.bonus && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600 font-medium">
                            Bonus
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                        {day.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {day.description}
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-primary/70">
                        <span>View full instructions</span>
                        <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Rewards */}
        <section className="my-16 max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-4">
            Rewards
          </h2>
          <p className="text-center text-muted-foreground mb-8 max-w-xl mx-auto">
            Every contribution earns you something. Complete all 8 days for a chance to win prizes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <GitPullRequest className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Hacktoberfest PRs</h3>
                <p className="text-xs text-muted-foreground">Each day counts toward your Hacktoberfest badge or tree.</p>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Expert Profile + Backlink</h3>
                <p className="text-xs text-muted-foreground">Day 1 gives you a public profile on our <Link href="/experts" className="text-primary hover:underline">Experts Directory</Link>.</p>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Featured Profile</h3>
                <p className="text-xs text-muted-foreground">Top 3 contributors get a highlighted profile on the experts page for a month.</p>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <Megaphone className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Newsletter Shoutout</h3>
                <p className="text-xs text-muted-foreground">Contributors get featured in the DevOps Daily weekly newsletter.</p>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-5 flex items-start gap-4 md:col-span-2 border-yellow-500/20 bg-yellow-500/[0.02]">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Complete All 8 Days</h3>
                <p className="text-xs text-muted-foreground">Everyone who finishes all 8 days gets DevOps Daily stickers shipped to them, plus a chance to win DigitalOcean credit in our raffle.</p>
              </div>
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

        {/* Share Your Progress */}
        <section className="my-16 max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-4">
            Share Your Progress
          </h2>
          <p className="text-center text-muted-foreground mb-8 max-w-xl mx-auto">
            Each day you contribute, share your PR on social media. Tag us and use <span className="font-mono text-primary">#DevOpsDaily</span> - we repost the best ones!
          </p>
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-2 font-semibold">Copy-paste for X / Twitter:</p>
              <p className="text-sm text-foreground font-mono bg-muted/50 rounded p-3 leading-relaxed">
                {"I just completed Day [X] of the @thedevopsdaily Hacktoberfest challenge! 🎃\n\n[What you did]\n\nJoin the challenge: devops-daily.com/hacktoberfest\n\n#Hacktoberfest #DevOpsDaily #OpenSource"}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-2 font-semibold">Copy-paste for LinkedIn:</p>
              <p className="text-sm text-foreground font-mono bg-muted/50 rounded p-3 leading-relaxed">
                {"Day [X] of the DevOps Daily Hacktoberfest challenge done! ✅\n\n[What you contributed and what you learned]\n\nIt's beginner-friendly and takes just 5-15 minutes per day. Check it out: devops-daily.com/hacktoberfest\n\n#Hacktoberfest #DevOps #OpenSource"}
              </p>
            </div>
          </div>
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

        {/* Contribution Templates */}
        <section className="my-16 max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-4">
            Contribution Templates
          </h2>
          <p className="text-center text-muted-foreground mb-8 max-w-xl mx-auto">
            Copy these templates to get started. Each one shows the exact JSON structure you need.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TEMPLATES.map((tmpl) => (
              <div key={tmpl.day} className="rounded-lg border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-muted/60 border-b border-border/80">
                  <span className="text-xs font-semibold">{tmpl.day}: {tmpl.title}</span>
                  <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
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

        {/* FAQ */}
        <section className="my-16 max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map((faq) => (
              <div key={faq.question} className="rounded-lg border bg-card p-5">
                <h3 className="font-semibold mb-2">{faq.question}</h3>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
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
