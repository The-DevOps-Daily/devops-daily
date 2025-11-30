import { getAllAdventDays, getAdventIndex } from '@/lib/advent';
import { PostContent } from '@/components/post-content';
import { InlineSponsors } from '@/components/inline-sponsors';
import { Calendar, Trophy, Star, Sparkles, Target, Gift, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Advent of DevOps - 25 Day Challenge | DevOps Daily',
  description:
    'Join the Advent of DevOps challenge! 25 days of hands-on DevOps tasks covering Docker, Kubernetes, CI/CD, security, monitoring, and more. Level up your DevOps skills this December.',
  alternates: {
    canonical: '/advent-of-devops',
  },
  openGraph: {
    type: 'website',
    title: 'Advent of DevOps - 25 Day Challenge',
    description:
      'Join 25 days of hands-on DevOps challenges covering Docker, Kubernetes, CI/CD, and more!',
    url: '/advent-of-devops',
    images: [
      {
        url: '/images/advent/advent-of-devops.png',
        width: 1200,
        height: 630,
        alt: 'Advent of DevOps - 25 Day Challenge',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Advent of DevOps - 25 Day Challenge',
    description:
      'Join 25 days of hands-on DevOps challenges covering Docker, Kubernetes, CI/CD, and more!',
    images: ['/images/advent/advent-of-devops.png'],
  },
};

const difficultyColors = {
  Beginner: 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400',
  Intermediate: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 text-yellow-400',
  Advanced: 'from-red-500/20 to-red-600/20 border-red-500/30 text-red-400',
};

const categoryIcons: Record<string, string> = {
  Docker: '🐳',
  'CI/CD': '🔄',
  Kubernetes: '☸️',
  'Infrastructure as Code': '🏗️',
  Observability: '👁️',
  Security: '🔒',
  Cloud: '☁️',
  Serverless: '⚡',
  Automation: '🤖',
  Performance: '⚡',
  Career: '📝',
};

export default async function AdventOfDevOpsPage() {
  const days = await getAllAdventDays();
  const indexContent = await getAdventIndex();

  // Calculate progress (unlock based on December dates)
  const today = new Date();
  const isDecember = today.getMonth() === 11; // December is month 11
  const currentDay = isDecember ? Math.min(today.getDate(), 25) : 25;

  return (
    <>
      {/* Hero Section with Gradient Background */}
      <div className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-green-500/5" />
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/5 rounded-full blur-3xl animate-pulse delay-500" />
        </div>

        {/* Snowflakes Effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-fall"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${10 + Math.random() * 10}s`,
              }}
            >
              <Star
                className="text-primary/20"
                size={8 + Math.random() * 8}
                fill="currentColor"
              />
            </div>
          ))}
        </div>

        <div className="container relative mx-auto px-4 py-16 md:py-24">
          {/* Hero Content */}
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-red-500/20 to-green-500/20 border border-primary/30 mb-6 animate-fade-in">
              <Gift className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">25 Days of DevOps Challenges</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in-up">
              <span className="bg-gradient-to-r from-red-500 via-primary to-green-500 bg-clip-text text-transparent">
                Advent of DevOps
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground mb-8 animate-fade-in-up delay-100">
              Level up your DevOps skills with 25 days of hands-on challenges
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 mb-12 animate-fade-in-up delay-200">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 backdrop-blur border border-border">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="font-medium">25 Days</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 backdrop-blur border border-border">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="font-medium">Hands-on Challenges</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 backdrop-blur border border-border">
                <Target className="h-5 w-5 text-green-500" />
                <span className="font-medium">Real-world Skills</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 animate-fade-in-up delay-300">
              <Link
                href="#challenges"
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-primary to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-primary/50 transition-all hover:-translate-y-0.5"
              >
                <Sparkles className="h-5 w-5" />
                Start Challenge
                <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="https://x.com/thedevopsdaily"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 font-medium transition-all"
              >
                Follow @thedevopsdaily
              </a>
            </div>

            {/* Progress Bar */}
            <div className="mt-12 max-w-md mx-auto">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Community Progress</span>
                <span className="font-medium text-primary">{currentDay} / 25 days</span>
              </div>
              <div className="h-3 bg-card border border-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-primary to-green-500 transition-all duration-1000 ease-out"
                  style={{ width: `${(currentDay / 25) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Introduction Section */}
      {indexContent && (
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto prose dark:prose-invert">
            <PostContent content={indexContent.content} />
          </div>
        </div>
      )}

      {/* Challenges Grid */}
      <div id="challenges" className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Daily Challenges</h2>
            <p className="text-lg text-muted-foreground">
              Choose any day to start your DevOps learning journey
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {days.map((day, index) => {
              const isUnlocked = day.day <= currentDay;
              const difficultyColor =
                difficultyColors[day.difficulty as keyof typeof difficultyColors] ||
                difficultyColors.Intermediate;
              const categoryIcon = categoryIcons[day.category || ''] || '🎯';

              return (
                <Link
                  key={day.slug}
                  href={`/advent-of-devops/${day.slug}`}
                  className={`group relative block rounded-xl border transition-all duration-300 overflow-hidden ${
                    isUnlocked
                      ? 'border-border hover:border-primary hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-1 cursor-pointer'
                      : 'border-border/50 opacity-60 cursor-not-allowed'
                  }`}
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  {/* Card Background Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-card via-card to-primary/5 opacity-90" />

                  {/* Locked Overlay */}
                  {!isUnlocked && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
                      <div className="text-center">
                        <div className="text-4xl mb-2">🔒</div>
                        <div className="text-sm font-medium text-muted-foreground">
                          Unlocks Dec {day.day}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="relative p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-blue-500/20 border border-primary/30 text-xl font-bold">
                          {day.day}
                        </div>
                        <div className="text-3xl">{categoryIcon}</div>
                      </div>
                      {day.difficulty && (
                        <div
                          className={`px-2 py-1 rounded-md text-xs font-medium border bg-gradient-to-br ${difficultyColor}`}
                        >
                          {day.difficulty}
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {day.title.replace(/^Day \d+ - /, '')}
                    </h3>

                    {/* Excerpt */}
                    {day.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {day.excerpt}
                      </p>
                    )}

                    {/* Category */}
                    {day.category && (
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                        {day.category}
                      </div>
                    )}

                    {/* Hover Arrow */}
                    {isUnlocked && (
                      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="h-5 w-5 text-primary" />
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sponsors Section */}
      <div className="container mx-auto px-4 py-12">
        <InlineSponsors variant="banner" />
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-blue-500/20 to-green-500/20" />
            <div className="relative px-8 py-12 text-center">
              <h2 className="text-3xl font-bold mb-4">Ready to Start Your Journey?</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join the community and share your progress with{' '}
                <a
                  href="https://x.com/thedevopsdaily"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  @thedevopsdaily
                </a>
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/advent-of-devops/day-1"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-primary to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-primary/50 transition-all"
                >
                  <Trophy className="h-5 w-5" />
                  Start Day 1
                </Link>
                <a
                  href="https://github.com/The-DevOps-Daily/devops-daily"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 font-medium transition-all"
                >
                  View on GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
