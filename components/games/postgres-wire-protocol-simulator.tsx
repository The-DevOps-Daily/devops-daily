'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  AlertTriangle,
  Binary,
  Braces,
  Database,
  KeyRound,
  Lock,
  Pause,
  Play,
  Rows3,
  Server,
  Terminal,
  Unplug,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
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
  type SimStep,
  type SimTone,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';

type Scenario = 'startup' | 'simple' | 'extended' | 'copy';
type Direction = 'client' | 'server' | 'both';
type MessageTone = 'startup' | 'query' | 'data' | 'auth' | 'ready' | 'error';

interface ProtocolStep {
  id: string;
  code: string;
  label: string;
  from: Direction;
  tone: MessageTone;
  bytes: number;
  rtt: number;
  payload: string;
  fields: string[];
  note: string;
}

interface ScenarioConfig {
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  query: string;
  steps: ProtocolStep[];
}

const BASE_SCENARIOS: Record<Scenario, ScenarioConfig> = {
  startup: {
    title: 'Startup and authentication',
    subtitle:
      'SSL negotiation, startup parameters, SCRAM challenge, session settings, ready state.',
    icon: KeyRound,
    query: 'psql "postgres://app@db.prod:5432/app"',
    steps: [
      {
        id: 'ssl-request',
        code: 'SSLRequest',
        label: 'Ask for TLS',
        from: 'client',
        tone: 'startup',
        bytes: 8,
        rtt: 0.5,
        payload: 'Int32 length=8, Int32 code=80877103',
        fields: ['length: 8', 'magic: 0x04D2162F', 'no type byte'],
        note: 'The client can ask whether the server accepts SSL before sending startup parameters.',
      },
      {
        id: 'ssl-ok',
        code: 'S',
        label: 'TLS accepted',
        from: 'server',
        tone: 'auth',
        bytes: 1,
        rtt: 0.5,
        payload: 'Single byte response: S',
        fields: ['S: continue with TLS', 'N: cleartext only'],
        note: 'After S, the TLS handshake happens outside the PostgreSQL message stream.',
      },
      {
        id: 'startup',
        code: 'StartupMessage',
        label: 'Send startup parameters',
        from: 'client',
        tone: 'startup',
        bytes: 92,
        rtt: 1,
        payload: 'protocol=3.0 user=app database=app application_name=wire_lab',
        fields: ['length', 'protocol version', 'user', 'database', 'options'],
        note: 'StartupMessage has a length and protocol version, but no leading message type byte.',
      },
      {
        id: 'auth-sasl',
        code: 'R',
        label: 'AuthenticationSASL',
        from: 'server',
        tone: 'auth',
        bytes: 33,
        rtt: 1.5,
        payload: 'SCRAM-SHA-256 offered',
        fields: ['type: R', 'length', 'auth code: 10', 'mechanisms'],
        note: 'Modern PostgreSQL commonly uses SCRAM-SHA-256 for password authentication.',
      },
      {
        id: 'sasl-initial',
        code: 'p',
        label: 'SASLInitialResponse',
        from: 'client',
        tone: 'auth',
        bytes: 86,
        rtt: 2,
        payload: 'client-first-message with nonce',
        fields: ['type: p', 'mechanism', 'initial response length', 'client nonce'],
        note: 'The client proves knowledge of the password without sending the password itself.',
      },
      {
        id: 'sasl-continue',
        code: 'R',
        label: 'AuthenticationSASLContinue',
        from: 'server',
        tone: 'auth',
        bytes: 96,
        rtt: 2.5,
        payload: 'server nonce, salt, iteration count',
        fields: ['auth code: 11', 'salt', 'iterations', 'server nonce'],
        note: 'The server challenge binds both nonces and the stored verifier.',
      },
      {
        id: 'sasl-final',
        code: 'p',
        label: 'SASLResponse',
        from: 'client',
        tone: 'auth',
        bytes: 112,
        rtt: 3,
        payload: 'client proof',
        fields: ['client-final-message', 'channel binding flag', 'proof'],
        note: 'The client sends a proof derived from the password, salt, and nonce exchange.',
      },
      {
        id: 'auth-ok',
        code: 'R',
        label: 'AuthenticationOk',
        from: 'server',
        tone: 'ready',
        bytes: 9,
        rtt: 3.5,
        payload: 'auth code 0',
        fields: ['type: R', 'length: 8', 'auth code: 0'],
        note: 'Authentication is complete; the backend can now announce session state.',
      },
      {
        id: 'parameter-status',
        code: 'S',
        label: 'ParameterStatus',
        from: 'server',
        tone: 'ready',
        bytes: 128,
        rtt: 3.5,
        payload: 'server_version, TimeZone, client_encoding',
        fields: ['server_version', 'server_encoding', 'DateStyle', 'integer_datetimes'],
        note: 'Drivers cache these settings because they affect parsing and display behavior.',
      },
      {
        id: 'ready-startup',
        code: 'Z',
        label: 'ReadyForQuery',
        from: 'server',
        tone: 'ready',
        bytes: 6,
        rtt: 4,
        payload: 'transaction status: idle',
        fields: ['type: Z', 'length: 5', 'status: I'],
        note: 'ReadyForQuery tells the client it can safely send the next command.',
      },
    ],
  },
  simple: {
    title: 'Simple query protocol',
    subtitle: 'One Query message in, a row stream and completion status out.',
    icon: Terminal,
    query: 'SELECT id, email, plan FROM users WHERE active = true LIMIT 3;',
    steps: [
      {
        id: 'query',
        code: 'Q',
        label: 'Query',
        from: 'client',
        tone: 'query',
        bytes: 74,
        rtt: 0.5,
        payload: 'SQL string terminated by zero byte',
        fields: ['type: Q', 'length', 'UTF-8 query string', 'zero terminator'],
        note: 'The simple protocol sends the full SQL text in a single Query message.',
      },
      {
        id: 'row-desc',
        code: 'T',
        label: 'RowDescription',
        from: 'server',
        tone: 'data',
        bytes: 168,
        rtt: 1,
        payload: '3 columns: id, email, plan',
        fields: ['field count', 'name', 'type OID', 'type size', 'format code'],
        note: 'RowDescription tells the driver how to decode every DataRow field.',
      },
      {
        id: 'data-row',
        code: 'D',
        label: 'DataRow stream',
        from: 'server',
        tone: 'data',
        bytes: 240,
        rtt: 1.25,
        payload: 'Rows flow one message at a time',
        fields: ['column count', 'value length', 'value bytes', '-1 for NULL'],
        note: 'Every returned row is a separate DataRow message.',
      },
      {
        id: 'command-complete',
        code: 'C',
        label: 'CommandComplete',
        from: 'server',
        tone: 'ready',
        bytes: 16,
        rtt: 1.5,
        payload: 'SELECT 3',
        fields: ['type: C', 'length', 'command tag'],
        note: 'The command tag includes the statement kind and row count when applicable.',
      },
      {
        id: 'ready-simple',
        code: 'Z',
        label: 'ReadyForQuery',
        from: 'server',
        tone: 'ready',
        bytes: 6,
        rtt: 1.5,
        payload: 'transaction status: idle',
        fields: ['I: idle', 'T: in transaction', 'E: failed transaction'],
        note: 'Drivers wait for ReadyForQuery before considering the exchange complete.',
      },
    ],
  },
  extended: {
    title: 'Extended query protocol',
    subtitle: 'Parse, Bind, Describe, Execute, Sync for prepared and parameterized queries.',
    icon: Braces,
    query: 'SELECT * FROM orders WHERE customer_id = $1 AND created_at > $2;',
    steps: [
      {
        id: 'parse',
        code: 'P',
        label: 'Parse',
        from: 'client',
        tone: 'query',
        bytes: 112,
        rtt: 0.25,
        payload: 'statement name, SQL, parameter type OIDs',
        fields: ['statement name', 'query string', 'parameter type count', 'type OIDs'],
        note: 'Parse creates a prepared statement on the backend.',
      },
      {
        id: 'bind',
        code: 'B',
        label: 'Bind',
        from: 'client',
        tone: 'query',
        bytes: 96,
        rtt: 0.3,
        payload: 'portal name and parameter values',
        fields: ['portal name', 'statement name', 'format codes', 'parameter values'],
        note: 'Bind supplies concrete values and creates a portal ready to execute.',
      },
      {
        id: 'describe',
        code: 'D',
        label: 'Describe',
        from: 'client',
        tone: 'query',
        bytes: 18,
        rtt: 0.35,
        payload: 'describe portal result shape',
        fields: ['target: portal', 'portal name'],
        note: 'Describe asks for metadata before rows arrive.',
      },
      {
        id: 'execute',
        code: 'E',
        label: 'Execute',
        from: 'client',
        tone: 'query',
        bytes: 16,
        rtt: 0.4,
        payload: 'portal name, max rows=0',
        fields: ['portal name', 'max rows'],
        note: 'Execute starts reading from the bound portal.',
      },
      {
        id: 'sync',
        code: 'S',
        label: 'Sync',
        from: 'client',
        tone: 'query',
        bytes: 5,
        rtt: 0.5,
        payload: 'end extended-query cycle',
        fields: ['type: S', 'length: 4'],
        note: 'Sync asks the backend to finish the batch and return ReadyForQuery.',
      },
      {
        id: 'parse-complete',
        code: '1',
        label: 'ParseComplete',
        from: 'server',
        tone: 'ready',
        bytes: 5,
        rtt: 1,
        payload: 'parse succeeded',
        fields: ['type: 1', 'length: 4'],
        note: 'The backend acknowledges each stage in order.',
      },
      {
        id: 'bind-complete',
        code: '2',
        label: 'BindComplete',
        from: 'server',
        tone: 'ready',
        bytes: 5,
        rtt: 1.05,
        payload: 'bind succeeded',
        fields: ['type: 2', 'length: 4'],
        note: 'The portal is ready to execute.',
      },
      {
        id: 'row-desc-extended',
        code: 'T',
        label: 'RowDescription',
        from: 'server',
        tone: 'data',
        bytes: 184,
        rtt: 1.15,
        payload: 'orders result columns',
        fields: ['field metadata', 'table OID', 'attribute number', 'format code'],
        note: 'Format codes can be text or binary per column.',
      },
      {
        id: 'data-extended',
        code: 'D',
        label: 'DataRow stream',
        from: 'server',
        tone: 'data',
        bytes: 420,
        rtt: 1.25,
        payload: 'matching orders',
        fields: ['row values', 'binary or text encoded', 'NULL as -1 length'],
        note: 'Parameterized queries still return ordinary DataRow messages.',
      },
      {
        id: 'ready-extended',
        code: 'Z',
        label: 'ReadyForQuery',
        from: 'server',
        tone: 'ready',
        bytes: 6,
        rtt: 1.5,
        payload: 'idle',
        fields: ['transaction status'],
        note: 'The extended cycle is complete.',
      },
    ],
  },
  copy: {
    title: 'COPY streaming',
    subtitle: 'Bulk import/export uses CopyInResponse, CopyData chunks, and CopyDone.',
    icon: Rows3,
    query: 'COPY events FROM STDIN WITH (FORMAT csv);',
    steps: [
      {
        id: 'copy-query',
        code: 'Q',
        label: 'COPY command',
        from: 'client',
        tone: 'query',
        bytes: 48,
        rtt: 0.5,
        payload: 'COPY events FROM STDIN',
        fields: ['type: Q', 'COPY SQL'],
        note: 'COPY can be initiated through the query protocol.',
      },
      {
        id: 'copy-in',
        code: 'G',
        label: 'CopyInResponse',
        from: 'server',
        tone: 'data',
        bytes: 18,
        rtt: 1,
        payload: 'server is ready to receive stream',
        fields: ['overall format', 'column count', 'per-column format codes'],
        note: 'The server switches into COPY-in mode.',
      },
      {
        id: 'copy-data',
        code: 'd',
        label: 'CopyData chunks',
        from: 'client',
        tone: 'data',
        bytes: 1024,
        rtt: 1.15,
        payload: 'CSV bytes streamed in chunks',
        fields: ['type: d', 'length', 'opaque chunk bytes'],
        note: 'COPY data is an opaque byte stream to the protocol layer.',
      },
      {
        id: 'copy-done',
        code: 'c',
        label: 'CopyDone',
        from: 'client',
        tone: 'ready',
        bytes: 5,
        rtt: 1.4,
        payload: 'client finished sending rows',
        fields: ['type: c', 'length: 4'],
        note: 'CopyDone ends the stream successfully. CopyFail aborts it.',
      },
      {
        id: 'copy-complete',
        code: 'C',
        label: 'CommandComplete',
        from: 'server',
        tone: 'ready',
        bytes: 19,
        rtt: 1.8,
        payload: 'COPY 25000',
        fields: ['command tag', 'row count'],
        note: 'The command tag reports how many rows were copied.',
      },
      {
        id: 'ready-copy',
        code: 'Z',
        label: 'ReadyForQuery',
        from: 'server',
        tone: 'ready',
        bytes: 6,
        rtt: 1.9,
        payload: 'idle',
        fields: ['transaction status'],
        note: 'The connection returns to normal command mode.',
      },
    ],
  },
};

const providers = [
  {
    name: 'DigitalOcean Managed PostgreSQL',
    label: 'Managed',
    href: 'https://m.do.co/c/2a9bba940f39',
    description:
      'Managed Postgres with backups, standby nodes, VPC networking, and simple pricing.',
    sponsored: true,
  },
  {
    name: 'Neon',
    label: 'Serverless',
    href: 'https://neon.com',
    description: 'Serverless Postgres with branching, autoscaling, and instant restore workflows.',
  },
  {
    name: 'Supabase',
    label: 'App platform',
    href: 'https://supabase.com/database',
    description:
      'Managed Postgres with auth, storage, realtime, edge functions, and dashboard tooling.',
  },
  {
    name: 'Crunchy Bridge',
    label: 'Postgres experts',
    href: 'https://www.crunchydata.com/products/crunchy-bridge',
    description:
      'Fully managed Postgres backed by Crunchy Data support and multi-cloud deployment.',
  },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function flowDirection(step: ProtocolStep) {
  if (step.from === 'client') return 'Client to server';
  if (step.from === 'server') return 'Server to client';
  return 'Both directions';
}

function compactCode(code: string) {
  const compact: Record<string, string> = {
    SSLRequest: 'SSL',
    StartupMessage: 'START',
  };

  return compact[code] ?? code;
}

function getScenarioSteps(
  scenario: Scenario,
  tlsEnabled: boolean,
  rowCount: number,
  injectError: boolean
) {
  let steps = BASE_SCENARIOS[scenario].steps;

  if (!tlsEnabled && scenario === 'startup') {
    steps = steps.filter((step) => step.id !== 'ssl-request' && step.id !== 'ssl-ok');
  }

  const rowMultiplier = Math.max(1, Math.ceil(rowCount / 3));
  steps = steps.map((step) => {
    if (step.id.includes('data') || step.id === 'data-row' || step.id === 'copy-data') {
      return {
        ...step,
        bytes: step.id === 'copy-data' ? Math.max(1024, rowCount * 58) : step.bytes * rowMultiplier,
        payload:
          step.id === 'copy-data'
            ? `${rowCount.toLocaleString()} CSV rows streamed in chunks`
            : `${rowCount.toLocaleString()} row${rowCount === 1 ? '' : 's'} returned`,
      };
    }
    if (step.id.includes('command-complete') || step.id === 'copy-complete') {
      return {
        ...step,
        payload: step.id === 'copy-complete' ? `COPY ${rowCount}` : `SELECT ${rowCount}`,
      };
    }
    return step;
  });

  if (injectError && scenario !== 'startup') {
    const errorStep: ProtocolStep = {
      id: 'error-response',
      code: 'E',
      label: 'ErrorResponse',
      from: 'server',
      tone: 'error',
      bytes: 142,
      rtt: 1.2,
      payload: 'SQLSTATE 42P01 relation does not exist',
      fields: ['severity', 'SQLSTATE', 'message', 'detail', 'position'],
      note: 'Errors are structured fields, then the server drains to ReadyForQuery after Sync or query completion.',
    };
    const readyStep: ProtocolStep = {
      id: 'ready-after-error',
      code: 'Z',
      label: 'ReadyForQuery',
      from: 'server',
      tone: 'ready',
      bytes: 6,
      rtt: 1.4,
      payload: 'failed transaction or idle',
      fields: ['I: idle', 'E: failed transaction'],
      note: 'A driver should inspect transaction status before retrying.',
    };
    steps = [...steps.slice(0, Math.min(2, steps.length)), errorStep, readyStep];
  }

  return steps;
}

const MESSAGE_TONE: Record<MessageTone, SimTone> = {
  startup: 'info',
  query: 'info',
  data: 'success',
  auth: 'warning',
  ready: 'success',
  error: 'danger',
};

interface MissionState {
  scenario: Scenario;
  activeIndex: number;
  injectError: boolean;
  steps: ProtocolStep[];
  tlsEnabled: boolean;
}

const MISSIONS: Mission<MissionState>[] = [
  {
    id: 'startup',
    label: 'Connect and authenticate: from SSLRequest to ReadyForQuery.',
    hint: 'Pick Startup with TLS on and press Play.',
    check: (state) =>
      state.scenario === 'startup' &&
      state.tlsEnabled &&
      state.activeIndex === state.steps.length - 1,
  },
  {
    id: 'simple',
    label: 'Send one query with the simple protocol.',
    hint: 'Pick Simple and press Play: one Query message, then rows, then ReadyForQuery.',
    check: (state) => state.scenario === 'simple' && state.activeIndex === state.steps.length - 1,
  },
  {
    id: 'extended',
    label: 'Run a query with parameters through the extended protocol.',
    hint: 'Pick Extended and press Play: Parse, Bind, Execute, Sync.',
    check: (state) => state.scenario === 'extended' && state.activeIndex === state.steps.length - 1,
  },
  {
    id: 'error',
    label: 'Inject an error and see the server recover to ReadyForQuery.',
    hint: 'Turn on Error, pick Simple or Extended and press Play.',
    check: (state) =>
      state.scenario !== 'startup' &&
      state.injectError &&
      state.activeIndex === state.steps.length - 1 &&
      state.steps.some((step) => step.id === 'error-response') &&
      state.steps[state.steps.length - 1]?.id === 'ready-after-error',
  },
];

function MessageRail({
  steps,
  activeIndex,
  onSelect,
}: {
  steps: ProtocolStep[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <section aria-label="PostgreSQL messages" className="rounded-lg border bg-card p-3">
      <div className="mb-2 grid grid-cols-2 gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)]">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          Client
        </div>
        <div className="hidden text-center sm:block">Wire</div>
        <div className="flex items-center justify-end gap-2">
          <Server className="h-4 w-4" />
          Server
        </div>
      </div>
      <div className="space-y-1.5">
        {steps.map((step, index) => {
          const isClient = step.from === 'client';
          const isActive = index === activeIndex;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelect(index)}
              className={cn(
                'grid w-full grid-cols-1 gap-1.5 rounded-md p-1 text-left sm:grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] sm:items-center',
                isActive && 'bg-primary/10 ring-1 ring-primary/40',
                index > activeIndex && 'opacity-55'
              )}
              aria-current={isActive ? 'step' : undefined}
            >
              <div className={cn('min-w-0', !isClient && 'sm:col-start-3')}>
                <Packet step={step} active={isActive} />
              </div>
              <span className="hidden text-center font-mono text-xs text-muted-foreground sm:block">
                {index + 1}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Packet({ step, active }: { step: ProtocolStep; active: boolean }) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2',
        SIM_TONE[MESSAGE_TONE[step.tone]].surface,
        active && 'ring-1 ring-primary/50'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            title={step.code}
            className="flex h-6 min-w-8 max-w-16 shrink-0 items-center justify-center truncate rounded bg-background px-2 font-mono text-xs"
          >
            {compactCode(step.code)}
          </span>
          <span className="truncate text-sm font-semibold">{step.label}</span>
        </div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {formatBytes(step.bytes)}
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{step.payload}</p>
    </div>
  );
}

function MessageInspector({ step }: { step: ProtocolStep }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Binary className="h-4 w-4 text-primary" />
            Message inspector
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{flowDirection(step)}</p>
        </div>
        <Badge variant="secondary" className="font-mono" title={step.code}>
          {compactCode(step.code)}
        </Badge>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{step.label}</span>
          <span className="font-mono text-xs text-muted-foreground">{formatBytes(step.bytes)}</span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{step.note}</p>
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold">Payload shape</div>
        <div className="grid gap-2">
          {step.fields.map((field) => (
            <div
              key={field}
              className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="font-mono text-xs">{field}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          Frame sketch
        </div>
        <div className="grid grid-cols-[46px_68px_1fr] overflow-hidden rounded border text-center font-mono text-xs">
          <div className="border-r bg-muted px-2 py-2">type</div>
          <div className="border-r bg-muted px-2 py-2">length</div>
          <div className="bg-muted px-2 py-2">payload</div>
          <div className="border-r border-t px-2 py-3 text-primary">{compactCode(step.code)}</div>
          <div className="border-r border-t px-2 py-3">{step.bytes}</div>
          <div className="truncate border-t px-2 py-3 text-left">{step.payload}</div>
        </div>
      </div>
    </section>
  );
}

function ControlSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <Badge variant="secondary" className="shrink-0">
          {value.toLocaleString()}
          {suffix}
        </Badge>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => onChange(next ?? value)}
      />
    </div>
  );
}

export default function PostgresWireProtocolSimulator() {
  const [scenario, setScenario] = useState<Scenario>('startup');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tlsEnabled, setTlsEnabled] = useState(true);
  const [pipelineEnabled, setPipelineEnabled] = useState(true);
  const [injectError, setInjectError] = useState(false);
  const [rowCount, setRowCount] = useState(3);
  const [latency, setLatency] = useState(42);
  const [tab, setTab] = useState('messages');
  const [dismissed, setDismissed] = useState(false);

  const steps = useMemo(
    () => getScenarioSteps(scenario, tlsEnabled, rowCount, injectError),
    [injectError, rowCount, scenario, tlsEnabled]
  );
  const activeStep = steps[Math.min(activeIndex, steps.length - 1)] ?? steps[0];
  const config = BASE_SCENARIOS[scenario];
  const ScenarioIcon = config.icon;

  const missionState = useMemo(
    () => ({ scenario, activeIndex, injectError, steps, tlsEnabled }),
    [activeIndex, injectError, scenario, steps, tlsEnabled]
  );
  const missions = useMissions(MISSIONS, missionState);

  const metrics = useMemo(() => {
    const payloadBytes = steps.reduce((sum, step) => sum + step.bytes, 0);
    const serverTurns = steps.filter((step) => step.from === 'server').length;
    const clientTurns = steps.filter((step) => step.from === 'client').length;
    const baseRoundTrips = Math.max(...steps.map((step) => step.rtt));
    const pipelineSavings = scenario === 'extended' && pipelineEnabled ? 1.1 : 0;
    const roundTrips = Math.max(1, baseRoundTrips - pipelineSavings);
    const totalMs = Math.round(roundTrips * latency + payloadBytes / 520);
    const decodeCost = Math.round(
      rowCount * (scenario === 'copy' ? 0.06 : 0.18) + steps.length * 0.9
    );

    return {
      payloadBytes,
      roundTrips,
      totalMs,
      decodeCost,
      serverTurns,
      clientTurns,
    };
  }, [latency, pipelineEnabled, rowCount, scenario, steps]);

  useEffect(() => {
    setActiveIndex(0);
    setIsPlaying(false);
    if (scenario === 'startup') {
      setInjectError(false);
    }
  }, [scenario]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(steps.length - 1, 0)));
  }, [steps.length]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((index) => {
        if (index >= steps.length - 1) {
          setIsPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, 920);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isPlaying, steps.length]);

  const startOver = () => {
    setActiveIndex(0);
    setIsPlaying(false);
    missions.reset();
    setDismissed(false);
  };

  const goPrevious = () => {
    setIsPlaying(false);
    setActiveIndex((index) => Math.max(index - 1, 0));
  };

  const goNext = () => {
    setIsPlaying(false);
    setActiveIndex((index) => Math.min(index + 1, steps.length - 1));
  };

  const stepPills: SimStep[] = steps.map((step, index) => ({
    title: `${step.code}: ${step.label}`,
    status: index < activeIndex ? 'done' : index === activeIndex ? 'started' : 'todo',
  }));
  const currentGoal = missions.current;

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="PostgreSQL wire protocol"
          icon={Database}
          lead={
            <div
              className="flex flex-wrap items-center gap-1"
              aria-label="Scenario and protocol controls"
            >
              {(Object.keys(BASE_SCENARIOS) as Scenario[]).map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant={scenario === key ? 'default' : 'outline'}
                  className="h-10 lg:h-8"
                  aria-pressed={scenario === key}
                  onClick={() => setScenario(key)}
                >
                  {BASE_SCENARIOS[key].title.split(' ')[0]}
                </Button>
              ))}
              <Button
                type="button"
                variant={tlsEnabled ? 'default' : 'outline'}
                className="h-10 gap-1 lg:h-8"
                aria-pressed={tlsEnabled}
                onClick={() => setTlsEnabled((value) => !value)}
              >
                {tlsEnabled ? <Lock className="h-4 w-4" /> : <Unplug className="h-4 w-4" />}
                TLS
              </Button>
              <Button
                type="button"
                variant={pipelineEnabled ? 'default' : 'outline'}
                className="h-10 gap-1 lg:h-8"
                aria-pressed={pipelineEnabled}
                disabled={scenario !== 'extended'}
                onClick={() => setPipelineEnabled((value) => !value)}
              >
                <Zap className="h-4 w-4" />
                Pipeline
              </Button>
              <Button
                type="button"
                variant={injectError ? 'destructive' : 'outline'}
                className="h-10 gap-1 lg:h-8"
                aria-pressed={injectError}
                disabled={scenario === 'startup'}
                onClick={() => {
                  setInjectError((value) => !value);
                  setActiveIndex(0);
                  setIsPlaying(false);
                }}
              >
                <AlertTriangle className="h-4 w-4" />
                Error
              </Button>
            </div>
          }
          steps={stepPills}
          current={activeIndex}
          onStep={(index) => {
            setIsPlaying(false);
            setActiveIndex(index);
          }}
          stepNoun="Message"
          stepsLabel="Protocol messages"
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={
            <>
              <ScenarioIcon className="mr-1 inline h-4 w-4 text-primary" />
              {config.title}: {activeStep?.label}
            </>
          }
          actions={
            <div className="hidden items-center gap-1 lg:flex">
              <Button
                type="button"
                variant="outline"
                className="h-10 lg:h-8"
                onClick={goPrevious}
                disabled={activeIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                type="button"
                className="h-10 lg:h-8"
                onClick={() => setIsPlaying((value) => !value)}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 lg:h-8"
                onClick={goNext}
                disabled={activeIndex === steps.length - 1}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          }
          goal={
            currentGoal ? (
              <>
                {currentGoal.label}{' '}
                <span className="text-muted-foreground">{currentGoal.hint}</span>
              </>
            ) : (
              'All four missions are complete. Keep exploring the protocol.'
            )
          }
        />
        <SimAnnouncer
          message={`${config.title}, message ${activeIndex + 1} of ${steps.length}: ${activeStep?.label ?? 'ready'}.`}
        />

        {missions.complete && !dismissed ? (
          <SimComplete
            title="PostgreSQL wire tour complete"
            summary="You followed secure startup, simple and extended queries, then watched an error drain back to ReadyForQuery."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Messages', value: steps.length },
              { label: 'Wire bytes', value: formatBytes(metrics.payloadBytes) },
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
                id: 'messages',
                label: 'Messages',
                content: (
                  <MessageRail
                    steps={steps}
                    activeIndex={activeIndex}
                    onSelect={(index) => {
                      setIsPlaying(false);
                      setActiveIndex(index);
                    }}
                  />
                ),
              },
              {
                id: 'details',
                label: 'Details',
                content: (
                  <div className="space-y-3">
                    {activeStep && <MessageInspector step={activeStep} />}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <ControlSlider
                        label="Rows returned"
                        value={rowCount}
                        min={1}
                        max={scenario === 'copy' ? 25000 : 250}
                        step={scenario === 'copy' ? 500 : 1}
                        onChange={setRowCount}
                      />
                      <ControlSlider
                        label="Network latency"
                        value={latency}
                        min={5}
                        max={180}
                        step={1}
                        suffix=" ms"
                        onChange={setLatency}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-3 text-sm">
                      <span>
                        Round trips{' '}
                        <strong className="font-mono">{metrics.roundTrips.toFixed(1)}</strong>
                      </span>
                      <span>
                        Latency <strong className="font-mono">{metrics.totalMs} ms</strong>
                      </span>
                      <span>
                        Client messages <strong className="font-mono">{metrics.clientTurns}</strong>
                      </span>
                      <span>
                        Server messages <strong className="font-mono">{metrics.serverTurns}</strong>
                      </span>
                    </div>
                    <SimMissionList missions={missions.missions} />
                    <details className="rounded-lg border bg-card p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        How the wire exchange works
                      </summary>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Startup messages do not have a type byte. A driver waits for ReadyForQuery
                        before reusing a connection; extended protocol separates SQL shape from
                        values with Parse and Bind.
                      </p>
                    </details>
                    <section
                      className="rounded-lg border bg-card p-3"
                      aria-label="Postgres providers"
                    >
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <Database className="h-4 w-4 text-primary" />
                        Try Postgres without running your own server
                      </div>
                      <div className="grid gap-2">
                        {providers.map((provider) => (
                          <a
                            key={provider.name}
                            href={provider.href}
                            target="_blank"
                            rel={
                              provider.sponsored
                                ? 'noopener noreferrer sponsored'
                                : 'noopener noreferrer'
                            }
                            className="rounded-md border p-3 text-sm hover:border-primary/50"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-medium">{provider.name}</span>
                              <Badge variant={provider.sponsored ? 'default' : 'secondary'}>
                                {provider.label}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {provider.description}
                            </p>
                            {provider.sponsored && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Affiliate link. We may earn a commission at no extra cost to you.
                              </p>
                            )}
                          </a>
                        ))}
                      </div>
                    </section>
                  </div>
                ),
              },
            ]}
            columns="lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]"
            tab={tab}
            onTabChange={setTab}
            tabsLabel="Protocol panels"
            minHeight="min-h-[24rem]"
          />
        )}
        <SimPhoneBar>
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1"
            onClick={goPrevious}
            disabled={activeIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <Button
            type="button"
            className="h-10 flex-1"
            onClick={() => setIsPlaying((value) => !value)}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1"
            onClick={goNext}
            disabled={activeIndex === steps.length - 1}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
