import path from 'path';
import type { Challenge } from './challenge-types';
import { createCachedLoader, readJsonFiles } from './content-loader';

const CHALLENGES_DIR = path.join(process.cwd(), 'content', 'challenges');

const DIFFICULTY_ORDER = { starter: 0, intermediate: 1, advanced: 2 } as const;

const loadChallenges = createCachedLoader(async () => {
  const challenges = await readJsonFiles<Challenge>(CHALLENGES_DIR);
  return challenges.sort(
    (a, b) =>
      DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty] ||
      a.minutes - b.minutes ||
      a.title.localeCompare(b.title)
  );
});

export async function getAllChallenges(): Promise<Challenge[]> {
  return loadChallenges();
}

export async function getChallengeBySlug(slug: string): Promise<Challenge | undefined> {
  const all = await loadChallenges();
  return all.find((challenge) => challenge.slug === slug);
}

/** Challenges that list this exercise as related, for a callout on its page. */
export async function getChallengesForExercise(exerciseId: string): Promise<Challenge[]> {
  const all = await loadChallenges();
  return all.filter((challenge) => challenge.related?.exercises?.includes(exerciseId));
}
