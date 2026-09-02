import type { Metadata } from 'next';
import { ExternalLink } from 'lucide-react';
import PreviewEnvironmentSimulator from '@/components/games/preview-environment-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('preview-environment-simulator');
}

const seoLearningPoints = [
  'How a pull-request label or Git declaration creates preview-environment intent',
  'How GitHub Actions, Argo CD ApplicationSets, Helm, and Kubernetes reconcile that intent',
  'How a Neon database branch gives each preview environment isolated test data',
  'How single-service previews differ from coordinated full-stack UAT environments',
  'How data strategy, resource sizing, access policy, and TTL affect cost and isolation',
  'How to diagnose branch mismatches, quota failures, missing secrets, DNS issues, and revision drift',
  'Which health, test, revision, configuration, and cost evidence should return to a pull request',
  'Why teardown must be automatic, observable, and driven through the same control path as creation',
];

function PreviewEnvironmentEducational() {
  return (
    <>
      <div className="mb-6 rounded-lg border border-blue-500/25 bg-blue-500/5 p-4 sm:p-5">
        <p className="font-mono text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300">
          DevOps Daily × Atomsized
        </p>
        <h3 className="mt-2 text-xl font-semibold">
          Inspired by Atomsized&apos;s preview-platform workflow
        </h3>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">
          This simulator was developed in partnership with Atomsized and is inspired by their
          published approach to pull-request previews and coordinated full-stack UAT environments.
          The walkthrough centers on Atomsized&apos;s full preview-environment workflow, following
          the application from pull-request intent through GitOps deployment, review, and automatic
          teardown.
        </p>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">
          The data layer uses a Neon database branch to show how isolated preview data can follow
          that same pull-request lifecycle.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <a
            href="https://atomsized.com/preview-environments"
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 underline-offset-4 hover:underline dark:text-blue-300"
          >
            Explore Atomsized preview environments
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://neon.com/branching"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Database branching by Neon
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <h3 className="mb-4 text-xl font-semibold">
        A preview environment is a lifecycle, not a URL
      </h3>
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <h4 className="mb-2 text-sm font-semibold">1. Declare intent in Git</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A label is enough for a single-service preview. A coordinated stack needs an explicit
            declaration of repositories and branch overrides so every revision is reviewable.
          </p>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">2. Return evidence to the PR</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A green URL is incomplete evidence. Reviewers need the deployed commit and image, health
            gates, tests, configuration differences, logs, access policy, and expiry.
          </p>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">3. Reconcile deletion too</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Closing a PR, removing its label, deleting its declaration, or reaching its TTL should
            remove ingress, workloads, data, and namespaces without leaving orphaned cost behind.
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <h4 className="mb-2 text-sm font-semibold">What a platform team must decide</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Define who may open the environment, how preview secrets are sourced, whether data is
          synthetic or masked, which readiness gates block review, how DNS and certificates are
          issued, and which quota, TTL, budget, and orphan alerts enforce cleanup. These policies
          turn an ad hoc deployment script into a dependable internal platform capability.
        </p>
      </div>
    </>
  );
}

export default function PreviewEnvironmentSimulatorPage() {
  return (
    <SimulatorShell
      slug="preview-environment-simulator"
      fallbackTitle="Preview Environment Simulator"
      fallbackDescription="See how a pull request becomes a temporary copy of your app, then review it and watch every resource disappear."
      educational={<PreviewEnvironmentEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="I built a pull-request preview from Git intent to review evidence—and proved the cleanup path works."
    >
      <PreviewEnvironmentSimulator />
    </SimulatorShell>
  );
}
