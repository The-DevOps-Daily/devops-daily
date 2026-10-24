import Link from 'next/link';
import { ArrowRight, Swords } from 'lucide-react';
import type { Challenge } from '@/lib/challenge-types';

/** "Try it without the steps" box on exercise pages that a challenge builds on. */
export function ChallengeCallout({ challenges }: { challenges: Challenge[] }) {
  if (challenges.length === 0) return null;
  return (
    <aside className="rounded-lg border border-primary/30 bg-primary/5 p-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
        <Swords className="h-4 w-4" aria-hidden="true" />
        Try it without the steps
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        A challenge gives you a broken starter and a brief, not instructions. Fix it in your fork,
        open a pull request, and CI grades it.
      </p>
      <ul className="space-y-2">
        {challenges.map((challenge) => (
          <li key={challenge.id}>
            <Link
              href={`/challenges/${challenge.slug}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary"
            >
              {challenge.title}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
