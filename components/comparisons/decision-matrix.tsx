'use client';

import { Badge } from '@/components/ui/badge';
import { toolBg, toolVars } from './tool-style';
import type { DecisionMatrixItem, ToolInfo } from '@/lib/comparison-types';

interface DecisionMatrixProps {
  items: DecisionMatrixItem[];
  toolA: ToolInfo;
  toolB: ToolInfo;
}

export function DecisionMatrix({ items, toolA, toolB }: DecisionMatrixProps) {
  function getRecommendationLabel(rec: 'toolA' | 'toolB' | 'either') {
    switch (rec) {
      case 'toolA':
        return toolA.name;
      case 'toolB':
        return toolB.name;
      case 'either':
        return 'Either';
    }
  }

  // Tool picks use the tool's color, adjusted per theme; "Either" stays neutral.
  function recommendationStyle(rec: 'toolA' | 'toolB' | 'either') {
    if (rec === 'either')
      return { style: undefined, bg: 'bg-zinc-500 text-white', accent: 'bg-zinc-500' };
    const tool = rec === 'toolA' ? toolA : toolB;
    return {
      style: toolVars(tool.color),
      bg: toolBg,
      accent: 'bg-[var(--tool)] dark:bg-[var(--tool-dark)]',
    };
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 p-4 border rounded-lg border-border hover:bg-muted/30 transition-colors"
        >
          <p className="text-sm font-medium flex-1">{item.criteria}</p>
          <Badge
            className={`shrink-0 text-xs ${recommendationStyle(item.recommendation).bg}`}
            style={recommendationStyle(item.recommendation).style}
          >
            {getRecommendationLabel(item.recommendation)}
          </Badge>
        </div>
      ))}
    </div>
  );
}
