'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Mail, Send } from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  SIM_TONE,
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
import { cn } from '@/lib/utils';
import {
  countPassingDmarc,
  DKIM_SELECTOR,
  DMARC_PCT_OPTIONS,
  evaluateAllPaths,
  evaluatePath,
  INITIAL_SETTINGS,
  PCT_BUCKET_TOTAL,
  PCT_SAMPLE_BUCKET,
  SPF_DNS_LOOKUP_LIMIT,
  SPF_RECORD_LABELS,
  type AlignmentMode,
  type AuthResult,
  type DeliveryPath,
  type DkimDomain,
  type DmarcPolicy,
  type LabSettings,
  type SpfRecord,
} from '@/lib/games/email-auth-lab-engine';

type Tab = 'lab' | 'details';

interface MissionState {
  settings: LabSettings;
  sent: Record<DeliveryPath, boolean>;
}

const PATHS: DeliveryPath[] = ['direct', 'forwarded', 'list'];

const PATH_LABELS: Record<DeliveryPath, string> = {
  direct: 'Direct',
  forwarded: 'Forwarded',
  list: 'Mailing list',
};

const MISSIONS: Mission<MissionState>[] = [
  {
    id: 'spf-pass',
    label: 'Make SPF pass for your own bounce domain.',
    hint: 'Turn on Use custom MAIL FROM, pick v=spf1 include:_spf.esp.example -all in SPF TXT, then press Send Direct.',
    check: (state) =>
      state.sent.direct &&
      state.settings.customMailFrom &&
      evaluatePath(state.settings, 'direct').spf.result === 'pass',
  },
  {
    id: 'dkim-aligned',
    label: 'Sign with your own domain and make DKIM pass aligned.',
    hint: `Pick d=shop.example in DKIM d=, turn on Publish ${DKIM_SELECTOR}._domainkey.shop.example, then press Send Direct.`,
    check: (state) => {
      const direct = evaluatePath(state.settings, 'direct');
      return (
        state.sent.direct && direct.dkim.result === 'pass' && direct.dkimDomain === 'shop.example'
      );
    },
  },
  {
    id: 'dmarc-monitor',
    label: 'Publish DMARC at p=none and see direct mail pass.',
    hint: 'Pick v=DMARC1; p=none in DMARC, then press Send Direct. Monitoring comes before enforcement.',
    check: (state) =>
      state.sent.direct &&
      state.settings.dmarcPolicy === 'none' &&
      evaluatePath(state.settings, 'direct').dmarc.result === 'pass',
  },
  {
    id: 'forwarder',
    label: 'Keep DMARC passing through the forwarder.',
    hint: 'Pick the Forwarded path and press Send Forwarded. SPF breaks at the forwarder; aligned DKIM survives.',
    check: (state) => {
      const forwarded = evaluatePath(state.settings, 'forwarded');
      return (
        state.sent.forwarded && forwarded.spf.result !== 'pass' && forwarded.dmarc.result === 'pass'
      );
    },
  },
  {
    id: 'list',
    label: 'Get mail through the mailing list under p=reject.',
    hint: 'Pick v=DMARC1; p=reject, turn on List rewrites From, pick the Mailing list path and press Send Mailing list.',
    check: (state) => {
      const list = evaluatePath(state.settings, 'list');
      return (
        state.sent.list &&
        state.settings.dmarcPolicy === 'reject' &&
        list.dmarc.result === 'pass' &&
        list.disposition === 'inbox' &&
        list.fromRewritten
      );
    },
  },
  {
    id: 'permerror',
    label: 'See SPF break with too many lookups.',
    hint: 'With custom MAIL FROM on, pick the record with 11 includes in SPF TXT and press Send Direct.',
    check: (state) =>
      PATHS.some(
        (path) => state.sent[path] && evaluatePath(state.settings, path).spf.result === 'permerror'
      ),
  },
];

const RESULT_TONE: Record<AuthResult, keyof typeof SIM_TONE> = {
  pass: 'success',
  fail: 'danger',
  softfail: 'warning',
  none: 'info',
  permerror: 'danger',
};

function resultClass(result: AuthResult): string {
  const tone = SIM_TONE[RESULT_TONE[result]];
  return `${tone.surface} ${tone.text}`;
}

function resultLabel(result: AuthResult): string {
  return result === 'permerror' ? 'permerror' : result;
}

const HOPS: Record<DeliveryPath, string> = {
  direct: 'shop.example → ESP → receiver',
  forwarded: 'shop.example → ESP → university forwarder → receiver',
  list: 'shop.example → ESP → list server → receiver',
};

function PathDiagram({
  active,
  verdicts,
  sent,
  onPick,
}: {
  active: DeliveryPath;
  verdicts: ReturnType<typeof evaluateAllPaths>;
  sent: Record<DeliveryPath, boolean>;
  onPick: (path: DeliveryPath) => void;
}) {
  return (
    <section className="rounded-lg border bg-card p-3" aria-label="Delivery paths">
      <h3 className="text-sm font-semibold">Delivery paths</h3>
      <p className="text-xs text-muted-foreground">
        Pick a path, then press Send. Each card shows what the receiver decided.
      </p>
      <ul className="mt-2 space-y-2">
        {verdicts.map((verdict, index) => {
          const selected = verdict.path === active;
          return (
            <li key={verdict.path}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onPick(verdict.path)}
                className={cn(
                  'w-full rounded-lg border p-2.5 text-left transition-colors motion-reduce:transition-none',
                  selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'
                )}
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="text-sm font-semibold">
                    {index + 1}. {verdict.label}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    connects from {verdict.connectingIp}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {HOPS[verdict.path]}
                </span>
                {sent[verdict.path] ? (
                  <span className="mt-1.5 flex flex-wrap items-center gap-1">
                    <ResultBadge label="SPF" result={verdict.spf.result} />
                    <ResultBadge label="DKIM" result={verdict.dkim.result} />
                    <ResultBadge label="DMARC" result={verdict.dmarc.result} />
                    <span className="text-xs font-medium">: {verdict.disposition}</span>
                  </span>
                ) : (
                  <span className="mt-1.5 block text-xs text-muted-foreground">Not sent yet</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const FIELD =
  'h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs lg:h-8';

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border px-2 text-left text-xs lg:h-8',
        on ? 'border-correct/50 bg-correct/10' : 'border-border'
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 font-semibold">{on ? 'On' : 'Off'}</span>
    </button>
  );
}

function RecordsPanel({
  settings,
  update,
  activePath,
  onPath,
  send,
}: {
  settings: LabSettings;
  update: <K extends keyof LabSettings>(key: K, value: LabSettings[K]) => void;
  activePath: DeliveryPath;
  onPath: (path: DeliveryPath) => void;
  send: ReactNode;
}) {
  return (
    <details open className="group rounded-lg border bg-card p-3" aria-label="Records and settings">
      <summary className="cursor-pointer text-sm font-semibold sm:hidden">
        Records and settings
      </summary>
      <div className="mt-2 grid gap-x-3 gap-y-2 sm:mt-0 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-xs font-medium">
          SPF TXT at the MAIL FROM domain
          <select
            aria-label="SPF TXT record"
            value={settings.spfRecord}
            onChange={(event) => update('spfRecord', event.target.value as SpfRecord)}
            className={FIELD}
          >
            {Object.entries(SPF_RECORD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium">
          DKIM d=
          <select
            aria-label="DKIM signing domain"
            value={settings.dkimDomain}
            onChange={(event) => update('dkimDomain', event.target.value as DkimDomain)}
            className={FIELD}
          >
            <option value="esp.example">d=esp.example</option>
            <option value="shop.example">d=shop.example</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium">
          DMARC at _dmarc.shop.example
          <select
            aria-label="DMARC record"
            value={settings.dmarcPolicy ?? 'absent'}
            onChange={(event) =>
              update(
                'dmarcPolicy',
                event.target.value === 'absent' ? null : (event.target.value as DmarcPolicy)
              )
            }
            className={FIELD}
          >
            <option value="absent">No DMARC record</option>
            <option value="none">v=DMARC1; p=none</option>
            <option value="quarantine">v=DMARC1; p=quarantine</option>
            <option value="reject">v=DMARC1; p=reject</option>
          </select>
        </label>
        <Toggle
          on={settings.customMailFrom}
          label="Use custom MAIL FROM bounce.shop.example"
          onClick={() => update('customMailFrom', !settings.customMailFrom)}
        />
        <Toggle
          on={settings.shopDkimKey}
          label={`Publish ${DKIM_SELECTOR}._domainkey.shop.example`}
          onClick={() => update('shopDkimKey', !settings.shopDkimKey)}
        />
        <Toggle
          on={settings.listFromRewrite}
          label="List rewrites From and sets Reply-To"
          onClick={() => update('listFromRewrite', !settings.listFromRewrite)}
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs font-medium">
            aspf
            <select
              aria-label="SPF alignment"
              value={settings.aspf}
              onChange={(event) => update('aspf', event.target.value as AlignmentMode)}
              className={FIELD}
            >
              <option value="relaxed">relaxed</option>
              <option value="strict">strict</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            adkim
            <select
              aria-label="DKIM alignment"
              value={settings.adkim}
              onChange={(event) => update('adkim', event.target.value as AlignmentMode)}
              className={FIELD}
            >
              <option value="relaxed">relaxed</option>
              <option value="strict">strict</option>
            </select>
          </label>
        </div>
        <div role="group" aria-label="DMARC percentage" className="flex items-end gap-1">
          {DMARC_PCT_OPTIONS.map((pct) => (
            <Button
              key={pct}
              type="button"
              size="sm"
              variant={settings.dmarcPct === pct ? 'default' : 'outline'}
              className="h-10 flex-1 text-xs lg:h-8"
              aria-pressed={settings.dmarcPct === pct}
              onClick={() => update('dmarcPct', pct)}
            >
              pct={pct}
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <span className="text-xs font-medium">Path</span>
        <div
          role="group"
          aria-label="Delivery path"
          className="flex flex-wrap rounded-md border p-0.5"
        >
          {PATHS.map((path) => (
            <button
              key={path}
              type="button"
              aria-label={`Path: ${PATH_LABELS[path]}`}
              aria-pressed={activePath === path}
              onClick={() => onPath(path)}
              className={cn(
                'h-9 rounded px-2.5 text-xs font-medium lg:h-7',
                activePath === path
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {PATH_LABELS[path]}
            </button>
          ))}
        </div>
        {send}
      </div>
    </details>
  );
}

function ResultBadge({ label, result }: { label: string; result: AuthResult }) {
  return (
    <span className={cn('rounded border px-1.5 py-0.5 text-xs font-semibold', resultClass(result))}>
      {label}: {resultLabel(result)}
    </span>
  );
}

export default function EmailAuthLab() {
  const [settings, setSettings] = useState<LabSettings>(INITIAL_SETTINGS);
  const [activePath, setActivePath] = useState<DeliveryPath>('direct');
  const [sent, setSent] = useState<Record<DeliveryPath, boolean>>({
    direct: false,
    forwarded: false,
    list: false,
  });
  const [tab, setTab] = useState<Tab>('lab');
  const [dismissed, setDismissed] = useState(false);
  const missionState = useMemo(() => ({ settings, sent }), [settings, sent]);
  const missions = useMissions(MISSIONS, missionState);
  const verdicts = useMemo(() => evaluateAllPaths(settings), [settings]);
  const activeVerdict = verdicts.find((verdict) => verdict.path === activePath) ?? verdicts[0];
  const dmarcPasses = countPassingDmarc(settings);

  const update = <K extends keyof LabSettings>(key: K, value: LabSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setDismissed(false);
  };
  const send = (path = activePath) => {
    setActivePath(path);
    setSent((current) => ({ ...current, [path]: true }));
    setDismissed(false);
  };
  const startOver = () => {
    setSettings(INITIAL_SETTINGS);
    setActivePath('direct');
    setSent({ direct: false, forwarded: false, list: false });
    setDismissed(false);
    missions.reset();
  };

  const controls = (height: string, phone = false) => (
    <Button
      type="button"
      size="sm"
      className={cn(height, phone && 'flex-1')}
      onClick={() => send()}
    >
      <Send className="h-4 w-4" aria-hidden="true" /> Send {activeVerdict.label}
    </Button>
  );

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="Email Authentication Lab"
          icon={Mail}
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          goal={
            missions.current ? (
              <>
                {missions.current.label}{' '}
                <span className="text-muted-foreground">{missions.current.hint}</span>
              </>
            ) : (
              'All missions done. Keep sending mail with different authentication settings.'
            )
          }
        />
        <RecordsPanel
          settings={settings}
          update={update}
          activePath={activePath}
          onPath={setActivePath}
          send={controls('h-10 lg:h-8')}
        />
        <SimAnnouncer
          message={`${activeVerdict.label}: SPF ${activeVerdict.spf.result}, DKIM ${activeVerdict.dkim.result}, DMARC ${activeVerdict.dmarc.result}.`}
        />
        {missions.complete && !dismissed ? (
          <SimComplete
            title="Email authentication mapped"
            summary="You published sender records, preserved aligned DKIM through forwarding, and used a list From rewrite when the list changed the message."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'DMARC passes', value: dmarcPasses, note: 'of paths now shown' },
              {
                label: 'SPF lookup cap',
                value: SPF_DNS_LOOKUP_LIMIT,
                note: 'DNS-querying mechanisms',
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
            columns="lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.9fr)]"
            minHeight="min-h-[22rem]"
            tab={tab}
            onTabChange={(value) => {
              if (value === 'lab' || value === 'details') setTab(value);
            }}
            tabsLabel="Email authentication panels"
            panels={[
              {
                id: 'lab',
                label: 'Lab',
                className: 'space-y-2',
                content: (
                  <div className="space-y-2">
                    <PathDiagram
                      active={activePath}
                      verdicts={verdicts}
                      sent={sent}
                      onPick={setActivePath}
                    />
                    <section className="rounded-lg border bg-card p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold">Message at the receiver</h3>
                          <p className="text-xs text-muted-foreground">
                            Send after changing a record or ESP setting.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <ResultBadge label="SPF" result={activeVerdict.spf.result} />
                          <ResultBadge label="DKIM" result={activeVerdict.dkim.result} />
                          <ResultBadge label="DMARC" result={activeVerdict.dmarc.result} />
                        </div>
                      </div>
                      <dl className="mt-3 grid gap-x-3 gap-y-1 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-xs text-muted-foreground">Connecting IP</dt>
                          <dd className="font-mono text-xs">{activeVerdict.connectingIp}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">MAIL FROM</dt>
                          <dd className="font-mono text-xs">{activeVerdict.mailFrom}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Header From</dt>
                          <dd className="font-mono text-xs">{activeVerdict.headerFrom}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">DKIM d=</dt>
                          <dd className="font-mono text-xs">{activeVerdict.dkimDomain}</dd>
                        </div>
                      </dl>
                      <div className="mt-3 space-y-1.5">
                        <SimFeedback
                          tone={RESULT_TONE[activeVerdict.spf.result]}
                          label={`SPF ${resultLabel(activeVerdict.spf.result)}`}
                        >
                          <p>
                            {activeVerdict.spf.reason} Checked {activeVerdict.spf.domain};{' '}
                            {activeVerdict.spf.aligned ? 'aligned' : 'not aligned'}.
                          </p>
                        </SimFeedback>
                        <SimFeedback
                          tone={RESULT_TONE[activeVerdict.dkim.result]}
                          label={`DKIM ${resultLabel(activeVerdict.dkim.result)}`}
                        >
                          <p>
                            {activeVerdict.dkim.reason} Checked {activeVerdict.dkim.domain};{' '}
                            {activeVerdict.dkim.aligned ? 'aligned' : 'not aligned'}.
                          </p>
                        </SimFeedback>
                        <SimFeedback
                          tone={RESULT_TONE[activeVerdict.dmarc.result]}
                          label={`DMARC ${resultLabel(activeVerdict.dmarc.result)}`}
                        >
                          <p>
                            {activeVerdict.dmarc.reason} Looked up {activeVerdict.dmarcLookup}.
                          </p>
                        </SimFeedback>
                      </div>
                      <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
                        <span className="font-medium">Policy: </span>
                        {activeVerdict.policyApplied}.{' '}
                        <span className="font-medium">Disposition: </span>
                        {activeVerdict.disposition}.
                      </div>
                    </section>
                  </div>
                ),
              },
              {
                id: 'details',
                label: 'Missions',
                className: 'space-y-2',
                content: (
                  <div className="space-y-2">
                    <SimMissionList missions={missions.missions} />
                    <details className="rounded-lg border bg-card p-3">
                      <summary className="cursor-pointer text-sm font-semibold">
                        How this lab simplifies a receiver
                      </summary>
                      <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                        <p>
                          A simplified model: SPF checks MAIL FROM only. HELO identity, SRS, and ARC
                          trust are out of scope. Some receivers trust a forwarder or list ARC seal
                          of earlier results, but this lab does not model ARC.
                        </p>
                        <p>
                          For the reduced percentage setting, this deterministic example uses bucket{' '}
                          {PCT_SAMPLE_BUCKET} of {PCT_BUCKET_TOTAL}, so the same message always has
                          the same policy result. RFC 7489 allows pct; the newer DMARCbis draft
                          removes it.
                        </p>
                      </div>
                    </details>
                  </div>
                ),
              },
            ]}
          />
        )}
        <SimPhoneBar>{controls('h-10', true)}</SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
