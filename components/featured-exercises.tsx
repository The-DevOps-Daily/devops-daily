import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Clock,
  Target,
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

const difficultyColors: Record<string, string> = {
  beginner: 'bg-green-500/10 text-green-600 dark:text-green-400',
  intermediate: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  advanced: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const IconComponent = iconComponents[exercise.icon] || Code;

  return (
    <Link href={`/exercises/${exercise.id}`} className="group block">
      <div className="rounded-lg border bg-card p-5 h-full transition-all hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <IconComponent className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-2">
              {exercise.title}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="secondary" className={cn('text-xs px-1.5 py-0', difficultyColors[exercise.difficulty])}>
                {exercise.difficulty}
              </Badge>
              <span className="text-xs text-muted-foreground">{exercise.category.name}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
          {exercise.description}
        </p>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {exercise.estimatedTime}
            </span>
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              {exercise.steps.length} steps
            </span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </Link>
  );
}

interface FeaturedExercisesProps {
  className?: string;
}

export default async function FeaturedExercises({ className }: FeaturedExercisesProps) {
  const featuredExercises = await getFeaturedExercises(6);

  if (featuredExercises.length === 0) {
    return null;
  }

  return (
    <section className={cn(className)}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Hands-On Exercises</h2>
          <p className="mt-2 text-muted-foreground">
            Practice real-world DevOps scenarios with step-by-step guidance
          </p>
        </div>
        <Link
          href="/exercises"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View all
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {featuredExercises.map((exercise) => (
          <ExerciseCard key={exercise.id} exercise={exercise} />
        ))}
      </div>

      <Link
        href="/exercises"
        className="sm:hidden inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors mt-4"
      >
        View all exercises
        <ArrowRight className="w-4 h-4" />
      </Link>
    </section>
  );
}
