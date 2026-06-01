'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  CircleDot,
  Code2,
  Globe,
  KeyRound,
  LockKeyhole,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
        insight:
          'OAuth delegates access. OIDC adds identity by asking for the openid scope.',
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
        insight:
          'The app must verify state before exchanging the code. This blocks login CSRF.',
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
        insight:
          'Exact redirect matching is one of the most important OAuth security controls.',
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
    claims: ['iss=https://auth.example', 'aud=devops_daily_lab', 'sub=user_123', 'nonce=n0nc3_login'],
  },
  access: {
    title: 'Access Token',
    description: 'For APIs. Carries authorization context.',
    claims: ['aud=https://api.example', 'scope=api:read:deployments', 'exp=5m', 'cnf=pkce-bound'],
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

  const currentLesson = LESSONS[currentLessonIndex];
  const currentAction = currentLesson.actions[currentActionIndex];
  const totalActions = LESSONS.reduce((sum, lesson) => sum + lesson.actions.length, 0);
  const completedCount = completedActions.size;
  const progress = (completedCount / totalActions) * 100;

  const selectedTokenCount = Object.values(tokens).filter(Boolean).length;
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
      setTokens((prev) => action.creates?.reduce((next, token) => ({ ...next, [token]: true }), prev) ?? prev);
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
    if (action === currentAction && !completedActions.has(key)) {
      setCompletedActions((prev) => new Set(prev).add(key));
      setTimeout(() => {
        if (currentActionIndex < currentLesson.actions.length - 1) {
          setCurrentActionIndex((index) => index + 1);
        } else if (currentLessonIndex < LESSONS.length - 1) {
          setCurrentLessonIndex((index) => index + 1);
          setCurrentActionIndex(0);
        }
        setShowHint(false);
      }, 550);
    }
  };

  const resetLab = () => {
    setCurrentLessonIndex(0);
    setCurrentActionIndex(0);
    setCompletedActions(new Set());
    setTokens({ id: false, access: false, refresh: false });
    setFailures({ badRedirect: false, broadScope: false, expiredAccessToken: false });
    setLogs(createInitialLogs());
    setActiveMessage(null);
    setShowHint(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-md border bg-muted/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-primary">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="font-mono text-xs text-muted-foreground">// oauth oidc lab</p>
              <h2 className="text-2xl font-bold md:text-3xl">OAuth/OIDC Flow Simulator</h2>
            </div>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Visualize authorization code + PKCE, OIDC ID tokens, access tokens, refresh tokens,
            scopes, callbacks, and the mistakes that break real login flows.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedCount}/{totalActions}
              </span>
            </div>
            <Progress value={progress} />
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Tokens" value={String(selectedTokenCount)} />
              <Metric label="Risk" value={`${riskScore}%`} />
              <Metric label="Scopes" value={failures.broadScope ? 'Broad' : 'Least'} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Code2 className="h-5 w-5" />
                Lessons
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {LESSONS.map((lesson, lessonIndex) => {
                const active = lessonIndex === currentLessonIndex;
                const complete = lesson.actions.every((_, actionIndex) =>
                  completedActions.has(`${lessonIndex}-${actionIndex}`)
                );

                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => {
                      setCurrentLessonIndex(lessonIndex);
                      setCurrentActionIndex(0);
                      setShowHint(false);
                    }}
                    className={cn(
                      'w-full rounded-md border p-2.5 text-left transition-colors',
                      active
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-border hover:border-primary/40 hover:bg-muted/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('rounded-md border p-1.5', active ? 'text-primary' : 'text-muted-foreground')}>
                        {complete ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : lesson.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{lesson.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{lesson.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Button size="sm" variant="outline" onClick={resetLab} className="w-full">
            <RotateCcw className="mr-1 h-4 w-4" />
            Reset lab
          </Button>
        </div>

        <div className="space-y-4">
          <Card className="border-primary/40">
            <CardContent className="space-y-2.5 p-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      Lesson {currentLessonIndex + 1} / {LESSONS.length}
                    </Badge>
                    <Badge>
                      Step {currentActionIndex + 1} / {currentLesson.actions.length}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium sm:text-base">{currentAction.description}</p>
                  {showHint && (
                    <p className="mt-2 rounded-md border border-primary/30 bg-primary/10 p-2 text-sm text-muted-foreground">
                      {currentAction.insight}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowHint((value) => !value)}>
                    <Sparkles className="mr-1 h-4 w-4" />
                    Explain
                  </Button>
                  <Button size="sm" onClick={() => runAction()}>
                    <Play className="mr-1 h-4 w-4" />
                    {currentAction.label}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <FlowCanvas activeMessage={activeMessage} failures={failures} tokens={tokens} />
          <MessageInspector action={activeMessage} />
        </div>

        <div className="space-y-4">
          <TokenPanel tokens={tokens} failures={failures} />
          <RiskPanel failures={failures} riskScore={riskScore} />
          <EventLog logs={logs} />
        </div>
      </div>

      {completedCount === totalActions && (
        <Card className="mt-4 border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="font-semibold">Lab complete</p>
                <p className="text-sm text-muted-foreground">
                  You traced login, token validation, API access, refresh, and common OAuth/OIDC
                  failure modes.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={resetLab}>
              Start over
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="truncate text-sm font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
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
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowRight className="h-5 w-5" />
          Protocol Flow
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid gap-3 lg:grid-cols-5">
          {actorEntries.map(([id, actor]) => {
            const active = activeMessage?.from === id || activeMessage?.to === id;
            return (
              <div
                key={id}
                className={cn(
                  'min-h-32 rounded-md border p-3 transition-colors',
                  active ? 'border-primary/60 bg-primary/10' : 'bg-muted/20'
                )}
              >
                <div className={cn('mb-3 inline-flex rounded-md border p-2', active && 'text-primary')}>
                  {actor.icon}
                </div>
                <p className="text-sm font-semibold">{actor.label}</p>
                <p className="text-xs text-muted-foreground">{actor.caption}</p>
                {id === 'authorization-server' && failures.badRedirect && (
                  <Badge variant="destructive" className="mt-3 text-[10px]">
                    redirect mismatch
                  </Badge>
                )}
                {id === 'authorization-server' && failures.broadScope && (
                  <Badge variant="secondary" className="mt-3 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300">
                    broad scope
                  </Badge>
                )}
                {id === 'api' && failures.expiredAccessToken && (
                  <Badge variant="destructive" className="mt-3 text-[10px]">
                    token expired
                  </Badge>
                )}
                {id === 'token-endpoint' && tokens.refresh && (
                  <Badge variant="secondary" className="mt-3 text-[10px]">
                    rotation ready
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-md border bg-muted/20 p-3">
          {activeMessage ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  {actorLabel(activeMessage.from)} {'->'} {actorLabel(activeMessage.to)}
                </p>
                <p className="text-xs text-muted-foreground">{activeMessage.description}</p>
              </div>
              <Badge variant={activeMessage.warning ? 'destructive' : 'default'}>
                {activeMessage.warning ? 'risk surfaced' : 'message in flight'}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Run the next action to animate the current OAuth/OIDC message.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MessageInspector({ action }: { action: FlowAction | null }) {
  return (
    <Card className="overflow-hidden border-border bg-[#171717]">
      <CardHeader className="border-b border-border/60 bg-[#262626] p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
            </div>
            <span className="ml-2 text-sm text-muted-foreground">oauth-message.log</span>
          </div>
          <Terminal className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <pre className="min-h-72 overflow-auto p-4 font-mono text-sm leading-relaxed text-slate-300">
          {action
            ? `${actorLabel(action.from)} -> ${actorLabel(action.to)}\n\n${action.log}\n\n# ${action.insight}`
            : 'No message selected yet.\nRun the current flow action to inspect request and response details.'}
        </pre>
      </CardContent>
    </Card>
  );
}

function TokenPanel({ tokens, failures }: { tokens: TokenState; failures: FailureState }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-5 w-5" />
          Token Set
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {(Object.entries(TOKEN_COPY) as Array<[TokenKind, (typeof TOKEN_COPY)[TokenKind]]>).map(([kind, token]) => {
          const active = tokens[kind];
          const expired = kind === 'access' && failures.expiredAccessToken;
          return (
            <div
              key={kind}
              className={cn(
                'rounded-md border p-3',
                active ? 'border-emerald-500/30 bg-emerald-500/10' : 'bg-muted/20',
                expired && 'border-amber-500/40 bg-amber-500/10'
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{token.title}</p>
                <Badge variant={active ? 'default' : 'secondary'}>{expired ? 'expired' : active ? 'issued' : 'missing'}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{token.description}</p>
              {active && (
                <div className="mt-2 space-y-1">
                  {token.claims.map((claim) => (
                    <p key={claim} className="truncate font-mono text-[11px] text-muted-foreground">
                      {claim}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RiskPanel({ failures, riskScore }: { failures: FailureState; riskScore: number }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5" />
          Security Checks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
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
      </CardContent>
    </Card>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border p-2.5">
      <span className="text-sm">{label}</span>
      {ok ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
    </div>
  );
}

function EventLog({ logs }: { logs: FlowLog[] }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CircleDot className="h-5 w-5" />
          Event Log
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {logs.map((log, index) => (
          <div
            key={`${log.content}-${index}`}
            className={cn(
              'rounded-md border p-2.5',
              log.type === 'success' && 'border-emerald-500/30 bg-emerald-500/10',
              log.type === 'warning' && 'border-amber-500/30 bg-amber-500/10',
              log.type === 'error' && 'border-red-500/30 bg-red-500/10'
            )}
          >
            <p className="whitespace-pre-wrap text-xs text-muted-foreground">{log.content}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
