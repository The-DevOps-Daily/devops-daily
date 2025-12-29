'use client';

interface ChecklistProgressProps {
  progress: number;
  totalItems: number;
  completedItems: number;
}

export function ChecklistProgressBar({ 
  progress, 
  totalItems, 
  completedItems 
}: ChecklistProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          Progress
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          {completedItems} / {totalItems} completed
        </span>
      </div>
      <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <div className="text-right">
        <span className="text-2xl font-bold text-green-600 dark:text-green-400">
          {progress}%
        </span>
      </div>
    </div>
  );
}
