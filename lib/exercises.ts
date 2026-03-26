import fs from 'fs/promises';
import path from 'path';
import type { Exercise } from './exercises-types';

const EXERCISES_DIR = path.join(process.cwd(), 'content', 'exercises');

// Cache for exercises to avoid re-reading files on every request
let exercisesCache: Exercise[] | null = null;
let lastCacheTime = 0;
// During build, use infinite cache; during runtime, use 5-minute cache
const CACHE_DURATION =
  process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME
    ? Infinity
    : 5 * 60 * 1000;

async function loadExercisesFromFiles(): Promise<Exercise[]> {
  // Check if cache is still valid
  const now = Date.now();
  if (exercisesCache && now - lastCacheTime < CACHE_DURATION) {
    return exercisesCache;
  }

  try {
    // Check if exercises directory exists
    await fs.access(EXERCISES_DIR);

    // Read all JSON files from the exercises directory
    const files = await fs.readdir(EXERCISES_DIR);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));

    const exercises: Exercise[] = [];

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(EXERCISES_DIR, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const exercise = JSON.parse(fileContent) as Exercise;
        exercises.push(exercise);
      } catch (error) {
        console.warn(`Failed to parse exercise file ${file}:`, error);
      }
    }

    // Update cache
    exercisesCache = exercises;
    lastCacheTime = now;

    return exercises;
  } catch (error) {
    console.warn('Failed to load exercises from files, using fallback data:', error);
    return getFallbackExercises();
  }
}

// Fallback data in case file loading fails
function getFallbackExercises(): Exercise[] {
  return [
    {
      id: 'docker-multi-stage-build',
      title: 'Docker Multi-Stage Build Optimization',
      description:
        'Learn to create efficient Docker images using multi-stage builds to reduce image size and improve security.',
      category: { name: 'Docker', slug: 'docker' },
      difficulty: 'intermediate',
      estimatedTime: '45 minutes',
      technologies: ['Docker', 'Node.js', 'Alpine Linux'],
      prerequisites: ['Basic Docker knowledge', 'Understanding of Dockerfile syntax'],
      learningObjectives: [
        'Understand multi-stage build concepts',
        'Reduce Docker image size by 70%+',
        'Implement security best practices',
        'Optimize build caching',
      ],
      environment: 'local',
      icon: 'Container',
      publishedAt: '2024-12-01T10:00:00Z',
      author: { name: 'DevOps Daily Team', slug: 'devops-daily-team' },
      tags: ['Docker', 'Optimization', 'Security', 'Best Practices'],
      steps: [],
      completionCriteria: [],
      featured: true,
    },
  ];
}

export async function getAllExercises(): Promise<Exercise[]> {
  const exercises = await loadExercisesFromFiles();
  return exercises.sort(
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
