import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Zap,
  Target,
  Clock,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Code,
  Container,
  Layers,
  Server,
  Workflow,
  Activity,
  Database,
  Shield,
  Cloud,
  GitBranch,
  Terminal,
  Settings,
  LucideIcon,
} from 'lucide-react';
import { getFeaturedExercises } from '@/lib/exercises';
import type { Exercise } from '@/lib/exercises-types';

const iconComponents: Record<string, LucideIcon> = {
  Container,
  Layers,
  Server,
  Workflow,
  Activity,
  Database,
  Shield,
  Cloud,
  GitBranch,
  Terminal,
  Code,
  Settings,
};

// Featured Exercise Card Component (enhanced for homepage)
function FeaturedExerciseCard({ exercise, index }: { exercise: Exercise; index: number }) {
  const difficultyColors = {
    beginner:
      'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800',
    intermediate:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    advanced:
      'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800',
  };

  const environmentColors = {
    local: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    cloud: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    browser: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    container: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400',
  };

  const IconComponent = iconComponents[exercise.icon] || Code;

  return (
    <Link href={`/exercises/${exercise.id}`} className="block group">
      <Card
        className={cn(
          'relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 border-2',
          'bg-linear-to-br from-background via-background to-muted/20',
          exercise.featured && 'ring-2 ring-primary/20 border-primary/30'
        )}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 transition-opacity duration-500 opacity-5 group-hover:opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(59,130,246,0.3)_1px,transparent_0)] bg-size-[20px_20px]" />
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 transition-opacity duration-500 opacity-0 bg-linear-to-br from-primary/5 via-transparent to-purple/5 group-hover:opacity-100" />

        {/* Featured Badge */}
        {exercise.featured && (
          <div className="absolute z-10 top-4 right-4">
            <Badge className="text-white border-none shadow-lg bg-linear-to-r from-yellow-500 to-orange-500">
              <Zap className="w-3 h-3 mr-1" />
              Featured
            </Badge>
          </div>
        )}

        {/* Ranking Badge for first 3 */}
        {index < 3 && (
          <div className="absolute z-10 top-4 left-4">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg',
                index === 0 && 'bg-linear-to-r from-yellow-400 to-yellow-600',
                index === 1 && 'bg-linear-to-r from-gray-300 to-gray-500',
                index === 2 && 'bg-linear-to-r from-amber-600 to-amber-800'
              )}
            >
              {index + 1}
            </div>
          </div>
        )}

        <CardHeader className="relative pb-4">
          <div className="flex items-start gap-4">
            <div className="p-4 transition-transform duration-300 border shadow-sm rounded-2xl bg-linear-to-br from-primary/10 to-primary/5 border-primary/20 group-hover:scale-110">
              <IconComponent className="w-7 h-7 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <CardTitle className="mb-3 text-xl font-bold transition-colors duration-300 group-hover:text-primary line-clamp-2">
                {exercise.title}
              </CardTitle>

              <div className="flex items-center gap-2 mb-3">
                <Badge
                  variant="outline"
                  className={cn('text-xs border', difficultyColors[exercise.difficulty])}
                >
                  {exercise.difficulty}
                </Badge>

                <Badge
                  variant="outline"
                  className={cn('text-xs', environmentColors[exercise.environment])}
                >
                  {exercise.environment}
                </Badge>

                <Badge variant="secondary" className="text-xs">
                  {exercise.category.name}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative">
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground line-clamp-3">
            {exercise.description}
          </p>

          {/* Technologies */}
          <div className="flex flex-wrap gap-1 mb-4">
            {exercise.technologies.slice(0, 4).map((tech) => (
              <Badge key={tech} variant="outline" className="h-5 px-2 py-0 text-xs bg-muted/50">
                {tech}
              </Badge>
            ))}
            {exercise.technologies.length > 4 && (
              <Badge variant="outline" className="h-5 px-2 py-0 text-xs bg-muted/50">
                +{exercise.technologies.length - 4}
              </Badge>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between mb-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{exercise.estimatedTime}</span>
              </div>

              <div className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                <span>{exercise.steps.length} steps</span>
              </div>
            </div>

            {exercise.difficulty === 'beginner' && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-3 h-3" />
                <span>Beginner-friendly</span>
              </div>
            )}
          </div>

          {/* Learning objectives preview */}
          <div className="pt-4 border-t border-border/50">
            <h4 className="mb-2 text-xs font-medium text-muted-foreground">You'll learn:</h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {exercise.learningObjectives.slice(0, 2).map((objective, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                  <span className="line-clamp-1">{objective}</span>
                </li>
              ))}
              {exercise.learningObjectives.length > 2 && (
                <li className="font-medium text-primary">
                  +{exercise.learningObjectives.length - 2} more objectives
                </li>
              )}
            </ul>
          </div>

          {/* Hover CTA */}
          <div className="absolute inset-0 flex items-end justify-center pb-6 transition-all duration-300 rounded-lg opacity-0 bg-linear-to-t from-background/95 via-background/70 to-transparent group-hover:opacity-100">
            <Button
              size="sm"
              className="transition-transform duration-300 transform translate-y-4 shadow-lg group-hover:translate-y-0"
            >
              Start Exercise
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

interface FeaturedExercisesProps {
  className?: string;
}

export default async function FeaturedExercises({ className }: FeaturedExercisesProps) {
  const featuredExercises = await getFeaturedExercises(3);

  if (featuredExercises.length === 0) {
    return null;
  }

  return (
    <section className={cn('relative overflow-hidden', className)}>
      {/* Background Decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-20 w-96 h-96 bg-primary/5 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px] animate-pulse animation-delay-2000" />
      </div>

      <div className="flex items-center justify-between mb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="text-yellow-600 bg-linear-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/50 dark:text-yellow-400"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Featured Labs
            </Badge>
            <Badge variant="outline" className="text-blue-600 bg-linear-to-r from-blue-500/10 to-primary/10 border-blue-500/50 dark:text-blue-400">
              <TrendingUp className="w-3 h-3 mr-1" />
              Most Popular
            </Badge>
          </div>

          <div>
            <h2 className="text-4xl font-bold tracking-tight text-transparent bg-linear-to-r from-foreground via-foreground to-muted-foreground bg-clip-text">
              Hands-On DevOps Exercises
            </h2>
            <p className="max-w-2xl mt-3 text-lg text-muted-foreground">
              Practice real-world DevOps scenarios with step-by-step guidance. Build skills through
              interactive exercises designed by industry experts.
            </p>
          </div>
        </div>

        <div className="hidden md:block">
          <Button asChild variant="outline" size="lg" className="group">
            <Link href="/exercises">
              View All Exercises
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Featured Exercises Grid */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {featuredExercises.map((exercise, index) => (
          <FeaturedExerciseCard key={exercise.id} exercise={exercise} index={index} />
        ))}
      </div>

      {/* Mobile CTA */}
      <div className="mt-8 text-center md:hidden">
        <Button asChild size="lg" className="group">
          <Link href="/exercises">
            View All Exercises
            <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-6 mt-16 md:grid-cols-3">
        <Card className="p-6 text-center border-blue-200 bg-linear-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 dark:border-blue-800">
          <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-blue-500/10">
            <Target className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-blue-600">15+</h3>
          <p className="text-sm text-blue-600/80">Interactive Exercises</p>
        </Card>

        <Card className="p-6 text-center border-green-200 bg-linear-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 dark:border-green-800">
          <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-green-500/10">
            <Clock className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-green-600">60 min</h3>
          <p className="text-sm text-green-600/80">Average Duration</p>
        </Card>

        <Card className="p-6 text-center border-purple-200 bg-linear-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 dark:border-purple-800">
          <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-purple-500/10">
            <CheckCircle2 className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-2xl font-bold text-purple-600">5k+</h3>
          <p className="text-sm text-purple-600/80">Completed Labs</p>
        </Card>
      </div>

      {/* Bottom CTA Section */}
      <div className="mt-16 text-center">
        <div className="p-8 border rounded-2xl bg-linear-to-r from-primary/5 via-purple-500/5 to-pink-500/5 border-primary/10">
          <h3 className="mb-2 text-xl font-bold">Ready to level up your DevOps skills?</h3>
          <p className="max-w-md mx-auto mb-4 text-muted-foreground">
            Join thousands of engineers learning DevOps through hands-on practice
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button asChild>
              <Link href="/exercises">Browse All Exercises</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/roadmap">View Learning Path</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
