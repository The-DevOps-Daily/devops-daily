'use client';

import { useState } from 'react';
import { Download, Share2, RotateCcw, Check, Copy } from 'lucide-react';
import { Checklist, ChecklistProgress, exportToMarkdown, downloadFile, generateShareUrl } from '@/lib/checklist-utils';

interface ChecklistActionsProps {
  checklist: Checklist;
  progress: ChecklistProgress;
  onReset: () => void;
}

export function ChecklistActions({ checklist, progress, onReset }: ChecklistActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleExport = () => {
    const markdown = exportToMarkdown(checklist, progress);
    downloadFile(markdown, `${checklist.slug}.md`, 'text/markdown');
  };

  const handleShare = async () => {
    const url = generateShareUrl(checklist.slug);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all progress? This action cannot be undone.')) {
      onReset();
    }
  };

  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <button
        onClick={handleExport}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
        aria-label="Export checklist as markdown"
      >
        <Download className="w-4 h-4" />
        Export Markdown
      </button>

      <button
        onClick={handleShare}
        className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-colors text-sm font-medium"
        aria-label="Copy shareable link"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Copied!
          </>
        ) : (
          <>
            <Share2 className="w-4 h-4" />
            Share
        </>
        )}
      </button>

      <button
        onClick={handleReset}
        className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg transition-colors text-sm font-medium"
        aria-label="Reset checklist progress"
      >
        <RotateCcw className="w-4 h-4" />
        Reset
      </button>
    </div>
  );
}
