'use client';

import { useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { ArrowLeft, ArrowRight, CreditCard, Database, Send, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimMissionList,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  useMissions,
  type Mission,
  type SimStep,
} from '@/components/games/sim';
import {
  AMOUNT_CENTS,
  BUCKET_MS,
  HTTP_STATUS,
  KEY_RETENTION_HOURS,
  MAX_ATTEMPTS,
  OUTAGE_CLIENTS,
  OUTAGE_MS,
  RETRY_BASE_MS,
  RETRY_CAP_MS,
  createLab,
  formatCurrency,
  formatKeyExpiry,
  missionChecks,
  runConcurrentConflict,
  runDeadLetterJob,
  runLostResponse,
  runOutage,
  runPayloadMismatch,
  type LabState,
  type OutageRun,
} from '@/lib/games/idempotency-retry-lab-engine';

const MISSIONS: Array<Mission<LabState>> = [
  {
    id: 'duplicate',
    label: 'Lose a response without an idempotency key and watch the customer pay twice.',
    hint: 'Press Run duplicate checkout: the server charges, the response is lost, and the client retries without a key.',
    check: (state) => missionChecks(state).duplicate,
  },
  {
    id: 'with-key',
    label: 'Do it again with an idempotency key: one charge, same answer.',
    hint: 'Press Run keyed checkout: the retry carries the same key, so the saved response comes back.',
    check: (state) => missionChecks(state)['with-key'],
  },
  {
    id: 'mismatch',
    label: 'Reuse a key with a different amount and get refused.',
    hint: 'Press Reuse key with new amount: a key belongs to one exact request, so the API refuses it.',
    check: (state) => missionChecks(state).mismatch,
  },
  {
    id: 'conflict',
    label: 'Send the same keyed request twice at once.',
    hint: 'Press Send two at once: the second request arrives while the first is still running.',
    check: (state) => missionChecks(state).conflict,
  },
  {
    id: 'jitter',
    label: 'Ride out the outage with full jitter.',
    hint: 'Press Run no backoff, then Run full jitter, and compare the peak load.',
    check: (state) => missionChecks(state).jitter,
  },
  {
    id: 'dlq',
    label: 'Send a job to the dead-letter queue.',
    hint: 'Press Run down API job: the API stays down for longer than five attempts.',
    check: (state) => missionChecks(state).dlq,
  },
];

const GUIDED_STEPS = ['Request', 'Charge', 'Response', 'Retry', 'Result'];

function steps(current: number): SimStep[] {
  return GUIDED_STEPS.map((title, index) => ({
    title,
    status: index < current ? 'done' : index === current ? 'started' : 'todo',
  }));
}

function lastStatus(state: LabState): string {
  const latest = state.events[state.events.length - 1];
  if (!latest) return 'Ready to model one checkout.';
  if (latest.status === 'lost') return 'The response was lost after the API acted.';
  return `${latest.label}: ${latest.status}${latest.replayed ? ', replayed' : ''}.`;
}

function SequenceDiagram({ state }: { state: LabState }) {
  const rows = state.events.slice(-5);
  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Checkout sequence</h3>
          <p className="text-xs text-muted-foreground">
            One row per observed request or response event.
          </p>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          POST /charges {formatCurrency(AMOUNT_CENTS)}
        </span>
      </div>
      <svg
        role="img"
        aria-label="Sequence diagram showing the client, network, payments API, idempotency store, and ledger for the current checkout events"
        viewBox="0 0 600 190"
        className="hidden h-auto w-full sm:block"
      >
        <defs>
          <marker
            id="idempotency-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" className="fill-primary" />
          </marker>
        </defs>
        {['Client', 'Network', 'Payments API', 'Idempotency store', 'Ledger'].map(
          (label, index) => {
            const x = 54 + index * 123;
            return (
              <g key={label}>
                <rect
                  x={x - 48}
                  y="6"
                  width="96"
                  height="28"
                  rx="5"
                  className="fill-muted stroke-border"
                />
                <text
                  x={x}
                  y="24"
                  textAnchor="middle"
                  className="fill-foreground text-xs font-medium"
                >
                  {label}
                </text>
                <line
                  x1={x}
                  y1="35"
                  x2={x}
                  y2="185"
                  className="stroke-border"
                  strokeDasharray="3 3"
                />
              </g>
            );
          }
        )}
        {rows.length === 0 ? (
          <text x="300" y="110" textAnchor="middle" className="fill-muted-foreground text-xs">
            Run a checkout to draw the path.
          </text>
        ) : (
          rows.map((item, index) => {
            const y = 56 + index * 25;
            const lost = item.status === 'lost';
            const fromStore = item.status === HTTP_STATUS.conflict || item.replayed;
            const charged = lost || (item.status === HTTP_STATUS.success && !item.replayed);
            const from = fromStore ? 423 : 300;
            const to = lost ? 177 : 54;
            const tone = lost
              ? 'stroke-wrong'
              : item.status === HTTP_STATUS.success
                ? 'stroke-primary'
                : 'stroke-partial';
            return (
              <g key={item.id}>
                {charged && (
                  <>
                    <line
                      x1={300}
                      y1={y}
                      x2={546}
                      y2={y}
                      className="stroke-correct"
                      strokeWidth="2"
                    />
                    <circle cx={546} cy={y} r="5" className="fill-correct" />
                    <text x={423} y={y - 4} textAnchor="middle" className="fill-foreground text-xs">
                      charge saved
                    </text>
                  </>
                )}
                <line
                  x1={from}
                  y1={y}
                  x2={to}
                  y2={y}
                  className={tone}
                  strokeWidth="2"
                  strokeDasharray={lost ? '5 4' : undefined}
                  markerEnd={lost ? undefined : 'url(#idempotency-arrow)'}
                />
                {lost && (
                  <text
                    x={to}
                    y={y + 4}
                    textAnchor="middle"
                    className="fill-wrong-foreground text-xs font-semibold"
                  >
                    ✕
                  </text>
                )}
                <text
                  x={(from + to) / 2}
                  y={y - 4}
                  textAnchor="middle"
                  className="fill-foreground text-xs"
                >
                  {lost ? 'response lost' : `${item.status}${item.replayed ? ' replay' : ''}`}
                </text>
              </g>
            );
          })
        )}
      </svg>
      <ol className="space-y-1 sm:hidden">
        {rows.length === 0 ? (
          <li className="text-xs text-muted-foreground">Run a checkout to see its requests.</li>
        ) : (
          rows.map((item) => (
            <li key={item.id} className="flex items-baseline gap-2 text-xs">
              <span
                className={cn(
                  'shrink-0 rounded border px-1.5 font-mono font-semibold',
                  item.status === 'lost'
                    ? 'border-wrong/50 bg-wrong/10 text-wrong-foreground'
                    : item.status === HTTP_STATUS.success
                      ? 'border-correct/50 bg-correct/10 text-correct-foreground'
                      : 'border-partial/60 bg-partial/10 text-partial-foreground'
                )}
              >
                {item.status === 'lost' ? 'lost' : item.status}
                {item.replayed ? ' replay' : ''}
              </span>
              <span>{item.label}</span>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}

function OutageChart({ state }: { state: LabState }) {
  const runs = [state.outageRuns.none, state.outageRuns['full-jitter']].filter(
    (run): run is OutageRun => !!run
  );
  const peak = Math.max(...runs.map((run) => run.peakRequests), 1);
  return (
    <section className="rounded-lg border bg-card p-3">
      <h3 className="text-sm font-semibold">Outage arrival chart</h3>
      <p className="text-xs text-muted-foreground">
        A simplified model: {OUTAGE_CLIENTS} clients call during a {OUTAGE_MS / 1000} s outage. Each
        bar is {BUCKET_MS} ms.
      </p>
      {runs.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Run no backoff, then full jitter to compare peaks.
        </p>
      ) : (
        <div className="mt-2 space-y-3">
          {runs.map((run) => (
            <div key={run.mode}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">
                  {run.mode === 'none' ? 'No backoff' : 'Full jitter'}
                </span>
                <span className="font-mono text-muted-foreground">
                  peak {run.peakRequests} requests
                </span>
              </div>
              <div
                className="mt-1 flex h-12 items-end gap-px"
                aria-label={`${run.mode} requests per ${BUCKET_MS} milliseconds`}
              >
                {run.buckets.map((bucket) => (
                  <span
                    key={bucket.startMs}
                    title={`t+${bucket.startMs} ms: ${bucket.requests} requests`}
                    className={
                      run.mode === 'none'
                        ? 'min-w-1 flex-1 bg-partial'
                        : 'min-w-1 flex-1 bg-primary'
                    }
                    style={{
                      height: `${Math.max(8, Math.round((bucket.requests / peak) * 100))}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const MISSION_ACTIONS: Record<string, string[]> = {
  duplicate: ['duplicate'],
  'with-key': ['with-key'],
  mismatch: ['mismatch'],
  conflict: ['conflict'],
  jitter: ['none', 'full-jitter'],
  dlq: ['dlq'],
};

function ActionPanel({
  state,
  update,
  missionId,
}: {
  state: LabState;
  update: (next: LabState) => void;
  missionId?: string;
}) {
  const highlight = (missionId && MISSION_ACTIONS[missionId]) || [];
  const variant = (kind: string) => (highlight.includes(kind) ? 'default' : 'outline');
  const run = (
    kind: 'duplicate' | 'with-key' | 'mismatch' | 'conflict' | 'none' | 'full-jitter' | 'dlq'
  ) => {
    if (kind === 'duplicate') update(runLostResponse(state, false));
    if (kind === 'with-key') update(runLostResponse(state, true));
    if (kind === 'mismatch') update(runPayloadMismatch(state));
    if (kind === 'conflict') update(runConcurrentConflict(state));
    if (kind === 'none') update(runOutage(state, 'none'));
    if (kind === 'full-jitter') update(runOutage(state, 'full-jitter'));
    if (kind === 'dlq') update(runDeadLetterJob(state));
  };
  return (
    <section className="rounded-lg border bg-card p-3">
      <h3 className="text-sm font-semibold">Run an experiment</h3>
      <p className="text-xs text-muted-foreground">
        Each action adds its observed outcome to the shared API model.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant={variant('duplicate')}
          className="h-10 justify-start"
          onClick={() => run('duplicate')}
        >
          <Send className="h-4 w-4" aria-hidden="true" /> Run duplicate checkout
        </Button>
        <Button
          variant={variant('with-key')}
          type="button"
          className="h-10 justify-start"
          onClick={() => run('with-key')}
        >
          <CreditCard className="h-4 w-4" aria-hidden="true" /> Run keyed checkout
        </Button>
        <Button
          variant={variant('mismatch')}
          type="button"
          className="h-10 justify-start"
          onClick={() => run('mismatch')}
        >
          Reuse key with new amount
        </Button>
        <Button
          variant={variant('conflict')}
          type="button"
          className="h-10 justify-start"
          onClick={() => run('conflict')}
        >
          Send two at once
        </Button>
        <Button
          variant={variant('none')}
          type="button"
          className="h-10 justify-start"
          onClick={() => run('none')}
        >
          Run no backoff
        </Button>
        <Button
          variant={variant('full-jitter')}
          type="button"
          className="h-10 justify-start"
          onClick={() => run('full-jitter')}
        >
          Run full jitter
        </Button>
        <Button
          variant={variant('dlq')}
          type="button"
          className="h-10 justify-start sm:col-span-2"
          onClick={() => run('dlq')}
        >
          <TriangleAlert className="h-4 w-4" aria-hidden="true" /> Run down API job
        </Button>
      </div>
    </section>
  );
}

function DataReadout({ state }: { state: LabState }) {
  return (
    <div className="space-y-2">
      <section className="rounded-lg border bg-card p-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Database className="h-4 w-4 text-primary" aria-hidden="true" /> Ledger
        </h3>
        {state.ledger.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No charges yet.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-xs">
            {state.ledger.map((charge) => (
              <li key={charge.id} className="flex justify-between gap-2 font-mono">
                <span>{charge.id}</span>
                <span>{formatCurrency(charge.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-lg border bg-card p-3">
        <h3 className="text-sm font-semibold">Idempotency store</h3>
        {state.store.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No keyed requests yet.</p>
        ) : (
          <ul className="mt-1 space-y-2 text-xs">
            {state.store.map((row) => (
              <li key={row.key} className="rounded border bg-muted/40 p-2">
                <p className="break-all font-mono">{row.key}</p>
                <p>{row.fingerprint}</p>
                <p className="text-muted-foreground">
                  {row.state} ·{' '}
                  {row.savedResponse
                    ? `${row.savedResponse.status} ${row.savedResponse.body}`
                    : 'no response yet'}{' '}
                  · {formatKeyExpiry()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <details className="rounded-lg border bg-card p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Rules behind the model</summary>
        <div className="mt-2 space-y-2 text-xs text-muted-foreground">
          <p>
            A UUID v4 belongs to one intended operation and travels with every retry. The first
            execution saves its status and body, including a {HTTP_STATUS.unavailable} response.
          </p>
          <p>
            A different payload gets {HTTP_STATUS.mismatch} Unprocessable Content. Stripe describes
            this as an idempotency error. While an earlier call is processing, the API returns{' '}
            {HTTP_STATUS.conflict} Conflict; a later retry gets the saved response.
          </p>
          <p>
            Retry network errors, {HTTP_STATUS.conflict}, {HTTP_STATUS.rateLimited} and{' '}
            {HTTP_STATUS.serverError} responses. Do not retry {HTTP_STATUS.badRequest} or{' '}
            {HTTP_STATUS.mismatch}. Exponential backoff starts at {RETRY_BASE_MS} ms, caps at{' '}
            {RETRY_CAP_MS / 1000} s, and this lab stops after {MAX_ATTEMPTS} attempts.
          </p>
          <p>
            Expired keys are removed after at least {KEY_RETENTION_HOURS} hours. Dead-lettered jobs
            retain the key and final error but do not retry themselves.
          </p>
        </div>
      </details>
    </div>
  );
}

export default function IdempotencyRetryLab() {
  const [state, setState] = useState(createLab);
  const [guidedStep, setGuidedStep] = useState(0);
  const [tab, setTab] = useState('lab');
  const [dismissed, setDismissed] = useState(false);
  const missions = useMissions(MISSIONS, state);
  const startOver = () => {
    setState(createLab());
    setGuidedStep(0);
    setDismissed(false);
    missions.reset();
  };
  const current = missions.current;
  const primary = () => {
    const id = current?.id;
    if (id === 'duplicate') setState(runLostResponse(state, false));
    if (id === 'with-key') setState(runLostResponse(state, true));
    if (id === 'mismatch') setState(runPayloadMismatch(state));
    if (id === 'conflict') setState(runConcurrentConflict(state));
    if (id === 'jitter') setState(runOutage(state, state.outageRuns.none ? 'full-jitter' : 'none'));
    if (id === 'dlq') setState(runDeadLetterJob(state));
  };
  const primaryLabel =
    current?.id === 'jitter' && state.outageRuns.none
      ? 'Run full jitter'
      : current?.id === 'jitter'
        ? 'Run no backoff'
        : 'Run current mission';

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="Idempotency and Retry Lab"
          icon={CreditCard}
          steps={steps(guidedStep)}
          current={guidedStep}
          onStep={setGuidedStep}
          stepNoun="Replay step"
          stepsLabel="Replay steps"
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={`Replay step: ${GUIDED_STEPS[guidedStep]}`}
          actions={
            <div className="hidden gap-1 sm:flex">
              <Button
                type="button"
                variant="ghost"
                className="h-10 lg:h-8"
                disabled={guidedStep === 0}
                onClick={() => setGuidedStep((step) => Math.max(0, step - 1))}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Previous
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-10 lg:h-8"
                disabled={guidedStep === GUIDED_STEPS.length - 1}
                onClick={() => setGuidedStep((step) => Math.min(GUIDED_STEPS.length - 1, step + 1))}
              >
                Next <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          }
          goal={
            current ? (
              <>
                {current.label} <span className="text-muted-foreground">{current.hint}</span>
              </>
            ) : (
              'All missions complete. Explore any checkout or retry pattern.'
            )
          }
        />
        <SimAnnouncer message={lastStatus(state)} />
        {missions.complete && !dismissed ? (
          <SimComplete
            title="Idempotency and retry lab complete"
            summary="You separated ambiguous delivery from duplicate execution, then spread retries and preserved the final failure."
            stats={[
              { label: 'Charges', value: state.ledger.length },
              { label: 'Saved keys', value: state.store.length },
              { label: 'Dead letters', value: state.deadLetters.length },
            ]}
            actions={
              <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
                Keep exploring
              </Button>
            }
            onPlayAgain={startOver}
            playAgainLabel="Start over"
          />
        ) : (
          <SimStage
            panels={[
              {
                id: 'lab',
                label: 'Lab',
                content: (
                  <div className="space-y-2">
                    <ActionPanel state={state} update={setState} missionId={missions.current?.id} />
                    <SequenceDiagram state={state} />
                    <OutageChart state={state} />
                    <SimFeedback tone="info" label="Current outcome">
                      <p>{lastStatus(state)}</p>
                    </SimFeedback>
                  </div>
                ),
              },
              {
                id: 'details',
                label: 'Details',
                content: (
                  <div className="space-y-2">
                    <SimMissionList missions={missions.missions} />
                    <DataReadout state={state} />
                  </div>
                ),
              },
            ]}
            columns="lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]"
            tab={tab}
            onTabChange={setTab}
            tabsLabel="Lab panels"
            minHeight="min-h-[24rem]"
          />
        )}
        <SimPhoneBar>
          <Button type="button" className="h-10 flex-1" onClick={primary} disabled={!current}>
            {primaryLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => setGuidedStep((step) => Math.min(GUIDED_STEPS.length - 1, step + 1))}
            aria-label="Next checkout stage"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
