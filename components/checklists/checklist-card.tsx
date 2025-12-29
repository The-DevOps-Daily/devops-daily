import Link from 'next/link';
import { Clock, ChevronRight, BarChart3 } from 'lucide-react';
import { Checklist } from '@/lib/checklist-utils';

interface ChecklistCardProps {
  checklist: Checklist;
  progress?: number;
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

export function ChecklistCard({ checklist, progress }: ChecklistCardProps) {
  return (
    <Link href={`/checklists/${checklist.slug}`}>
      <div className="group h-full border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:border-blue-500 dark:hover:border-blue-400 bg-white dark:bg-gray-800">
        <div className="flex items-start justify-between mb-3">
          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
            categoryColors[checklist.category as keyof typeof categoryColors] || 'bg-gray-100 text-gray-700'
          }`}>
            {checklist.category}
          </span>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
        </div>

        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {checklist.title}
        </h3>

        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
          {checklist.description}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <BarChart3 className="w-3.5 h-3.5" />
            <span className={difficultyColors[checklist.difficulty]}>
              {checklist.difficulty.charAt(0).toUpperCase() + checklist.difficulty.slice(1)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            {checklist.estimatedTime}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {checklist.items.length} items
          </div>
        </div>

        {progress !== undefined && progress > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-gray-600 dark:text-gray-400">Progress</span>
              <span className="font-semibold text-green-600 dark:text-green-400">{progress}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
