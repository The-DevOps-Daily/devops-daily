'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  Lock,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  Server,
  Shield,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import {
  SIM_CATEGORY,
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
  type SimStepStatus,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';

type TLSVersion = '1.2' | '1.3';
type HandshakePhase =
  | 'idle'
  | 'client-hello'
  | 'server-hello'
  | 'certificate'
  | 'server-key-exchange'
  | 'certificate-verify'
  | 'client-key-exchange'
  | 'change-cipher-spec'
  | 'finished'
  | 'secure';

type FailureScenario = 'none' | 'expired-cert' | 'wrong-hostname' | 'weak-cipher' | 'untrusted-ca';

interface HandshakeStep {
  phase: HandshakePhase;
  title: string;
  description: string;
  direction: 'client-to-server' | 'server-to-client' | 'both' | 'none';
  details: string[];
  tls12Only?: boolean;
  tls13Only?: boolean;
}

const TLS_12_STEPS: HandshakeStep[] = [
  {
    phase: 'client-hello',
    title: 'ClientHello',
    description: 'Client initiates the handshake',
    direction: 'client-to-server',
    details: [
      'TLS version: 1.2',
      'Random bytes (32 bytes)',
      'Session ID',
      'Cipher suites supported',
      'Compression methods',
    ],
  },
  {
    phase: 'server-hello',
    title: 'ServerHello',
    description: 'Server responds with chosen parameters',
    direction: 'server-to-client',
    details: [
      'TLS version: 1.2',
      'Random bytes (32 bytes)',
      'Session ID',
      'Selected cipher suite',
      'Selected compression',
    ],
  },
  {
    phase: 'certificate',
    title: 'Certificate',
    description: 'Server sends its certificate chain',
    direction: 'server-to-client',
    details: ['Server certificate', 'Intermediate CA certificate', 'Certificate chain validation'],
  },
  {
    phase: 'server-key-exchange',
    title: 'ServerKeyExchange',
    description: 'Server sends key exchange parameters',
    direction: 'server-to-client',
    details: ['Diffie-Hellman parameters', 'ECDHE curve parameters', 'Server signature'],
    tls12Only: true,
  },
  {
    phase: 'certificate-verify',
    title: 'ServerHelloDone',
    description: 'Server signals end of hello messages',
    direction: 'server-to-client',
    details: ['Indicates server is done with hello phase'],
    tls12Only: true,
  },
  {
    phase: 'client-key-exchange',
    title: 'ClientKeyExchange',
    description: 'Client sends its key exchange data',
    direction: 'client-to-server',
    details: [
      'Pre-master secret (encrypted)',
      'Client DH public value',
      'Both sides can now compute master secret',
    ],
  },
  {
    phase: 'change-cipher-spec',
    title: 'ChangeCipherSpec',
    description: 'Both sides switch to encrypted communication',
    direction: 'both',
    details: [
      'Client sends ChangeCipherSpec',
      'Server sends ChangeCipherSpec',
      'All following messages encrypted',
    ],
    tls12Only: true,
  },
  {
    phase: 'finished',
    title: 'Finished',
    description: 'Handshake verification',
    direction: 'both',
    details: [
      'Client Finished (encrypted)',
      'Server Finished (encrypted)',
      'Verify handshake integrity',
    ],
  },
  {
    phase: 'secure',
    title: 'Secure Connection',
    description: 'Encrypted tunnel established',
    direction: 'none',
    details: [
      'All application data encrypted',
      'Session keys derived',
      'Ready for secure communication',
    ],
  },
];

const TLS_13_STEPS: HandshakeStep[] = [
  {
    phase: 'client-hello',
    title: 'ClientHello',
    description: 'Client initiates with key share',
    direction: 'client-to-server',
    details: [
      'TLS version: 1.3',
      'Random bytes (32 bytes)',
      'Cipher suites (AEAD only)',
      'Key share extension (ECDHE)',
      'Supported versions extension',
    ],
    tls13Only: true,
  },
  {
    phase: 'server-hello',
    title: 'ServerHello',
    description: 'Server responds with key share',
    direction: 'server-to-client',
    details: [
      'TLS version: 1.3',
      'Random bytes',
      'Selected cipher suite',
      'Key share (server public key)',
      '→ Handshake keys derived here',
    ],
    tls13Only: true,
  },
  {
    phase: 'certificate',
    title: 'EncryptedExtensions + Certificate',
    description: 'Server sends encrypted certificate',
    direction: 'server-to-client',
    details: [
      '🔒 Now encrypted!',
      'Server certificate',
      'Certificate chain',
      'CertificateVerify (signature)',
    ],
    tls13Only: true,
  },
  {
    phase: 'finished',
    title: 'Finished',
    description: 'Handshake complete',
    direction: 'both',
    details: [
      'Server Finished (encrypted)',
      'Client Finished (encrypted)',
      'Application keys derived',
    ],
    tls13Only: true,
  },
  {
    phase: 'secure',
    title: 'Secure Connection (1-RTT)',
    description: 'Encrypted tunnel established faster',
    direction: 'none',
    details: [
      '✨ Only 1 round-trip needed!',
      'All application data encrypted',
      '0-RTT resumption possible',
    ],
    tls13Only: true,
  },
];

const FAILURE_SCENARIOS: Record<
  FailureScenario,
  { title: string; description: string; failsAt: HandshakePhase }
> = {
  none: { title: 'Normal', description: 'Successful handshake', failsAt: 'secure' },
  'expired-cert': {
    title: 'Expired Certificate',
    description: 'Server certificate has expired',
    failsAt: 'certificate',
  },
  'wrong-hostname': {
    title: 'Hostname Mismatch',
    description: "Certificate CN/SAN doesn't match domain",
    failsAt: 'certificate',
  },
  'weak-cipher': {
    title: 'Weak Cipher',
    description: 'No common secure cipher suites',
    failsAt: 'server-hello',
  },
  'untrusted-ca': {
    title: 'Untrusted CA',
    description: 'Certificate not signed by trusted CA',
    failsAt: 'certificate',
  },
};

const CERTIFICATE_CHAIN = [
  { name: 'Root CA', issuer: 'Self-signed', color: 'text-amber-500', icon: Shield },
  { name: 'Intermediate CA', issuer: 'Root CA', color: 'text-blue-500', icon: ShieldCheck },
  {
    name: 'Server Certificate',
    issuer: 'Intermediate CA',
    color: 'text-emerald-500',
    icon: FileCheck,
  },
];

type SslMissionState = {
  tlsVersion: TLSVersion;
  failureScenario: FailureScenario;
  hasFailed: boolean;
  isComplete: boolean;
  failsAt: HandshakePhase | null;
};

const MISSIONS: Mission<SslMissionState>[] = [
  {
    id: 'tls13',
    label: 'Complete a TLS 1.3 handshake.',
    hint: 'Press Play, or step with Next until the lock shows.',
    check: (state) => state.tlsVersion === '1.3' && state.isComplete,
  },
  {
    id: 'tls12',
    label: 'Complete a TLS 1.2 handshake.',
    hint: 'TLS 1.2 needs 9 steps. TLS 1.3 needs only 5.',
    check: (state) => state.tlsVersion === '1.2' && state.isComplete,
  },
  {
    id: 'bad-cert',
    label: 'Watch the browser reject a bad certificate.',
    hint: 'Pick Expired Certificate, Hostname Mismatch or Untrusted CA.',
    check: (state) => state.hasFailed && state.failsAt === 'certificate',
  },
  {
    id: 'weak-cipher',
    label: 'Find the failure that stops the handshake before any certificate is sent.',
    hint: 'Client and server must agree on a secure cipher suite.',
    check: (state) => state.failureScenario === 'weak-cipher' && state.hasFailed,
  },
];

type Tab = 'handshake' | 'details';

function isFailureScenario(value: string): value is FailureScenario {
  return value in FAILURE_SCENARIOS;
}

function directionText(direction: HandshakeStep['direction']): string {
  if (direction === 'client-to-server') return 'Client to server';
  if (direction === 'server-to-client') return 'Server to client';
  if (direction === 'both') return 'Both client and server';
  return 'No message in transit';
}

function withoutLeadingEmoji(text: string): string {
  return text.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '');
}

export default function SslTlsHandshakeSimulator() {
  const [tlsVersion, setTlsVersion] = useState<TLSVersion>('1.3');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [failureScenario, setFailureScenario] = useState<FailureScenario>('none');
  const [showCertChain, setShowCertChain] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [tab, setTab] = useState<Tab>('handshake');

  const steps = tlsVersion === '1.3' ? TLS_13_STEPS : TLS_12_STEPS;
  const currentStep = steps[currentStepIndex];
  const failure = FAILURE_SCENARIOS[failureScenario];
  const hasFailed = failureScenario !== 'none' && currentStep?.phase === failure.failsAt;
  const isComplete = currentStep?.phase === 'secure' && !hasFailed;

  // Auto-play
  useEffect(() => {
    if (!isPlaying || hasFailed || isComplete) return;

    const timer = setTimeout(() => {
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex((i) => i + 1);
      } else {
        setIsPlaying(false);
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex, steps.length, hasFailed, isComplete]);

  // Show cert chain when on certificate step
  useEffect(() => {
    if (currentStep?.phase === 'certificate') {
      setShowCertChain(true);
    }
  }, [currentStep?.phase]);

  const reset = useCallback(() => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
    setShowCertChain(false);
  }, []);

  const getProgressPercentage = () => {
    if (hasFailed) return (currentStepIndex / steps.length) * 100;
    return ((currentStepIndex + 1) / steps.length) * 100;
  };

  const missionState = useMemo<SslMissionState>(
    () => ({
      tlsVersion,
      failureScenario,
      hasFailed,
      isComplete,
      failsAt: failureScenario === 'none' ? null : failure.failsAt,
    }),
    [failure.failsAt, failureScenario, hasFailed, isComplete, tlsVersion]
  );
  const missions = useMissions(MISSIONS, missionState);
  const playing = isPlaying && !isComplete && !hasFailed;

  const startOver = () => {
    setTlsVersion('1.3');
    setFailureScenario('none');
    reset();
    missions.reset();
    setDismissed(false);
  };

  const previous = () => {
    setIsPlaying(false);
    setCurrentStepIndex((i) => Math.max(0, i - 1));
  };
  const next = () => setCurrentStepIndex((i) => Math.min(steps.length - 1, i + 1));
  const playOrRestart = () => {
    if (isComplete || hasFailed) {
      reset();
    } else {
      setIsPlaying((value) => !value);
    }
  };
  const status = isComplete ? 'success' : hasFailed ? 'danger' : 'info';
  const StatusIcon = isComplete ? Lock : hasFailed ? ShieldX : Shield;
  const statusLabel = isComplete ? 'Secure' : hasFailed ? 'Failed' : 'In progress';
  const stepStatus = (index: number): SimStepStatus => {
    if (isComplete && index === steps.length - 1) return 'perfect';
    if (index < currentStepIndex) return 'done';
    if (index === currentStepIndex) return 'started';
    return 'todo';
  };
  const stepItems = steps.map((step, index) => ({ title: step.title, status: stepStatus(index) }));
  const certificateFailure = hasFailed && failure.failsAt === 'certificate';
  const endCard = missions.complete && !dismissed;

  const controls = (height: string, phone = false) => (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={height}
        onClick={previous}
        disabled={currentStepIndex === 0 || playing}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Prev
      </Button>
      <Button
        type="button"
        size="sm"
        className={cn(height, phone && 'flex-1')}
        onClick={playOrRestart}
      >
        {isComplete || hasFailed ? (
          <>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Restart
          </>
        ) : playing ? (
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
        className={height}
        onClick={next}
        disabled={currentStepIndex === steps.length - 1 || playing || hasFailed}
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="SSL/TLS Handshake Simulator"
          icon={Lock}
          lead={
            <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:min-w-0 sm:flex-1">
              <div role="group" aria-label="TLS version" className="flex gap-1.5">
                <Button
                  type="button"
                  variant={tlsVersion === '1.3' ? 'default' : 'outline'}
                  size="sm"
                  className="h-10 lg:h-8"
                  aria-pressed={tlsVersion === '1.3'}
                  onClick={() => {
                    setTlsVersion('1.3');
                    reset();
                  }}
                >
                  TLS 1.3
                </Button>
                <Button
                  type="button"
                  variant={tlsVersion === '1.2' ? 'default' : 'outline'}
                  size="sm"
                  className="h-10 lg:h-8"
                  aria-pressed={tlsVersion === '1.2'}
                  onClick={() => {
                    setTlsVersion('1.2');
                    reset();
                  }}
                >
                  TLS 1.2
                </Button>
              </div>
              <label htmlFor="tls-failure-scenario" className="sr-only">
                Failure scenario
              </label>
              <select
                id="tls-failure-scenario"
                value={failureScenario}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!isFailureScenario(value)) return;
                  setFailureScenario(value);
                  reset();
                }}
                className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none lg:h-8"
              >
                <option value="none">Normal</option>
                <option value="expired-cert">Expired Certificate</option>
                <option value="wrong-hostname">Hostname Mismatch</option>
                <option value="weak-cipher">Weak Cipher</option>
                <option value="untrusted-ca">Untrusted CA</option>
              </select>
            </div>
          }
          steps={stepItems}
          current={currentStepIndex}
          onStep={(index) => {
            if (index > currentStepIndex) return;
            setIsPlaying(false);
            setCurrentStepIndex(index);
          }}
          stepNoun="Step"
          stepsLabel="Handshake steps"
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={currentStep.title}
          meta={
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold',
                SIM_TONE[status].surface,
                SIM_TONE[status].text
              )}
            >
              <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {statusLabel}
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
              'All four done. Try other versions and failures.'
            )
          }
        />
        <SimAnnouncer
          message={`Step ${currentStepIndex + 1} of ${steps.length}: ${currentStep.title}${
            isComplete
              ? '. Handshake complete, connection secure.'
              : hasFailed
                ? `. Handshake failed: ${failure.title}`
                : ''
          }`}
        />

        {endCard ? (
          <SimComplete
            title="Handshakes explored"
            summary="You completed a TLS 1.3 and a TLS 1.2 handshake, saw a bad certificate rejected, and found the cipher failure that ends a handshake before any certificate is sent."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Version now', value: `TLS ${tlsVersion}` },
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
          <>
            <SimStage
              columns="lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
              minHeight="min-h-[22rem]"
              tab={tab}
              onTabChange={(value) => {
                if (value === 'handshake' || value === 'details') setTab(value);
              }}
              tabsLabel="Simulator panels"
              panels={[
                {
                  id: 'handshake',
                  label: 'Handshake',
                  className: 'space-y-2',
                  content: (
                    <div className="space-y-2">
                      <section
                        className="rounded-lg border bg-card p-3"
                        aria-label="Client and server"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className={cn(
                                'flex h-14 w-14 items-center justify-center rounded-lg border-2 sm:h-16 sm:w-16',
                                isComplete
                                  ? SIM_TONE.success.surface
                                  : hasFailed
                                    ? SIM_TONE.danger.surface
                                    : cn(SIM_CATEGORY.sky.fill, SIM_CATEGORY.sky.border)
                              )}
                            >
                              <Monitor
                                className={cn(
                                  'h-6 w-6',
                                  isComplete
                                    ? SIM_TONE.success.iconClass
                                    : hasFailed
                                      ? SIM_TONE.danger.iconClass
                                      : 'text-foreground'
                                )}
                                aria-hidden="true"
                              />
                            </div>
                            <span className="text-xs font-medium">Client</span>
                          </div>
                          <div className="relative flex-1">
                            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                              <motion.div
                                className={cn(
                                  'h-full rounded-full',
                                  isComplete ? 'bg-correct' : hasFailed ? 'bg-wrong' : 'bg-primary'
                                )}
                                initial={{ width: 0 }}
                                animate={{ width: `${getProgressPercentage()}%` }}
                                transition={{ duration: 0.3 }}
                              />
                            </div>
                            <AnimatePresence>
                              {currentStep.direction !== 'none' && !hasFailed && !isComplete && (
                                <motion.div
                                  key={`${currentStepIndex}-${currentStep.direction}`}
                                  className="absolute -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
                                  initial={{
                                    left:
                                      currentStep.direction === 'client-to-server' ? '0%' : '100%',
                                    x: currentStep.direction === 'client-to-server' ? 0 : -32,
                                  }}
                                  animate={{
                                    left:
                                      currentStep.direction === 'client-to-server' ? '100%' : '0%',
                                    x: currentStep.direction === 'client-to-server' ? -32 : 0,
                                  }}
                                  transition={{ duration: 2, ease: 'easeInOut' }}
                                >
                                  {currentStep.direction === 'both' ? (
                                    <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                                  ) : (
                                    <ArrowRight
                                      className={cn(
                                        'h-4 w-4',
                                        currentStep.direction === 'server-to-client' && 'rotate-180'
                                      )}
                                      aria-hidden="true"
                                    />
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                            {isComplete && (
                              <motion.div
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200 }}
                              >
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-correct text-background">
                                  <Lock className="h-5 w-5" aria-hidden="true" />
                                </div>
                              </motion.div>
                            )}
                            {hasFailed && (
                              <motion.div
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200 }}
                              >
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-wrong text-background">
                                  <ShieldX className="h-5 w-5" aria-hidden="true" />
                                </div>
                              </motion.div>
                            )}
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className={cn(
                                'flex h-14 w-14 items-center justify-center rounded-lg border-2 sm:h-16 sm:w-16',
                                isComplete
                                  ? SIM_TONE.success.surface
                                  : hasFailed
                                    ? SIM_TONE.danger.surface
                                    : cn(SIM_CATEGORY.violet.fill, SIM_CATEGORY.violet.border)
                              )}
                            >
                              <Server
                                className={cn(
                                  'h-6 w-6',
                                  isComplete
                                    ? SIM_TONE.success.iconClass
                                    : hasFailed
                                      ? SIM_TONE.danger.iconClass
                                      : 'text-foreground'
                                )}
                                aria-hidden="true"
                              />
                            </div>
                            <span className="text-xs font-medium">Server</span>
                          </div>
                        </div>
                      </section>
                      <section className="rounded-lg border bg-card p-3">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            Step {currentStepIndex + 1}/{steps.length}
                          </span>
                          <h3 className="font-semibold">{currentStep.title}</h3>
                        </div>
                        {hasFailed && (
                          <SimFeedback tone="danger" label="Handshake failed" className="mt-2">
                            <p>
                              <strong>{failure.title}.</strong> {failure.description}
                            </p>
                          </SimFeedback>
                        )}
                        {isComplete && (
                          <SimFeedback tone="success" label="Secure connection" className="mt-2">
                            <p>All application data encrypted.</p>
                          </SimFeedback>
                        )}
                        <p className="mt-2 text-sm text-muted-foreground">
                          {currentStep.description}
                        </p>
                        <p className="mt-2 text-sm font-medium">
                          {directionText(currentStep.direction)}
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {currentStep.details.map((detail) => (
                            <li key={detail}>{withoutLeadingEmoji(detail)}</li>
                          ))}
                        </ul>
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
                      {showCertChain && (
                        <section
                          className="rounded-lg border bg-card p-3"
                          aria-label="Certificate chain"
                        >
                          <h3 className="text-sm font-semibold">Certificate chain</h3>
                          <div className="mt-2 space-y-1.5">
                            {CERTIFICATE_CHAIN.map((cert, index) => {
                              const Icon = cert.icon;
                              const failing =
                                certificateFailure && index === CERTIFICATE_CHAIN.length - 1;
                              return (
                                <div
                                  key={cert.name}
                                  className={cn(
                                    'flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm',
                                    failing ? SIM_TONE.danger.surface : 'bg-muted/40'
                                  )}
                                >
                                  <Icon
                                    className="h-4 w-4 shrink-0 text-foreground"
                                    aria-hidden="true"
                                  />
                                  <span className="font-medium">{cert.name}</span>
                                  <span className="text-muted-foreground">
                                    Issued by: {cert.issuer}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      )}
                      <details className="rounded-lg border bg-card p-3">
                        <summary className="cursor-pointer text-sm font-semibold">
                          TLS 1.2 vs TLS 1.3 and key terms
                        </summary>
                        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <h3 className="font-medium text-foreground">TLS 1.2</h3>
                              <ul className="mt-1 space-y-1">
                                <li>2 round-trips (2-RTT) to establish</li>
                                <li>Supports older cipher suites</li>
                                <li>RSA key exchange still allowed</li>
                                <li>Separate ChangeCipherSpec message</li>
                                <li>Widely supported (legacy systems)</li>
                              </ul>
                            </div>
                            <div>
                              <h3 className="flex items-center gap-2 font-medium text-foreground">
                                TLS 1.3{' '}
                                <Badge variant="secondary" className="text-xs">
                                  Recommended
                                </Badge>
                              </h3>
                              <ul className="mt-1 space-y-1">
                                <li>1 round-trip (1-RTT) - 50% faster!</li>
                                <li>Only AEAD ciphers (more secure)</li>
                                <li>Perfect Forward Secrecy required</li>
                                <li>Encrypted earlier in handshake</li>
                                <li>0-RTT resumption possible</li>
                              </ul>
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <h3 className="font-medium text-foreground">Cipher Suite</h3>
                              <p>
                                A combination of algorithms: key exchange (ECDHE), authentication
                                (RSA/ECDSA), encryption (AES-GCM), and hashing (SHA256).
                              </p>
                            </div>
                            <div>
                              <h3 className="font-medium text-foreground">
                                Perfect Forward Secrecy
                              </h3>
                              <p>
                                Even if the server&apos;s private key is compromised, past sessions
                                remain secure because each session uses unique ephemeral keys.
                              </p>
                            </div>
                            <div>
                              <h3 className="font-medium text-foreground">
                                Certificate Authority (CA)
                              </h3>
                              <p>
                                A trusted organization that issues digital certificates. Browsers
                                have a list of trusted root CAs built-in.
                              </p>
                            </div>
                            <div>
                              <h3 className="font-medium text-foreground">
                                AEAD (Authenticated Encryption)
                              </h3>
                              <p>
                                Combines encryption and authentication in one step (e.g., AES-GCM).
                                Required in TLS 1.3 for better security.
                              </p>
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>
                  ),
                },
              ]}
            />
          </>
        )}
        <SimPhoneBar>{controls('h-10', true)}</SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
