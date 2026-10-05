import type {
  ActionDef,
  GameState,
  ModelContext,
  Scenario,
  UpdateKind,
} from './incident-commander-engine';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function latest(
  ctx: ModelContext,
  ids: string[],
  t: number
): { id: string; at: number } | undefined {
  return ctx.changes
    .filter((c) => ids.includes(c.id) && c.at <= t)
    .sort((a, b) => a.at - b.at)
    .pop();
}

function used(state: GameState, id: string): boolean {
  return state.tasks.some((t) => t.actionId === id);
}

function firstUpdateLate(state: GameState): boolean {
  const first = state.updates[0];
  return !first || first.t > 10;
}

function updateActions(product: string): ActionDef[] {
  const post = (id: string, kind: UpdateKind, title: string, detail: string): ActionDef => ({
    id,
    group: 'communicate',
    owner: 'you',
    title,
    detail,
    minutes: 1,
    repeatable: true,
    update: kind,
    expected: 'Customers and support know what is happening and when the next update comes.',
  });
  return [
    post(
      'post-investigating',
      'investigating',
      'Post: Investigating',
      `Investigating: some customers cannot complete ${product}. We are working on it. Next update in 15 minutes.`
    ),
    post(
      'post-identified',
      'identified',
      'Post: Cause identified',
      `Identified: we have found the likely cause of failed ${product} and are applying a fix. Next update in 15 minutes.`
    ),
    post(
      'post-monitoring',
      'monitoring',
      'Post: Fix in place, monitoring',
      `Monitoring: a fix is in place and ${product} is recovering. We are watching it closely.`
    ),
    post(
      'post-resolved',
      'resolved',
      'Post: Resolved',
      `Resolved: ${product} is working normally. We will share a summary.`
    ),
  ];
}

// ---------------------------------------------------------------------------
// Scenario 1: launch day, the database runs out of connection slots
// ---------------------------------------------------------------------------

const DB_CAP = 197; // max_connections 200 minus 3 reserved for superusers
const DB_CAP_RAISED = 397;
const POD_THROUGHPUT = 110; // checkouts per minute one API pod can serve

function launchDemand(t: number, ctx: ModelContext): number {
  const ramp = t < -4 ? 0 : clamp((t + 5) / 3, 0, 1);
  return (1200 + ramp * 500) * (1 + ctx.noise(t, 'demand') * 0.02);
}

function launchPods(t: number, ctx: ModelContext): number {
  const base = t >= -16 ? 30 : 10;
  const scale = latest(ctx, ['scale18', 'scale10'], t);
  if (!scale) return base;
  const target = scale.id === 'scale18' ? 18 : 10;
  const f = clamp((t - scale.at + 1) / 2, 0, 1);
  return Math.round(base + (target - base) * f);
}

function launchModel(t: number, ctx: ModelContext) {
  const demand = launchDemand(t, ctx);
  const pods = launchPods(t, ctx);
  const poolAt = ctx.at('pool6', t);
  const pool = poolAt === undefined ? 10 : 10 - 4 * clamp((t - poolAt + 1) / 2, 0, 1);
  const load = Math.min(1, (demand / 1700) ** 2);
  let conns = pods * pool * load;
  const poolerAt = ctx.at('pooler', t);
  if (poolerAt !== undefined) conns = t > poolerAt ? 60 : (conns + 60) / 2;

  const raisedAt = ctx.at('maxconn400', t);
  const failoverAt = ctx.at('failover', t);
  const restartAt = ctx.at('restartPods', t);
  const outage =
    (raisedAt !== undefined && t < raisedAt + 3) ||
    (failoverAt !== undefined && t < failoverAt + 2);
  const cap = raisedAt !== undefined && t >= raisedAt + 3 ? DB_CAP_RAISED : DB_CAP;
  const churn = restartAt !== undefined && t < restartAt + 3 ? 6 : 0;

  const refusal = Math.max(0, (conns - cap) / conns);
  const timeouts = Math.max(0, (demand - pods * POD_THROUGHPUT) / demand);
  const failed = outage
    ? 100
    : 0.25 + ctx.noise(t, 'f') * 0.08 + 100 * (refusal * 0.55 + timeouts) + churn;
  const constraint = outage
    ? 0
    : clamp((Math.min(conns, cap) / cap) * 100 + ctx.noise(t, 'c') * 0.6, 0, 100);
  return { demand, failed, success: 0, constraint };
}

export const connectionExhaustion: Scenario = {
  id: 'launch-day-connections',
  title: 'Launch day: too many clients',
  difficulty: 'Easy',
  tagline: 'A product launch, a scaled-up API, and checkout failures within minutes.',
  briefing:
    'It is launch day. The marketing email went out four minutes ago, and checkout failures are climbing. You coordinate the response: restore checkout, keep people informed, and confirm the recovery holds before you close.',
  startClock: '10:04',
  responders: {
    r1: { name: 'Priya', role: 'App on-call' },
    r2: { name: 'Marcus', role: 'Database on-call' },
  },
  constraint: {
    label: 'Database connection slots used',
    unit: '%',
    healthy: 'under 95%',
    lowerIsBetter: true,
    format: (v) => `${Math.round(v)}%`,
  },
  successLabel: 'Successful checkouts / min',
  recentChanges: [
    { t: -26, text: 'CDN cache rules updated for the new landing page' },
    { t: -16, text: 'API scaled from 10 to 30 pods for the launch' },
    { t: -4, text: 'Launch email sent to 400,000 subscribers' },
  ],
  openQuestions: [
    {
      text: 'Are the failures app errors, or something below the app?',
      answeredBy: 'failure-type',
    },
    { text: 'Is the database overloaded, or out of something else?', answeredBy: 'db-not-busy' },
    { text: 'What changed in connection demand?', answeredBy: 'conn-demand' },
  ],
  causeFindings: ['conn-demand', 'slots-full'],
  acceptableSeverities: ['SEV1', 'SEV2'],
  model: launchModel,
  isHealthy: (p) => p.failed < 1 && p.constraint < 95,
  actions: [
    {
      id: 'inspect-failures',
      group: 'investigate',
      owner: 'r1',
      title: 'What are the failing checkout requests failing with?',
      detail: 'Pull a sample of failed checkout requests from the API logs.',
      minutes: 2,
      repeatable: true,
      expected: 'Tells apart application exceptions from database errors.',
      onDone: (state) => {
        const p = state.history[state.history.length - 1];
        if (p.failed >= 1 && p.constraint >= 97) {
          return {
            evidence: {
              kind: 'log',
              title: 'api logs, failed POST /api/checkout',
              lines: [
                'ERROR checkout 500 db.connect: FATAL: sorry, too many clients already',
                'WARN  pool checkout-db: waiting for a connection (timeout 2000 ms)',
                'ERROR checkout 500 db.connect: FATAL: sorry, too many clients already',
                'ERROR checkout 500 db.connect: FATAL: sorry, too many clients already',
              ],
            },
            interpretation:
              'Almost every failure is PostgreSQL refusing a new connection. The application code is not throwing. This points below the app, but it does not say why the connections ran out.',
            findings: ['failure-type', 'slots-full'],
          };
        }
        if (p.failed >= 1) {
          return {
            evidence: {
              kind: 'log',
              title: 'api logs, failed POST /api/checkout',
              lines: [
                'ERROR checkout 504 upstream request timeout after 10000 ms',
                'WARN  api pod CPU 100%, request queue 340',
                'ERROR checkout 504 upstream request timeout after 10000 ms',
              ],
            },
            interpretation:
              'The failures are now timeouts: the API pods cannot keep up with the traffic. No connection errors.',
            findings: ['failure-type'],
          };
        }
        return {
          evidence: {
            kind: 'log',
            title: 'api logs, last 2 minutes',
            lines: ['No connection errors.', 'A few 402s: normal card declines.'],
          },
          interpretation:
            'Checkout requests are succeeding. The remaining failures are ordinary card declines.',
          findings: ['failure-type'],
        };
      },
    },
    {
      id: 'compare-demand',
      group: 'investigate',
      owner: 'r1',
      title: 'How many connections can the API ask for now, compared with before?',
      detail: 'Compare pod count and pool size with the database connection limit.',
      minutes: 2,
      repeatable: true,
      expected: 'Shows whether connection demand changed with the scale-up.',
      onDone: (_state, ctx) => {
        const t = _state.t;
        const pods = launchPods(t, ctx);
        const pool = ctx.at('pool6', t) !== undefined ? 6 : 10;
        const pooler = ctx.at('pooler', t) !== undefined;
        return {
          evidence: {
            kind: 'table',
            title: 'connection demand',
            lines: [
              '                     before launch   now',
              `API pods             10              ${pods}`,
              `pool max per pod     10              ${pool}`,
              `max connections      100             ${pooler ? '60 (via PgBouncer)' : pods * pool}`,
              'database limit       200 (197 for the app)',
            ],
          },
          interpretation: pooler
            ? 'Through the pooler, checkout now uses 60 server connections, far below the limit.'
            : pods * pool > DB_CAP
              ? `The pods together can open ${pods * pool} connections and the database accepts 197. Under launch traffic the pools fill up and the rest are refused.`
              : `The pods can open at most ${pods * pool} connections, under the 197 the database accepts.`,
          findings: ['conn-demand'],
        };
      },
    },
    {
      id: 'check-traffic',
      group: 'investigate',
      owner: 'r1',
      title: 'Is launch traffic more than the API can serve?',
      detail: 'Compare checkout traffic with what the current pods can handle.',
      minutes: 2,
      expected: 'Rules capacity in or out.',
      onDone: (state, ctx) => {
        const pods = launchPods(state.t, ctx);
        const demand = Math.round(launchDemand(state.t, ctx));
        return {
          evidence: {
            kind: 'table',
            title: 'traffic vs capacity',
            lines: [
              `checkout attempts      ${demand.toLocaleString('en-US')} / min (about 1,200 normally)`,
              `API capacity           ${pods} pods x ~110 = ${(pods * POD_THROUGHPUT).toLocaleString('en-US')} / min`,
              'API pod CPU            41%',
            ],
          },
          interpretation:
            pods * POD_THROUGHPUT >= demand
              ? 'Traffic is up about 40%, within what the pods can serve. Traffic alone is not the problem, but it is what fills the connection pools.'
              : 'The API now has less capacity than the launch traffic needs, so requests are timing out.',
          findings: ['traffic-ok'],
        };
      },
    },
    {
      id: 'db-load',
      group: 'investigate',
      owner: 'r2',
      title: 'Is the database overloaded?',
      detail: 'Check CPU, memory and connection states on the primary.',
      minutes: 3,
      repeatable: true,
      expected: 'Shows whether the database is busy or blocked on something else.',
      onDone: (state) => {
        const p = state.history[state.history.length - 1];
        const full = p.constraint >= 97;
        return {
          evidence: {
            kind: 'table',
            title: 'checkout-db primary',
            lines: [
              'CPU                22%',
              'memory             41%',
              `connections        ${full ? '197 / 200 (3 reserved)' : `${Math.round((p.constraint / 100) * DB_CAP)} / 200`}`,
              `  active           ${full ? 31 : 28}`,
              `  idle             ${full ? 166 : Math.max(0, Math.round((p.constraint / 100) * DB_CAP) - 28)}`,
              'slow queries       none over 200 ms',
            ],
          },
          interpretation: full
            ? 'The database is mostly idle: 166 of its connections are open but doing nothing. It is not out of CPU or memory; it is out of connection slots.'
            : 'The database has free connection slots and low load.',
          findings: full ? ['db-not-busy', 'slots-full'] : ['db-not-busy'],
        };
      },
    },
    {
      id: 'pooler-ready',
      group: 'investigate',
      owner: 'r2',
      title: 'Is the standby PgBouncer safe to switch checkout to?',
      detail: 'Check the pooler that was set up and load-tested last quarter.',
      minutes: 2,
      expected: 'Tells you whether the pooler is a safe, reversible option.',
      onDone: () => ({
        evidence: {
          kind: 'note',
          title: 'pgbouncer-standby',
          lines: [
            'status: healthy, transaction pooling, 60 server connections',
            'load test: July, 4,000 checkouts / min',
            'March audit: checkout keeps no session state (no session SET, no advisory locks, no LISTEN)',
          ],
        },
        interpretation:
          'Switching checkout to the pooler looks safe, and the same config flag switches it back.',
        findings: ['pooler-safe'],
      }),
    },
    {
      id: 'replica-health',
      group: 'investigate',
      owner: 'r2',
      title: 'Is replication healthy?',
      detail: 'Check the replica and its lag.',
      minutes: 2,
      expected: 'Tells you whether a failover is relevant.',
      onDone: () => ({
        evidence: {
          kind: 'table',
          title: 'checkout-db replica',
          lines: ['replication lag   0.4 s', 'state             streaming'],
        },
        interpretation:
          'Replication is fine and unrelated to the failures. The replica has the same 200-connection limit, so a failover would not add slots.',
        findings: ['replica-ok'],
      }),
    },
    {
      id: 'pool6',
      group: 'mitigate',
      owner: 'r1',
      title: 'Lower the per-pod connection pool from 10 to 6',
      detail:
        'Config change and a rolling restart of the 30 API pods. 30 x 6 = 180 connections, under the 197 the database accepts.',
      minutes: 4,
      risk: 'low',
      reversible: true,
      expected:
        'Connection slots fall under 95% and failures drop within 2 minutes after the rollout.',
      onDone: () => ({
        change: 'pool6',
        message: 'Pool limit is now 6 on all 30 pods. Watch failures and connection slots.',
      }),
    },
    {
      id: 'pooler',
      group: 'mitigate',
      owner: 'r2',
      title: 'Switch checkout to the standby PgBouncer',
      detail:
        'Flip the database URL flag to the pooler that is already running (transaction mode, 60 server connections).',
      minutes: 3,
      risk: 'medium',
      reversible: true,
      expected: 'Connection slots fall far below the limit; failures drop within a minute.',
      onDone: () => ({
        change: 'pooler',
        message: 'Checkout now connects through PgBouncer. Watch failures and connection slots.',
      }),
    },
    {
      id: 'scale18',
      group: 'mitigate',
      owner: 'r1',
      title: 'Scale the API from 30 to 18 pods',
      detail: '18 x 10 = 180 connections. 18 pods can serve about 1,980 checkouts a minute.',
      minutes: 2,
      risk: 'low',
      reversible: true,
      expected: 'Fewer connections, and enough capacity if traffic stays near today’s peak.',
      onDone: () => ({ change: 'scale18', message: 'API scaled to 18 pods.' }),
    },
    {
      id: 'scale10',
      group: 'mitigate',
      owner: 'r1',
      title: 'Scale the API back to 10 pods, as before the launch',
      detail: '10 x 10 = 100 connections. 10 pods can serve about 1,100 checkouts a minute.',
      minutes: 2,
      risk: 'medium',
      reversible: true,
      expected: 'Connections drop well under the limit; capacity drops too.',
      onDone: () => ({ change: 'scale10', message: 'API scaled to 10 pods.' }),
    },
    {
      id: 'maxconn',
      group: 'mitigate',
      owner: 'r2',
      title: 'Raise max_connections from 200 to 400',
      detail: 'Needs a restart of the primary: about 3 minutes with no database.',
      minutes: 2,
      risk: 'high',
      reversible: false,
      confirm:
        'This restarts the production database. Checkout will be fully down for about 3 minutes. Continue?',
      expected: 'After the restart, the database accepts 397 connections.',
      onDone: () => ({
        change: 'maxconn400',
        message: 'Primary restarting with max_connections = 400.',
      }),
    },
    {
      id: 'restart-pods',
      group: 'mitigate',
      owner: 'r1',
      title: 'Restart all API pods',
      detail: 'Rolling restart of all 30 pods.',
      minutes: 3,
      risk: 'medium',
      reversible: true,
      expected: 'Clears stuck connections, if there are any.',
      onDone: () => ({ change: 'restartPods', message: 'All API pods restarted.' }),
    },
    {
      id: 'failover',
      group: 'mitigate',
      owner: 'r2',
      title: 'Fail over the database to the replica',
      detail: 'Promote the replica to primary: about 2 minutes without writes.',
      minutes: 3,
      risk: 'high',
      reversible: false,
      confirm: 'This promotes the replica. Checkout writes stop for about 2 minutes. Continue?',
      expected: 'A fresh primary.',
      onDone: () => ({ change: 'failover', message: 'Replica promoted to primary.' }),
    },
    ...updateActions('checkout'),
  ],
  events: [
    {
      t: 2,
      who: 'Support',
      text: 'Tickets are coming in: "Payment failed, please try again." About 40 in the last 5 minutes.',
    },
    {
      t: 5,
      who: 'Head of Marketing',
      text: 'The launch email went to 400,000 people. Is checkout down? When will it be fixed?',
      when: (state) => state.updates.length === 0,
    },
    {
      t: 12,
      who: 'Support',
      text: 'Customers are posting about failed payments on social media.',
      when: (state) => state.history[state.history.length - 1].failed >= 1,
    },
  ],
  hints: [
    'Did anything change how many database connections the API can ask for?',
    'Compare pod count times pool size with the database connection limit. Marcus can tell you how busy the database really is.',
    'Bring connection demand under the limit with a reversible change: lower the pool size, switch to the standby pooler, or scale to 18 pods. A database restart also works, but costs a full outage.',
  ],
  debrief: {
    rootCause:
      'The API was scaled from 10 to 30 pods for the launch, and each pod can open up to 10 database connections. Under launch traffic the pools filled up and asked for 300 connections, but PostgreSQL accepts 200 (197 for the app). The database itself was mostly idle: it ran out of connection slots, not CPU.',
    effectiveResponse: [
      'Set SEV1 or SEV2 and post an Investigating update in the first few minutes: a fifth of launch-day checkouts are failing.',
      'In parallel, Priya inspects the failures (connections refused) while Marcus checks the database (idle, slots full).',
      'Compare demand with the limit: 30 pods x 10 = 300 against 197.',
      'Apply one reversible change that brings demand under the limit, for example a pool of 6.',
      'Post Identified, start monitoring once failures are back under 1%, post Monitoring, and resolve after recovery holds.',
    ],
    alternatives: [
      'Switching to the standby PgBouncer also works and leaves room to grow, once Marcus confirms checkout keeps no session state.',
      'Scaling to 18 pods works while traffic stays near the launch peak, but leaves little headroom.',
      'Raising max_connections works, but the restart takes checkout fully down for about 3 minutes, and every idle connection costs database memory.',
    ],
    revisit: (state) => {
      if (used(state, 'maxconn'))
        return 'Raising max_connections restarted the database and took checkout fully down for about 3 minutes. Reducing connection demand first would have fixed it without an outage.';
      if (used(state, 'failover'))
        return 'The failover stopped writes for 2 minutes and did not add connection slots: the new primary has the same limit.';
      if (used(state, 'scale10'))
        return 'Scaling back to 10 pods removed the connection errors but left too little capacity for launch traffic, so requests timed out instead.';
      if (used(state, 'restart-pods'))
        return 'Restarting all pods added connection churn while the slots were full, and did not change how many connections the pods ask for.';
      if (state.phaseClaims.some((c) => !c.ok))
        return 'You tried to move on before the signals had recovered. Check failures and connection slots before claiming progress.';
      if (firstUpdateLate(state))
        return 'Customers and the marketing team waited more than 10 minutes for a first update. An Investigating post takes one minute and needs no diagnosis.';
      return null;
    },
    lessons: [
      'Database connections are a limited resource, even when CPU is low. Multiply pods by pool size every time you change either one.',
      'Mitigate with the smallest reversible change that addresses the evidence.',
      'Communicate early, before you know the cause.',
    ],
    goDeeper: [
      {
        title: 'Serverless killed your connection pool',
        href: '/posts/serverless-killed-your-connection-pool',
      },
      {
        title: 'How to build an effective on-call rotation and escalation policy',
        href: '/posts/on-call-rotation-escalation-policy-guide',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Scenario 2: three changes in five minutes, one incident
// ---------------------------------------------------------------------------

const EUR_SHARE = 0.4;
const EUR_DISCOUNT_FAIL = 0.23;

function v214(t: number, ctx: ModelContext): number {
  const deployed = t < -5 ? 0 : t < -4 ? 0.5 : 1;
  const rb = ctx.at('rollback', t);
  if (rb === undefined) return deployed;
  return Math.max(0, deployed * (1 - clamp((t - rb + 1) / 2, 0, 1)));
}

function flagShare(t: number, ctx: ModelContext): number {
  const c = latest(ctx, ['flag10', 'flagOff'], t);
  if (c) return c.id === 'flag10' ? 0.1 : 0;
  return t < -3 ? 0.1 : 1;
}

function threeChangesModel(t: number, ctx: ModelContext) {
  const demand = 900 * (1 + ctx.noise(t, 'demand') * 0.02);
  const broken = v214(t, ctx) * flagShare(t, ctx);
  const pausedAt = ctx.at('pauseUpgrade', t);
  const upgrading = t >= -1 && t <= 24 && (pausedAt === undefined || t < pausedAt);
  const blip = upgrading && (t + 1) % 3 === 0 ? 0.6 : 0;
  const restartAt = ctx.at('restartCheckout', t);
  const restart = restartAt !== undefined && t < restartAt + 2 ? 2 : 0;
  const failed =
    0.2 + ctx.noise(t, 'f') * 0.05 + 100 * broken * EUR_SHARE * EUR_DISCOUNT_FAIL + blip + restart;
  const constraint =
    99.6 - 100 * broken * EUR_DISCOUNT_FAIL + ctx.noise(t, 'c') * 0.1 - (restart ? 2 : 0);
  return { demand, failed, success: 0, constraint };
}

export const threeChanges: Scenario = {
  id: 'three-changes',
  title: 'Three changes, one incident',
  difficulty: 'Medium',
  tagline: 'A deploy, a feature flag and a node upgrade in five minutes. Then checkout breaks.',
  briefing:
    'In the last five minutes, checkout v2.14 was deployed, the new-pricing feature flag went from 10% to 100%, and the platform team started a node pool upgrade. Now checkout errors are up. You coordinate the response: restore checkout, keep people informed, and confirm the recovery holds before you close.',
  startClock: '14:05',
  responders: {
    r1: { name: 'Priya', role: 'Checkout on-call' },
    r2: { name: 'Dev', role: 'Platform on-call' },
  },
  constraint: {
    label: 'EUR checkout success',
    unit: '%',
    healthy: 'above 99%',
    lowerIsBetter: false,
    format: (v) => `${v.toFixed(1)}%`,
  },
  successLabel: 'Successful checkouts / min',
  recentChanges: [
    { t: -40, text: 'Home page banner updated' },
    { t: -5, text: 'Checkout v2.14 deployed (rolling, finished at 14:01)' },
    { t: -3, text: 'Feature flag new-pricing raised from 10% to 100% of users' },
    { t: -1, text: 'Node pool upgrade started: one node every 3 minutes' },
  ],
  openQuestions: [
    { text: 'Which code path is failing?', answeredBy: 'pricing-path' },
    { text: 'Which of the three changes lines up with it?', answeredBy: 'v214-touched' },
    { text: 'Is the node upgrade part of the problem?', answeredBy: 'upgrade-noise' },
  ],
  causeFindings: ['pricing-path', 'v214-touched', 'flag-history'],
  acceptableSeverities: ['SEV1', 'SEV2'],
  model: threeChangesModel,
  isHealthy: (p) => p.failed < 1 && p.constraint > 99,
  actions: [
    {
      id: 'inspect-500s',
      group: 'investigate',
      owner: 'r1',
      title: 'Where do the 500s come from?',
      detail: 'Pull stack traces for the failing checkout requests.',
      minutes: 2,
      repeatable: true,
      expected: 'Points at the code path that fails.',
      onDone: (state, ctx) => {
        const broken = v214(state.t, ctx) * flagShare(state.t, ctx);
        if (broken > 0) {
          return {
            evidence: {
              kind: 'trace',
              title: 'POST /api/pricing/quote 500',
              lines: [
                "TypeError: CurrencyFormatter.format: no minor unit for 'EUR' (got undefined)",
                '    at formatDiscount (pricing/v2/discounts.ts:88)',
                '    at quoteNewPricing (pricing/v2/quote.ts:41)',
                '    at POST /api/pricing/quote',
              ],
            },
            interpretation:
              'The failures come from the new pricing code (pricing/v2), which only runs for users in the new-pricing flag. This does not tell you yet which change broke it.',
            findings: ['pricing-path'],
          };
        }
        return {
          evidence: {
            kind: 'log',
            title: 'checkout errors, last 2 minutes',
            lines: ['No 500s from /api/pricing.'],
          },
          interpretation: 'The pricing errors have stopped.',
          findings: ['pricing-path'],
        };
      },
    },
    {
      id: 'diff-v214',
      group: 'investigate',
      owner: 'r1',
      title: 'What changed in checkout v2.14?',
      detail: 'Read the diff between v2.13 and v2.14.',
      minutes: 3,
      expected: 'Shows whether the deploy touched the failing code.',
      onDone: () => ({
        evidence: {
          kind: 'diff',
          title: 'v2.13...v2.14',
          lines: [
            'lib/currency.ts',
            '- const minor = MINOR_UNITS[currency] ?? 2',
            '+ const minor = catalog.minorUnits(currency)  // read from the new catalog',
            'README.md: 3 lines',
          ],
        },
        interpretation:
          'v2.14 changed the shared currency helper that pricing/v2 uses for discounts, and the new catalog lookup returns nothing for EUR. v2.14 is a strong suspect, together with the flag that now sends everyone down that path.',
        findings: ['v214-touched'],
      }),
    },
    {
      id: 'errors-by-currency',
      group: 'investigate',
      owner: 'r1',
      title: 'Are all customers affected, or only some?',
      detail: 'Break checkout errors down by currency and cart type.',
      minutes: 2,
      expected: 'Narrows down who is affected.',
      onDone: () => ({
        evidence: {
          kind: 'table',
          title: 'errors by currency',
          lines: [
            'EUR   96% of errors',
            'USD    3%',
            'GBP    1%',
            'EUR carts with a discount: 23% fail',
          ],
        },
        interpretation:
          'The failures are concentrated on EUR carts with a discount, which the new pricing code handles.',
        findings: ['eur-only'],
      }),
    },
    {
      id: 'flag-history',
      group: 'investigate',
      owner: 'r1',
      title: 'What does the new-pricing flag history show?',
      detail: 'Read the flag change log.',
      minutes: 1,
      expected: 'Shows when the flag changed and what happened at each step.',
      onDone: () => ({
        evidence: {
          kind: 'table',
          title: 'flag new-pricing',
          lines: [
            'Sep 28 10:00   0% -> 10%    errors unchanged (checkout v2.13)',
            'Oct 5  14:02  10% -> 100%   planned rollout',
          ],
        },
        interpretation:
          'The flag ran at 10% for a week without trouble, on v2.13. The jump to 100% came one minute after v2.14 finished deploying.',
        findings: ['flag-history'],
      }),
    },
    {
      id: 'upgrade-impact',
      group: 'investigate',
      owner: 'r2',
      title: 'Is the node pool upgrade causing the errors?',
      detail: 'Compare node drains with the error timeline.',
      minutes: 2,
      expected: 'Rules the upgrade in or out.',
      onDone: () => ({
        evidence: {
          kind: 'note',
          title: 'node pool upgrade',
          lines: [
            'each drain moves about 6 checkout pods; each move gives a short blip, under 1% for a minute',
            'the /api/pricing 500s started at 14:02, before the upgrade began at 14:04',
            'the 500s do not follow the drains',
          ],
        },
        interpretation:
          'The upgrade adds small blips, not the large error rate. Pausing it removes noise while you fix the real problem.',
        findings: ['upgrade-noise'],
      }),
    },
    {
      id: 'pod-health',
      group: 'investigate',
      owner: 'r2',
      title: 'Are the checkout pods healthy?',
      detail: 'Check readiness, restarts and resource use.',
      minutes: 2,
      expected: 'Rules infrastructure in or out.',
      onDone: () => ({
        evidence: {
          kind: 'table',
          title: 'checkout pods',
          lines: ['12/12 Ready', 'CPU 35%   memory 48%', 'restarts in the last hour: 0'],
        },
        interpretation:
          'The pods are healthy. The failures are in a code path, not in the infrastructure.',
        findings: ['pods-ok'],
      }),
    },
    {
      id: 'flag10',
      group: 'mitigate',
      owner: 'r1',
      title: 'Set the new-pricing flag back to 10%',
      detail: 'Config push, effective in about a minute. Returns to last week’s rollout level.',
      minutes: 1,
      risk: 'low',
      reversible: true,
      expected: 'Errors drop if the new pricing code is involved.',
      onDone: () => ({
        change: 'flag10',
        message: 'new-pricing is back at 10%. Watch the error rate and EUR checkouts.',
      }),
    },
    {
      id: 'flagOff',
      group: 'mitigate',
      owner: 'r1',
      title: 'Turn the new-pricing flag off',
      detail:
        'Everyone gets the old pricing code. The new pricing feature is paused for all users.',
      minutes: 1,
      risk: 'low',
      reversible: true,
      expected: 'Errors from the new pricing code stop within a minute.',
      onDone: () => ({
        change: 'flagOff',
        message: 'new-pricing is off. Watch the error rate and EUR checkouts.',
      }),
    },
    {
      id: 'rollback',
      group: 'mitigate',
      owner: 'r1',
      title: 'Roll back checkout to v2.13',
      detail:
        'Redeploy the previous version. The build is cached; the rollout takes about 6 minutes.',
      minutes: 6,
      risk: 'low',
      reversible: true,
      expected: 'If v2.14 is the cause, errors fall as v2.13 pods take over.',
      onDone: () => ({ change: 'rollback', message: 'Checkout v2.13 is rolling out.' }),
    },
    {
      id: 'pause-upgrade',
      group: 'mitigate',
      owner: 'r2',
      title: 'Pause the node pool upgrade',
      detail: 'Stops further node drains. Nodes already upgraded stay upgraded.',
      minutes: 1,
      risk: 'low',
      reversible: true,
      independent: true,
      expected: 'No more drain blips while you work.',
      onDone: () => ({ change: 'pauseUpgrade', message: 'Node pool upgrade paused.' }),
    },
    {
      id: 'restart-checkout',
      group: 'mitigate',
      owner: 'r1',
      title: 'Restart all checkout pods',
      detail: 'Rolling restart of the 12 checkout pods.',
      minutes: 2,
      risk: 'medium',
      reversible: true,
      expected: 'Clears bad pod state, if there is any.',
      onDone: () => ({ change: 'restartCheckout', message: 'Checkout pods restarted.' }),
    },
    {
      id: 'scale-checkout',
      group: 'mitigate',
      owner: 'r2',
      title: 'Scale checkout from 12 to 20 pods',
      detail: 'Adds capacity to the checkout service.',
      minutes: 2,
      risk: 'low',
      reversible: true,
      expected: 'More capacity, if capacity is the problem.',
      onDone: () => ({ change: 'scaleCheckout', message: 'Checkout scaled to 20 pods.' }),
    },
    ...updateActions('checkout'),
  ],
  events: [
    {
      t: 3,
      who: 'Support',
      text: 'Customers in Germany and France report "Something went wrong" at checkout.',
    },
    {
      t: 7,
      who: 'Alex (Product)',
      text: 'I raised new-pricing to 100% at 14:02, as planned. Should I roll it back?',
      when: (state, ctx) => flagShare(state.t, ctx) === 1,
    },
    {
      t: 15,
      who: 'Dev (Platform)',
      text: 'Node pool upgrade is about 40% done.',
      when: (state, ctx) => ctx.at('pauseUpgrade', state.t) === undefined,
    },
  ],
  hints: [
    'Which of the three changes touches the code that the errors come from?',
    'Look at where the 500s come from, and compare the flag history with the v2.14 deploy time.',
    'Undo the fastest safe change that matches the evidence: turn the new-pricing flag off, or roll back v2.14. Setting the flag back to 10% helps but leaves some EUR carts failing. Pausing the upgrade removes noise.',
  ],
  debrief: {
    rootCause:
      'Checkout v2.14 changed a shared currency helper. The new pricing code, behind the new-pricing flag, uses that helper for discounts, and it fails for EUR. At 10% the flag sent few users down that path; at 100% it sent everyone, and failures jumped to about 9%. The node pool upgrade added small blips but was not the cause.',
    effectiveResponse: [
      'Set a severity and post an Investigating update in the first minutes.',
      'Priya finds where the 500s come from (pricing/v2) while Dev checks the upgrade (not the cause) and pauses it to remove noise.',
      'Turn the new-pricing flag off: a one-minute, reversible change that matches the evidence.',
      'With failures back to normal, post Identified and Monitoring, and plan the v2.14 fix before the flag goes back on.',
      'Resolve after the recovery holds.',
    ],
    alternatives: [
      'Rolling back to v2.13 also fixes it and keeps the new pricing on, but takes about 6 minutes.',
      'Setting the flag back to 10% is the textbook first move and removes most of the errors, but here about 1% of checkouts keep failing, so you still need the flag off or the rollback.',
    ],
    revisit: (state) => {
      if (used(state, 'restart-checkout'))
        return 'Restarting checkout pods added a short spike and changed nothing: the bug was in code, not in pod state.';
      if (used(state, 'scale-checkout'))
        return 'Scaling checkout added cost and did nothing: the pods were healthy and the failures came from code.';
      const flagOff = state.tasks.find((t) => t.actionId === 'flagOff');
      const rollback = state.tasks.find((t) => t.actionId === 'rollback');
      if (flagOff && rollback && flagOff.start < rollback.end && rollback.start < flagOff.end)
        return 'Turning the flag off and rolling back at the same time made it hard to tell which one fixed it.';
      if (used(state, 'flag10') && !used(state, 'flagOff') && !used(state, 'rollback'))
        return 'Setting the flag to 10% helped, but failures stayed above normal. The evidence (EUR discount carts on the new pricing code) called for turning it off or rolling back.';
      if (state.phaseClaims.some((c) => !c.ok))
        return 'You tried to move on before the signals had recovered. Check the error rate and EUR checkouts before claiming progress.';
      if (firstUpdateLate(state))
        return 'Customers waited more than 10 minutes for a first update. An Investigating post takes one minute and needs no diagnosis.';
      return null;
    },
    lessons: [
      'Mitigate first, with the fastest reversible change that matches the evidence. Find the root cause after.',
      'A feature flag is the cheapest rollback you have, but check that it returns you to a healthy state.',
      'Change one thing at a time when you can, so each step tells you something.',
    ],
    goDeeper: [
      {
        title: 'How to implement progressive delivery with feature flags',
        href: '/posts/how-to-implement-progressive-delivery-with-feature-flags',
      },
      {
        title: 'SLOs, SLIs and error budgets: a practical guide',
        href: '/posts/slos-slis-error-budgets-practical-guide',
      },
    ],
  },
};

export const SCENARIOS: Scenario[] = [connectionExhaustion, threeChanges];

export function getScenario(id: string): Scenario {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown scenario ${id}`);
  return s;
}
