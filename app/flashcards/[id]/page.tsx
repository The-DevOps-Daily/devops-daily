import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFlashCardSet, getAllFlashCardSets } from '@/lib/flashcard-loader'
import type { FlashCardSet } from '@/lib/flashcard-loader'
import { FlashCardDeck } from '@/components/flashcard-deck'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, BookOpen, Clock, Layers } from 'lucide-react'
import Link from 'next/link'
import * as Icons from 'lucide-react'
import { PageHero } from '@/components/page-hero'
import { truncateMetaDescription } from '@/lib/meta-description'
import { pickRelatedItems } from '@/lib/related-content'
import { RelatedContent } from '@/components/related-content'
import { RelatedAcrossTypes } from '@/components/related-across-types'
import { getRelatedAcrossTypes } from '@/lib/related-cross-type'
import { CarbonAds } from '@/components/carbon-ads'

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

  const description = truncateMetaDescription(flashcardSet.description)

  return {
    title: { absolute: `${flashcardSet.title} - DevOps Flashcards` },
    description,
    alternates: {
      canonical: `/flashcards/${id}`,
    },
    openGraph: {
      title: `${flashcardSet.title} - DevOps Daily`,
      description,
      type: 'website',
      url: `/flashcards/${id}`,
      images: [
        {
          url: `/images/flashcards/${id}-og.png`,
          width: 1200,
          height: 630,
          alt: flashcardSet.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${flashcardSet.title} - DevOps Daily`,
      description,
      images: [`/images/flashcards/${id}-og.png`],
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
      <PageHero
        title={flashcardSet.title}
        description={flashcardSet.description}
        icon={Layers}
        breadcrumbs={[
          { label: 'Flashcards', href: '/flashcards' },
          { label: flashcardSet.title },
        ]}
      />

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
              <h2 className="text-3xl md:text-4xl font-bold mb-2">{flashcardSet.title}</h2>
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

          {/* Inline ad slot, sits after the deck so it does not interrupt
              the study flow. */}
          <div className="mt-12 max-w-2xl mx-auto">
            <CarbonAds />
          </div>
        </div>
      </section>

      <FlashcardRelated currentSet={flashcardSet} />
      <FlashcardCrossTypeRelated currentSet={flashcardSet} />
    </div>
  )
}

async function FlashcardCrossTypeRelated({ currentSet }: { currentSet: FlashCardSet }) {
  const items = await getRelatedAcrossTypes({
    current: {
      type: 'flashcard',
      id: currentSet.id,
      category: currentSet.category,
      difficulty: currentSet.difficulty,
    },
    limit: 3,
  });
  if (items.length === 0) return null;
  return (
    <section className="container mx-auto px-4 pb-16">
      <div className="max-w-4xl mx-auto">
        <RelatedAcrossTypes items={items} />
      </div>
    </section>
  );
}

// Sets do not carry top-level tags today, so we score on category + difficulty
// alone. Card-level tags are not aggregated up to the set; doing so would mean
// a schema change. The simpler scoring still gives every set ~2-3 inbound
// links from siblings instead of only one from the /flashcards index.
async function FlashcardRelated({ currentSet }: { currentSet: FlashCardSet }) {
  const all = await getAllFlashCardSets();
  const scorable = all.map((s) => ({
    slug: s.id,
    title: s.title,
    description: s.description,
    category: s.category,
    difficulty: s.difficulty,
    estimatedTime: s.estimatedTime,
  }));
  const related = pickRelatedItems(
    scorable,
    {
      slug: currentSet.id,
      category: currentSet.category,
      difficulty: currentSet.difficulty,
    },
    { currentSlug: currentSet.id, limit: 3 },
  );

  if (related.length === 0) return null;

  return (
    <section className="container mx-auto px-4 pb-16">
      <div className="max-w-4xl mx-auto">
        <RelatedContent
          title="More flashcard decks"
          items={related.map((r) => ({
            slug: r.slug,
            title: r.title,
            description: r.description,
            href: `/flashcards/${r.slug}`,
            label: r.category,
            meta: r.estimatedTime,
          }))}
        />
      </div>
    </section>
  );
}
