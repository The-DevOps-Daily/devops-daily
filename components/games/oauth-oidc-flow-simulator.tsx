'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Circle,
  CircleCheck,
  Code2,
  Globe,
  KeyRound,
  LockKeyhole,
  Play,
  RefreshCw,
  Server,
  Shield,
  TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimHintButton,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  SimTerminalWindow,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';

type ActorId = 'browser' | 'app' | 'authorization-server' | 'token-endpoint' | 'api';
type TokenKind = 'id' | 'access' | 'refresh';
type LogType = 'request' | 'response' | 'success' | 'warning' | 'error';

interface FlowAction {
  id: string;
  label: string;
  description: string;
  from: ActorId;
  to: ActorId;
  log: string;
  insight: string;
  creates?: TokenKind[];
  requires?: TokenKind[];
  warning?: string;
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  actions: FlowAction[];
}

interface FlowLog {
  type: LogType;
  content: string;
}

interface TokenState {
  id: boolean;
  access: boolean;
  refresh: boolean;
}

interface FailureState {
  badRedirect: boolean;
  broadScope: boolean;
  expiredAccessToken: boolean;
}

const ACTORS: Record<ActorId, { label: string; caption: string; icon: ReactNode }> = {
  browser: {
    label: 'Browser',
    caption: 'User agent',
    icon: <Globe className="h-5 w-5" />,
  },
  app: {
    label: 'Client App',
    caption: 'Relying party',
    icon: <Code2 className="h-5 w-5" />,
  },
  'authorization-server': {
    label: 'Authorization Server',
    caption: 'Login + consent',
    icon: <Shield className="h-5 w-5" />,
  },
  'token-endpoint': {
    label: 'Token Endpoint',
    caption: 'Back channel',
    icon: <KeyRound className="h-5 w-5" />,
  },
  api: {
    label: 'API / UserInfo',
    caption: 'Resource server',
    icon: <Server className="h-5 w-5" />,
  },
};

const LESSONS: Lesson[] = [
  {
    id: 'auth-code-pkce',
    title: 'Auth Code + PKCE',
    description: 'Follow the safest browser app flow',
    icon: <LockKeyhole className="h-5 w-5" />,
    actions: [
      {
        id: 'build-request',
        label: 'Build authorize URL',
        description: 'The app creates state, nonce, code_verifier, and code_challenge.',
        from: 'app',
        to: 'browser',
        log: `GET /authorize?
  response_type=code
  client_id=devops_daily_lab
  redirect_uri=https://app.example/callback
  scope=openid profile email
  state=s4f3_csrf
  nonce=n0nc3_login
  code_challenge=SHA256(code_verifier)
  code_challenge_method=S256`,
        insight:
          'PKCE binds the later token exchange to the browser session that started the login.',
      },
      {
        id: 'redirect-login',
        label: 'Redirect to login',
        description: 'The browser leaves the app and visits the authorization server.',
        from: 'browser',
        to: 'authorization-server',
        log: '302 Location: https://auth.example/authorize?...',
        insight:
          'This is the front channel. The browser can see the redirect, so secrets do not belong here.',
      },
      {
        id: 'login-consent',
        label: 'Login and consent',
        description: 'The user authenticates and approves the requested scopes.',
        from: 'authorization-server',
        to: 'browser',
        log: 'User authenticates with MFA and consents to openid profile email.',
        insight: 'OAuth delegates access. OIDC adds identity by asking for the openid scope.',
      },
      {
        id: 'callback-code',
        label: 'Return auth code',
        description: 'The browser returns with a short-lived authorization code.',
        from: 'authorization-server',
        to: 'app',
        log: `GET /callback?
  code=SplxlOBeZQQYbYS6WxSbIA
  state=s4f3_csrf`,
        insight: 'The app must verify state before exchanging the code. This blocks login CSRF.',
      },
      {
        id: 'exchange-code',
        label: 'Exchange code',
        description: 'The app calls the token endpoint with the code and verifier.',
        from: 'app',
        to: 'token-endpoint',
        log: `POST /oauth/token
  grant_type=authorization_code
  code=SplxlOBeZQQYbYS6WxSbIA
  redirect_uri=https://app.example/callback
  code_verifier=plain_random_secret`,
        insight:
          'The code exchange is back channel. PKCE proves the app has the original verifier.',
        creates: ['id', 'access', 'refresh'],
      },
    ],
  },
  {
    id: 'tokens',
    title: 'Tokens & Claims',
    description: 'Separate identity from API authorization',
    icon: <KeyRound className="h-5 w-5" />,
    actions: [
      {
        id: 'validate-id-token',
        label: 'Validate ID token',
        description: 'The app verifies issuer, audience, expiry, nonce, and signature.',
        from: 'token-endpoint',
        to: 'app',
        log: `ID token claims
  iss: https://auth.example
  aud: devops_daily_lab
  sub: user_123
  nonce: n0nc3_login
  exp: now + 5m`,
        insight:
          'ID tokens are for the client app. They prove who authenticated, not what an API should accept.',
        requires: ['id'],
      },
      {
        id: 'store-session',
        label: 'Create app session',
        description: 'The app creates its own secure session cookie after validating identity.',
        from: 'app',
        to: 'browser',
        log: 'Set-Cookie: app_session=opaque; HttpOnly; Secure; SameSite=Lax',
        insight:
          'A web app often stores tokens server-side and gives the browser an opaque session cookie.',
        requires: ['id'],
      },
      {
        id: 'call-userinfo',
        label: 'Call UserInfo',
        description: 'The app uses the access token to fetch profile claims.',
        from: 'app',
        to: 'api',
        log: `GET /userinfo
Authorization: Bearer eyJ_access_token`,
        insight:
          'Access tokens are for resource servers. The API validates audience, issuer, expiry, and scope.',
        requires: ['access'],
      },
    ],
  },
  {
    id: 'scopes-refresh',
    title: 'Scopes & Refresh',
    description: 'Handle least privilege and token renewal',
    icon: <RefreshCw className="h-5 w-5" />,
    actions: [
      {
        id: 'request-api-scope',
        label: 'Request API scope',
        description: 'The app asks for a focused scope instead of broad account access.',
        from: 'app',
        to: 'authorization-server',
        log: 'scope=openid profile email api:read:deployments',
        insight:
          'Scopes are permissions. Smaller scopes reduce blast radius and make consent clearer.',
      },
      {
        id: 'expire-token',
        label: 'Access token expires',
        description: 'The API rejects an expired access token.',
        from: 'api',
        to: 'app',
        log: `HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer error="invalid_token", error_description="expired"`,
        insight:
          'Short-lived access tokens limit exposure. The app should refresh, not ask the user to log in again.',
        requires: ['access'],
        warning: 'The access token is now marked expired in the simulator.',
      },
      {
        id: 'refresh-token',
        label: 'Refresh tokens',
        description: 'The app uses the refresh token to get a new access token.',
        from: 'app',
        to: 'token-endpoint',
        log: `POST /oauth/token
  grant_type=refresh_token
  refresh_token=rt_7b9...

Response: new access_token, rotated refresh_token`,
        insight:
          'Refresh token rotation lets the server detect replay if an old refresh token is reused.',
        requires: ['refresh'],
        creates: ['access', 'refresh'],
      },
    ],
  },
  {
    id: 'failure-modes',
    title: 'Failure Modes',
    description: 'Debug the mistakes people actually ship',
    icon: <AlertTriangle className="h-5 w-5" />,
    actions: [
      {
        id: 'bad-redirect',
        label: 'Break redirect URI',
        description: 'Change the callback URL and see why the server rejects it.',
        from: 'browser',
        to: 'authorization-server',
        log: `GET /authorize?...redirect_uri=https://evil.example/callback

error=invalid_request
error_description=redirect_uri_mismatch`,
        insight:
          'Redirect URIs must be exact allow-list matches. Never accept arbitrary callback URLs.',
        warning: 'Redirect mismatch activated.',
      },
      {
        id: 'fix-redirect',
        label: 'Fix redirect URI',
        description: 'Restore the registered callback URL.',
        from: 'app',
        to: 'authorization-server',
        log: 'redirect_uri=https://app.example/callback matches registered client metadata.',
        insight: 'Exact redirect matching is one of the most important OAuth security controls.',
      },
      {
        id: 'too-broad-scope',
        label: 'Request broad scope',
        description: 'Ask for admin scope and watch consent risk rise.',
        from: 'app',
        to: 'authorization-server',
        log: 'scope=openid profile email admin:*',
        insight:
          'Broad scopes are product and security debt. Prefer granular permissions like api:read:deployments.',
        warning: 'Broad scope warning activated.',
      },
      {
        id: 'fix-scope',
        label: 'Apply least privilege',
        description: 'Replace admin scope with a minimal API scope.',
        from: 'app',
        to: 'authorization-server',
        log: 'scope=openid profile email api:read:deployments',
        insight:
          'Least privilege makes token leaks less damaging and consent screens more understandable.',
      },
    ],
  },
];

const TOKEN_COPY: Record<TokenKind, { title: string; description: string; claims: string[] }> = {
  id: {
    title: 'ID Token',
    description: 'For the client app. Proves authentication.',
    claims: [
      'iss=https://auth.example',
      'aud=devops_daily_lab',
      'sub=user_123',
      'nonce=n0nc3_login',
    ],
  },
  access: {
    title: 'Access Token',
    description: 'For APIs. Carries authorization context.',
    claims: ['aud=https://api.example', 'scope=api:read:deployments', 'exp=5m', 'sub=user_123'],
  },
  refresh: {
    title: 'Refresh Token',
    description: 'For the token endpoint. Rotated on use.',
    claims: ['opaque=rt_7b9...', 'rotation=enabled', 'storage=server-side', 'reuse=detection'],
  },
};

function createInitialLogs(): FlowLog[] {
  return [
    {
      type: 'success',
      content:
        'Lab initialized. The client is registered with redirect_uri=https://app.example/callback and PKCE required.',
    },
  ];
}

function actorLabel(id: ActorId) {
  return ACTORS[id].label;
}

export default function OAuthOidcFlowSimulator() {
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());
  const [tokens, setTokens] = useState<TokenState>({ id: false, access: false, refresh: false });
  const [failures, setFailures] = useState<FailureState>({
    badRedirect: false,
    broadScope: false,
    expiredAccessToken: false,
  });
  const [logs, setLogs] = useState<FlowLog[]>(createInitialLogs);
  const [activeMessage, setActiveMessage] = useState<FlowAction | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hintsUsed, setHintsUsed] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'flow' | 'state'>('flow');

  const currentLesson = LESSONS[currentLessonIndex];
  const currentAction = currentLesson.actions[currentActionIndex];
  const totalActions = LESSONS.reduce((sum, lesson) => sum + lesson.actions.length, 0);
  const completedCount = completedActions.size;

  const riskScore = useMemo(() => {
    let score = 0;
    if (failures.badRedirect) score += 40;
    if (failures.broadScope) score += 35;
    if (failures.expiredAccessToken) score += 15;
    if (!tokens.refresh) score += 5;
    return Math.min(score, 100);
  }, [failures, tokens.refresh]);

  const appendLog = (entry: FlowLog) => {
    setLogs((prev) => [entry, ...prev].slice(0, 8));
  };

  const canRunAction = (action: FlowAction) => {
    return !action.requires?.some((token) => !tokens[token]);
  };

  // A delayed advance still pending, with the step it applies. Cancelled on
  // reset and unmount; applied first on a lesson change so the step is not
  // left completed but unadvanced.
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAdvance = useRef<(() => void) | null>(null);
  const cancelPendingAdvance = () => {
    const pending = pendingAdvance.current;
    if (advanceTimer.current !== null) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    pendingAdvance.current = null;
    return pending;
  };
  useEffect(
    () => () => {
      cancelPendingAdvance();
    },
    []
  );

  const runAction = (action = currentAction) => {
    if (!canRunAction(action)) {
      appendLog({
        type: 'error',
        content: `Cannot run "${action.label}" yet. Missing ${action.requires?.map((token) => TOKEN_COPY[token].title).join(', ')}.`,
      });
      return;
    }

    setActiveMessage(action);
    if (action.creates) {
      setTokens(
        (prev) =>
          action.creates?.reduce((next, token) => ({ ...next, [token]: true }), prev) ?? prev
      );
    }

    if (action.id === 'expire-token') {
      setFailures((prev) => ({ ...prev, expiredAccessToken: true }));
    } else if (action.id === 'refresh-token') {
      setFailures((prev) => ({ ...prev, expiredAccessToken: false }));
    } else if (action.id === 'bad-redirect') {
      setFailures((prev) => ({ ...prev, badRedirect: true }));
    } else if (action.id === 'fix-redirect') {
      setFailures((prev) => ({ ...prev, badRedirect: false }));
    } else if (action.id === 'too-broad-scope') {
      setFailures((prev) => ({ ...prev, broadScope: true }));
    } else if (action.id === 'fix-scope') {
      setFailures((prev) => ({ ...prev, broadScope: false }));
    }

    appendLog({
      type: action.warning ? 'warning' : 'request',
      content: `${actorLabel(action.from)} -> ${actorLabel(action.to)}\n${action.log}`,
    });
    appendLog({ type: action.warning ? 'warning' : 'success', content: action.insight });

    const key = `${currentLessonIndex}-${currentActionIndex}`;
    if (action === currentAction && !completedActions.has(key) && advanceTimer.current === null) {
      setCompletedActions((prev) => new Set(prev).add(key));
      const advance = () => {
        if (currentActionIndex < currentLesson.actions.length - 1) {
          setCurrentActionIndex((index) => index + 1);
        } else if (currentLessonIndex < LESSONS.length - 1) {
          setCurrentLessonIndex((index) => index + 1);
          setCurrentActionIndex(0);
        }
        setShowHint(false);
      };
      pendingAdvance.current = advance;
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null;
        pendingAdvance.current = null;
        advance();
      }, 550);
    }
  };

  const resetLab = () => {
    cancelPendingAdvance();
    setCurrentLessonIndex(0);
    setCurrentActionIndex(0);
    setCompletedActions(new Set());
    setTokens({ id: false, access: false, refresh: false });
    setFailures({ badRedirect: false, broadScope: false, expiredAccessToken: false });
    setLogs(createInitialLogs());
    setActiveMessage(null);
    setShowHint(false);
  };

  const startOver = () => {
    resetLab();
    setDismissed(false);
    setHintsUsed(new Set());
  };

  const jumpToLesson = (lessonIndex: number) => {
    cancelPendingAdvance();
    // Resume at the first action not yet completed.
    const lesson = LESSONS[lessonIndex];
    const firstOpen = lesson.actions.findIndex(
      (_, actionIndex) => !completedActions.has(`${lessonIndex}-${actionIndex}`)
    );
    setCurrentLessonIndex(lessonIndex);
    setCurrentActionIndex(Math.max(0, firstOpen));
    setShowHint(false);
  };

  const toggleHint = () => {
    if (!showHint) {
      setHintsUsed((prev) => new Set(prev).add(`${currentLessonIndex}-${currentActionIndex}`));
    }
    setShowHint((value) => !value);
  };

  const mainAction = (size: 'bar' | 'phone') => (
    <Button
      type="button"
      size="sm"
      className={size === 'bar' ? 'h-8' : 'h-10 flex-1'}
      data-sim-action=""
      onClick={() => runAction()}
      disabled={completedCount === totalActions}
    >
      <Play className="h-4 w-4" aria-hidden="true" />
      {currentAction.label}
    </Button>
  );

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="OAuth/OIDC Flow Simulator"
          icon={Shield}
          steps={LESSONS.map((lesson, lessonIndex) => {
            const done = lesson.actions.filter((_, actionIndex) =>
              completedActions.has(`${lessonIndex}-${actionIndex}`)
            ).length;
            return {
              title: lesson.title,
              status: done === lesson.actions.length ? 'done' : done > 0 ? 'started' : 'todo',
              statusLabel: `${done} of ${lesson.actions.length} steps done`,
            };
          })}
          current={currentLessonIndex}
          onStep={jumpToLesson}
          stepNoun="Lesson"
          stepsLabel="Lessons"
          tools={
            <>
              <SimHintButton pressed={showHint} onClick={toggleHint}>
                Explain
              </SimHintButton>
              <SimResetButton onReset={startOver} />
            </>
          }
          progress={{ current: completedCount, total: totalActions }}
          heading={currentLesson.title}
          meta={
            <Badge variant="secondary" className="tabular-nums">
              Step {currentActionIndex + 1} of {currentLesson.actions.length}
            </Badge>
          }
          actions={<div className="hidden lg:flex">{mainAction('bar')}</div>}
          goal={currentAction.description}
        >
          {showHint && (
            <SimFeedback
              tone="hint"
              label="Why this step"
              role="status"
              onDismiss={() => setShowHint(false)}
            >
              {currentAction.insight}
            </SimFeedback>
          )}
        </SimBar>

        <SimAnnouncer message={logs[0]?.content.split('\n')[0] ?? ''} />

        {completedCount === totalActions && !dismissed ? (
          <SimComplete
            title="Lab complete"
            summary="You traced login, token validation, API access, refresh, and common OAuth/OIDC failure modes."
            stats={[
              { label: 'Steps', value: `${completedCount}/${totalActions}` },
              { label: 'Explanations opened', value: hintsUsed.size },
              { label: 'Risk at the end', value: `${riskScore}%` },
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
            minHeight="min-h-[24rem]"
            tab={tab}
            onTabChange={(nextTab) => {
              if (nextTab === 'flow' || nextTab === 'state') setTab(nextTab);
            }}
            tabsLabel="Lab panels"
            panels={[
              {
                id: 'flow',
                label: 'Flow',
                content: (
                  <div className="space-y-2">
                    <FlowCanvas activeMessage={activeMessage} failures={failures} tokens={tokens} />
                    <MessageInspector action={activeMessage} />
                  </div>
                ),
              },
              {
                id: 'state',
                label: 'Tokens and log',
                content: (
                  <div className="space-y-2">
                    <TokenPanel tokens={tokens} failures={failures} />
                    <RiskPanel failures={failures} riskScore={riskScore} />
                    <EventLog logs={logs} />
                  </div>
                ),
              },
            ]}
          />
        )}

        <SimPhoneBar>{mainAction('phone')}</SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}

function FlowCanvas({
  activeMessage,
  failures,
  tokens,
}: {
  activeMessage: FlowAction | null;
  failures: FailureState;
  tokens: TokenState;
}) {
  const actorEntries = Object.entries(ACTORS) as Array<[ActorId, (typeof ACTORS)[ActorId]]>;

  return (
    <section className="rounded-lg border bg-card p-3" aria-labelledby="oauth-flow-title">
      <h3 id="oauth-flow-title" className="text-sm font-semibold">
        Protocol flow
      </h3>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {actorEntries.map(([id, actor]) => {
          const active = activeMessage?.from === id || activeMessage?.to === id;
          return (
            <div
              key={id}
              className={cn(
                'rounded-md border p-2.5 transition-colors',
                active ? 'border-primary/60 bg-primary/10' : 'bg-muted/30'
              )}
            >
              <div
                className={cn('mb-2 inline-flex rounded-md border p-1.5', active && 'text-primary')}
              >
                {actor.icon}
              </div>
              <p className="text-sm font-semibold">{actor.label}</p>
              <p className="text-xs text-muted-foreground">{actor.caption}</p>
              {id === 'authorization-server' && failures.badRedirect && (
                <span
                  className={cn(
                    'mt-2 inline-flex rounded border px-1.5 py-0.5 text-xs font-semibold',
                    SIM_TONE.danger.surface,
                    SIM_TONE.danger.text
                  )}
                >
                  redirect mismatch
                </span>
              )}
              {id === 'authorization-server' && failures.broadScope && (
                <span
                  className={cn(
                    'mt-2 inline-flex rounded border px-1.5 py-0.5 text-xs font-semibold',
                    SIM_TONE.warning.surface,
                    SIM_TONE.warning.text
                  )}
                >
                  broad scope
                </span>
              )}
              {id === 'api' && failures.expiredAccessToken && (
                <span
                  className={cn(
                    'mt-2 inline-flex rounded border px-1.5 py-0.5 text-xs font-semibold',
                    SIM_TONE.danger.surface,
                    SIM_TONE.danger.text
                  )}
                >
                  token expired
                </span>
              )}
              {id === 'token-endpoint' && tokens.refresh && (
                <span className="mt-2 inline-flex rounded border bg-muted/50 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  rotation ready
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 rounded-md bg-muted/50 p-2.5">
        {activeMessage ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">
                {actorLabel(activeMessage.from)} {'->'} {actorLabel(activeMessage.to)}
              </p>
              <p className="text-xs text-muted-foreground">{activeMessage.description}</p>
            </div>
            <span
              className={cn(
                'inline-flex w-fit items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold',
                activeMessage.warning
                  ? `${SIM_TONE.warning.surface} ${SIM_TONE.warning.text}`
                  : `${SIM_TONE.info.surface} ${SIM_TONE.info.text}`
              )}
            >
              {activeMessage.warning ? (
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {activeMessage.warning ? 'risk surfaced' : 'message in flight'}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Run the next action to animate the current OAuth/OIDC message.
          </p>
        )}
      </div>
    </section>
  );
}

function MessageInspector({ action }: { action: FlowAction | null }) {
  return (
    <SimTerminalWindow
      label="oauth-message.log"
      bodyClassName="max-h-[min(22rem,calc(100dvh-24rem))] min-h-40 overflow-auto p-3"
    >
      <pre className="whitespace-pre-wrap text-terminal-foreground">
        {action
          ? `${actorLabel(action.from)} -> ${actorLabel(action.to)}\n\n${action.log}\n\n# ${action.insight}`
          : 'No message selected yet.\nRun the current flow action to inspect request and response details.'}
      </pre>
    </SimTerminalWindow>
  );
}

function TokenPanel({ tokens, failures }: { tokens: TokenState; failures: FailureState }) {
  return (
    <section
      className="space-y-2 rounded-lg border bg-card p-3"
      aria-labelledby="oauth-tokens-title"
    >
      <h3 id="oauth-tokens-title" className="text-sm font-semibold">
        Token set
      </h3>
      <div className="space-y-2">
        {(Object.entries(TOKEN_COPY) as Array<[TokenKind, (typeof TOKEN_COPY)[TokenKind]]>).map(
          ([kind, token]) => {
            const active = tokens[kind];
            const expired = kind === 'access' && failures.expiredAccessToken;
            const StateIcon = expired ? TriangleAlert : active ? CircleCheck : Circle;
            const stateLabel = expired ? 'expired' : active ? 'issued' : 'missing';
            return (
              <div
                key={kind}
                className={cn(
                  'rounded-md border p-2.5',
                  expired
                    ? SIM_TONE.warning.surface
                    : active
                      ? SIM_TONE.success.surface
                      : 'bg-muted/30'
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{token.title}</p>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold',
                      expired
                        ? `${SIM_TONE.warning.border} ${SIM_TONE.warning.text}`
                        : active
                          ? `${SIM_TONE.success.border} ${SIM_TONE.success.text}`
                          : 'border text-muted-foreground'
                    )}
                  >
                    <StateIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {stateLabel}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{token.description}</p>
                {active && (
                  <div className="mt-2 space-y-1">
                    {token.claims.map((claim) => (
                      <p key={claim} className="truncate font-mono text-xs text-muted-foreground">
                        {claim}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>
    </section>
  );
}

function RiskPanel({ failures, riskScore }: { failures: FailureState; riskScore: number }) {
  return (
    <section className="space-y-2 rounded-lg border bg-card p-3" aria-labelledby="oauth-risk-title">
      <h3 id="oauth-risk-title" className="text-sm font-semibold">
        Security checks
      </h3>
      <div className="space-y-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Risk score</span>
            <span className="text-sm text-muted-foreground">{riskScore}%</span>
          </div>
          <Progress value={riskScore} />
        </div>
        <CheckRow ok={!failures.badRedirect} label="Exact redirect URI" />
        <CheckRow ok={!failures.broadScope} label="Least-privilege scopes" />
        <CheckRow ok={!failures.expiredAccessToken} label="Fresh access token" />
        <CheckRow ok label="PKCE S256 required" />
        <CheckRow ok label="State + nonce verified" />
      </div>
    </section>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5">
      <span className="text-sm">{label}</span>
      {ok ? (
        <>
          <CircleCheck className="h-4 w-4 text-correct-foreground" aria-hidden="true" />
          <span className="sr-only">passes</span>
        </>
      ) : (
        <>
          <TriangleAlert className="h-4 w-4 text-partial-foreground" aria-hidden="true" />
          <span className="sr-only">fails</span>
        </>
      )}
    </div>
  );
}

function EventLog({ logs }: { logs: FlowLog[] }) {
  return (
    <section
      className="space-y-1.5 rounded-lg border bg-card p-3"
      aria-labelledby="oauth-log-title"
    >
      <h3 id="oauth-log-title" className="text-sm font-semibold">
        Event log
      </h3>
      {logs.map((log, index) => (
        <div
          key={`${log.content}-${index}`}
          className={cn(
            'whitespace-pre-wrap rounded-md border px-2.5 py-1.5 text-xs text-foreground',
            log.type === 'success' && SIM_TONE.success.surface,
            log.type === 'warning' && SIM_TONE.warning.surface,
            log.type === 'error' && SIM_TONE.danger.surface,
            (log.type === 'request' || log.type === 'response') && 'bg-muted/30'
          )}
        >
          {log.content}
        </div>
      ))}
    </section>
  );
}
