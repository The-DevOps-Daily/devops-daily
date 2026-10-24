import Link from 'next/link';
import { ChevronRight, Clock, ListChecks } from 'lucide-react';
import { difficultyLabel, type Challenge } from '@/lib/challenge-types';
import { PassedBy } from './passed-by';
import { challengeDifficultyColors } from './challenge-style';

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  return (
    <Link
      href={`/challenges/${challenge.slug}`}
      className="group flex h-full flex-col rounded-lg border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {challenge.topic}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${challengeDifficultyColors[challenge.difficulty]}`}
          >
            {difficultyLabel(challenge.difficulty)}
          </span>
        </div>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary"
          aria-hidden="true"
        />
      </div>

      <h2 className="mb-2 text-xl font-bold transition-colors group-hover:text-primary">
        {challenge.title}
      </h2>
      <p className="mb-5 text-sm text-muted-foreground line-clamp-3">{challenge.summary}</p>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          About {challenge.minutes} min
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
          {challenge.checks.length} checks
        </span>
        <PassedBy challengeId={challenge.id} />
      </div>
    </Link>
  );
}
