'use client';

import { useState, useEffect } from 'react';
import { Calendar, Zap } from 'lucide-react';

const EVENT_START = new Date('2026-10-01T00:00:00Z');
const EVENT_END = new Date('2026-10-08T00:00:00Z');

export function HacktoberfestCountdown() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!now) return null;

  const isLive = now >= EVENT_START && now < EVENT_END;
  const isOver = now >= EVENT_END;
  const diff = EVENT_START.getTime() - now.getTime();

  if (isOver) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-card text-sm">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">Hacktoberfest 2026 has ended. See you next year!</span>
      </div>
    );
  }

  if (isLive) {
    const dayDiff = Math.floor((now.getTime() - EVENT_START.getTime()) / (1000 * 60 * 60 * 24));
    const currentDay = Math.min(dayDiff + 1, 7);
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-sm">
        <Zap className="w-4 h-4 text-emerald-500 animate-pulse" />
        <span className="font-semibold text-emerald-500">LIVE - Day {currentDay} of 7</span>
      </div>
    );
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">Starts in</span>
      <div className="flex gap-2">
        {[
          { value: days, label: 'd' },
          { value: hours, label: 'h' },
          { value: minutes, label: 'm' },
          { value: seconds, label: 's' },
        ].map((unit) => (
          <div
            key={unit.label}
            className="flex items-baseline gap-0.5 px-2 py-1 rounded bg-card border font-mono text-sm"
          >
            <span className="font-semibold tabular-nums">{unit.value.toString().padStart(2, '0')}</span>
            <span className="text-xs text-muted-foreground">{unit.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
