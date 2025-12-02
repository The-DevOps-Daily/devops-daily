'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Trophy, Sparkles } from 'lucide-react';
import { useAdventProgress } from './advent-progress-provider';
import confetti from 'canvas-confetti';

interface CompletionButtonProps {
  day: number;
  title: string;
}

export function AdventCompletionButton({ day, title }: CompletionButtonProps) {
  const { isCompleted, markComplete, markIncomplete } = useAdventProgress();
  const [completed, setCompleted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setCompleted(isCompleted(day));
  }, [day, isCompleted]);

  const handleToggle = () => {
    if (completed) {
      markIncomplete(day);
      setCompleted(false);
    } else {
      markComplete(day);
      setCompleted(true);
      setIsAnimating(true);

      // Celebrate with confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#10b981', '#ef4444', '#fbbf24'],
      });

      setTimeout(() => setIsAnimating(false), 1000);
    }
  };

  return (
    <div className="my-8">
      <div
        className={`rounded-xl border-2 p-6 transition-all duration-300 ${
          completed
            ? 'border-green-500 bg-green-500/10'
            : 'border-border bg-card/50 backdrop-blur'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            {completed ? (
              <div className="p-3 rounded-full bg-green-500/20">
                <Trophy className="h-8 w-8 text-green-500" />
              </div>
            ) : (
              <div className="p-3 rounded-full bg-primary/20">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">
              {completed ? '🎉 Challenge Completed!' : 'Ready to complete this challenge?'}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {completed
                ? `Great job completing "${title}"! Your progress has been saved.`
                : "Mark this challenge as complete once you've finished the task. We'll track your progress!"}
            </p>

            <button
              onClick={handleToggle}
              disabled={isAnimating}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                completed
                  ? 'bg-muted hover:bg-muted/80 text-foreground'
                  : 'bg-linear-to-r from-primary to-blue-500 hover:shadow-lg hover:shadow-primary/50 text-white'
              } ${isAnimating ? 'scale-110' : 'scale-100'}`}
            >
              {completed ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Mark as Incomplete
                </>
              ) : (
                <>
                  <Circle className="h-5 w-5" />
                  Mark as Complete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
