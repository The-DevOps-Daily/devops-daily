'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ADVENT_DAYS } from '@/lib/advent-schedule';

interface AdventProgress {
  completedDays: number[];
  lastUpdated: string;
}

interface AdventProgressContextType {
  completedDays: number[];
  isCompleted: (day: number) => boolean;
  markComplete: (day: number) => void;
  markIncomplete: (day: number) => void;
  resetProgress: () => void;
  totalCompleted: number;
  progressPercentage: number;
}

const AdventProgressContext = createContext<AdventProgressContextType | undefined>(undefined);

const STORAGE_KEY = 'advent-of-devops-progress';

function readStoredDays(): number[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const data: Partial<AdventProgress> = JSON.parse(stored);
    if (!Array.isArray(data.completedDays)) return [];
    const valid = data.completedDays.filter(
      (day): day is number => Number.isInteger(day) && day >= 1 && day <= ADVENT_DAYS
    );
    return Array.from(new Set(valid)).sort((a, b) => a - b);
  } catch {
    // Unreadable storage (private mode, corrupted JSON): start empty
    return [];
  }
}

export function AdventProgressProvider({ children }: { children: ReactNode }) {
  const [completedDays, setCompletedDays] = useState<number[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setCompletedDays(readStoredDays());
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever completedDays changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const data: AdventProgress = {
        completedDays,
        lastUpdated: new Date().toISOString(),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage full or unavailable: progress still works for this visit
    }
  }, [completedDays, isLoaded]);

  const isCompleted = (day: number) => completedDays.includes(day);

  const markComplete = (day: number) => {
    setCompletedDays((prev) => {
      if (prev.includes(day)) return prev;
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const markIncomplete = (day: number) => {
    setCompletedDays((prev) => prev.filter((d) => d !== day));
  };

  const resetProgress = () => setCompletedDays([]);

  const totalCompleted = completedDays.length;
  const progressPercentage = Math.round((totalCompleted / ADVENT_DAYS) * 100);

  return (
    <AdventProgressContext.Provider
      value={{
        completedDays,
        isCompleted,
        markComplete,
        markIncomplete,
        resetProgress,
        totalCompleted,
        progressPercentage,
      }}
    >
      {children}
    </AdventProgressContext.Provider>
  );
}

export function useAdventProgress() {
  const context = useContext(AdventProgressContext);
  if (context === undefined) {
    throw new Error('useAdventProgress must be used within AdventProgressProvider');
  }
  return context;
}
