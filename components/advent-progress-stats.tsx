'use client';

import { Trophy, Target, Zap, Award, RotateCcw } from 'lucide-react';
import { useAdventProgress } from './advent-progress-provider';

export function AdventProgressStats() {
  const { totalCompleted, progressPercentage, resetProgress } = useAdventProgress();

  const handleReset = () => {
    if (
      window.confirm(
        `Reset your Advent of DevOps progress? This clears ${totalCompleted} completed ${
          totalCompleted === 1 ? 'day' : 'days'
        } in this browser.`
      )
    ) {
      resetProgress();
    }
  };

  const milestones = [
    { threshold: 5, label: 'Getting Started', icon: Zap, color: 'text-blue-500' },
    { threshold: 10, label: 'Making Progress', icon: Target, color: 'text-yellow-500' },
    { threshold: 20, label: 'Almost There', icon: Trophy, color: 'text-orange-500' },
    { threshold: 25, label: 'Champion', icon: Award, color: 'text-green-500' },
  ];

  const currentMilestone =
    milestones.filter((m) => totalCompleted >= m.threshold).pop() || milestones[0];

  const Icon = currentMilestone.icon;

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Your Progress</h3>
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${currentMilestone.color}`} />
          <span className="text-sm font-medium text-muted-foreground">
            {currentMilestone.label}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Challenges Completed</span>
          <span className="font-semibold text-primary">{totalCompleted} / 25</span>
        </div>
        <div className="h-3 bg-muted border border-border rounded-full overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-primary via-blue-500 to-green-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-lg bg-primary/10">
          <div className="text-2xl font-bold text-primary">{totalCompleted}</div>
          <div className="text-xs text-muted-foreground">Completed</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-yellow-500/10">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
            {25 - totalCompleted}
          </div>
          <div className="text-xs text-muted-foreground">Remaining</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-green-500/10">
          <div className="text-2xl font-bold text-green-600 dark:text-green-500">
            {progressPercentage}%
          </div>
          <div className="text-xs text-muted-foreground">Progress</div>
        </div>
      </div>

      {/* Completion message */}
      {totalCompleted === 25 && (
        <div className="mt-4 p-4 rounded-lg bg-linear-to-r from-green-500/20 to-blue-500/20 border border-green-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-5 w-5 text-green-500" />
            <span className="font-semibold text-green-600 dark:text-green-500">
              🎉 Congratulations!
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            You&apos;ve completed all 25 Advent of DevOps challenges! Share your achievement with
            the community!
          </p>
        </div>
      )}

      {totalCompleted > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-xs font-mono text-muted-foreground">
            {'// saved in this browser'}
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-red-500 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
            reset progress
          </button>
        </div>
      )}
    </div>
  );
}
