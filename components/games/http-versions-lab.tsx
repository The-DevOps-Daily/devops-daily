'use client';

import { useMemo, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { ChevronLeft, ChevronRight, Network, Play } from 'lucide-react';
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
  MISSION_COPY,
  PAGE_REQUESTS,
  PROTOCOLS,
  RTT_OPTIONS,
  SIMPLIFICATIONS,
  computeLoad,
  createLab,
  goToStep,
  missionChecks,
  nextStep,
  playAll,
  previousStep,
  protocolDetails,
  setLoss,
  setProtocol,
  setRtt,
  stepLabels,
  visibleRequestIds,
  type HttpProtocol,
  type LabState,
  type RttMs,
  LINK_MEGABITS_PER_SECOND,
  type WaterfallRequest,
} from '@/lib/games/http-versions-lab-engine';

const MISSIONS: Array<Mission<LabState>> = MISSION_COPY.map((mission) => ({
  ...mission,
  check: (state) => missionChecks(state)[mission.id],
}));

function formatMs(value: number): string {
  return `about ${Math.round(value)} ms`;
}

const RESPONSE_BAR: Record<WaterfallRequest['kind'], string> = {
  html: 'border-primary bg-primary/40',
  css: 'border-info bg-info/40',
  js: 'border-partial bg-partial/40',
  image: 'border-correct bg-correct/40',
};

const ROW = 'grid grid-cols-[6.5rem_2rem_minmax(0,1fr)] items-center gap-x-2';

function Waterfall({
  requests,
  protocol,
  visible,
}: {
  requests: WaterfallRequest[];
  protocol: HttpProtocol;
  visible: Set<string>;
}) {
  const total = Math.max(...requests.map((request) => request.receivingEnd), 1);
  const at = (time: number) => `${(time / total) * 100}%`;
  const span = (from: number, to: number, min = 0.8) =>
    `${Math.max(((to - from) / total) * 100, min)}%`;
  const details = protocolDetails(protocol);
  return (
    <div
      role="img"
      aria-label={`A request waterfall for ${details.label} on ${details.connections} ${details.connections === 1 ? 'connection' : 'connections'}, about ${Math.round(total)} ms`}
      className="mt-2 text-xs"
    >
      <div className={cn(ROW, 'border-b pb-1 text-muted-foreground')}>
        <span>Request</span>
        <span>Conn</span>
        <div className="relative h-4 tabular-nums">
          <span className="absolute left-0">0 ms</span>
          <span className="absolute left-1/2 hidden -translate-x-1/2 sm:inline">
            {Math.round(total / 2)} ms
          </span>
          <span className="absolute right-0">{Math.round(total)} ms</span>
        </div>
      </div>
      <ul className="mt-1 space-y-1">
        {requests.map((request) => {
          const waitFrom = request.connectionEnd ?? request.waitingStart;
          return (
            <li key={request.id} className={cn(ROW, !visible.has(request.id) && 'opacity-30')}>
              <span className="truncate font-mono">{request.label}</span>
              <span className="font-mono text-muted-foreground">#{request.lane + 1}</span>
              <div className="relative h-3.5">
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-1/2 border-l border-dashed border-border"
                />
                {request.connectionStart !== null && request.connectionEnd !== null && (
                  <span
                    className="absolute inset-y-0.5 rounded-sm border bg-muted"
                    style={{
                      left: at(request.connectionStart),
                      width: span(request.connectionStart, request.connectionEnd),
                    }}
                  />
                )}
                {request.receivingStart > waitFrom && (
                  <span
                    className="absolute top-1/2 border-t border-dashed border-muted-foreground"
                    style={{ left: at(waitFrom), width: span(waitFrom, request.receivingStart, 0) }}
                  />
                )}
                <span
                  className={cn('absolute inset-y-0 rounded-sm border', RESPONSE_BAR[request.kind])}
                  style={{
                    left: at(request.receivingStart),
                    width: span(request.receivingStart, request.receivingEnd),
                  }}
                />
                {request.lossAt !== null && (
                  <span
                    className="absolute inset-y-0 rounded-sm bg-wrong"
                    style={{
                      left: at(request.lossAt),
                      width: span(request.lossAt, request.lossAt + request.lossDelayMs),
                    }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Legend() {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1">
        <span className="h-2.5 w-4 rounded-sm border bg-muted" /> connection setup
      </li>
      <li className="flex items-center gap-1">
        <span className="w-4 border-t border-dashed border-muted-foreground" /> waiting
      </li>
      {(['html', 'css', 'js', 'image'] as const).map((kind) => (
        <li key={kind} className="flex items-center gap-1">
          <span className={cn('h-2.5 w-4 rounded-sm border', RESPONSE_BAR[kind])} />
          {kind === 'image' ? 'images' : kind.toUpperCase()}
        </li>
      ))}
      <li className="flex items-center gap-1">
        <span className="h-2.5 w-4 rounded-sm bg-wrong" /> lost packet, waiting for the resend
      </li>
    </ul>
  );
}

function ProtocolControls({
  state,
  update,
}: {
  state: LabState;
  update: (next: LabState) => void;
}) {
  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Load controls</h3>
        <span className="font-mono text-xs text-muted-foreground">
          {PAGE_REQUESTS.length} requests on {LINK_MEGABITS_PER_SECOND} Mbit/s
        </span>
      </div>
      <div className="mt-2 grid gap-2">
        <div role="group" aria-label="HTTP version" className="grid grid-cols-3 gap-2">
          {PROTOCOLS.map((protocol) => (
            <Button
              key={protocol.id}
              type="button"
              variant={state.config.protocol === protocol.id ? 'default' : 'outline'}
              className="h-10 text-xs"
              aria-pressed={state.config.protocol === protocol.id}
              onClick={() => update(setProtocol(state, protocol.id))}
            >
              {protocol.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium">Round-trip time</span>
          <div role="group" aria-label="Round-trip time" className="flex flex-1 gap-1">
            {RTT_OPTIONS.map((rtt) => (
              <Button
                key={rtt}
                type="button"
                variant={state.config.rttMs === rtt ? 'default' : 'outline'}
                className="h-10 flex-1 text-xs lg:h-8"
                aria-pressed={state.config.rttMs === rtt}
                onClick={() => update(setRtt(state, rtt as RttMs))}
              >
                {rtt} ms
              </Button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 text-xs lg:h-8"
            aria-pressed={state.config.loss}
            onClick={() => update(setLoss(state, !state.config.loss))}
          >
            Lose one packet: {state.config.loss ? 'on' : 'off'}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Readouts({ state }: { state: LabState }) {
  const result = computeLoad(state.config);
  return (
    <section className="rounded-lg border bg-card p-3">
      <h3 className="text-sm font-semibold">This modelled load</h3>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <span className="block text-muted-foreground">Last byte</span>
          <strong className="font-mono">{formatMs(result.totalMs)}</strong>
        </div>
        <div>
          <span className="block text-muted-foreground">Connections</span>
          <strong className="font-mono">{result.connectionsOpened}</strong>
        </div>
        <div>
          <span className="block text-muted-foreground">Setup</span>
          <strong className="font-mono">{result.handshakeRoundTrips} RTT</strong>
        </div>
        <div>
          <span className="block text-muted-foreground">Stalled requests</span>
          <strong className="font-mono">{result.stalledRequestIds.length}</strong>
        </div>
      </div>
      {result.lossDescription && (
        <p className="mt-2 text-xs text-muted-foreground">{result.lossDescription}</p>
      )}
    </section>
  );
}

export default function HttpVersionsLab() {
  const [state, setState] = useState(createLab);
  const [tab, setTab] = useState('lab');
  const [dismissed, setDismissed] = useState(false);
  const missions = useMissions(MISSIONS, state);
  const load = useMemo(() => computeLoad(state.config), [state.config]);
  const labels = stepLabels(state.config);
  const currentLabel = labels[state.step];
  const visible = visibleRequestIds(state.config, state.step);
  const currentMission = missions.current;
  const details = protocolDetails(state.config.protocol);
  const update = (next: LabState) => setState(next);
  const startOver = () => {
    setState(createLab());
    setDismissed(false);
    missions.reset();
  };
  const stepPills: SimStep[] = labels.map((label, index) => ({
    title: label,
    status: index < state.step ? 'done' : index === state.step ? 'started' : 'todo',
  }));
  const status = state.loads.at(-1);
  const lab = (
    <div className="space-y-2.5">
      <ProtocolControls state={state} update={update} />
      <section className="rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Request waterfall</h3>
            <p className="text-xs text-muted-foreground">
              {details.label} over {details.transport}, {details.connections}{' '}
              {details.connections === 1 ? 'connection' : 'connections'}.
            </p>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {formatMs(load.totalMs)}, {(load.totalMs / state.config.rttMs).toFixed(1)} RTT
          </span>
        </div>
        <Waterfall requests={load.requests} protocol={state.config.protocol} visible={visible} />
        <Legend />
      </section>
      <SimFeedback tone="info" label={`${currentLabel}: ${details.label}`}>
        <p>
          {currentLabel === 'Connect'
            ? `${details.handshakeRoundTrips} round trips complete transport setup before the first request.`
            : currentLabel === 'HTML'
              ? 'index.html arrives before the browser discovers the twelve assets.'
              : currentLabel === 'Lost packet'
                ? 'One packet about 6 KB into app.js is lost and resent one RTT later.'
                : currentLabel === 'Done'
                  ? `Last byte arrives in ${formatMs(load.totalMs)} in this simplified model.`
                  : 'The twelve assets use the selected connection and stream rules.'}
        </p>
      </SimFeedback>
      <p className="text-xs text-muted-foreground">{SIMPLIFICATIONS[0]}</p>
    </div>
  );
  const missionPanel = (
    <div className="space-y-2.5">
      <SimMissionList missions={missions.missions} />
      <Readouts state={state} />
      <details className="rounded-lg border bg-card p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Why the lanes differ</summary>
        <p className="mt-2 text-muted-foreground">
          HTTP/1.1 serializes requests per connection and this lab opens up to six browser
          connections. HTTP/2 multiplexes streams over TCP; HTTP/3 multiplexes independent QUIC
          streams.
        </p>
      </details>
      <details className="rounded-lg border bg-card p-3 text-sm">
        <summary className="cursor-pointer font-semibold">What the loss marker means</summary>
        <p className="mt-2 text-muted-foreground">{SIMPLIFICATIONS[3]}</p>
      </details>
      <details className="rounded-lg border bg-card p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Model limits</summary>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          {SIMPLIFICATIONS.slice(1, 3).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  );
  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimAnnouncer
          message={
            status
              ? `${protocolDetails(status.config.protocol).label} finished in ${formatMs(status.totalMs)}.`
              : `${details.label} is ready at ${state.config.rttMs} ms RTT.`
          }
        />
        <SimBar
          title="HTTP Versions Lab"
          icon={Network}
          lead={
            <span className="font-mono text-xs text-muted-foreground">
              {details.label} · {state.config.rttMs} ms RTT
            </span>
          }
          steps={stepPills}
          current={state.step}
          onStep={(step) => update(goToStep(state, step))}
          stepNoun="Load step"
          stepsLabel="Load steps"
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={`Load step: ${currentLabel}`}
          actions={
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                className="h-10 text-xs lg:h-8"
                onClick={() => update(previousStep(state))}
                disabled={state.step === 0}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 text-xs lg:h-8"
                onClick={() => update(nextStep(state))}
                disabled={state.step === labels.length - 1}
              >
                Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                className="h-10 text-xs lg:h-8"
                onClick={() => update(playAll(state))}
                disabled={state.step === labels.length - 1}
              >
                <Play className="h-4 w-4" aria-hidden="true" /> Play all
              </Button>
            </div>
          }
          goal={
            currentMission ? (
              <>
                {currentMission.label}{' '}
                <span className="text-muted-foreground">{currentMission.hint}</span>
              </>
            ) : (
              'All missions complete. Keep comparing the modelled protocol behaviors.'
            )
          }
        />
        {missions.complete && !dismissed ? (
          <SimComplete
            title="HTTP versions lab complete"
            summary="You compared connection setup, multiplexing, TCP head-of-line blocking, and QUIC stream recovery."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'HTTP/1.1 lanes', value: protocolDetails('http1').connections },
              {
                label: 'HTTP/3 setup',
                value: `${protocolDetails('http3').handshakeRoundTrips} RTT`,
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
              { id: 'missions', label: 'Missions', content: missionPanel },
            ]}
            columns="lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.72fr)]"
            tab={tab}
            onTabChange={setTab}
            minHeight="min-h-[28rem]"
          />
        )}
        <SimPhoneBar>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => update(previousStep(state))}
            disabled={state.step === 0}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
          </Button>
          <Button
            type="button"
            className="h-10 flex-1"
            onClick={() => update(nextStep(state))}
            disabled={state.step === labels.length - 1}
          >
            Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => update(playAll(state))}
            disabled={state.step === labels.length - 1}
          >
            <Play className="h-4 w-4" aria-hidden="true" /> All
          </Button>
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
