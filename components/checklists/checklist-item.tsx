'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, ExternalLink, Copy, Check } from 'lucide-react';
import { ChecklistItem } from '@/lib/checklist-utils';

interface ChecklistItemProps {
  item: ChecklistItem;
  checked: boolean;
  onToggle: (itemId: string) => void;
}

export function ChecklistItemComponent({ item, checked, onToggle }: ChecklistItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const hasDetails = item.description || item.codeBlocks || (item.links && item.links.length > 0);

  const handleBoxClick = () => {
    if (hasDetails) {
      setExpanded(!expanded);
    }
  };

  const copyToClipboard = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div 
      className={`border border-gray-200 dark:border-gray-700 rounded-lg mb-3 overflow-hidden transition-all hover:shadow-md ${
        hasDetails ? 'cursor-pointer' : ''
      }`}
      onClick={handleBoxClick}
    >
      <div className="p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <button
            onClick={() => onToggle(item.id)}
            className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110"
            aria-label={checked ? `Mark "${item.title}" as incomplete` : `Mark "${item.title}" as complete`}
          >
            {checked ? (
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            ) : (
              <Circle className="w-6 h-6 text-gray-400 dark:text-gray-500" />
            )}
          </button>

          <div className="flex-1 min-w-0" onClick={handleBoxClick}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 
                  className={`text-base font-medium ${
                    checked 
                      ? 'line-through text-gray-500 dark:text-gray-400' 
                      : 'text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {item.title}
                </h3>
                {item.critical && (
                  <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full font-semibold flex-shrink-0">
                    Critical
                  </span>
                )}
              </div>
              {hasDetails && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(!expanded);
                  }}
                  className="flex-shrink-0 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  aria-label={expanded ? 'Collapse details' : 'Expand details'}
                >
                  <ChevronDown className={`w-5 h-5 transition-transform ${
                    expanded ? 'rotate-180' : ''
                  }`} />
                </button>
              )}
            </div>

            {expanded && hasDetails && (
              <div className="mt-3 space-y-2">
                {item.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {item.description}
                  </p>
                )}
                {item.codeBlocks && item.codeBlocks.length > 0 && (
                  <div className="space-y-3 mt-3">
                    {item.codeBlocks.map((block, index) => (
                      <div key={index} className="space-y-1">
                        {block.label && (
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            {block.label}
                          </p>
                        )}
                        <div className="relative group">
                          <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs border border-gray-700">
                            <code className="font-mono">{block.code}</code>
                          </pre>
                          <button
                            onClick={() => copyToClipboard(block.code, index)}
                            className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy to clipboard"
                          >
                            {copiedIndex === index ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-300" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {item.links && item.links.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Resources
                    </p>
                    {item.links.map((link, index) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {link.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
