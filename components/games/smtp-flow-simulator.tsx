'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Mail,
  Pause,
  Play,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import { Button } from '@/components/ui/button';
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
  type SimStepStatus,
} from '@/components/games/sim';
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
        response: '250-STARTTLS 250-SIZE 52428800 250 8BITMIME',
        detail:
          'EHLO asks the server what it supports: TLS upgrade, message size, and other extensions. Many submission servers only offer AUTH after STARTTLS, so credentials never cross the wire in plain text.',
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
          'STARTTLS upgrades the existing TCP connection so credentials and message content are encrypted in transit. The client then sends EHLO again, and only now does the server list AUTH PLAIN LOGIN.',
        protocolNote:
          'Submission should require TLS before AUTH (RFC 3207: start over with EHLO after the upgrade).',
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
        title: 'Sign the message with DKIM',
        actor: 'smtp',
        command: 'DKIM-Signature: d=devops-daily.com; s=s1',
        response: 'Signed with the s1._domainkey.devops-daily.com key',
        detail:
          'The sending relay signs the headers and body with its DKIM key. The receiver later fetches the public key from DNS and checks SPF, DKIM and DMARC itself.',
        protocolNote:
          'SPF, DKIM and DMARC are checked by the receiving server, not by SMTP commands.',
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
          'The receiving system checks SPF, DKIM and DMARC, records them in Authentication-Results, and applies reputation, content and user-level filtering before mailbox placement.',
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
        command: 'MAIL FROM + RCPT TO + DATA (new connection)',
        response: '250 2.0.0 queued',
        detail:
          'The retry opens a new connection and repeats MAIL FROM and RCPT TO before DATA. This time the recipient accepts the message and queues it locally.',
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
    tone: 'success',
  },
  {
    code: '4xx',
    label: 'Retry later',
    description: 'Temporary failure. A relay should queue the message and retry with backoff.',
    tone: 'warning',
  },
  {
    code: '5xx',
    label: 'Permanent fail',
    description: 'The attempt should stop until the sender, recipient, or credentials are fixed.',
    tone: 'danger',
  },
] as const;

function getStepState(index: number, currentIndex: number, step: SmtpStep): StepState {
  if (index < currentIndex) return step.state;
  if (index === currentIndex) return 'active';
  return 'pending';
}

interface SmtpMissionState {
  scenarioId: ScenarioId;
  currentIndex: number;
  scenario: Scenario;
  currentStep: SmtpStep;
}

const MISSIONS: Mission<SmtpMissionState>[] = [
  {
    id: 'happy',
    label: 'Send one email all the way to 250 OK.',
    hint: 'Press Play, or Next through each step, on the successful scenario until 250 OK.',
    check: ({ scenarioId, currentIndex, scenario }) =>
      scenarioId === 'happy-path' && currentIndex === scenario.steps.length - 1,
  },
  {
    id: 'greylist',
    label: 'Get greylisted, and see the retry get through.',
    hint: 'Pick the greylisting scenario in the menu and play it to the end.',
    check: ({ scenarioId, currentIndex, scenario }) =>
      scenarioId === 'greylist' && currentIndex === scenario.steps.length - 1,
  },
  {
    id: 'auth',
    label: 'Watch a login fail and the server refuse the mail.',
    hint: 'Pick the authentication failure scenario in the menu and play it to the end.',
    check: ({ scenarioId, currentStep }) =>
      scenarioId === 'auth-failure' && currentStep.state === 'error',
  },
];

export default function SmtpFlowSimulator() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('happy-path');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tab, setTab] = useState<'conversation' | 'details'>('conversation');
  const [dismissed, setDismissed] = useState(false);

  const scenario = useMemo(
    () => scenarios.find((item) => item.id === scenarioId) ?? scenarios[0],
    [scenarioId]
  );
  const currentStep = scenario.steps[currentIndex];
  const completedSteps = Math.min(currentIndex, scenario.steps.length - 1);

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
  const missionState = useMemo<SmtpMissionState>(
    () => ({ scenarioId, currentIndex, scenario, currentStep }),
    [currentIndex, currentStep, scenario, scenarioId]
  );
  const missions = useMissions(MISSIONS, missionState);
  const endCard = missions.complete && !dismissed;
  const currentTone =
    currentStep.state === 'error'
      ? SIM_TONE.danger
      : currentStep.state === 'warning'
        ? SIM_TONE.warning
        : SIM_TONE.success;
  const CurrentIcon = currentTone.icon;
  const startOver = () => {
    reset();
    missions.reset();
    setDismissed(false);
  };
  const previousStep = () => {
    setIsPlaying(false);
    setCurrentIndex((index) => Math.max(0, index - 1));
  };
  const stepStatus = (index: number): SimStepStatus => {
    const state = getStepState(index, currentIndex, scenario.steps[index]);
    if (state === 'pending') return 'todo';
    if (state === 'active') return 'started';
    return 'done';
  };
  const controls = (height: string, phone = false) => (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(height, phone && 'w-10 px-0')}
        onClick={previousStep}
        disabled={currentIndex === 0}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        <span className={phone ? 'sr-only' : undefined}>Previous</span>
      </Button>
      <Button
        type="button"
        size="sm"
        className={cn(height, phone && 'flex-1')}
        onClick={() => setIsPlaying((value) => !value)}
      >
        {isPlaying ? (
          <>
            <Pause className="h-4 w-4" aria-hidden="true" /> Pause
          </>
        ) : (
          <>
            <Play className="h-4 w-4" aria-hidden="true" /> Play
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(height, phone && 'w-10 px-0')}
        onClick={nextStep}
        disabled={currentIndex === scenario.steps.length - 1}
      >
        <span className={phone ? 'sr-only' : undefined}>Next</span>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="SMTP Flow Simulator"
          icon={Mail}
          lead={
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm sm:flex-none">
              <span className="sr-only">SMTP scenario</span>
              <select
                aria-label="SMTP scenario"
                value={scenarioId}
                onChange={(event) => {
                  const nextScenario = event.target.value;
                  if (
                    nextScenario !== 'happy-path' &&
                    nextScenario !== 'greylist' &&
                    nextScenario !== 'auth-failure'
                  )
                    return;
                  selectScenario(nextScenario);
                }}
                className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-60 lg:h-8"
              >
                {scenarios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          }
          steps={scenario.steps.map((step, index) => ({
            title: step.title,
            status: stepStatus(index),
          }))}
          current={currentIndex}
          onStep={(index) => {
            setCurrentIndex(index);
            setIsPlaying(false);
          }}
          stepNoun="SMTP step"
          stepsLabel="Conversation steps"
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={currentStep.title}
          meta={
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold',
                currentTone.surface,
                currentTone.text
              )}
            >
              <CurrentIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {currentStep.state === 'warning'
                ? 'Temporary failure'
                : currentStep.state === 'error'
                  ? 'Permanent failure'
                  : 'Accepted'}
            </span>
          }
          actions={<div className="hidden items-center gap-2 lg:flex">{controls('h-8')}</div>}
          goal={
            missions.current ? (
              <>
                {missions.current.label}{' '}
                <span className="text-muted-foreground">{missions.current.hint}</span>
              </>
            ) : (
              'All three missions complete. Try another trace or start over.'
            )
          }
        />
        <SimAnnouncer
          message={`${scenario.title}, step ${currentIndex + 1} of ${scenario.steps.length}: ${currentStep.title}. ${currentStep.response}`}
        />

        {endCard ? (
          <SimComplete
            title="SMTP missions complete"
            summary="You sent a message through a successful relay, watched a greylisted retry succeed, and found the authentication error that stops submission."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Trace steps', value: completedSteps + 1 },
              { label: 'Trace time', value: `${activeLatency}ms` },
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
            columns="lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]"
            minHeight="min-h-[22rem]"
            tab={tab}
            onTabChange={(value) => {
              if (value === 'conversation' || value === 'details') setTab(value);
            }}
            tabsLabel="SMTP simulator panels"
            panels={[
              {
                id: 'conversation',
                label: 'Conversation',
                className: 'space-y-2',
                content: (
                  <div className="space-y-2">
                    <section
                      className="rounded-lg border bg-card p-3"
                      aria-label="Current SMTP step"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <CurrentIcon
                          className={cn('h-4 w-4', currentTone.iconClass)}
                          aria-hidden="true"
                        />
                        <h3 className="font-semibold">{currentStep.title}</h3>
                        <span className="font-mono text-xs text-muted-foreground">
                          {currentIndex + 1}/{scenario.steps.length} · {currentStep.latencyMs}ms
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{currentStep.detail}</p>
                      <p className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                        {currentStep.protocolNote}
                      </p>
                    </section>
                    <section className="rounded-lg border bg-card p-3" aria-label="SMTP transcript">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <h3 className="text-sm font-semibold">Client</h3>
                          <div className="mt-2 space-y-2 font-mono text-sm">
                            {transcript.map((step) => (
                              <p
                                key={step.id}
                                className="break-words rounded-md bg-muted/50 px-2 py-1.5"
                              >
                                C: {step.command}
                              </p>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">Server</h3>
                          <div className="mt-2 space-y-2 font-mono text-sm">
                            {transcript.map((step) => {
                              const tone =
                                step.state === 'error'
                                  ? SIM_TONE.danger
                                  : step.state === 'warning'
                                    ? SIM_TONE.warning
                                    : SIM_TONE.success;
                              return (
                                <p
                                  key={step.id}
                                  className={cn(
                                    'break-words rounded-md border px-2 py-1.5',
                                    tone.surface,
                                    tone.text
                                  )}
                                >
                                  S: {step.response}
                                </p>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                ),
              },
              {
                id: 'details',
                label: 'Details',
                className: 'space-y-2',
                content: (
                  <div className="space-y-2">
                    <SimMissionList missions={missions.missions} />
                    <section className="rounded-lg border bg-card p-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                        <h3 className="text-sm font-semibold">Mail authentication</h3>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                        {[
                          ['SPF', 'Sender IP allowed by domain policy'],
                          ['DKIM', 'Message signed with domain key'],
                          ['DMARC', 'Visible From aligns with SPF or DKIM'],
                        ].map(([name, description]) => (
                          <div key={name} className="rounded-md border bg-muted/30 p-2">
                            <p className="font-medium">{name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="rounded-lg border bg-card p-3">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-primary" aria-hidden="true" />
                        <h3 className="text-sm font-semibold">Response codes</h3>
                      </div>
                      <div className="mt-2 space-y-2">
                        {responseCodeGuide.map((item) => {
                          const tone = SIM_TONE[item.tone];
                          return (
                            <div
                              key={item.code}
                              className={cn('rounded-md border p-2', tone.surface)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={cn('font-mono text-sm font-semibold', tone.text)}>
                                  {item.code}
                                </span>
                                <span className="text-sm font-medium">{item.label}</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.description}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                    <details className="rounded-lg border bg-card p-3">
                      <summary className="cursor-pointer text-sm font-semibold">
                        How the trace works
                      </summary>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Choose a scenario, then use Previous, Play, or Next to move through one
                        message. The transcript keeps each client command beside the server reply.
                      </p>
                    </details>
                    <section className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                        <h3 className="text-sm font-semibold">Sponsored by SMTPfast</h3>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        SMTPfast handles transactional and marketing email with SMTP/API sending,
                        logs, webhooks, and embeddable signup forms.
                      </p>
                      <Button asChild size="sm" className="mt-3 h-10 w-full lg:h-8">
                        <a
                          href="https://smtpfa.st"
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                        >
                          Try SMTPfast
                        </a>
                      </Button>
                    </section>
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
