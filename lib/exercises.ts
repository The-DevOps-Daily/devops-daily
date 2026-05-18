import path from 'path';
import type { Exercise } from './exercises-types';
import { createCachedLoader, readJsonFiles } from './content-loader';

const EXERCISES_DIR = path.join(process.cwd(), 'content', 'exercises');

const loadExercisesFromFiles = createCachedLoader(() => readJsonFiles<Exercise>(EXERCISES_DIR));

export async function getAllExercises(): Promise<Exercise[]> {
  const exercises = await loadExercisesFromFiles();
  return [...exercises].sort(
    (a: Exercise, b: Exercise) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  const exercises = await getAllExercises();
  return exercises.find((exercise) => exercise.id === id) || null;
}

export async function getExercisesByCategory(categorySlug: string): Promise<Exercise[]> {
  const exercises = await getAllExercises();
  return exercises.filter((exercise) => exercise.category.slug === categorySlug);
}

export async function getExercisesByDifficulty(
  difficulty: Exercise['difficulty']
): Promise<Exercise[]> {
  const exercises = await getAllExercises();
  return exercises.filter((exercise) => exercise.difficulty === difficulty);
}

export async function getFeaturedExercises(limit = 3): Promise<Exercise[]> {
  const exercises = await getAllExercises();
  return exercises.filter((exercise) => exercise.featured).slice(0, limit);
}

export async function getLatestExercises(limit = 6): Promise<Exercise[]> {
  const exercises = await getAllExercises();
  return exercises.slice(0, limit);
}

export async function getExercisesInSeries(seriesId: string): Promise<Exercise[]> {
  const exercises = await getAllExercises();
  return exercises
    .filter((e) => e.series?.id === seriesId)
    .sort((a, b) => (a.series?.order || 0) - (b.series?.order || 0));
}

export async function getExerciseStats(): Promise<{
  total: number;
  byDifficulty: Record<Exercise['difficulty'], number>;
  byCategory: Record<string, number>;
  averageTime: number;
}> {
  const exercises = await getAllExercises();

  const byDifficulty = exercises.reduce(
    (acc, exercise) => {
      acc[exercise.difficulty] = (acc[exercise.difficulty] || 0) + 1;
      return acc;
    },
    {} as Record<Exercise['difficulty'], number>
  );

  const byCategory = exercises.reduce(
    (acc, exercise) => {
      acc[exercise.category.name] = (acc[exercise.category.name] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const averageTime =
    exercises.reduce((acc, exercise) => {
      const time = parseInt(exercise.estimatedTime.split(' ')[0]);
      return acc + time;
    }, 0) / exercises.length;

  return {
    total: exercises.length,
    byDifficulty,
    byCategory,
    averageTime,
  };
}
