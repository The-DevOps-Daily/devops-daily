'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
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
  type StageStatus,
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
    developerTitle: 'Watch the checks',
    platformTitle: 'Build the desired state',
  },
  {
    id: 'create',
    label: 'Deploy',
    developerTitle: 'Wait for the preview links',
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

function PerspectiveHandoff({ actor }: { actor: StoryActor }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border bg-background/80 p-1 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all duration-500',
          actor === 'developer'
            ? 'bg-blue-500/12 font-semibold text-blue-700 dark:text-blue-300'
            : 'text-muted-foreground'
        )}
      >
        <UserCheck className="h-3.5 w-3.5" /> Developer
      </span>
      <ArrowRight
        className={cn(
          'h-3.5 w-3.5 text-muted-foreground transition-transform duration-500',
          actor === 'platform' && 'translate-x-0.5 text-violet-500'
        )}
      />
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all duration-500',
          actor === 'platform'
            ? 'bg-violet-500/12 font-semibold text-violet-700 dark:text-violet-300'
            : 'text-muted-foreground'
        )}
      >
        <Workflow className="h-3.5 w-3.5" /> Argo CD
      </span>
    </div>
  );
}

function StageStatusIcon({ status }: { status: StageStatus }) {
  if (status === 'complete') return <Check className="h-4 w-4 text-emerald-500" />;
  if (status === 'failed') return <AlertTriangle className="h-4 w-4 text-red-500" />;
  if (status === 'active' || status === 'remediated') {
    return <LoaderCircle className="h-4 w-4 text-blue-500 motion-safe:animate-spin" />;
  }
  return <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />;
}

function CheckRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: StageStatus;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b px-3 py-3 last:border-0">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border bg-background">
        <StageStatusIcon status={status} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
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
        'flex min-h-20 flex-col items-center justify-center rounded-xl border bg-background/85 p-2 text-center transition-all duration-700',
        status === 'waiting' && 'translate-y-2 border-dashed opacity-25',
        status === 'creating' &&
          'scale-[1.03] border-blue-500/60 bg-blue-500/8 shadow-lg shadow-blue-500/10',
        status === 'ready' && 'border-emerald-500/40 bg-emerald-500/5',
        status === 'removed' && 'scale-90 border-dashed opacity-20',
        status === 'failed' && 'border-red-500/60 bg-red-500/8 text-red-600'
      )}
    >
      {status === 'creating' ? (
        <LoaderCircle className="h-5 w-5 motion-safe:animate-spin" />
      ) : status === 'ready' ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      ) : status === 'failed' ? (
        <AlertTriangle className="h-5 w-5" />
      ) : (
        <Icon className="h-5 w-5" />
      )}
      <p className="mt-1.5 text-xs font-semibold">{label}</p>
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
}: {
  phase: StoryPhase;
  state: PreviewEnvironmentState;
  reviewUrl: string;
  storyStarted: boolean;
}) {
  if (phase.id === 'intent') {
    return (
      <div className="mx-auto grid w-full max-w-4xl gap-5 md:grid-cols-[1.35fr_0.65fr] md:items-center">
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <GitPullRequest className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold">Checkout v2</span>
            <Badge variant="outline" className="ml-auto text-[10px]">
              Open
            </Badge>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" /> checkout-v2 → main
            </div>
            <div className="rounded-lg border bg-muted/25 p-3">
              <div className="h-2 w-3/4 rounded bg-emerald-500/35" />
              <div className="mt-2 h-2 w-1/2 rounded bg-emerald-500/25" />
              <div className="mt-2 h-2 w-2/3 rounded bg-red-500/20" />
              <div className="mt-2 h-2 w-5/6 rounded bg-emerald-500/20" />
            </div>
          </div>
        </div>
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border p-6 text-center transition-all duration-700',
            storyStarted
              ? 'border-blue-500/40 bg-blue-500/8 shadow-lg shadow-blue-500/10'
              : 'border-dashed bg-background/60 text-muted-foreground'
          )}
        >
          <span className="relative grid h-14 w-14 place-items-center rounded-full border border-blue-500/40 bg-background text-blue-600">
            <Zap className="h-6 w-6" />
            {storyStarted && (
              <span className="absolute inset-0 rounded-full ring-4 ring-blue-500/10 motion-safe:animate-ping" />
            )}
          </span>
          <p className="mt-3 text-sm font-semibold">preview</p>
          <p className="text-xs text-muted-foreground">
            {storyStarted ? 'Label added' : 'Ready to add'}
          </p>
        </div>
      </div>
    );
  }

  if (phase.id === 'plan') {
    return (
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <GitCommit className="h-4 w-4" />
            <span className="text-sm font-semibold">Checks</span>
          </div>
          <span className="text-xs text-muted-foreground">sha-8f3c2a1</span>
        </div>
        <CheckRow label="Read pull request" status={state.stageStatuses.intent} detail="PR #184" />
        <CheckRow
          label="Match service versions"
          status={state.stageStatuses.coordinate}
          detail="web + api"
        />
        <CheckRow
          label="Prepare preview deployment"
          status={state.stageStatuses.reconcile}
          detail="Argo CD"
        />
      </div>
    );
  }

  if (phase.id === 'create') {
    const linksReady = state.stageStatuses.expose === 'complete';
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-xl border bg-background p-4 shadow-sm sm:p-6">
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
                {linksReady ? 'Your isolated preview is ready.' : 'Building your isolated preview…'}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {['Web preview', 'API preview'].map((label, index) => (
                  <div
                    key={label}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 transition-all duration-700',
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
    return (
      <div className="mx-auto grid w-full max-w-4xl gap-4 md:grid-cols-[1.4fr_0.6fr]">
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
            <LockKeyhole className="h-3.5 w-3.5 text-emerald-500" />
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {reviewUrl}
            </span>
          </div>
          <div className="grid min-h-56 place-items-center bg-gradient-to-br from-blue-500/8 to-violet-500/8 p-5">
            <div className="w-full max-w-sm rounded-xl border bg-background p-4 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Acme Checkout</span>
                <ShoppingCart className="h-4 w-4" />
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-lg bg-muted/45 p-3">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500/25 to-violet-500/25" />
                <div className="flex-1">
                  <div className="h-2.5 w-2/3 rounded bg-foreground/70" />
                  <div className="mt-2 h-2 w-1/3 rounded bg-muted-foreground/35" />
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="mt-3 h-9 rounded-lg bg-blue-500/80" />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border bg-background p-5 text-center">
          <ShieldCheck className="h-10 w-10 text-emerald-500" />
          <p className="mt-3 font-semibold">Safe to explore</p>
          <p className="mt-1 text-xs text-muted-foreground">Production is untouched</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center rounded-xl border bg-background p-8 text-center shadow-sm">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
        {state.status === 'reviewed' ? (
          <GitMerge className="h-7 w-7" />
        ) : (
          <Check className="h-7 w-7" />
        )}
      </span>
      <p className="mt-4 text-lg font-semibold">
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
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-red-500/40 bg-red-500/10 text-red-500">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <p className="mt-3 text-lg font-semibold">Deployment paused</p>
      <p className="mt-1 text-sm text-muted-foreground">{failure.summary}</p>
      <div className="mx-auto mt-4 max-w-2xl overflow-x-auto rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 font-mono text-xs text-red-700 dark:text-red-300">
        {failure.signal}
      </div>
      <p className="mt-5 text-sm font-semibold">Which fix should Argo apply?</p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
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
}: {
  phase: StoryPhase;
  state: PreviewEnvironmentState;
  failure: PreviewFailure | null;
  onFix: (remediationId: string, correct: boolean) => void;
}) {
  if (failure) return <FailureScene failure={failure} state={state} onFix={onFix} />;

  if (phase.id === 'intent') {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-5 sm:flex-row">
        {[
          { icon: GitPullRequest, label: 'PR #184', detail: 'preview label' },
          { icon: Zap, label: 'Webhook', detail: 'event received' },
          { icon: Workflow, label: 'ApplicationSet', detail: 'generator matched' },
        ].map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="contents">
              <div className="flex w-full max-w-52 flex-col items-center rounded-xl border bg-background p-5 text-center shadow-sm">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-violet-500/10 text-violet-600">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
              {index < 2 && (
                <div className="relative h-6 w-px bg-border sm:h-px sm:w-16">
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
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
          <ResourceNode icon={GitBranch} label="PR generator" status="ready" />
          <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-muted-foreground md:rotate-0" />
          <ResourceNode
            icon={Package}
            label="Helm values"
            status={
              coordinateStatus === 'failed'
                ? 'failed'
                : coordinateStatus === 'complete'
                  ? 'ready'
                  : 'creating'
            }
          />
          <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-muted-foreground md:rotate-0" />
          <ResourceNode
            icon={Workflow}
            label="Preview app"
            status={
              reconcileStatus === 'failed'
                ? 'failed'
                : reconcileStatus === 'complete'
                  ? 'ready'
                  : reconcileStatus === 'pending'
                    ? 'waiting'
                    : 'creating'
            }
          />
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2 font-mono text-[10px] text-muted-foreground">
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
      <div className="mx-auto w-full max-w-5xl rounded-2xl border-2 border-dashed border-violet-500/35 bg-violet-500/5 p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-violet-500" />
            <span className="font-mono text-xs font-semibold">namespace / preview-pr-184</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            isolated
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <ResourceNode
            icon={Boxes}
            label="Namespace"
            status={resourceStatus(state, 'provision', namespaceRemoved, ['quota-exceeded'])}
          />
          <ResourceNode
            icon={ServerCog}
            label={`${state.config.services.length} app pods`}
            status={resourceStatus(state, 'provision', workloadsRemoved, [
              'quota-exceeded',
              'missing-secret',
              'readiness-failure',
              'revision-drift',
            ])}
          />
          <ResourceNode
            icon={Network}
            label="Network"
            status={resourceStatus(state, 'provision', namespaceRemoved)}
          />
          <ResourceNode
            icon={Database}
            label="Database"
            status={resourceStatus(state, 'expose', dependenciesRemoved, ['readiness-failure'])}
          />
          <ResourceNode
            icon={Database}
            label="Redis"
            status={resourceStatus(state, 'expose', dependenciesRemoved)}
          />
          <ResourceNode
            icon={Globe2}
            label="Domain + TLS"
            status={resourceStatus(state, 'expose', reviewUrlRemoved, ['dns-pending'])}
          />
        </div>
      </div>
    );
  }

  if (phase.id === 'review') {
    const ready = state.stageStatuses.verify === 'complete' || state.status === 'ready';
    return (
      <div className="mx-auto grid w-full max-w-4xl gap-4 md:grid-cols-[0.8fr_1.2fr]">
        <div className="flex flex-col items-center justify-center rounded-xl border bg-background p-6 text-center">
          {ready ? (
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          ) : (
            <LoaderCircle className="h-12 w-12 text-blue-500 motion-safe:animate-spin" />
          )}
          <p className="mt-3 text-lg font-semibold">{ready ? 'Healthy & Synced' : 'Verifying…'}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">sha-8f3c2a1</p>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">preview-pr-184</p>
            <Badge
              variant="outline"
              className={cn(ready && 'border-emerald-500/40 text-emerald-600')}
            >
              {ready ? 'Synced' : 'Progressing'}
            </Badge>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 sm:gap-4">
            {[Globe2, ServerCog, Database].map((Icon, index) => (
              <div key={index} className="contents">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-emerald-500/35 bg-emerald-500/5">
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
      <div className="rounded-2xl border-2 border-dashed p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-xs font-semibold">namespace / preview-pr-184</p>
          <Badge variant="outline">{state.status === 'removed' ? '$0.00/hr' : 'Pruning…'}</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <ResourceNode icon={Globe2} label="Domain" status={cleanupStatus('review-url')} />
          <ResourceNode icon={ServerCog} label="App pods" status={cleanupStatus('workloads')} />
          <ResourceNode icon={Database} label="Data" status={cleanupStatus('dependencies')} />
          <ResourceNode icon={Boxes} label="Namespace" status={cleanupStatus('namespace')} />
          <ResourceNode icon={Workflow} label="Argo app" status={cleanupStatus('git-intent')} />
        </div>
        {state.status === 'removed' && (
          <div className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600">
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
  children,
}: {
  actor: StoryActor;
  phase: StoryPhase;
  sceneKey: string;
  children: React.ReactNode;
}) {
  const developer = actor === 'developer';
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border bg-background shadow-xl transition-colors duration-500',
        developer
          ? 'border-blue-500/35 shadow-blue-500/5'
          : 'border-violet-500/35 shadow-violet-500/5'
      )}
    >
      <div className="flex items-center gap-3 border-b bg-muted/35 px-3 py-2.5 sm:px-4">
        <div className="flex gap-1.5" aria-hidden="true">
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
        <Badge
          variant="outline"
          className={cn(
            'hidden text-[10px] sm:inline-flex',
            developer ? 'border-blue-500/30 text-blue-600' : 'border-violet-500/30 text-violet-600'
          )}
        >
          {developer ? 'Developer view' : 'Argo CD view'}
        </Badge>
      </div>
      <div
        key={sceneKey}
        className={cn(
          'grid min-h-[390px] place-items-center overflow-hidden bg-gradient-to-br from-background via-background to-muted/35 p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-700 sm:min-h-[430px] sm:p-7',
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
    if (actor === 'developer') {
      setActorBeat('platform');
      return;
    }

    setState((current) => advancePreviewEnvironment(current));
    setActorBeat('developer');
  };

  const applyFix = (remediationId: string, correct: boolean) => {
    setState((current) => applyPreviewRemediation(current, remediationId));
    if (correct) {
      setActorBeat('platform');
    }
  };

  const sceneKey = `${phase.id}-${actor}-${stageId}-${state.status}-${state.cleanupIndex}`;
  const sharedDecision = state.status === 'ready' || state.status === 'reviewed';
  const cleanupStep = CLEANUP_STEPS[state.cleanupIndex];

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
              Move at your own pace from the developer action to Argo&apos;s response.
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

      <div className="p-3 sm:p-4">
        <StoryProgress activeIndex={phaseIndex} done={state.status === 'removed'} />

        <div className="my-3 flex flex-col items-center justify-center gap-2 text-center sm:my-4">
          <PerspectiveHandoff actor={actor} />
          <div aria-live="polite">
            <p className="text-sm font-semibold">
              {actor === 'developer' ? phase.developerTitle : phase.platformTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              {friendlyStatus(state, actor, storyStarted)}
            </p>
          </div>
        </div>

        <SceneWindow actor={actor} phase={phase} sceneKey={sceneKey}>
          {actor === 'developer' ? (
            <DeveloperScene
              phase={phase}
              state={state}
              reviewUrl={evidence.reviewUrl}
              storyStarted={storyStarted}
            />
          ) : (
            <ArgoScene phase={phase} state={state} failure={failure} onFix={applyFix} />
          )}
        </SceneWindow>

        <div
          className={cn(
            'mt-3 flex min-h-11 gap-2 rounded-xl border bg-background/75 p-2.5',
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
                  {actor === 'developer'
                    ? 'Next: see Argo’s response'
                    : 'Next: see the developer update'}
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
