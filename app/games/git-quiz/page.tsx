import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GenericQuiz from '@/components/games/generic-quiz';
import { ReportIssue } from '@/components/report-issue';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getQuizById } from '@/lib/quiz-loader';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('git-quiz');
}

function GitQuizEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About Git Command Quiz</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        The Git Command Quiz is an interactive learning tool designed to help developers
        understand Git through real-world scenarios. Instead of memorizing commands, you&apos;ll
        learn by solving practical problems you encounter in everyday development.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Handling merge conflicts effectively</li>
            <li>When to use rebase vs merge</li>
            <li>Cleaning up commit history</li>
            <li>Stashing and workflow management</li>
            <li>Advanced Git operations like cherry-picking</li>
            <li>Undoing mistakes safely</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Difficulty levels</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Beginner:</strong> Basic merging and conflict
              resolution.
            </li>
            <li>
              <strong className="text-foreground">Intermediate:</strong> Rebasing, stashing, and
              workflow optimization.
            </li>
            <li>
              <strong className="text-foreground">Advanced:</strong> Interactive rebasing and
              complex scenarios.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Pro tip</h4>
        <p className="text-sm text-muted-foreground">
          Each scenario is based on real situations developers face. The explanations help you
          understand not just the <em>what</em> but the <em>why</em> behind each Git command,
          making you a more confident developer.
        </p>
      </div>

      <div className="mt-6">
        <ReportIssue
          title="Git Fundamentals Quiz"
          type="quiz"
          slug="git-quiz"
          variant="compact"
        />
      </div>
    </>
  );
}

export default async function GitQuizPage() {
  const quizConfig = await getQuizById('git-quiz');

  if (!quizConfig) {
    notFound();
  }

  return (
    <SimulatorShell
      slug="git-quiz"
      educational={<GitQuizEducational />}
      shareText="Test your Git skills with the Git Command Quiz! Understand merge conflicts, rebasing, and complex Git workflows."
    >
      <GenericQuiz quizConfig={quizConfig} />
    </SimulatorShell>
  );
}
