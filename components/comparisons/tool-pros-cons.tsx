'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ToolInfo } from '@/lib/comparison-types';

interface ToolProsConsProps {
  toolA: ToolInfo;
  toolB: ToolInfo;
}

function ToolCard({ tool }: { tool: ToolInfo }) {
  return (
    <Card className="h-full" style={{ borderLeftColor: tool.color, borderLeftWidth: '4px' }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg" style={{ color: tool.color }}>
          {tool.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pros */}
        <div>
          <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">
            Strengths
          </h4>
          <ul className="space-y-2">
            {tool.pros.map((pro, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <span>{pro}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Cons */}
        <div>
          <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
            Weaknesses
          </h4>
          <ul className="space-y-2">
            {tool.cons.map((con, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <XCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                <span>{con}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function ToolProsCons({ toolA, toolB }: ToolProsConsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <ToolCard tool={toolA} />
      <ToolCard tool={toolB} />
    </div>
  );
}
