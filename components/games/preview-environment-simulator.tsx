'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Code2,
  Database,
  DollarSign,
  FileCode2,
  GitPullRequest,
  Globe2,
  KeyRound,
  Pause,
  Play,
  RotateCcw,
  ServerCog,
  ShieldCheck,
  StepForward,
  Trash2,
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
  formatTeardownTrigger,
  getGeneratedIntent,
  getPreviewEvidence,
  getPreviewMetrics,
  recordPreviewReview,
  updatePreviewEnvironmentConfig,
  type CleanupStepId,
  type DataStrategy,
  type PreviewEnvironmentConfig,
  type PreviewMode,
  type PreviewService,
  type PreviewStageId,
  type ResourceProfile,
  type ReviewerAccess,
  type StageStatus,
  type TeardownTrigger,
} from '@/lib/games/preview-environment-engine';

const STAGE_ICONS: Record<PreviewStageId, LucideIcon> = {
  intent: GitPullRequest,
  coordinate: Workflow,
  reconcile: FileCode2,
  provision: Boxes,
  expose: Globe2,
  verify: ShieldCheck,
};

const STATUS_STYLES: Record<StageStatus, string> = {
  pending: 'border-border bg-background/55 text-muted-foreground',
  active:
    'border-blue-500/50 bg-blue-500/10 text-blue-700 ring-2 ring-blue-500/10 dark:text-blue-300',
  complete: 'border-emerald-500/35 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300',
  failed: 'border-red-500/45 bg-red-500/10 text-red-700 dark:text-red-300',
  remediated: 'border-amber-500/45 bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

const STATUS_LABELS = {
  configured: 'Intent ready',
  running: 'Reconciling',
  blocked: 'Action required',
  ready: 'Ready for review',
  reviewed: 'Review recorded',
  cleaning: 'Cleaning up',
  removed: 'Fully removed',
} as const;

const MODE_OPTIONS: { id: PreviewMode; label: string; detail: string }[] = [
  { id: 'single-service', label: 'PR label', detail: 'One service from one pull request' },
  {
    id: 'full-stack',
    label: 'Full-stack YAML',
    detail: 'Coordinate revisions across repositories',
  },
];

const DATA_OPTIONS: { id: DataStrategy; label: string }[] = [
  { id: 'synthetic', label: 'Synthetic fixtures' },
  { id: 'masked-snapshot', label: 'Masked snapshot' },
  { id: 'shared-stage', label: 'Shared stage data' },
];

const PROFILE_OPTIONS: { id: ResourceProfile; label: string }[] = [
  { id: 'lean', label: 'Lean' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'production-like', label: 'Production-like' },
];

const ACCESS_OPTIONS: { id: ReviewerAccess; label: string }[] = [
  { id: 'team-sso', label: 'Team SSO' },
  { id: 'vpn', label: 'Private VPN' },
  { id: 'public-link', label: 'Public token link' },
];

const SERVICE_LABELS: Record<PreviewService, string> = {
  web: 'Web',
  api: 'API',
  worker: 'Worker',
};

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border bg-background/70 px-3 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
              value === option.id
                ? 'border-blue-500/45 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                : 'bg-background/60 text-muted-foreground hover:border-blue-500/30 hover:text-foreground'
            )}
            aria-pressed={value === option.id}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function CleanupStatusIcon({ status }: { status: StageStatus }) {
  if (status === 'complete') return <Check className="h-3.5 w-3.5" />;
  if (status === 'active') return <CircleDashed className="h-3.5 w-3.5 animate-spin" />;
  return <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />;
}

export default function PreviewEnvironmentSimulator() {
  const [state, setState] = useState(createPreviewEnvironmentState);
  const [running, setRunning] = useState(false);
  const [selectedStage, setSelectedStage] = useState<PreviewStageId>('intent');

  const canAdvance = ['configured', 'running', 'cleaning'].includes(state.status);
  const metrics = useMemo(() => getPreviewMetrics(state.config), [state.config]);
  const evidence = useMemo(() => getPreviewEvidence(state.config), [state.config]);
  const generatedIntent = useMemo(() => getGeneratedIntent(state.config), [state.config]);
  const failure = state.activeFailure ? PREVIEW_FAILURES[state.activeFailure] : null;
  const selectedStageDetails =
    PREVIEW_STAGES.find((stage) => stage.id === selectedStage) ?? PREVIEW_STAGES[0];

  useEffect(() => {
    if (!running || !canAdvance) return;
    const timer = window.setInterval(() => {
      setState((current) => advancePreviewEnvironment(current));
    }, 950);
    return () => window.clearInterval(timer);
  }, [canAdvance, running]);

  const changeConfig = (settings: Partial<PreviewEnvironmentConfig>) => {
    setRunning(false);
    setState((current) => updatePreviewEnvironmentConfig(current, settings));
    setSelectedStage('intent');
  };

  const toggleService = (service: PreviewService) => {
    const services = state.config.services.includes(service)
      ? state.config.services.filter((candidate) => candidate !== service)
      : [...state.config.services, service];
    changeConfig({ services });
  };

  const reset = () => {
    setRunning(false);
    setState(createPreviewEnvironmentState(state.config));
    setSelectedStage('intent');
  };

  const startTeardown = (trigger: TeardownTrigger) => {
    setState((current) => beginPreviewTeardown(current, trigger));
    setRunning(true);
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-muted/15 shadow-sm">
      <div className="border-b bg-background/85 p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">PR #184 · checkout-v2</h2>
              <Badge
                variant="outline"
                className={cn(
                  state.status === 'blocked' &&
                    'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300',
                  (state.status === 'ready' || state.status === 'reviewed') &&
                    'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                  state.status === 'cleaning' &&
                    'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                )}
              >
                {STATUS_LABELS[state.status]}
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Configure the desired preview, reconcile it from Git, inspect the evidence, then prove
              cleanup is part of the lifecycle.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={running && canAdvance ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRunning((value) => !value)}
              disabled={!canAdvance}
              className="min-w-24"
            >
              {running && canAdvance ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running && canAdvance ? 'Pause' : 'Run flow'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setState((current) => advancePreviewEnvironment(current))}
              disabled={running || !canAdvance}
            >
              <StepForward className="h-4 w-4" />
              Step
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-b p-4 sm:p-5 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => changeConfig({ mode: option.id })}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  state.config.mode === option.id
                    ? 'border-blue-500/45 bg-blue-500/10'
                    : 'bg-background/60 hover:border-blue-500/30'
                )}
                aria-pressed={state.config.mode === option.id}
              >
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{option.detail}</span>
              </button>
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Participating services</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SERVICE_LABELS) as PreviewService[]).map((service) => {
                const selected = state.config.services.includes(service);
                return (
                  <button
                    key={service}
                    type="button"
                    onClick={() => toggleService(service)}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                      selected
                        ? 'border-blue-500/45 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                        : 'bg-background/60 text-muted-foreground'
                    )}
                    aria-pressed={selected}
                  >
                    <span
                      className={cn(
                        'grid h-4 w-4 place-items-center rounded-sm border',
                        selected && 'border-blue-500 bg-blue-500 text-white'
                      )}
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                    {SERVICE_LABELS[service]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ChoiceGroup
              label="Data policy"
              options={DATA_OPTIONS}
              value={state.config.dataStrategy}
              onChange={(dataStrategy) => changeConfig({ dataStrategy })}
            />
            <ChoiceGroup
              label="Resource profile"
              options={PROFILE_OPTIONS}
              value={state.config.resourceProfile}
              onChange={(resourceProfile) => changeConfig({ resourceProfile })}
            />
            <ChoiceGroup
              label="Reviewer access"
              options={ACCESS_OPTIONS}
              value={state.config.reviewerAccess}
              onChange={(reviewerAccess) => changeConfig({ reviewerAccess })}
            />
            <ChoiceGroup
              label="Time to live"
              options={[
                { id: '4', label: '4 hours' },
                { id: '8', label: '8 hours' },
                { id: '24', label: '24 hours' },
              ]}
              value={String(state.config.ttlHours)}
              onChange={(ttlHours) => changeConfig({ ttlHours: Number(ttlHours) })}
            />
          </div>
        </div>

        <div className="rounded-lg border bg-background/65 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Failure lab</p>
              <p className="text-xs text-muted-foreground">
                Inject one realistic control-plane fault.
              </p>
            </div>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <label
            className="mt-3 block text-xs font-medium text-muted-foreground"
            htmlFor="preview-failure"
          >
            Scenario
          </label>
          <select
            id="preview-failure"
            value={state.config.injectedFailure}
            onChange={(event) =>
              changeConfig({
                injectedFailure: event.target.value as PreviewEnvironmentConfig['injectedFailure'],
              })
            }
            className="mt-1.5 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          >
            <option value="none">Healthy reconciliation</option>
            {Object.values(PREVIEW_FAILURES).map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => changeConfig({ revisionGate: !state.config.revisionGate })}
            className="mt-3 flex w-full items-start gap-2.5 rounded-md border bg-muted/25 p-2.5 text-left"
            aria-pressed={state.config.revisionGate}
          >
            <span
              className={cn(
                'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border',
                state.config.revisionGate && 'border-blue-500 bg-blue-500 text-white'
              )}
            >
              {state.config.revisionGate && <Check className="h-3 w-3" />}
            </span>
            <span>
              <span className="block text-xs font-medium">Require deployed-revision evidence</span>
              <span className="block text-[11px] leading-relaxed text-muted-foreground">
                A healthy workload only counts when its observed image matches the pull request.
              </span>
            </span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Reconciled lifecycle
          </p>
          <p className="text-xs text-muted-foreground">Select a stage to inspect its contract.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PREVIEW_STAGES.map((stage, index) => {
            const Icon = STAGE_ICONS[stage.id];
            const status = state.stageStatuses[stage.id];
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setSelectedStage(stage.id)}
                className={cn(
                  'relative min-w-0 rounded-lg border p-3 text-left transition-colors',
                  STATUS_STYLES[status],
                  selectedStage === stage.id &&
                    'outline outline-2 outline-offset-1 outline-primary/25'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="font-mono text-[10px] opacity-70">0{index + 1}</span>
                </div>
                <span className="mt-3 block truncate text-xs font-semibold">
                  {stage.shortLabel}
                </span>
                <span className="mt-0.5 block truncate text-[10px] opacity-75">{status}</span>
              </button>
            );
          })}
        </div>

        <div
          className={cn(
            'mt-3 rounded-lg border px-3.5 py-3',
            state.status === 'blocked'
              ? 'border-red-500/35 bg-red-500/8'
              : state.status === 'ready' || state.status === 'reviewed'
                ? 'border-emerald-500/30 bg-emerald-500/8'
                : 'bg-background/65'
          )}
          aria-live="polite"
        >
          <div className="flex items-start gap-2.5">
            {state.status === 'blocked' ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            ) : state.status === 'ready' || state.status === 'reviewed' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <ServerCog className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            )}
            <p className="text-sm leading-relaxed">{state.lastEvent}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Metric
            icon={Clock3}
            label="Ready in"
            value={`${metrics.provisionMinutes}m`}
            hint="estimated"
          />
          <Metric
            icon={DollarSign}
            label="Runtime"
            value={`$${metrics.hourlyCost}`}
            hint="per hour"
          />
          <Metric
            icon={DollarSign}
            label="TTL budget"
            value={`$${metrics.estimatedRunCost}`}
            hint={`${state.config.ttlHours}h maximum`}
          />
          <Metric
            icon={KeyRound}
            label="Isolation"
            value={`${metrics.isolationScore}`}
            hint="out of 100"
          />
          <Metric
            icon={ShieldCheck}
            label="Confidence"
            value={`${metrics.confidenceScore}`}
            hint="out of 100"
          />
        </div>

        {failure && (
          <div className="mt-4 rounded-xl border border-red-500/35 bg-red-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <h3 className="font-semibold">{failure.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{failure.summary}</p>
                <code className="mt-2 block rounded-md border bg-background/70 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  {failure.signal}
                </code>
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {failure.remediationOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setState((current) => applyPreviewRemediation(current, option.id));
                    if (option.id === failure.correctRemediationId) setRunning(true);
                  }}
                  className="rounded-lg border bg-background/70 p-3 text-left transition-colors hover:border-blue-500/40"
                >
                  <span className="block text-xs font-semibold">{option.label}</span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                    {option.explanation}
                  </span>
                </button>
              ))}
            </div>
            {state.failedRemediationAttempts > 0 && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-300">
                {state.failedRemediationAttempts} attempted action
                {state.failedRemediationAttempts === 1 ? '' : 's'} did not change the failing
                signal.
              </p>
            )}
          </div>
        )}

        {(state.status === 'ready' || state.status === 'reviewed') && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-semibold">
                  {state.reviewDecision
                    ? state.reviewDecision === 'approve'
                      ? 'Evidence approved'
                      : 'Changes requested'
                    : 'The preview is evidence, not a production deploy'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Record the review decision, then remove every resource through a traceable
                  trigger.
                </p>
              </div>
              {!state.reviewDecision && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setState((current) => recordPreviewReview(current, 'approve'))}
                  >
                    <Check className="h-4 w-4" /> Approve evidence
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setState((current) => recordPreviewReview(current, 'request-changes'))
                    }
                  >
                    <X className="h-4 w-4" /> Request changes
                  </Button>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-emerald-500/20 pt-3">
              <span className="mr-1 self-center text-xs font-medium text-muted-foreground">
                Teardown:
              </span>
              {(
                [
                  ['pr-closed', 'Close PR'],
                  ['label-removed', 'Remove label'],
                  ['ttl-expired', 'Expire TTL'],
                  ['manual', 'Manual cleanup'],
                ] as [TeardownTrigger, string][]
              ).map(([trigger, label]) => (
                <Button
                  key={trigger}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => startTeardown(trigger)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> {label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {(state.status === 'cleaning' || state.status === 'removed') && (
          <div className="mt-4 rounded-xl border bg-background/65 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Reconciled teardown</h3>
                <p className="text-xs text-muted-foreground">
                  Triggered by {formatTeardownTrigger(state.teardownTrigger ?? 'manual')}.
                </p>
              </div>
              <Badge variant="outline">
                {state.status === 'removed' ? 'Zero resources remain' : 'In progress'}
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-5">
              {CLEANUP_STEPS.map((step) => {
                const status = state.cleanupStatuses[step.id as CleanupStepId];
                return (
                  <div
                    key={step.id}
                    className={cn('rounded-lg border p-2.5', STATUS_STYLES[status])}
                  >
                    <div className="flex items-center gap-2">
                      <CleanupStatusIcon status={status} />
                      <span className="text-xs font-semibold">{step.label}</span>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed opacity-75">{step.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-xl border bg-background/65 p-4">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold">Generated Git intent</h3>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-lg border bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200">
              {generatedIntent}
            </pre>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Git records the desired environment. Controllers make the cluster converge on it, so
              creation and deletion stay repeatable and auditable.
            </p>
          </div>

          <div className="rounded-xl border bg-background/65 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-semibold">Review evidence</h3>
              </div>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {evidence.commit}
              </Badge>
            </div>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Environment / namespace</dt>
                <dd className="mt-0.5 break-all font-mono">
                  {evidence.environmentId} / {evidence.namespace}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Access / expiry</dt>
                <dd className="mt-0.5">
                  {evidence.access} · {evidence.expiresIn}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Review URL</dt>
                <dd className="mt-0.5 break-all font-mono text-blue-700 dark:text-blue-300">
                  {evidence.reviewUrl}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Data source</dt>
                <dd className="mt-0.5">{evidence.dataSource}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Observed images</dt>
                <dd className="mt-0.5 break-all font-mono">{evidence.images.join(', ')}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-blue-500/25 bg-blue-500/5 p-4">
          <div className="flex items-start gap-3">
            <Workflow className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
            <div>
              <h3 className="text-sm font-semibold">Inspecting: {selectedStageDetails.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {selectedStageDetails.role}
              </p>
              <p className="mt-2 text-xs">
                <span className="font-semibold">Proof to retain:</span>{' '}
                <span className="text-muted-foreground">{selectedStageDetails.evidence}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
