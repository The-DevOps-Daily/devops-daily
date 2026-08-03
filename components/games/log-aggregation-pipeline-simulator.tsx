'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronRight,
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
  INFO: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  WARN: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  ERROR: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
};

const HEALTH_STYLES = {
  healthy: {
    icon: CheckCircle2,
    className: 'border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300',
  },
  warning: {
    icon: CircleGauge,
    className: 'border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-300',
  },
  critical: {
    icon: AlertTriangle,
    className: 'border-red-500/25 bg-red-500/8 text-red-700 dark:text-red-300',
  },
} as const;

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

function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-background/70 px-3 py-2.5">
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function LogRow({ log }: { log: IndexedLog }) {
  return (
    <div className="grid gap-1 border-b px-3 py-2.5 last:border-b-0 sm:grid-cols-[68px_76px_minmax(0,1fr)_60px] sm:items-center">
      <Badge
        variant="outline"
        className={cn('w-fit font-mono text-[10px]', LEVEL_STYLES[log.level])}
      >
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

export default function LogAggregationPipelineSimulator() {
  const [state, setState] = useState(createPipelineState);
  const [running, setRunning] = useState(false);
  const [inspectedStage, setInspectedStage] = useState<PipelineStageId>('sources');
  const [detailView, setDetailView] = useState<'inspect' | 'search'>('inspect');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<'ALL' | LogLevel>('ALL');

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

  return (
    <div className="overflow-hidden rounded-xl border bg-muted/15 shadow-sm">
      <div className="border-b bg-background/80 p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">Production log pipeline</h2>
              <Badge variant="outline" className={cn('gap-1.5', healthStyle.className)}>
                <HealthIcon className="h-3.5 w-3.5" />
                {health.label}
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{health.explanation}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={running ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRunning((value) => !value)}
              className="min-w-24"
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? 'Pause' : 'Run flow'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setState((current) => advancePipeline(current))}
              disabled={running}
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

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Object.values(LOG_SCENARIOS).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => changeSettings({ scenarioId: option.id })}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                option.id === state.scenarioId
                  ? 'border-primary/50 bg-primary/8 text-foreground'
                  : 'bg-background/50 text-muted-foreground hover:border-primary/30 hover:text-foreground'
              )}
              aria-pressed={option.id === state.scenarioId}
            >
              <span className="block text-xs font-semibold sm:text-sm">{option.label}</span>
              <span className="mt-0.5 hidden text-[11px] leading-snug text-muted-foreground sm:block">
                {option.summary}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cycle {state.cycle} · next stage
          </p>
          <p className="text-xs text-muted-foreground">Select a stage to inspect what it does.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PIPELINE_STAGES.map((stage, index) => {
            const Icon = STAGE_ICONS[stage.id];
            const isNext = index === state.stageIndex;
            const isInspected = stage.id === inspectedStage;
            return (
              <div key={stage.id} className="relative min-w-0">
                <button
                  type="button"
                  onClick={() => inspectStage(stage.id)}
                  aria-pressed={isInspected}
                  className={cn(
                    'relative flex h-full min-h-24 w-full flex-col rounded-lg border bg-background p-3 text-left transition-colors',
                    isNext && 'border-primary ring-2 ring-primary/15',
                    !isNext && isInspected && 'border-foreground/30 bg-muted/30',
                    !isNext && !isInspected && 'hover:border-primary/35'
                  )}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground',
                        isNext && 'bg-primary text-primary-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    {isNext && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        NEXT
                      </span>
                    )}
                  </div>
                  <span className="mt-2 truncate text-sm font-semibold">{stage.shortLabel}</span>
                  <span className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {queueLabel(stage.id, state)}
                  </span>
                </button>
                {index < PIPELINE_STAGES.length - 1 && (
                  <ChevronRight className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full border bg-background p-0.5 text-muted-foreground lg:block" />
                )}
              </div>
            );
          })}
        </div>

        <div
          className="mt-3 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-3"
          aria-live="polite"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {state.stageIndex + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Next: {nextStage.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {state.lastEvent}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Metric label="Generated" value={state.generated} hint="all incoming" />
          <Metric label="Buffered" value={state.bufferQueue} hint="waiting to index" />
          <Metric label="Indexed" value={state.indexed} hint="searchable" />
          <Metric label="Rejected" value={state.parseFailed} hint="parser mismatch" />
          <Metric label="Dropped" value={state.dropped} hint="lost to overflow" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <section className="rounded-lg border bg-background">
            <div className="border-b px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Stage inspector
              </p>
              <h3 className="mt-1 font-semibold">{inspected.title}</h3>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <p className="text-sm leading-relaxed">{inspected.role}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  <strong className="font-semibold text-foreground">Operator signal:</strong>{' '}
                  {inspected.watches}
                </p>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label htmlFor="parser-mode" className="text-sm font-medium">
                      Parser
                    </label>
                    <p className="text-xs text-muted-foreground">Changes require a fresh run.</p>
                  </div>
                  <select
                    id="parser-mode"
                    value={state.parserMode}
                    onChange={(event) =>
                      changeSettings({ parserMode: event.target.value as ParserMode })
                    }
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="json">JSON parser</option>
                    <option value="grok">Grok pattern</option>
                  </select>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    <label htmlFor="noise-filter" className="text-sm font-medium">
                      Drop health-check noise
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Reduces storage volume before indexing.
                    </p>
                  </div>
                  <Switch
                    id="noise-filter"
                    checked={state.filterNoise}
                    onCheckedChange={(checked) => changeSettings({ filterNoise: checked })}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-lg border bg-background">
            <div className="flex border-b p-1.5">
              <button
                type="button"
                onClick={() => setDetailView('inspect')}
                className={cn(
                  'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  detailView === 'inspect' ? 'bg-muted text-foreground' : 'text-muted-foreground'
                )}
              >
                Shard health
              </button>
              <button
                type="button"
                onClick={() => setDetailView('search')}
                className={cn(
                  'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  detailView === 'search' ? 'bg-muted text-foreground' : 'text-muted-foreground'
                )}
              >
                Search logs
              </button>
            </div>

            {detailView === 'inspect' ? (
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">Three primary shards</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Events are distributed by document id. Balanced bars mean balanced indexing
                      work.
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 font-mono">
                    {state.indexed} docs
                  </Badge>
                </div>
                <div className="mt-5 space-y-4">
                  {state.shardLoads.map((load, index) => {
                    const maxLoad = Math.max(1, ...state.shardLoads);
                    const width = state.indexed === 0 ? 0 : Math.max(8, (load / maxLoad) * 100);
                    return (
                      <div key={index}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="font-medium">shard-{index}</span>
                          <span className="font-mono text-muted-foreground">{load} logs</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-linear-to-r from-sky-500 to-indigo-500 transition-all duration-500"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 rounded-md bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                  This models primary-shard routing, not a full Elasticsearch cluster. Replicas,
                  refresh intervals, and segment merges are intentionally omitted to keep the first
                  lesson focused on flow and backpressure.
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
                      className="pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setLevel(option)}
                        className={cn(
                          'rounded-md border px-2.5 py-1 text-xs transition-colors',
                          level === option
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground'
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
                      <Search className="h-7 w-7 text-muted-foreground/50" />
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
        </div>
      </div>
    </div>
  );
}
