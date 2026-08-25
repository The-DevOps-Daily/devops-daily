'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Boxes,
  Check,
  CheckCircle2,
  CircleDot,
  Clock3,
  Code2,
  Database,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  Globe2,
  HardDrive,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  MessageSquare,
  Package,
  Play,
  RotateCcw,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Workflow,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Github } from '@/components/icons/social-icons';
import { Switch } from '@/components/ui/switch';
import {
  PREVIEW_FAILURES,
  advancePreviewEnvironment,
  applyPreviewRemediation,
  beginPreviewTeardown,
  createPreviewEnvironmentState,
  getPreviewMetrics,
  recordPreviewReview,
  type PreviewEnvironmentConfig,
  type PreviewEnvironmentState,
  type PreviewFailureId,
  type PreviewStageId,
} from '@/lib/games/preview-environment-engine';
import { cn } from '@/lib/utils';

type Scene = 'developer' | 'gitops' | 'environment';
type PipelineBeat = 'build' | 'push' | 'detect' | 'render';
type ResourceState = 'queued' | 'creating' | 'ready' | 'removing' | 'removed';

interface PullRequestScenario {
  id: string;
  number: number;
  title: string;
  author: string;
  branch: string;
  commit: string;
  opened: string;
  comments: number;
  commits: number;
  changedFiles: number;
  additions: number;
  deletions: number;
  summary: string;
  labels: string[];
  config: PreviewEnvironmentConfig;
  failure: PreviewFailureId;
}

const PULL_REQUESTS: PullRequestScenario[] = [
  {
    id: 'checkout',
    number: 184,
    title: 'feat: redesign the checkout flow',
    author: 'maya-dev',
    branch: 'checkout-v2',
    commit: '8f3c2a1',
    opened: '18 minutes ago',
    comments: 3,
    commits: 4,
    changedFiles: 12,
    additions: 428,
    deletions: 96,
    summary:
      'Reworks checkout across the storefront and API. The team needs a safe place to test the full flow before merging.',
    labels: ['frontend', 'api'],
    config: {
      mode: 'full-stack',
      services: ['web', 'api'],
      dataStrategy: 'masked-snapshot',
      resourceProfile: 'balanced',
      reviewerAccess: 'team-sso',
      ttlHours: 8,
      revisionGate: true,
      injectedFailure: 'none',
    },
    failure: 'branch-mismatch',
  },
  {
    id: 'orders',
    number: 183,
    title: 'feat: add the order status endpoint',
    author: 'nikola-dev',
    branch: 'order-status-api',
    commit: 'c61d9e4',
    opened: '42 minutes ago',
    comments: 1,
    commits: 2,
    changedFiles: 7,
    additions: 219,
    deletions: 31,
    summary:
      'Adds a customer-facing status endpoint and the sandbox payment integration needed to exercise it.',
    labels: ['api'],
    config: {
      mode: 'single-service',
      services: ['api'],
      dataStrategy: 'synthetic',
      resourceProfile: 'lean',
      reviewerAccess: 'team-sso',
      ttlHours: 6,
      revisionGate: true,
      injectedFailure: 'none',
    },
    failure: 'missing-secret',
  },
  {
    id: 'events',
    number: 182,
    title: 'feat: process checkout events asynchronously',
    author: 'sara-dev',
    branch: 'checkout-worker',
    commit: '72ba640',
    opened: '2 hours ago',
    comments: 5,
    commits: 6,
    changedFiles: 19,
    additions: 684,
    deletions: 144,
    summary:
      'Introduces a worker and queue so checkout events can be processed away from the request path.',
    labels: ['backend', 'worker'],
    config: {
      mode: 'full-stack',
      services: ['web', 'api', 'worker'],
      dataStrategy: 'masked-snapshot',
      resourceProfile: 'balanced',
      reviewerAccess: 'team-sso',
      ttlHours: 12,
      revisionGate: true,
      injectedFailure: 'none',
    },
    failure: 'revision-drift',
  },
];

const PIPELINE_STEPS: Array<{
  id: PipelineBeat;
  title: string;
  detail: string;
  duration: number;
  command: string;
}> = [
  {
    id: 'build',
    title: 'Build container image',
    detail: 'GitHub Actions packages the PR change',
    duration: 5000,
    command: 'docker build --tag checkout:SHA .',
  },
  {
    id: 'push',
    title: 'Push image to registry',
    detail: 'The immutable commit image becomes available',
    duration: 5000,
    command: 'docker push registry.example.dev/checkout:SHA',
  },
  {
    id: 'detect',
    title: 'Detect preview label',
    detail: 'The GitOps controller notices the pull request',
    duration: 2500,
    command: 'applicationset: matched label preview',
  },
  {
    id: 'render',
    title: 'Render desired state',
    detail: 'Argo CD generates applications and Helm values',
    duration: 2500,
    command: 'argocd app sync preview-pr-PR_NUMBER',
  },
];

const SCENES: Array<{ id: Scene; number: string; label: string }> = [
  { id: 'developer', number: '01', label: 'Developer intent' },
  { id: 'gitops', number: '02', label: 'GitOps control plane' },
  { id: 'environment', number: '03', label: 'Ephemeral environment' },
];

function labelClasses(label: string): string {
  return (
    {
      frontend: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
      api: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
      backend: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
      worker: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
      preview: 'border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200',
      enhancement: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    }[label] ?? 'border-border bg-muted text-muted-foreground'
  );
}

function activeStage(state: PreviewEnvironmentState): PreviewStageId | null {
  const ids: PreviewStageId[] = [
    'intent',
    'coordinate',
    'reconcile',
    'provision',
    'expose',
    'verify',
  ];
  return ids.find((id) => state.stageStatuses[id] === 'active') ?? null;
}

function stageDone(state: PreviewEnvironmentState, id: PreviewStageId): boolean {
  return state.stageStatuses[id] === 'complete' || state.stageStatuses[id] === 'remediated';
}

function GitHubChrome({
  activeTab,
  children,
}: {
  activeTab: 'pulls' | 'actions';
  children: ReactNode;
}) {
  const tabs = [
    { id: 'code', label: 'Code', icon: Code2 },
    { id: 'issues', label: 'Issues', icon: CircleDot },
    { id: 'pulls', label: 'Pull requests', icon: GitPullRequest },
    { id: 'actions', label: 'Actions', icon: Play },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117] text-[#e6edf3] shadow-2xl shadow-black/20">
      <div className="flex min-h-14 items-center gap-3 border-b border-[#21262d] bg-[#010409] px-3 sm:px-5">
        <Github className="size-6 shrink-0 fill-current" aria-hidden="true" />
        <div className="min-w-0 text-sm">
          <span className="text-[#8b949e]">acme / </span>
          <span className="font-semibold text-[#2f81f7]">store</span>
        </div>
        <span className="rounded-full border border-[#30363d] px-2 py-0.5 text-[10px] text-[#8b949e]">
          Public
        </span>
      </div>
      <nav
        aria-label="Repository navigation"
        className="flex gap-1 overflow-x-auto border-b border-[#21262d] bg-[#010409] px-2 pt-1 sm:px-4"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = tab.id === activeTab;
          return (
            <div
              key={tab.id}
              className={cn(
                'flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium',
                selected ? 'border-[#f78166] text-[#e6edf3]' : 'border-transparent text-[#8b949e]'
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {tab.label}
            </div>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

function Label({ children }: { children: string }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        labelClasses(children)
      )}
    >
      {children}
    </span>
  );
}

function PullRequestList({ onOpen }: { onOpen: (pullRequest: PullRequestScenario) => void }) {
  return (
    <GitHubChrome activeTab="pulls">
      <div className="p-3 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="flex min-h-9 flex-1 items-center rounded-md border border-[#30363d] bg-[#010409] px-3 text-xs text-[#8b949e]">
            <Search className="mr-2 size-4" aria-hidden="true" />
            is:pr is:open
          </div>
          <div className="flex gap-2">
            <span className="rounded-md border border-[#30363d] bg-[#21262d] px-3 py-2 text-xs font-semibold">
              Labels
            </span>
            <span className="rounded-md bg-[#238636] px-3 py-2 text-xs font-semibold">
              New pull request
            </span>
          </div>
        </div>
        <div className="overflow-hidden rounded-md border border-[#30363d]">
          <div className="flex items-center gap-5 border-b border-[#30363d] bg-[#161b22] px-4 py-3 text-xs">
            <span className="flex items-center gap-2 font-semibold">
              <GitPullRequest className="size-4 text-[#3fb950]" aria-hidden="true" />3 Open
            </span>
            <span className="text-[#8b949e]">18 Closed</span>
            <span className="ml-auto hidden text-[#8b949e] sm:inline">Sort</span>
          </div>
          {PULL_REQUESTS.map((pullRequest) => (
            <button
              key={pullRequest.id}
              type="button"
              onClick={() => onOpen(pullRequest)}
              className="group flex w-full gap-3 border-b border-[#21262d] px-4 py-4 text-left last:border-b-0 hover:bg-[#161b22]"
            >
              <GitPullRequest
                className="mt-0.5 size-4 shrink-0 text-[#3fb950]"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold group-hover:text-[#2f81f7]">
                    {pullRequest.title}
                  </span>
                  {pullRequest.labels.map((label) => (
                    <Label key={label}>{label}</Label>
                  ))}
                </span>
                <span className="mt-1 block text-xs text-[#8b949e]">
                  #{pullRequest.number} opened {pullRequest.opened} by {pullRequest.author}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-[#8b949e]">
                <MessageSquare className="size-4" aria-hidden="true" />
                {pullRequest.comments}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-[#8b949e]">
          Choose a pull request to request its own temporary environment.
        </p>
      </div>
    </GitHubChrome>
  );
}

function PullRequestDetail({
  pullRequest,
  labelPickerOpen,
  onBack,
  onToggleLabels,
  onAddPreview,
}: {
  pullRequest: PullRequestScenario;
  labelPickerOpen: boolean;
  onBack: () => void;
  onToggleLabels: () => void;
  onAddPreview: () => void;
}) {
  return (
    <GitHubChrome activeTab="pulls">
      <div className="p-3 sm:p-5">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-xs font-medium text-[#2f81f7] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Pull requests
        </button>
        <div className="border-b border-[#21262d] pb-4">
          <h3 className="text-xl font-normal leading-tight sm:text-2xl">
            {pullRequest.title}{' '}
            <span className="font-light text-[#8b949e]">#{pullRequest.number}</span>
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#8b949e]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#238636] px-3 py-1 font-semibold text-white">
              <GitPullRequest className="size-4" aria-hidden="true" />
              Open
            </span>
            <strong className="text-[#e6edf3]">{pullRequest.author}</strong> wants to merge{' '}
            {pullRequest.commits} commits into
            <span className="rounded-full bg-[#388bfd1a] px-2 py-0.5 font-mono text-[#58a6ff]">
              main
            </span>
            from
            <span className="rounded-full bg-[#388bfd1a] px-2 py-0.5 font-mono text-[#58a6ff]">
              {pullRequest.branch}
            </span>
          </div>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto border-b border-[#21262d]">
          {[
            'Conversation ' + pullRequest.comments,
            'Commits ' + pullRequest.commits,
            'Checks 0',
            'Files changed ' + pullRequest.changedFiles,
          ].map((tab, index) => (
            <span
              key={tab}
              className={cn(
                'shrink-0 border-b-2 px-3 py-2 text-xs font-medium',
                index === 0
                  ? 'border-[#f78166] text-[#e6edf3]'
                  : 'border-transparent text-[#8b949e]'
              )}
            >
              {tab}
            </span>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0">
            <div className="overflow-hidden rounded-md border border-[#30363d]">
              <div className="border-b border-[#30363d] bg-[#161b22] px-4 py-3 text-xs">
                <strong>{pullRequest.author}</strong>{' '}
                <span className="text-[#8b949e]">commented {pullRequest.opened}</span>
              </div>
              <div className="space-y-4 p-4 text-sm leading-6">
                <p>{pullRequest.summary}</p>
                <div className="rounded-md border border-[#30363d] bg-[#161b22] p-3">
                  <strong className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="size-4 text-[#3fb950]" aria-hidden="true" />
                    What should reviewers verify?
                  </strong>
                  <ul className="mt-2 space-y-1 text-xs text-[#8b949e]">
                    <li>• The changed services work together.</li>
                    <li>• Test data stays isolated from production.</li>
                    <li>• The deployed revision matches commit {pullRequest.commit}.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-md border border-[#30363d] bg-[#161b22] p-3 text-xs text-[#8b949e]">
              <strong className="text-[#e6edf3]">{pullRequest.author}</strong> added{' '}
              {pullRequest.additions} lines and removed {pullRequest.deletions}.
            </div>
          </div>

          <aside className="text-xs">
            {['Reviewers', 'Assignees', 'Projects'].map((heading) => (
              <div key={heading} className="border-b border-[#21262d] py-3">
                <strong className="block">{heading}</strong>
                <span className="text-[#8b949e]">None yet</span>
              </div>
            ))}
            <div className="relative border-b border-[#21262d] py-3">
              <div className="mb-2 flex items-center justify-between">
                <strong>Labels</strong>
                <button
                  type="button"
                  onClick={onToggleLabels}
                  className="rounded p-1 text-[#8b949e] hover:bg-[#21262d]"
                  aria-label="Add a label"
                >
                  <Tag className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pullRequest.labels.map((label) => (
                  <Label key={label}>{label}</Label>
                ))}
              </div>
              <button
                type="button"
                onClick={onToggleLabels}
                className="mt-3 w-full rounded-md border border-[#30363d] bg-[#21262d] px-3 py-2 text-left font-semibold hover:bg-[#30363d]"
              >
                Add label
              </button>
              {labelPickerOpen && (
                <div className="absolute right-0 top-10 z-20 w-64 overflow-hidden rounded-md border border-[#30363d] bg-[#161b22] shadow-2xl shadow-black/60">
                  <div className="border-b border-[#30363d] px-3 py-2">
                    <strong>Apply labels</strong>
                    <div className="mt-2 flex items-center rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-[#8b949e]">
                      <Search className="mr-2 size-3.5" aria-hidden="true" />
                      Filter labels
                    </div>
                  </div>
                  {[
                    ['preview', 'Create an isolated review environment'],
                    ['enhancement', 'New feature or request'],
                    ['frontend', 'Storefront change'],
                  ].map(([label, description]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={label === 'preview' ? onAddPreview : undefined}
                      className="flex w-full gap-2 border-b border-[#21262d] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#21262d]"
                    >
                      <span
                        className={cn(
                          'mt-1 size-3 shrink-0 rounded-full border',
                          labelClasses(label)
                        )}
                      />
                      <span>
                        <strong className="block">{label}</strong>
                        <span className="text-[10px] leading-4 text-[#8b949e]">{description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 rounded-md border border-[#1f6feb] bg-[#0c2d6b33] p-3">
          <span className="flex items-start gap-2 text-xs">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-[#58a6ff]" aria-hidden="true" />
            <span>
              <strong className="block">Ask for a live preview</strong>
              <span className="text-[#8b949e]">Add the preview label like a real PR.</span>
            </span>
          </span>
          <button
            type="button"
            onClick={onToggleLabels}
            className="shrink-0 rounded-md bg-[#238636] px-3 py-2 text-xs font-semibold hover:bg-[#2ea043]"
          >
            Add label
          </button>
        </div>
      </div>
    </GitHubChrome>
  );
}

function CircularProgress({ progress }: { progress: number }) {
  const circumference = 2 * Math.PI * 10;
  return (
    <svg className="size-6 -rotate-90" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="#30363d" strokeWidth="2" />
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="#2f81f7"
        strokeLinecap="round"
        strokeWidth="2"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress / 100)}
      />
    </svg>
  );
}

function FailurePanel({
  state,
  onRemediate,
}: {
  state: PreviewEnvironmentState;
  onRemediate: (id: string) => void;
}) {
  if (!state.activeFailure) return null;
  const failure = PREVIEW_FAILURES[state.activeFailure];
  return (
    <div className="rounded-lg border border-[#f85149] bg-[#49020233] p-4">
      <div className="flex gap-3">
        <XCircle className="mt-0.5 size-5 shrink-0 text-[#f85149]" aria-hidden="true" />
        <div>
          <strong className="text-[#ff7b72]">{failure.label}</strong>
          <p className="mt-1 text-xs leading-5 text-[#c9d1d9]">{failure.signal}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {failure.remediationOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onRemediate(option.id)}
            className="rounded-md border border-[#30363d] bg-[#161b22] p-3 text-left text-xs hover:border-[#58a6ff]"
          >
            <strong className="block">{option.label}</strong>
            <span className="mt-1 block leading-4 text-[#8b949e]">{option.explanation}</span>
          </button>
        ))}
      </div>
      {state.failedRemediationAttempts > 0 && (
        <p className="mt-3 text-xs text-[#ff7b72]">{state.lastEvent}</p>
      )}
    </div>
  );
}

function PipelineIcon({
  status,
  progress,
}: {
  status: 'waiting' | 'running' | 'successful' | 'failed';
  progress: number;
}) {
  if (status === 'running') return <CircularProgress progress={progress} />;
  if (status === 'successful') {
    return (
      <span className="grid size-6 place-items-center rounded-full bg-[#238636]">
        <Check className="size-4 text-white" aria-hidden="true" />
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="grid size-6 place-items-center rounded-full bg-[#da3633]">
        <XCircle className="size-4 text-white" aria-hidden="true" />
      </span>
    );
  }
  return <span className="size-6 rounded-full border-2 border-[#30363d]" />;
}

function GitOpsScene({
  pullRequest,
  beat,
  progress,
  state,
  onRemediate,
}: {
  pullRequest: PullRequestScenario;
  beat: PipelineBeat;
  progress: number;
  state: PreviewEnvironmentState;
  onRemediate: (id: string) => void;
}) {
  const index = PIPELINE_STEPS.findIndex((step) => step.id === beat);
  const current = PIPELINE_STEPS[index];
  const failed = state.status === 'blocked';
  return (
    <GitHubChrome activeTab="actions">
      <div className="grid min-h-[500px] md:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="border-b border-[#21262d] p-4 md:border-b-0 md:border-r">
          <strong className="mb-4 flex items-center gap-2 text-xs">
            <Workflow className="size-4" aria-hidden="true" />
            Actions
          </strong>
          <div className="rounded-md bg-[#21262d] px-3 py-2 text-xs font-semibold">
            Preview environment
          </div>
          <div className="mt-3 space-y-2 text-xs text-[#8b949e]">
            <div>CI</div>
            <div>Code quality</div>
            <div>Deploy production</div>
          </div>
          <a
            href="https://atomsized.com/preview-environments"
            target="_blank"
            rel="noreferrer"
            className="mt-6 flex gap-2 rounded-md border border-[#30363d] p-3 text-[10px] leading-4 text-[#8b949e] hover:border-[#58a6ff] hover:text-[#58a6ff]"
          >
            <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Pattern inspired by Atomsized
              <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />
            </span>
          </a>
        </aside>

        <div className="min-w-0 p-3 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#21262d] pb-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                {failed ? (
                  <XCircle className="size-5 text-[#f85149]" aria-hidden="true" />
                ) : (
                  <LoaderCircle className="size-5 animate-spin text-[#58a6ff]" aria-hidden="true" />
                )}
                Preview environment #{pullRequest.number}
              </h3>
              <p className="mt-1 text-xs text-[#8b949e]">
                Pull request #{pullRequest.number} · {pullRequest.branch} · {pullRequest.commit}
              </p>
            </div>
            <span
              className={cn(
                'rounded-full border px-2.5 py-1 text-[10px] font-semibold',
                failed ? 'border-[#f85149] text-[#ff7b72]' : 'border-[#1f6feb] text-[#58a6ff]'
              )}
            >
              {failed ? 'Action required' : 'In progress'}
            </span>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(240px,0.8fr)_minmax(300px,1.2fr)]">
            <div className="overflow-hidden rounded-md border border-[#30363d]">
              <div className="border-b border-[#30363d] bg-[#161b22] px-3 py-2 text-xs font-semibold">
                Jobs
              </div>
              {PIPELINE_STEPS.map((step, stepIndex) => {
                const status =
                  stepIndex < index
                    ? 'successful'
                    : stepIndex > index
                      ? 'waiting'
                      : failed
                        ? 'failed'
                        : 'running';
                return (
                  <div
                    key={step.id}
                    className={cn(
                      'flex gap-3 border-b border-[#21262d] px-3 py-3 last:border-b-0',
                      stepIndex === index && 'bg-[#1f6feb14]'
                    )}
                  >
                    <PipelineIcon status={status} progress={stepIndex === index ? progress : 100} />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <strong className="text-xs">{step.title}</strong>
                        <span className="text-[10px] uppercase tracking-wide text-[#8b949e]">
                          {status === 'waiting'
                            ? 'Waiting'
                            : status === 'running'
                              ? 'Running'
                              : status === 'successful'
                                ? 'Successful'
                                : 'Failed'}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] leading-4 text-[#8b949e]">{step.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="overflow-hidden rounded-md border border-[#30363d] bg-[#010409]">
              <div className="flex justify-between border-b border-[#30363d] bg-[#161b22] px-3 py-2 text-xs">
                <strong>{current.title}</strong>
                <span className="text-[#8b949e]">{current.duration / 1000}s</span>
              </div>
              <div className="min-h-56 space-y-2 overflow-x-auto p-4 font-mono text-[11px] leading-5">
                <div className="text-[#8b949e]">Runner image: ubuntu-latest</div>
                <div>
                  <span className="text-[#3fb950]">✓</span> Checkout {pullRequest.branch} at{' '}
                  {pullRequest.commit}
                </div>
                {index > 0 && (
                  <div>
                    <span className="text-[#3fb950]">✓</span> Image built successfully
                  </div>
                )}
                {index > 1 && (
                  <div>
                    <span className="text-[#3fb950]">✓</span> Image pushed to registry
                  </div>
                )}
                {index > 2 && (
                  <div>
                    <span className="text-[#3fb950]">✓</span> preview label detected
                  </div>
                )}
                <div className={cn('text-[#58a6ff]', !failed && 'animate-pulse')}>
                  <span>$ </span>
                  {current.command
                    .replace('SHA', pullRequest.commit)
                    .replace('PR_NUMBER', String(pullRequest.number))}
                </div>
                {failed ? (
                  <div className="text-[#ff7b72]">Error: {state.lastEvent}</div>
                ) : (
                  <div className="flex items-center gap-2 text-[#8b949e]">
                    <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
                    This automated step continues on its own.
                  </div>
                )}
              </div>
              <div className="h-1 bg-[#21262d]">
                <div
                  className="h-full bg-[#2f81f7] transition-[width] duration-100"
                  style={{ width: String(progress) + '%' }}
                />
              </div>
            </div>
          </div>
          {failed ? (
            <div className="mt-4">
              <FailurePanel state={state} onRemediate={onRemediate} />
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-[#30363d] bg-[#161b22] p-3 text-xs text-[#8b949e]">
              <Clock3 className="size-4 shrink-0 text-[#58a6ff]" aria-hidden="true" />
              No click needed — build, push, detection, and rendering are automated.
            </div>
          )}
        </div>
      </div>
    </GitHubChrome>
  );
}

function ResourceStatus({ status }: { status: ResourceState }) {
  if (status === 'creating' || status === 'removing') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide',
          status === 'creating' ? 'text-blue-400' : 'text-amber-300'
        )}
      >
        <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
        {status === 'creating' ? 'Creating' : 'Removing'}
      </span>
    );
  }
  if (status === 'ready' || status === 'removed') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide',
          status === 'ready' ? 'text-emerald-400' : 'text-muted-foreground'
        )}
      >
        <CheckCircle2 className="size-3" aria-hidden="true" />
        {status === 'ready' ? 'Ready' : 'Removed'}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      Queued
    </span>
  );
}

function ResourceCard({
  title,
  detail,
  status,
  icon: Icon,
  wide,
  children,
}: {
  title: string;
  detail: string;
  status: ResourceState;
  icon: typeof Boxes;
  wide?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-all duration-500',
        wide && 'sm:col-span-2',
        status === 'creating' && 'border-blue-500 bg-blue-500/5 shadow-lg shadow-blue-500/10',
        status === 'ready' && 'border-emerald-500/40 bg-emerald-500/5',
        status === 'queued' && 'border-border/60 bg-background/40 opacity-55',
        status === 'removing' && 'border-amber-400/40 bg-amber-400/5 opacity-70',
        status === 'removed' && 'border-border/40 bg-background/20 opacity-40'
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap justify-between gap-2">
            <strong className="text-sm">{title}</strong>
            <ResourceStatus status={status} />
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function EnvironmentScene({
  pullRequest,
  state,
  progress,
  onRemediate,
  onReview,
  onClose,
  onAgain,
}: {
  pullRequest: PullRequestScenario;
  state: PreviewEnvironmentState;
  progress: number;
  onRemediate: (id: string) => void;
  onReview: (decision: 'approve' | 'request-changes') => void;
  onClose: () => void;
  onAgain: () => void;
}) {
  const stage = activeStage(state);
  const cleaning = state.status === 'cleaning';
  const removed = state.status === 'removed';
  const ready = state.status === 'ready';
  const reviewed = state.status === 'reviewed';
  const metrics = getPreviewMetrics(state.config);
  const namespace = 'preview-pr-' + pullRequest.number;
  const reviewUrl = pullRequest.id + '-' + pullRequest.number + '.preview.example.dev';
  const resourceState = (doneAt: PreviewStageId): ResourceState => {
    if (removed) return 'removed';
    if (cleaning) return 'removing';
    if (stageDone(state, doneAt) || ready || reviewed) return 'ready';
    if (stage === doneAt) return 'creating';
    return 'queued';
  };
  const provision = resourceState('provision');
  const expose = resourceState('expose');
  const verify = resourceState('verify');
  const title =
    stage === 'provision'
      ? 'Creating an isolated Kubernetes boundary'
      : stage === 'expose'
        ? 'Connecting data, DNS, and TLS'
        : stage === 'verify'
          ? 'Running health and revision checks'
          : cleaning
            ? 'Deleting the whole preview as one unit'
            : removed
              ? 'Preview environment removed'
              : 'Preview environment is live';

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-3 py-3 sm:px-5">
        <span className="grid size-9 place-items-center rounded-lg bg-blue-500/10 text-blue-400">
          <Layers3 className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{namespace}</h3>
          <p className="text-xs text-muted-foreground">
            PR #{pullRequest.number} · {pullRequest.commit} · expires in {state.config.ttlHours}h
          </p>
        </div>
        <span className="ml-auto rounded-full border border-blue-500/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-400">
          {removed
            ? 'Removed'
            : ready || reviewed
              ? 'Live'
              : cleaning
                ? 'Cleaning up'
                : 'Provisioning'}
        </span>
      </div>
      <div className="p-3 sm:p-5">
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-background/60 p-3">
          {removed || ready || reviewed ? (
            <CheckCircle2 className="size-5 shrink-0 text-emerald-400" aria-hidden="true" />
          ) : (
            <CircularProgress progress={progress} />
          )}
          <div className="min-w-0">
            <strong className="block text-sm">{title}</strong>
            <span className="block truncate text-xs text-muted-foreground">
              {removed
                ? 'CI is historical, Argo CD is idle, and no preview resources remain.'
                : cleaning
                  ? 'Namespace, workloads, data branch, and URL are removed together.'
                  : state.lastEvent}
            </span>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.5fr)]">
          <div className="grid content-start gap-3 sm:grid-cols-2">
            <ResourceCard
              title="Kubernetes namespace"
              detail={namespace + ' · isolated network and quota'}
              status={provision}
              icon={Boxes}
              wide
            />
            <ResourceCard
              title="App workloads"
              detail={state.config.services.join(' + ') + ' · commit ' + pullRequest.commit}
              status={provision}
              icon={ServerCog}
            />
            <ResourceCard
              title="Image revision"
              detail={'registry.example.dev/store:' + pullRequest.commit}
              status={provision}
              icon={Package}
            />
            <ResourceCard
              title="Database branch"
              detail={
                state.config.dataStrategy === 'synthetic'
                  ? 'fresh synthetic fixtures'
                  : 'isolated masked snapshot'
              }
              status={expose}
              icon={Database}
            >
              <a
                href="https://neon.com/branching"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-400 hover:underline"
              >
                Preview database branching by Neon
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </ResourceCard>
            <ResourceCard
              title="Redis cache"
              detail="preview-scoped cache · isolated keys"
              status={expose}
              icon={HardDrive}
            />
            <ResourceCard
              title="Review URL"
              detail={reviewUrl}
              status={expose}
              icon={Globe2}
              wide
            />
          </div>
          <aside className="space-y-3">
            <div className="rounded-lg border border-border bg-background/50 p-4">
              <strong className="mb-3 flex items-center gap-2 text-sm">
                <ShieldCheck className="size-4 text-emerald-400" aria-hidden="true" />
                Verification
              </strong>
              {[
                ['Health checks', verify],
                ['Revision match', verify],
                ['Team SSO', expose],
                ['Automatic expiry', expose],
              ].map(([label, status]) => (
                <div
                  key={label}
                  className="flex justify-between gap-2 border-b border-border/60 py-2 text-xs last:border-b-0"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <ResourceStatus status={status as ResourceState} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border bg-background/50 p-3">
                <span className="text-[10px] uppercase text-muted-foreground">Hourly cost</span>
                <div className="mt-1 font-mono text-lg font-semibold">
                  <span>$</span>
                  {removed ? '0.00' : metrics.hourlyCost.toFixed(2)}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background/50 p-3">
                <span className="text-[10px] uppercase text-muted-foreground">Isolation</span>
                <div className="mt-1 font-mono text-lg font-semibold">
                  {metrics.isolationScore}%
                </div>
              </div>
            </div>
          </aside>
        </div>

        {state.status === 'blocked' && (
          <div className="mt-4">
            <FailurePanel state={state} onRemediate={onRemediate} />
          </div>
        )}
        {ready && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <strong className="block text-sm text-emerald-300">
                The preview is ready for a human decision.
              </strong>
              <span className="text-xs text-muted-foreground">
                Review the URL, then record whether this revision looks right.
              </span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onReview('request-changes')}>
                Request changes
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                onClick={() => onReview('approve')}
              >
                Approve preview
              </Button>
            </div>
          </div>
        )}
        {reviewed && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-background/60 p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <strong className="block text-sm">
                {state.reviewDecision === 'approve'
                  ? 'Preview approved — the PR can move forward.'
                  : 'Changes requested — the preview stays isolated.'}
              </strong>
              <span className="text-xs text-muted-foreground">
                Close the PR to watch Argo CD remove the environment automatically.
              </span>
            </div>
            <Button size="sm" variant="destructive" onClick={onClose}>
              <Trash2 className="size-4" aria-hidden="true" />
              Close PR & clean up
            </Button>
          </div>
        )}
        {cleaning && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-amber-400/40 bg-amber-400/5 p-4 text-sm">
            <LoaderCircle className="size-5 animate-spin text-amber-300" aria-hidden="true" />
            <span>
              <strong>Argo CD is pruning the environment.</strong>{' '}
              <span className="text-muted-foreground">
                All Kubernetes resources disappear in one cleanup.
              </span>
            </span>
          </div>
        )}
        {removed && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <strong className="block text-sm text-emerald-300">
                Cleanup complete. Cost is back to $0.00/hr.
              </strong>
              <span className="text-xs text-muted-foreground">
                The pipeline succeeded earlier; Argo CD is no longer active.
              </span>
            </div>
            <Button size="sm" onClick={onAgain}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Add preview label again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function PreviewEnvironmentSimulator() {
  const [selectedId, setSelectedId] = useState(PULL_REQUESTS[0].id);
  const [developerView, setDeveloperView] = useState<'list' | 'pull'>('list');
  const [scene, setScene] = useState<Scene>('developer');
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);
  const [practiceFailure, setPracticeFailure] = useState(false);
  const [pipelineBeat, setPipelineBeat] = useState<PipelineBeat>('build');
  const [progress, setProgress] = useState(0);
  const selected = useMemo(
    () => PULL_REQUESTS.find((pullRequest) => pullRequest.id === selectedId) ?? PULL_REQUESTS[0],
    [selectedId]
  );
  const [state, setState] = useState(() => createPreviewEnvironmentState(PULL_REQUESTS[0].config));

  const freshState = (pullRequest: PullRequestScenario) =>
    createPreviewEnvironmentState({
      ...pullRequest.config,
      injectedFailure: practiceFailure ? pullRequest.failure : 'none',
    });

  const openPullRequest = (pullRequest: PullRequestScenario) => {
    setSelectedId(pullRequest.id);
    setState(freshState(pullRequest));
    setDeveloperView('pull');
    setLabelPickerOpen(false);
  };

  const addPreviewLabel = () => {
    setState(advancePreviewEnvironment(freshState(selected)));
    setLabelPickerOpen(false);
    setPipelineBeat('build');
    setProgress(0);
    setScene('gitops');
  };

  useEffect(() => {
    if (state.status === 'blocked' || state.status === 'ready' || state.status === 'reviewed') {
      return;
    }

    let duration = 0;
    let complete: (() => void) | null = null;

    if (scene === 'gitops') {
      duration = PIPELINE_STEPS.find((step) => step.id === pipelineBeat)?.duration ?? 0;
      complete = () => {
        if (pipelineBeat === 'build') return setPipelineBeat('push');
        if (pipelineBeat === 'detect') return setPipelineBeat('render');
        const next = advancePreviewEnvironment(state);
        setState(next);
        if (next.status === 'blocked') return;
        if (pipelineBeat === 'push') setPipelineBeat('detect');
        if (pipelineBeat === 'render') setScene('environment');
      };
    } else if (scene === 'environment' && state.status === 'running') {
      duration = activeStage(state) === 'verify' ? 2200 : 2800;
      complete = () => setState(advancePreviewEnvironment(state));
    } else if (scene === 'environment' && state.status === 'cleaning') {
      duration = 2600;
      complete = () => {
        let cleaned = state;
        for (let index = 0; index < 6; index += 1) cleaned = advancePreviewEnvironment(cleaned);
        setState(cleaned);
      };
    }

    if (!duration || !complete) return;
    const startedAt = Date.now();
    const interval = window.setInterval(
      () => setProgress(Math.min(100, ((Date.now() - startedAt) / duration) * 100)),
      80
    );
    const timeout = window.setTimeout(complete, duration);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [pipelineBeat, scene, state]);

  const remediate = (id: string) => {
    if (!state.activeFailure) return;
    const failure = PREVIEW_FAILURES[state.activeFailure];
    const remediated = applyPreviewRemediation(state, id);
    if (remediated.status === 'blocked') return setState(remediated);
    const advanced = advancePreviewEnvironment(remediated);
    setState(advanced);
    if (failure.stage === 'coordinate') setPipelineBeat('detect');
    if (failure.stage === 'reconcile') setScene('environment');
  };

  const startAgain = () => {
    setState(freshState(selected));
    setScene('developer');
    setDeveloperView('pull');
    setLabelPickerOpen(false);
    setPipelineBeat('build');
    setProgress(0);
  };

  const currentSceneIndex = SCENES.findIndex((item) => item.id === scene);

  return (
    <section className="mx-auto w-full max-w-6xl" aria-label="Preview environment simulator">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                <GitBranch className="size-4" aria-hidden="true" />
                Pull request → live preview
              </div>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                Watch intent become an isolated environment
              </h2>
            </div>
            <label className="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-border bg-background/50 px-3 py-2">
              <span>
                <strong className="block text-xs">Practice a failure</strong>
                <span className="block text-[10px] text-muted-foreground">
                  Adds one realistic repair
                </span>
              </span>
              <Switch
                checked={practiceFailure}
                onCheckedChange={setPracticeFailure}
                disabled={scene !== 'developer'}
                aria-label="Practice a failure"
              />
            </label>
          </div>
          <ol className="grid grid-cols-3 gap-2" aria-label="Simulator scenes">
            {SCENES.map((item, index) => {
              const active = item.id === scene;
              const complete = index < currentSceneIndex || state.status === 'removed';
              return (
                <li
                  key={item.id}
                  className={cn(
                    'relative overflow-hidden rounded-lg border px-2 py-2.5 sm:px-3',
                    active && 'border-blue-500 bg-blue-500/5',
                    complete && !active && 'border-emerald-500/30 bg-emerald-500/5',
                    !active && !complete && 'border-border bg-background/30'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[10px]',
                        active && 'border-blue-500 text-blue-400',
                        complete && !active && 'border-emerald-500 bg-emerald-500 text-white',
                        !active && !complete && 'border-border text-muted-foreground'
                      )}
                    >
                      {complete && !active ? <Check className="size-3.5" /> : item.number}
                    </span>
                    <span className="truncate text-[10px] font-semibold sm:text-xs">
                      {item.label}
                    </span>
                  </div>
                  {active && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500" />}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="p-3 sm:p-5">
          {scene === 'developer' &&
            (developerView === 'list' ? (
              <PullRequestList onOpen={openPullRequest} />
            ) : (
              <PullRequestDetail
                pullRequest={selected}
                labelPickerOpen={labelPickerOpen}
                onBack={() => {
                  setDeveloperView('list');
                  setLabelPickerOpen(false);
                }}
                onToggleLabels={() => setLabelPickerOpen((open) => !open)}
                onAddPreview={addPreviewLabel}
              />
            ))}
          {scene === 'gitops' && (
            <GitOpsScene
              pullRequest={selected}
              beat={pipelineBeat}
              progress={progress}
              state={state}
              onRemediate={remediate}
            />
          )}
          {scene === 'environment' && (
            <EnvironmentScene
              pullRequest={selected}
              state={state}
              progress={progress}
              onRemediate={remediate}
              onReview={(decision) => setState(recordPreviewReview(state, decision))}
              onClose={() => setState(beginPreviewTeardown(state, 'pr-closed'))}
              onAgain={startAgain}
            />
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-6">
          <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />
          Only the developer asks for the preview and reviews it. Everything between those moments
          is automated.
        </div>
      </div>
    </section>
  );
}

export default PreviewEnvironmentSimulator;
