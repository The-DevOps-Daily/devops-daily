'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
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
  Plus,
  RefreshCw,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  TriangleAlert,
  Webhook,
  Workflow,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Github } from '@/components/icons/social-icons';
import { Label as FormLabel } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFrame,
  SimHowTo,
  SimResetButton,
} from '@/components/games/sim';
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
  {
    id: 'search',
    number: 181,
    title: 'feat: reindex product search every night',
    author: 'mila-dev',
    branch: 'search-reindex',
    commit: '3d90b7e',
    opened: '3 hours ago',
    comments: 2,
    commits: 3,
    changedFiles: 9,
    additions: 311,
    deletions: 58,
    summary:
      'Adds a nightly search reindex to the API. The author asked for production-sized resources to test it under realistic load.',
    labels: ['backend', 'api'],
    config: {
      mode: 'single-service',
      services: ['api'],
      dataStrategy: 'synthetic',
      resourceProfile: 'production-like',
      reviewerAccess: 'team-sso',
      ttlHours: 6,
      revisionGate: true,
      injectedFailure: 'none',
    },
    failure: 'quota-exceeded',
  },
  {
    id: 'pricing',
    number: 180,
    title: 'feat: new pricing page',
    author: 'ivan-dev',
    branch: 'pricing-page',
    commit: 'a51f0c8',
    opened: '5 hours ago',
    comments: 4,
    commits: 2,
    changedFiles: 6,
    additions: 187,
    deletions: 42,
    summary:
      'Replaces the pricing page. Marketing wants to click through it on a real review URL before it ships.',
    labels: ['frontend'],
    config: {
      mode: 'single-service',
      services: ['web'],
      dataStrategy: 'synthetic',
      resourceProfile: 'lean',
      reviewerAccess: 'team-sso',
      ttlHours: 8,
      revisionGate: true,
      injectedFailure: 'none',
    },
    failure: 'dns-pending',
  },
  {
    id: 'checkout-state',
    number: 179,
    title: 'feat: store checkout state in the database',
    author: 'elena-dev',
    branch: 'checkout-state',
    commit: 'e07c4d2',
    opened: '1 day ago',
    comments: 6,
    commits: 5,
    changedFiles: 14,
    additions: 402,
    deletions: 77,
    summary:
      'Moves checkout state from memory into the database and adds the migration that creates its table.',
    labels: ['backend', 'api'],
    config: {
      mode: 'single-service',
      services: ['api'],
      dataStrategy: 'masked-snapshot',
      resourceProfile: 'balanced',
      reviewerAccess: 'team-sso',
      ttlHours: 12,
      revisionGate: true,
      injectedFailure: 'none',
    },
    failure: 'readiness-failure',
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
    command: 'docker build --tag registry.example.dev/store:SHA .',
  },
  {
    id: 'push',
    title: 'Push image to registry',
    detail: 'The immutable commit image becomes available',
    duration: 5000,
    command: 'docker push registry.example.dev/store:SHA',
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
  'cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-terminal';

function labelClasses(label: string): string {
  return (
    {
      frontend: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
      api: 'border-violet-500/40 bg-violet-500/15 text-violet-300',
      backend: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
      worker: 'border-terminal-warning/40 bg-terminal-warning/15 text-terminal-warning',
      preview: 'border-primary/50 bg-primary/15 text-primary',
      enhancement: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    }[label] ?? 'border-terminal-border bg-terminal-bar text-terminal-muted'
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
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-max max-w-48 -translate-x-1/2 rounded-md border border-terminal-border bg-terminal-bar px-2 py-1 text-center text-xs font-medium text-terminal-foreground opacity-0 transition-opacity group-hover:opacity-100"
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
    <div className="overflow-hidden rounded-xl border border-terminal-border bg-terminal text-terminal-foreground">
      <div className="flex min-h-11 items-center gap-3 border-b border-terminal-border bg-terminal px-3 sm:px-5">
        <Github className="size-6 shrink-0 fill-current" aria-hidden="true" />
        <div className="min-w-0 text-sm">
          <span className="text-terminal-muted">acme / </span>
          <span className="font-semibold text-primary">store</span>
        </div>
        <span className="rounded-full border border-terminal-border px-2 py-0.5 text-xs text-terminal-muted">
          Public
        </span>
      </div>
      <nav
        aria-label="Repository navigation"
        className="grid grid-cols-4 gap-1 border-b border-terminal-border bg-terminal px-2 pt-1 sm:flex sm:px-4"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = tab.id === activeTab;
          const content = (
            <>
              <Icon className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sr-only sm:hidden">{tab.label}</span>
            </>
          );
          if (!selected) {
            return (
              <UnavailableControl
                key={tab.id}
                className="min-w-0 justify-center border-b-2 border-transparent px-1 py-2 text-xs font-medium text-terminal-muted sm:shrink-0 sm:px-3"
              >
                <span className="flex items-center justify-center gap-2">{content}</span>
              </UnavailableControl>
            );
          }
          return (
            <div
              key={tab.id}
              aria-current="page"
              className="flex min-w-0 items-center justify-center gap-2 border-b-2 border-primary px-1 py-2 text-xs font-medium text-terminal-input sm:shrink-0 sm:px-3"
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
        'rounded-full border px-2 py-0.5 text-xs font-semibold',
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
      <div className="p-3">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <UnavailableControl className="flex-1">
            <span className="flex min-h-10 w-full items-center rounded-md border border-terminal-border bg-terminal px-3 text-xs text-terminal-muted">
              <Search className="mr-2 size-4" aria-hidden="true" />
              is:pr is:open
            </span>
          </UnavailableControl>
          <div className="flex gap-2">
            <UnavailableControl>
              <span className="flex h-10 items-center rounded-md border border-terminal-border bg-terminal-bar px-3 text-xs font-semibold">
                Labels
              </span>
            </UnavailableControl>
            <UnavailableControl>
              <Button size="sm" disabled className="min-h-10 opacity-70">
                New pull request
              </Button>
            </UnavailableControl>
          </div>
        </div>
        <div className="overflow-hidden rounded-md border border-terminal-border">
          <div className="flex items-center gap-5 border-b border-terminal-border bg-terminal-bar px-4 py-3 text-xs">
            <span className="flex items-center gap-2 font-semibold">
              <GitPullRequest className="size-4 text-terminal-success" aria-hidden="true" />
              {PULL_REQUESTS.length} Open
            </span>
            <UnavailableControl className="text-terminal-muted">
              <span>18 Closed</span>
            </UnavailableControl>
            <span className="ml-auto hidden text-terminal-muted sm:inline">Sort</span>
          </div>
          {PULL_REQUESTS.map((pullRequest) => (
            <button
              key={pullRequest.id}
              type="button"
              onClick={() => onOpen(pullRequest)}
              className={cn(
                ACTIVE_CONTROL,
                'group flex w-full gap-3 border-b border-terminal-border px-4 py-2.5 text-left last:border-b-0 hover:bg-terminal-bar'
              )}
            >
              <GitPullRequest
                className="mt-0.5 size-4 shrink-0 text-terminal-success"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold group-hover:text-primary">
                    {pullRequest.title}
                  </span>
                  {pullRequest.labels.map((label) => (
                    <Label key={label}>{label}</Label>
                  ))}
                </span>
                <span className="mt-1 block text-xs text-terminal-muted">
                  #{pullRequest.number} opened {pullRequest.opened} by {pullRequest.author}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-terminal-muted">
                <MessageSquare className="size-4" aria-hidden="true" />
                {pullRequest.comments}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-terminal-muted">
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
      <div className="p-3">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            ACTIVE_CONTROL,
            'mb-4 flex min-h-10 items-center gap-2 rounded px-1 py-0.5 text-xs font-medium text-primary hover:bg-primary/15 hover:underline'
          )}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Pull requests
        </button>
        <div className="border-b border-terminal-border pb-4">
          <h3 className="text-xl font-normal leading-tight sm:text-2xl">
            {pullRequest.title}{' '}
            <span className="font-light text-terminal-muted">#{pullRequest.number}</span>
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-terminal-muted">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-terminal-success/15 px-3 py-1 font-semibold text-terminal-success">
              <GitPullRequest className="size-4" aria-hidden="true" />
              Open
            </span>
            <strong className="text-terminal-input">{pullRequest.author}</strong> wants to merge{' '}
            {pullRequest.commits} commits into
            <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-primary">
              main
            </span>
            from
            <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-primary">
              {pullRequest.branch}
            </span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1 border-b border-terminal-border">
          {[
            { label: 'Conversation', short: 'Chat', count: pullRequest.comments },
            { label: 'Commits', short: 'Commits', count: pullRequest.commits },
            { label: 'Checks', short: 'Checks', count: 0 },
            { label: 'Files changed', short: 'Files', count: pullRequest.changedFiles },
          ].map((tab, index) =>
            index === 0 ? (
              <span
                key={tab.label}
                aria-current="page"
                className="min-w-0 border-b-2 border-primary px-1 py-2 text-center text-xs font-medium text-terminal-input sm:px-3"
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.short}</span> {tab.count}
              </span>
            ) : (
              <UnavailableControl
                key={tab.label}
                className="min-w-0 justify-center border-b-2 border-transparent px-1 py-2 text-center text-xs font-medium text-terminal-muted sm:px-3"
              >
                <span className="truncate">
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.short}</span> {tab.count}
                </span>
              </UnavailableControl>
            )
          )}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0">
            <div className="overflow-hidden rounded-md border border-terminal-border">
              <div className="border-b border-terminal-border bg-terminal-bar px-4 py-3 text-xs">
                <strong>{pullRequest.author}</strong>{' '}
                <span className="text-terminal-muted">commented {pullRequest.opened}</span>
              </div>
              <div className="space-y-4 p-4 text-sm leading-6">
                <p>{pullRequest.summary}</p>
                <div className="rounded-md border border-terminal-border bg-terminal-bar p-3">
                  <strong className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="size-4 text-terminal-success" aria-hidden="true" />
                    What should reviewers verify?
                  </strong>
                  <ul className="mt-2 space-y-1 text-xs text-terminal-muted">
                    <li>• The changed services work together.</li>
                    <li>• Test data stays isolated from production.</li>
                    <li>• The deployed revision matches commit {pullRequest.commit}.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-md border border-terminal-border bg-terminal-bar p-3 text-xs text-terminal-muted">
              <strong className="text-terminal-input">{pullRequest.author}</strong> added{' '}
              {pullRequest.additions} lines and removed {pullRequest.deletions}.
            </div>
          </div>

          <aside className="text-xs">
            {['Reviewers', 'Assignees', 'Projects'].map((heading) => (
              <div key={heading} className="border-b border-terminal-border py-3">
                <strong className="block">{heading}</strong>
                <span className="text-terminal-muted">None yet</span>
              </div>
            ))}
            <div className="relative border-b border-terminal-border py-3">
              <div className="mb-2 flex items-center justify-between">
                <strong>Labels</strong>
                <button
                  type="button"
                  onClick={onToggleLabels}
                  className={cn(
                    ACTIVE_CONTROL,
                    'size-10 rounded p-1 text-terminal-muted hover:bg-terminal-bar hover:text-terminal-input'
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
                  'mt-3 min-h-10 w-full rounded-md border border-terminal-border bg-terminal-bar px-3 py-2 text-left font-semibold hover:border-primary hover:bg-terminal'
                )}
              >
                Add label
              </button>
              {labelPickerOpen && (
                <div className="absolute right-0 top-10 z-20 w-64 overflow-hidden rounded-md border border-terminal-border bg-terminal-bar">
                  <div className="border-b border-terminal-border px-3 py-2">
                    <strong>Apply labels</strong>
                    <div
                      aria-disabled="true"
                      title="Unavailable in this simulator"
                      className="mt-2 flex cursor-not-allowed items-center rounded-md border border-terminal-border bg-terminal px-2 py-1.5 text-terminal-muted hover:opacity-50"
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
                          'group relative flex w-full gap-2 border-b border-terminal-border px-3 py-2.5 text-left last:border-b-0',
                          available
                            ? cn(ACTIVE_CONTROL, 'hover:bg-terminal')
                            : 'cursor-not-allowed hover:bg-terminal'
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
                          <span className="text-xs leading-4 text-terminal-muted">
                            {description}
                          </span>
                        </span>
                        {!available && (
                          <span className="pointer-events-none absolute inset-0 grid place-items-center bg-terminal-bar/90 text-xs font-semibold text-terminal-foreground opacity-0 transition-opacity group-hover:opacity-100">
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
        <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-md border border-primary bg-primary/15 p-3 sm:flex-row sm:items-center">
          <span className="flex items-start gap-2 text-xs">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <strong className="block">Ask for a live preview</strong>
              <span className="text-terminal-muted">Add the preview label like a real PR.</span>
            </span>
          </span>
          <Button
            type="button"
            onClick={onToggleLabels}
            size="sm"
            className="min-h-10 shrink-0 cursor-pointer"
          >
            Add label
          </Button>
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
      <circle
        className="stroke-terminal-border"
        cx="12"
        cy="12"
        r="10"
        fill="none"
        strokeWidth="2"
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        className={tone === 'purple' ? 'stroke-violet-300' : 'stroke-primary'}
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
    <div className="rounded-lg border border-terminal-error/40 bg-terminal-error/15 p-3">
      <div className="flex gap-3">
        <XCircle className="mt-0.5 size-5 shrink-0 text-terminal-error" aria-hidden="true" />
        <div>
          <strong className="text-terminal-error">{failure.label}</strong>
          <p className="mt-1 text-xs leading-5 text-terminal-foreground">{failure.signal}</p>
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
              'rounded-md border border-terminal-border bg-terminal-bar p-3 text-left text-xs hover:border-primary hover:bg-primary/15'
            )}
          >
            <strong className="block">{option.label}</strong>
            <span className="mt-1 block leading-4 text-terminal-muted">{option.explanation}</span>
          </button>
        ))}
      </div>
      {state.failedRemediationAttempts > 0 && (
        <p className="mt-3 text-xs text-terminal-error">{state.lastEvent}</p>
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
      <span className="grid size-6 place-items-center rounded-full bg-terminal-success/15">
        <Check className="size-4 text-terminal-success" aria-hidden="true" />
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="grid size-6 place-items-center rounded-full bg-terminal-error/15">
        <XCircle className="size-4 text-terminal-error" aria-hidden="true" />
      </span>
    );
  }
  return <span className="size-6 rounded-full border-2 border-terminal-border" />;
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
    <div className="overflow-hidden rounded-md border border-terminal-border">
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
              'flex gap-3 border-b border-terminal-border px-3 py-3 last:border-b-0',
              phase === 'running' &&
                stepIndex === activeIndex &&
                (tone === 'purple' ? 'bg-violet-500/15' : 'bg-primary/15')
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
                <span className="text-xs uppercase tracking-wide text-terminal-muted">
                  {status === 'waiting'
                    ? 'Waiting'
                    : status === 'running'
                      ? 'Running'
                      : status === 'successful'
                        ? 'Successful'
                        : 'Failed'}
                </span>
              </div>
              <p className="mt-1 text-xs leading-4 text-terminal-muted">{step.detail}</p>
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
    <div className="overflow-hidden rounded-lg border border-terminal-border bg-terminal text-terminal-foreground">
      <div className="flex items-center gap-3 border-b border-terminal-border bg-terminal-bar px-3 py-2">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-terminal-error" />
          <span className="size-2.5 rounded-full bg-terminal-warning" />
          <span className="size-2.5 rounded-full bg-terminal-success" />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center rounded border border-terminal-border bg-terminal px-3 py-1 font-mono text-xs text-terminal-muted">
          <LockKeyhole className="mr-2 size-3" aria-hidden="true" />
          preview-control-plane.internal/webhooks/github
        </div>
      </div>

      <div className="border-b border-terminal-border px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              GitHub → preview control plane
            </div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              {failed ? (
                <XCircle className="size-5 text-terminal-error" aria-hidden="true" />
              ) : phase === 'complete' ? (
                <CheckCircle2 className="size-5 text-terminal-success" aria-hidden="true" />
              ) : phase === 'running' ? (
                <LoaderCircle
                  className="size-5 motion-safe:animate-spin text-primary"
                  aria-hidden="true"
                />
              ) : (
                <Webhook className="size-5 text-primary" aria-hidden="true" />
              )}
              Deliver the label event
            </h3>
            <p className="mt-1 text-xs text-terminal-muted">
              A webhook speeds up discovery; the ApplicationSet controller still owns desired state.
            </p>
          </div>
          <span className="rounded-full border border-primary px-2.5 py-1 text-xs font-semibold text-primary">
            pull_request · labeled
          </span>
        </div>
      </div>

      <div className="p-3">
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
                  <div className="grid place-items-center text-terminal-muted" aria-hidden="true">
                    <span className="hidden sm:inline">→</span>
                    <ArrowDown className="size-4 sm:hidden" />
                  </div>
                )}
                <div
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    status === 'waiting' && 'border-terminal-border bg-terminal opacity-55',
                    status === 'active' && 'border-primary bg-primary/15',
                    status === 'complete' && 'border-terminal-success/40 bg-terminal-success/15',
                    status === 'failed' && 'border-terminal-error/40 bg-terminal-error/15'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid size-9 place-items-center rounded-md border border-terminal-border bg-terminal">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    {status === 'complete' && (
                      <CheckCircle2 className="size-4 text-terminal-success" aria-hidden="true" />
                    )}
                    {status === 'active' && <CircularProgress progress={progress} />}
                  </div>
                  <div className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-terminal-muted">
                    {node.eyebrow}
                  </div>
                  <strong className="mt-1 block text-sm">{node.title}</strong>
                  <span className="mt-1 block text-xs text-terminal-muted">{node.detail}</span>
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
          <div className="overflow-hidden rounded-md border border-terminal-border bg-terminal">
            <div className="flex items-center justify-between border-b border-terminal-border bg-terminal-bar px-3 py-2 text-xs">
              <strong className="flex items-center gap-2">
                <Webhook className="size-4 text-primary" aria-hidden="true" />
                Delivery payload
              </strong>
              <span className="font-mono text-xs text-terminal-muted">X-Hub-Signature-256 ✓</span>
            </div>
            <div className="min-h-44 space-y-1 overflow-x-auto p-3 font-mono text-xs leading-5">
              <div className="text-terminal-muted">event: pull_request</div>
              <div>action: labeled</div>
              <div>number: {pullRequest.number}</div>
              <div>label: preview</div>
              <div>head.sha: {pullRequest.commit}</div>
              {phase === 'running' && (
                <div className="mt-3 motion-safe:animate-pulse text-primary">
                  receiver › {current.command}
                </div>
              )}
              {phase === 'complete' && (
                <div className="mt-3 text-terminal-success">202 Accepted · refresh queued</div>
              )}
              {failed && <div className="mt-3 text-terminal-error">Error: {state.lastEvent}</div>}
            </div>
          </div>
        </div>

        {failed ? (
          <div className="mt-4">
            <FailurePanel state={state} onRemediate={onRemediate} />
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3 rounded-md border border-terminal-border bg-terminal-bar p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-terminal-muted">
              <Webhook className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {phase === 'idle'
                ? 'The label event is ready to leave GitHub.'
                : phase === 'running'
                  ? 'Follow the event from GitHub to the ApplicationSet controller.'
                  : 'The matching PR is now known to the preview control plane.'}
            </div>
            {phase === 'idle' && (
              <Button size="sm" className="min-h-10 cursor-pointer" onClick={onRun}>
                <Play className="size-4" aria-hidden="true" />
                Deliver webhook
              </Button>
            )}
            {phase === 'complete' && (
              <Button size="sm" className="min-h-10 cursor-pointer" onClick={onContinue}>
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
      <div className="grid md:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="border-b border-terminal-border p-3 md:border-b-0 md:border-r">
          <strong className="mb-3 flex items-center gap-2 text-xs">
            <Workflow className="size-4" aria-hidden="true" />
            Actions
          </strong>
          <div className="rounded-md border border-primary bg-primary/15 px-3 py-2 text-xs font-semibold text-terminal-input">
            Preview image
          </div>
          <div className="mt-3 space-y-1 text-xs text-terminal-muted">
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

        <div className="min-w-0 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-terminal-border pb-3">
            <div>
              <div className="mb-1 text-xs text-terminal-muted">
                Preview image / run #{pullRequest.number}
              </div>
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                {failed ? (
                  <XCircle className="size-5 text-terminal-error" aria-hidden="true" />
                ) : phase === 'complete' ? (
                  <CheckCircle2 className="size-5 text-terminal-success" aria-hidden="true" />
                ) : phase === 'running' ? (
                  <LoaderCircle
                    className="size-5 motion-safe:animate-spin text-primary"
                    aria-hidden="true"
                  />
                ) : (
                  <CircleDot className="size-5 text-terminal-muted" aria-hidden="true" />
                )}
                Build and publish the preview
              </h3>
              <p className="mt-1 text-xs text-terminal-muted">
                GitHub-hosted runner · {pullRequest.branch} · {pullRequest.commit}
              </p>
            </div>
            <span className="rounded-full border border-primary px-2.5 py-1 text-xs font-semibold text-primary">
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
                <div className="flex gap-3 border-t border-terminal-border px-3 py-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-terminal-border">
                    <MessageSquare className="size-3 text-terminal-muted" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong className="text-xs">Comment preview URL on PR</strong>
                      <span className="text-xs uppercase tracking-wide text-terminal-muted">
                        Waiting for Argo CD
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-4 text-terminal-muted">
                      The final job waits for a healthy URL, then calls the GitHub API.
                    </p>
                  </div>
                </div>
              }
            />
            <div className="overflow-hidden rounded-md border border-terminal-border bg-terminal">
              <div className="flex justify-between border-b border-terminal-border bg-terminal-bar px-3 py-2 text-xs">
                <strong className="flex items-center gap-2 text-primary">
                  <Github className="size-4" aria-hidden="true" />
                  GitHub Actions runner
                </strong>
                <span className="text-terminal-muted">
                  {phase === 'idle' ? 'Queued' : 'ubuntu-latest'}
                </span>
              </div>
              <div className="min-h-52 space-y-2 overflow-x-auto p-3 font-mono text-xs leading-5">
                {phase === 'idle' ? (
                  <div className="flex h-40 flex-col items-center justify-center text-center text-terminal-muted">
                    <Clock3 className="mb-2 size-6" aria-hidden="true" />
                    <strong className="text-terminal-foreground">
                      Workflow queued by the labeled event
                    </strong>
                    <span>Start the walkthrough when you are ready.</span>
                  </div>
                ) : (
                  <>
                    <div className="text-terminal-muted">Runner image: ubuntu-latest</div>
                    <div>
                      <span className="text-terminal-success">✓</span> Checkout {pullRequest.branch}{' '}
                      at {pullRequest.commit}
                    </div>
                    {(index > 0 || phase === 'complete') && (
                      <div>
                        <span className="text-terminal-success">✓</span> Image built successfully
                      </div>
                    )}
                    {phase === 'complete' && (
                      <div>
                        <span className="text-terminal-success">✓</span> Published
                        registry.example.dev/store:
                        {pullRequest.commit}
                      </div>
                    )}
                    {phase === 'running' && (
                      <div className="motion-safe:animate-pulse text-primary">
                        <span>$ </span>
                        {current.command.replace('SHA', pullRequest.commit)}
                      </div>
                    )}
                    {failed && <div className="text-terminal-error">Error: {state.lastEvent}</div>}
                  </>
                )}
              </div>
              <div className="h-1 bg-terminal-bar">
                <div
                  className="h-full bg-primary transition-[width] duration-100"
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
            <div className="mt-4 flex flex-col gap-3 rounded-md border border-terminal-border bg-terminal-bar p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-terminal-muted">
                {phase === 'complete' ? (
                  <Package className="size-4 shrink-0 text-terminal-success" aria-hidden="true" />
                ) : (
                  <Play className="size-4 shrink-0 text-primary" aria-hidden="true" />
                )}
                {phase === 'idle'
                  ? 'The same labeled event also queued this GitHub Actions workflow.'
                  : phase === 'running'
                    ? 'The workflow now advances automatically through its two jobs.'
                    : `Artifact ready: registry.example.dev/store:${pullRequest.commit}. The PR comment is waiting for Argo.`}
              </div>
              {phase === 'idle' && (
                <Button size="sm" className="min-h-10 cursor-pointer" onClick={onRun}>
                  <Play className="size-4" aria-hidden="true" />
                  Watch workflow run
                </Button>
              )}
              {phase === 'complete' && (
                <Button size="sm" className="min-h-10 cursor-pointer" onClick={onContinue}>
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
  detail,
}: {
  kind: string;
  name: string;
  status: ResourceState;
  icon: typeof Boxes;
  detail?: string;
}) {
  const statusLabel =
    status === 'ready' ? 'Healthy' : status === 'creating' ? 'Progressing' : 'Missing';
  return (
    <div
      className={cn(
        'relative min-h-[58px] rounded-sm border bg-terminal px-2.5 py-2 transition-colors',
        status === 'queued' && 'border-terminal-border opacity-55',
        status === 'creating' && 'border-primary bg-primary/15',
        status === 'ready' && 'border-terminal-success/40 bg-terminal-success/15'
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-terminal-bar text-terminal-input">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <strong className="truncate text-xs font-medium text-terminal-input">{name}</strong>
            <span className="text-xs font-bold text-terminal-muted" aria-hidden="true">
              ⋮
            </span>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-terminal-muted">
            <span>{kind}</span>
            <span aria-hidden="true">·</span>
            {status === 'creating' ? (
              <LoaderCircle
                className="size-3 motion-safe:animate-spin text-primary"
                aria-hidden="true"
              />
            ) : status === 'ready' ? (
              <CheckCircle2 className="size-3 text-terminal-success" aria-hidden="true" />
            ) : (
              <CircleDot className="size-3 text-terminal-muted" aria-hidden="true" />
            )}
            <span>{statusLabel}</span>
            {detail && <span className="ml-auto truncate text-terminal-muted">{detail}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ArgoGraphConnector() {
  return (
    <>
      <div className="hidden items-center lg:flex" aria-hidden="true">
        <span className="w-full border-t border-dashed border-terminal-muted" />
        <span className="-ml-1 text-sm text-terminal-muted">›</span>
      </div>
      <div className="grid h-5 place-items-center text-terminal-muted lg:hidden" aria-hidden="true">
        <ArrowDown className="size-4" />
      </div>
    </>
  );
}

function ArgoControlPlaneScene({
  pullRequest,
  phase,
  progress,
  state,
  onContinue,
  onRemediate,
}: {
  pullRequest: PullRequestScenario;
  phase: AutomationPhase;
  progress: number;
  state: PreviewEnvironmentState;
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
  const syncLabel = ready ? 'Synced' : phase === 'running' ? 'Syncing' : 'OutOfSync';
  const healthLabel = ready ? 'Healthy' : 'Progressing';
  const lastSyncLabel = ready ? 'Sync OK' : phase === 'running' ? 'Running' : 'Not synced';
  // Resources in the tree below the Application: one deployment per service plus six shared
  const resourceCount = state.config.services.length + 6;
  const toolbarButton =
    'inline-flex min-h-10 items-center gap-1 rounded-full bg-terminal-bar px-2.5 text-xs font-semibold uppercase text-terminal-foreground';
  return (
    <>
      <div className="overflow-hidden rounded-lg border border-terminal-border bg-terminal text-terminal-foreground">
        <div className="flex items-center justify-between border-b border-terminal-border bg-terminal-bar px-3 py-2 md:hidden">
          <span className="flex items-center gap-2 font-semibold text-terminal-input">
            <span className="grid size-7 place-items-center rounded-full bg-terminal-error/15 text-terminal-error">
              <Workflow className="size-4" aria-hidden="true" />
            </span>
            argo
          </span>
          <span className="text-xs font-semibold uppercase text-primary">
            Application details tree
          </span>
        </div>

        <div className="md:grid md:grid-cols-[152px_minmax(0,1fr)]">
          <aside className="hidden min-h-[400px] flex-col bg-terminal-bar px-3 py-3 text-terminal-foreground md:flex">
            <div className="flex items-center gap-2 border-b border-terminal-border pb-3">
              <span className="grid size-8 place-items-center rounded-full bg-terminal-error/15 text-terminal-error">
                <Workflow className="size-4" aria-hidden="true" />
              </span>
              <div>
                <strong className="block text-base tracking-wide">argo</strong>
                <span className="block text-xs text-terminal-muted">v3.3.0</span>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-xs">
              <div className="flex items-center gap-2 rounded bg-terminal px-2 py-2 font-semibold text-terminal-input">
                <Layers3 className="size-3.5 text-terminal-error" aria-hidden="true" />
                Applications
              </div>
              {['Settings', 'User info', 'Documentation'].map((item) => (
                <UnavailableControl key={item} className="block w-full" tooltip="Read-only demo">
                  <span className="flex w-full items-center gap-2 rounded px-2 py-2 text-terminal-muted">
                    <CircleDot className="size-3.5" aria-hidden="true" />
                    {item}
                  </span>
                </UnavailableControl>
              ))}
            </div>
            <div className="mt-5 border-t border-terminal-border pt-3 text-xs uppercase tracking-wide text-terminal-muted">
              Resource filters
            </div>
            <label className="mt-2 text-xs text-terminal-muted">
              Name
              <input
                readOnly
                aria-label="Resource name filter"
                className="mt-1 h-10 w-full cursor-not-allowed rounded-sm border border-terminal-border bg-terminal px-2 text-xs text-terminal-foreground outline-none"
                value=""
              />
            </label>
            <div className="mt-4 space-y-2 text-xs text-terminal-muted">
              <strong className="block uppercase">Sync status</strong>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-terminal-success" /> Synced{' '}
                {ready ? resourceCount : 0}
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-terminal-warning" /> OutOfSync{' '}
                {ready ? 0 : resourceCount}
              </div>
              <strong className="block pt-2 uppercase">Health status</strong>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-terminal-success" /> Healthy{' '}
                {ready ? resourceCount : 0}
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-primary" /> Progressing{' '}
                {ready ? 0 : resourceCount}
              </div>
            </div>
            <a
              href="https://atomsized.com/preview-environments"
              target="_blank"
              rel="noreferrer"
              className={cn(
                ACTIVE_CONTROL,
                'mt-auto flex items-center gap-1.5 border-t border-terminal-border pt-3 text-xs text-terminal-muted hover:text-terminal-input'
              )}
            >
              Preview automation by Atomsized
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </aside>

          <div className="min-w-0">
            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-terminal-border bg-terminal-bar px-3 py-2 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-primary">Applications</span>
                <span className="text-terminal-muted">/</span>
                <Search className="size-3 shrink-0" aria-hidden="true" />
                <strong className="truncate">preview-pr-{pullRequest.number}</strong>
              </div>
              <span className="hidden shrink-0 font-semibold uppercase text-primary sm:block">
                Application details tree
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-b border-terminal-border bg-terminal-bar px-3 py-2">
              {['Details', 'Diff'].map((item) => (
                <UnavailableControl key={item} tooltip="Read-only in this simulator">
                  <span className={toolbarButton}>{item}</span>
                </UnavailableControl>
              ))}
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  toolbarButton,
                  failed && 'bg-terminal-error/15 text-terminal-error',
                  !failed && ready && 'bg-terminal-success/15 text-terminal-success',
                  !failed && !ready && 'bg-primary/15 text-primary'
                )}
              >
                {failed ? (
                  <XCircle className="size-3" aria-hidden="true" />
                ) : ready ? (
                  <CheckCircle2 className="size-3" aria-hidden="true" />
                ) : (
                  <LoaderCircle className="size-3 motion-safe:animate-spin" aria-hidden="true" />
                )}
                {failed ? 'Sync blocked' : ready ? 'Synced' : 'Auto-syncing'}
              </span>
              {['Sync status', 'History and rollback', 'Delete'].map((item, index) => (
                <UnavailableControl
                  key={item}
                  className={cn(index > 0 && 'hidden sm:inline-flex')}
                  tooltip="Read-only in this simulator"
                >
                  <span className={toolbarButton}>{item}</span>
                </UnavailableControl>
              ))}
              <UnavailableControl tooltip="Read-only in this simulator">
                <span className={toolbarButton}>
                  <RefreshCw className="size-3" aria-hidden="true" /> Refresh
                </span>
              </UnavailableControl>
            </div>

            <div className="grid grid-cols-3 divide-x divide-terminal-border border-b border-terminal-border bg-terminal-bar">
              {[
                {
                  eyebrow: 'App health',
                  value: healthLabel,
                  detail: ready ? 'All resources healthy' : activeLabel,
                  tone: ready ? 'text-terminal-success' : 'text-primary',
                },
                {
                  eyebrow: 'Sync status',
                  value: syncLabel,
                  detail: `to ${pullRequest.commit}`,
                  tone: ready ? 'text-terminal-success' : 'text-terminal-warning',
                },
                {
                  eyebrow: 'Last sync',
                  value: lastSyncLabel,
                  detail: phase === 'idle' ? 'Auto-sync enabled' : `revision ${pullRequest.commit}`,
                  tone: ready ? 'text-terminal-success' : 'text-primary',
                },
              ].map((metric) => (
                <div key={metric.eyebrow} className="min-w-0 px-2 py-2.5 sm:px-3">
                  <span className="block text-xs font-semibold uppercase text-terminal-muted">
                    {metric.eyebrow}
                  </span>
                  <strong className="mt-1 flex items-center gap-1 truncate text-xs sm:text-sm">
                    {phase === 'running' && metric.eyebrow !== 'Sync status' ? (
                      <LoaderCircle
                        className={cn('size-3.5 shrink-0 motion-safe:animate-spin', metric.tone)}
                        aria-hidden="true"
                      />
                    ) : (
                      <CheckCircle2
                        className={cn('size-3.5 shrink-0', metric.tone)}
                        aria-hidden="true"
                      />
                    )}
                    {metric.value}
                  </strong>
                  <span className="mt-0.5 hidden truncate text-xs text-terminal-muted sm:block">
                    {metric.detail}
                  </span>
                </div>
              ))}
            </div>

            <div className="relative overflow-x-auto bg-terminal p-3">
              <div className="absolute left-3 top-3 z-10 hidden items-center divide-x divide-terminal-border rounded-sm border border-terminal-border bg-terminal-bar text-terminal-muted sm:flex">
                {[Layers3, Plus, Search].map((Icon, index) => (
                  <UnavailableControl key={index} tooltip="View control unavailable">
                    <span className="grid size-7 place-items-center">
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                  </UnavailableControl>
                ))}
                <span className="px-2 text-xs">100%</span>
              </div>

              <div
                className="grid min-w-[620px] items-center pt-1 sm:pt-9 lg:grid-cols-[minmax(150px,0.75fr)_30px_minmax(180px,0.95fr)_30px_minmax(210px,1.15fr)]"
                aria-label={`Argo CD resource tree for preview-pr-${pullRequest.number}`}
              >
                <ArgoResourceNode
                  kind="application"
                  name={`preview-pr-${pullRequest.number}`}
                  status={application}
                  icon={Layers3}
                  detail={pullRequest.commit}
                />
                <ArgoGraphConnector />
                <div className="space-y-2">
                  <ArgoResourceNode
                    kind="namespace"
                    name={`preview-pr-${pullRequest.number}`}
                    status={provision}
                    icon={Boxes}
                  />
                  {state.config.services.map((service) => (
                    <ArgoResourceNode
                      key={service}
                      kind="deployment"
                      name={`${pullRequest.id}-${service}`}
                      status={provision}
                      icon={ServerCog}
                    />
                  ))}
                  <ArgoResourceNode
                    kind="service"
                    name={`${pullRequest.id}-entrypoint`}
                    status={provision}
                    icon={Network}
                  />
                </div>
                <ArgoGraphConnector />
                <div className="space-y-2">
                  <ArgoResourceNode
                    kind="ingress"
                    name={`${pullRequest.id}-${pullRequest.number}.preview.example.dev`}
                    status={expose}
                    icon={Globe2}
                  />
                  <ArgoResourceNode
                    kind="certificate"
                    name={`preview-pr-${pullRequest.number}-tls`}
                    status={expose}
                    icon={ShieldCheck}
                  />
                  <ArgoResourceNode
                    kind="managed dependency"
                    name={`Neon branch pr-${pullRequest.number}`}
                    status={expose}
                    icon={Database}
                  />
                  <ArgoResourceNode
                    kind="PostSync hook"
                    name="revision-and-readiness"
                    status={verify}
                    icon={CheckCircle2}
                  />
                </div>
              </div>

              <div className="mt-3 flex min-w-[620px] items-center gap-2 rounded-sm border border-terminal-border bg-terminal-bar px-3 py-2 text-xs text-terminal-muted">
                {phase === 'running' ? (
                  <LoaderCircle
                    className="size-3.5 shrink-0 motion-safe:animate-spin text-primary"
                    aria-hidden="true"
                  />
                ) : ready ? (
                  <CheckCircle2
                    className="size-3.5 shrink-0 text-terminal-success"
                    aria-hidden="true"
                  />
                ) : (
                  <Clock3 className="size-3.5 shrink-0 text-terminal-muted" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate">
                  {phase === 'idle'
                    ? 'Auto-sync is watching for the new Application.'
                    : phase === 'running'
                      ? `application-controller · ${activeLabel}`
                      : `Sync completed · preview-pr-${pullRequest.number} is Healthy`}
                </span>
                <span className="hidden font-mono text-terminal-muted sm:inline">
                  registry.example.dev/store:{pullRequest.commit}
                </span>
              </div>
              <div className="mt-1 h-1 min-w-[620px] bg-terminal-bar">
                <div
                  className="h-full bg-primary transition-[width] duration-100"
                  style={{ width: phase === 'complete' ? '100%' : String(progress) + '%' }}
                />
              </div>
            </div>

            {!failed && phase === 'complete' && (
              <div className="flex flex-col gap-2 border-t border-terminal-border bg-terminal-bar px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-2 text-terminal-muted">
                  <CheckCircle2
                    className="size-3.5 shrink-0 text-terminal-success"
                    aria-hidden="true"
                  />
                  Argo CD is Synced and Healthy. GitHub Actions can post the preview URL.
                </span>
                <Button size="sm" className="min-h-10 cursor-pointer" onClick={onContinue}>
                  Return to pull request
                  <MessageSquare className="size-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      {failed && (
        <div className="mt-4">
          <FailurePanel state={state} onRemediate={onRemediate} />
        </div>
      )}
    </>
  );
}

function ResourceStatus({ status }: { status: ResourceState }) {
  if (status === 'creating' || status === 'removing') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide',
          status === 'creating' ? 'text-primary' : 'text-terminal-warning'
        )}
      >
        <LoaderCircle className="size-3 motion-safe:animate-spin" aria-hidden="true" />
        {status === 'creating' ? 'Creating' : 'Removing'}
      </span>
    );
  }
  if (status === 'ready' || status === 'removed') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide',
          status === 'ready' ? 'text-terminal-success' : 'text-terminal-muted'
        )}
      >
        <CheckCircle2 className="size-3" aria-hidden="true" />
        {status === 'ready' ? 'Ready' : 'Removed'}
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold uppercase tracking-wide text-terminal-muted">
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
        'rounded-lg border p-3 transition-colors',
        wide && 'sm:col-span-2',
        status === 'creating' && 'border-primary bg-primary/15',
        status === 'ready' && 'border-terminal-success/40 bg-terminal-success/15',
        status === 'queued' && 'border-terminal-border bg-terminal opacity-55',
        status === 'removing' && 'border-terminal-warning/40 bg-terminal-warning/15 opacity-70',
        status === 'removed' && 'border-terminal-border bg-terminal opacity-40'
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md border border-terminal-border text-terminal-muted">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap justify-between gap-2">
            <strong className="text-sm">{title}</strong>
            <ResourceStatus status={status} />
          </div>
          <p className="mt-1 truncate text-xs text-terminal-muted">{detail}</p>
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
      <div className="flex flex-wrap items-center gap-3 border-b border-terminal-border bg-terminal-bar px-3 py-3 sm:px-5">
        <span className="grid size-9 place-items-center rounded-full bg-terminal-success/15 text-terminal-success">
          <GitPullRequest className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-semibold">
            {pullRequest.title}{' '}
            <span className="font-normal text-terminal-muted">#{pullRequest.number}</span>
          </h3>
          <p className="text-xs text-terminal-muted">
            {pullRequest.author} wants to merge {pullRequest.branch} into main
          </p>
        </div>
        <span
          className={cn(
            'ml-auto rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
            cleaning || removed
              ? 'border-violet-500/40 text-violet-300'
              : 'border-terminal-success/40 text-terminal-success'
          )}
        >
          {cleaning || removed ? 'Closed' : 'Open'}
        </span>
      </div>
      <div className="bg-terminal p-3 text-terminal-foreground">
        <div className="mb-4 grid grid-cols-[32px_minmax(0,1fr)] gap-3">
          <span className="grid size-8 place-items-center rounded-full bg-violet-500/15 text-violet-300">
            <Bot className="size-4" aria-hidden="true" />
          </span>
          <div className="overflow-hidden rounded-md border border-terminal-border">
            <div className="border-b border-terminal-border bg-terminal-bar px-3 py-2 text-xs">
              <strong>preview-environment-bot</strong>{' '}
              <span className="text-terminal-muted">
                {removed ? 'updated this comment after cleanup' : 'commented just now'}
              </span>
            </div>
            <div className="space-y-3 p-4">
              {removed ? (
                <>
                  <strong className="block text-sm">Preview environment removed</strong>
                  <p className="text-xs text-terminal-muted">
                    PR #{pullRequest.number} was closed. Argo CD pruned the Application and every
                    namespaced resource together.
                  </p>
                </>
              ) : cleaning ? (
                <div className="flex items-center gap-3">
                  <LoaderCircle
                    className="size-5 motion-safe:animate-spin text-terminal-warning"
                    aria-hidden="true"
                  />
                  <div>
                    <strong className="block text-sm">Removing preview environment</strong>
                    <span className="text-xs text-terminal-muted">
                      Argo CD prune is in progress.
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong className="block text-sm text-terminal-success">
                        Preview environment is ready
                      </strong>
                      <code className="mt-1 block text-xs text-primary">https://{reviewUrl}</code>
                    </div>
                    <span className="rounded-full border border-terminal-success/40 px-2 py-1 text-xs font-semibold text-terminal-success">
                      Argo CD · Synced / Healthy
                    </span>
                  </div>
                  <div className="grid gap-2 text-xs text-terminal-muted sm:grid-cols-3">
                    <span>Revision · {pullRequest.commit}</span>
                    <span>Namespace · {namespace}</span>
                    <span>Expires · {state.config.ttlHours}h</span>
                  </div>
                  <div className="flex items-center gap-2 border-t border-terminal-border pt-3 text-xs text-terminal-muted">
                    <CheckCircle2 className="size-3.5 text-terminal-success" aria-hidden="true" />
                    GitHub Actions · comment-preview-url · successful
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3 rounded-lg border border-terminal-border bg-terminal-bar p-3">
          {removed || ready || reviewed ? (
            <CheckCircle2 className="size-5 shrink-0 text-terminal-success" aria-hidden="true" />
          ) : (
            <CircularProgress progress={progress} />
          )}
          <div className="min-w-0">
            <strong className="block text-sm">{title}</strong>
            <span className="block truncate text-xs text-terminal-muted">
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
                  'mt-2 inline-flex items-center gap-1 rounded text-xs font-semibold text-primary hover:underline'
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
            <div className="rounded-lg border border-terminal-border bg-terminal-bar p-3">
              <strong className="mb-3 flex items-center gap-2 text-sm">
                <ShieldCheck className="size-4 text-terminal-success" aria-hidden="true" />
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
                  className="flex justify-between gap-2 border-b border-terminal-border py-2 text-xs last:border-b-0"
                >
                  <span className="text-terminal-muted">{label}</span>
                  <ResourceStatus status={status as ResourceState} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-terminal-border bg-terminal-bar p-3">
                <span className="text-xs uppercase text-terminal-muted">Hourly cost</span>
                <div className="mt-1 font-mono text-lg font-semibold">
                  <span>$</span>
                  {removed ? '0.00' : metrics.hourlyCost.toFixed(2)}
                </div>
              </div>
              <div className="rounded-lg border border-terminal-border bg-terminal-bar p-3">
                <span className="text-xs uppercase text-terminal-muted">Isolation</span>
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
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-terminal-success/40 bg-terminal-success/15 p-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <strong className="block text-sm text-terminal-success">
                The preview is ready for a human decision.
              </strong>
              <span className="text-xs text-terminal-muted">
                Review the URL, then record whether this revision looks right.
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="min-h-10 cursor-pointer border-terminal-border bg-transparent text-terminal-foreground transition-colors hover:bg-terminal-bar hover:text-terminal-input"
                onClick={() => onReview('request-changes')}
              >
                Request changes
              </Button>
              <Button
                size="sm"
                className="min-h-10 cursor-pointer transition-colors"
                onClick={() => onReview('approve')}
              >
                Approve preview
              </Button>
            </div>
          </div>
        )}
        {reviewed && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-terminal-border bg-terminal-bar p-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <strong className="block text-sm">
                {state.reviewDecision === 'approve'
                  ? 'Preview approved. The PR can move forward.'
                  : 'Changes requested. The preview stays isolated.'}
              </strong>
              <span className="text-xs text-terminal-muted">
                Close the PR to watch Argo CD remove the environment automatically.
              </span>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="min-h-10 cursor-pointer transition-colors"
              onClick={onClose}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Close PR & clean up
            </Button>
          </div>
        )}
        {cleaning && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-terminal-warning/40 bg-terminal-warning/15 p-3 text-sm">
            <LoaderCircle
              className="size-5 motion-safe:animate-spin text-terminal-warning"
              aria-hidden="true"
            />
            <span>
              <strong>Argo CD is pruning the environment.</strong>{' '}
              <span className="text-terminal-muted">
                All Kubernetes resources disappear in one cleanup.
              </span>
            </span>
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
    setAutomationPhase('running');
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
  const failure = state.activeFailure ? PREVIEW_FAILURES[state.activeFailure] : null;
  const currentScene = SCENES[currentSceneIndex];
  const switchId = useId();
  const startOver = () => {
    startAgain();
    setDeveloperView('list');
  };
  const goal =
    state.status === 'blocked'
      ? 'Fix the failure: pick the repair that matches the error.'
      : scene === 'developer'
        ? developerView === 'list'
          ? 'Open a pull request, then add the preview label to it.'
          : 'Add the preview label to this pull request.'
        : scene === 'webhook'
          ? 'Deliver the webhook and follow the label event to the ApplicationSet controller.'
          : scene === 'ci'
            ? "Run the workflow that builds and pushes this commit's image."
            : scene === 'gitops'
              ? 'Watch Argo CD create and sync the preview environment.'
              : state.status === 'reviewed'
                ? 'Close the pull request and watch the preview get cleaned up.'
                : state.status === 'cleaning'
                  ? 'Argo CD is removing the preview environment.'
                  : 'Open the preview, then approve it or request changes.';
  const announce =
    state.status === 'blocked' && failure
      ? `Failure: ${failure.label}`
      : state.status === 'ready'
        ? 'Preview ready'
        : state.status === 'removed'
          ? 'Preview removed'
          : currentScene.label;

  return (
    <MotionConfig reducedMotion="user">
      <section className="mx-auto w-full max-w-6xl" aria-label="Preview environment simulator">
        <SimFrame>
          <SimBar
            title="Preview Environment Simulator"
            icon={GitBranch}
            lead={
              <ol aria-label="Simulator scenes" className="flex flex-wrap items-center gap-1">
                {SCENES.map((item, index) => {
                  const current = item.id === scene;
                  const done = index < currentSceneIndex || state.status === 'removed';
                  return (
                    <li
                      key={item.id}
                      aria-current={current ? 'step' : undefined}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium',
                        current && 'border-primary bg-primary/10',
                        done && `${SIM_TONE.success.surface} ${SIM_TONE.success.text}`,
                        !current && !done && 'text-muted-foreground'
                      )}
                    >
                      <span className="grid size-5 place-items-center rounded-full border font-mono text-xs">
                        {done ? <Check className="size-3.5" aria-hidden="true" /> : item.number}
                      </span>
                      <span className={cn(!current && 'hidden sm:inline')}>{item.label}</span>
                      <span className="sr-only">
                        {current ? ' (current)' : done ? ' (done)' : ''}
                      </span>
                    </li>
                  );
                })}
              </ol>
            }
            tools={
              <>
                <div
                  title={
                    scene === 'developer'
                      ? 'Toggle a realistic failure scenario'
                      : 'Unavailable while the simulation is running'
                  }
                  className="flex h-10 items-center gap-2 lg:h-8"
                >
                  <Switch
                    id={switchId}
                    checked={practiceFailure}
                    onCheckedChange={setPracticeFailure}
                    disabled={scene !== 'developer'}
                  />
                  <FormLabel htmlFor={switchId} className="text-sm font-normal">
                    Practice a failure
                  </FormLabel>
                </div>
                <SimResetButton onReset={startOver} />
              </>
            }
            progress={{ current: currentSceneIndex + 1, total: SCENES.length }}
            heading={currentScene.label}
            meta={
              practiceFailure ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold',
                    SIM_TONE.warning.surface,
                    SIM_TONE.warning.text
                  )}
                >
                  <TriangleAlert className="size-3.5" aria-hidden="true" />
                  Failure practice on
                </span>
              ) : undefined
            }
            goal={goal}
          >
            <SimHowTo summary="Why it pauses">
              The simulator pauses between systems. In production, the webhook, CI workflow, Argo CD
              auto-sync, and PR comment continue automatically.
            </SimHowTo>
          </SimBar>

          <SimAnnouncer message={announce} />

          {state.status === 'removed' ? (
            <SimComplete
              title="Preview cleaned up"
              summary="Cleanup complete. Cost is back to $0.00/hr. The label started a webhook, a CI build, an Argo CD sync and a URL on the pull request, and closing the PR removed all of it."
              stats={[
                { label: 'Pull request', value: `#${selected.number}` },
                { label: 'Failure practised', value: practiceFailure ? 'Yes' : 'No' },
                {
                  label: 'Review',
                  value: state.reviewDecision === 'approve' ? 'Approved' : 'Changes requested',
                },
              ]}
              actions={
                <Button type="button" variant="outline" onClick={startOver}>
                  Try another pull request
                </Button>
              }
              onPlayAgain={startAgain}
              playAgainLabel="Add preview label again"
            />
          ) : (
            <div className="min-w-0">
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
          )}
        </SimFrame>
      </section>
    </MotionConfig>
  );
}

export default PreviewEnvironmentSimulator;
