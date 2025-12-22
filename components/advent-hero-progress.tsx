'use client';

import { useState, useEffect } from 'react';

export function AdventHeroProgress() {
  const [currentDay, setCurrentDay] = useState(25);

  useEffect(() => {
    const today = new Date();
    const isDecember = today.getMonth() === 11; // December is month 11
    const calculatedDay = isDecember ? Math.min(today.getDate(), 25) : 25;
    setCurrentDay(calculatedDay);
  }, []);

  return (
    <div className="mt-12 max-w-md mx-auto">
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-muted-foreground">Community Progress</span>
        <span className="font-medium text-primary">{currentDay} / 25 days</span>
      </div>
      <div className="h-3 bg-card border border-border rounded-full overflow-hidden">
        <div
          className="h-full bg-linear-to-r from-red-500 via-primary to-green-500 transition-all duration-1000 ease-out"
          style={{ width: `${(currentDay / 25) * 100}%` }}
        />
      </div>
    </div>
  );
}
