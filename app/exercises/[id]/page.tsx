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
import type { Metadata } from 'next';

export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const exercises = await getAllExercises();
    return exercises.map((exercise) => ({
      id: exercise.id,
    }));
  } catch (error) {
    console.warn('Error generating static params for exercises:', error);
    return [];
  }
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
    </>
  );
}
