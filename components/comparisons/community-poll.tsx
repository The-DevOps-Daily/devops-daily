'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';
import type { ToolInfo } from '@/lib/comparison-types';

interface CommunityPollProps {
  comparisonId: string;
  toolA: ToolInfo;
  toolB: ToolInfo;
}

interface PollData {
  toolA: number;
  toolB: number;
  voted: 'toolA' | 'toolB' | null;
}

export function CommunityPoll({ comparisonId, toolA, toolB }: CommunityPollProps) {
  const [poll, setPoll] = useState<PollData>({ toolA: 0, toolB: 0, voted: null });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`comparison-poll-${comparisonId}`);
      if (saved) {
        setPoll(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, [comparisonId]);

  const vote = (choice: 'toolA' | 'toolB') => {
    if (poll.voted) return;

    const updated: PollData = {
      toolA: poll.toolA + (choice === 'toolA' ? 1 : 0),
      toolB: poll.toolB + (choice === 'toolB' ? 1 : 0),
      voted: choice,
    };

    setPoll(updated);
    try {
      localStorage.setItem(`comparison-poll-${comparisonId}`, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const total = poll.toolA + poll.toolB;
  const toolAPercent = total > 0 ? Math.round((poll.toolA / total) * 100) : 50;
  const toolBPercent = total > 0 ? Math.round((poll.toolB / total) * 100) : 50;

  return (
    <Card className="border-dashed">
      <CardContent className="p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h4 className="font-semibold text-sm">Community Poll</h4>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Which tool do you prefer for your projects?
        </p>

        {!poll.voted ? (
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => vote('toolA')}
              className="flex-1 max-w-[180px] font-semibold"
              style={{ borderColor: toolA.color, color: toolA.color }}
            >
              {toolA.name}
            </Button>
            <Button
              variant="outline"
              onClick={() => vote('toolB')}
              className="flex-1 max-w-[180px] font-semibold"
              style={{ borderColor: toolB.color, color: toolB.color }}
            >
              {toolB.name}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-sm mx-auto">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium" style={{ color: toolA.color }}>{toolA.name}</span>
                <span className="text-muted-foreground">{toolAPercent}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${toolAPercent}%`, backgroundColor: toolA.color }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium" style={{ color: toolB.color }}>{toolB.name}</span>
                <span className="text-muted-foreground">{toolBPercent}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${toolBPercent}%`, backgroundColor: toolB.color }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {total} vote{total !== 1 ? 's' : ''} - Thanks for voting!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
