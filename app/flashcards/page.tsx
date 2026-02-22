import type { Metadata } from 'next'
import { getAllFlashCardSets } from '@/lib/flashcard-loader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BookOpen,
  Clock,
  Sparkles,
  GitFork,
  Zap,
  ArrowRight,
  Target,
  Activity,
  Trophy,
} from 'lucide-react'
import Link from 'next/link'
import * as Icons from 'lucide-react'

export const metadata: Metadata = {
  title: 'DevOps Flashcards',
  description:
    'Interactive flashcards to memorize and master DevOps concepts, tools, and best practices.',
  alternates: {
    canonical: '/flashcards',
  },
  openGraph: {
    title: 'DevOps Flashcards - DevOps Daily',
    description:
      'Master DevOps concepts with interactive flashcards covering Kubernetes, Docker, Terraform, Git, and more.',
    type: 'website',
    url: '/flashcards',
    images: [
      {
        url: '/images/flashcards/flashcards-og.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Flashcards',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevOps Flashcards - DevOps Daily',
    description:
      'Master DevOps concepts with interactive flashcards covering Kubernetes, Docker, Terraform, Git, and more.',
    images: ['/images/flashcards/flashcards-og.png'],
  },
}

export default async function FlashcardsPage() {
  const flashcardSets = await getAllFlashCardSets()

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-linear-to-br from-purple-500/10 via-blue-500/5 to-indigo-500/10 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-4" variant="secondary">
              <BookOpen className="mr-2 h-3 w-3" />
              {flashcardSets.length} Flashcard Sets
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-linear-to-r from-purple-600 via-blue-600 to-indigo-600">
              Master DevOps Concepts
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Learn and memorize key DevOps concepts with interactive flashcards. Perfect for
              exam prep, interviews, or daily practice.
            </p>
          </div>
        </div>
      </section>

      {/* Flashcard Sets Grid */}
      {flashcardSets.length > 0 ? (
        <section className="py-12 container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Available Flashcard Sets</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose a topic to start learning. Track your progress and review cards you don't know.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {flashcardSets.map((set) => {
              const IconComponent = Icons[set.icon as keyof typeof Icons] || BookOpen
              const difficultyColors = {
                beginner: 'bg-green-500',
                intermediate: 'bg-yellow-500',
                advanced: 'bg-red-500',
              }
              return (
                <Link
                  key={set.id}
                  href={`/flashcards/${set.id}`}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white"
                        style={{
                          background: `linear-gradient(135deg, ${set.theme.gradientFrom}, ${set.theme.gradientTo})`,
                        }}
                      >
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${difficultyColors[set.difficulty]} text-white`}
                      >
                        {set.difficulty}
                      </Badge>
                    </div>

                    <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                      {set.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">{set.description}</p>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        <span>{set.cardCount} cards</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{set.estimatedTime}</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at center, ${set.theme.primaryColor}15 0%, transparent 70%)`,
                    }}
                  />
                </Link>
              )
            })}
          </div>
        </section>
      ) : (
        <section className="py-16 container mx-auto px-4">
          <div className="text-center">
            <BookOpen className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-4">No Flashcard Sets Available</h2>
            <p className="text-muted-foreground mb-8">
              We're working on adding more flashcard sets. Check back soon!
            </p>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-16 container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why Use Flashcards?</h2>
            <p className="text-muted-foreground">
              Flashcards use spaced repetition to help you retain information longer
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
              <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-linear-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Active Recall</h3>
              <p className="text-muted-foreground">
                Test yourself by actively recalling information, which strengthens memory better than passive reading.
              </p>
            </div>

            <div className="text-center p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
              <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Track Progress</h3>
              <p className="text-muted-foreground">
                Mark cards as known or unknown and focus your study time on concepts you need to review.
              </p>
            </div>

            <div className="text-center p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
              <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-linear-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Quick Sessions</h3>
              <p className="text-muted-foreground">
                Study in bite-sized sessions perfect for breaks, commutes, or whenever you have a few minutes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 container mx-auto px-4">
        <div className="bg-linear-to-br from-purple-500/10 via-blue-500/5 to-indigo-500/10 backdrop-blur-sm border border-border/50 rounded-xl p-8 md:p-12">
          <div className="max-w-3xl mx-auto text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-6 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Want to contribute flashcards?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Help us expand our flashcard collection by contributing cards for technologies you know well.
              Share your knowledge with the DevOps community!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="shadow-lg hover:shadow-xl transition-shadow">
                <GitFork className="mr-2 h-4 w-4" />
                <Link href="https://github.com/The-DevOps-Daily/devops-daily/issues/new/choose">
                  Contribute Flashcards
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/quizzes">
                  <Zap className="mr-2 h-4 w-4" />
                  Try DevOps Quizzes
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
