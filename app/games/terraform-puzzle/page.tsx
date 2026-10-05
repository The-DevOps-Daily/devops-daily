import type { Metadata } from 'next';
import Link from 'next/link';
import TerraformPuzzle from '@/components/games/terraform-puzzle';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('terraform-puzzle');
}

const seoLearningPoints = [
  'Rename or refactor Terraform resources with moved blocks instead of destroying them',
  'Adopt existing infrastructure with import blocks, and read the import plan before you apply',
  'Stop managing a resource without deleting it, with a removed block and destroy = false',
  'Clear a stale state lock with terraform force-unlock, only after checking nobody is running',
  'Handle drift: what terraform plan -refresh-only and apply -refresh-only really change',
  'Fix count index shifts by moving to for_each with moved blocks',
  'Recognise a plan that reads the wrong workspace or state',
];

function TerraformPuzzleEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About the Terraform State Puzzle</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll practise</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Reading a plan for the one line that matters: destroy, replace, or move</li>
            <li>
              Choosing between moved, import and removed blocks and their command-line versions
            </li>
            <li>
              Telling state, code and real infrastructure apart, and which one Terraform trusts
            </li>
            <li>Clearing a stale lock without trampling a run that is still alive</li>
            <li>Cleaning up after an apply that was killed halfway</li>
            <li>Refactoring count to for_each without replacing anything</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">How it works</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Eight puzzles:</strong> each one is a broken
              situation with the code, the plan, and the state or error a team would see.
            </li>
            <li>
              <strong className="text-foreground">Free checks:</strong> read-only commands such as
              terraform state list show more evidence before you decide.
            </li>
            <li>
              <strong className="text-foreground">Four kinds of answer:</strong> the best fix, a fix
              that works with a catch, a safe step that does not finish the job, and an unsafe one.
              Wrong picks show what Terraform would do.
            </li>
            <li>
              <strong className="text-foreground">Real output:</strong> every transcript was
              recorded with Terraform 1.15.8, using local stand-in resources relabelled as AWS.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Prefer blocks in code to state commands</h4>
        <p className="text-sm text-muted-foreground">
          Since Terraform 1.1 (moved), 1.5 (import) and 1.7 (removed), most state surgery can be
          written as code. The change shows up in the plan, goes through review with the rest of the
          pull request, and applies to every state that uses the configuration. The old commands,
          terraform state mv, terraform import and terraform state rm, still work, but they change
          the state at once, outside that flow.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Read more</h4>
        <p className="text-sm text-muted-foreground">
          New to Terraform? Start with the{' '}
          <Link
            href="/games/terraform-terminal-simulator"
            className="text-primary underline-offset-4 hover:underline"
          >
            Terraform Basics Simulator
          </Link>
          , which covers init, plan, apply and destroy. For the commands behind these puzzles, read{' '}
          <Link
            href="/posts/terraform-state-remove-move-migrate-backend"
            className="text-primary underline-offset-4 hover:underline"
          >
            how to remove, move and migrate Terraform state
          </Link>{' '}
          and{' '}
          <Link
            href="/posts/terraform-statefile-locked"
            className="text-primary underline-offset-4 hover:underline"
          >
            how to unlock a locked state file
          </Link>
          , or the{' '}
          <Link
            href="/guides/introduction-to-terraform/05-state-management"
            className="text-primary underline-offset-4 hover:underline"
          >
            state management chapter
          </Link>{' '}
          of our Terraform guide.
        </p>
      </div>
    </>
  );
}

export default function TerraformPuzzlePage() {
  return (
    <SimulatorShell
      slug="terraform-puzzle"
      fallbackTitle="Terraform State Puzzle"
      fallbackDescription="Fix broken Terraform state: renamed resources, imports that would replace, stale locks, drift, removed blocks and count index shifts."
      educational={<TerraformPuzzleEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Can you fix broken Terraform state without destroying production? Try the Terraform State Puzzle."
    >
      <TerraformPuzzle />
    </SimulatorShell>
  );
}
