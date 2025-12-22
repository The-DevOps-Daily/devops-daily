'use client';

import { useState, useEffect } from 'react';
import { AdventProgressProvider } from './advent-progress-provider';
import { AdventProgressStats } from './advent-progress-stats';
import { AdventCalendarGrid } from './advent-calendar-grid';
import type { AdventDay } from '@/lib/advent';

interface AdventLandingClientProps {
  days: AdventDay[];
}

export function AdventLandingClient({ days }: AdventLandingClientProps) {
  // Calculate current day on client side to avoid static build issues
  const [currentDay, setCurrentDay] = useState(25);

  useEffect(() => {
    const today = new Date();
    const isDecember = today.getMonth() === 11; // December is month 11
    const calculatedDay = isDecember ? Math.min(today.getDate(), 25) : 25;
    setCurrentDay(calculatedDay);
  }, []);

  return (
    <AdventProgressProvider>
      {/* Progress Stats - sticky sidebar */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main content */}
          <div className="lg:col-span-9">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Daily Challenges</h2>
              <p className="text-lg text-muted-foreground">
                Choose any day to start your DevOps learning journey
              </p>
            </div>

            <AdventCalendarGrid days={days} currentDay={currentDay} />
          </div>

          {/* Sidebar with stats */}
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-8">
              <AdventProgressStats />
            </div>
          </aside>
        </div>
      </div>
    </AdventProgressProvider>
  );
}
