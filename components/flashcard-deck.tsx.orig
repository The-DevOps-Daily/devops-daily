'use client'

import { useState, useCallback } from 'react'
import { FlashCard as FlashCardComponent } from './flashcard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shuffle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import type { FlashCard } from '@/lib/flashcard-loader'

interface FlashCardDeckProps {
  cards: FlashCard[]
  title: string
  theme?: {
    primaryColor: string
    gradientFrom: string
    gradientTo: string
  }
}

export function FlashCardDeck({ cards, title, theme }: FlashCardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set())
  const [unknownCards, setUnknownCards] = useState<Set<string>>(new Set())
  const [shuffledCards, setShuffledCards] = useState<FlashCard[]>(cards)
  const [showOnlyUnknown, setShowOnlyUnknown] = useState(false)

  const displayCards = showOnlyUnknown
    ? shuffledCards.filter(card => !knownCards.has(card.id))
    : shuffledCards

  const currentCard = displayCards[currentIndex]

  const handleShuffle = useCallback(() => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5)
    setShuffledCards(shuffled)
    setCurrentIndex(0)
  }, [cards])

  const handleReset = useCallback(() => {
    setKnownCards(new Set())
    setUnknownCards(new Set())
    setCurrentIndex(0)
    setShowOnlyUnknown(false)
  }, [])

  const handleNext = useCallback(() => {
    if (currentIndex < displayCards.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }, [currentIndex, displayCards.length])

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }, [currentIndex])

  const handleMarkKnown = useCallback(() => {
    if (!currentCard) return
    setKnownCards(prev => new Set(prev).add(currentCard.id))
    setUnknownCards(prev => {
      const next = new Set(prev)
      next.delete(currentCard.id)
      return next
    })
    handleNext()
  }, [currentCard, handleNext])

  const handleMarkUnknown = useCallback(() => {
    if (!currentCard) return
    setUnknownCards(prev => new Set(prev).add(currentCard.id))
    setKnownCards(prev => {
      const next = new Set(prev)
      next.delete(currentCard.id)
      return next
    })
    handleNext()
  }, [currentCard, handleNext])

  const progress = Math.round((knownCards.size / cards.length) * 100)

  if (!currentCard) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">All cards reviewed!</h2>
        <p className="text-muted-foreground mb-6">
          You've marked {knownCards.size} cards as known and {unknownCards.size} as unknown.
        </p>
        <Button onClick={handleReset}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Start Over
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress & Stats */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <Badge variant="outline">
            {currentIndex + 1} / {displayCards.length}
          </Badge>
          <Badge variant="secondary">
            {progress}% Known
          </Badge>
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            ✓ {knownCards.size}
          </Badge>
          <Badge variant="destructive">
            ? {unknownCards.size}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOnlyUnknown(!showOnlyUnknown)}
          >
            {showOnlyUnknown ? 'Show All' : 'Unknown Only'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleShuffle}>
            <Shuffle className="w-4 h-4 mr-2" />
            Shuffle
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Flashcard */}
      <FlashCardComponent
        card={currentCard}
        theme={theme}
      />

      {/* Navigation & Actions */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={handleNext}
            disabled={currentIndex === displayCards.length - 1}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            className="bg-green-500 hover:bg-green-600"
            onClick={handleMarkKnown}
          >
            ✓ I Know This
          </Button>
          <Button
            variant="destructive"
            onClick={handleMarkUnknown}
          >
            ? Need Review
          </Button>
        </div>
      </div>
    </div>
  )
}
