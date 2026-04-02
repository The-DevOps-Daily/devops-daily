import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, ArrowRight } from 'lucide-react';
import type { Comparison } from '@/lib/comparison-types';

interface ComparisonCardProps {
  comparison: Comparison;
}

export function ComparisonCard({ comparison }: ComparisonCardProps) {
  return (
    <Link href={`/comparisons/${comparison.slug}`} className="group block">
      <Card className="h-full transition-all duration-300 hover:shadow-lg hover:border-primary/30 hover:-translate-y-1">
        <CardContent className="p-6">
          {/* Category & Read Time */}
          <div className="flex items-center justify-between mb-4">
            <Badge variant="secondary" className="text-xs">
              {comparison.category}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {comparison.estimatedReadTime}
            </div>
          </div>

          {/* VS Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 text-right">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: `${comparison.toolA.color}15`, color: comparison.toolA.color }}
              >
                {comparison.toolA.name}
              </div>
            </div>
            <div className="flex-shrink-0">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-xs font-bold text-muted-foreground">
                vs
              </span>
            </div>
            <div className="flex-1 text-left">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: `${comparison.toolB.color}15`, color: comparison.toolB.color }}
              >
                {comparison.toolB.name}
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {comparison.description}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {comparison.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center text-sm font-medium text-primary group-hover:gap-2 transition-all">
            <span>Read comparison</span>
            <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
