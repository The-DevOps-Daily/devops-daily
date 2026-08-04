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
  GitPullRequest,
  Globe2,
  LoaderCircle,
  Network,
  Package,
  Play,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  type PreviewFailureId,
  type PreviewStageId,
  type StageStatus,
} from '@/lib/games/preview-environment-engine';

type PreviewScenarioId = 'api-change' | 'checkout-flow' | 'full-product';

interface PreviewScenario {
  id: PreviewScenarioId;
  label: string;
  detail: string;
  icon: LucideIcon;
  failure: PreviewFailureId;
  config: Partial<PreviewEnvironmentConfig>;
}

const PREVIEW_SCENARIOS: PreviewScenario[] = [
  {
    id: 'api-change',
    label: 'API change',
    detail: 'One backend service',
    icon: ServerCog,
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
    icon: Globe2,
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
    icon: Boxes,
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

type TimelinePhaseId = 'intent' | 'plan' | 'create' | 'review' | 'remove';
type TimelineLane = 'developer' | 'platform';

interface TimelinePhase {
  id: TimelinePhaseId;
  label: string;
  developer: { title: string; detail: string; icon: LucideIcon };
  platform: { title: string; detail: string; icon: LucideIcon };
}

const TIMELINE_PHASES: TimelinePhase[] = [
  {
    id: 'intent',
    label: 'Intent',
    developer: {
      title: 'Add preview label',
      detail: 'PR #184 · checkout-v2',
      icon: GitPullRequest,
    },
    platform: { title: 'Detect PR intent', detail: 'Webhook sees the label', icon: Workflow },
  },
  {
    id: 'plan',
    label: 'Plan',
    developer: { title: 'Watch checks run', detail: 'Live status returns to the PR', icon: Clock3 },
    platform: {
      title: 'Render desired state',
      detail: 'ApplicationSet + Helm values',
      icon: Package,
    },
  },
  {
    id: 'create',
    label: 'Create',
    developer: { title: 'Receive test domains', detail: 'Web and API preview URLs', icon: Globe2 },
    platform: { title: 'Create isolated stack', detail: 'Namespace + apps + data', icon: Boxes },
  },
  {
    id: 'review',
    label: 'Review',
    developer: { title: 'Try the change', detail: 'Approve or request changes', icon: UserCheck },
    platform: {
      title: 'Verify what is running',
      detail: 'Health + commit revision',
      icon: ShieldCheck,
    },
  },
  {
    id: 'remove',
    label: 'Remove',
    developer: {
      title: 'Close or merge PR',
      detail: 'The preview is no longer needed',
      icon: Trash2,
    },
    platform: {
      title: 'Prune the preview',
      detail: 'Argo deletes generated resources',
      icon: RefreshCw,
    },
  },
];

function scenarioState(scenarioId: PreviewScenarioId, challengeMode: boolean) {
  const scenario = PREVIEW_SCENARIOS.find((item) => item.id === scenarioId) ?? PREVIEW_SCENARIOS[1];
  return createPreviewEnvironmentState({
    ...scenario.config,
    injectedFailure: challengeMode ? scenario.failure : 'none',
    revisionGate: true,
  });
}

function phaseStatus(state: PreviewEnvironmentState, stages: PreviewStageId[]): StageStatus {
  const statuses = stages.map((stage) => state.stageStatuses[stage]);
  if (statuses.includes('failed')) return 'failed';
  if (statuses.every((status) => status === 'complete')) return 'complete';
  if (statuses.some((status) => status === 'active' || status === 'remediated')) return 'active';
  if (statuses.some((status) => status === 'complete')) return 'active';
  return 'pending';
}

function friendlyStatus(state: PreviewEnvironmentState): string {
  if (state.status === 'configured') return 'A pull request asks for a safe place to test.';
  if (state.status === 'blocked') return 'Something broke. Read the signal and choose a fix.';
  if (state.status === 'ready') return 'Your change is live in its own temporary environment.';
  if (state.status === 'reviewed') {
    return state.reviewDecision === 'approve'
      ? 'The reviewer likes it. The preview has done its job.'
      : 'The reviewer found a problem. The preview protected production.';
  }
  if (state.status === 'cleaning') {
    const step = CLEANUP_STEPS[state.cleanupIndex];
    return step
      ? `Cleaning up: ${step.label.toLowerCase()}…`
      : 'Checking that nothing was left behind…';
  }
  if (state.status === 'removed') return 'Gone. No forgotten server, database, URL, or cloud bill.';

  const stage = PREVIEW_STAGES[state.stageIndex];
  const messages: Record<PreviewStageId, string> = {
    intent: 'Reading what changed in the pull request…',
    coordinate: 'Choosing the matching version of every service…',
    reconcile: 'Turning the plan into temporary infrastructure…',
    provision: 'Starting a private copy of the application…',
    expose: 'Adding safe test data and a review URL…',
    verify: 'Checking that the right code is healthy and ready…',
  };
  return stage ? messages[stage.id] : 'Finishing the preview…';
}

function timelineStatus(
  state: PreviewEnvironmentState,
  phase: TimelinePhaseId,
  lane: TimelineLane
): StageStatus {
  if (phase === 'intent') return phaseStatus(state, ['intent']);
  if (phase === 'plan') return phaseStatus(state, ['coordinate', 'reconcile']);
  if (phase === 'create') return phaseStatus(state, ['provision', 'expose']);
  if (phase === 'review') {
    if (lane === 'developer' && state.status === 'ready') return 'active';
    if (
      lane === 'developer' &&
      (state.status === 'reviewed' || state.status === 'cleaning' || state.status === 'removed')
    ) {
      return 'complete';
    }
    return phaseStatus(state, ['verify']);
  }

  if (lane === 'developer') {
    if (state.status === 'reviewed') return 'active';
    if (state.status === 'cleaning' || state.status === 'removed') return 'complete';
  }
  if (lane === 'platform') {
    if (state.status === 'cleaning') return 'active';
    if (state.status === 'removed') return 'complete';
  }
  return 'pending';
}

function StatusIcon({ status, icon: Icon }: { status: StageStatus; icon: LucideIcon }) {
  const active = status === 'active' || status === 'remediated';
  const complete = status === 'complete';
  const failed = status === 'failed';

  if (active) return <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" />;
  if (complete) return <Check className="h-4 w-4" />;
  if (failed) return <AlertTriangle className="h-4 w-4" />;
  return <Icon className="h-4 w-4" />;
}

function LaneStep({
  item,
  status,
  showArrow = false,
}: {
  item: { title: string; detail: string; icon: LucideIcon };
  status: StageStatus;
  showArrow?: boolean;
}) {
  return (
    <div className="relative h-full">
      <div
        className={cn(
          'flex h-full min-h-24 flex-col rounded-lg border bg-background/85 p-3 transition-all duration-500',
          status === 'pending' && 'border-dashed opacity-40',
          (status === 'active' || status === 'remediated') &&
            'border-blue-500/50 bg-blue-500/8 text-blue-700 dark:text-blue-300',
          status === 'complete' && 'border-emerald-500/35 bg-emerald-500/5',
          status === 'failed' && 'border-red-500/50 bg-red-500/8 text-red-700 dark:text-red-300'
        )}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border bg-background">
            <StatusIcon status={status} icon={item.icon} />
          </span>
          <p className="text-xs font-semibold leading-tight">{item.title}</p>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{item.detail}</p>
      </div>
      {showArrow && (
        <ArrowRight
          className={cn(
            'absolute -right-4 top-1/2 z-20 h-4 w-4 -translate-y-1/2 text-muted-foreground/30',
            status === 'complete' && 'text-emerald-500',
            (status === 'active' || status === 'remediated') && 'text-blue-500'
          )}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function LaneLabel({ lane }: { lane: TimelineLane }) {
  const developer = lane === 'developer';
  return (
    <div className="flex h-full flex-col justify-center rounded-lg border bg-background/60 px-3 py-2">
      <div className="flex items-center gap-2">
        {developer ? (
          <UserCheck className="h-4 w-4 text-blue-500" />
        ) : (
          <Workflow className="h-4 w-4 text-violet-500" />
        )}
        <span className="text-xs font-semibold">{developer ? 'Developer' : 'Argo CD'}</span>
      </div>
      <span className="mt-1 text-[10px] text-muted-foreground">
        {developer ? 'what you see' : 'what happens'}
      </span>
    </div>
  );
}

function DualLaneTimeline({ state }: { state: PreviewEnvironmentState }) {
  return (
    <div className="rounded-xl border bg-gradient-to-br from-blue-500/5 via-background to-violet-500/5 p-3 sm:p-4">
      <div className="hidden lg:block">
        <div className="grid grid-cols-[108px_repeat(5,minmax(0,1fr))] gap-4">
          <div />
          {TIMELINE_PHASES.map((phase, index) => (
            <p
              key={phase.id}
              className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {index + 1}. {phase.label}
            </p>
          ))}

          <LaneLabel lane="developer" />
          {TIMELINE_PHASES.map((phase, index) => (
            <LaneStep
              key={`developer-${phase.id}`}
              item={phase.developer}
              status={timelineStatus(state, phase.id, 'developer')}
              showArrow={index < TIMELINE_PHASES.length - 1}
            />
          ))}

          <LaneLabel lane="platform" />
          {TIMELINE_PHASES.map((phase, index) => (
            <LaneStep
              key={`platform-${phase.id}`}
              item={phase.platform}
              status={timelineStatus(state, phase.id, 'platform')}
              showArrow={index < TIMELINE_PHASES.length - 1}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {TIMELINE_PHASES.map((phase, index) => (
          <section key={phase.id} className="rounded-lg border bg-background/55 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {index + 1}. {phase.label}
            </p>
            <LaneStep
              item={phase.developer}
              status={timelineStatus(state, phase.id, 'developer')}
            />
            <div className="flex items-center justify-center gap-2 py-1.5 text-[10px] text-muted-foreground">
              <ArrowDown className="h-3.5 w-3.5" /> platform response
            </div>
            <LaneStep item={phase.platform} status={timelineStatus(state, phase.id, 'platform')} />
          </section>
        ))}
      </div>
    </div>
  );
}

type ResourceStatus = 'waiting' | 'creating' | 'ready' | 'removed' | 'failed';

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

function ResourceTile({
  icon: Icon,
  title,
  detail,
  status,
  readyLabel,
  removedLabel,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  status: ResourceStatus;
  readyLabel?: string;
  removedLabel?: string;
}) {
  const labels: Record<ResourceStatus, string> = {
    waiting: 'Waiting',
    creating: 'Creating',
    ready: readyLabel ?? 'Created',
    removed: removedLabel ?? 'Removed',
    failed: 'Blocked',
  };
  return (
    <div
      className={cn(
        'rounded-lg border bg-background/75 p-3 transition-all duration-500',
        status === 'waiting' && 'border-dashed opacity-35',
        status === 'creating' && 'border-blue-500/50 bg-blue-500/8',
        status === 'ready' && 'border-emerald-500/35 bg-emerald-500/5',
        status === 'removed' && 'border-dashed opacity-35',
        status === 'failed' && 'border-red-500/50 bg-red-500/8'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          {labels[status]}
        </span>
      </div>
      <p className="mt-2 text-xs font-semibold">{title}</p>
      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{detail}</p>
    </div>
  );
}

function ResourceBlueprint({ state }: { state: PreviewEnvironmentState }) {
  const reviewUrlRemoved = state.cleanupStatuses['review-url'] === 'complete';
  const workloadsRemoved = state.cleanupStatuses.workloads === 'complete';
  const dependenciesRemoved = state.cleanupStatuses.dependencies === 'complete';
  const namespaceRemoved = state.cleanupStatuses.namespace === 'complete';
  const podCount = state.config.services.length;

  return (
    <div className="mt-4 rounded-xl border border-dashed bg-background/45 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">What Argo creates for preview #184</p>
          <p className="text-xs text-muted-foreground">
            Each tile appears as its owning stage reconciles.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span className="rounded border bg-background px-2 py-1">ApplicationSet</span>
          <ArrowRight className="h-3.5 w-3.5" />
          <span className="rounded border bg-background px-2 py-1">Helm release</span>
          <ArrowRight className="h-3.5 w-3.5" />
          <span className="rounded border bg-background px-2 py-1">preview-pr-184</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <ResourceTile
          icon={Boxes}
          title="Namespace"
          detail="Isolation boundary"
          status={resourceStatus(state, 'provision', namespaceRemoved, ['quota-exceeded'])}
        />
        <ResourceTile
          icon={ServerCog}
          title={`${podCount} app pod${podCount === 1 ? '' : 's'}`}
          detail="PR image revisions"
          status={resourceStatus(state, 'provision', workloadsRemoved, [
            'quota-exceeded',
            'missing-secret',
            'readiness-failure',
            'revision-drift',
          ])}
        />
        <ResourceTile
          icon={ServerCog}
          title="Worker node capacity"
          detail="Pods scheduled here"
          status={resourceStatus(state, 'provision', namespaceRemoved, ['quota-exceeded'])}
          readyLabel="Allocated"
          removedLabel="Released"
        />
        <ResourceTile
          icon={Database}
          title="Isolated database"
          detail="Safe preview data"
          status={resourceStatus(state, 'expose', dependenciesRemoved, ['readiness-failure'])}
        />
        <ResourceTile
          icon={Database}
          title="Redis cache"
          detail="Preview-scoped state"
          status={resourceStatus(state, 'expose', dependenciesRemoved)}
        />
        <ResourceTile
          icon={Network}
          title="Domain + TLS"
          detail="Private review URL"
          status={resourceStatus(state, 'expose', reviewUrlRemoved, ['dns-pending'])}
        />
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        Pods normally use existing worker nodes. Cluster autoscaling adds a node only when more
        capacity is needed.
      </p>
    </div>
  );
}

export default function PreviewEnvironmentSimulator() {
  const [scenarioId, setScenarioId] = useState<PreviewScenarioId>('checkout-flow');
  const [challengeMode, setChallengeMode] = useState(false);
  const [state, setState] = useState(() => scenarioState('checkout-flow', false));
  const [running, setRunning] = useState(false);

  const metrics = useMemo(() => getPreviewMetrics(state.config), [state.config]);
  const evidence = useMemo(() => getPreviewEvidence(state.config), [state.config]);
  const generatedIntent = useMemo(() => getGeneratedIntent(state.config), [state.config]);
  const failure = state.activeFailure ? PREVIEW_FAILURES[state.activeFailure] : null;
  const canAdvance = ['configured', 'running', 'cleaning'].includes(state.status);

  useEffect(() => {
    if (!running || !canAdvance) return;
    const timer = window.setInterval(() => {
      setState((current) => advancePreviewEnvironment(current));
    }, 900);
    return () => window.clearInterval(timer);
  }, [canAdvance, running]);

  const resetWith = (nextScenario: PreviewScenarioId, nextChallenge: boolean) => {
    setScenarioId(nextScenario);
    setChallengeMode(nextChallenge);
    setState(scenarioState(nextScenario, nextChallenge));
    setRunning(false);
  };

  const start = () => {
    if (state.status === 'removed') {
      setState(scenarioState(scenarioId, challengeMode));
    }
    setRunning(true);
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-muted/15 shadow-sm">
      <div className="border-b bg-background/85 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
              Give this pull request its own temporary app
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Build it, open it, review it, then watch it disappear.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" /> about {metrics.provisionMinutes} min
            </span>
            <span>·</span>
            <span>
              {state.status === 'removed' ? '$0.00' : `$${metrics.hourlyCost.toFixed(2)}`}/hr
            </span>
            <span>·</span>
            <span>deletes in {state.config.ttlHours}h</span>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {PREVIEW_SCENARIOS.map((option) => {
            const Icon = option.icon;
            const selected = scenarioId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => resetWith(option.id, challengeMode)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border bg-background/60 p-3 text-left transition-colors',
                  selected
                    ? 'border-blue-500/45 bg-blue-500/8'
                    : 'text-muted-foreground hover:border-blue-500/30 hover:text-foreground'
                )}
                aria-pressed={selected}
              >
                <span
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-lg border',
                    selected && 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">{option.detail}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => resetWith(scenarioId, !challengeMode)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5 text-xs font-medium transition-colors',
              challengeMode &&
                'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
            )}
            aria-pressed={challengeMode}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {challengeMode
              ? 'Challenge on: one thing will break'
              : 'Make it interesting: break one thing'}
          </button>

          <div className="flex gap-2">
            {state.status === 'configured' || state.status === 'removed' ? (
              <Button type="button" size="sm" onClick={start}>
                <Play className="h-4 w-4" />
                {state.status === 'removed' ? 'Build another' : 'Create preview'}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => resetWith(scenarioId, challengeMode)}
              >
                <RefreshCw className="h-4 w-4" /> Start over
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div
          className="mb-4 flex min-h-11 items-center justify-center rounded-lg border bg-background/60 px-3 text-center"
          aria-live="polite"
        >
          {state.status === 'blocked' ? (
            <AlertTriangle className="mr-2 h-4 w-4 shrink-0 text-red-500" />
          ) : state.status === 'ready' ||
            state.status === 'reviewed' ||
            state.status === 'removed' ? (
            <CheckCircle2 className="mr-2 h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <Workflow className="mr-2 h-4 w-4 shrink-0 text-blue-500" />
          )}
          <p className="text-sm font-medium">{friendlyStatus(state)}</p>
        </div>

        <DualLaneTimeline state={state} />
        <ResourceBlueprint state={state} />

        {failure && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/5 p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-500">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold">Oops: {failure.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{failure.summary}</p>
                <p className="mt-2 font-mono text-xs text-red-700 dark:text-red-300">
                  {failure.signal}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What would you try?
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {failure.remediationOptions.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-10 justify-start whitespace-normal text-left"
                  onClick={() => {
                    setState((current) => applyPreviewRemediation(current, option.id));
                    if (option.id === failure.correctRemediationId) setRunning(true);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {state.failedRemediationAttempts > 0 && (
              <p className="mt-3 text-sm text-red-700 dark:text-red-300">
                Not quite. {state.lastEvent}
              </p>
            )}
          </div>
        )}

        {state.status === 'ready' && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
                <Globe2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Open the preview and try the change</h3>
                <p className="text-sm text-muted-foreground">
                  Production is untouched while you decide.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
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
            </div>
          </div>
        )}

        {state.status === 'reviewed' && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold">The review is finished</h3>
              <p className="text-sm text-muted-foreground">
                Now remove the temporary copy before it becomes forgotten infrastructure.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setState((current) => beginPreviewTeardown(current, 'pr-closed'));
                setRunning(true);
              }}
            >
              <Trash2 className="h-4 w-4" /> Close PR &amp; clean up
            </Button>
          </div>
        )}

        {(state.status === 'cleaning' || state.status === 'removed') && (
          <div className="mt-4 rounded-xl border bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Nothing left behind</h3>
              <Badge
                variant="outline"
                className={cn(
                  state.status === 'removed' &&
                    'border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                )}
              >
                {state.status === 'removed' ? '$0.00/hr' : 'Cleaning…'}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {CLEANUP_STEPS.map((step) => {
                const status = state.cleanupStatuses[step.id];
                return (
                  <div key={step.id} className="text-center">
                    <div
                      className={cn(
                        'mx-auto grid h-8 w-8 place-items-center rounded-full border text-muted-foreground',
                        status === 'active' && 'border-blue-500 text-blue-500',
                        status === 'complete' && 'border-emerald-500 bg-emerald-500 text-white'
                      )}
                    >
                      {status === 'complete' ? (
                        <Check className="h-4 w-4" />
                      ) : status === 'active' ? (
                        <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                    </div>
                    <p className="mt-1.5 hidden text-[10px] text-muted-foreground sm:block">
                      {step.label.replace('Remove ', '').replace('Close ', '')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <details className="group mt-5 border-t pt-4">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <Code2 className="h-4 w-4" />
            See what the platform does under the hood
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border bg-background/70 p-3">
              <p className="text-xs font-semibold">The request</p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200">
                {generatedIntent}
              </pre>
            </div>
            <div className="rounded-lg border bg-background/70 p-3">
              <p className="text-xs font-semibold">The proof returned to the PR</p>
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
