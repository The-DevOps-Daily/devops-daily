import { ExercisesList } from '@/components/exercises-list';
import { PageHeader } from '@/components/page-header';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import { getAllExercises, getExerciseStats } from '@/lib/exercises';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Clock, TrendingUp, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { ExerciseHero } from '@/components/exercises-hero';

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
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">

      <ExerciseHero totalExercises={stats.total} averageTime={Math.round(stats.averageTime)}/>

      <div className="py-8 container mx-auto px-4 grid grid-cols-1 gap-8 lg:grid-cols-12">
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
