'use client';

import { useEffect, useMemo, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleGauge,
  Database,
  FileInput,
  Filter,
  Layers3,
  Pause,
  Play,
  RotateCcw,
  Search,
  StepForward,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFrame,
  SimMissionList,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  useMissions,
  type Mission,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';
import {
  LOG_SCENARIOS,
  PIPELINE_STAGES,
  advancePipeline,
  createPipelineState,
  getPipelineHealth,
  updatePipelineSettings,
  type IndexedLog,
  type LogLevel,
  type LogScenarioId,
  type ParserMode,
  type PipelineStageId,
} from '@/lib/games/log-aggregation-pipeline-engine';

const STAGE_ICONS: Record<PipelineStageId, LucideIcon> = {
  sources: Boxes,
  collector: FileInput,
  processor: Filter,
  buffer: Layers3,
  storage: Database,
  query: Search,
};

const LEVEL_STYLES: Record<LogLevel, string> = {
  INFO: `${SIM_TONE.info.surface} ${SIM_TONE.info.text}`,
  WARN: `${SIM_TONE.warning.surface} ${SIM_TONE.warning.text}`,
  ERROR: `${SIM_TONE.danger.surface} ${SIM_TONE.danger.text}`,
};

const HEALTH_STYLES = {
  healthy: {
    icon: CheckCircle2,
    word: 'Healthy',
    className: `${SIM_TONE.success.surface} ${SIM_TONE.success.text}`,
  },
  warning: {
    icon: CircleGauge,
    word: 'Warning',
    className: `${SIM_TONE.warning.surface} ${SIM_TONE.warning.text}`,
  },
  critical: {
    icon: AlertTriangle,
    word: 'Critical',
    className: `${SIM_TONE.danger.surface} ${SIM_TONE.danger.text}`,
  },
} as const;

type LogMissionState = {
  scenarioId: LogScenarioId;
  indexed: number;
  dropped: number;
  parseFailed: number;
  tone: 'healthy' | 'warning' | 'critical';
  inspectedStage: PipelineStageId;
  detailView: 'inspect' | 'search';
  level: 'ALL' | LogLevel;
  visible: number;
};

const MISSIONS: Mission<LogMissionState>[] = [
  {
    id: 'searchable',
    label: 'Run the healthy flow until logs reach search, then open Search.',
    hint: 'Logs become searchable after the storage stage.',
    check: (state) =>
      state.scenarioId === 'healthy' && state.indexed > 0 && state.detailView === 'search',
  },
  {
    id: 'spike-drop',
    label: 'Run the traffic spike until logs are dropped, then inspect where they pile up.',
    hint: 'The collector moves fewer logs than the sources send.',
    check: (state) =>
      state.scenarioId === 'spike' &&
      state.dropped > 0 &&
      (state.inspectedStage === 'sources' || state.inspectedStage === 'collector'),
  },
  {
    id: 'parser',
    label: 'In the parser mismatch, find the stage that rejects events.',
    hint: 'Parsing happens in the processor.',
    check: (state) =>
      state.scenarioId === 'parse-failure' &&
      state.parseFailed > 0 &&
      state.inspectedStage === 'processor',
  },
  {
    id: 'backpressure',
    label: 'Run slow indexing until backpressure builds, then inspect the slow stage.',
    hint: 'Storage indexes only 9 logs a cycle.',
    check: (state) =>
      state.scenarioId === 'slow-index' &&
      state.tone !== 'healthy' &&
      state.inspectedStage === 'storage',
  },
  {
    id: 'errors',
    label: 'During the spike, filter search to ERROR logs.',
    hint: 'Open Search, then pick the ERROR level.',
    check: (state) =>
      state.scenarioId === 'spike' &&
      state.detailView === 'search' &&
      state.level === 'ERROR' &&
      state.visible > 0,
  },
];

function queueLabel(stage: PipelineStageId, state: ReturnType<typeof createPipelineState>) {
  const scenario = LOG_SCENARIOS[state.scenarioId];
  switch (stage) {
    case 'sources':
      return `${state.sourceQueue} waiting`;
    case 'collector':
      return `${state.processQueue} for parsing`;
    case 'processor':
      return `${state.filtered + state.parseFailed} removed`;
    case 'buffer':
      return `${state.bufferQueue} / ${scenario.bufferCapacity}`;
    case 'storage':
      return `${state.indexed} indexed`;
    case 'query':
      return `${state.indexedLogs.length} samples`;
  }
}

function Metric({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: number;
  hint: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0 rounded-md border bg-card px-2 py-1.5">
      <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('font-mono text-lg font-semibold tabular-nums', valueClassName)}>{value}</p>
      <p className="truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function LogRow({ log }: { log: IndexedLog }) {
  return (
    <div className="grid gap-1 border-b px-3 py-2 last:border-b-0 sm:grid-cols-[68px_76px_minmax(0,1fr)_60px] sm:items-center">
      <Badge variant="outline" className={cn('w-fit font-mono text-xs', LEVEL_STYLES[log.level])}>
        {log.level}
      </Badge>
      <span className="font-mono text-xs text-muted-foreground">{log.service}</span>
      <span className="min-w-0 truncate font-mono text-xs" title={log.message}>
        {log.message}
      </span>
      <span className="text-xs text-muted-foreground">shard {log.shard}</span>
    </div>
  );
}

type Tab = 'pipeline' | 'stage' | 'output';

export default function LogAggregationPipelineSimulator() {
  const [state, setState] = useState(createPipelineState);
  const [running, setRunning] = useState(false);
  const [inspectedStage, setInspectedStage] = useState<PipelineStageId>('sources');
  const [detailView, setDetailView] = useState<'inspect' | 'search'>('inspect');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<'ALL' | LogLevel>('ALL');
  const [tab, setTab] = useState<Tab>('pipeline');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setState((current) => advancePipeline(current));
    }, 1050);
    return () => window.clearInterval(timer);
  }, [running]);

  const nextStage = PIPELINE_STAGES[state.stageIndex];
  const inspected = PIPELINE_STAGES.find((stage) => stage.id === inspectedStage) ?? nextStage;
  const health = getPipelineHealth(state);
  const healthStyle = HEALTH_STYLES[health.tone];
  const HealthIcon = healthStyle.icon;
  const visibleLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return state.indexedLogs.filter((log) => {
      const matchesLevel = level === 'ALL' || log.level === level;
      const haystack =
        `${log.level} ${log.service} ${log.message} ${log.parser} shard ${log.shard}`.toLowerCase();
      return matchesLevel && (!normalized || haystack.includes(normalized));
    });
  }, [level, query, state.indexedLogs]);
  const missionState = useMemo(
    () => ({
      scenarioId: state.scenarioId,
      indexed: state.indexed,
      dropped: state.dropped,
      parseFailed: state.parseFailed,
      tone: health.tone,
      inspectedStage,
      detailView,
      level,
      visible: visibleLogs.length,
    }),
    [detailView, health.tone, inspectedStage, level, state, visibleLogs.length]
  );
  const missions = useMissions(MISSIONS, missionState);

  const reset = () => {
    setRunning(false);
    setState(
      createPipelineState({
        scenarioId: state.scenarioId,
        parserMode: state.parserMode,
        filterNoise: state.filterNoise,
      })
    );
    setInspectedStage('sources');
  };

  const changeSettings = (settings: {
    scenarioId?: LogScenarioId;
    parserMode?: ParserMode;
    filterNoise?: boolean;
  }) => {
    setRunning(false);
    setState((current) => updatePipelineSettings(current, settings));
    setInspectedStage('sources');
  };

  const inspectStage = (stage: PipelineStageId) => {
    setInspectedStage(stage);
    setDetailView('inspect');
  };

  const startOver = () => {
    reset();
    missions.reset();
    setDismissed(false);
    setDetailView('inspect');
    setLevel('ALL');
    setQuery('');
  };
  const step = () => setState((current) => advancePipeline(current));

  const pipelinePanel = (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {PIPELINE_STAGES.map((stage, index) => {
          const Icon = STAGE_ICONS[stage.id];
          const isNext = index === state.stageIndex;
          const isInspected = stage.id === inspectedStage;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => {
                inspectStage(stage.id);
                if (!window.matchMedia('(min-width: 1024px)').matches) setTab('stage');
              }}
              aria-pressed={isInspected}
              className={cn(
                'flex min-h-14 flex-col rounded-md border bg-card p-2 text-left',
                isInspected && 'border-foreground/30 bg-muted/40',
                isNext && 'border-primary ring-2 ring-primary/15'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground',
                    isNext && 'bg-primary text-primary-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {isNext && <span className="text-xs font-semibold text-primary">Next</span>}
              </div>
              <span className="mt-1 truncate text-sm font-semibold">{stage.shortLabel}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {queueLabel(stage.id, state)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {state.stageIndex + 1}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">Next: {nextStage.title}</p>
          <p className="text-xs text-muted-foreground">Last step: {state.lastEvent}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <Metric label="Generated" value={state.generated} hint="all incoming" />
        <Metric label="Buffered" value={state.bufferQueue} hint="waiting to index" />
        <Metric label="Indexed" value={state.indexed} hint="searchable" />
        <Metric
          label="Rejected"
          value={state.parseFailed}
          hint="parser mismatch"
          valueClassName={state.parseFailed > 0 ? 'text-partial-foreground' : undefined}
        />
        <Metric
          label="Dropped"
          value={state.dropped}
          hint="lost to overflow"
          valueClassName={state.dropped > 0 ? 'text-wrong-foreground' : undefined}
        />
      </div>
    </div>
  );

  const stagePanel = (
    <div className="space-y-2">
      <section className="space-y-2 rounded-lg border bg-card p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Stage inspector</p>
        <h3 className="font-semibold">{inspected.title}</h3>
        <p className="text-sm leading-relaxed">{inspected.role}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          <strong className="font-semibold text-foreground">Operator signal:</strong>{' '}
          {inspected.watches}
        </p>
      </section>
      <SimMissionList missions={missions.missions} />
      <section className="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <label htmlFor="parser-mode" className="text-sm font-medium">
            Parser
          </label>
          <p className="text-xs text-muted-foreground">
            Grok runs a regex on every line, so the processor handles fewer logs per cycle. Changes
            require a fresh run.
          </p>
          <select
            id="parser-mode"
            value={state.parserMode}
            onChange={(event) => changeSettings({ parserMode: event.target.value as ParserMode })}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9"
          >
            <option value="json">JSON parser</option>
            <option value="grok">Grok pattern</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <label htmlFor="noise-filter" className="text-sm font-medium">
              Drop health-check noise
            </label>
            <p className="text-xs text-muted-foreground">Reduces storage volume before indexing.</p>
          </div>
          <Switch
            id="noise-filter"
            checked={state.filterNoise}
            onCheckedChange={(checked) => changeSettings({ filterNoise: checked })}
          />
        </div>
      </section>
    </div>
  );

  const outputPanel = (
    <section className="min-w-0 overflow-hidden rounded-lg border bg-card">
      <div className="flex border-b p-1.5" role="group" aria-label="Output view">
        <button
          type="button"
          onClick={() => setDetailView('inspect')}
          aria-pressed={detailView === 'inspect'}
          className={cn(
            'h-10 flex-1 rounded-md px-3 text-sm font-medium lg:h-8',
            detailView === 'inspect' ? 'bg-muted text-foreground' : 'text-muted-foreground'
          )}
        >
          Shard health
        </button>
        <button
          type="button"
          onClick={() => setDetailView('search')}
          aria-pressed={detailView === 'search'}
          className={cn(
            'h-10 flex-1 rounded-md px-3 text-sm font-medium lg:h-8',
            detailView === 'search' ? 'bg-muted text-foreground' : 'text-muted-foreground'
          )}
        >
          Search logs
        </button>
      </div>
      {detailView === 'inspect' ? (
        <div className="p-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">Three primary shards</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Events are distributed by document id. Balanced bars mean balanced indexing work.
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0 font-mono text-xs">
              {state.indexed} docs
            </Badge>
          </div>
          <div className="mt-4 space-y-3">
            {state.shardLoads.map((load, index) => {
              const maxLoad = Math.max(1, ...state.shardLoads);
              const width = state.indexed === 0 ? 0 : Math.max(8, (load / maxLoad) * 100);
              return (
                <div key={index}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">shard-{index}</span>
                    <span className="font-mono text-muted-foreground">{load} logs</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-all duration-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-md bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            This models primary-shard routing, not a full Elasticsearch cluster. Replicas, refresh
            intervals, and segment merges are intentionally omitted to keep the first lesson focused
            on flow and backpressure.
          </div>
        </div>
      ) : (
        <div>
          <div className="space-y-3 border-b p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search service, message, parser, or shard…"
                aria-label="Search logs"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLevel(option)}
                  aria-pressed={level === option}
                  className={cn(
                    'min-h-10 rounded-md border px-2.5 text-xs lg:min-h-8',
                    level === option
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'text-muted-foreground'
                  )}
                >
                  {option === 'ALL' ? 'All levels' : option}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {visibleLogs.length ? (
              visibleLogs.map((log) => <LogRow key={log.id} log={log} />)
            ) : (
              <div className="flex min-h-36 flex-col items-center justify-center px-4 text-center">
                <Search className="h-6 w-6 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium">
                  {state.indexed ? 'No matching logs' : 'Nothing is indexed yet'}
                </p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  {state.indexed
                    ? 'Try another term or severity.'
                    : 'Run or step the flow until a batch reaches the Index stage.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="Log Aggregation Pipeline Simulator"
          icon={Layers3}
          lead={
            <div
              role="group"
              aria-label="Scenario"
              className="grid min-w-0 flex-1 grid-cols-2 gap-1 sm:flex sm:flex-wrap"
            >
              {Object.values(LOG_SCENARIOS).map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant={option.id === state.scenarioId ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => changeSettings({ scenarioId: option.id })}
                  aria-pressed={option.id === state.scenarioId}
                  title={option.summary}
                  className="h-10 lg:h-8"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          }
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={health.label}
          meta={
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold',
                healthStyle.className
              )}
            >
              <HealthIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {healthStyle.word}
            </span>
          }
          actions={
            <div className="hidden items-center gap-2 lg:flex">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => setRunning((value) => !value)}
                className="h-10 lg:h-8"
              >
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {running ? 'Pause' : 'Run flow'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={step}
                disabled={running}
                className="h-10 lg:h-8"
              >
                <StepForward className="h-4 w-4" />
                Step
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={reset}
                className="h-10 lg:h-8"
              >
                <RotateCcw className="h-4 w-4" />
                Reset run
              </Button>
            </div>
          }
          goal={
            missions.current ? (
              <>
                {missions.current.label}{' '}
                <span className="text-muted-foreground">{missions.current.hint}</span>
              </>
            ) : (
              'All five done. Keep running scenarios and settings.'
            )
          }
        />
        <SimAnnouncer message={state.lastEvent} />
        {missions.complete && !dismissed ? (
          <SimComplete
            title="Missions complete"
            summary="You watched logs reach search, a spike overflow the source queue, a parser reject events, slow storage back up the buffer, and found the errors in the index."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Logs indexed (this run)', value: state.indexed },
              { label: 'Logs dropped (this run)', value: state.dropped },
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
            columns="lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,1.1fr)]"
            minHeight="min-h-[24rem]"
            tab={tab}
            onTabChange={(next) => setTab(next as Tab)}
            tabsLabel="Pipeline panels"
            panels={[
              { id: 'pipeline', label: 'Pipeline', content: pipelinePanel },
              { id: 'stage', label: 'Stage', content: stagePanel },
              { id: 'output', label: 'Search', content: outputPanel },
            ]}
          />
        )}
        <SimPhoneBar>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setRunning((value) => !value)}
              className="h-10 flex-1"
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? 'Pause' : 'Run flow'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={step}
              disabled={running}
              className="h-10"
            >
              <StepForward className="h-4 w-4" />
              Step
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={reset} className="h-10">
              <RotateCcw className="h-4 w-4" />
              Reset run
            </Button>
          </div>
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
