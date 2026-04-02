'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb } from 'lucide-react';
import type { UseCase, ToolInfo } from '@/lib/comparison-types';

interface UseCasesSectionProps {
  useCases: UseCase[];
  toolA: ToolInfo;
  toolB: ToolInfo;
}

export function UseCasesSection({ useCases, toolA, toolB }: UseCasesSectionProps) {
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
    <div className="space-y-4">
      {useCases.map((useCase, i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col sm:flex-row">
              {/* Recommendation indicator */}
              <div
                className="sm:w-1.5 h-1.5 sm:h-auto shrink-0"
                style={{ backgroundColor: getRecommendationColor(useCase.recommendation) }}
              />
              <div className="p-5 flex-1">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <h4 className="font-semibold text-sm">{useCase.scenario}</h4>
                  </div>
                  <Badge
                    className="shrink-0 text-white text-xs"
                    style={{ backgroundColor: getRecommendationColor(useCase.recommendation) }}
                  >
                    {getRecommendationLabel(useCase.recommendation)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground pl-6">{useCase.explanation}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
