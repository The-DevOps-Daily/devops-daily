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

const PHASES: { label: string; stages: PreviewStageId[] }[] = [
  { label: 'Ask', stages: ['intent'] },
  { label: 'Build', stages: ['coordinate', 'reconcile'] },
  { label: 'Launch', stages: ['provision', 'expose'] },
  { label: 'Review', stages: ['verify'] },
];

const SERVICE_LABELS = {
  web: 'Web app',
  api: 'API',
  worker: 'Worker',
} as const;

const DATA_LABELS = {
  synthetic: 'Test data',
  'masked-snapshot': 'Safe data copy',
  'shared-stage': 'Shared staging data',
} as const;

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

function combinedStatus(state: PreviewEnvironmentState, stages: PreviewStageId[]): StageStatus {
  return phaseStatus(state, stages);
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

function stageHasStarted(state: PreviewEnvironmentState, stage: PreviewStageId): boolean {
  return state.stageStatuses[stage] !== 'pending';
}

function NodeCard({
  icon: Icon,
  title,
  label,
  status,
  large = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  label: string;
  status: StageStatus;
  large?: boolean;
  children?: React.ReactNode;
}) {
  const active = status === 'active' || status === 'remediated';
  const complete = status === 'complete';
  const failed = status === 'failed';

  return (
    <div
      className={cn(
        'relative flex min-h-32 flex-col rounded-xl border bg-background/80 p-4 transition-all duration-500',
        large && 'min-h-56',
        status === 'pending' && 'border-dashed opacity-40',
        active && 'border-blue-500/50 bg-blue-500/8 shadow-sm shadow-blue-500/10',
        complete && 'border-emerald-500/35 bg-emerald-500/5',
        failed && 'border-red-500/50 bg-red-500/8 shadow-sm shadow-red-500/10'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg border bg-background">
          {active ? (
            <LoaderCircle className="h-4 w-4 motion-safe:animate-spin text-blue-500" />
          ) : failed ? (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          ) : complete ? (
            <Check className="h-4 w-4 text-emerald-500" />
          ) : (
            <Icon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        {complete && (
          <Badge
            variant="outline"
            className="border-emerald-500/30 text-[10px] text-emerald-700 dark:text-emerald-300"
          >
            Ready
          </Badge>
        )}
      </div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function FlowArrow({ status }: { status: StageStatus }) {
  const active = status === 'active' || status === 'remediated';
  const complete = status === 'complete';
  return (
    <div
      className={cn(
        'flex min-h-8 items-center justify-center text-muted-foreground/30 transition-colors duration-500',
        active && 'text-blue-500',
        complete && 'text-emerald-500'
      )}
      aria-hidden="true"
    >
      <ArrowDown className={cn('h-5 w-5 lg:hidden', active && 'motion-safe:animate-bounce')} />
      <div className="relative hidden w-full items-center lg:flex">
        <div className="h-px flex-1 bg-current" />
        {active && (
          <span className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-current motion-safe:animate-ping" />
        )}
        <ArrowRight className="h-5 w-5" />
      </div>
    </div>
  );
}

function PhaseRail({ state }: { state: PreviewEnvironmentState }) {
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Preview environment progress">
      {PHASES.map((phase, index) => {
        const status = phaseStatus(state, phase.stages);
        return (
          <li key={phase.label} className="relative flex flex-col items-center text-center">
            {index > 0 && (
              <span
                className={cn(
                  'absolute right-1/2 top-3 h-px w-full bg-border',
                  (status === 'active' || status === 'complete') && 'bg-blue-500/45'
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 grid h-6 w-6 place-items-center rounded-full border bg-background font-mono text-[10px] text-muted-foreground',
                status === 'active' && 'border-blue-500 bg-blue-500 text-white',
                status === 'complete' && 'border-emerald-500 bg-emerald-500 text-white',
                status === 'failed' && 'border-red-500 bg-red-500 text-white'
              )}
            >
              {status === 'complete' ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className="mt-1.5 text-[11px] font-medium text-muted-foreground">
              {phase.label}
            </span>
          </li>
        );
      })}
    </ol>
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
  const platformStatus = combinedStatus(state, ['coordinate', 'reconcile']);
  const previewStatus = combinedStatus(state, ['provision', 'expose']);
  const reviewStatus = combinedStatus(state, ['verify']);
  const reviewUrlRemoved = state.cleanupStatuses['review-url'] === 'complete';
  const workloadsRemoved = state.cleanupStatuses.workloads === 'complete';
  const dependenciesRemoved = state.cleanupStatuses.dependencies === 'complete';
  const namespaceRemoved = state.cleanupStatuses.namespace === 'complete';
  const gitIntentClosed = state.cleanupStatuses['git-intent'] === 'complete';

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
        <PhaseRail state={state} />

        <div
          className="my-5 flex min-h-11 items-center justify-center rounded-lg border bg-background/60 px-3 text-center"
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

        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-500/5 via-background to-cyan-500/5 p-3 sm:p-5">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-blue-500/5 blur-3xl" />
          <div className="relative grid items-stretch gap-2 lg:grid-cols-[145px_44px_125px_44px_minmax(280px,1fr)_44px_155px]">
            <NodeCard
              icon={GitPullRequest}
              title="Pull request"
              label="Here is my change"
              status={state.stageStatuses.intent}
            >
              <div className="mt-auto pt-3">
                <Badge variant="secondary" className="font-mono text-[10px]">
                  8f3c2a1
                </Badge>
              </div>
            </NodeCard>

            <FlowArrow
              status={
                state.stageStatuses.intent === 'complete' && !gitIntentClosed
                  ? platformStatus
                  : 'pending'
              }
            />

            <NodeCard
              icon={Workflow}
              title="Platform"
              label={
                gitIntentClosed
                  ? 'Cleanup recorded'
                  : platformStatus === 'pending'
                    ? 'Waiting'
                    : 'Builds a safe copy'
              }
              status={gitIntentClosed ? 'pending' : platformStatus}
            />

            <FlowArrow status={namespaceRemoved ? 'pending' : previewStatus} />

            <NodeCard
              icon={Boxes}
              title="Preview #184"
              label={namespaceRemoved ? 'Namespace removed' : 'Temporary mini-production'}
              status={namespaceRemoved ? 'pending' : previewStatus}
              large
            >
              {stageHasStarted(state, 'provision') && !namespaceRemoved ? (
                <div className="mt-4 flex flex-1 flex-col">
                  <div className="grid flex-1 gap-2 sm:grid-cols-3">
                    {state.config.services.map((service) => (
                      <div
                        key={service}
                        className={cn(
                          'flex min-h-16 items-center justify-center rounded-lg border bg-background/80 px-2 text-center transition-opacity',
                          workloadsRemoved && 'opacity-20'
                        )}
                      >
                        <div>
                          <ServerCog className="mx-auto h-4 w-4 text-blue-500" />
                          <p className="mt-1 text-xs font-medium">{SERVICE_LABELS[service]}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div
                    className={cn(
                      'mt-2 flex items-center justify-between rounded-lg border border-dashed bg-background/60 px-3 py-2 text-xs transition-opacity',
                      (!stageHasStarted(state, 'expose') || dependenciesRemoved) && 'opacity-20'
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5" />
                      {DATA_LABELS[state.config.dataStrategy]}
                    </span>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                </div>
              ) : (
                <div className="grid flex-1 place-items-center py-8 text-center text-xs text-muted-foreground">
                  <div>
                    {namespaceRemoved ? (
                      <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-emerald-500" />
                    ) : (
                      <Boxes className="mx-auto mb-2 h-7 w-7 opacity-40" />
                    )}
                    {namespaceRemoved ? 'Removed cleanly' : 'The temporary app will appear here'}
                  </div>
                </div>
              )}
            </NodeCard>

            <FlowArrow status={reviewUrlRemoved ? 'pending' : reviewStatus} />

            <NodeCard
              icon={UserCheck}
              title="Reviewer"
              label={
                reviewUrlRemoved
                  ? 'URL removed'
                  : stageHasStarted(state, 'expose')
                    ? 'Opens a private URL'
                    : 'Waiting for a link'
              }
              status={reviewUrlRemoved ? 'pending' : reviewStatus}
            >
              {stageHasStarted(state, 'expose') && !reviewUrlRemoved && (
                <div className="mt-auto pt-3">
                  <div className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 font-mono text-[9px] text-blue-700 dark:text-blue-300">
                    <Globe2 className="h-3 w-3 shrink-0" /> pr-184.preview.dev
                  </div>
                </div>
              )}
            </NodeCard>
          </div>
        </div>

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
