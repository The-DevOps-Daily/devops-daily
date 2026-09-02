'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  Bot,
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
  Network,
  Package,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Webhook,
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

type Scene = 'developer' | 'webhook' | 'ci' | 'gitops' | 'environment';
type PipelineBeat = 'deliver' | 'match' | 'refresh' | 'build' | 'push';
type AutomationPhase = 'idle' | 'running' | 'complete';
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
    id: 'deliver',
    title: 'Deliver labeled webhook',
    detail: 'GitHub sends the pull_request labeled event',
    duration: 3200,
    command: 'POST /api/webhook/github · action=labeled',
  },
  {
    id: 'match',
    title: 'Match the preview label',
    detail: 'The receiver verifies the signature and filters the event',
    duration: 3200,
    command: 'label=preview · repository=acme/store',
  },
  {
    id: 'refresh',
    title: 'Refresh the ApplicationSet',
    detail: 'The webhook accelerates the pull-request generator refresh',
    duration: 3200,
    command: 'refresh applicationset/preview-environments',
  },
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
];

const WEBHOOK_STEPS = PIPELINE_STEPS.slice(0, 3);
const CI_STEPS = PIPELINE_STEPS.slice(3);

const SCENES: Array<{ id: Scene; number: string; label: string }> = [
  { id: 'developer', number: '01', label: 'Developer intent' },
  { id: 'webhook', number: '02', label: 'Webhook event' },
  { id: 'ci', number: '03', label: 'GitHub Actions' },
  { id: 'gitops', number: '04', label: 'Argo CD console' },
  { id: 'environment', number: '05', label: 'PR preview URL' },
];

const ACTIVE_CONTROL =
  'cursor-pointer transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]';

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

function UnavailableControl({
  children,
  className,
  tooltip = 'Unavailable in this simulator',
}: {
  children: ReactNode;
  className?: string;
  tooltip?: string;
}) {
  return (
    <span
      className={cn('group relative inline-flex cursor-not-allowed', className)}
      aria-disabled="true"
      title={tooltip}
    >
      <span className="transition-opacity group-hover:opacity-45">{children}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-max max-w-48 -translate-x-1/2 rounded-md border border-[#30363d] bg-[#161b22] px-2 py-1 text-center text-[10px] font-medium text-[#c9d1d9] opacity-0 shadow-xl transition-opacity group-hover:opacity-100"
      >
        {tooltip}
      </span>
    </span>
  );
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
          const content = (
            <>
              <Icon className="size-4" aria-hidden="true" />
              {tab.label}
            </>
          );
          if (!selected) {
            return (
              <UnavailableControl
                key={tab.id}
                className="shrink-0 border-b-2 border-transparent px-3 py-2 text-xs font-medium text-[#8b949e]"
              >
                <span className="flex items-center gap-2">{content}</span>
              </UnavailableControl>
            );
          }
          return (
            <div
              key={tab.id}
              aria-current="page"
              className="flex shrink-0 items-center gap-2 border-b-2 border-[#f78166] px-3 py-2 text-xs font-medium text-[#e6edf3]"
            >
              {content}
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
          <UnavailableControl className="flex-1">
            <span className="flex min-h-9 w-full items-center rounded-md border border-[#30363d] bg-[#010409] px-3 text-xs text-[#8b949e]">
              <Search className="mr-2 size-4" aria-hidden="true" />
              is:pr is:open
            </span>
          </UnavailableControl>
          <div className="flex gap-2">
            <UnavailableControl>
              <span className="rounded-md border border-[#30363d] bg-[#21262d] px-3 py-2 text-xs font-semibold">
                Labels
              </span>
            </UnavailableControl>
            <UnavailableControl>
              <span className="rounded-md bg-[#238636] px-3 py-2 text-xs font-semibold opacity-70">
                New pull request
              </span>
            </UnavailableControl>
          </div>
        </div>
        <div className="overflow-hidden rounded-md border border-[#30363d]">
          <div className="flex items-center gap-5 border-b border-[#30363d] bg-[#161b22] px-4 py-3 text-xs">
            <span className="flex items-center gap-2 font-semibold">
              <GitPullRequest className="size-4 text-[#3fb950]" aria-hidden="true" />3 Open
            </span>
            <UnavailableControl className="text-[#8b949e]">
              <span>18 Closed</span>
            </UnavailableControl>
            <span className="ml-auto hidden text-[#8b949e] sm:inline">Sort</span>
          </div>
          {PULL_REQUESTS.map((pullRequest) => (
            <button
              key={pullRequest.id}
              type="button"
              onClick={() => onOpen(pullRequest)}
              className={cn(
                ACTIVE_CONTROL,
                'group flex w-full gap-3 border-b border-[#21262d] px-4 py-4 text-left last:border-b-0 hover:bg-[#161b22] hover:shadow-[inset_3px_0_0_#2f81f7]'
              )}
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
          className={cn(
            ACTIVE_CONTROL,
            'mb-4 flex items-center gap-2 rounded px-1 py-0.5 text-xs font-medium text-[#2f81f7] hover:bg-[#1f6feb1f] hover:underline'
          )}
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
          ].map((tab, index) =>
            index === 0 ? (
              <span
                key={tab}
                aria-current="page"
                className="shrink-0 border-b-2 border-[#f78166] px-3 py-2 text-xs font-medium text-[#e6edf3]"
              >
                {tab}
              </span>
            ) : (
              <UnavailableControl
                key={tab}
                className="shrink-0 border-b-2 border-transparent px-3 py-2 text-xs font-medium text-[#8b949e]"
              >
                <span>{tab}</span>
              </UnavailableControl>
            )
          )}
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
                  className={cn(
                    ACTIVE_CONTROL,
                    'rounded p-1 text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]'
                  )}
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
                className={cn(
                  ACTIVE_CONTROL,
                  'mt-3 w-full rounded-md border border-[#30363d] bg-[#21262d] px-3 py-2 text-left font-semibold hover:border-[#58a6ff] hover:bg-[#30363d]'
                )}
              >
                Add label
              </button>
              {labelPickerOpen && (
                <div className="absolute right-0 top-10 z-20 w-64 overflow-hidden rounded-md border border-[#30363d] bg-[#161b22] shadow-2xl shadow-black/60">
                  <div className="border-b border-[#30363d] px-3 py-2">
                    <strong>Apply labels</strong>
                    <div
                      aria-disabled="true"
                      title="Unavailable in this simulator"
                      className="mt-2 flex cursor-not-allowed items-center rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-[#8b949e] hover:opacity-50"
                    >
                      <Search className="mr-2 size-3.5" aria-hidden="true" />
                      Filter labels
                    </div>
                  </div>
                  {[
                    ['preview', 'Create an isolated review environment'],
                    ['enhancement', 'New feature or request'],
                    ['frontend', 'Storefront change'],
                  ].map(([label, description]) => {
                    const available = label === 'preview';
                    return (
                      <button
                        key={label}
                        type="button"
                        disabled={!available}
                        onClick={available ? onAddPreview : undefined}
                        className={cn(
                          'group relative flex w-full gap-2 border-b border-[#21262d] px-3 py-2.5 text-left last:border-b-0',
                          available
                            ? cn(
                                ACTIVE_CONTROL,
                                'hover:bg-[#21262d] hover:shadow-[inset_3px_0_0_#3fb950]'
                              )
                            : 'cursor-not-allowed hover:bg-[#21262d]'
                        )}
                      >
                        <span
                          className={cn(
                            'mt-1 size-3 shrink-0 rounded-full border',
                            labelClasses(label)
                          )}
                        />
                        <span
                          className={cn(!available && 'transition-opacity group-hover:opacity-20')}
                        >
                          <strong className="block">{label}</strong>
                          <span className="text-[10px] leading-4 text-[#8b949e]">
                            {description}
                          </span>
                        </span>
                        {!available && (
                          <span className="pointer-events-none absolute inset-0 grid place-items-center bg-[#161b22e6] text-[10px] font-semibold text-[#c9d1d9] opacity-0 transition-opacity group-hover:opacity-100">
                            Unavailable in this simulator
                          </span>
                        )}
                      </button>
                    );
                  })}
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
            className={cn(
              ACTIVE_CONTROL,
              'shrink-0 rounded-md bg-[#238636] px-3 py-2 text-xs font-semibold shadow-sm hover:bg-[#2ea043] hover:shadow-[0_0_0_3px_#23863633]'
            )}
          >
            Add label
          </button>
        </div>
      </div>
    </GitHubChrome>
  );
}

function CircularProgress({
  progress,
  tone = 'blue',
}: {
  progress: number;
  tone?: 'blue' | 'purple';
}) {
  const circumference = 2 * Math.PI * 10;
  return (
    <svg className="size-6 -rotate-90" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="#30363d" strokeWidth="2" />
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke={tone === 'purple' ? '#8957e5' : '#2f81f7'}
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
            className={cn(
              ACTIVE_CONTROL,
              'rounded-md border border-[#30363d] bg-[#161b22] p-3 text-left text-xs hover:border-[#58a6ff] hover:bg-[#1f6feb14]'
            )}
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
  tone,
}: {
  status: 'waiting' | 'running' | 'successful' | 'failed';
  progress: number;
  tone: 'blue' | 'purple';
}) {
  if (status === 'running') return <CircularProgress progress={progress} tone={tone} />;
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

function AutomationSteps({
  steps,
  beat,
  phase,
  progress,
  failed,
  tone,
  after,
}: {
  steps: typeof PIPELINE_STEPS;
  beat: PipelineBeat;
  phase: AutomationPhase;
  progress: number;
  failed: boolean;
  tone: 'blue' | 'purple';
  after?: ReactNode;
}) {
  const activeIndex = steps.findIndex((step) => step.id === beat);
  return (
    <div className="overflow-hidden rounded-md border border-[#30363d]">
      {steps.map((step, stepIndex) => {
        const status =
          phase === 'complete'
            ? 'successful'
            : phase === 'idle'
              ? 'waiting'
              : stepIndex < activeIndex
                ? 'successful'
                : stepIndex > activeIndex
                  ? 'waiting'
                  : failed
                    ? 'failed'
                    : 'running';
        return (
          <div
            key={step.id}
            className={cn(
              'flex gap-3 border-b border-[#21262d] px-3 py-3 last:border-b-0',
              phase === 'running' &&
                stepIndex === activeIndex &&
                (tone === 'purple' ? 'bg-[#6e40c914]' : 'bg-[#1f6feb14]')
            )}
          >
            <PipelineIcon
              status={status}
              progress={stepIndex === activeIndex ? progress : 100}
              tone={tone}
            />
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
      {after}
    </div>
  );
}

function WebhookScene({
  pullRequest,
  beat,
  phase,
  progress,
  state,
  onRun,
  onContinue,
  onRemediate,
}: {
  pullRequest: PullRequestScenario;
  beat: PipelineBeat;
  phase: AutomationPhase;
  progress: number;
  state: PreviewEnvironmentState;
  onRun: () => void;
  onContinue: () => void;
  onRemediate: (id: string) => void;
}) {
  const index = WEBHOOK_STEPS.findIndex((step) => step.id === beat);
  const current = WEBHOOK_STEPS[Math.max(index, 0)];
  const failed = state.status === 'blocked';
  const nodeState = (nodeIndex: number) =>
    phase === 'complete' || nodeIndex < index
      ? 'complete'
      : phase === 'running' && nodeIndex === index
        ? failed
          ? 'failed'
          : 'active'
        : 'waiting';

  return (
    <div className="overflow-hidden rounded-lg border border-[#30363d] bg-[#0d1117] text-[#e6edf3] shadow-2xl shadow-black/20">
      <div className="flex items-center gap-3 border-b border-[#30363d] bg-[#161b22] px-3 py-2">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-red-500/80" />
          <span className="size-2.5 rounded-full bg-amber-500/80" />
          <span className="size-2.5 rounded-full bg-emerald-500/80" />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center rounded border border-[#30363d] bg-[#010409] px-3 py-1 font-mono text-[10px] text-[#8b949e]">
          <LockKeyhole className="mr-2 size-3" aria-hidden="true" />
          preview-control-plane.internal/webhooks/github
        </div>
      </div>

      <div className="border-b border-[#30363d] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#58a6ff]">
              GitHub → preview control plane
            </div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              {failed ? (
                <XCircle className="size-5 text-[#f85149]" aria-hidden="true" />
              ) : phase === 'complete' ? (
                <CheckCircle2 className="size-5 text-[#3fb950]" aria-hidden="true" />
              ) : phase === 'running' ? (
                <LoaderCircle className="size-5 animate-spin text-[#58a6ff]" aria-hidden="true" />
              ) : (
                <Webhook className="size-5 text-[#58a6ff]" aria-hidden="true" />
              )}
              Deliver the label event
            </h3>
            <p className="mt-1 text-xs text-[#8b949e]">
              A webhook speeds up discovery; the ApplicationSet controller still owns desired state.
            </p>
          </div>
          <span className="rounded-full border border-[#1f6feb] px-2.5 py-1 text-[10px] font-semibold text-[#58a6ff]">
            pull_request · labeled
          </span>
        </div>
      </div>

      <div className="p-3 sm:p-5">
        <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {[
            {
              icon: Github,
              eyebrow: 'Source',
              title: `PR #${pullRequest.number}`,
              detail: 'preview label added',
            },
            {
              icon: Webhook,
              eyebrow: 'Delivery',
              title: 'Webhook receiver',
              detail: 'signature verified',
            },
            {
              icon: RefreshCw,
              eyebrow: 'Control plane',
              title: 'ApplicationSet refresh',
              detail: 'matching PR discovered',
            },
          ].map((node, nodeIndex) => {
            const status = nodeState(nodeIndex);
            const Icon = node.icon;
            return (
              <div key={node.title} className="contents">
                {nodeIndex > 0 && (
                  <div className="grid place-items-center text-[#6e7681]" aria-hidden="true">
                    <span className="hidden sm:inline">→</span>
                    <ArrowDown className="size-4 sm:hidden" />
                  </div>
                )}
                <div
                  className={cn(
                    'rounded-lg border p-4 transition-all duration-300',
                    status === 'waiting' && 'border-[#30363d] bg-[#010409] opacity-55',
                    status === 'active' &&
                      'border-[#1f6feb] bg-[#1f6feb14] shadow-lg shadow-blue-950/30',
                    status === 'complete' && 'border-[#238636] bg-[#23863612]',
                    status === 'failed' && 'border-[#f85149] bg-[#f8514912]'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid size-9 place-items-center rounded-md border border-[#30363d] bg-[#0d1117]">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    {status === 'complete' && (
                      <CheckCircle2 className="size-4 text-[#3fb950]" aria-hidden="true" />
                    )}
                    {status === 'active' && <CircularProgress progress={progress} />}
                  </div>
                  <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b949e]">
                    {node.eyebrow}
                  </div>
                  <strong className="mt-1 block text-sm">{node.title}</strong>
                  <span className="mt-1 block text-xs text-[#8b949e]">{node.detail}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(280px,1.1fr)]">
          <AutomationSteps
            steps={WEBHOOK_STEPS}
            beat={beat}
            phase={phase}
            progress={progress}
            failed={failed}
            tone="blue"
          />
          <div className="overflow-hidden rounded-md border border-[#30363d] bg-[#010409]">
            <div className="flex items-center justify-between border-b border-[#30363d] bg-[#161b22] px-3 py-2 text-xs">
              <strong className="flex items-center gap-2">
                <Webhook className="size-4 text-[#58a6ff]" aria-hidden="true" />
                Delivery payload
              </strong>
              <span className="font-mono text-[10px] text-[#8b949e]">X-Hub-Signature-256 ✓</span>
            </div>
            <div className="min-h-44 space-y-1 overflow-x-auto p-4 font-mono text-[11px] leading-5">
              <div className="text-[#8b949e]">event: pull_request</div>
              <div>action: labeled</div>
              <div>number: {pullRequest.number}</div>
              <div>label: preview</div>
              <div>head.sha: {pullRequest.commit}</div>
              {phase === 'running' && (
                <div className="mt-3 animate-pulse text-[#58a6ff]">
                  receiver › {current.command}
                </div>
              )}
              {phase === 'complete' && (
                <div className="mt-3 text-[#3fb950]">202 Accepted · refresh queued</div>
              )}
              {failed && <div className="mt-3 text-[#ff7b72]">Error: {state.lastEvent}</div>}
            </div>
          </div>
        </div>

        {failed ? (
          <div className="mt-4">
            <FailurePanel state={state} onRemediate={onRemediate} />
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3 rounded-md border border-[#30363d] bg-[#161b22] p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-[#8b949e]">
              <Webhook className="size-4 shrink-0 text-[#58a6ff]" aria-hidden="true" />
              {phase === 'idle'
                ? 'The label event is ready to leave GitHub.'
                : phase === 'running'
                  ? 'Follow the event from GitHub to the ApplicationSet controller.'
                  : 'The matching PR is now known to the preview control plane.'}
            </div>
            {phase === 'idle' && (
              <Button size="sm" className="cursor-pointer" onClick={onRun}>
                <Play className="size-4" aria-hidden="true" />
                Deliver webhook
              </Button>
            )}
            {phase === 'complete' && (
              <Button size="sm" className="cursor-pointer" onClick={onContinue}>
                Open GitHub Actions
                <Workflow className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GitHubActionsScene({
  pullRequest,
  beat,
  phase,
  progress,
  state,
  onRun,
  onContinue,
  onRemediate,
}: {
  pullRequest: PullRequestScenario;
  beat: PipelineBeat;
  phase: AutomationPhase;
  progress: number;
  state: PreviewEnvironmentState;
  onRun: () => void;
  onContinue: () => void;
  onRemediate: (id: string) => void;
}) {
  const index = CI_STEPS.findIndex((step) => step.id === beat);
  const current = CI_STEPS[Math.max(index, 0)];
  const failed = state.status === 'blocked';
  return (
    <GitHubChrome activeTab="actions">
      <div className="grid min-h-[500px] md:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="border-b border-[#21262d] p-4 md:border-b-0 md:border-r">
          <strong className="mb-3 flex items-center gap-2 text-xs">
            <Workflow className="size-4" aria-hidden="true" />
            Actions
          </strong>
          <div className="rounded-md border border-[#1f6feb] bg-[#1f6feb1f] px-3 py-2 text-xs font-semibold text-[#e6edf3]">
            Preview image
          </div>
          <div className="mt-3 space-y-1 text-[10px] text-[#8b949e]">
            <UnavailableControl
              className="w-full rounded px-3 py-2"
              tooltip="Unavailable in this simulator"
            >
              <span className="block w-full">Code quality</span>
            </UnavailableControl>
            <UnavailableControl
              className="w-full rounded px-3 py-2"
              tooltip="Unavailable in this simulator"
            >
              <span className="block w-full">Deploy production</span>
            </UnavailableControl>
          </div>
        </aside>

        <div className="min-w-0 p-3 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#21262d] pb-4">
            <div>
              <div className="mb-1 text-[10px] text-[#8b949e]">
                Preview image / run #{pullRequest.number}
              </div>
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                {failed ? (
                  <XCircle className="size-5 text-[#f85149]" aria-hidden="true" />
                ) : phase === 'complete' ? (
                  <CheckCircle2 className="size-5 text-[#3fb950]" aria-hidden="true" />
                ) : phase === 'running' ? (
                  <LoaderCircle className="size-5 animate-spin text-[#58a6ff]" aria-hidden="true" />
                ) : (
                  <CircleDot className="size-5 text-[#8b949e]" aria-hidden="true" />
                )}
                Build and publish the preview
              </h3>
              <p className="mt-1 text-xs text-[#8b949e]">
                GitHub-hosted runner · {pullRequest.branch} · {pullRequest.commit}
              </p>
            </div>
            <span className="rounded-full border border-[#1f6feb] px-2.5 py-1 text-[10px] font-semibold text-[#58a6ff]">
              GitHub Actions · CI
            </span>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(240px,0.8fr)_minmax(300px,1.2fr)]">
            <AutomationSteps
              steps={CI_STEPS}
              beat={beat}
              phase={phase}
              progress={progress}
              failed={failed}
              tone="blue"
              after={
                <div className="flex gap-3 border-t border-[#21262d] px-3 py-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-[#30363d]">
                    <MessageSquare className="size-3 text-[#8b949e]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong className="text-xs">Comment preview URL on PR</strong>
                      <span className="text-[10px] uppercase tracking-wide text-[#8b949e]">
                        Waiting for Argo CD
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-4 text-[#8b949e]">
                      The final job waits for a healthy URL, then calls the GitHub API.
                    </p>
                  </div>
                </div>
              }
            />
            <div className="overflow-hidden rounded-md border border-[#30363d] bg-[#010409]">
              <div className="flex justify-between border-b border-[#30363d] bg-[#161b22] px-3 py-2 text-xs">
                <strong className="flex items-center gap-2 text-[#58a6ff]">
                  <Github className="size-4" aria-hidden="true" />
                  GitHub Actions runner
                </strong>
                <span className="text-[#8b949e]">
                  {phase === 'idle' ? 'Queued' : 'ubuntu-latest'}
                </span>
              </div>
              <div className="min-h-52 space-y-2 overflow-x-auto p-4 font-mono text-[11px] leading-5">
                {phase === 'idle' ? (
                  <div className="flex h-40 flex-col items-center justify-center text-center text-[#8b949e]">
                    <Clock3 className="mb-2 size-6" aria-hidden="true" />
                    <strong className="text-[#c9d1d9]">Workflow queued by the labeled event</strong>
                    <span>Start the walkthrough when you are ready.</span>
                  </div>
                ) : (
                  <>
                    <div className="text-[#8b949e]">Runner image: ubuntu-latest</div>
                    <div>
                      <span className="text-[#3fb950]">✓</span> Checkout {pullRequest.branch} at{' '}
                      {pullRequest.commit}
                    </div>
                    {(index > 0 || phase === 'complete') && (
                      <div>
                        <span className="text-[#3fb950]">✓</span> Image built successfully
                      </div>
                    )}
                    {phase === 'complete' && (
                      <div>
                        <span className="text-[#3fb950]">✓</span> Published
                        registry.example.dev/store:
                        {pullRequest.commit}
                      </div>
                    )}
                    {phase === 'running' && (
                      <div className="animate-pulse text-[#58a6ff]">
                        <span>$ </span>
                        {current.command.replace('SHA', pullRequest.commit)}
                      </div>
                    )}
                    {failed && <div className="text-[#ff7b72]">Error: {state.lastEvent}</div>}
                  </>
                )}
              </div>
              <div className="h-1 bg-[#21262d]">
                <div
                  className="h-full bg-[#2f81f7] transition-[width] duration-100"
                  style={{ width: phase === 'complete' ? '100%' : String(progress) + '%' }}
                />
              </div>
            </div>
          </div>

          {failed ? (
            <div className="mt-4">
              <FailurePanel state={state} onRemediate={onRemediate} />
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3 rounded-md border border-[#30363d] bg-[#161b22] p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-[#8b949e]">
                {phase === 'complete' ? (
                  <Package className="size-4 shrink-0 text-[#3fb950]" aria-hidden="true" />
                ) : (
                  <Play className="size-4 shrink-0 text-[#58a6ff]" aria-hidden="true" />
                )}
                {phase === 'idle'
                  ? 'The same labeled event also queued this GitHub Actions workflow.'
                  : phase === 'running'
                    ? 'The workflow now advances automatically through its two jobs.'
                    : `Artifact ready: store:${pullRequest.commit}. The PR comment is waiting for Argo.`}
              </div>
              {phase === 'idle' && (
                <Button size="sm" className="cursor-pointer" onClick={onRun}>
                  <Play className="size-4" aria-hidden="true" />
                  Watch workflow run
                </Button>
              )}
              {phase === 'complete' && (
                <Button
                  size="sm"
                  className="cursor-pointer bg-violet-600 text-white hover:bg-violet-500"
                  onClick={onContinue}
                >
                  Open Argo CD console
                  <Workflow className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </GitHubChrome>
  );
}

function ArgoResourceNode({
  kind,
  name,
  status,
  icon: Icon,
  wide,
}: {
  kind: string;
  name: string;
  status: ResourceState;
  icon: typeof Boxes;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-md border p-3 transition-all duration-500',
        wide && 'sm:col-span-2',
        status === 'queued' && 'border-[#302744] bg-[#0e0c15] opacity-50',
        status === 'creating' && 'border-[#8957e5] bg-[#6e40c91f] shadow-lg shadow-violet-950/30',
        status === 'ready' && 'border-[#23863688] bg-[#23863612]'
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded border border-[#302744] bg-[#08090e]">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8b949e]">
                {kind}
              </span>
              <strong className="mt-0.5 block truncate text-xs">{name}</strong>
            </div>
            <ResourceStatus status={status} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ArgoControlPlaneScene({
  pullRequest,
  phase,
  progress,
  state,
  onRun,
  onContinue,
  onRemediate,
}: {
  pullRequest: PullRequestScenario;
  phase: AutomationPhase;
  progress: number;
  state: PreviewEnvironmentState;
  onRun: () => void;
  onContinue: () => void;
  onRemediate: (id: string) => void;
}) {
  const failed = state.status === 'blocked';
  const stage = activeStage(state);
  const ready = state.status === 'ready' || phase === 'complete';
  const resourceState = (doneAt: PreviewStageId): ResourceState => {
    if (ready || stageDone(state, doneAt)) return 'ready';
    if (phase === 'running' && stage === doneAt) return 'creating';
    return 'queued';
  };
  const application = resourceState('reconcile');
  const provision = resourceState('provision');
  const expose = resourceState('expose');
  const verify = resourceState('verify');
  const activeLabel =
    stage === 'reconcile'
      ? 'Generating the Argo CD Application from the ApplicationSet'
      : stage === 'provision'
        ? 'Creating the namespace, deployments, and services'
        : stage === 'expose'
          ? 'Reconciling ingress, TLS, and isolated data'
          : stage === 'verify'
            ? 'Waiting for health and revision checks'
            : 'All desired resources are healthy and synced';
  return (
    <div className="overflow-hidden rounded-lg border border-[#3b2d5e] bg-[#0b0d14] text-[#e6edf3] shadow-2xl shadow-violet-950/20">
      <div className="flex items-center gap-3 border-b border-[#302744] bg-[#12101b] px-3 py-2">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-red-500/80" />
          <span className="size-2.5 rounded-full bg-amber-500/80" />
          <span className="size-2.5 rounded-full bg-emerald-500/80" />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center rounded border border-[#302744] bg-[#08090e] px-3 py-1 font-mono text-[10px] text-[#8b949e]">
          <LockKeyhole className="mr-2 size-3" aria-hidden="true" />
          argo.acme.internal/applications/preview-pr-{pullRequest.number}
        </div>
      </div>
      <div className="flex items-center justify-between border-b border-[#302744] bg-[#171124] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-7 place-items-center rounded bg-[#6e40c9]">
            <Workflow className="size-4" aria-hidden="true" />
          </span>
          Argo CD
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a371f7]">
          Cluster control plane · outside GitHub
        </span>
      </div>

      <div className="grid min-h-[500px] md:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="border-b border-[#302744] bg-[#0e0c15] p-4 md:border-b-0 md:border-r">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6e7681]">
            Control plane state
          </div>
          <div className="mt-3 rounded-md border border-[#6e40c9] bg-[#6e40c91f] p-3 text-xs">
            <div className="flex items-center gap-2 font-semibold">
              <Layers3 className="size-4 text-[#a371f7]" aria-hidden="true" />
              {application === 'ready'
                ? `preview-pr-${pullRequest.number}`
                : 'preview-environments'}
            </div>
            <div className="mt-2 font-mono text-[10px] text-[#8b949e]">
              {application === 'ready'
                ? `Application · revision ${pullRequest.commit}`
                : 'ApplicationSet · watching acme/store'}
            </div>
          </div>
          <div className="my-3 flex items-center justify-center text-[#6e7681]">↑</div>
          <div className="rounded-md border border-[#3fb95055] bg-[#23863612] p-3 text-center text-[10px] text-[#7ee787]">
            <Package className="mx-auto mb-1 size-4" aria-hidden="true" />
            <strong className="block">Registry artifact</strong>
            store:{pullRequest.commit}
          </div>
          <a
            href="https://atomsized.com/preview-environments"
            target="_blank"
            rel="noreferrer"
            className={cn(
              ACTIVE_CONTROL,
              'mt-6 flex gap-2 rounded-md border border-[#302744] p-3 text-[10px] leading-4 text-[#8b949e] hover:border-[#8957e5] hover:text-[#c6a7ff]'
            )}
          >
            <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Pattern inspired by Atomsized
              <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />
            </span>
          </a>
        </aside>

        <div className="min-w-0 p-3 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#302744] pb-4">
            <div>
              <div className="mb-1 text-[10px] text-[#8b949e]">
                ApplicationSet / preview-environments
              </div>
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                {failed ? (
                  <XCircle className="size-5 text-[#f85149]" aria-hidden="true" />
                ) : phase === 'complete' ? (
                  <CheckCircle2 className="size-5 text-[#3fb950]" aria-hidden="true" />
                ) : phase === 'running' ? (
                  <LoaderCircle className="size-5 animate-spin text-[#a371f7]" aria-hidden="true" />
                ) : (
                  <CircleDot className="size-5 text-[#8b949e]" aria-hidden="true" />
                )}
                Reconcile desired state
              </h3>
              <p className="mt-1 text-xs text-[#8b949e]">
                Argo CD independently observes Git and continuously reconciles the cluster.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[#6e40c9] px-2.5 py-1 text-[10px] font-semibold text-[#c6a7ff]">
                Sync · {ready ? 'Synced' : phase === 'running' ? 'Syncing' : 'OutOfSync'}
              </span>
              <span
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[10px] font-semibold',
                  ready ? 'border-[#238636] text-[#7ee787]' : 'border-[#d29922] text-[#e3b341]'
                )}
              >
                Health · {ready ? 'Healthy' : 'Progressing'}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
            <div>
              <ArgoResourceNode
                kind="Application"
                name={`preview-pr-${pullRequest.number}`}
                status={application}
                icon={Layers3}
                wide
              />
              <div className="grid h-8 place-items-center text-[#6e7681]" aria-hidden="true">
                <ArrowDown className="size-4" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <ArgoResourceNode
                  kind="Namespace"
                  name={`preview-pr-${pullRequest.number}`}
                  status={provision}
                  icon={Boxes}
                />
                {state.config.services.map((service) => (
                  <ArgoResourceNode
                    key={service}
                    kind="Deployment"
                    name={service}
                    status={provision}
                    icon={ServerCog}
                  />
                ))}
                <ArgoResourceNode
                  kind="Service"
                  name="preview-entrypoint"
                  status={provision}
                  icon={Network}
                />
                <ArgoResourceNode
                  kind="Ingress + certificate"
                  name={`${pullRequest.id}-${pullRequest.number}.preview.example.dev`}
                  status={expose}
                  icon={Globe2}
                  wide
                />
                <ArgoResourceNode
                  kind="Managed dependency"
                  name={`Neon branch pr-${pullRequest.number}`}
                  status={expose}
                  icon={Database}
                />
                <ArgoResourceNode
                  kind="PostSync health gates"
                  name="revision + readiness"
                  status={verify}
                  icon={ShieldCheck}
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-[#302744] bg-[#08090e]">
              <div className="flex justify-between border-b border-[#302744] bg-[#12101b] px-3 py-2 text-xs">
                <strong className="flex items-center gap-2 text-[#a371f7]">
                  <ServerCog className="size-4" aria-hidden="true" />
                  Live controller events
                </strong>
                <span className="text-[#8b949e]">argocd namespace</span>
              </div>
              <div className="min-h-72 space-y-2 overflow-x-auto p-4 font-mono text-[11px] leading-5">
                {phase === 'idle' ? (
                  <div className="flex h-56 flex-col items-center justify-center text-center text-[#8b949e]">
                    <Clock3 className="mb-2 size-6" aria-hidden="true" />
                    <strong className="text-[#c9d1d9]">Auto-sync is queued</strong>
                    <span>The webhook refresh and image artifact are ready.</span>
                  </div>
                ) : (
                  <>
                    <div className="text-[#8b949e]">controller: argocd-application-controller</div>
                    <div>application: preview-pr-{pullRequest.number}</div>
                    <div>targetRevision: {pullRequest.commit}</div>
                    {application === 'ready' && (
                      <div>
                        <span className="text-[#3fb950]">✓</span> Application rendered from Helm
                      </div>
                    )}
                    {provision === 'ready' && (
                      <div>
                        <span className="text-[#3fb950]">✓</span> namespace and workloads Synced
                      </div>
                    )}
                    {expose === 'ready' && (
                      <div>
                        <span className="text-[#3fb950]">✓</span> ingress, TLS, and data branch
                        Ready
                      </div>
                    )}
                    {verify === 'ready' && (
                      <div>
                        <span className="text-[#3fb950]">✓</span> application Healthy
                      </div>
                    )}
                    {phase === 'running' && !failed && (
                      <div className="animate-pulse text-[#a371f7]">controller › {activeLabel}</div>
                    )}
                    {failed && <div className="text-[#ff7b72]">Error: {state.lastEvent}</div>}
                  </>
                )}
              </div>
              <div className="h-1 bg-[#211b2f]">
                <div
                  className="h-full bg-[#8957e5] transition-[width] duration-100"
                  style={{ width: phase === 'complete' ? '100%' : String(progress) + '%' }}
                />
              </div>
            </div>
          </div>

          {failed ? (
            <div className="mt-4">
              <FailurePanel state={state} onRemediate={onRemediate} />
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3 rounded-md border border-[#302744] bg-[#12101b] p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-[#8b949e]">
                {phase === 'complete' ? (
                  <Layers3 className="size-4 shrink-0 text-[#3fb950]" aria-hidden="true" />
                ) : (
                  <Play className="size-4 shrink-0 text-[#a371f7]" aria-hidden="true" />
                )}
                {phase === 'idle'
                  ? 'This is the real control-plane view: GitHub Actions is no longer on screen.'
                  : phase === 'running'
                    ? 'Argo CD is applying and health-checking the resource tree.'
                    : 'The application is Synced and Healthy. The workflow can now post the URL.'}
              </div>
              {phase === 'idle' && (
                <Button
                  size="sm"
                  className="cursor-pointer bg-violet-600 text-white hover:bg-violet-500"
                  onClick={onRun}
                >
                  <Play className="size-4" aria-hidden="true" />
                  Watch Argo auto-sync
                </Button>
              )}
              {phase === 'complete' && (
                <Button
                  size="sm"
                  className="cursor-pointer bg-violet-600 text-white hover:bg-violet-500"
                  onClick={onContinue}
                >
                  Return to pull request
                  <MessageSquare className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
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
    <GitHubChrome activeTab="pulls">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#30363d] bg-[#161b22] px-3 py-3 sm:px-5">
        <span className="grid size-9 place-items-center rounded-full bg-[#2386361f] text-[#3fb950]">
          <GitPullRequest className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-semibold">
            {pullRequest.title}{' '}
            <span className="font-normal text-[#8b949e]">#{pullRequest.number}</span>
          </h3>
          <p className="text-xs text-[#8b949e]">
            {pullRequest.author} wants to merge {pullRequest.branch} into main
          </p>
        </div>
        <span
          className={cn(
            'ml-auto rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
            cleaning || removed
              ? 'border-[#8957e5] text-[#a371f7]'
              : 'border-[#238636] text-[#3fb950]'
          )}
        >
          {cleaning || removed ? 'Closed' : 'Open'}
        </span>
      </div>
      <div className="bg-[#0d1117] p-3 text-[#e6edf3] sm:p-5">
        <div className="mb-4 grid grid-cols-[32px_minmax(0,1fr)] gap-3">
          <span className="grid size-8 place-items-center rounded-full bg-[#6e40c9] text-white">
            <Bot className="size-4" aria-hidden="true" />
          </span>
          <div className="overflow-hidden rounded-md border border-[#30363d]">
            <div className="border-b border-[#30363d] bg-[#161b22] px-3 py-2 text-xs">
              <strong>preview-environment-bot</strong>{' '}
              <span className="text-[#8b949e]">
                {removed ? 'updated this comment after cleanup' : 'commented just now'}
              </span>
            </div>
            <div className="space-y-3 p-4">
              {removed ? (
                <>
                  <strong className="block text-sm">Preview environment removed</strong>
                  <p className="text-xs text-[#8b949e]">
                    PR #{pullRequest.number} was closed. Argo CD pruned the Application and every
                    namespaced resource together.
                  </p>
                </>
              ) : cleaning ? (
                <div className="flex items-center gap-3">
                  <LoaderCircle className="size-5 animate-spin text-[#e3b341]" aria-hidden="true" />
                  <div>
                    <strong className="block text-sm">Removing preview environment</strong>
                    <span className="text-xs text-[#8b949e]">Argo CD prune is in progress.</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong className="block text-sm text-[#7ee787]">
                        Preview environment is ready
                      </strong>
                      <code className="mt-1 block text-xs text-[#58a6ff]">https://{reviewUrl}</code>
                    </div>
                    <span className="rounded-full border border-[#238636] px-2 py-1 text-[10px] font-semibold text-[#7ee787]">
                      Argo CD · Synced / Healthy
                    </span>
                  </div>
                  <div className="grid gap-2 text-xs text-[#8b949e] sm:grid-cols-3">
                    <span>Revision · {pullRequest.commit}</span>
                    <span>Namespace · {namespace}</span>
                    <span>Expires · {state.config.ttlHours}h</span>
                  </div>
                  <div className="flex items-center gap-2 border-t border-[#21262d] pt-3 text-[10px] text-[#8b949e]">
                    <CheckCircle2 className="size-3.5 text-[#3fb950]" aria-hidden="true" />
                    GitHub Actions · comment-preview-url · successful
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#30363d] bg-[#161b22] p-3">
          {removed || ready || reviewed ? (
            <CheckCircle2 className="size-5 shrink-0 text-[#3fb950]" aria-hidden="true" />
          ) : (
            <CircularProgress progress={progress} />
          )}
          <div className="min-w-0">
            <strong className="block text-sm">{title}</strong>
            <span className="block truncate text-xs text-[#8b949e]">
              {removed
                ? 'CI is historical, Argo CD is idle, and no preview resources remain.'
                : cleaning
                  ? 'Namespace, workloads, data branch, and URL are removed together.'
                  : 'The PR now has the URL, deployed revision, health, and expiry evidence.'}
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
                className={cn(
                  ACTIVE_CONTROL,
                  'mt-2 inline-flex items-center gap-1 rounded text-[10px] font-semibold text-blue-400 hover:underline'
                )}
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
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                onClick={() => onReview('request-changes')}
              >
                Request changes
              </Button>
              <Button
                size="sm"
                className="cursor-pointer bg-emerald-600 text-white transition-all hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-[0_0_0_3px_#10b98133] active:translate-y-0 active:scale-[0.98]"
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
            <Button
              size="sm"
              variant="destructive"
              className="cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
              onClick={onClose}
            >
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
            <Button
              size="sm"
              className="cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
              onClick={onAgain}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Add preview label again
            </Button>
          </div>
        )}
      </div>
    </GitHubChrome>
  );
}

export function PreviewEnvironmentSimulator() {
  const [selectedId, setSelectedId] = useState(PULL_REQUESTS[0].id);
  const [developerView, setDeveloperView] = useState<'list' | 'pull'>('list');
  const [scene, setScene] = useState<Scene>('developer');
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);
  const [practiceFailure, setPracticeFailure] = useState(false);
  const [pipelineBeat, setPipelineBeat] = useState<PipelineBeat>('build');
  const [automationPhase, setAutomationPhase] = useState<AutomationPhase>('idle');
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
    setPipelineBeat('deliver');
    setAutomationPhase('idle');
    setProgress(0);
    setScene('webhook');
  };

  useEffect(() => {
    if (state.status === 'blocked' || state.status === 'ready' || state.status === 'reviewed') {
      return;
    }

    let duration = 0;
    let complete: (() => void) | null = null;

    if ((scene === 'webhook' || scene === 'ci') && automationPhase === 'running') {
      duration = PIPELINE_STEPS.find((step) => step.id === pipelineBeat)?.duration ?? 0;
      complete = () => {
        if (pipelineBeat === 'deliver') {
          setProgress(0);
          return setPipelineBeat('match');
        }
        if (pipelineBeat === 'match') {
          setProgress(0);
          return setPipelineBeat('refresh');
        }
        if (pipelineBeat === 'build') {
          setProgress(0);
          return setPipelineBeat('push');
        }
        if (pipelineBeat === 'refresh') {
          const next = advancePreviewEnvironment(state);
          setState(next);
          setProgress(100);
          if (next.status === 'blocked') return;
        }
        setProgress(100);
        setAutomationPhase('complete');
      };
    } else if (scene === 'gitops' && automationPhase === 'running') {
      duration = activeStage(state) === 'verify' ? 3200 : 3600;
      complete = () => {
        const next = advancePreviewEnvironment(state);
        setState(next);
        if (next.status === 'blocked') return;
        if (next.status === 'ready') {
          setProgress(100);
          setAutomationPhase('complete');
          return;
        }
        setProgress(0);
      };
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
  }, [automationPhase, pipelineBeat, scene, state]);

  const remediate = (id: string) => {
    if (!state.activeFailure) return;
    const failure = PREVIEW_FAILURES[state.activeFailure];
    const remediated = applyPreviewRemediation(state, id);
    if (remediated.status === 'blocked') return setState(remediated);
    const advanced = advancePreviewEnvironment(remediated);
    setState(advanced);
    if (failure.stage === 'coordinate') {
      setPipelineBeat('refresh');
      setProgress(100);
      setAutomationPhase('complete');
      return;
    }
    if (advanced.status === 'ready') {
      setProgress(100);
      setAutomationPhase('complete');
    } else {
      setProgress(0);
      setAutomationPhase('running');
    }
  };

  const startAutomation = () => {
    setProgress(0);
    setAutomationPhase('running');
  };

  const openPipeline = () => {
    setPipelineBeat('build');
    setProgress(0);
    setAutomationPhase('idle');
    setScene('ci');
  };

  const openControlPlane = () => {
    setProgress(0);
    setAutomationPhase('idle');
    setScene('gitops');
  };

  const openEnvironment = () => {
    setProgress(0);
    setAutomationPhase('idle');
    setScene('environment');
  };

  const startAgain = () => {
    setState(freshState(selected));
    setScene('developer');
    setDeveloperView('pull');
    setLabelPickerOpen(false);
    setPipelineBeat('deliver');
    setAutomationPhase('idle');
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
            <label
              title={
                scene === 'developer'
                  ? 'Toggle a realistic failure scenario'
                  : 'Unavailable while the simulation is running'
              }
              className={cn(
                'flex shrink-0 items-center justify-between gap-3 rounded-lg border border-border bg-background/50 px-3 py-2 transition-all',
                scene === 'developer'
                  ? 'cursor-pointer hover:-translate-y-0.5 hover:border-blue-500/60 hover:bg-blue-500/5'
                  : 'cursor-not-allowed opacity-55'
              )}
            >
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
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Simulator scenes">
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
          {scene === 'ci' && (
            <GitHubActionsScene
              pullRequest={selected}
              beat={pipelineBeat}
              phase={automationPhase}
              progress={progress}
              state={state}
              onRun={startAutomation}
              onContinue={openControlPlane}
              onRemediate={remediate}
            />
          )}
          {scene === 'webhook' && (
            <WebhookScene
              pullRequest={selected}
              beat={pipelineBeat}
              phase={automationPhase}
              progress={progress}
              state={state}
              onRun={startAutomation}
              onContinue={openPipeline}
              onRemediate={remediate}
            />
          )}
          {scene === 'gitops' && (
            <ArgoControlPlaneScene
              pullRequest={selected}
              phase={automationPhase}
              progress={progress}
              state={state}
              onRun={startAutomation}
              onContinue={openEnvironment}
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
          The simulator pauses between systems. In production, the webhook, CI workflow, Argo CD
          auto-sync, and PR comment continue automatically.
        </div>
      </div>
    </section>
  );
}

export default PreviewEnvironmentSimulator;
