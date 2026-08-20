'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  Database,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Globe2,
  LoaderCircle,
  Package,
  RefreshCw,
  ServerCog,
  Trash2,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  CLEANUP_STEPS,
  PREVIEW_FAILURES,
  PREVIEW_STAGES,
  advancePreviewEnvironment,
  applyPreviewRemediation,
  beginPreviewTeardown,
  createPreviewEnvironmentState,
  getGeneratedIntent,
  getPreviewEvidence,
  getPreviewMetrics,
  recordPreviewReview,
  type PreviewEnvironmentConfig,
  type PreviewEnvironmentState,
  type PreviewFailure,
  type PreviewFailureId,
  type PreviewStageId,
} from '@/lib/games/preview-environment-engine';

type PreviewScenarioId = 'api-change' | 'checkout-flow' | 'full-product';
type StoryActor = 'developer' | 'platform';
type StoryPhaseId = 'intent' | 'plan' | 'create' | 'review' | 'remove';
type FlowStatus = 'waiting' | 'current' | 'creating' | 'ready' | 'removing' | 'removed' | 'failed';
type FlowOwner = 'developer' | 'pipeline' | 'argo' | 'cluster';

interface PreviewScenario {
  id: PreviewScenarioId;
  label: string;
  detail: string;
  failure: PreviewFailureId;
  config: Partial<PreviewEnvironmentConfig>;
}

interface StoryPhase {
  id: StoryPhaseId;
  label: string;
  developerTitle: string;
  platformTitle: string;
}

const PREVIEW_SCENARIOS: PreviewScenario[] = [
  {
    id: 'api-change',
    label: 'API change',
    detail: 'One backend service',
    failure: 'missing-secret',
    config: {
      mode: 'single-service',
      services: ['api'],
      dataStrategy: 'synthetic',
      resourceProfile: 'lean',
      reviewerAccess: 'team-sso',
      ttlHours: 4,
    },
  },
  {
    id: 'checkout-flow',
    label: 'Checkout flow',
    detail: 'Web and API together',
    failure: 'branch-mismatch',
    config: {
      mode: 'full-stack',
      services: ['web', 'api'],
      dataStrategy: 'masked-snapshot',
      resourceProfile: 'balanced',
      reviewerAccess: 'team-sso',
      ttlHours: 8,
    },
  },
  {
    id: 'full-product',
    label: 'Full product',
    detail: 'Web, API, and worker',
    failure: 'revision-drift',
    config: {
      mode: 'full-stack',
      services: ['web', 'api', 'worker'],
      dataStrategy: 'masked-snapshot',
      resourceProfile: 'production-like',
      reviewerAccess: 'team-sso',
      ttlHours: 24,
    },
  },
];

const STORY_PHASES: StoryPhase[] = [
  {
    id: 'intent',
    label: 'Open PR',
    developerTitle: 'Ask for a preview',
    platformTitle: 'Notice the pull request',
  },
  {
    id: 'plan',
    label: 'Publish image',
    developerTitle: 'Build and publish the image',
    platformTitle: 'Turn metadata into desired state',
  },
  {
    id: 'create',
    label: 'Deploy',
    developerTitle: 'Wait for the preview URL',
    platformTitle: 'Create an isolated environment',
  },
  {
    id: 'review',
    label: 'Review',
    developerTitle: 'Try the change',
    platformTitle: 'Return running evidence',
  },
  {
    id: 'remove',
    label: 'Clean up',
    developerTitle: 'Close the pull request',
    platformTitle: 'Remove every temporary resource',
  },
];

const FLOW_OWNERS: Record<
  FlowOwner,
  { label: string; dotClass: string; textClass: string; badgeClass: string }
> = {
  developer: {
    label: 'Developer',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-700 dark:text-blue-300',
    badgeClass: 'border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300',
  },
  pipeline: {
    label: 'CI pipeline',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700 dark:text-amber-300',
    badgeClass: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  },
  argo: {
    label: 'Argo CD · auto',
    dotClass: 'bg-violet-500',
    textClass: 'text-violet-700 dark:text-violet-300',
    badgeClass: 'border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300',
  },
  cluster: {
    label: 'K8s · auto',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    badgeClass: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
  },
};

function scenarioState(scenarioId: PreviewScenarioId, addProblem: boolean) {
  const scenario = PREVIEW_SCENARIOS.find((item) => item.id === scenarioId) ?? PREVIEW_SCENARIOS[1];
  return createPreviewEnvironmentState({
    ...scenario.config,
    injectedFailure: addProblem ? scenario.failure : 'none',
    revisionGate: true,
  });
}

function storyPhaseIndex(state: PreviewEnvironmentState): number {
  if (state.status === 'reviewed' || state.status === 'cleaning' || state.status === 'removed') {
    return 4;
  }
  if (state.status === 'ready') return 3;

  const stage = PREVIEW_STAGES[Math.min(state.stageIndex, PREVIEW_STAGES.length - 1)]?.id;
  if (stage === 'coordinate' || stage === 'reconcile') return 1;
  if (stage === 'provision' || stage === 'expose') return 2;
  if (stage === 'verify') return 3;
  return 0;
}

function activeStageId(state: PreviewEnvironmentState): PreviewStageId {
  return PREVIEW_STAGES[Math.min(state.stageIndex, PREVIEW_STAGES.length - 1)]?.id ?? 'verify';
}

function friendlyStatus(
  state: PreviewEnvironmentState,
  actor: StoryActor,
  storyStarted: boolean
): string {
  if (state.status === 'configured') {
    if (!storyStarted) return 'Add the preview label to begin.';
    return actor === 'developer'
      ? 'The preview label is now attached to PR #184.'
      : 'The pull-request event is moving into the control plane.';
  }
  if (state.status === 'blocked') return 'The unsafe path is paused until you choose a repair.';
  if (state.status === 'ready') return 'The URL now points to the exact running revision.';
  if (state.status === 'reviewed') return 'The review is recorded; close the PR to clean up.';
  if (state.status === 'cleaning')
    return 'Argo CD is deleting the whole preview environment automatically.';
  if (state.status === 'removed') return 'The environment is gone and its cost is back to zero.';

  const stage = activeStageId(state);
  if (stage === 'coordinate') return 'CI builds the change into an immutable container image.';
  if (stage === 'reconcile') {
    return actor === 'developer'
      ? 'Push the image digest so Argo CD can deploy exactly this revision.'
      : 'ApplicationSet turns pull-request metadata into Helm values.';
  }
  if (stage === 'provision') return 'Argo CD creates the namespace and application workloads.';
  if (stage === 'expose') return 'Data, cache, DNS, ingress, and TLS join the environment.';
  return 'Health and the deployed revision travel back to the pull request.';
}

function StoryProgress({ activeIndex, done }: { activeIndex: number; done: boolean }) {
  return (
    <ol className="grid grid-cols-5" aria-label="Preview environment lifecycle">
      {STORY_PHASES.map((phase, index) => {
        const complete = done || index < activeIndex;
        const active = !done && index === activeIndex;
        return (
          <li key={phase.id} className="relative flex flex-col items-center">
            {index > 0 && (
              <span
                className={cn(
                  'absolute right-1/2 top-3 h-0.5 w-full bg-border transition-colors duration-500',
                  (complete || active) && 'bg-emerald-500/60'
                )}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                'relative z-10 grid h-6 w-6 place-items-center rounded-full border bg-background text-[10px] font-semibold transition-all duration-500',
                complete && 'border-emerald-500 bg-emerald-500 text-white',
                active && 'scale-110 border-blue-500 text-blue-600 ring-4 ring-blue-500/10'
              )}
            >
              {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                'mt-1.5 text-center text-[10px] font-medium text-muted-foreground',
                (complete || active) && 'text-foreground'
              )}
            >
              {phase.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function FlowNode({
  icon: Icon,
  label,
  detail,
  status,
  owner,
  tone = 'platform',
  compact = false,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  status: FlowStatus;
  owner: FlowOwner;
  tone?: StoryActor;
  compact?: boolean;
}) {
  const ownerMeta = FLOW_OWNERS[owner];
  const statusLabel: Record<FlowStatus, string> = {
    waiting: 'waiting',
    current: 'your turn',
    creating: 'working',
    ready: 'ready',
    removing: 'removing',
    removed: 'removed',
    failed: 'needs attention',
  };

  return (
    <div
      className={cn(
        'relative flex min-w-0 items-center gap-2.5 rounded-lg border bg-background p-2.5 transition-all duration-500',
        compact && 'p-2',
        status === 'waiting' && 'border-dashed bg-muted/10 text-muted-foreground',
        status === 'current' &&
          (tone === 'developer'
            ? 'border-blue-500/70 bg-blue-500/8 shadow-md shadow-blue-500/10'
            : 'border-violet-500/70 bg-violet-500/8 shadow-md shadow-violet-500/10'),
        status === 'creating' &&
          'border-violet-500/70 bg-violet-500/8 shadow-md shadow-violet-500/10',
        status === 'ready' && 'border-emerald-500/40 bg-emerald-500/5',
        status === 'removing' && 'border-amber-500/60 bg-amber-500/8',
        status === 'removed' && 'scale-[0.97] border-dashed opacity-30',
        status === 'failed' && 'border-red-500/60 bg-red-500/8'
      )}
    >
      <span
        className={cn(
          'relative grid h-8 w-8 shrink-0 place-items-center rounded-md border bg-background',
          status === 'current' && tone === 'developer' && 'border-blue-500/40 text-blue-600',
          status === 'current' && tone === 'platform' && 'border-violet-500/40 text-violet-600',
          status === 'creating' && 'border-violet-500/40 text-violet-600',
          status === 'ready' && 'border-emerald-500/35 text-emerald-600',
          status === 'removing' && 'border-amber-500/35 text-amber-600',
          status === 'failed' && 'border-red-500/35 text-red-600'
        )}
      >
        {status === 'creating' ? (
          <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" />
        ) : status === 'ready' ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : status === 'removing' ? (
          <Trash2 className="h-4 w-4" />
        ) : status === 'failed' ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
        {(status === 'current' || status === 'creating') && (
          <span
            className={cn(
              'absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-background motion-safe:animate-pulse',
              tone === 'developer' ? 'bg-blue-500' : 'bg-violet-500'
            )}
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            'mb-1 flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wide',
            ownerMeta.textClass
          )}
        >
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', ownerMeta.dotClass)} />
          {ownerMeta.label}
        </span>
        <div
          className={cn('flex items-start gap-x-2 gap-y-0.5', compact ? 'flex-col' : 'flex-wrap')}
        >
          <p
            className={cn(
              'min-w-0 break-words text-xs font-semibold leading-snug',
              compact ? 'w-full' : 'flex-1'
            )}
          >
            {label}
          </p>
          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            {statusLabel[status]}
          </span>
        </div>
        <p className="mt-0.5 break-words text-[10px] leading-snug text-muted-foreground">
          {detail}
        </p>
      </div>
    </div>
  );
}

function FlowZone({
  number,
  title,
  active,
  complete,
  children,
}: {
  number: string;
  title: string;
  active: boolean;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-xl border bg-muted/10 p-3 transition-all duration-500',
        active && 'border-blue-500/45 bg-blue-500/[0.03] shadow-lg shadow-blue-500/5',
        complete && !active && 'border-emerald-500/25'
      )}
    >
      <div className="mb-2 flex items-center gap-2 border-b pb-2">
        <span
          className={cn(
            'font-mono text-[10px] font-bold text-blue-500',
            complete && 'text-emerald-500'
          )}
        >
          {number}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        {complete && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />}
      </div>
      {children}
    </section>
  );
}

function FlowArrow({ active }: { active: boolean }) {
  return (
    <div className="relative grid place-items-center py-0.5 lg:px-1 lg:py-0" aria-hidden="true">
      <span
        className={cn(
          'absolute h-full w-px bg-border lg:h-px lg:w-full',
          active && 'bg-blue-500/60'
        )}
      />
      <span
        className={cn(
          'relative grid h-7 w-7 place-items-center rounded-full border bg-background text-muted-foreground transition-all',
          active && 'border-blue-500/50 text-blue-600 shadow-md shadow-blue-500/15'
        )}
      >
        <ArrowDown className="h-4 w-4 lg:hidden" />
        <ArrowRight className="hidden h-4 w-4 lg:block" />
        {active && (
          <span className="absolute inset-0 rounded-full ring-4 ring-blue-500/10 motion-safe:animate-ping" />
        )}
      </span>
    </div>
  );
}

function FailurePanel({
  failure,
  state,
  onFix,
}: {
  failure: PreviewFailure;
  state: PreviewEnvironmentState;
  onFix: (remediationId: string, correct: boolean) => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-center">
      <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-300">
        <AlertTriangle className="h-4 w-4" />
        <p className="text-sm font-semibold">The control path paused</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{failure.summary}</p>
      <p className="mx-auto mt-2 max-w-2xl rounded-md border border-red-500/25 bg-background/70 px-2 py-1.5 font-mono text-[10px] text-red-700 dark:text-red-300">
        {failure.signal}
      </p>
      <p className="mt-2 text-xs font-semibold">Pick the repair that preserves a safe preview:</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {failure.remediationOptions.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant="outline"
            className="h-auto min-h-9 whitespace-normal text-center text-xs"
            onClick={() => onFix(option.id, option.id === failure.correctRemediationId)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {state.failedRemediationAttempts > 0 && (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300">
          That does not repair this signal. {state.lastEvent}
        </p>
      )}
    </div>
  );
}

function ArchitectureFlow({
  state,
  actor,
  storyStarted,
  reviewUrl,
  failure,
  onFix,
}: {
  state: PreviewEnvironmentState;
  actor: StoryActor;
  storyStarted: boolean;
  reviewUrl: string;
  failure: PreviewFailure | null;
  onFix: (remediationId: string, correct: boolean) => void;
}) {
  const stages = state.stageStatuses;
  const cleanupStarted = state.status === 'cleaning' || state.status === 'removed';

  const automaticStatus = (
    stage: PreviewStageId,
    failureIds: PreviewFailureId[] = []
  ): FlowStatus => {
    if (state.activeFailure && failureIds.includes(state.activeFailure)) return 'failed';
    const status = stages[stage];
    if (status === 'failed') return 'failed';
    if (status === 'complete') return 'ready';
    if (status === 'active' || status === 'remediated') return 'creating';
    return 'waiting';
  };

  const cleanupStatus = (): FlowStatus => {
    if (state.status === 'removed') return 'removed';
    if (state.status === 'cleaning') return 'removing';
    return 'ready';
  };

  const prStatus: FlowStatus = !storyStarted ? 'current' : cleanupStarted ? 'removed' : 'ready';

  const automationStatus: FlowStatus =
    state.activeFailure === 'branch-mismatch'
      ? 'failed'
      : stages.intent === 'complete'
        ? 'ready'
        : storyStarted && actor === 'platform'
          ? 'creating'
          : 'waiting';

  const buildStatus: FlowStatus =
    stages.coordinate === 'failed'
      ? 'failed'
      : stages.coordinate === 'complete'
        ? 'ready'
        : stages.coordinate === 'active' || stages.coordinate === 'remediated'
          ? actor === 'developer'
            ? 'current'
            : 'creating'
          : 'waiting';

  const registryStatus: FlowStatus =
    stages.reconcile === 'failed'
      ? 'failed'
      : stages.reconcile === 'complete'
        ? 'ready'
        : stages.reconcile === 'active' || stages.reconcile === 'remediated'
          ? actor === 'developer'
            ? 'current'
            : 'ready'
          : 'waiting';

  const argoStatus: FlowStatus = cleanupStarted
    ? cleanupStatus()
    : stages.reconcile === 'failed'
      ? 'failed'
      : stages.reconcile === 'complete'
        ? 'ready'
        : stages.reconcile === 'active' || stages.reconcile === 'remediated'
          ? actor === 'platform'
            ? 'creating'
            : 'waiting'
          : 'waiting';

  const namespaceStatus = cleanupStarted
    ? cleanupStatus()
    : automaticStatus('provision', ['quota-exceeded']);
  const workloadsStatus = cleanupStarted
    ? cleanupStatus()
    : automaticStatus('provision', [
        'quota-exceeded',
        'missing-secret',
        'readiness-failure',
        'revision-drift',
      ]);
  const dataStatus = cleanupStarted
    ? cleanupStatus()
    : automaticStatus('expose', ['readiness-failure']);
  const urlStatus = cleanupStarted ? cleanupStatus() : automaticStatus('expose', ['dns-pending']);

  const returnStatus: FlowStatus =
    state.status === 'cleaning'
      ? 'creating'
      : state.status === 'removed'
        ? 'removed'
        : stages.verify === 'failed'
          ? 'failed'
          : stages.verify === 'complete' || state.status === 'ready'
            ? 'ready'
            : stages.verify === 'active' || stages.verify === 'remediated'
              ? 'creating'
              : 'waiting';

  const developerActive =
    actor === 'developer' &&
    (state.status === 'configured' ||
      activeStageId(state) === 'coordinate' ||
      activeStageId(state) === 'reconcile');
  const controlActive =
    actor === 'platform' &&
    (state.status === 'configured' ||
      activeStageId(state) === 'reconcile' ||
      state.status === 'blocked');
  const environmentActive =
    state.status === 'ready' ||
    state.status === 'reviewed' ||
    state.status === 'cleaning' ||
    ['provision', 'expose', 'verify'].includes(activeStageId(state));

  const cleanupMessage =
    state.status === 'cleaning'
      ? 'Argo CD is pruning the namespace, workloads, data, and URL together.'
      : state.status === 'removed'
        ? 'The whole preview is gone. Cost is $0.00/hr.'
        : state.status === 'reviewed'
          ? 'Close the pull request to trigger automatic deletion.'
          : 'Close the PR, remove the label, or let the TTL expire.';

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-slate-400/40 bg-background shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-blue-500">
            Desired state → running evidence
          </p>
          <p className="break-words text-sm font-semibold leading-snug">
            One control path from pull request to preview URL
          </p>
        </div>
        <Badge
          variant="outline"
          className="gap-1.5 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
        >
          <GitCommit className="h-3 w-3" /> sha-8f3c2a1 retained
        </Badge>
      </div>

      <div className="p-3">
        <div className="grid gap-2 lg:grid-cols-[0.9fr_auto_1fr_auto_1.35fr] lg:items-stretch">
          <FlowZone
            number="01"
            title="Developer intent"
            active={developerActive}
            complete={stages.reconcile === 'complete' || environmentActive}
          >
            <div className="space-y-2">
              <FlowNode
                icon={GitPullRequest}
                label="PR #184 + preview label"
                detail={storyStarted ? 'checkout-v2 → main' : 'Add the label to request a preview'}
                status={prStatus}
                owner="developer"
                tone="developer"
              />
              <div className="grid grid-cols-1 gap-2 2xl:grid-cols-2">
                <FlowNode
                  icon={Code2}
                  label="Build image"
                  detail="CI packages the change"
                  status={buildStatus}
                  owner="pipeline"
                  tone="developer"
                  compact
                />
                <FlowNode
                  icon={Package}
                  label="Push registry"
                  detail="checkout:sha-8f3c2a1"
                  status={registryStatus}
                  owner="pipeline"
                  tone="developer"
                  compact
                />
              </div>
            </div>
          </FlowZone>

          <FlowArrow active={automationStatus === 'creating'} />

          <FlowZone
            number="02"
            title="GitOps control plane"
            active={controlActive}
            complete={stages.reconcile === 'complete' || environmentActive}
          >
            <div className="space-y-2">
              <FlowNode
                icon={GitBranch}
                label="Automation repository"
                detail="Automatically detects the labeled PR"
                status={automationStatus}
                owner="argo"
              />
              <div className="flex justify-center" aria-hidden="true">
                <ArrowDown className="h-4 w-4 text-muted-foreground" />
              </div>
              <FlowNode
                icon={Workflow}
                label="Argo CD ApplicationSet"
                detail="Commit and image digest become Helm values"
                status={argoStatus}
                owner="argo"
              />
            </div>
          </FlowZone>

          <FlowArrow active={argoStatus === 'creating'} />

          <FlowZone
            number="03"
            title="Ephemeral environment"
            active={environmentActive}
            complete={
              state.status === 'ready' || state.status === 'reviewed' || state.status === 'removed'
            }
          >
            <div className="space-y-2">
              <FlowNode
                icon={Boxes}
                label="Kubernetes namespace"
                detail="preview-pr-184 · isolated boundary"
                status={namespaceStatus}
                owner="cluster"
              />
              <div
                className={cn(
                  'grid gap-1.5',
                  state.config.services.length === 1 && 'mx-auto w-full max-w-52 grid-cols-1',
                  state.config.services.length === 2 && 'grid-cols-2',
                  state.config.services.length >= 3 && 'grid-cols-3'
                )}
              >
                {state.config.services.map((service) => (
                  <FlowNode
                    key={service}
                    icon={ServerCog}
                    label={service === 'worker' ? 'Worker' : service.toUpperCase()}
                    detail="application"
                    status={workloadsStatus}
                    owner="cluster"
                    compact
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <FlowNode
                  icon={Database}
                  label={state.config.dataStrategy === 'synthetic' ? 'Synthetic DB' : 'DB snapshot'}
                  detail="isolated data"
                  status={dataStatus}
                  owner="cluster"
                  compact
                />
                <FlowNode
                  icon={Database}
                  label="Redis"
                  detail="isolated cache"
                  status={dataStatus}
                  owner="cluster"
                  compact
                />
              </div>
              <FlowNode
                icon={Globe2}
                label="Review URL"
                detail={urlStatus === 'ready' ? reviewUrl : 'DNS · ingress · TLS · revision'}
                status={urlStatus}
                owner="cluster"
              />
            </div>
          </FlowZone>
        </div>

        {failure && <FailurePanel failure={failure} state={state} onFix={onFix} />}

        <div
          className={cn(
            'mt-3 flex items-center justify-center gap-2 border-y border-dashed border-blue-500/30 bg-blue-500/[0.03] px-3 py-2 text-center text-xs text-muted-foreground transition-colors',
            returnStatus === 'creating' &&
              'border-blue-500/60 bg-blue-500/8 text-blue-700 dark:text-blue-300',
            returnStatus === 'ready' &&
              'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
            returnStatus === 'failed' && 'border-red-500/40 text-red-700 dark:text-red-300'
          )}
        >
          {returnStatus === 'creating' ? (
            <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" />
          ) : returnStatus === 'ready' || returnStatus === 'removed' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span>
            <strong className="font-semibold text-foreground">
              {state.status === 'cleaning'
                ? 'Argo CD reports cleanup progress to PR #184.'
                : state.status === 'removed'
                  ? 'Cleanup confirmed on PR #184.'
                  : 'Running status returns to PR #184.'}
            </strong>{' '}
            {state.status === 'cleaning'
              ? 'The entire preview is being pruned automatically.'
              : state.status === 'removed'
                ? 'No preview resources remain.'
                : returnStatus === 'ready'
                  ? 'The URL and deployed digest match the change.'
                  : 'Health and the deployed revision will appear here.'}
          </span>
        </div>

        <div
          className={cn(
            'mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-muted/35 px-3 py-2 text-xs text-muted-foreground',
            state.status === 'cleaning' && 'bg-amber-500/8 text-amber-800 dark:text-amber-300',
            state.status === 'removed' && 'bg-emerald-500/8 text-emerald-700 dark:text-emerald-300'
          )}
        >
          {state.status === 'cleaning' ? (
            <LoaderCircle className="h-4 w-4 shrink-0 motion-safe:animate-spin" />
          ) : state.status === 'removed' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <Trash2 className="h-4 w-4 shrink-0" />
          )}
          <strong className="font-semibold text-foreground">
            Automatic cleanup removes the preview as one unit.
          </strong>
          <span>{cleanupMessage}</span>
        </div>
      </div>
    </div>
  );
}

export default function PreviewEnvironmentSimulator() {
  const [scenarioId, setScenarioId] = useState<PreviewScenarioId>('checkout-flow');
  const [addProblem, setAddProblem] = useState(false);
  const [state, setState] = useState(() => scenarioState('checkout-flow', false));
  const [storyStarted, setStoryStarted] = useState(false);
  const [actorBeat, setActorBeat] = useState<StoryActor>('developer');

  useEffect(() => {
    if (state.status !== 'cleaning') return;

    const cleanupTimer = window.setTimeout(() => {
      setState((current) => {
        let next = current;
        for (
          let index = 0;
          index <= CLEANUP_STEPS.length && next.status === 'cleaning';
          index += 1
        ) {
          next = advancePreviewEnvironment(next);
        }
        return next;
      });
    }, 2000);

    return () => window.clearTimeout(cleanupTimer);
  }, [state.status]);

  const metrics = useMemo(() => getPreviewMetrics(state.config), [state.config]);
  const evidence = useMemo(() => getPreviewEvidence(state.config), [state.config]);
  const generatedIntent = useMemo(() => getGeneratedIntent(state.config), [state.config]);
  const failure = state.activeFailure ? PREVIEW_FAILURES[state.activeFailure] : null;
  const canConfigure =
    state.status === 'removed' || (state.status === 'configured' && !storyStarted);
  const phaseIndex = storyPhaseIndex(state);
  const phase = STORY_PHASES[phaseIndex];
  const stageId = activeStageId(state);
  const selectedScenario =
    PREVIEW_SCENARIOS.find((scenario) => scenario.id === scenarioId) ?? PREVIEW_SCENARIOS[1];

  const actor: StoryActor =
    state.status === 'blocked' || state.status === 'cleaning' || state.status === 'removed'
      ? 'platform'
      : state.status === 'configured'
        ? storyStarted
          ? actorBeat
          : 'developer'
        : state.status === 'ready' || state.status === 'reviewed'
          ? 'developer'
          : actorBeat;
  const activeOwner: FlowOwner =
    actor === 'developer' &&
    state.status === 'running' &&
    (stageId === 'coordinate' || stageId === 'reconcile')
      ? 'pipeline'
      : actor === 'developer'
        ? 'developer'
        : 'argo';
  const activeOwnerMeta = FLOW_OWNERS[activeOwner];

  const resetWith = (nextScenario: PreviewScenarioId, nextAddProblem: boolean) => {
    setScenarioId(nextScenario);
    setAddProblem(nextAddProblem);
    setState(scenarioState(nextScenario, nextAddProblem));
    setActorBeat('developer');
    setStoryStarted(false);
  };

  const start = () => {
    if (state.status === 'removed') setState(scenarioState(scenarioId, addProblem));
    setActorBeat('developer');
    setStoryStarted(true);
  };

  const nextScene = () => {
    if (state.status === 'configured') {
      if (actor === 'developer') {
        setActorBeat('platform');
      } else {
        setState((current) => advancePreviewEnvironment(current));
        setActorBeat('developer');
      }
      return;
    }

    if (actor === 'developer' && stageId === 'coordinate') {
      setState((current) => advancePreviewEnvironment(current));
      setActorBeat('developer');
      return;
    }

    if (actor === 'developer' && stageId === 'reconcile') {
      setActorBeat('platform');
      return;
    }

    setState((current) => advancePreviewEnvironment(current));
    setActorBeat('platform');
  };

  const applyFix = (remediationId: string, correct: boolean) => {
    setState((current) => applyPreviewRemediation(current, remediationId));
    if (correct) setActorBeat(stageId === 'coordinate' ? 'developer' : 'platform');
  };

  const sharedDecision = state.status === 'ready' || state.status === 'reviewed';
  const nextButtonLabel =
    state.status === 'configured'
      ? actor === 'developer'
        ? 'Send PR event'
        : 'Next: build the image'
      : actor === 'developer'
        ? stageId === 'coordinate'
          ? 'Next: push the image'
          : 'Hand image to Argo CD'
        : stageId === 'reconcile'
          ? 'Next: create the namespace'
          : stageId === 'provision'
            ? 'Next: add data & URL'
            : stageId === 'expose'
              ? 'Next: return evidence'
              : 'Next: share the preview';

  return (
    <div className="overflow-hidden rounded-xl border bg-muted/15 shadow-sm">
      <div className="border-b bg-background/90 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-blue-500/30 text-blue-700 dark:text-blue-300"
              >
                PR #184
              </Badge>
              <span className="text-xs text-muted-foreground">checkout-v2</span>
            </div>
            <h2 className="mt-2 text-xl font-semibold">
              Turn a pull request into a real environment
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Follow one control path from developer intent to a live URL—and back to cleanup.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" /> about {metrics.provisionMinutes} min
            </span>
            <span>·</span>
            <span>
              {state.status === 'removed' ? '$0.00' : `$${metrics.hourlyCost.toFixed(2)}`}/hr
            </span>
            <span>·</span>
            <span>TTL {state.config.ttlHours}h</span>
          </div>
        </div>

        <div className="mt-3 grid gap-3 rounded-xl border bg-muted/25 p-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <label className="block min-w-0">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Example
            </span>
            <select
              value={scenarioId}
              disabled={!canConfigure}
              onChange={(event) => resetWith(event.target.value as PreviewScenarioId, addProblem)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm font-medium outline-none transition-colors focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {PREVIEW_SCENARIOS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-background/70 px-3 py-2">
            <Switch
              id="preview-problem-mode"
              checked={addProblem}
              disabled={!canConfigure}
              onCheckedChange={(checked) => resetWith(scenarioId, checked)}
            />
            <label htmlFor="preview-problem-mode" className="min-w-0 cursor-pointer">
              <span className="block text-xs font-semibold">Add a problem to solve</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {addProblem
                  ? 'The control path will pause once for a safe repair'
                  : `Optional · ${selectedScenario.detail}`}
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="p-3">
        <StoryProgress activeIndex={phaseIndex} done={state.status === 'removed'} />

        <div className="my-2 flex flex-col items-center justify-center gap-1 text-center sm:flex-row sm:gap-3">
          <Badge
            variant="outline"
            className={cn('gap-1.5 text-[10px]', activeOwnerMeta.badgeClass)}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', activeOwnerMeta.dotClass)} />
            Active · {activeOwnerMeta.label}
          </Badge>
          <div aria-live="polite" className="sm:flex sm:items-center sm:gap-2 sm:text-left">
            <p className="text-sm font-semibold">
              {actor === 'developer' ? phase.developerTitle : phase.platformTitle}
            </p>
            <p className="text-xs text-muted-foreground sm:before:mr-2 sm:before:content-['·']">
              {friendlyStatus(state, actor, storyStarted)}
            </p>
          </div>
        </div>

        <ArchitectureFlow
          state={state}
          actor={actor}
          storyStarted={storyStarted}
          reviewUrl={evidence.reviewUrl}
          failure={failure}
          onFix={applyFix}
        />

        <div
          className={cn(
            'mt-2 flex min-h-10 gap-2 rounded-xl border bg-background/75 p-2',
            sharedDecision
              ? 'flex-col items-center justify-center text-center'
              : 'flex-wrap items-center justify-center sm:justify-between'
          )}
        >
          {!sharedDecision && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {state.status === 'removed' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : state.status === 'cleaning' ? (
                <LoaderCircle className="h-4 w-4 text-amber-500 motion-safe:animate-spin" />
              ) : state.status === 'blocked' ? (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              <span>
                {state.status === 'cleaning'
                  ? 'Argo CD is removing the entire preview automatically. No more clicks needed.'
                  : state.status === 'running' || (state.status === 'configured' && storyStarted)
                    ? 'Find the glowing step in the map, then continue.'
                    : friendlyStatus(state, actor, storyStarted)}
              </span>
            </div>
          )}

          <div className="flex w-full flex-wrap justify-center gap-2 sm:w-auto">
            {state.status === 'configured' && !storyStarted && (
              <Button type="button" size="sm" onClick={start}>
                <Zap className="h-4 w-4" /> Add preview label
              </Button>
            )}

            {(state.status === 'running' || (state.status === 'configured' && storyStarted)) && (
              <>
                <Button type="button" size="sm" onClick={nextScene}>
                  {nextButtonLabel}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => resetWith(scenarioId, addProblem)}
                >
                  <RefreshCw className="h-4 w-4" /> Start over
                </Button>
              </>
            )}

            {state.status === 'blocked' && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => resetWith(scenarioId, addProblem)}
              >
                <RefreshCw className="h-4 w-4" /> Start over
              </Button>
            )}

            {state.status === 'ready' && (
              <>
                <p className="w-full text-sm font-semibold">What did you find at the review URL?</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setState((current) => recordPreviewReview(current, 'approve'))}
                >
                  <Check className="h-4 w-4" /> Looks good
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setState((current) => recordPreviewReview(current, 'request-changes'))
                  }
                >
                  <X className="h-4 w-4" /> Needs work
                </Button>
              </>
            )}

            {state.status === 'reviewed' && (
              <>
                <p className="w-full text-sm font-semibold">The review is done.</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setState((current) => beginPreviewTeardown(current, 'pr-closed'));
                    setActorBeat('platform');
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Close PR &amp; trigger automatic cleanup
                </Button>
              </>
            )}

            {state.status === 'removed' && (
              <Button type="button" size="sm" onClick={start}>
                <RefreshCw className="h-4 w-4" /> Watch again
              </Button>
            )}
          </div>
        </div>

        <details className="group mt-4 border-t pt-4">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <Code2 className="h-4 w-4" />
            Inspect the generated evidence
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border bg-background/70 p-3">
              <p className="text-xs font-semibold">Preview request</p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200">
                {generatedIntent}
              </pre>
            </div>
            <div className="rounded-lg border bg-background/70 p-3">
              <p className="text-xs font-semibold">Evidence returned to PR #184</p>
              <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Private URL</dt>
                  <dd className="mt-0.5 break-all font-mono">{evidence.reviewUrl}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Running commit</dt>
                  <dd className="mt-0.5 font-mono">{evidence.commit}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Safe data</dt>
                  <dd className="mt-0.5">{evidence.dataSource}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Automatic expiry</dt>
                  <dd className="mt-0.5">{evidence.expiresIn}</dd>
                </div>
              </dl>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
