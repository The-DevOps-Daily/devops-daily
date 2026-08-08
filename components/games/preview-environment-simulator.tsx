'use client';

import { useMemo, useState } from 'react';
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
  GitMerge,
  GitPullRequest,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  Network,
  Package,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  UserCheck,
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
    label: 'Plan',
    developerTitle: 'Build and publish the image',
    platformTitle: 'Build the desired state',
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
    platformTitle: 'Prove the right code is healthy',
  },
  {
    id: 'remove',
    label: 'Clean up',
    developerTitle: 'Close the pull request',
    platformTitle: 'Remove every temporary resource',
  },
];

type ResourceStatus = 'waiting' | 'creating' | 'ready' | 'removed' | 'failed';

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
    return actor === 'developer'
      ? storyStarted
        ? 'The preview label is attached to PR #184.'
        : 'Add the preview label to begin.'
      : 'The preview request reaches Argo CD.';
  }
  if (state.status === 'blocked') return 'Argo paused before an unsafe preview could be shared.';
  if (state.status === 'ready') return 'The temporary app is ready for a human decision.';
  if (state.status === 'reviewed') return 'The review is recorded. One clean-up step remains.';
  if (state.status === 'cleaning') {
    const step = CLEANUP_STEPS[state.cleanupIndex];
    return step ? `${step.label}…` : 'Confirming the environment is empty…';
  }
  if (state.status === 'removed') return 'The preview is gone and its cost is back to zero.';

  return actor === 'developer'
    ? 'What the developer sees at this moment.'
    : 'How Argo CD responds behind the scenes.';
}

function resourceStatus(
  state: PreviewEnvironmentState,
  stage: PreviewStageId,
  removed: boolean,
  failureIds: PreviewFailureId[] = []
): ResourceStatus {
  if (removed) return 'removed';
  if (state.activeFailure && failureIds.includes(state.activeFailure)) return 'failed';
  const status = state.stageStatuses[stage];
  if (status === 'pending') return 'waiting';
  if (status === 'active' || status === 'remediated') return 'creating';
  if (status === 'failed') return 'failed';
  return 'ready';
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

function ResourceNode({
  icon: Icon,
  label,
  status,
}: {
  icon: LucideIcon;
  label: string;
  status: ResourceStatus;
}) {
  const statusLabel: Record<ResourceStatus, string> = {
    waiting: 'waiting',
    creating: 'creating',
    ready: 'ready',
    removed: 'removed',
    failed: 'blocked',
  };

  return (
    <div
      className={cn(
        'flex min-h-16 flex-col items-center justify-center rounded-xl border bg-background/85 p-2 text-center transition-all duration-700',
        status === 'waiting' && 'translate-y-2 border-dashed opacity-55',
        status === 'creating' &&
          'scale-[1.03] border-blue-500/60 bg-blue-500/8 shadow-lg shadow-blue-500/10',
        status === 'ready' && 'border-emerald-500/40 bg-emerald-500/5',
        status === 'removed' && 'scale-90 border-dashed opacity-20',
        status === 'failed' && 'border-red-500/60 bg-red-500/8 text-red-600'
      )}
    >
      {status === 'creating' ? (
        <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" />
      ) : status === 'ready' ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : status === 'failed' ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      <p className="mt-1 text-xs font-semibold">{label}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {statusLabel[status]}
      </p>
    </div>
  );
}

function DeveloperScene({
  phase,
  state,
  reviewUrl,
  storyStarted,
  active,
}: {
  phase: StoryPhase;
  state: PreviewEnvironmentState;
  reviewUrl: string;
  storyStarted: boolean;
  active: boolean;
}) {
  if (phase.id === 'intent') {
    return (
      <div className="mx-auto grid w-full max-w-4xl grid-cols-[1.35fr_0.65fr] items-center gap-3 sm:gap-5">
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <GitPullRequest className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold">Checkout v2</span>
            <Badge variant="outline" className="ml-auto text-[10px]">
              Open
            </Badge>
          </div>
          <div className="space-y-1.5 p-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" /> checkout-v2 → main
            </div>
            <div className="rounded-lg border bg-muted/25 p-2">
              <div className="h-2 w-3/4 rounded bg-emerald-500/35" />
              <div className="mt-1.5 h-2 w-1/2 rounded bg-emerald-500/25" />
              <div className="mt-1.5 h-2 w-2/3 rounded bg-red-500/20" />
              <div className="mt-1.5 h-2 w-5/6 rounded bg-emerald-500/20" />
            </div>
          </div>
        </div>
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all duration-700',
            storyStarted
              ? 'border-blue-500/40 bg-blue-500/8 shadow-lg shadow-blue-500/10'
              : 'border-dashed bg-background/60 text-muted-foreground'
          )}
        >
          <span className="relative grid h-10 w-10 place-items-center rounded-full border border-blue-500/40 bg-background text-blue-600">
            <Zap className="h-5 w-5" />
            {storyStarted && (
              <span className="absolute inset-0 rounded-full ring-4 ring-blue-500/10 motion-safe:animate-ping" />
            )}
          </span>
          <p className="mt-2 text-sm font-semibold">preview</p>
          <p className="text-xs text-muted-foreground">
            {storyStarted ? 'Label added' : 'Ready to add'}
          </p>
        </div>
      </div>
    );
  }

  if (phase.id === 'plan') {
    const developerStatus = (stage: 'coordinate' | 'reconcile'): ResourceStatus => {
      const status = state.stageStatuses[stage];
      if (status === 'failed' || status === 'complete' || status === 'remediated') return 'ready';
      if (status === 'pending') return 'waiting';
      return active ? 'creating' : 'ready';
    };

    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <ResourceNode
            icon={Code2}
            label="Build container image"
            status={developerStatus('coordinate')}
          />
          <ArrowRight className="mx-auto h-5 w-5 text-blue-500" />
          <ResourceNode
            icon={Package}
            label="Push to registry"
            status={developerStatus('reconcile')}
          />
        </div>
        <div className="mx-auto mt-3 flex w-fit max-w-full items-center gap-2 rounded-full border bg-background px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
          <GitCommit className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">registry.acme.dev/checkout:sha-8f3c2a1</span>
        </div>
      </div>
    );
  }

  if (phase.id === 'create') {
    const linksReady = state.stageStatuses.expose === 'complete';
    return (
      <div className="mx-auto grid w-full max-w-4xl gap-2 sm:grid-cols-[0.7fr_1.3fr] sm:items-stretch">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/5 p-3 sm:flex-col sm:justify-center sm:text-center">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/12 text-emerald-600">
            <Package className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">Image available to Argo CD</p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">
              checkout@sha256:8f3c2a1
            </p>
          </div>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        </div>
        <div className="rounded-xl border bg-background p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-500/12 text-violet-600">
              <Workflow className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Atomsized preview bot</p>
                <span className="text-[10px] text-muted-foreground">just now</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {linksReady
                  ? 'Your isolated preview is ready.'
                  : 'Waiting while Argo CD creates your isolated preview.'}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {['Web preview', 'API preview'].map((label, index) => (
                  <div
                    key={label}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-2 transition-all duration-700',
                      linksReady
                        ? 'border-emerald-500/35 bg-emerald-500/5'
                        : 'border-dashed opacity-45'
                    )}
                  >
                    {linksReady ? (
                      <Globe2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground">
                        {linksReady
                          ? index === 0
                            ? reviewUrl
                            : 'api-pr-184.preview.acme.dev'
                          : 'Generating secure domain…'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase.id === 'review') {
    const previewReady = state.stageStatuses.verify === 'complete' || state.status === 'ready';

    if (!previewReady) {
      return (
        <div className="mx-auto flex w-full max-w-lg flex-col items-center rounded-2xl border border-dashed bg-background/55 p-3 text-center text-muted-foreground">
          <span className="grid h-10 w-10 place-items-center rounded-full border bg-background">
            <Globe2 className="h-5 w-5" />
          </span>
          <p className="mt-2 text-sm font-semibold text-foreground">Preview URL not shared yet</p>
          <p className="mt-1 text-xs">Argo CD is checking health and the deployed image digest.</p>
        </div>
      );
    }

    return (
      <div className="mx-auto grid w-full max-w-4xl grid-cols-[1.4fr_0.6fr] gap-3 sm:gap-4">
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
            <LockKeyhole className="h-3.5 w-3.5 text-emerald-500" />
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {reviewUrl}
            </span>
          </div>
          <div className="grid min-h-32 place-items-center bg-gradient-to-br from-blue-500/8 to-violet-500/8 p-2">
            <div className="w-full max-w-sm rounded-xl border bg-background p-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Acme Checkout</span>
                <ShoppingCart className="h-4 w-4" />
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/45 p-2">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500/25 to-violet-500/25" />
                <div className="flex-1">
                  <div className="h-2.5 w-2/3 rounded bg-foreground/70" />
                  <div className="mt-2 h-2 w-1/3 rounded bg-muted-foreground/35" />
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="mt-2 h-7 rounded-lg bg-blue-500/80" />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border bg-background p-3 text-center">
          <ShieldCheck className="h-8 w-8 text-emerald-500" />
          <p className="mt-2 font-semibold">Safe to explore</p>
          <p className="mt-1 text-xs text-muted-foreground">Production is untouched</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center rounded-xl border bg-background p-4 text-center shadow-sm">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
        {state.status === 'reviewed' ? (
          <GitMerge className="h-7 w-7" />
        ) : (
          <Check className="h-7 w-7" />
        )}
      </span>
      <p className="mt-2 text-base font-semibold">
        {state.status === 'reviewed' ? 'Review complete' : 'Pull request closed'}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">The preview can now disappear.</p>
    </div>
  );
}

function FailureScene({
  failure,
  state,
  onFix,
}: {
  failure: PreviewFailure;
  state: PreviewEnvironmentState;
  onFix: (remediationId: string, correct: boolean) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl text-center">
      <span className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-red-500/40 bg-red-500/10 text-red-500">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <p className="mt-2 text-base font-semibold">Deployment paused</p>
      <p className="mt-1 text-sm text-muted-foreground">{failure.summary}</p>
      <div className="mx-auto mt-2 max-w-2xl overflow-x-auto rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 font-mono text-xs text-red-700 dark:text-red-300">
        {failure.signal}
      </div>
      <p className="mt-3 text-sm font-semibold">Which fix should Argo apply?</p>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        {failure.remediationOptions.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant="outline"
            className="h-auto min-h-12 justify-center whitespace-normal text-center"
            onClick={() => onFix(option.id, option.id === failure.correctRemediationId)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {state.failedRemediationAttempts > 0 && (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300">
          That does not repair this signal. {state.lastEvent}
        </p>
      )}
    </div>
  );
}

function ArgoScene({
  phase,
  state,
  failure,
  onFix,
  active,
  storyStarted,
}: {
  phase: StoryPhase;
  state: PreviewEnvironmentState;
  failure: PreviewFailure | null;
  onFix: (remediationId: string, correct: boolean) => void;
  active: boolean;
  storyStarted: boolean;
}) {
  if (failure) return <FailureScene failure={failure} state={state} onFix={onFix} />;

  const argoStatus = (status: ResourceStatus): ResourceStatus =>
    !active && status === 'creating' ? 'waiting' : status;

  if (phase.id === 'intent') {
    if (!active) {
      return (
        <div className="mx-auto flex w-full max-w-lg flex-col items-center rounded-2xl border border-dashed bg-background/55 p-3 text-center text-muted-foreground">
          <span className="grid h-10 w-10 place-items-center rounded-full border bg-background">
            <Clock3 className="h-5 w-5" />
          </span>
          <p className="mt-2 text-sm font-semibold text-foreground">No Argo CD action yet</p>
          <p className="mt-1 max-w-sm text-xs">
            {storyStarted
              ? 'The preview label is attached. Argo CD is waiting for the pull-request event.'
              : 'Argo CD waits until the developer adds the preview label.'}
          </p>
        </div>
      );
    }

    return (
      <div className="mx-auto grid w-full max-w-4xl grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 sm:gap-4">
        {[
          { icon: GitPullRequest, label: 'PR #184', detail: 'preview label' },
          { icon: Zap, label: 'Webhook', detail: 'event received' },
          { icon: Workflow, label: 'ApplicationSet', detail: 'generator matched' },
        ].map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="contents">
              <div className="flex min-w-0 flex-col items-center rounded-xl border bg-background p-2 text-center shadow-sm sm:p-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-violet-500/10 text-violet-600 sm:h-10 sm:w-10">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-2 text-xs font-semibold sm:text-sm">{item.label}</p>
                <p className="text-[10px] text-muted-foreground sm:text-xs">{item.detail}</p>
              </div>
              {index < 2 && (
                <div className="relative h-px w-4 bg-border sm:w-16">
                  <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500 motion-safe:animate-ping" />
                  <ArrowRight className="absolute -right-1.5 top-1/2 hidden h-3 w-3 -translate-y-1/2 text-violet-500 sm:block" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (phase.id === 'plan') {
    const coordinateStatus = state.stageStatuses.coordinate;
    const reconcileStatus = state.stageStatuses.reconcile;
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 sm:gap-3">
          <ResourceNode icon={GitBranch} label="PR generator" status="ready" />
          <ArrowRight className="mx-auto h-5 w-5 text-muted-foreground" />
          <ResourceNode
            icon={Package}
            label="Helm values"
            status={argoStatus(
              coordinateStatus === 'failed'
                ? 'failed'
                : coordinateStatus === 'complete'
                  ? 'ready'
                  : 'creating'
            )}
          />
          <ArrowRight className="mx-auto h-5 w-5 text-muted-foreground" />
          <ResourceNode
            icon={Workflow}
            label="Preview app"
            status={argoStatus(
              reconcileStatus === 'failed'
                ? 'failed'
                : reconcileStatus === 'complete'
                  ? 'ready'
                  : reconcileStatus === 'pending'
                    ? 'waiting'
                    : 'creating'
            )}
          />
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5 font-mono text-[10px] text-muted-foreground sm:gap-2">
          <span className="rounded border bg-background px-2 py-1">branch: checkout-v2</span>
          <span className="rounded border bg-background px-2 py-1">namespace: preview-pr-184</span>
          <span className="rounded border bg-background px-2 py-1">
            ttl: {state.config.ttlHours}h
          </span>
        </div>
      </div>
    );
  }

  if (phase.id === 'create') {
    const reviewUrlRemoved = state.cleanupStatuses['review-url'] === 'complete';
    const workloadsRemoved = state.cleanupStatuses.workloads === 'complete';
    const dependenciesRemoved = state.cleanupStatuses.dependencies === 'complete';
    const namespaceRemoved = state.cleanupStatuses.namespace === 'complete';
    return (
      <div className="mx-auto w-full max-w-5xl rounded-2xl border-2 border-dashed border-violet-500/35 bg-violet-500/5 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-violet-500" />
            <span className="font-mono text-xs font-semibold">namespace / preview-pr-184</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            isolated
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
          <ResourceNode
            icon={Boxes}
            label="Namespace"
            status={argoStatus(
              resourceStatus(state, 'provision', namespaceRemoved, ['quota-exceeded'])
            )}
          />
          <ResourceNode
            icon={ServerCog}
            label={`${state.config.services.length} app pods`}
            status={argoStatus(
              resourceStatus(state, 'provision', workloadsRemoved, [
                'quota-exceeded',
                'missing-secret',
                'readiness-failure',
                'revision-drift',
              ])
            )}
          />
          <ResourceNode
            icon={Network}
            label="Network"
            status={argoStatus(resourceStatus(state, 'provision', namespaceRemoved))}
          />
          <ResourceNode
            icon={Database}
            label="Database"
            status={argoStatus(
              resourceStatus(state, 'expose', dependenciesRemoved, ['readiness-failure'])
            )}
          />
          <ResourceNode
            icon={Database}
            label="Redis"
            status={argoStatus(resourceStatus(state, 'expose', dependenciesRemoved))}
          />
          <ResourceNode
            icon={Globe2}
            label="Domain + TLS"
            status={argoStatus(resourceStatus(state, 'expose', reviewUrlRemoved, ['dns-pending']))}
          />
        </div>
      </div>
    );
  }

  if (phase.id === 'review') {
    const ready = state.stageStatuses.verify === 'complete' || state.status === 'ready';
    return (
      <div className="mx-auto grid w-full max-w-4xl grid-cols-[0.8fr_1.2fr] gap-3 sm:gap-4">
        <div className="flex flex-col items-center justify-center rounded-xl border bg-background p-3 text-center">
          {ready ? (
            <CheckCircle2 className="h-9 w-9 text-emerald-500" />
          ) : (
            <LoaderCircle className="h-9 w-9 text-blue-500 motion-safe:animate-spin" />
          )}
          <p className="mt-2 text-base font-semibold">
            {ready ? 'Healthy & Synced' : 'Verifying…'}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">sha-8f3c2a1</p>
        </div>
        <div className="rounded-xl border bg-background p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">preview-pr-184</p>
            <Badge
              variant="outline"
              className={cn(ready && 'border-emerald-500/40 text-emerald-600')}
            >
              {ready ? 'Synced' : 'Progressing'}
            </Badge>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1 sm:gap-4">
            {[Globe2, ServerCog, Database].map((Icon, index) => (
              <div key={index} className="contents">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-500/35 bg-emerald-500/5 sm:h-10 sm:w-10">
                  <Icon className="h-5 w-5" />
                </span>
                {index < 2 && <ArrowRight className="h-4 w-4 text-emerald-500" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const cleanupStatus = (stepId: (typeof CLEANUP_STEPS)[number]['id']): ResourceStatus => {
    const status = state.cleanupStatuses[stepId];
    if (status === 'complete' || state.status === 'removed') return 'removed';
    if (status === 'active') return 'creating';
    return 'ready';
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="rounded-2xl border-2 border-dashed p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-xs font-semibold">namespace / preview-pr-184</p>
          <Badge variant="outline">{state.status === 'removed' ? '$0.00/hr' : 'Pruning…'}</Badge>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <ResourceNode icon={Globe2} label="Domain" status={cleanupStatus('review-url')} />
          <ResourceNode icon={ServerCog} label="App pods" status={cleanupStatus('workloads')} />
          <ResourceNode icon={Database} label="Data" status={cleanupStatus('dependencies')} />
          <ResourceNode icon={Boxes} label="Namespace" status={cleanupStatus('namespace')} />
          <ResourceNode icon={Workflow} label="Argo app" status={cleanupStatus('git-intent')} />
        </div>
        {state.status === 'removed' && (
          <div className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600">
            <CheckCircle2 className="h-5 w-5" /> Nothing left behind
          </div>
        )}
      </div>
    </div>
  );
}

function SceneWindow({
  actor,
  phase,
  sceneKey,
  active,
  children,
}: {
  actor: StoryActor;
  phase: StoryPhase;
  sceneKey: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const developer = actor === 'developer';
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border bg-background transition-all duration-500',
        active &&
          developer &&
          'border-blue-500/55 shadow-xl shadow-blue-500/10 ring-2 ring-blue-500/10',
        active &&
          !developer &&
          'border-violet-500/55 shadow-xl shadow-violet-500/10 ring-2 ring-violet-500/10',
        !active && 'border-border/70 bg-muted/5 shadow-sm'
      )}
      aria-current={active ? 'step' : undefined}
    >
      <div className="flex items-center gap-3 border-b bg-muted/35 px-3 py-1.5 sm:px-4">
        <div className="hidden gap-1.5 sm:flex" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md border bg-background/80 px-3 py-1 font-mono text-[10px] text-muted-foreground">
          {developer ? <LockKeyhole className="h-3 w-3" /> : <Workflow className="h-3 w-3" />}
          <span className="truncate">
            {developer
              ? phase.id === 'review'
                ? 'preview-pr-184.atomsized.dev'
                : 'github.com/acme/store/pull/184'
              : 'argo.acme.internal/applications/preview-pr-184'}
          </span>
        </div>
      </div>
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-b px-3 py-1.5 text-xs sm:px-4',
          developer ? 'bg-blue-500/5' : 'bg-violet-500/5'
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {developer ? (
            <UserCheck className="h-4 w-4 shrink-0 text-blue-600" />
          ) : (
            <Workflow className="h-4 w-4 shrink-0 text-violet-600" />
          )}
          <span className="font-semibold">{developer ? 'Developer' : 'Argo CD'}</span>
          <span className="truncate text-muted-foreground">
            · {developer ? phase.developerTitle : phase.platformTitle}
          </span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 text-[10px] transition-colors',
            active && developer && 'border-blue-500/35 bg-blue-500/10 text-blue-700',
            active && !developer && 'border-violet-500/35 bg-violet-500/10 text-violet-700',
            !active && 'text-muted-foreground'
          )}
        >
          {active ? 'Active' : 'Waiting'}
        </Badge>
      </div>
      <div
        key={sceneKey}
        className={cn(
          'grid min-h-[140px] place-items-center overflow-hidden bg-gradient-to-br from-background via-background to-muted/35 p-2 transition-opacity motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-700 sm:min-h-[150px] sm:p-3',
          !active && 'opacity-90',
          developer ? 'motion-safe:slide-in-from-left-4' : 'motion-safe:slide-in-from-right-4'
        )}
      >
        {children}
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
    if (correct) {
      setActorBeat(stageId === 'coordinate' ? 'developer' : 'platform');
    }
  };

  const developerSceneKey = `developer-${phase.id}-${actor}-${stageId}-${state.status}-${state.cleanupIndex}-${storyStarted}`;
  const argoSceneKey = `argo-${phase.id}-${actor}-${stageId}-${state.status}-${state.cleanupIndex}-${storyStarted}`;
  const sharedDecision = state.status === 'ready' || state.status === 'reviewed';
  const cleanupStep = CLEANUP_STEPS[state.cleanupIndex];
  const handoffLabel =
    actor === 'platform'
      ? 'Argo CD is responding'
      : !storyStarted
        ? 'Argo CD waits for the preview label'
        : phase.id === 'intent'
          ? 'Argo CD waits for the pull-request event'
          : phase.id === 'plan'
            ? 'Argo CD waits for the registry image'
            : phase.id === 'remove'
              ? 'Argo CD waits for the pull request to close'
              : 'Argo CD holds its current state';
  const nextButtonLabel =
    state.status === 'configured'
      ? actor === 'developer'
        ? 'Send label to Argo CD'
        : 'Next: build the image'
      : actor === 'developer'
        ? stageId === 'coordinate'
          ? 'Next: push the image'
          : 'Hand image to Argo CD'
        : stageId === 'reconcile'
          ? 'Next: create resources'
          : stageId === 'provision'
            ? 'Next: add data & domain'
            : stageId === 'expose'
              ? 'Next: verify the preview'
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
            <h2 className="mt-2 text-xl font-semibold">Watch a preview environment come alive</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep both sides in view while the image moves from the developer to Argo CD.
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

        <div className="mt-4 grid gap-3 rounded-xl border bg-muted/25 p-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
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
                  ? 'Argo will pause once and let you repair the deployment'
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
            className={cn(
              'text-[10px]',
              actor === 'developer'
                ? 'border-blue-500/30 bg-blue-500/5 text-blue-700'
                : 'border-violet-500/30 bg-violet-500/5 text-violet-700'
            )}
          >
            Current turn · {actor === 'developer' ? 'Developer' : 'Argo CD'}
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

        <SceneWindow
          actor="developer"
          phase={phase}
          sceneKey={developerSceneKey}
          active={actor === 'developer'}
        >
          <DeveloperScene
            phase={phase}
            state={state}
            reviewUrl={evidence.reviewUrl}
            storyStarted={storyStarted}
            active={actor === 'developer'}
          />
        </SceneWindow>

        <div className="relative flex min-h-10 items-center justify-center py-1" aria-hidden="true">
          <span
            className={cn(
              'absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-blue-500/30 to-violet-500/40',
              actor === 'platform' && 'from-blue-500/60 to-violet-500/70'
            )}
          />
          <span
            className={cn(
              'relative inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm',
              actor === 'platform' && 'border-violet-500/35 text-violet-700'
            )}
          >
            <ArrowDown
              className={cn(
                'h-3.5 w-3.5',
                actor === 'platform' && 'text-violet-500 motion-safe:animate-bounce'
              )}
            />
            {handoffLabel}
          </span>
        </div>

        <SceneWindow
          actor="platform"
          phase={phase}
          sceneKey={argoSceneKey}
          active={actor === 'platform'}
        >
          <ArgoScene
            phase={phase}
            state={state}
            failure={failure}
            onFix={applyFix}
            active={actor === 'platform'}
            storyStarted={storyStarted}
          />
        </SceneWindow>

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
              ) : state.status === 'blocked' ? (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              <span>
                {state.status === 'cleaning'
                  ? 'Each click removes the highlighted resource.'
                  : state.status === 'running' || (state.status === 'configured' && storyStarted)
                    ? `Read the ${actor === 'developer' ? 'developer' : 'Argo CD'} view, then continue.`
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
                <p className="w-full text-sm font-semibold">What did you find in the preview?</p>
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
                  <Trash2 className="h-4 w-4" /> Close PR &amp; start cleanup
                </Button>
              </>
            )}

            {state.status === 'cleaning' && cleanupStep && (
              <Button
                type="button"
                size="sm"
                onClick={() => setState((current) => advancePreviewEnvironment(current))}
              >
                {cleanupStep.label} <ArrowRight className="h-4 w-4" />
              </Button>
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
