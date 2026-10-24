import { ExternalLink, GitFork, FolderGit2 } from 'lucide-react';
import { challengeFolderUrl, challengeForkUrl } from '@/lib/challenge-types';

/** The two ways in: read the starter on GitHub, or fork the repository. */
export function StartChallenge({ challengeId }: { challengeId: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <a
        href={challengeFolderUrl(challengeId)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <FolderGit2 className="h-4 w-4" aria-hidden="true" />
        Start the challenge
        <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
      </a>
      <a
        href={challengeForkUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <GitFork className="h-4 w-4" aria-hidden="true" />
        Fork the repository
        <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
      </a>
    </div>
  );
}
