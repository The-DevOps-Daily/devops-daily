'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Scale } from 'lucide-react';
import type { Comparison } from '@/lib/comparison-types';
import { ensureContrastOnDark } from '@/lib/color-contrast';

interface RelatedContentProps {
  currentSlug: string;
  comparisons: Comparison[];
}

export function RelatedContent({ currentSlug, comparisons }: RelatedContentProps) {
  const otherComparisons = comparisons.filter((c) => c.slug !== currentSlug);

  if (otherComparisons.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Related Comparisons
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {otherComparisons.map((comparison) => (
          <Link
            key={comparison.slug}
            href={`/comparisons/${comparison.slug}`}
            className="group block"
          >
            <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="w-3.5 h-3.5 text-muted-foreground" />
                  <Badge variant="secondary" className="text-xs">
                    {comparison.category}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium mb-1">
                  <span style={{ color: ensureContrastOnDark(comparison.toolA.color) }}>{comparison.toolA.name}</span>
                  <span className="text-muted-foreground text-xs">vs</span>
                  <span style={{ color: ensureContrastOnDark(comparison.toolB.color) }}>{comparison.toolB.name}</span>
                </div>
                <div className="flex items-center text-xs text-primary group-hover:gap-1.5 transition-all">
                  <span>Read comparison</span>
                  <ArrowRight className="w-3 h-3 ml-1 transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
