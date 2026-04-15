'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Award, ArrowRight } from 'lucide-react';
import type { Verdict, ToolInfo } from '@/lib/comparison-types';
import { ensureContrastOnDark } from '@/lib/color-contrast';

interface VerdictSectionProps {
  verdict: Verdict;
  toolA: ToolInfo;
  toolB: ToolInfo;
}

function ScoreBar({ score, maxScore, color, label }: { score: number; maxScore: number; color: string; label: string }) {
  const percentage = (score / maxScore) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium" style={{ color: ensureContrastOnDark(color) }}>{label}</span>
        <span className="font-bold">{score.toFixed(1)} / {maxScore}</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function VerdictSection({ verdict, toolA, toolB }: VerdictSectionProps) {
  return (
    <div className="space-y-6">
      {/* Score Bars */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <ScoreBar
            score={verdict.toolAScore}
            maxScore={5}
            color={toolA.color}
            label={toolA.name}
          />
          <ScoreBar
            score={verdict.toolBScore}
            maxScore={5}
            color={toolB.color}
            label={toolB.name}
          />
        </CardContent>
      </Card>

      {/* Summary */}
      <p className="text-muted-foreground leading-relaxed">{verdict.summary}</p>

      {/* Recommendation Callout */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Award className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold mb-1">Our Recommendation</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {verdict.recommendation}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
