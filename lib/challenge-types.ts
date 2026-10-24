/**
 * A hands-on challenge from the The-DevOps-Daily/challenges repository.
 * People fix the starter in a fork and open a PR; CI there grades it.
 * The checks and solution files mirror the challenge's challenge.json and
 * README.md in that repository.
 */

export type ChallengeDifficulty = 'starter' | 'intermediate' | 'advanced';

export interface ChallengeCheck {
  id: string;
  name: string;
  description: string;
}

export interface ChallengeHint {
  title: string;
  body: string;
}

export interface Challenge {
  /** Same as the folder name in the challenges repository. */
  id: string;
  slug: string;
  title: string;
  /** Meta description, 155 characters or less. */
  description: string;
  /** One or two sentences for cards and the hero. */
  summary: string;
  /** Main tool, shown as a pill: Docker, Bash, Kubernetes. */
  topic: string;
  category: string;
  difficulty: ChallengeDifficulty;
  minutes: number;
  tags: string[];
  /** Paragraphs that set the scene. */
  situation: string[];
  /** What a passing submission does, one line each. */
  task: string[];
  checks: ChallengeCheck[];
  /** Repository paths a submission may change. */
  solutionFiles: string[];
  hints: ChallengeHint[];
  /** Commands to try a fix locally, shown as one code block. */
  localTest: {
    intro: string;
    commands: string;
  };
  related?: {
    exercises?: string[];
    guides?: string[];
  };
  publishedAt: string;
  updatedAt?: string;
}

export interface ChallengeStats {
  schema: number;
  updated_at: string;
  challenges: Record<string, { passed: number }>;
}

export const CHALLENGES_REPO = 'The-DevOps-Daily/challenges';
export const CHALLENGES_REPO_URL = `https://github.com/${CHALLENGES_REPO}`;
/** Written by the repository's Stats workflow; the site reads it in the browser. */
export const CHALLENGE_STATS_URL = `https://raw.githubusercontent.com/${CHALLENGES_REPO}/stats/stats.json`;

export function challengeFolderUrl(id: string): string {
  return `${CHALLENGES_REPO_URL}/tree/main/challenges/${id}`;
}

export function challengeForkUrl(): string {
  return `${CHALLENGES_REPO_URL}/fork`;
}

export function difficultyLabel(difficulty: ChallengeDifficulty): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}
