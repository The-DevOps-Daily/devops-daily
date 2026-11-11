'use client';

import { useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { Clock, Cloud, Rocket, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
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
  type SimStep,
} from '@/components/games/sim';
import {
  advanceClock,
  CLOCK_STEP_SECONDS,
  createLab,
  currentAssetPath,
  deploy,
  edgeEntries,
  HEADER_PRESETS,
  missionChecks,
  parseCacheControl,
  purgePath,
  sendTraffic,
  setHeader,
  setIgnoreUtm,
  setVaryCookie,
  VISITOR_EDGE_RTT_MS,
  type City,
  type HeaderPresetId,
  type LabState,
  type PathKind,
  type RequestResult,
} from '@/lib/games/cdn-edge-cache-lab-engine';

const MISSION_DATA: Array<Mission<LabState>> = [
  {
    id: 'first-hit',
    label: 'Get a cache HIT at the Singapore edge.',
    hint: 'Press Send traffic. Every edge gets two visitors: the first one misses, the second one hits.',
    check: (state) => missionChecks(state)['first-hit'],
  },
  {
    id: 'stale-after-deploy',
    label: 'Deploy, and catch a visitor getting the old page.',
    hint: 'Pick /index.html and press Send traffic, then Deploy, then Send traffic again. max-age=60 keeps the old copy at the edges.',
    check: (state) => missionChecks(state)['stale-after-deploy'],
  },
  {
    id: 'fix-deploys',
    label: 'Make deploys show at once without hurting the hit ratio.',
    hint: 'Press Purge /index.html and send /index.html traffic, then pick Asset and send it: the new file name gets its own hits.',
    check: (state) => missionChecks(state)['fix-deploys'],
  },
  {
    id: 'revalidate',
    label: 'See a 304: the edge asks the origin and gets Not Modified.',
    hint: 'With /index.html cached, press Wait 61 s, then Send traffic: the stale copy is checked with the origin.',
    check: (state) => missionChecks(state).revalidate,
  },
  {
    id: 'keep-private',
    label: 'Make sure no edge ever stores the cart.',
    hint: 'Pick /api/cart and press Send traffic. With private or no-store every edge answers BYPASS and stores nothing.',
    check: (state) => missionChecks(state)['keep-private'],
  },
  {
    id: 'cache-key',
    label: 'Fix the hit ratio when every link has its own utm_ parameters.',
    hint: 'Turn on utm_ links and send traffic: each link is a new cache key. Then turn on Ignore utm_ in cache key below and send again.',
    check: (state) => missionChecks(state)['cache-key'],
  },
];

const MAP_ORDER: City[] = ['Virginia', 'Frankfurt', 'Singapore'];

const TARGETS: Array<{ kind: PathKind; label: string }> = [
  { kind: 'page', label: '/index.html' },
  { kind: 'asset', label: 'Asset' },
  { kind: 'cart', label: '/api/cart' },
];

type OutcomeLabel = 'HIT' | 'STALE' | 'MISS' | '304' | 'BYPASS';

const OUTCOME_STYLE: Record<OutcomeLabel, string> = {
  HIT: 'border-correct/50 bg-correct/10 text-correct-foreground',
  STALE: 'border-partial/60 bg-partial/10 text-partial-foreground',
  MISS: 'border-border bg-muted text-foreground',
  '304': 'border-primary/50 bg-primary/10 text-primary',
  BYPASS: 'border-wrong/50 bg-wrong/10 text-wrong-foreground',
};

const LEGEND: Array<{ label: OutcomeLabel; text: string }> = [
  { label: 'HIT', text: 'served by the edge' },
  { label: 'MISS', text: 'fetched from origin' },
  { label: '304', text: 'origin says unchanged' },
  { label: 'STALE', text: 'old copy, refreshing' },
  { label: 'BYPASS', text: 'not cacheable' },
];

function outcomeLabel(result: RequestResult): OutcomeLabel {
  if (result.outcome === 'REVALIDATED') return '304';
  if (result.outcome === 'HIT' && !result.fresh) return 'STALE';
  return result.outcome;
}

function targetPath(state: LabState, kind: PathKind): string {
  if (kind === 'page') return '/index.html';
  if (kind === 'cart') return '/api/cart';
  return currentAssetPath(state);
}

function statusSentence(state: LabState): string {
  const results = state.lastBatch.results;
  if (results.length === 0) return 'Ready. Press Send traffic.';
  const hits = results.filter((result) => result.outcome === 'HIT').length;
  return `${results.length} requests: ${hits} served by the edges, ${state.lastBatch.originRequests} went to the origin.`;
}

function edgeRows(state: LabState, city: City) {
  const rows = new Map<
    string,
    { label: string; keys: number; age: number; fresh: boolean; revalidates: boolean }
  >();
  for (const entry of edgeEntries(state, city)) {
    const label = entry.path === '/index.html' ? `/index.html v${entry.version}` : entry.path;
    const row = rows.get(label);
    const revalidates = parseCacheControl(entry.preset).noCache;
    if (!row) rows.set(label, { label, keys: 1, age: entry.age, fresh: entry.fresh, revalidates });
    else rows.set(label, { ...row, keys: row.keys + 1, fresh: row.fresh || entry.fresh });
  }
  return [...rows.values()];
}

function originLine(results: RequestResult[]): string {
  if (results.length === 0) return 'No requests yet';
  const full = results.filter((result) => result.originContact && result.outcome !== 'HIT');
  const refresh = results.filter((result) => result.originContact && result.outcome === 'HIT');
  const parts: string[] = [];
  const fetched = full.filter((result) => result.status === 200).length;
  const unchanged = full.filter((result) => result.status === 304).length;
  if (fetched) parts.push(`${fetched} × 200`);
  if (unchanged) parts.push(`${unchanged} × 304`);
  if (refresh.length) parts.push(`${refresh.length} background refresh`);
  return parts.length ? `To origin: ${parts.join(', ')}` : 'Origin not contacted';
}

function EdgeCard({ state, city, batch }: { state: LabState; city: City; batch: number }) {
  const results = state.lastBatch.results.filter((result) => result.city === city);
  const contacted = results.some((result) => result.originContact);
  const rows = edgeRows(state, city);
  const latency = state.lastBatch.cityLatencyMs[city];
  return (
    <div className="flex min-w-0 flex-col rounded-lg border bg-background p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold">{city} edge</h4>
        <span className="text-xs tabular-nums text-muted-foreground">
          {latency === null ? 'idle' : `about ${Math.round(latency)} ms`}
        </span>
      </div>
      <p className={cn('text-xs', contacted ? 'text-primary' : 'text-muted-foreground')}>
        {originLine(results)}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">Visitors</p>
      <div className="mt-1 flex min-h-7 flex-wrap gap-1">
        {results.length === 0 ? (
          <span className="text-xs text-muted-foreground">none yet</span>
        ) : (
          results.map((result, index) => {
            const label = outcomeLabel(result);
            const old = result.path === '/index.html' && result.version < state.deploy;
            return (
              <motion.span
                key={`${batch}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.25, duration: 0.25 }}
                title={`${result.path}: ${label}${result.status === 304 ? ' (304 Not Modified)' : ''}`}
                className={cn(
                  'rounded border px-1.5 py-0.5 font-mono text-xs font-semibold',
                  old ? OUTCOME_STYLE.STALE : OUTCOME_STYLE[label]
                )}
              >
                {label}
                {old ? ` v${result.version}` : ''}
              </motion.span>
            );
          })
        )}
      </div>
      <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">Cached here</p>
      {rows.length === 0 ? (
        <p className="text-xs">empty</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {rows.slice(0, 4).map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate font-mono">{row.label}</span>
              <span
                className={cn(
                  'shrink-0',
                  row.keys > 1
                    ? 'text-partial-foreground'
                    : row.revalidates
                      ? 'text-primary'
                      : row.fresh
                        ? 'text-correct-foreground'
                        : 'text-partial-foreground'
                )}
              >
                {row.keys > 1
                  ? `${row.keys} keys`
                  : row.revalidates
                    ? 'revalidating'
                    : `${row.fresh ? 'fresh' : 'stale'}, age ${row.age}s`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CacheMap({ state, batch }: { state: LabState; batch: number }) {
  const contacted = (city: City) =>
    state.lastBatch.results.some((result) => result.city === city && result.originContact);
  const originHits = state.lastBatch.originRequests;
  return (
    <section className="rounded-lg border bg-card p-3" aria-label="Edge cache map">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold">Edge cache map</h3>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {LEGEND.map(({ label, text }) => (
            <li key={label} className="flex items-center gap-1">
              <span
                className={cn('rounded border px-1 font-mono font-semibold', OUTCOME_STYLE[label])}
              >
                {label}
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
      <motion.div
        key={`origin-${batch}`}
        initial={{ scale: originHits > 0 ? 1.06 : 1 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, duration: 0.35 }}
        className={cn(
          'mx-auto mt-3 w-full max-w-[16rem] rounded-lg border-2 px-3 py-2 text-center',
          originHits > 0 ? 'border-primary bg-primary/10' : 'border-border bg-muted/40'
        )}
      >
        <p className="text-sm font-semibold">Origin, Frankfurt</p>
        <p className="text-xs text-muted-foreground">
          Serving v{state.deploy} ·{' '}
          {originHits > 0 ? `${originHits} requests this batch` : 'no requests this batch'}
        </p>
      </motion.div>
      <div aria-hidden="true" className="relative hidden h-5 sm:block">
        <span className="absolute left-1/2 top-0 h-2.5 w-0.5 -translate-x-1/2 bg-border" />
        <span className="absolute left-[16.5%] right-[16.5%] top-2.5 h-0.5 bg-border" />
        {MAP_ORDER.map((city, index) => (
          <span
            key={city}
            className={cn(
              'absolute top-2.5 h-2.5 w-0.5 -translate-x-1/2',
              contacted(city) ? 'bg-primary' : 'bg-border'
            )}
            style={{ left: `${16.5 + index * 33.5}%` }}
          />
        ))}
      </div>
      <div aria-hidden="true" className="flex justify-center py-1 sm:hidden">
        <span className="h-3 w-0.5 bg-border" />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {MAP_ORDER.map((city) => (
          <EdgeCard key={city} state={state} city={city} batch={batch} />
        ))}
      </div>
    </section>
  );
}

function CacheSettings({ state, update }: { state: LabState; update: (next: LabState) => void }) {
  return (
    <section className="rounded-lg border bg-card p-3">
      <h3 className="text-sm font-semibold">Origin response headers</h3>
      <p className="text-xs text-muted-foreground">
        The Cache-Control header the origin sends with each response.
      </p>
      <div className="mt-2 grid gap-2">
        {TARGETS.map(({ kind, label }) => (
          <label
            key={kind}
            className="grid gap-1 text-xs font-medium sm:grid-cols-[10rem_1fr] sm:items-center"
          >
            <span className="min-w-0 truncate font-mono">
              {kind === 'asset' ? currentAssetPath(state) : label}
            </span>
            <select
              aria-label={`${label} Cache-Control`}
              value={state.headers[kind]}
              onChange={(event) =>
                update(setHeader(state, kind, event.target.value as HeaderPresetId))
              }
              className="h-10 min-w-0 rounded-md border bg-background px-2 text-xs"
            >
              {HEADER_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.text}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <h3 className="mt-3 text-sm font-semibold">Cache key</h3>
      <div className="mt-1 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={state.ignoreUtm ? 'default' : 'outline'}
          className="h-10 text-xs lg:h-8"
          aria-pressed={state.ignoreUtm}
          onClick={() => update(setIgnoreUtm(state, !state.ignoreUtm))}
        >
          Ignore utm_ in cache key {state.ignoreUtm ? 'on' : 'off'}
        </Button>
        {TARGETS.map(({ kind, label }) => (
          <Button
            key={kind}
            type="button"
            variant="outline"
            className="h-10 text-xs lg:h-8"
            aria-pressed={state.varyCookie[kind]}
            onClick={() => update(setVaryCookie(state, kind, !state.varyCookie[kind]))}
          >
            Vary: Cookie for {label} {state.varyCookie[kind] ? 'on' : 'off'}
          </Button>
        ))}
      </div>
    </section>
  );
}

export default function CdnEdgeCacheLab() {
  const [state, setState] = useState(createLab);
  const [target, setTarget] = useState<PathKind>('asset');
  const [utm, setUtm] = useState(false);
  const [batch, setBatch] = useState(0);
  const [tab, setTab] = useState('lab');
  const [dismissed, setDismissed] = useState(false);
  const missions = useMissions(MISSION_DATA, state);
  const steps: SimStep[] = MISSION_DATA.map((mission) => ({
    title: mission.label,
    status: missions.missions.find((item) => item.id === mission.id)?.done ? 'done' : 'todo',
  }));
  const currentMission = missions.current;
  const update = (next: LabState) => setState(next);
  const startOver = () => {
    setState(createLab());
    setTarget('asset');
    setUtm(false);
    setBatch(0);
    setDismissed(false);
    missions.reset();
  };
  const send = () => {
    setState(sendTraffic(state, { utm, target: targetPath(state, target) }));
    setBatch((value) => value + 1);
  };
  const purgeLabel = target === 'asset' ? 'asset' : targetPath(state, target);
  const results = state.lastBatch.results;

  const actionBar = (
    <div className="space-y-2 rounded-md border bg-background p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="What visitors request"
          className="flex rounded-md border p-0.5"
        >
          {TARGETS.map(({ kind, label }) => (
            <button
              key={kind}
              type="button"
              aria-pressed={target === kind}
              onClick={() => setTarget(kind)}
              className={cn(
                'h-9 rounded px-2.5 font-mono text-xs font-medium lg:h-7',
                target === kind
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant={utm ? 'default' : 'outline'}
          className="h-10 text-xs lg:h-8"
          aria-pressed={utm}
          onClick={() => setUtm(!utm)}
        >
          utm_ links {utm ? 'on' : 'off'}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button type="button" className="h-10 lg:h-8" onClick={send}>
          <Send className="h-4 w-4" aria-hidden="true" /> Send traffic
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 lg:h-8"
          onClick={() => update(deploy(state))}
        >
          <Rocket className="h-4 w-4" aria-hidden="true" /> Deploy v{state.deploy + 1}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 lg:h-8"
          onClick={() => update(purgePath(state, targetPath(state, target)))}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Purge {purgeLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 lg:h-8"
          onClick={() => update(advanceClock(state, CLOCK_STEP_SECONDS))}
        >
          <Clock className="h-4 w-4" aria-hidden="true" /> Wait {CLOCK_STEP_SECONDS} s
        </Button>
      </div>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Last batch">
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Last batch:</dt>
          <dd className="font-semibold tabular-nums">
            {results.length ? `${results.length} requests` : 'none yet'}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Hit ratio</dt>
          <dd className="font-semibold tabular-nums">
            {results.length ? `${Math.round(state.lastBatch.hitRatio * 100)}%` : '0%'}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Origin requests</dt>
          <dd className="font-semibold tabular-nums">{state.lastBatch.originRequests}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Clock</dt>
          <dd className="font-semibold tabular-nums">t+{state.now}s</dd>
        </div>
      </dl>
    </div>
  );

  const lab = (
    <div className="space-y-2.5">
      <CacheMap state={state} batch={batch} />
      <CacheSettings state={state} update={update} />
    </div>
  );
  const details = (
    <div className="space-y-2.5">
      <SimMissionList missions={missions.missions} />
      <details className="rounded-lg border bg-card p-3 text-sm">
        <summary className="cursor-pointer font-semibold">How the cache decides</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          <li>The cache key is the method plus the full URL, query string included.</li>
          <li>A shared cache never stores a response marked private or no-store.</li>
          <li>no-cache stores the response but checks with the origin before every reuse.</li>
          <li>s-maxage wins over max-age in a shared cache such as a CDN edge.</li>
          <li>
            Latency is a simplified model: a {VISITOR_EDGE_RTT_MS} ms visitor-to-edge round trip,
            plus the edge-to-origin trip and origin work when the origin is asked.
          </li>
        </ul>
      </details>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimAnnouncer message={statusSentence(state)} />
        <SimBar
          title="CDN Edge Cache Lab"
          icon={Cloud}
          steps={steps}
          current={Math.max(
            0,
            MISSION_DATA.findIndex((mission) => mission.id === currentMission?.id)
          )}
          onStep={() => setTab('details')}
          stepNoun="Mission"
          progress={{ current: missions.done, total: missions.total }}
          tools={<SimResetButton onReset={startOver} />}
          goal={
            currentMission ? (
              <>
                {currentMission.label}{' '}
                <span className="text-muted-foreground">{currentMission.hint}</span>
              </>
            ) : (
              'All missions complete. Explore any cache policy or traffic pattern.'
            )
          }
        >
          {actionBar}
        </SimBar>
        {missions.complete && !dismissed ? (
          <SimComplete
            title="Edge cache lab complete"
            summary="You balanced freshness, revalidation, privacy, cache keys, and low-latency asset delivery."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              {
                label: 'Origin requests',
                value: state.history.filter((result) => result.originContact).length,
              },
              {
                label: 'Latest hit ratio',
                value: `${Math.round(state.lastBatch.hitRatio * 100)}%`,
              },
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
              { id: 'lab', label: 'Lab', content: lab },
              { id: 'details', label: 'Missions', content: details },
            ]}
            columns="lg:grid-cols-[minmax(0,1.6fr)_minmax(17rem,0.8fr)]"
            tab={tab}
            onTabChange={setTab}
            minHeight="min-h-[28rem]"
          />
        )}
        <SimPhoneBar>
          <Button type="button" className="h-10 flex-1" onClick={send}>
            <Send className="h-4 w-4" aria-hidden="true" /> Send traffic
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => setTab(tab === 'lab' ? 'details' : 'lab')}
          >
            {tab === 'lab' ? 'Missions' : 'Lab'}
          </Button>
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
