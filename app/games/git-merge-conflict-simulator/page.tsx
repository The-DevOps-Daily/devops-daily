import type { Metadata } from 'next';
import Link from 'next/link';
import GitMergeConflictSimulator from '@/components/games/git-merge-conflict-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('git-merge-conflict-simulator');
}

const seoLearningPoints = [
  'Read Git conflict markers: <<<<<<< HEAD, ======= and >>>>>>>',
  'Inspect the base, ours and theirs versions with git show :1: :2: :3:',
  'Resolve a conflict by editing the file, then git add and git commit',
  'Use git checkout --ours and --theirs to take a whole side, for example for a binary file',
  'Understand why ours and theirs swap during a git rebase',
  'Back out of a bad merge with git merge --abort',
  'Catch a semantic conflict: a clean merge that breaks the tests',
];

function GitMergeConflictEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this merge conflict simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>What the conflict markers delimit, and which side is which</li>
            <li>The index stages Git keeps for an unmerged file: base, ours and theirs</li>
            <li>That resolving means writing the file you want, not picking a side</li>
            <li>When taking a whole side is right, as with a binary file</li>
            <li>Why --ours and --theirs swap meaning during a rebase</li>
            <li>How to back out of a merge with git merge --abort</li>
            <li>Why a clean merge can still break the build</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Key commands covered</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Inspect:</strong> git status, git diff, git show
              :1:/:2:/:3:&lt;file&gt;, git log --merge
            </li>
            <li>
              <strong className="text-foreground">Resolve:</strong> edit the file, git add, git
              commit
            </li>
            <li>
              <strong className="text-foreground">Take a side:</strong> git checkout --ours /
              --theirs, git checkout -m to start over
            </li>
            <li>
              <strong className="text-foreground">Rebase:</strong> git rebase --continue, --abort
            </li>
            <li>
              <strong className="text-foreground">Escape:</strong> git merge --abort
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-2 font-semibold">During a</th>
              <th className="p-2 font-mono font-semibold">--ours / HEAD</th>
              <th className="p-2 font-mono font-semibold">--theirs</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-t">
              <td className="p-2 text-foreground">merge</td>
              <td className="p-2">the branch you are on</td>
              <td className="p-2">the branch you are merging in</td>
            </tr>
            <tr className="border-t">
              <td className="p-2 text-foreground">rebase</td>
              <td className="p-2">
                the rebased result so far: the branch you rebase onto, plus your commits already
                replayed
              </td>
              <td className="p-2">the commit being replayed</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">The conflict Git cannot see</h4>
        <p className="text-sm text-muted-foreground">
          Git merges text. When two branches change different lines that depend on each other, the
          merge can be textually clean while the combined code is broken. Run your tests on the
          merge result, not only on each branch: CI on merge commits, or a merge queue that tests
          the combined code before it lands.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Learn by breaking things</h4>
        <p className="text-sm text-muted-foreground">
          This simulator does not run real Git. It models each repository in the browser, with the
          output real Git prints, so you can make the mistakes here first. For the model behind
          branches and commits, try the{' '}
          <Link
            href="/games/git-concepts-simulator"
            className="text-primary underline-offset-4 hover:underline"
          >
            Git Concepts Simulator
          </Link>
          , and read why Git is best learned by{' '}
          <Link
            href="/posts/linux-git-docker-learning-order"
            className="text-primary underline-offset-4 hover:underline"
          >
            breaking something and getting it back
          </Link>
          .
        </p>
      </div>
    </>
  );
}

export default function GitMergeConflictSimulatorPage() {
  return (
    <SimulatorShell
      slug="git-merge-conflict-simulator"
      fallbackTitle="Git Merge Conflict Simulator"
      fallbackDescription="Resolve Git merge conflicts in the browser: read the markers, edit the file, take a side with --ours or --theirs, survive a rebase, abort a merge, and catch a clean merge that breaks the build."
      educational={<GitMergeConflictEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Practice Git merge conflicts: markers, --ours/--theirs, rebase, abort, and the clean merge that breaks the build."
    >
      <GitMergeConflictSimulator />
    </SimulatorShell>
  );
}
