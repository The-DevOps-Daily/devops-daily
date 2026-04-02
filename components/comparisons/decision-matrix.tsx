'use client';

import { Badge } from '@/components/ui/badge';
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

  function getRecommendationColor(rec: 'toolA' | 'toolB' | 'either') {
    switch (rec) {
      case 'toolA':
        return toolA.color;
      case 'toolB':
        return toolB.color;
      case 'either':
        return '#6B7280';
    }
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
            className="shrink-0 text-white text-xs"
            style={{ backgroundColor: getRecommendationColor(item.recommendation) }}
          >
            {getRecommendationLabel(item.recommendation)}
          </Badge>
        </div>
      ))}
    </div>
  );
}
