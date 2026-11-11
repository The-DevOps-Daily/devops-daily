'use client';

import { useState, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { Database, Play, Server, Users } from 'lucide-react';
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
} from '@/components/games/sim';
import {
  DEFAULT_CONFIG,
  EXECUTION_STEPS,
  LAB_COPY,
  MISSIONS,
  POSTS,
  USERS,
  emptyLoaderCache,
  missionPassed,
  runQuery,
  type MissionRunHistory,
  type QueryFields,
  type QueryRun,
  type RunConfig,
} from '@/lib/games/graphql-dataloader-lab-engine';

const MISSION_DEFINITIONS: Mission<MissionRunHistory>[] = MISSIONS.map((mission) => ({
  ...mission,
  check: (history) => missionPassed(mission.id, history),
}));

function freshConfig(): RunConfig {
  return { ...DEFAULT_CONFIG, fields: { ...DEFAULT_CONFIG.fields } };
}

function Toggle({
  label,
  on,
  onClick,
  disabled = false,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-10 min-w-0 items-center justify-between gap-2 rounded-md border px-2 text-left text-xs disabled:opacity-50 lg:h-8',
        on ? 'border-correct/50 bg-correct/10' : 'border-border'
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="flex shrink-0 items-center gap-1.5 font-semibold">
        {on ? 'On' : 'Off'}
        <span
          aria-hidden="true"
          className={cn(
            'relative h-4 w-7 rounded-full transition-colors motion-reduce:transition-none',
            on ? 'bg-correct' : 'bg-muted-foreground/30'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-3 w-3 rounded-full bg-background transition-transform motion-reduce:transition-none',
              on ? 'translate-x-3.5' : 'translate-x-0.5'
            )}
          />
        </span>
      </span>
    </button>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; aria: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid min-w-0 gap-1 text-xs font-medium">
      <span>{label}</span>
      <div role="group" aria-label={label} className="flex rounded-md border p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={option.aria}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-9 min-w-0 flex-1 truncate rounded px-2 text-xs lg:h-7',
              value === option.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TreeNode({ label, on, children }: { label: string; on: boolean; children?: ReactNode }) {
  return (
    <li className="relative pl-4 before:absolute before:left-0 before:top-3 before:w-3 before:border-t before:border-border">
      <span
        className={cn(
          'inline-block max-w-full break-words rounded-md border px-2 py-0.5 font-mono text-xs',
          on
            ? 'border-primary/60 bg-primary/10 text-foreground'
            : 'border-dashed text-muted-foreground'
        )}
      >
        {label}
        {!on && ' (not requested)'}
      </span>
      {children && <ul className="ml-2 mt-1 space-y-1 border-l border-border">{children}</ul>}
    </li>
  );
}

function QueryTree({ fields }: { fields: QueryFields }) {
  const commentAuthors = fields.comments && fields.commentAuthors;
  const userFields = (on: boolean) => (
    <>
      <TreeNode label={LAB_COPY.schema.userName} on={on} />
      <TreeNode label={LAB_COPY.schema.userEmail} on={on && fields.userEmail} />
    </>
  );
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Server className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Requested query tree</h3>
      </div>
      <ul className="space-y-1" aria-label="GraphQL query tree">
        <TreeNode label={LAB_COPY.schema.posts} on>
          <TreeNode label={LAB_COPY.schema.postAuthor} on={fields.postAuthors}>
            {userFields(fields.postAuthors)}
          </TreeNode>
          <TreeNode label={LAB_COPY.schema.postComments} on={fields.comments}>
            <TreeNode label={LAB_COPY.schema.commentAuthor} on={commentAuthors}>
              {userFields(commentAuthors)}
            </TreeNode>
          </TreeNode>
        </TreeNode>
      </ul>
    </div>
  );
}

function Timeline({
  run,
  step,
  onStep,
}: {
  run: QueryRun | null;
  step: number;
  onStep: (step: number) => void;
}) {
  const selected = run?.steps[step];
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Execution timeline</h3>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">Step through the run: tick</span>
        <div role="group" aria-label="Execution tick" className="flex rounded-md border p-0.5">
          {EXECUTION_STEPS.map((definition, index) => (
            <button
              key={definition.id}
              type="button"
              disabled={!run}
              aria-label={`Tick ${definition.tick}: ${definition.title}`}
              aria-pressed={run !== null && index === step}
              onClick={() => onStep(index)}
              className={cn(
                'h-9 w-8 rounded font-mono text-xs disabled:opacity-50 lg:h-7',
                run && index === step
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {definition.tick}
            </button>
          ))}
        </div>
      </div>
      {!run && (
        <p className="text-sm text-muted-foreground">Run the query to trace each resolver level.</p>
      )}
      {selected && (
        <div className="space-y-2">
          <p className="font-mono text-xs text-muted-foreground">tick {selected.tick}</p>
          <p className="text-sm font-medium">{selected.summary}</p>
          <p className="text-xs text-muted-foreground">
            {selected.resolverCalls} resolver call{selected.resolverCalls === 1 ? '' : 's'} in this
            step
          </p>
          {selected.batches.map((batch) => (
            <div
              key={`${batch.loader}-${batch.tick}`}
              className="rounded-md border bg-muted/50 p-2 text-xs"
            >
              <p className="font-medium">{batch.loader} DataLoader batch</p>
              <p className="mt-1 text-muted-foreground">
                {batch.requestedKeys.length} load calls, {batch.uniqueKeys.length} unique keys,{' '}
                {batch.loadedKeys.length} sent to SQL, {batch.cacheHits.length} cache hits
              </p>
            </div>
          ))}
          {selected.batches.length === 0 && (
            <p className="text-xs text-muted-foreground">No DataLoader batch at this step.</p>
          )}
        </div>
      )}
    </div>
  );
}

function SqlLog({ run, step }: { run: QueryRun | null; step: number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Database className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">SQL log</h3>
      </div>
      <p className="mb-2 font-mono text-xs text-muted-foreground">
        {run ? `${run.queryCount} queries in this run` : 'No query run yet'}
      </p>
      {run && (
        <ol className="max-h-80 space-y-2 overflow-y-auto">
          {run.steps.map((runStep, index) =>
            runStep.sql.length === 0 ? null : (
              <li
                key={runStep.tick}
                className={cn(
                  'rounded-md border p-2',
                  index === step ? 'border-primary bg-primary/10' : 'border-transparent bg-muted/40'
                )}
              >
                <p className="text-xs font-medium">
                  tick {runStep.tick}, {runStep.title}: {runStep.sql.length}{' '}
                  {runStep.sql.length === 1 ? 'query' : 'queries'}
                </p>
                <ul className="mt-1 space-y-1">
                  {runStep.sql.map((query, queryIndex) => (
                    <li key={queryIndex} className="font-mono text-xs break-words">
                      {query.sql}
                      {query.parameters.length > 0 && (
                        <span className="text-muted-foreground">
                          {' '}
                          [{query.parameters.join(', ')}]
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            )
          )}
        </ol>
      )}
    </div>
  );
}

export default function GraphqlDataloaderLab() {
  const [config, setConfig] = useState<RunConfig>(freshConfig);
  const [sharedCache, setSharedCache] = useState(emptyLoaderCache);
  const [history, setHistory] = useState<MissionRunHistory>({ runs: [] });
  const [run, setRun] = useState<QueryRun | null>(null);
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState('query');
  const [dismissed, setDismissed] = useState(false);
  const missions = useMissions(MISSION_DEFINITIONS, history);

  const activeStep = run?.steps[step];
  const currentMission = missions.current;
  const viewer = USERS.find((user) => user.viewer === config.viewer) ?? USERS[0];
  const responseUsers = run
    ? [...new Map(run.responseUsers.map((user) => [user.id, user])).values()]
    : [];

  const changeField = (field: keyof QueryFields) => {
    setConfig((current) => ({
      ...current,
      fields: {
        ...current.fields,
        [field]:
          field === 'commentAuthors' ? !current.fields.commentAuthors : !current.fields[field],
      },
    }));
  };
  const runQueryNow = () => {
    const nextRun = runQuery(config, sharedCache);
    if (config.loaderScope === 'shared') setSharedCache(nextRun.nextSharedCache);
    setHistory((current) => ({ runs: [...current.runs, nextRun] }));
    setRun(nextRun);
    setStep(0);
    setTab('timeline');
  };
  const startOver = () => {
    setConfig(freshConfig());
    setSharedCache(emptyLoaderCache());
    setHistory({ runs: [] });
    setRun(null);
    setStep(0);
    setDismissed(false);
    missions.reset();
  };
  const setScope = (loaderScope: RunConfig['loaderScope']) =>
    setConfig((current) => ({ ...current, loaderScope }));
  const setViewer = (viewerId: RunConfig['viewer']) =>
    setConfig((current) => ({ ...current, viewer: viewerId }));
  const controls = (
    <details
      open
      className="rounded-lg border bg-card p-3"
      aria-label="Request and server settings"
    >
      <summary className="cursor-pointer text-sm font-semibold sm:hidden">
        Query fields and server
      </summary>
      <div className="mt-2 grid gap-3 sm:mt-0 md:grid-cols-2">
        <fieldset className="min-w-0">
          <legend className="text-xs font-semibold text-muted-foreground">Query fields</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <Toggle
              label="Post authors"
              on={config.fields.postAuthors}
              onClick={() => changeField('postAuthors')}
            />
            <Toggle
              label="Comments"
              on={config.fields.comments}
              onClick={() => changeField('comments')}
            />
            <Toggle
              label="Comment authors"
              on={config.fields.comments && config.fields.commentAuthors}
              disabled={!config.fields.comments}
              onClick={() => changeField('commentAuthors')}
            />
            <Toggle
              label="Request email"
              on={config.fields.userEmail}
              onClick={() => changeField('userEmail')}
            />
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="text-xs font-semibold text-muted-foreground">Server</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <Toggle
              label="Use User DataLoader"
              on={config.userLoader}
              onClick={() =>
                setConfig((current) => ({ ...current, userLoader: !current.userLoader }))
              }
            />
            <Toggle
              label="Use Comments DataLoader"
              on={config.commentsLoader}
              onClick={() =>
                setConfig((current) => ({ ...current, commentsLoader: !current.commentsLoader }))
              }
            />
            <Segmented
              label="Loader scope"
              value={config.loaderScope}
              onChange={setScope}
              options={[
                { value: 'per-request', label: 'Per request', aria: 'Per request' },
                { value: 'shared', label: 'Shared by all', aria: 'Shared by all requests' },
              ]}
            />
            <Segmented
              label="Viewer"
              value={config.viewer}
              onChange={setViewer}
              options={USERS.filter((user) => user.viewer).map((user) => ({
                value: user.viewer as RunConfig['viewer'],
                label: user.name,
                aria: `Viewer: ${user.name}`,
              }))}
            />
          </div>
        </fieldset>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <Button type="button" className="h-10 lg:h-8" onClick={runQueryNow}>
          <Play className="h-4 w-4" aria-hidden="true" /> Run query
        </Button>
        <span className="text-xs text-muted-foreground">
          {run
            ? `Last run: ${run.queryCount} SQL queries as ${viewer.name}.`
            : 'Choose the fields and the server setup, then run the query.'}
        </span>
      </div>
    </details>
  );

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title={LAB_COPY.title}
          icon={Database}
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          goal={
            currentMission ? (
              <>
                {currentMission.label}{' '}
                <span className="text-muted-foreground">{currentMission.hint}</span>
              </>
            ) : (
              LAB_COPY.freePlayGoal
            )
          }
        />
        {controls}
        <SimAnnouncer
          message={
            run
              ? `${run.queryCount} queries ran. Showing ${activeStep?.title ?? LAB_COPY.readyHeading}.`
              : 'Configure the request, then run the query.'
          }
        />
        {missions.complete && !dismissed ? (
          <SimComplete
            title="DataLoader lessons complete"
            summary="You measured N+1 queries, batched resolver work, and exposed why loaders belong to one request."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Last query count', value: run?.queryCount ?? POSTS.length },
              { label: 'Posts modelled', value: POSTS.length },
            ]}
            actions={
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => setDismissed(true)}
              >
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
                id: 'query',
                label: 'Query',
                content: <QueryTree fields={config.fields} />,
              },
              {
                id: 'timeline',
                label: 'Timeline',
                content: <Timeline run={run} step={step} onStep={setStep} />,
              },
              {
                id: 'database',
                label: 'SQL',
                content: (
                  <div className="space-y-2">
                    <SqlLog run={run} step={step} />
                    <section className="rounded-lg border bg-card p-3">
                      <h3 className="text-sm font-semibold">Details</h3>
                      <div className="mt-2">
                        <SimMissionList missions={missions.missions} />
                      </div>
                      {run && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-md bg-muted/50 p-2">
                            <p className="text-muted-foreground">Post author SQL</p>
                            <p className="font-mono text-sm">{run.postAuthorQueryCount}</p>
                          </div>
                          <div className="rounded-md bg-muted/50 p-2">
                            <p className="text-muted-foreground">Comment author SQL</p>
                            <p className="font-mono text-sm">{run.commentAuthorQueryCount}</p>
                          </div>
                        </div>
                      )}
                      {responseUsers.length > 0 && (
                        <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs">
                          <p className="font-medium">Response users</p>
                          <ul className="mt-1 space-y-1">
                            {responseUsers.map((user) => (
                              <li key={user.id} className="font-mono break-words">
                                {user.name}: {user.email ?? 'email null'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer font-medium text-muted-foreground">
                          Why this model batches
                        </summary>
                        <p className="mt-1 text-muted-foreground">{LAB_COPY.simplifiedModel}</p>
                        <p className="mt-1 text-muted-foreground">{LAB_COPY.awaitingNote}</p>
                      </details>
                    </section>
                  </div>
                ),
              },
            ]}
            columns="lg:grid-cols-3"
            tab={tab}
            onTabChange={setTab}
            tabsLabel="Lab views"
            minHeight="min-h-[19rem]"
          />
        )}
        {run && !missions.complete && (
          <SimFeedback tone="info" label="Latest run" role="status">
            {run.queryCount} queries. The selected step shows its tick and SQL.
          </SimFeedback>
        )}
        {(!missions.complete || dismissed) && (
          <SimPhoneBar>
            <Button type="button" className="h-10 flex-1" onClick={runQueryNow}>
              <Play className="h-4 w-4" aria-hidden="true" /> Run query
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={!run || step === 0}
              aria-label="Previous step"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={!run || step === EXECUTION_STEPS.length - 1}
              aria-label="Next step"
              onClick={() =>
                setStep((current) => Math.min(EXECUTION_STEPS.length - 1, current + 1))
              }
            >
              Next
            </Button>
          </SimPhoneBar>
        )}
      </SimFrame>
    </MotionConfig>
  );
}
