'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, BarChart3, Tag } from 'lucide-react';
import Confetti from 'react-confetti';
import { Checklist } from '@/lib/checklist-utils';
import { ChecklistItemComponent } from '@/components/checklists/checklist-item';
import { ChecklistProgressBar } from '@/components/checklists/checklist-progress';
import { ChecklistActions } from '@/components/checklists/checklist-actions';
import {
  ChecklistProgress,
  getChecklistProgress,
  saveChecklistProgress,
  calculateProgress,
  resetChecklistProgress,
} from '@/lib/checklist-utils';

interface ChecklistPageClientProps {
  checklist: Checklist;
}

const difficultyColors = {
  beginner: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  intermediate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  advanced: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const categoryColors = {
  Security: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Cloud: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  DevOps: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

export function ChecklistPageClient({ checklist }: ChecklistPageClientProps) {
  const [progress, setProgress] = useState<ChecklistProgress>({});
  const [showConfetti, setShowConfetti] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = getChecklistProgress(checklist.id);
    setProgress(saved);
  }, [checklist.id]);

  const handleToggle = (itemId: string) => {
    const newProgress = { ...progress, [itemId]: !progress[itemId] };
    setProgress(newProgress);
    saveChecklistProgress(checklist.id, newProgress);

    const progressPercentage = calculateProgress(checklist.items, newProgress);
    if (progressPercentage === 100) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }
  };

  const handleReset = () => {
    setProgress({});
    resetChecklistProgress(checklist.id);
  };

  const progressPercentage = calculateProgress(checklist.items, progress);
  const completedCount = checklist.items.filter(item => progress[item.id]).length;

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {showConfetti && mounted && (
        <Confetti
          width={typeof window !== 'undefined' ? window.innerWidth : 0}
          height={typeof window !== 'undefined' ? window.innerHeight : 0}
          recycle={false}
          numberOfPieces={500}
        />
      )}

      <Link
        href="/checklists"
        className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to all checklists
      </Link>

      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`text-sm px-3 py-1 rounded-full font-semibold ${
            categoryColors[checklist.category as keyof typeof categoryColors] || 'bg-gray-100 text-gray-700'
          }`}>
            {checklist.category}
          </span>
          <span className={`text-sm px-3 py-1 rounded-full font-semibold ${
            difficultyColors[checklist.difficulty]
          }`}>
            {checklist.difficulty.charAt(0).toUpperCase() + checklist.difficulty.slice(1)}
          </span>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          {checklist.title}
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
          {checklist.description}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {checklist.estimatedTime}
          </div>
          <div className="flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            {checklist.items.length} items
          </div>
        </div>

        {checklist.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Tag className="w-4 h-4 text-gray-400" />
            {checklist.tags.map(tag => (
              <span
                key={tag}
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-8 p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <ChecklistProgressBar
          progress={progressPercentage}
          totalItems={checklist.items.length}
          completedItems={completedCount}
        />
      </div>

      <div className="mb-8">
        <ChecklistActions
          checklist={checklist}
          progress={progress}
          onReset={handleReset}
        />
      </div>

      <div className="space-y-2 mb-8">
        {checklist.items.map(item => (
          <ChecklistItemComponent
            key={item.id}
            item={item}
            checked={progress[item.id] || false}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {checklist.resources && checklist.resources.length > 0 && (
        <div className="mt-12 p-6 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Additional Resources
          </h2>
          <ul className="space-y-2">
            {checklist.resources.map((resource, index) => (
              <li key={index}>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {resource.title} →
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
