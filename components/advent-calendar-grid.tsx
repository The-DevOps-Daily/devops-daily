'use client';

import Link from 'next/link';
import { ChevronRight, CheckCircle2, Lock } from 'lucide-react';
import { useAdventProgress } from './advent-progress-provider';
import type { AdventDay } from '@/lib/advent';

interface AdventCalendarGridProps {
  days: AdventDay[];
  currentDay: number;
}

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

export function AdventCalendarGrid({ days, currentDay }: AdventCalendarGridProps) {
  const { isCompleted } = useAdventProgress();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {days.map((day, index) => {
        const isUnlocked = day.day <= currentDay;
        const completed = isCompleted(day.day);
        const difficultyColor =
          difficultyColors[day.difficulty as keyof typeof difficultyColors] ||
          difficultyColors.Intermediate;
        const categoryIcon = categoryIcons[day.category || ''] || '🎯';

        const CardWrapper = isUnlocked ? Link : 'div';
        const cardProps = isUnlocked ? { href: `/advent-of-devops/${day.slug}` } : {};

        return (
          <CardWrapper
            key={day.slug}
            {...cardProps}
            className={`group relative block rounded-xl border transition-all duration-300 overflow-hidden ${
              isUnlocked
                ? 'border-border hover:border-primary hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-1 cursor-pointer'
                : 'border-border/50 opacity-60 cursor-not-allowed pointer-events-none'
            } ${completed ? 'ring-2 ring-green-500/50' : ''}`}
            style={{
              animationDelay: `${index * 50}ms`,
            }}
          >
            {/* Completion Badge */}
            {completed && (
              <div className="absolute top-2 right-2 z-20 p-2 rounded-full bg-green-500 shadow-lg">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
            )}

            {/* Card Background Gradient */}
            <div className="absolute inset-0 bg-linear-to-br from-card via-card to-primary/5 opacity-90" />

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
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-full border text-xl font-bold ${
                      completed
                        ? 'bg-green-500/20 border-green-500/50 text-green-500'
                        : 'bg-linear-to-br from-primary/20 to-blue-500/20 border-primary/30'
                    }`}
                  >
                    {day.day}
                  </div>
                  <div className="text-3xl">{categoryIcon}</div>
                </div>
                {day.difficulty && (
                  <div
                    className={`px-2 py-1 rounded-md text-xs font-medium border bg-linear-to-br ${difficultyColor}`}
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
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{day.excerpt}</p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between">
                {day.category && (
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                    {day.category}
                  </div>
                )}

                {/* Hover Arrow */}
                {isUnlocked && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="h-5 w-5 text-primary" />
                  </div>
                )}
              </div>
            </div>
          </CardWrapper>
        );
      })}
    </div>
  );
}
