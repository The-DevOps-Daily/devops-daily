'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCw, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FlashCard } from '@/lib/flashcard-loader';

interface FlashCardComponentProps {
  card: FlashCard;
  onNext?: () => void;
  onPrevious?: () => void;
  onKnown?: () => void;
  onUnknown?: () => void;
  showNavigation?: boolean;
  currentIndex?: number;
  totalCards?: number;
}

export function FlashCard({
  card,
  onNext,
  onPrevious,
  onKnown,
  onUnknown,
  showNavigation = true,
  currentIndex = 0,
  totalCards = 1,
}: FlashCardComponentProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => setIsFlipped(!isFlipped);

  const handleKnown = () => {
    setIsFlipped(false);
    onKnown?.();
  };

  const handleUnknown = () => {
    setIsFlipped(false);
    onUnknown?.();
  };

  const handleNext = () => {
    setIsFlipped(false);
    onNext?.();
  };

  const handlePrevious = () => {
    setIsFlipped(false);
    onPrevious?.();
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Progress indicator */}
      {showNavigation && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Card {currentIndex + 1} of {totalCards}
          </span>
          <Badge variant="outline">{card.category}</Badge>
        </div>
      )}

      {/* Flashcard */}
      <div
        className="relative h-96 cursor-pointer perspective-1000"
        onClick={handleFlip}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleFlip()}
        aria-label="Flip card"
      >
        <div
          className={cn(
            'relative w-full h-full transition-transform duration-500 transform-style-3d',
            isFlipped && 'rotate-y-180'
          )}
        >
          {/* Front of card */}
          <Card
            className={cn(
              'absolute inset-0 backface-hidden flex flex-col items-center justify-center p-8 bg-linear-to-br from-primary/5 to-primary/10 border-2',
              'hover:border-primary/50 transition-colors'
            )}
          >
            <div className="text-center space-y-4">
              <div className="text-xs font-semibold text-primary uppercase tracking-wider">Question</div>
              <p className="text-2xl font-bold leading-tight">{card.front}</p>
              <div className="pt-6 flex items-center gap-2 text-muted-foreground text-sm">
                <RotateCw className="h-4 w-4" />
                <span>Click to reveal answer</span>
              </div>
            </div>
          </Card>

          {/* Back of card */}
          <Card
            className={cn(
              'absolute inset-0 backface-hidden flex flex-col items-center justify-center p-8 bg-linear-to-br from-blue-500/5 to-cyan-500/10 border-2 border-blue-500/20',
              'rotate-y-180'
            )}
          >
            <div className="text-center space-y-4">
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Answer
              </div>
              <p className="text-lg leading-relaxed">{card.back}</p>
              <div className="pt-4 flex flex-wrap gap-2 justify-center">
                {card.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Actions */}
      {isFlipped && (
        <div className="flex gap-4 justify-center">
          <Button variant="outline" size="lg" onClick={handleUnknown} className="gap-2">
            <X className="h-4 w-4" />
            Need to review
          </Button>
          <Button size="lg" onClick={handleKnown} className="gap-2">
            <Check className="h-4 w-4" />
            Got it!
          </Button>
        </div>
      )}

      {/* Navigation */}
      {showNavigation && (
        <div className="flex gap-4 justify-center">
          <Button variant="outline" size="icon" onClick={handlePrevious} disabled={currentIndex === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={currentIndex === totalCards - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
