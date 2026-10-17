'use client';

import { AdventProgressProvider } from './advent-progress-provider';
import { AdventProgressStats } from './advent-progress-stats';
import { AdventCalendarGrid } from './advent-calendar-grid';
import { useOpenAdventDays } from '@/hooks/use-open-advent-days';
import type { AdventDay } from '@/lib/advent';

interface AdventLandingClientProps {
  days: AdventDay[];
}

export function AdventLandingClient({ days }: AdventLandingClientProps) {
  const currentDay = useOpenAdventDays();

  return (
    <AdventProgressProvider>
      {/* Progress Stats - sticky sidebar */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main content */}
          <div className="lg:col-span-9">
            <div className="mb-8">
              <p className="text-xs font-mono text-muted-foreground mb-1">// daily challenges</p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Daily Challenges</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose any day to start your DevOps learning journey
              </p>
            </div>

            <AdventCalendarGrid days={days} currentDay={currentDay} />
          </div>

          {/* Sidebar with stats */}
          <aside className="order-first lg:order-none lg:col-span-3">
            <div className="lg:sticky lg:top-8">
              <AdventProgressStats />
            </div>
          </aside>
        </div>
      </div>
    </AdventProgressProvider>
  );
}
