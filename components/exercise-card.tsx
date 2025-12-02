'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Clock,
  Users,
  Target,
  CheckCircle2,
  AlertCircle,
  Zap,
  LucideIcon,
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
} from 'lucide-react';
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

interface ExerciseCardProps {
  exercise: Exercise;
  className?: string;
  showProgress?: boolean;
  completedSteps?: string[];
}

export function ExerciseCard({
  exercise,
  className,
  showProgress = false,
  completedSteps = [],
}: ExerciseCardProps) {
  const difficultyColors = {
    beginner: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  };

  const environmentColors = {
    local: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    cloud: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    browser: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    container: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400',
  };

  const IconComponent = iconComponents[exercise.icon] || Code;
  const progressPercentage = showProgress
    ? Math.round((completedSteps.length / exercise.steps.length) * 100)
    : 0;

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-500 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 border-2',
        exercise.featured && 'ring-2 ring-primary/20 border-primary/30',
        className
      )}
    >
      {/* Gradient background overlay */}
      <div className="absolute inset-0 transition-opacity duration-500 opacity-0 bg-linear-to-br from-primary/5 via-transparent to-purple/5 group-hover:opacity-100" />

      {/* Featured badge */}
      {exercise.featured && (
        <div className="absolute z-10 top-4 right-4">
          <Badge className="text-white border-none bg-linear-to-r from-yellow-500 to-orange-500">
            <Zap className="w-3 h-3 mr-1" />
            Featured
          </Badge>
        </div>
      )}

      <CardHeader className="relative">
        <div className="flex items-start gap-4">
          <div className="p-3 transition-transform duration-300 border rounded-xl bg-linear-to-br from-primary/10 to-primary/5 border-primary/20 group-hover:scale-110">
            <IconComponent className="w-6 h-6 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-bold transition-colors duration-300 group-hover:text-primary line-clamp-2">
              {exercise.title}
            </CardTitle>

            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant="outline"
                className={cn('text-xs', difficultyColors[exercise.difficulty])}
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
          {exercise.technologies.slice(0, 3).map((tech) => (
            <Badge key={tech} variant="outline" className="h-5 px-2 py-0 text-xs">
              {tech}
            </Badge>
          ))}
          {exercise.technologies.length > 3 && (
            <Badge variant="outline" className="h-5 px-2 py-0 text-xs">
              +{exercise.technologies.length - 3}
            </Badge>
          )}
        </div>

        {/* Progress bar for ongoing exercises */}
        {showProgress && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1 text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progressPercentage}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full transition-all duration-300 rounded-full bg-linear-to-r from-primary to-primary/80"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
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
        <div className="pt-4 mt-4 border-t border-border/50">
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

        {/* Hover overlay with CTA */}
        <div className="absolute inset-0 flex items-end justify-center pb-6 transition-all duration-300 opacity-0 bg-linear-to-t from-background/95 via-background/70 to-transparent group-hover:opacity-100">
          <Link
            href={`/exercises/${exercise.id}`}
            className="px-4 py-2 text-sm font-medium transition-transform duration-300 transform translate-y-4 rounded-lg bg-primary text-primary-foreground group-hover:translate-y-0 hover:bg-primary/90"
          >
            Start Exercise
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
