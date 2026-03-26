'use client';

import Link from 'next/link';
import { ChevronRight, CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import type { Exercise } from '@/lib/exercises-types';

interface ExerciseSeriesNavProps {
  currentExercise: Exercise;
  seriesExercises: Exercise[];
}

export function ExerciseSeriesNav({ currentExercise, seriesExercises }: ExerciseSeriesNavProps) {
  if (!currentExercise.series || seriesExercises.length <= 1) return null;

  const currentOrder = currentExercise.series.order;
  const nextExercise = seriesExercises.find((e) => e.series?.order === currentOrder + 1);
  const prevExercise = seriesExercises.find((e) => e.series?.order === currentOrder - 1);

  return (
    <div className="mt-8 rounded-xl border border-border overflow-hidden bg-card">
      {/* Series Header */}
      <div className="bg-muted/50 px-5 py-3 border-b border-border">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <span className="text-primary">Series:</span>
          {currentExercise.series.name}
          <span className="text-muted-foreground text-xs ml-auto">
            Part {currentOrder} of {currentExercise.series.total}
          </span>
        </h3>
      </div>

      {/* Series Steps */}
      <div className="p-4 space-y-1">
        {seriesExercises.map((exercise) => {
          const isCurrent = exercise.id === currentExercise.id;
          const isPast = (exercise.series?.order || 0) < currentOrder;

          return (
            <Link
              key={exercise.id}
              href={`/exercises/${exercise.id}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isCurrent
                  ? 'bg-primary/10 border border-primary/20'
                  : 'hover:bg-muted'
              }`}
            >
              <span className="flex-shrink-0">
                {isPast ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : isCurrent ? (
                  <div className="h-5 w-5 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </span>
              <span className="flex-grow">
                <span
                  className={`text-sm font-medium ${
                    isCurrent ? 'text-primary' : isPast ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {exercise.series?.order}. {exercise.title}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {exercise.difficulty} &middot; {exercise.estimatedTime}
                </span>
              </span>
              {!isCurrent && (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Next Exercise CTA */}
      {nextExercise && (
        <div className="px-4 pb-4">
          <Link
            href={`/exercises/${nextExercise.id}`}
            className="flex items-center justify-between w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <span>Next: {nextExercise.title}</span>
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </div>
      )}
    </div>
  );
}
