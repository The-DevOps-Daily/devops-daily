'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  Inbox,
  KeyRound,
  Lock,
  Mail,
  Pause,
  Play,
  RotateCcw,
  Route,
  Send,
  Server,
  ShieldCheck,
  StepForward,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type StepState = 'pending' | 'active' | 'success' | 'warning' | 'error';
type ScenarioId = 'happy-path' | 'greylist' | 'auth-failure';

interface SmtpStep {
  id: string;
  title: string;
  actor: 'app' | 'smtp' | 'dns' | 'mx' | 'mailbox';
  command: string;
  response: string;
  detail: string;
  protocolNote: string;
  state: Exclude<StepState, 'pending' | 'active'>;
  latencyMs: number;
}

interface Scenario {
  id: ScenarioId;
  title: string;
  badge: string;
  description: string;
  steps: SmtpStep[];
}

const actorMeta = {
  app: {
    label: 'App',
    icon: Send,
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  },
  smtp: {
    label: 'SMTP relay',
    icon: Server,
    className: 'border-primary/30 bg-primary/10 text-primary',
  },
  dns: {
    label: 'DNS auth',
    icon: Globe,
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
  },
  mx: {
    label: 'Recipient MX',
    icon: Route,
    className: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
  },
  mailbox: {
    label: 'Mailbox',
    icon: Inbox,
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
  },
} satisfies Record<SmtpStep['actor'], { label: string; icon: LucideIcon; className: string }>;

const scenarios: Scenario[] = [
  {
    id: 'happy-path',
    title: 'Successful transactional email',
    badge: '250 OK',
    description:
      'A password reset email is submitted over port 587, authenticated, signed, relayed, and accepted by the recipient MX.',
    steps: [
      {
        id: 'connect',
        title: 'Open submission connection',
        actor: 'app',
        command: 'TCP connect smtp.example.net:587',
        response: '220 smtpfast ESMTP ready',
        detail:
          'Apps usually submit mail to a provider over port 587. Port 25 is mostly for server-to-server relay.',
        protocolNote: 'The server greeting starts every SMTP session.',
        state: 'success',
        latencyMs: 42,
      },
      {
        id: 'ehlo',
        title: 'Discover server extensions',
        actor: 'smtp',
        command: 'EHLO app.devops-daily.com',
        response: '250-STARTTLS 250-AUTH PLAIN LOGIN 250 SIZE 52428800',
        detail:
          'EHLO asks the server what it supports: TLS upgrade, auth mechanisms, message size, and other extensions.',
        protocolNote: 'Modern SMTP uses EHLO, not HELO, when extensions are needed.',
        state: 'success',
        latencyMs: 18,
      },
      {
        id: 'tls',
        title: 'Upgrade to encrypted transport',
        actor: 'smtp',
        command: 'STARTTLS',
        response: '220 Ready to start TLS',
        detail:
          'STARTTLS upgrades the existing TCP connection so credentials and message content are encrypted in transit.',
        protocolNote: 'Submission should require TLS before AUTH.',
        state: 'success',
        latencyMs: 61,
      },
      {
        id: 'auth',
        title: 'Authenticate sender account',
        actor: 'smtp',
        command: 'AUTH PLAIN ********',
        response: '235 2.7.0 Authentication successful',
        detail:
          'The relay verifies API credentials or SMTP username/password before accepting mail for delivery.',
        protocolNote: 'Authenticated submission prevents open relay abuse.',
        state: 'success',
        latencyMs: 35,
      },
      {
        id: 'envelope',
        title: 'Send SMTP envelope',
        actor: 'app',
        command: 'MAIL FROM:<bounce@devops-daily.com> RCPT TO:<reader@example.org>',
        response: '250 sender ok / 250 recipient ok',
        detail:
          'The envelope controls bounce handling and recipient routing. It can differ from the visible From header.',
        protocolNote: 'MAIL FROM and RCPT TO are commands, not message headers.',
        state: 'success',
        latencyMs: 44,
      },
      {
        id: 'data',
        title: 'Stream message headers and body',
        actor: 'app',
        command: 'DATA',
        response: '354 End data with <CRLF>.<CRLF>',
        detail:
          'Headers such as From, To, Subject, Date, Message-ID, and MIME boundaries are sent with the body.',
        protocolNote: 'A single dot on a line ends DATA.',
        state: 'success',
        latencyMs: 73,
      },
      {
        id: 'auth-checks',
        title: 'Sign and check sender identity',
        actor: 'dns',
        command: 'SPF pass, DKIM signed, DMARC aligned',
        response: 'Authentication-Results: pass',
        detail:
          'SPF checks allowed sending IPs, DKIM proves the message was signed, and DMARC ties identity alignment together.',
        protocolNote: 'Good deliverability depends on DNS records as much as SMTP commands.',
        state: 'success',
        latencyMs: 126,
      },
      {
        id: 'mx',
        title: 'Relay to recipient mail exchanger',
        actor: 'mx',
        command: 'MX lookup example.org -> mx1.example.org',
        response: '250 2.0.0 queued as 91FD2A822',
        detail:
          'The relay looks up the recipient domain MX records and transfers the message to the destination server.',
        protocolNote: 'A 250 after DATA means the next server accepted responsibility.',
        state: 'success',
        latencyMs: 214,
      },
      {
        id: 'mailbox',
        title: 'Deliver to inbox',
        actor: 'mailbox',
        command: 'Local delivery + filtering',
        response: 'Inbox placement: primary',
        detail:
          'The receiving system applies reputation, content, authentication, and user-level filtering before mailbox placement.',
        protocolNote: 'Accepted does not always mean inboxed, but this message passes cleanly.',
        state: 'success',
        latencyMs: 330,
      },
    ],
  },
  {
    id: 'greylist',
    title: 'Temporary greylisting retry',
    badge: '451 retry',
    description:
      'The recipient MX temporarily rejects the first attempt. A real relay queues the message and retries later.',
    steps: [
      {
        id: 'connect',
        title: 'Submit to relay',
        actor: 'app',
        command: 'EHLO + STARTTLS + AUTH',
        response: '235 authenticated',
        detail: 'The sender successfully submits the message to the outbound relay.',
        protocolNote: 'Submission succeeds before remote delivery starts.',
        state: 'success',
        latencyMs: 98,
      },
      {
        id: 'queue',
        title: 'Queue message for delivery',
        actor: 'smtp',
        command: 'DATA <message>',
        response: '250 queued as smtpfast-82a9',
        detail:
          'A relay accepts the message, stores it durably, and begins outbound delivery attempts.',
        protocolNote: 'Queues are what make SMTP resilient to temporary failures.',
        state: 'success',
        latencyMs: 64,
      },
      {
        id: 'mx-lookup',
        title: 'Resolve recipient MX',
        actor: 'dns',
        command: 'dig MX example.org',
        response: '10 mx1.example.org',
        detail: 'MX priority determines which recipient server to try first.',
        protocolNote: 'If one MX fails, relays can try another host.',
        state: 'success',
        latencyMs: 122,
      },
      {
        id: 'tempfail',
        title: 'Remote server asks for retry',
        actor: 'mx',
        command: 'RCPT TO:<reader@example.org>',
        response: '451 4.7.1 Try again later',
        detail:
          'A 4xx response is temporary. The sender should not bounce immediately; it should retry with backoff.',
        protocolNote: '4xx means retry. 5xx means permanent failure.',
        state: 'warning',
        latencyMs: 240,
      },
      {
        id: 'backoff',
        title: 'Retry with backoff',
        actor: 'smtp',
        command: 'retry in 10 minutes, then 30, then 2 hours',
        response: 'delivery pending',
        detail:
          'Reliable providers expose queue state, attempts, and final failure reasons so operators can debug delivery.',
        protocolNote: 'SMTP is asynchronous by design.',
        state: 'warning',
        latencyMs: 600,
      },
      {
        id: 'accepted',
        title: 'Second attempt accepted',
        actor: 'mx',
        command: 'DATA <message>',
        response: '250 2.0.0 queued',
        detail: 'The recipient accepts the retried delivery attempt and queues the message locally.',
        protocolNote: 'Retries turn short outages into delayed delivery instead of lost mail.',
        state: 'success',
        latencyMs: 270,
      },
    ],
  },
  {
    id: 'auth-failure',
    title: 'Authentication failure',
    badge: '535 fail',
    description:
      'The app connects but uses bad SMTP credentials. The server refuses to accept a message.',
    steps: [
      {
        id: 'connect',
        title: 'Open secure submission',
        actor: 'app',
        command: 'EHLO + STARTTLS',
        response: '220 TLS active',
        detail: 'The connection and encryption are fine. The failure happens at authentication.',
        protocolNote: 'Network success does not mean sender authorization succeeded.',
        state: 'success',
        latencyMs: 70,
      },
      {
        id: 'auth',
        title: 'Bad credential rejected',
        actor: 'smtp',
        command: 'AUTH PLAIN ********',
        response: '535 5.7.8 Authentication credentials invalid',
        detail:
          'The relay rejects the login. No envelope or DATA commands should be accepted after this.',
        protocolNote: '535 is a permanent authentication failure for this attempt.',
        state: 'error',
        latencyMs: 38,
      },
      {
        id: 'blocked',
        title: 'Message is not accepted',
        actor: 'smtp',
        command: 'MAIL FROM:<alerts@devops-daily.com>',
        response: '530 5.7.0 Authentication required',
        detail:
          'A secure SMTP relay will not become an open relay. The app must rotate or fix credentials before retrying.',
        protocolNote: 'Fix credentials first; blind retries only create noise.',
        state: 'error',
        latencyMs: 12,
      },
    ],
  },
];

const responseCodeGuide = [
  {
    code: '2xx',
    label: 'Accepted',
    description: 'The server accepted the command or took responsibility for the message.',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
  },
  {
    code: '4xx',
    label: 'Retry later',
    description: 'Temporary failure. A relay should queue the message and retry with backoff.',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
  },
  {
    code: '5xx',
    label: 'Permanent fail',
    description: 'The attempt should stop until the sender, recipient, or credentials are fixed.',
    className: 'border-red-500/30 bg-red-500/10 text-red-500',
  },
];

function stateClasses(state: StepState) {
  if (state === 'success') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500';
  if (state === 'warning') return 'border-amber-500/40 bg-amber-500/10 text-amber-500';
  if (state === 'error') return 'border-red-500/40 bg-red-500/10 text-red-500';
  if (state === 'active') return 'border-primary/60 bg-primary/10 text-primary';
  return 'border-border bg-muted/30 text-muted-foreground';
}

function StepStatusIcon({ state }: { state: StepState }) {
  if (state === 'success') return <CheckCircle2 className="h-4 w-4" />;
  if (state === 'warning') return <AlertTriangle className="h-4 w-4" />;
  if (state === 'error') return <XCircle className="h-4 w-4" />;
  if (state === 'active') return <Zap className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
}

function getStepState(index: number, currentIndex: number, step: SmtpStep): StepState {
  if (index < currentIndex) return step.state;
  if (index === currentIndex) return 'active';
  return 'pending';
}

export default function SmtpFlowSimulator() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('happy-path');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const scenario = useMemo(
    () => scenarios.find((item) => item.id === scenarioId) ?? scenarios[0],
    [scenarioId]
  );
  const currentStep = scenario.steps[currentIndex];
  const completedSteps = Math.min(currentIndex, scenario.steps.length - 1);
  const progress = ((currentIndex + 1) / scenario.steps.length) * 100;

  const selectScenario = useCallback((nextScenario: ScenarioId) => {
    setScenarioId(nextScenario);
    setCurrentIndex(0);
    setIsPlaying(false);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentIndex((index) => {
      if (index >= scenario.steps.length - 1) {
        setIsPlaying(false);
        return index;
      }
      return index + 1;
    });
  }, [scenario.steps.length]);

  const reset = useCallback(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setTimeout(nextStep, 1050);
    return () => window.clearTimeout(timer);
  }, [isPlaying, nextStep, currentIndex]);

  const transcript = scenario.steps.slice(0, currentIndex + 1);
  const activeLatency = scenario.steps
    .slice(0, currentIndex + 1)
    .reduce((sum, step) => sum + step.latencyMs, 0);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-5 text-center">
        <div className="mb-3 flex items-center justify-center gap-2.5">
          <Mail className="h-8 w-8 text-primary" strokeWidth={1.5} />
          <h2 className="text-2xl font-bold md:text-3xl">SMTP Flow Simulator</h2>
        </div>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground">
          Watch a message move from application code to an SMTP relay, through TLS and AUTH,
          across DNS and recipient MX checks, and finally into a mailbox.
        </p>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {scenarios.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectScenario(item.id)}
            className={cn(
              'rounded-md border p-3 text-left transition-colors',
              item.id === scenarioId
                ? 'border-primary/60 bg-primary/10'
                : 'border-border hover:border-primary/40 hover:bg-muted/30'
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-medium">{item.title}</span>
              <Badge variant={item.id === scenarioId ? 'default' : 'secondary'}>{item.badge}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-mono text-muted-foreground">// active trace</p>
                  <h3 className="text-lg font-semibold">{scenario.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsPlaying((value) => !value)}
                  >
                    {isPlaying ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={nextStep}>
                    <StepForward className="mr-1 h-4 w-4" />
                    Step
                  </Button>
                  <Button size="sm" variant="ghost" onClick={reset}>
                    <RotateCcw className="mr-1 h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
                {(['app', 'smtp', 'dns', 'mx', 'mailbox'] as const).map((actor) => {
                  const meta = actorMeta[actor];
                  const Icon = meta.icon;
                  const isActive = currentStep.actor === actor;

                  return (
                    <div
                      key={actor}
                      className={cn(
                        'rounded-md border p-3 text-center transition-colors',
                        isActive ? meta.className : 'border-border bg-muted/20 text-muted-foreground'
                      )}
                    >
                      <Icon className="mx-auto mb-2 h-5 w-5" strokeWidth={1.5} />
                      <p className="text-sm font-medium">{meta.label}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Route className="h-5 w-5" />
                Protocol Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {scenario.steps.map((step, index) => {
                const visualState = getStepState(index, currentIndex, step);
                const meta = actorMeta[step.actor];

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(index);
                      setIsPlaying(false);
                    }}
                    className={cn(
                      'w-full rounded-md border p-3 text-left transition-colors',
                      stateClasses(visualState)
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <StepStatusIcon state={visualState} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{step.title}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {meta.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{step.latencyMs}ms</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border bg-[#171717]">
            <CardHeader className="border-b border-border/60 bg-[#262626] p-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                </div>
                <span className="ml-2 text-sm text-muted-foreground">smtp trace</span>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-3 font-mono text-sm">
              <div className="space-y-3">
                {transcript.map((step) => (
                  <div key={step.id}>
                    <p className="break-words text-green-400">C: {step.command}</p>
                    <p
                      className={cn(
                        'break-words',
                        step.state === 'error'
                          ? 'text-red-400'
                          : step.state === 'warning'
                            ? 'text-amber-400'
                            : 'text-slate-300'
                      )}
                    >
                      S: {step.response}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5" />
                Current Step
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <div className={cn('rounded-md border p-3', stateClasses('active'))}>
                <p className="text-xs font-mono opacity-80">{actorMeta[currentStep.actor].label}</p>
                <h3 className="mt-1 font-semibold">{currentStep.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{currentStep.detail}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="mb-1 text-xs font-mono text-muted-foreground">// protocol note</p>
                <p className="text-sm">{currentStep.protocolNote}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Steps seen" value={`${completedSteps + 1}/${scenario.steps.length}`} />
                <Metric label="Trace time" value={`${activeLatency}ms`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-5 w-5" />
                Mail Auth
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {[
                ['SPF', 'Sender IP allowed by domain policy'],
                ['DKIM', 'Message signed with domain key'],
                ['DMARC', 'Visible From aligns with SPF or DKIM'],
              ].map(([name, description]) => (
                <div key={name} className="rounded-md border p-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="font-medium">{name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-5 w-5" />
                Response Codes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {responseCodeGuide.map((item) => (
                <div key={item.code} className={cn('rounded-md border p-2.5', item.className)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold">{item.code}</span>
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-5 w-5 text-primary" />
                Sponsored by SMTPfast
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <p className="text-sm text-muted-foreground">
                SMTPfast handles transactional and marketing email with SMTP/API sending, logs,
                webhooks, and embeddable signup forms.
              </p>
              <Button asChild size="sm" className="w-full">
                <a href="https://smtpfa.st" target="_blank" rel="noopener noreferrer sponsored">
                  Try SMTPfast
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
