import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFlashCardSet, getAllFlashCardSets } from '@/lib/flashcard-loader'
import { FlashCardDeck } from '@/components/flashcard-deck'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, BookOpen, Clock } from 'lucide-react'
import Link from 'next/link'
import * as Icons from 'lucide-react'

interface FlashcardPageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateStaticParams() {
  const sets = await getAllFlashCardSets()
  return sets.map((set) => ({
    id: set.id,
  }))
}

export async function generateMetadata({ params }: FlashcardPageProps): Promise<Metadata> {
  const { id } = await params
  const flashcardSet = await getFlashCardSet(id)

  if (!flashcardSet) {
    return {
      title: 'Flashcard Set Not Found',
    }
  }

  return {
    title: `${flashcardSet.title} - DevOps Flashcards`,
    description: flashcardSet.description,
    alternates: {
      canonical: `/flashcards/${id}`,
    },
    openGraph: {
      title: `${flashcardSet.title} - DevOps Daily`,
      description: flashcardSet.description,
      type: 'website',
      url: `/flashcards/${id}`,
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: flashcardSet.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${flashcardSet.title} - DevOps Daily`,
      description: flashcardSet.description,
      images: ['/og-image.png'],
    },
  }
}

export default async function FlashcardPage({ params }: FlashcardPageProps) {
  const { id } = await params
  const flashcardSet = await getFlashCardSet(id)

  if (!flashcardSet) {
    notFound()
  }

  const IconComponent = Icons[flashcardSet.icon as keyof typeof Icons] || BookOpen
  const difficultyColors = {
    beginner: 'bg-green-500',
    intermediate: 'bg-yellow-500',
    advanced: 'bg-red-500',
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      {/* Header */}
      <section className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/flashcards">
                <ArrowLeft className="w-4 h-4 mr-2" />
                All Flashcards
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Flashcard Set Info */}
      <section className="py-12 container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-6 mb-8">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{
                background: `linear-gradient(135deg, ${flashcardSet.theme.gradientFrom}, ${flashcardSet.theme.gradientTo})`,
              }}
            >
              <IconComponent className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="secondary"
                  className={`${difficultyColors[flashcardSet.difficulty]} text-white`}
                >
                  {flashcardSet.difficulty}
                </Badge>
                <Badge variant="outline">{flashcardSet.category}</Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{flashcardSet.title}</h1>
              <p className="text-lg text-muted-foreground mb-4">{flashcardSet.description}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  <span>{flashcardSet.cardCount} cards</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{flashcardSet.estimatedTime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Flashcard Deck */}
          <FlashCardDeck
            cards={flashcardSet.cards}
            title={flashcardSet.title}
            theme={flashcardSet.theme}
          />
        </div>
      </section>
    </div>
  )
}
