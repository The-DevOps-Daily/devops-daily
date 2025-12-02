import { ExercisesList } from '@/components/exercises-list';
import { PageHeader } from '@/components/page-header';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import { getAllExercises, getExerciseStats } from '@/lib/exercises';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Clock, TrendingUp, Users } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DevOps Exercises & Labs - Hands-On Learning',
  description:
    'Practice real-world DevOps skills with our comprehensive collection of hands-on exercises and labs. From Docker to Kubernetes, CI/CD to Infrastructure as Code.',
  alternates: {
    canonical: '/exercises',
  },
  openGraph: {
    title: 'DevOps Exercises & Labs - Hands-On Learning | DevOps Daily',
    description:
      'Practice real-world DevOps skills with our comprehensive collection of hands-on exercises and labs. From Docker to Kubernetes, CI/CD to Infrastructure as Code.',
    url: '/exercises',
    type: 'website',
    images: [
      {
        url: 'https://devops-daily.com/images/exercises-og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Exercises & Labs',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevOps Exercises & Labs - Hands-On Learning | DevOps Daily',
    description:
      'Practice real-world DevOps skills with our comprehensive collection of hands-on exercises and labs.',
    images: ['https://devops-daily.com/images/exercises-og-image.png'],
  },
};

export default async function ExercisesPage() {
  const [exercises, stats] = await Promise.all([getAllExercises(), getExerciseStats()]);

  return (
    <div className="container px-4 py-8 mx-auto">
      <PageHeader
        title="DevOps Exercises & Labs"
        description="Learn DevOps skills through hands-on practice with real-world scenarios"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 mb-12 md:grid-cols-4">
        <Card className="border-blue-200 bg-linear-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 dark:border-blue-800">
          <CardContent className="p-4 text-center">
            <Target className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-blue-600/80">Total Exercises</div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-linear-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 dark:border-green-800">
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold text-green-600">
              {stats.byDifficulty.beginner || 0}
            </div>
            <div className="text-sm text-green-600/80">Beginner Friendly</div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-linear-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 dark:border-purple-800">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold text-purple-600">
              {stats.byDifficulty.advanced || 0}
            </div>
            <div className="text-sm text-purple-600/80">Advanced Labs</div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-linear-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 dark:border-orange-800">
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 text-orange-600" />
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(stats.averageTime)}
            </div>
            <div className="text-sm text-orange-600/80">Avg. Minutes</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Main Content */}
        <div className="lg:col-span-9">
          <ExercisesList exercises={exercises} />
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-3">
          <div className="sticky space-y-6 top-8">
            <SponsorSidebar />
          </div>
        </aside>
      </div>
    </div>
  );
}
