/**
 * Pure state machine for the preview environment simulator.
 *
 * The browser component only renders this state and dispatches actions. Keeping
 * the lifecycle here makes the GitOps flow deterministic, testable, and easy to
 * extend with more failure scenarios without hiding behavior in timers.
 */

export type PreviewMode = 'single-service' | 'full-stack';
export type PreviewService = 'web' | 'api' | 'worker';
export type DataStrategy = 'synthetic' | 'masked-snapshot' | 'shared-stage';
export type ResourceProfile = 'lean' | 'balanced' | 'production-like';
export type ReviewerAccess = 'team-sso' | 'vpn' | 'public-link';
export type ReviewDecision = 'approve' | 'request-changes';
export type TeardownTrigger = 'pr-closed' | 'label-removed' | 'ttl-expired' | 'manual';

export type PreviewStageId =
  | 'intent'
  | 'coordinate'
  | 'reconcile'
  | 'provision'
  | 'expose'
  | 'verify';

export type CleanupStepId =
  | 'review-url'
  | 'workloads'
  | 'dependencies'
  | 'namespace'
  | 'git-intent';

export type StageStatus = 'pending' | 'active' | 'complete' | 'failed' | 'remediated';
export type EnvironmentStatus =
  | 'configured'
  | 'running'
  | 'blocked'
  | 'ready'
  | 'reviewed'
  | 'cleaning'
  | 'removed';

export type PreviewFailureId =
  | 'branch-mismatch'
  | 'quota-exceeded'
  | 'missing-secret'
  | 'dns-pending'
  | 'readiness-failure'
  | 'revision-drift';

export type InjectedFailureId = 'none' | PreviewFailureId;

export interface PreviewStage {
  id: PreviewStageId;
  shortLabel: string;
  title: string;
  role: string;
  evidence: string;
}

export const PREVIEW_STAGES: PreviewStage[] = [
  {
    id: 'intent',
    shortLabel: 'Intent',
    title: 'Pull request',
    role: 'A label or environment declaration records what should exist and which revisions belong in it.',
    evidence: 'PR number, label, repository, branch, and commit SHA',
  },
  {
    id: 'coordinate',
    shortLabel: 'Coordinate',
    title: 'Automation repository',
    role: 'The control plane resolves repositories, branch overrides, ownership, expiry, and environment identity.',
    evidence: 'Generated desired state and an idempotent environment key',
  },
  {
    id: 'reconcile',
    shortLabel: 'Reconcile',
    title: 'Argo CD ApplicationSet',
    role: 'Git metadata becomes Helm applications and Argo CD continuously compares desired and observed state.',
    evidence: 'Application parameters, chart revision, sync status, and drift',
  },
  {
    id: 'provision',
    shortLabel: 'Provision',
    title: 'Kubernetes namespace',
    role: 'A namespace, quotas, workloads, configuration, and secrets create the isolated runtime boundary.',
    evidence: 'Namespace, pods, requests, limits, and secret references',
  },
  {
    id: 'expose',
    shortLabel: 'Expose',
    title: 'Data, DNS & TLS',
    role: 'The environment receives its data policy, ingress route, certificate, and review URL.',
    evidence: 'Data source, hostname, certificate, ingress, and expiry',
  },
  {
    id: 'verify',
    shortLabel: 'Verify',
    title: 'Review evidence',
    role: 'Health, tests, logs, configuration differences, and deployed revisions return to the pull request.',
    evidence: 'Health gates, test results, image digests, logs, and cost estimate',
  },
];

export interface CleanupStep {
  id: CleanupStepId;
  label: string;
  detail: string;
}

export const CLEANUP_STEPS: CleanupStep[] = [
  {
    id: 'review-url',
    label: 'Remove review URL',
    detail: 'Delete ingress, DNS, and certificate state.',
  },
  {
    id: 'workloads',
    label: 'Remove workloads',
    detail: 'Prune generated Argo CD applications and pods.',
  },
  {
    id: 'dependencies',
    label: 'Remove dependencies',
    detail: 'Delete preview data, cache, and temporary storage.',
  },
  {
    id: 'namespace',
    label: 'Remove namespace',
    detail: 'Release quota, network policy, and namespace resources.',
  },
  {
    id: 'git-intent',
    label: 'Close desired state',
    detail: 'Record cleanup against the same Git intent that created it.',
  },
];

export interface RemediationOption {
  id: string;
  label: string;
  explanation: string;
}

export interface PreviewFailure {
  id: PreviewFailureId;
  label: string;
  summary: string;
  stage: PreviewStageId;
  signal: string;
  remediationOptions: [RemediationOption, RemediationOption, RemediationOption];
  correctRemediationId: string;
}

export const PREVIEW_FAILURES: Record<PreviewFailureId, PreviewFailure> = {
  'branch-mismatch': {
    id: 'branch-mismatch',
    label: 'Branch override missing',
    summary:
      'The API preview points at main while the web change expects the pull-request contract.',
    stage: 'coordinate',
    signal: 'Generated desired state shows api@main instead of api@feature/checkout-v2.',
    remediationOptions: [
      {
        id: 'restart-action',
        label: 'Restart the workflow',
        explanation: 'A retry reproduces the same incorrect desired state.',
      },
      {
        id: 'add-branch-override',
        label: 'Declare the API branch override',
        explanation: 'Make the coordinated stack name every non-default revision explicitly.',
      },
      {
        id: 'disable-health-gate',
        label: 'Disable the health gate',
        explanation: 'Health gates cannot fix the wrong code revision.',
      },
    ],
    correctRemediationId: 'add-branch-override',
  },
  'quota-exceeded': {
    id: 'quota-exceeded',
    label: 'Namespace quota exceeded',
    summary: 'The production-like profile requests more CPU than the preview pool can schedule.',
    stage: 'provision',
    signal: 'Pods remain Pending: exceeded quota preview-cpu, requested 6 cores, available 4.',
    remediationOptions: [
      {
        id: 'increase-replicas',
        label: 'Increase replicas',
        explanation: 'More replicas increase the unschedulable request.',
      },
      {
        id: 'right-size-preview',
        label: 'Use the balanced preview profile',
        explanation: 'Right-size non-production requests or request an approved quota change.',
      },
      {
        id: 'delete-readiness',
        label: 'Remove readiness probes',
        explanation: 'The scheduler rejects the pods before probes can run.',
      },
    ],
    correctRemediationId: 'right-size-preview',
  },
  'missing-secret': {
    id: 'missing-secret',
    label: 'Preview secret unavailable',
    summary: 'The checkout API references a secret that is not permitted in preview namespaces.',
    stage: 'provision',
    signal: 'CreateContainerConfigError: secret "payment-sandbox" not found.',
    remediationOptions: [
      {
        id: 'copy-production-secret',
        label: 'Copy the production secret',
        explanation: 'Production credentials must not cross the preview boundary.',
      },
      {
        id: 'map-preview-secret',
        label: 'Map an approved sandbox secret',
        explanation:
          'Bind the workload to a preview-scoped secret through the normal secret controller.',
      },
      {
        id: 'make-route-public',
        label: 'Make the route public',
        explanation: 'Reviewer access is unrelated to workload configuration.',
      },
    ],
    correctRemediationId: 'map-preview-secret',
  },
  'dns-pending': {
    id: 'dns-pending',
    label: 'DNS and certificate pending',
    summary: 'The workloads are healthy, but the review URL has no ready certificate.',
    stage: 'expose',
    signal:
      'Certificate remains Pending because the DNS challenge record targets the wrong hosted zone.',
    remediationOptions: [
      {
        id: 'bypass-tls',
        label: 'Share the pod IP',
        explanation: 'That bypasses the review boundary and is not a stable reviewer URL.',
      },
      {
        id: 'fix-dns-zone',
        label: 'Correct the preview DNS zone',
        explanation:
          'Reconcile the challenge record in the zone delegated for preview environments.',
      },
      {
        id: 'rebuild-images',
        label: 'Rebuild the images',
        explanation: 'The running images do not control DNS delegation.',
      },
    ],
    correctRemediationId: 'fix-dns-zone',
  },
  'readiness-failure': {
    id: 'readiness-failure',
    label: 'Readiness gate failed',
    summary: 'The API starts, but its database migration has not completed successfully.',
    stage: 'verify',
    signal: 'Readiness returns 503: migration 20260804_add_checkout_state is incomplete.',
    remediationOptions: [
      {
        id: 'force-ready',
        label: 'Mark the pod ready',
        explanation: 'Overriding readiness hides the failure from reviewers.',
      },
      {
        id: 'repair-migration',
        label: 'Repair and rerun the migration',
        explanation: 'Fix the failed dependency, then let the normal gate verify it again.',
      },
      {
        id: 'extend-ttl',
        label: 'Extend the TTL',
        explanation: 'More time does not repair a deterministic migration failure.',
      },
    ],
    correctRemediationId: 'repair-migration',
  },
  'revision-drift': {
    id: 'revision-drift',
    label: 'Deployed revision drift',
    summary:
      'Health checks pass, but the worker runs an older image than the commit recorded on the PR.',
    stage: 'verify',
    signal: 'Expected worker@sha-8f3c2a1; observed worker@sha-72ba640.',
    remediationOptions: [
      {
        id: 'approve-healthy',
        label: 'Approve because it is healthy',
        explanation: 'Healthy evidence for the wrong revision does not validate the change.',
      },
      {
        id: 'reconcile-revision',
        label: 'Reconcile the recorded image revision',
        explanation: 'Update desired state and wait until observed digests match the PR evidence.',
      },
      {
        id: 'hide-worker',
        label: 'Remove the worker from evidence',
        explanation: 'Hiding a participating service makes the review incomplete.',
      },
    ],
    correctRemediationId: 'reconcile-revision',
  },
};

export interface PreviewEnvironmentConfig {
  mode: PreviewMode;
  services: PreviewService[];
  dataStrategy: DataStrategy;
  resourceProfile: ResourceProfile;
  reviewerAccess: ReviewerAccess;
  ttlHours: number;
  revisionGate: boolean;
  injectedFailure: InjectedFailureId;
}

export const DEFAULT_PREVIEW_CONFIG: PreviewEnvironmentConfig = {
  mode: 'single-service',
  services: ['api'],
  dataStrategy: 'synthetic',
  resourceProfile: 'lean',
  reviewerAccess: 'team-sso',
  ttlHours: 8,
  revisionGate: true,
  injectedFailure: 'none',
};

export interface PreviewMetrics {
  provisionMinutes: number;
  hourlyCost: number;
  estimatedRunCost: number;
  isolationScore: number;
  confidenceScore: number;
}

export interface PreviewEvidence {
  environmentId: string;
  namespace: string;
  reviewUrl: string;
  commit: string;
  images: string[];
  dataSource: string;
  access: string;
  expiresIn: string;
}

export interface PreviewEnvironmentState {
  config: PreviewEnvironmentConfig;
  status: EnvironmentStatus;
  /** The deployment stage waiting to run. */
  stageIndex: number;
  stageStatuses: Record<PreviewStageId, StageStatus>;
  cleanupIndex: number;
  cleanupStatuses: Record<CleanupStepId, StageStatus>;
  resolvedFailures: PreviewFailureId[];
  activeFailure: PreviewFailureId | null;
  failedRemediationAttempts: number;
  reviewDecision: ReviewDecision | null;
  teardownTrigger: TeardownTrigger | null;
  lastEvent: string;
}

function stageStatusRecord<T extends string>(ids: T[]): Record<T, StageStatus> {
  return Object.fromEntries(ids.map((id) => [id, 'pending'])) as Record<T, StageStatus>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeConfig(settings: Partial<PreviewEnvironmentConfig>): PreviewEnvironmentConfig {
  const merged = { ...DEFAULT_PREVIEW_CONFIG, ...settings };
  const uniqueServices = [...new Set(merged.services)];
  return {
    ...merged,
    services: uniqueServices.length > 0 ? uniqueServices : ['api'],
    ttlHours: clamp(Math.round(merged.ttlHours), 1, 72),
  };
}

export function createPreviewEnvironmentState(
  settings: Partial<PreviewEnvironmentConfig> = {}
): PreviewEnvironmentState {
  const stageStatuses = stageStatusRecord(PREVIEW_STAGES.map((stage) => stage.id));
  stageStatuses.intent = 'active';
  return {
    config: normalizeConfig(settings),
    status: 'configured',
    stageIndex: 0,
    stageStatuses,
    cleanupIndex: 0,
    cleanupStatuses: stageStatusRecord(CLEANUP_STEPS.map((step) => step.id)),
    resolvedFailures: [],
    activeFailure: null,
    failedRemediationAttempts: 0,
    reviewDecision: null,
    teardownTrigger: null,
    lastEvent: 'Ready. Declare preview intent to start the control-plane flow.',
  };
}

function advanceCleanup(state: PreviewEnvironmentState): PreviewEnvironmentState {
  const step = CLEANUP_STEPS[state.cleanupIndex];
  if (!step) return state;

  const cleanupStatuses = { ...state.cleanupStatuses, [step.id]: 'complete' as const };
  const nextIndex = state.cleanupIndex + 1;
  const next = CLEANUP_STEPS[nextIndex];

  if (!next) {
    return {
      ...state,
      status: 'removed',
      cleanupIndex: nextIndex,
      cleanupStatuses,
      lastEvent: 'Cleanup reconciled. No preview resources remain, and Git records the outcome.',
    };
  }

  cleanupStatuses[next.id] = 'active';
  return {
    ...state,
    cleanupIndex: nextIndex,
    cleanupStatuses,
    lastEvent: `${step.label} complete. ${next.label} is next.`,
  };
}

export function advancePreviewEnvironment(state: PreviewEnvironmentState): PreviewEnvironmentState {
  if (
    state.status === 'blocked' ||
    state.status === 'ready' ||
    state.status === 'reviewed' ||
    state.status === 'removed'
  ) {
    return state;
  }
  if (state.status === 'cleaning') return advanceCleanup(state);

  const stage = PREVIEW_STAGES[state.stageIndex];
  if (!stage) return state;

  const failureId = state.config.injectedFailure;
  if (
    failureId !== 'none' &&
    PREVIEW_FAILURES[failureId].stage === stage.id &&
    !state.resolvedFailures.includes(failureId)
  ) {
    return {
      ...state,
      status: 'blocked',
      activeFailure: failureId,
      stageStatuses: { ...state.stageStatuses, [stage.id]: 'failed' },
      lastEvent: PREVIEW_FAILURES[failureId].signal,
    };
  }

  const stageStatuses = { ...state.stageStatuses, [stage.id]: 'complete' as const };
  const nextIndex = state.stageIndex + 1;
  const next = PREVIEW_STAGES[nextIndex];

  if (!next) {
    return {
      ...state,
      status: 'ready',
      stageIndex: nextIndex,
      stageStatuses,
      lastEvent:
        'Preview ready. Health, tests, revision, configuration, and expiry are attached to the pull request.',
    };
  }

  stageStatuses[next.id] = 'active';
  return {
    ...state,
    status: 'running',
    stageIndex: nextIndex,
    stageStatuses,
    lastEvent: `${stage.title} completed. ${next.title} is reconciling next.`,
  };
}

export function applyPreviewRemediation(
  state: PreviewEnvironmentState,
  remediationId: string
): PreviewEnvironmentState {
  if (state.status !== 'blocked' || !state.activeFailure) return state;
  const failure = PREVIEW_FAILURES[state.activeFailure];

  if (remediationId !== failure.correctRemediationId) {
    return {
      ...state,
      failedRemediationAttempts: state.failedRemediationAttempts + 1,
      lastEvent:
        failure.remediationOptions.find((option) => option.id === remediationId)?.explanation ??
        'That action does not resolve the failure.',
    };
  }

  return {
    ...state,
    status: 'running',
    activeFailure: null,
    resolvedFailures: [...state.resolvedFailures, failure.id],
    stageStatuses: { ...state.stageStatuses, [failure.stage]: 'remediated' },
    lastEvent: `Remediation accepted: ${failure.remediationOptions.find((option) => option.id === remediationId)?.explanation}`,
  };
}

export function recordPreviewReview(
  state: PreviewEnvironmentState,
  decision: ReviewDecision
): PreviewEnvironmentState {
  if (state.status !== 'ready') return state;
  return {
    ...state,
    status: 'reviewed',
    reviewDecision: decision,
    lastEvent:
      decision === 'approve'
        ? 'Engineer approved the evidence. Git records the decision; production remains a separate reviewed path.'
        : 'Engineer requested changes. The preview stays available until the next revision or its expiry policy.',
  };
}

export function beginPreviewTeardown(
  state: PreviewEnvironmentState,
  trigger: TeardownTrigger
): PreviewEnvironmentState {
  if (state.status === 'removed' || state.status === 'cleaning') return state;
  const cleanupStatuses = stageStatusRecord(CLEANUP_STEPS.map((step) => step.id));
  cleanupStatuses[CLEANUP_STEPS[0].id] = 'active';
  return {
    ...state,
    status: 'cleaning',
    cleanupIndex: 0,
    cleanupStatuses,
    teardownTrigger: trigger,
    activeFailure: null,
    lastEvent: `Teardown requested by ${formatTeardownTrigger(trigger)}. Cleanup now follows the same reconciled control path.`,
  };
}

export function updatePreviewEnvironmentConfig(
  state: PreviewEnvironmentState,
  settings: Partial<PreviewEnvironmentConfig>
): PreviewEnvironmentState {
  return createPreviewEnvironmentState({ ...state.config, ...settings });
}

export function getPreviewMetrics(config: PreviewEnvironmentConfig): PreviewMetrics {
  const serviceCount = config.services.length;
  const profileCost: Record<ResourceProfile, number> = {
    lean: 0.08,
    balanced: 0.16,
    'production-like': 0.31,
  };
  const profileMinutes: Record<ResourceProfile, number> = {
    lean: 1,
    balanced: 3,
    'production-like': 6,
  };
  const dataCost: Record<DataStrategy, number> = {
    synthetic: 0.02,
    'masked-snapshot': 0.12,
    'shared-stage': 0.03,
  };
  const dataMinutes: Record<DataStrategy, number> = {
    synthetic: 1,
    'masked-snapshot': 8,
    'shared-stage': 0,
  };

  const hourlyCost =
    serviceCount * profileCost[config.resourceProfile] +
    dataCost[config.dataStrategy] +
    0.05 +
    (config.mode === 'full-stack' ? 0.04 : 0);
  const provisionMinutes =
    2 +
    serviceCount * 2 +
    profileMinutes[config.resourceProfile] +
    dataMinutes[config.dataStrategy] +
    (config.mode === 'full-stack' ? 3 : 0);
  const isolationBase: Record<DataStrategy, number> = {
    synthetic: 96,
    'masked-snapshot': 88,
    'shared-stage': 48,
  };
  const accessPenalty: Record<ReviewerAccess, number> = {
    'team-sso': 0,
    vpn: 4,
    'public-link': 22,
  };
  const confidenceScore = clamp(
    48 +
      serviceCount * 8 +
      (config.mode === 'full-stack' ? 12 : 0) +
      (config.dataStrategy === 'masked-snapshot' ? 10 : 0) +
      (config.revisionGate ? 14 : 0),
    0,
    100
  );

  return {
    provisionMinutes,
    hourlyCost: Number(hourlyCost.toFixed(2)),
    estimatedRunCost: Number((hourlyCost * config.ttlHours).toFixed(2)),
    isolationScore: clamp(
      isolationBase[config.dataStrategy] - accessPenalty[config.reviewerAccess],
      0,
      100
    ),
    confidenceScore,
  };
}

export function getPreviewEvidence(config: PreviewEnvironmentConfig): PreviewEvidence {
  return {
    environmentId: config.mode === 'full-stack' ? 'checkout-uat-184' : 'pr-184-api',
    namespace: config.mode === 'full-stack' ? 'uat-checkout-184' : 'preview-pr-184',
    reviewUrl:
      config.mode === 'full-stack'
        ? 'https://checkout-uat-184.preview.example.dev'
        : 'https://api-pr-184.preview.example.dev',
    commit: '8f3c2a1',
    images: config.services.map((service) => `${service}:pr-184-8f3c2a1`),
    dataSource:
      config.dataStrategy === 'synthetic'
        ? 'Generated test fixtures'
        : config.dataStrategy === 'masked-snapshot'
          ? 'Masked stage snapshot snap-20260804'
          : 'Shared stage services',
    access:
      config.reviewerAccess === 'team-sso'
        ? 'Team SSO policy'
        : config.reviewerAccess === 'vpn'
          ? 'Private VPN route'
          : 'Public token link',
    expiresIn: `${config.ttlHours} hours`,
  };
}

export function formatTeardownTrigger(trigger: TeardownTrigger): string {
  const labels: Record<TeardownTrigger, string> = {
    'pr-closed': 'pull request closure',
    'label-removed': 'label removal',
    'ttl-expired': 'TTL expiry',
    manual: 'an engineer',
  };
  return labels[trigger];
}

export function getGeneratedIntent(config: PreviewEnvironmentConfig): string {
  if (config.mode === 'single-service') {
    return [
      'pull_request: 184',
      'label: preview',
      `services: [${config.services.join(', ')}]`,
      'revision: 8f3c2a1',
      `ttl: ${config.ttlHours}h`,
    ].join('\n');
  }

  return [
    'environment: checkout-uat-184',
    'trigger: fullstack-preview',
    'repositories:',
    ...config.services.map(
      (service) =>
        `  ${service}: ${service === 'worker' ? 'feature/checkout-events' : 'feature/checkout-v2'}`
    ),
    `data: ${config.dataStrategy}`,
    `ttl: ${config.ttlHours}h`,
  ].join('\n');
}
