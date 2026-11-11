'use client';

import { useMemo, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { Cloud, Rocket, Server, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
} from '@/lib/games/cdn-edge-cache-lab-engine';

const MISSION_DATA: Array<Mission<LabState>> = [
  {
    id: 'first-hit',
    label: 'Get a cache HIT at the Singapore edge.',
    hint: 'Give the asset a max-age, send traffic twice.',
    check: (state) => missionChecks(state)['first-hit'],
  },
  {
    id: 'stale-after-deploy',
    label: 'Deploy, and catch a visitor getting the old page.',
    hint: 'With a long max-age on /index.html, the edge keeps serving the old copy until it expires.',
    check: (state) => missionChecks(state)['stale-after-deploy'],
  },
  {
    id: 'fix-deploys',
    label: 'Make deploys show at once without hurting the hit ratio.',
    hint: 'Purge /index.html on deploy, or give it no-cache so every reuse is revalidated; keep the asset immutable.',
    check: (state) => missionChecks(state)['fix-deploys'],
  },
  {
    id: 'revalidate',
    label: 'See a 304: the edge asks the origin and gets not modified.',
    hint: 'no-cache, or an expired max-age, makes the edge revalidate.',
    check: (state) => missionChecks(state).revalidate,
  },
  {
    id: 'keep-private',
    label: 'Make sure no edge ever stores the cart.',
    hint: 'A shared cache must not store private or no-store responses.',
    check: (state) => missionChecks(state)['keep-private'],
  },
  {
    id: 'cache-key',
    label: 'Fix the hit ratio when every link has its own utm_ parameters.',
    hint: "Turn on 'Ignore utm_ parameters' in the cache key.",
    check: (state) => missionChecks(state)['cache-key'],
  },
];

const PATH_CONTROLS: Array<{ kind: PathKind; label: string }> = [
  { kind: 'page', label: '/index.html' },
  { kind: 'asset', label: 'Versioned asset' },
  { kind: 'cart', label: '/api/cart' },
];

function statusSentence(state: LabState): string {
  const result = state.lastBatch.results.at(-1);
  if (!result) return 'Ready. Choose a response policy, then send traffic.';
  return `${result.city}: ${result.outcome}${result.status === 304 ? ' (304)' : ''}, about ${Math.round(result.latencyMs)} ms.`;
}

function resultClass(outcome: string): string {
  if (outcome === 'HIT') return 'text-correct-foreground';
  if (outcome === 'BYPASS') return 'text-wrong-foreground';
  return 'text-partial-foreground';
}

function arrowClass(outcome: string | undefined): string {
  if (outcome === 'HIT') return 'stroke-correct-foreground';
  if (outcome === 'BYPASS') return 'stroke-wrong-foreground';
  if (outcome === 'MISS' || outcome === 'REVALIDATED') return 'stroke-partial-foreground';
  return 'stroke-border';
}

function CacheMap({ state }: { state: LabState }) {
  const locations: Array<{ city: City; x: number; y: number }> = [
    { city: 'Virginia', x: 58, y: 48 },
    { city: 'Frankfurt', x: 178, y: 28 },
    { city: 'Singapore', x: 280, y: 74 },
  ];
  return (
    <svg
      role="img"
      aria-label="Map of Frankfurt origin and CDN edge cache entries in Virginia, Frankfurt, and Singapore"
      viewBox="0 0 360 150"
      className="w-full"
    >
      <defs>
        <marker id="request-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="context-stroke" />
        </marker>
      </defs>
      <rect
        x="141"
        y="6"
        width="78"
        height="38"
        rx="6"
        className="fill-primary/10 stroke-primary"
      />
      <text x="180" y="22" textAnchor="middle" className="fill-foreground text-xs font-semibold">
        Origin
      </text>
      <text x="180" y="35" textAnchor="middle" className="fill-muted-foreground text-xs">
        Frankfurt v{state.deploy}
      </text>
      {locations.map(({ city, x, y }) => {
        const entries = edgeEntries(state, city);
        const lastResult = state.lastBatch.results.filter((result) => result.city === city).at(-1);
        return (
          <g key={city}>
            <path
              d={`M180 42 L${x} ${y + 8}`}
              className={arrowClass(lastResult?.outcome)}
              strokeWidth="1.5"
              markerEnd="url(#request-arrow)"
            />
            <rect
              x={x - 48}
              y={y}
              width="96"
              height="62"
              rx="6"
              className="fill-card stroke-border"
            />
            <text
              x={x}
              y={y + 14}
              textAnchor="middle"
              className="fill-foreground text-xs font-semibold"
            >
              {city} edge
            </text>
            {entries.slice(0, 3).map((entry, index) => (
              <text
                key={entry.key}
                x={x - 42}
                y={y + 29 + index * 10}
                className={
                  entry.fresh
                    ? 'fill-correct-foreground text-xs'
                    : 'fill-partial-foreground text-xs'
                }
              >
                {entry.path.replace('/app.', '/a.')} a{entry.age}/{entry.lifetime ?? '0'}s{' '}
                {entry.fresh ? 'fresh' : 'stale'}
              </text>
            ))}
            {entries.length === 0 && (
              <text x={x} y={y + 35} textAnchor="middle" className="fill-muted-foreground text-xs">
                empty
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function HeaderControls({ state, update }: { state: LabState; update: (next: LabState) => void }) {
  return (
    <section className="rounded-lg border bg-card p-3">
      <h3 className="text-sm font-semibold">Origin response headers</h3>
      <div className="mt-2 grid gap-2">
        {PATH_CONTROLS.map(({ kind, label }) => (
          <label
            key={kind}
            className="grid gap-1 text-xs font-medium sm:grid-cols-[9rem_1fr] sm:items-center"
          >
            <span>{kind === 'asset' ? `${label}: ${currentAssetPath(state)}` : label}</span>
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
      <div className="mt-2 flex flex-wrap gap-2">
        {PATH_CONTROLS.map(({ kind, label }) => (
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
  const [tab, setTab] = useState('lab');
  const [dismissed, setDismissed] = useState(false);
  const missions = useMissions(MISSION_DATA, state);
  const checks = missionChecks(state);
  const steps: SimStep[] = MISSION_DATA.map((mission) => ({
    title: mission.label,
    status: missions.missions.find((item) => item.id === mission.id)?.done ? 'done' : 'todo',
  }));
  const currentMission = missions.current;
  const update = (next: LabState) => setState(next);
  const startOver = () => {
    setState(createLab());
    setDismissed(false);
    missions.reset();
  };
  const controls = useMemo(
    () => ({
      assetSingapore: () => update(sendTraffic(state, { utm: false, city: 'Singapore' })),
      pageAll: () => update(sendTraffic(state, { utm: false, target: '/index.html' })),
      cartAll: () => update(sendTraffic(state, { utm: false, target: '/api/cart' })),
      utm: () => update(sendTraffic(state, { utm: true, target: currentAssetPath(state) })),
    }),
    [state]
  );

  const lab = (
    <div className="space-y-2.5">
      <section className="rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Edge cache map</h3>
            <p className="text-xs text-muted-foreground">
              Age is seconds since this edge stored the origin response.
            </p>
          </div>
          <span className="font-mono text-xs text-muted-foreground">t+{state.now}s</span>
        </div>
        <CacheMap state={state} />
      </section>
      <HeaderControls state={state} update={update} />
      <section className="rounded-lg border bg-card p-3">
        <h3 className="text-sm font-semibold">Send traffic</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button type="button" className="h-10 text-xs" onClick={controls.assetSingapore}>
            Asset ×2 in Singapore
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 text-xs"
            onClick={controls.pageAll}
          >
            Page ×2 at every edge
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 text-xs"
            onClick={controls.cartAll}
          >
            Cart ×2 at every edge
          </Button>
          <Button type="button" variant="outline" className="h-10 text-xs" onClick={controls.utm}>
            UTM page batch
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 text-xs lg:h-8"
            onClick={() => update(deploy(state))}
          >
            <Rocket className="h-4 w-4" aria-hidden="true" /> Deploy v{state.deploy + 1}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 text-xs lg:h-8"
            onClick={() => update(purgePath(state, '/index.html'))}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Purge page
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 text-xs lg:h-8"
            onClick={() => update(advanceClock(state, CLOCK_STEP_SECONDS))}
          >
            Advance {CLOCK_STEP_SECONDS} s
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 text-xs lg:h-8"
            aria-pressed={state.ignoreUtm}
            onClick={() => update(setIgnoreUtm(state, !state.ignoreUtm))}
          >
            Ignore utm_ parameters {state.ignoreUtm ? 'on' : 'off'}
          </Button>
        </div>
      </section>
      <p className="text-xs text-muted-foreground">
        A simplified model: about-latency combines a {VISITOR_EDGE_RTT_MS} ms visitor-to-edge round
        trip with illustrative edge-to-origin round trips and origin work.
      </p>
    </div>
  );
  const details = (
    <div className="space-y-2.5">
      <SimMissionList missions={missions.missions} />
      <section className="rounded-lg border bg-card p-3">
        <h3 className="text-sm font-semibold">Last batch</h3>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="block text-muted-foreground">Hit ratio</span>
            <strong className="font-mono">{Math.round(state.lastBatch.hitRatio * 100)}%</strong>
          </div>
          <div>
            <span className="block text-muted-foreground">Origin requests</span>
            <strong className="font-mono">{state.lastBatch.originRequests}</strong>
          </div>
          <div>
            <span className="block text-muted-foreground">Last result</span>
            <strong className={resultClass(state.lastBatch.results.at(-1)?.outcome ?? '')}>
              {state.lastBatch.results.at(-1)?.outcome ?? 'none yet'}
            </strong>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-muted-foreground">
          {(['Frankfurt', 'Virginia', 'Singapore'] as City[]).map((city) => (
            <span key={city}>
              {city}: about{' '}
              {state.lastBatch.cityLatencyMs[city] === null
                ? 'no traffic'
                : `${Math.round(state.lastBatch.cityLatencyMs[city] ?? 0)} ms`}
            </span>
          ))}
        </div>
      </section>
      <details className="rounded-lg border bg-card p-3 text-sm">
        <summary className="cursor-pointer font-semibold">How the cache decides</summary>
        <p className="mt-2 text-muted-foreground">
          The key is method plus target URI, including query string. Vary: Cookie adds Cookie. A
          shared cache cannot store private or no-store. no-cache stores but validates on every
          reuse; s-maxage wins over max-age.
        </p>
      </details>
      <details className="rounded-lg border bg-card p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Edge entries</summary>
        <div className="mt-2 space-y-2 text-xs text-muted-foreground">
          {(['Frankfurt', 'Virginia', 'Singapore'] as City[]).map((city) => {
            const entries = edgeEntries(state, city);
            return (
              <div key={city}>
                <strong className="text-foreground">{city}</strong>
                {entries.length === 0 ? (
                  <span>: empty</span>
                ) : (
                  <ul className="mt-1 space-y-0.5 font-mono">
                    {entries.map((entry) => (
                      <li key={entry.key}>
                        {entry.path}: age {entry.age}s / lifetime {entry.lifetime ?? 'none'};{' '}
                        {entry.fresh ? 'fresh' : 'stale'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </details>
      <details className="rounded-lg border bg-card p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Mission signals</summary>
        <p className="mt-2 text-muted-foreground">
          Old-page seen: {checks['stale-after-deploy'] ? 'yes' : 'no'}; 304 seen:{' '}
          {checks.revalidate ? 'yes' : 'no'}; UTM batch:{' '}
          {checks['cache-key'] ? 'over 80% hits' : 'not yet'}.
        </p>
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
          heading={currentMission ? `Mission: ${currentMission.label}` : 'Free play'}
          actions={
            <Button
              type="button"
              variant="outline"
              className="h-10 text-xs lg:h-8"
              onClick={() => setTab('lab')}
            >
              <Server className="h-4 w-4" aria-hidden="true" /> Lab
            </Button>
          }
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
        />
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
            columns="lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]"
            tab={tab}
            onTabChange={setTab}
            minHeight="min-h-[28rem]"
          />
        )}
        <SimPhoneBar>
          <Button type="button" className="h-10 flex-1" onClick={controls.assetSingapore}>
            Send asset traffic
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => setTab('details')}
          >
            Missions
          </Button>
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
