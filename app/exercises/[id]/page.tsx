import { notFound } from 'next/navigation';
import { getExerciseById, getAllExercises, getExercisesInSeries } from '@/lib/exercises';
import { ExerciseDetailClient } from '@/components/exercise-detail-client';
import {
  BreadcrumbSchema,
  LearningResourceSchema,
} from '@/components/schema-markup';
import { ExerciseSeriesNav } from '@/components/exercise-series-nav';
import { getSocialImagePath } from '@/lib/image-utils';
import { truncateMetaDescription } from '@/lib/meta-description';
import { pickRelatedItems } from '@/lib/related-content';
import { RelatedContent } from '@/components/related-content';
import { RelatedAcrossTypes } from '@/components/related-across-types';
import { getRelatedAcrossTypes } from '@/lib/related-cross-type';
import type { Metadata } from 'next';

export const dynamicParams = false;

export async function generateStaticParams() {
  const exercises = await getAllExercises();
  return exercises.map((exercise) => ({
    id: exercise.id,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const exercise = await getExerciseById(id);

  if (!exercise) {
    return {};
  }

  const socialImage = getSocialImagePath(exercise.id, 'exercises');
  const description = truncateMetaDescription(exercise.description);

  return {
    title: { absolute: `${exercise.title} - DevOps Exercise` },
    description,
    alternates: {
      canonical: `/exercises/${exercise.id}`,
    },
    openGraph: {
      title: `${exercise.title} - DevOps Exercise`,
      description,
      url: `/exercises/${exercise.id}`,
      type: 'article',
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: exercise.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${exercise.title} - DevOps Exercise`,
      description,
      images: [socialImage],
    },
  };
}

export default async function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exercise = await getExerciseById(id);

  if (!exercise) {
    notFound();
  }

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Exercises', url: '/exercises' },
    { name: exercise.title, url: `/exercises/${exercise.id}` },
  ];

  // Fetch series exercises if this exercise is part of a series
  const seriesExercises = exercise.series
    ? await getExercisesInSeries(exercise.series.id)
    : [];

  // Score sibling exercises so each detail page links to 3 related ones
  // (was 0 before this PR for the exercises Ahrefs flagged). Exercise
  // category is an object here, so flatten the slug for scoring.
  const allExercises = await getAllExercises();
  const scorable = allExercises.map((ex) => ({
    slug: ex.id,
    title: ex.title,
    description: ex.description,
    category: ex.category.slug,
    tags: ex.tags ?? [],
    difficulty: ex.difficulty,
    estimatedTime: ex.estimatedTime,
    categoryName: ex.category.name,
  }));
  const related = pickRelatedItems(
    scorable,
    {
      slug: exercise.id,
      category: exercise.category.slug,
      tags: exercise.tags ?? [],
      difficulty: exercise.difficulty,
    },
    { currentSlug: exercise.id, limit: 3 },
  );

  const crossTypeRelated = await getRelatedAcrossTypes({
    current: {
      type: 'exercise',
      id: exercise.id,
      category: exercise.category.slug,
      tags: exercise.tags ?? [],
      difficulty: exercise.difficulty,
    },
    limit: 3,
  });

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <LearningResourceSchema
        title={exercise.title}
        description={exercise.description}
        difficulty={exercise.difficulty}
        estimatedTime={exercise.estimatedTime}
        learningObjectives={exercise.learningObjectives}
        technologies={exercise.technologies}
        url={`/exercises/${exercise.id}`}
      />
      <ExerciseDetailClient exercise={exercise} />
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <ExerciseSeriesNav
          currentExercise={exercise}
          seriesExercises={seriesExercises}
        />
      </div>
      {related.length > 0 && (
        <div className="container mx-auto px-4 pb-8">
          <RelatedContent
            title="More exercises"
            items={related.map((r) => ({
              slug: r.slug,
              title: r.title,
              description: r.description,
              href: `/exercises/${r.slug}`,
              label: r.categoryName,
              meta: r.estimatedTime,
            }))}
          />
        </div>
      )}
      {crossTypeRelated.length > 0 && (
        <div className="container mx-auto px-4 pb-16">
          <RelatedAcrossTypes items={crossTypeRelated} />
        </div>
      )}
    </>
  );
}
