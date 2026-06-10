import type { Metadata } from 'next';
import GitConceptsSimulator from '@/components/games/git-concepts-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('git-concepts-simulator');
}

function GitConceptsEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this Git simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How the working directory, staging area, local repository, and remote relate</li>
            <li>Why Git commits are snapshots with parent links</li>
            <li>How branches and HEAD work as movable pointers</li>
            <li>When a merge is a fast-forward instead of a merge commit</li>
            <li>How fetch updates remote-tracking branches without touching your work</li>
            <li>How rebase replays commits onto a new base</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Key commands covered</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Inspect:</strong> git status, git diff, git log,
              git branch
            </li>
            <li>
              <strong className="text-foreground">Snapshot:</strong> git add, git commit
            </li>
            <li>
              <strong className="text-foreground">Branch:</strong> git switch, git merge
            </li>
            <li>
              <strong className="text-foreground">Remote:</strong> git push, git fetch, git rebase
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Concepts first</h4>
        <p className="text-sm text-muted-foreground">
          This lab is inspired by the “learn Git concepts, not commands” approach: commands make
          more sense once you can see what moved between the working tree, index, commits, branch
          labels, and remotes.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Browser-safe by design</h4>
        <p className="text-sm text-muted-foreground">
          This simulator does not run real Git. It models a small repository in the browser so you
          can experiment safely and build the mental model before using commands on real work.
        </p>
      </div>
    </>
  );
}

export default function GitConceptsSimulatorPage() {
  return (
    <SimulatorShell
      slug="git-concepts-simulator"
      fallbackTitle="Git Concepts Simulator"
      fallbackDescription="Practice Git in an interactive browser terminal. Learn the working directory, staging area, commits, branches, remotes, merge, fetch, and rebase through a visual repository model."
      educational={<GitConceptsEducational />}
      shareText="Learn Git concepts with an interactive terminal and visual repository model."
    >
      <GitConceptsSimulator />
    </SimulatorShell>
  );
}
