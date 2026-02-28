'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { FlashCard } from './flashcard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shuffle, RefreshCw, ChevronLeft, ChevronRight, List, Grid3x3, Check, X, Circle } from 'lucide-react'
import type { FlashCard as FlashCardType } from '@/lib/flashcard-loader'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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
  const [isFlipped, setIsFlipped] = useState(false)
  const [viewMode, setViewMode] = useState<'deck' | 'list'>('deck')
  const [showResults, setShowResults] = useState(false)

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
    setShowResults(false)
  }, [])

  const handleNext = useCallback(() => {
    if (currentIndex < displayCards.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setIsFlipped(false)
    }
  }, [currentIndex, displayCards.length])

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setIsFlipped(false)
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
  
  // Check if this is the last card
  if (currentIndex >= displayCards.length - 1) {
    setShowResults(true)
  } else {
    handleNext()
  }
}, [currentCard, handleNext, currentIndex, displayCards.length, setShowResults])

const handleMarkUnknown = useCallback(() => {
  if (!currentCard) return
  setUnknownCards(prev => new Set(prev).add(currentCard.id))
  setKnownCards(prev => {
    const next = new Set(prev)
    next.delete(currentCard.id)
    return next
  })
  
  // Check if this is the last card
  if (currentIndex >= displayCards.length - 1) {
    setShowResults(true)
  } else {
    handleNext()
  }
}, [currentCard, handleNext, currentIndex, displayCards.length, setShowResults])

  const handleFlip = useCallback(() => {
    setIsFlipped(!isFlipped)
  }, [isFlipped])

  // Group cards by status for list view
  const cardsByStatus = useMemo(() => {
    const known: FlashCard[] = []
    const needReview: FlashCard[] = []
    const notReviewed: FlashCard[] = []

    shuffledCards.forEach(card => {
      if (knownCards.has(card.id)) {
        known.push(card)
      } else if (unknownCards.has(card.id)) {
        needReview.push(card)
      } else {
        notReviewed.push(card)
      }
    })

    return { known, needReview, notReviewed }
  }, [shuffledCards, knownCards, unknownCards])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // List view navigation
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        setViewMode(viewMode === 'deck' ? 'list' : 'deck')
        return
      }

      // Only deck view shortcuts below this point
      if (viewMode === 'list') return

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          handlePrevious()
          break
        case 'ArrowRight':
          e.preventDefault()
          handleNext()
          break
        case ' ':
        case 'Enter':
          e.preventDefault()
          handleFlip()
          break
        case 'k':
        case 'K':
        case '1':
          e.preventDefault()
          handleMarkKnown()
          break
        case 'u':
        case 'U':
        case '2':
          e.preventDefault()
          handleMarkUnknown()
          break
        case 's':
        case 'S':
          e.preventDefault()
          handleShuffle()
          break
        case 'R':
          // Only trigger reset on Shift+R to avoid browser refresh conflict
          if (e.shiftKey) {
            e.preventDefault()
            handleReset()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePrevious, handleNext, handleFlip, handleMarkKnown, handleMarkUnknown, handleShuffle, handleReset, isFlipped, viewMode])

  const progress = Math.round((knownCards.size / cards.length) * 100)

  // Results summary view
  if (showResults) {
    const totalCards = cards.length
    const knownCount = knownCards.size
    const unknownCount = unknownCards.size
    const notReviewedCount = totalCards - knownCount - unknownCount
    const scorePercentage = totalCards > 0 ? Math.round((knownCount / totalCards) * 100) : 0

    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold mb-2">🎉 Session Complete!</h2>
              <p className="text-muted-foreground">Great work reviewing your flashcards!</p>
            </div>

            <div className="flex justify-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="none"
                    className="text-muted-foreground/20"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 70}`}
                    strokeDashoffset={`${2 * Math.PI * 70 * (1 - scorePercentage / 100)}`}
                    className="text-green-500 transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-bold">{scorePercentage}%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="font-semibold">I Know This</span>
                </div>
                <p className="text-2xl font-bold">{knownCount}</p>
                <p className="text-sm text-muted-foreground">cards</p>
              </div>

              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <span className="font-semibold">Need Review</span>
                </div>
                <p className="text-2xl font-bold">{unknownCount}</p>
                <p className="text-sm text-muted-foreground">cards</p>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Circle className="w-5 h-5" />
                  <span className="font-semibold">Not Reviewed</span>
                </div>
                <p className="text-2xl font-bold">{notReviewedCount}</p>
                <p className="text-sm text-muted-foreground">cards</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleReset} size="lg">
                <RefreshCw className="w-4 h-4 mr-2" />
                Start Over
              </Button>
              <Button variant="outline" size="lg" onClick={() => { setShowResults(false); setViewMode('list'); }}>
                <List className="w-4 h-4 mr-2" />
                Review List
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

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

  // List view
  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="text-lg font-semibold">Card Progress Review</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setViewMode('deck')}>
              <Grid3x3 className="w-4 h-4 mr-2" />
              Card View
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 bg-green-500/10 border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="font-semibold text-green-600 dark:text-green-400">Known</span>
            </div>
            <p className="text-3xl font-bold">{cardsByStatus.known.length}</p>
          </Card>
          <Card className="p-4 bg-red-500/10 border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <X className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="font-semibold text-red-600 dark:text-red-400">Need Review</span>
            </div>
            <p className="text-3xl font-bold">{cardsByStatus.needReview.length}</p>
          </Card>
          <Card className="p-4 bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <Circle className="w-5 h-5 text-muted-foreground" />
              <span className="font-semibold text-muted-foreground">Not Reviewed</span>
            </div>
            <p className="text-3xl font-bold">{cardsByStatus.notReviewed.length}</p>
          </Card>
        </div>

        {/* Known Cards */}
        {cardsByStatus.known.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
              Known Cards ({cardsByStatus.known.length})
            </h4>
            <div className="space-y-2">
              {cardsByStatus.known.map(card => (
                <Card key={card.id} className="p-4 bg-green-500/5 border-green-500/20">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium mb-1">{card.front}</p>
                      <p className="text-sm text-muted-foreground">{card.back}</p>
                      <div className="flex gap-2 mt-2">
                        {card.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
                      <Check className="w-3 h-3" />
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Need Review Cards */}
        {cardsByStatus.needReview.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <X className="w-4 h-4 text-red-600 dark:text-red-400" />
              Need Review ({cardsByStatus.needReview.length})
            </h4>
            <div className="space-y-2">
              {cardsByStatus.needReview.map(card => (
                <Card key={card.id} className="p-4 bg-red-500/5 border-red-500/20">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium mb-1">{card.front}</p>
                      <p className="text-sm text-muted-foreground">{card.back}</p>
                      <div className="flex gap-2 mt-2">
                        {card.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400">
                      <X className="w-3 h-3" />
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Not Reviewed Cards */}
        {cardsByStatus.notReviewed.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Circle className="w-4 h-4 text-muted-foreground" />
              Not Yet Reviewed ({cardsByStatus.notReviewed.length})
            </h4>
            <div className="space-y-2">
              {cardsByStatus.notReviewed.map(card => (
                <Card key={card.id} className="p-4">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium mb-1">{card.front}</p>
                      <div className="flex gap-2 mt-2">
                        {card.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-muted">
                      <Circle className="w-3 h-3" />
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Deck view
  return (
    <div className="space-y-6">
      {/* Keyboard shortcuts info */}
      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground hidden sm:block">
        <p className="font-medium mb-2">Keyboard Shortcuts:</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1">
          <span><kbd className="px-2 py-1 bg-background rounded text-xs">Space/Enter</kbd> Flip</span>
          <span><kbd className="px-2 py-1 bg-background rounded text-xs">←/→</kbd> Navigate</span>
          <span><kbd className="px-2 py-1 bg-background rounded text-xs">K or 1</kbd> Know</span>
          <span><kbd className="px-2 py-1 bg-background rounded text-xs">U or 2</kbd> Review</span>
          <span><kbd className="px-2 py-1 bg-background rounded text-xs">S</kbd> Shuffle</span>
          <span><kbd className="px-2 py-1 bg-background rounded text-xs">Shift+R</kbd> Reset</span>
          <span><kbd className="px-2 py-1 bg-background rounded text-xs">L</kbd> List View</span>
          <span className="block sm:hidden col-span-2"><kbd className="px-2 py-1 bg-background rounded text-xs">Swipe</kbd> Navigate (Mobile)</span>
        </div>
      </div>

      {/* Progress & Stats */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
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
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none min-h-[40px]"
            onClick={() => setShowOnlyUnknown(!showOnlyUnknown)}
          >
            {showOnlyUnknown ? 'Show All' : 'Unknown Only'}
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none min-h-[40px]" onClick={handleShuffle}>
            <Shuffle className="w-4 h-4 mr-2" />
            Shuffle
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none min-h-[40px]" onClick={handleReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none min-h-[40px]" onClick={() => setViewMode('list')}>
            <List className="w-4 h-4 mr-2" />
            List View
          </Button>
        </div>
      </div>

      {/* Flashcard with improved spacing */}
      <div className="mb-8">
      <FlashCard
        card={currentCard}
        theme={theme}
        isFlipped={isFlipped}
        onFlip={handleFlip}
        onNext={handleNext}
        onPrevious={handlePrevious}
        showNavigation={true}
        currentIndex={currentIndex}
        totalCards={displayCards.length}
      />
      </div>

      {/* Navigation & Actions */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-stretch sm:items-center justify-between pt-6 border-t border-border/50">
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none min-h-[48px]"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <Button
            variant="outline"
            className="flex-1 sm:flex-none min-h-[48px]"
            onClick={handleNext}
            disabled={currentIndex === displayCards.length - 1}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="default"
            className="bg-green-500 hover:bg-green-600 flex-1 sm:flex-none min-h-[48px]"
            onClick={handleMarkKnown}
          >
            ✓ I Know This
          </Button>
          <Button
            variant="destructive"
            className="flex-1 sm:flex-none min-h-[48px]"
            onClick={handleMarkUnknown}
          >
            ? Need Review
          </Button>
        </div>
      </div>
    </div>
  )
}
