'use client';

import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FeatureComparison, ToolInfo } from '@/lib/comparison-types';
import { ensureContrastOnDark } from '@/lib/color-contrast';

interface FeatureComparisonTableProps {
  features: FeatureComparison[];
  toolA: ToolInfo;
  toolB: ToolInfo;
}

function RatingIcon({ rating }: { rating: 'good' | 'neutral' | 'bad' }) {
  switch (rating) {
    case 'good':
      return <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />;
    case 'neutral':
      return <MinusCircle className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0" />;
    case 'bad':
      return <XCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />;
  }
}

function ratingBg(rating: 'good' | 'neutral' | 'bad') {
  switch (rating) {
    case 'good':
      return 'bg-green-50 dark:bg-green-950/20';
    case 'neutral':
      return 'bg-gray-50 dark:bg-gray-900/20';
    case 'bad':
      return 'bg-red-50 dark:bg-red-950/20';
  }
}

export function FeatureComparisonTable({ features, toolA, toolB }: FeatureComparisonTableProps) {
  // Group features by category
  const groupedFeatures: Record<string, FeatureComparison[]> = {};
  for (const feature of features) {
    if (!groupedFeatures[feature.category]) {
      groupedFeatures[feature.category] = [];
    }
    groupedFeatures[feature.category].push(feature);
  }

  return (
    <div>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="text-left py-3 px-4 font-semibold text-sm w-1/4">Feature</th>
              <th className="text-left py-3 px-4 font-semibold text-sm w-[37.5%]">
                <span
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm"
                  style={{ backgroundColor: `${toolA.color}15`, color: ensureContrastOnDark(toolA.color) }}
                >
                  {toolA.name}
                </span>
              </th>
              <th className="text-left py-3 px-4 font-semibold text-sm w-[37.5%]">
                <span
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm"
                  style={{ backgroundColor: `${toolB.color}15`, color: ensureContrastOnDark(toolB.color) }}
                >
                  {toolB.name}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
              <>
                {/* Category Header */}
                <tr key={`cat-${category}`}>
                  <td
                    colSpan={3}
                    className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground bg-muted/50 border-y border-border"
                  >
                    {category}
                  </td>
                </tr>
                {/* Features in this category */}
                {categoryFeatures.map((feature) => (
                  <tr
                    key={feature.name}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-sm">{feature.name}</td>
                    <td className={cn('py-3 px-4', ratingBg(feature.toolA.rating))}>
                      <div className="flex items-start gap-2">
                        <RatingIcon rating={feature.toolA.rating} />
                        <span className="text-sm">{feature.toolA.value}</span>
                      </div>
                    </td>
                    <td className={cn('py-3 px-4', ratingBg(feature.toolB.rating))}>
                      <div className="flex items-start gap-2">
                        <RatingIcon rating={feature.toolB.rating} />
                        <span className="text-sm">{feature.toolB.value}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Cards */}
      <div className="md:hidden space-y-4">
        {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
          <div key={category}>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 px-1">
              {category}
            </h4>
            <div className="space-y-3">
              {categoryFeatures.map((feature) => (
                <div
                  key={feature.name}
                  className="border rounded-lg overflow-hidden border-border"
                >
                  <div className="px-4 py-2 bg-muted/50 font-medium text-sm">
                    {feature.name}
                  </div>
                  <div className="divide-y divide-border/50">
                    <div className={cn('px-4 py-3', ratingBg(feature.toolA.rating))}>
                      <div className="text-xs font-semibold mb-1" style={{ color: ensureContrastOnDark(toolA.color) }}>
                        {toolA.name}
                      </div>
                      <div className="flex items-start gap-2">
                        <RatingIcon rating={feature.toolA.rating} />
                        <span className="text-sm">{feature.toolA.value}</span>
                      </div>
                    </div>
                    <div className={cn('px-4 py-3', ratingBg(feature.toolB.rating))}>
                      <div className="text-xs font-semibold mb-1" style={{ color: ensureContrastOnDark(toolB.color) }}>
                        {toolB.name}
                      </div>
                      <div className="flex items-start gap-2">
                        <RatingIcon rating={feature.toolB.rating} />
                        <span className="text-sm">{feature.toolB.value}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
