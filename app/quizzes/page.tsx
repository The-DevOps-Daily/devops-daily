import type { Metadata } from 'next';
import { QuizManager } from '@/components/games/quiz-manager';
import { getQuizMetadata } from '@/lib/quiz-loader';
import { QuizzesHero } from '@/components/quizzes-hero';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  Target,
  Sparkles,
  BookOpen,
  ArrowRight,
  Activity,
  Zap,
  GitFork,
} from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'DevOps Quizzes & Tests',
  description:
    'Interactive quizzes to test and improve your DevOps knowledge across various technologies and practices.',
  alternates: {
    canonical: '/quizzes',
  },
  openGraph: {
    title: 'DevOps Quizzes & Tests - DevOps Daily',
    description:
      'Test your DevOps knowledge with interactive quizzes covering Git, Docker, Kubernetes, Terraform, and more.',
    type: 'website',
    url: '/quizzes',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Quizzes',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevOps Quizzes & Tests - DevOps Daily',
    description:
      'Test your DevOps knowledge with interactive quizzes covering Git, Docker, Kubernetes, Terraform, and more.',
    images: ['/og-image.png'],
  },
};

export default async function QuizzesPage() {
  const quizzes = await getQuizMetadata();

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      <QuizzesHero quizCount={quizzes.length} />

      {/* Quizzes Section */}
      {quizzes.length > 0 ? (
        <section className="py-8 container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Available Quizzes</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose from our collection of DevOps quizzes designed to test your practical knowledge
              and help you identify areas for skill development.
            </p>
          </div>

          <QuizManager quizzes={quizzes} className="mb-16" />
        </section>
      ) : (
        <section className="py-16 container mx-auto px-4">
          <div className="text-center">
            <BookOpen className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-4">No Quizzes Available</h2>
            <p className="text-muted-foreground mb-8">
              We're working on adding more quizzes. Check back soon!
            </p>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-16 container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why Take Our Quizzes?</h2>
            <p className="text-muted-foreground">
              Our quizzes are designed to provide practical learning experiences
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
              <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-linear-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Skill Assessment</h3>
              <p className="text-muted-foreground">
                Evaluate your current knowledge and identify areas for improvement across different
                DevOps technologies.
              </p>
            </div>

            <div className="text-center p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
              <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Interactive Learning</h3>
              <p className="text-muted-foreground">
                Get immediate feedback on your answers with detailed explanations to help you learn
                from mistakes.
              </p>
            </div>

            <div className="text-center p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
              <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-linear-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Track Progress</h3>
              <p className="text-muted-foreground">
                Monitor your improvement over time and see how you stack up against other DevOps
                professionals.
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
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Want to contribute a quiz?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Help us expand our quiz collection by contributing questions for technologies you're
              passionate about. Share your expertise with the DevOps community!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="shadow-lg hover:shadow-xl transition-shadow">
                <GitFork className="mr-2 h-4 w-4" />
                <Link href="https://github.com/The-DevOps-Daily/devops-daily/issues/new/choose">
                  Contribute Questions
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/games">
                  <Zap className="mr-2 h-4 w-4" />
                  Try Interactive Games
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
