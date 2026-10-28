// lib/on-call-incidents.ts
//
// The incident pool for "On-Call: The Daily Incident". The schedule walks this
// list in order, one incident per UTC day, so keep neighbouring incidents on
// different topics. Append new incidents at the end: changing the length moves
// the schedule from the next deploy on, and stored rounds carry the incident
// number so a played round is never shown against the wrong incident.
//
// Every incident needs one root cause that the evidence supports, causes in
// the same subsystem that the evidence rules out (they score "partial"), and
// no more signals than a player can inspect while keeping a move to diagnose.
// tests/on-call.test.ts checks the shape.

import type { Incident } from './on-call';

const lines = (...rows: string[]) => rows.join('\n');

export const INCIDENTS: Incident[] = [
  {
    number: 1,
    title: 'Checkout API is throwing 503s',
    topic: 'database',
    severity: 'SEV2',
    page: 'checkout-api: 503 rate 18%, p99 6.0 s. Fired 2 minutes ago.',
    symptoms: [
      'The error rate jumped from 0.1% to 18% at 14:32.',
      'A deploy of checkout-api finished at 14:31.',
      'Database CPU looks normal on the overview dashboard.',
    ],
    evidence: [
      {
        label: 'Rollout history',
        command: 'kubectl rollout history deployment/checkout-api',
        output: lines(
          'deployment.apps/checkout-api',
          'REVISION  CHANGE-CAUSE',
          '410       v410: bump dependencies',
          '411       v411: add retry metrics',
          '412       v412: DB_POOL_SIZE 10 -> 20 per pod'
        ),
      },
      {
        label: 'kubectl get pods',
        command: 'kubectl get pods -l app=checkout-api',
        output: lines(
          'NAME                           READY   STATUS    RESTARTS   AGE',
          'checkout-api-6d9f7c9b8-2xkqp   1/1     Running   0          4m',
          'checkout-api-6d9f7c9b8-7hn4d   1/1     Running   0          4m',
          'checkout-api-6d9f7c9b8-9wq2s   1/1     Running   0          3m',
          'checkout-api-6d9f7c9b8-kd8xr   1/1     Running   0          3m',
          'checkout-api-6d9f7c9b8-p5m7t   1/1     Running   0          3m',
          'checkout-api-6d9f7c9b8-zt6jc   1/1     Running   0          2m'
        ),
      },
      {
        label: 'Postgres connections',
        command:
          "psql -c \"SELECT count(*) AS clients, current_setting('max_connections') AS max FROM pg_stat_activity WHERE backend_type = 'client backend';\"",
        output: lines(' clients | max', '---------+-----', '      98 | 100', '(1 row)'),
      },
      {
        label: 'App logs',
        command: 'kubectl logs deploy/checkout-api --since=5m | tail -n 2',
        output: lines(
          '14:32:07 WARN  pool: waited 5000 ms for a free connection',
          '14:32:07 ERROR GET /api/checkout 503: FATAL: remaining connection slots are reserved for roles with the SUPERUSER attribute'
        ),
      },
      {
        label: 'Host metrics',
        output: lines(
          'last 30 min      cpu        memory   iowait',
          'orders-db        31% -> 35%  61%      1%',
          'checkout-api     19% -> 22%  41%      -'
        ),
      },
    ],
    causes: [
      {
        id: 'pool',
        label: 'v412 asks for more connections than Postgres allows',
        subsystem: 'database',
      },
      { id: 'dbcpu', label: 'Postgres is CPU-bound and too slow to answer', subsystem: 'database' },
      { id: 'lock', label: 'A migration in v412 is holding a table lock', subsystem: 'database' },
      { id: 'bug', label: 'A code bug in the v412 checkout handler', subsystem: 'application' },
      { id: 'dns', label: 'The pods cannot resolve the database hostname', subsystem: 'dns' },
      { id: 'oom', label: 'The pods are being OOMKilled', subsystem: 'kubernetes' },
    ],
    correctCauseId: 'pool',
    resolution:
      'v412 raised the connection pool from 10 to 20 per pod. Six pods can now open up to 120 connections, but Postgres allows 100 and keeps 3 of them for superusers. Once the app held 97, every new connection was refused, requests waited 5 seconds for a free one and failed as 503s. Rolling back to v411, or setting DB_POOL_SIZE back to 10, fixed it.',
    lesson:
      'Treat database connections as a shared budget: pods times pool size, plus the extra pods during a rolling update, must stay below max_connections. A pooler such as PgBouncer lets the app scale out without asking Postgres for more connections.',
  },
  {
    number: 2,
    title: 'API latency is climbing and nobody deployed',
    topic: 'cron',
    severity: 'SEV3',
    page: 'api-gateway: p99 latency 2.1 s (baseline 120 ms). No deploys in 9 hours.',
    symptoms: [
      'Latency has climbed steadily for 40 minutes, not in one step.',
      'Traffic is flat compared with the same time last week.',
      'It started at about 02:50 UTC.',
    ],
    evidence: [
      {
        label: 'Change log',
        output: lines(
          'Oct 27 17:41  deploy  api-gateway v318',
          'Oct 27 18:05  config  all jobs now read DATABASE_URL (was REPORTING_DATABASE_URL)',
          'Oct 27 18:05  config  remove unused secret REPORTING_DATABASE_URL'
        ),
      },
      {
        label: 'Active queries',
        command:
          'psql -h orders-db-primary -c "SELECT pid, usename, now() - query_start AS runtime, left(query, 42) AS query FROM pg_stat_activity WHERE state = \'active\' ORDER BY runtime DESC LIMIT 4;"',
        output: lines(
          ' pid  |  usename  | runtime  |                   query',
          '------+-----------+----------+-------------------------------------------',
          " 9921 | reporting | 00:41:12 | SELECT date_trunc('day', created_at), sku,",
          ' 9930 | reporting | 00:38:40 | SELECT customer_id, count(*), sum(total) F',
          ' 1188 | api       | 00:00:03 | SELECT * FROM orders WHERE customer_id = $',
          ' 1190 | api       | 00:00:02 | SELECT id, status FROM orders WHERE id = $'
        ),
      },
      {
        label: 'Scheduled jobs',
        command: 'crontab -l -u reporting',
        output: lines(
          '# nightly analytics export',
          '50 2 * * * /opt/reporting/export.sh --all-orders'
        ),
      },
      {
        label: 'Database host metrics',
        output: lines(
          'host                cpu   iowait   read IOPS',
          'orders-db-primary   94%   31%      18,200 (normal 2,100)',
          'orders-db-replica    6%    0%         140'
        ),
      },
      {
        label: 'Cache hit rate',
        output: lines(
          'redis hit rate per 5 min   02:30 94%   02:50 94%   03:10 93%   03:30 94%',
          'same window last week      94%'
        ),
      },
    ],
    causes: [
      {
        id: 'export',
        label: 'The nightly analytics export now runs on the primary',
        subsystem: 'database',
      },
      { id: 'cpu', label: 'The database server needs more CPU', subsystem: 'database' },
      { id: 'index', label: 'An index on orders is missing', subsystem: 'database' },
      { id: 'slowq', label: 'A slow query shipped in the last deploy', subsystem: 'application' },
      { id: 'cache', label: 'The Redis cache is missing more than usual', subsystem: 'cache' },
      { id: 'bots', label: 'A traffic spike from bots', subsystem: 'network' },
    ],
    correctCauseId: 'export',
    resolution:
      'Yesterday a config cleanup pointed every job at DATABASE_URL and removed the reporting connection string. The nightly analytics export used to read from the replica; at 02:50 it ran against the primary instead. Its large aggregate queries saturated CPU and disk there, and every API query waited behind them. Fix: cancel the export queries (pg_cancel_backend), point the job back at the replica, then rerun it.',
    lesson:
      'Keep analytical queries off the transactional primary. Send them to a replica or a warehouse, and give reporting its own database role with a statement_timeout so one report cannot slow down checkout.',
  },
  {
    number: 3,
    title: 'The search-api rollout is stuck in CrashLoopBackOff',
    topic: 'kubernetes',
    severity: 'SEV3',
    page: 'search-api: rollout of v88 has not progressed for 15 minutes. 2 pods in CrashLoopBackOff.',
    symptoms: [
      'v87 pods are still serving traffic, so users see higher latency but no errors.',
      'The new pods start, run for a while, and restart.',
      'v88 adds 8 more index shards for the new catalog.',
    ],
    evidence: [
      {
        label: 'kubectl get pods',
        command: 'kubectl get pods -l app=search-api',
        output: lines(
          'NAME                          READY   STATUS             RESTARTS      AGE',
          'search-api-5f8b7d9c6-2lq8v    1/1     Running            0             3d',
          'search-api-5f8b7d9c6-r7c4n    1/1     Running            0             3d',
          'search-api-5f8b7d9c6-xv2lk    1/1     Running            0             3d',
          'search-api-7c9d5b6f4-8hx2m    0/1     CrashLoopBackOff   5 (40s ago)   14m',
          'search-api-7c9d5b6f4-q4wzt    0/1     Running            6 (12s ago)   14m'
        ),
      },
      {
        label: 'Pod events',
        command: 'kubectl describe pod search-api-7c9d5b6f4-8hx2m',
        output: lines(
          '    Last State:     Terminated',
          '      Reason:       Error',
          '      Exit Code:    143',
          'Events:',
          '  Warning  Unhealthy  95s (x18 over 14m)  kubelet  Liveness probe failed: Get "http://10.42.3.17:8080/healthz": dial tcp 10.42.3.17:8080: connect: connection refused',
          '  Normal   Killing    95s (x6 over 14m)   kubelet  Container search-api failed liveness probe, will be restarted'
        ),
      },
      {
        label: 'Logs before the restart',
        command: 'kubectl logs search-api-7c9d5b6f4-8hx2m --previous',
        output: lines(
          '09:14:02 INFO starting search-api v88',
          '09:14:02 INFO loading index shards (38)',
          '09:14:31 INFO loaded 21 of 38 shards',
          '09:14:32 INFO received SIGTERM, shutting down'
        ),
      },
      {
        label: 'Probe config',
        command: 'kubectl get deploy search-api -o yaml | grep -A7 livenessProbe',
        output: lines(
          '        livenessProbe:',
          '          httpGet:',
          '            path: /healthz',
          '            port: 8080',
          '          initialDelaySeconds: 10',
          '          periodSeconds: 10',
          '          failureThreshold: 3'
        ),
      },
      {
        label: 'Pod memory',
        output: lines(
          'pod                          version   memory   limit',
          'search-api-5f8b7d9c6-2lq8v   v87       2210Mi   4Gi',
          'search-api-7c9d5b6f4-q4wzt   v88       1630Mi   4Gi   (still loading)'
        ),
      },
    ],
    causes: [
      {
        id: 'probe',
        label: 'The liveness probe kills v88 before it finishes loading',
        subsystem: 'kubernetes',
      },
      { id: 'oom', label: 'v88 is OOMKilled while loading the index', subsystem: 'kubernetes' },
      {
        id: 'quota',
        label: 'A namespace ResourceQuota blocks the new pods',
        subsystem: 'kubernetes',
      },
      { id: 'crash', label: 'v88 crashes with an exception at startup', subsystem: 'application' },
      { id: 'image', label: 'The registry cannot serve the v88 image', subsystem: 'ci-cd' },
      { id: 'storage', label: 'The pods cannot reach the index storage', subsystem: 'network' },
    ],
    correctCauseId: 'probe',
    resolution:
      'v88 loads 38 index shards instead of 30 and needs about a minute before it listens on port 8080. The liveness probe starts after 10 seconds and restarts the container after three failed checks, about 30 seconds in. The pod gets SIGTERM (exit code 143) while still loading, so v88 never finishes starting and the rollout stalls on the old pods. Fix: add a startupProbe (for example periodSeconds 5 and failureThreshold 30) so the liveness probe only begins once the app is up.',
    lesson:
      'Liveness probes are for apps that hang, not for apps that start slowly. Give slow starters a startupProbe, and check startup time whenever a release loads more data at boot.',
  },
  {
    number: 4,
    title: 'Some users cannot reach the site after the DNS move',
    topic: 'dns',
    severity: 'SEV1',
    page: 'status checks: www.example.com unreachable from 3 of 5 probe locations. Support tickets say "server not found".',
    symptoms: [
      'DNS hosting moved to a new provider yesterday at 16:00. The registrar lists the new name servers.',
      'The site works from the office network.',
      'Users on large public resolvers cannot resolve the name at all.',
    ],
    evidence: [
      {
        label: 'dig via a public resolver',
        command: 'dig www.example.com @198.51.100.53',
        output: lines(
          ';; ->>HEADER<<- opcode: QUERY, status: SERVFAIL, id: 40211',
          ';; flags: qr rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 0, ADDITIONAL: 1',
          ';; OPT PSEUDOSECTION:',
          '; EDNS: version: 0, flags:; udp: 1232',
          '; EDE: 9 (DNSKEY Missing)'
        ),
      },
      {
        label: 'dig with checking disabled',
        command: 'dig +cd www.example.com @198.51.100.53',
        output: lines(
          ';; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 5121',
          ';; ANSWER SECTION:',
          'www.example.com.   300   IN   A   203.0.113.10'
        ),
      },
      {
        label: 'DS and DNSKEY',
        command: 'dig +short DS example.com; dig DNSKEY example.com +multiline +noall +answer',
        output: lines(
          '31589 13 2 D30EEC6C142BA05528FE621F4A9D2924DCDE2A06D3EE1C4F979C9EEF E719A1F3',
          'example.com. 3600 IN DNSKEY 257 3 13 (',
          '        BOKcTiVsbfC1u0ByqEpwUSn7d49/5P5FZ511V0Jz0bREdrAAtoas9kn46D/y',
          '        h43jXc4ZYZAlfH/F2BjOjgXq5w==',
          '        ) ; KSK; alg = ECDSAP256SHA256 ; key id = 15928'
        ),
      },
      {
        label: 'Name servers',
        command: 'dig +short NS example.com',
        output: lines('ns1.new-dns.example.net.', 'ns2.new-dns.example.net.'),
      },
      {
        label: 'Office resolver',
        command: 'resolvectl status | grep -E "DNS Servers|DNSSEC"',
        output: lines('       DNSSEC setting: no', '          DNS Servers: 10.0.0.2'),
      },
    ],
    causes: [
      {
        id: 'ds',
        label: "The registrar still publishes a DS record for the old provider's key",
        subsystem: 'dns',
      },
      { id: 'ttl', label: 'Resolvers still cache the old name servers', subsystem: 'dns' },
      { id: 'record', label: 'The new zone is missing the www record', subsystem: 'dns' },
      { id: 'cert', label: 'The TLS certificate does not cover www', subsystem: 'tls' },
      { id: 'lb', label: 'The load balancer at 203.0.113.10 is down', subsystem: 'network' },
      { id: 'fw', label: 'A firewall blocks users outside the office', subsystem: 'network' },
    ],
    correctCauseId: 'ds',
    resolution:
      'The old provider signed the zone with DNSSEC, and the registrar still publishes a DS record for the old key (key tag 31589). The new provider signs with a different key (15928). Resolvers that validate DNSSEC cannot build a chain of trust from the DS to a DNSKEY, so they return SERVFAIL. The office resolver does not validate, so it works, and dig +cd (checking disabled) gets an answer. Fix: publish the new DS at the registrar, or remove the DS to serve the zone unsigned, and wait for the old DS TTL to expire.',
    lesson:
      'Moving a signed zone needs a DNSSEC plan: publish the new DS before the switch, or remove the DS and wait out its TTL first. If dig +cd answers while a normal query gets SERVFAIL, look at DNSSEC.',
  },
  {
    number: 5,
    title: 'Mobile apps fail after the certificate was replaced',
    topic: 'tls',
    severity: 'SEV2',
    page: 'api.example.com: TLS handshake errors from mobile clients up 40x since 11:05.',
    symptoms: [
      'The certificate for api.example.com was replaced by hand at 11:00.',
      'The website works in desktop browsers.',
      "Android users and a partner's webhook sender report TLS errors.",
    ],
    evidence: [
      {
        label: 'curl',
        command: 'curl -sS https://api.example.com/health',
        output: 'curl: (60) SSL certificate problem: unable to get local issuer certificate',
      },
      {
        label: 'openssl s_client',
        command:
          'openssl s_client -connect api.example.com:443 -servername api.example.com </dev/null',
        output: lines(
          'Certificate chain',
          ' 0 s:CN = api.example.com',
          '   i:C = US, O = Example Trust, CN = Example Trust RSA CA 2',
          '---',
          'Verify return code: 21 (unable to verify the first certificate)'
        ),
      },
      {
        label: 'Certificate dates and name',
        command: 'openssl x509 -in /etc/nginx/tls/api.crt -noout -subject -dates',
        output: lines(
          'subject=CN = api.example.com',
          'notBefore=Oct 27 00:00:00 2026 GMT',
          'notAfter=Jan 25 23:59:59 2027 GMT'
        ),
      },
      {
        label: 'nginx TLS config',
        command:
          "grep ssl_certificate /etc/nginx/sites-enabled/api.conf; grep -c 'BEGIN CERTIFICATE' /etc/nginx/tls/api.crt",
        output: lines(
          '    ssl_certificate     /etc/nginx/tls/api.crt;',
          '    ssl_certificate_key /etc/nginx/tls/api.key;',
          '1'
        ),
      },
      {
        label: 'Desktop browser',
        output:
          'Connection is secure. Certificate issued to api.example.com, valid until Jan 25, 2027.',
      },
    ],
    causes: [
      {
        id: 'chain',
        label: 'The server sends the certificate without its intermediate',
        subsystem: 'tls',
      },
      { id: 'expired', label: 'The new certificate has already expired', subsystem: 'tls' },
      { id: 'name', label: 'The certificate does not match api.example.com', subsystem: 'tls' },
      { id: 'dns', label: 'api.example.com points at the wrong server', subsystem: 'dns' },
      { id: 'fw', label: "A firewall blocks the partner's IP range", subsystem: 'network' },
      { id: 'app', label: 'The API returns errors for webhook requests', subsystem: 'application' },
    ],
    correctCauseId: 'chain',
    resolution:
      'The new certificate was installed as the leaf only. Nginx sends what is in the file, so clients get the leaf without the intermediate certificate that links it to a trusted root. Desktop browsers fill the gap themselves (they cache intermediates or fetch them from the AIA URL), but curl, mobile apps and most server-side HTTP clients do not, so they fail with "unable to get local issuer certificate". Fix: serve the full chain, leaf first and then the intermediate (for example fullchain.pem), and reload nginx.',
    lesson:
      'Test a new certificate with openssl s_client or curl, not only a browser. Automate renewal so the tool writes the full chain for you.',
  },
  {
    number: 6,
    title: 'A trickle of 502s that nobody can reproduce',
    topic: 'networking',
    severity: 'SEV3',
    page: 'orders-api: 502 rate 0.4% for 2 hours. Error budget burn alert.',
    symptoms: [
      'The 502s are spread evenly across all pods and never show up in the app logs.',
      'They are more common at quiet times than at peak.',
      'Last week the service moved from VMs behind nginx to containers behind the cloud load balancer.',
    ],
    evidence: [
      {
        label: 'Load balancer log',
        output: lines(
          '03:12:44 POST /v1/orders       lb_status=502 backend_status=- reason="backend closed connection"',
          '03:14:02 GET  /v1/orders/8812  lb_status=502 backend_status=- reason="backend closed connection"'
        ),
      },
      {
        label: 'Load balancer settings',
        output: lines(
          'listener 443 -> backend pool orders-api:3000',
          'idle timeout       60 s',
          'connection reuse   on (HTTP keep-alive to backends)',
          'health check       GET /healthz every 10 s, 6/6 healthy'
        ),
      },
      {
        label: 'App server timeouts',
        command:
          'grep -rn keepAliveTimeout src/; node -p "require(\'http\').createServer().keepAliveTimeout"',
        output: lines('(no matches)', '5000'),
      },
      {
        label: 'App logs',
        command: "kubectl logs -l app=orders-api --since=2h --tail=-1 | grep -c ' 5[0-9][0-9] '",
        output: '0',
      },
      {
        label: 'tcpdump on a pod',
        command: 'tcpdump -nn -i eth0 port 3000',
        output: lines(
          '03:12:39.087 IP 10.0.4.12.3000 > 10.0.1.7.41022: Flags [P.], seq 17010:18240, ack 3305, length 1230',
          '03:12:44.101 IP 10.0.4.12.3000 > 10.0.1.7.41022: Flags [F.], seq 18240, ack 3305, length 0',
          '03:12:44.101 IP 10.0.1.7.41022 > 10.0.4.12.3000: Flags [P.], seq 3305:3717, ack 18240, length 412',
          '03:12:44.102 IP 10.0.4.12.3000 > 10.0.1.7.41022: Flags [R], seq 18241, win 0, length 0'
        ),
      },
    ],
    causes: [
      {
        id: 'keepalive',
        label: 'The app closes idle connections sooner than the load balancer does',
        subsystem: 'network',
      },
      {
        id: 'health',
        label: 'Failing health checks briefly take pods out of the pool',
        subsystem: 'network',
      },
      {
        id: 'conntrack',
        label: 'The node conntrack table is full and drops packets',
        subsystem: 'network',
      },
      { id: 'crash', label: 'Pods crash and restart under load', subsystem: 'kubernetes' },
      { id: 'exception', label: 'An unhandled exception in the app', subsystem: 'application' },
      { id: 'dns', label: 'The load balancer uses stale DNS for the pods', subsystem: 'dns' },
    ],
    correctCauseId: 'keepalive',
    resolution:
      "Node's HTTP server closes an idle keep-alive connection after about 5 seconds (keepAliveTimeout defaults to 5000 ms), as the tcpdump shows. The load balancer keeps idle backend connections for 60 seconds and reuses them. Now and then it sends a request on a connection at the same moment the app closes it: the app answers with a reset and the load balancer returns 502. It is worse at quiet times because connections sit idle longer. Fix: make the backend keep-alive timeout longer than the load balancer idle timeout, for example server.keepAliveTimeout = 65000 with headersTimeout a little higher.",
    lesson:
      'On every hop that reuses connections, the server side must keep idle connections open longer than the client side. Check these timeouts whenever a proxy or load balancer changes.',
  },
  {
    number: 7,
    title: 'billing-worker restarts with exit code 137 and no Java error',
    topic: 'memory',
    severity: 'SEV2',
    page: 'billing-worker: 14 restarts in the last hour. Invoice queue growing.',
    symptoms: [
      "The restarts began after yesterday's change to the pod spec.",
      'The Java logs show no OutOfMemoryError before a restart.',
      'Restarts happen during big invoice runs.',
    ],
    evidence: [
      {
        label: 'kubectl describe pod',
        command: 'kubectl describe pod billing-worker-7d4f9c-5xkq2',
        output: lines(
          '    Last State:     Terminated',
          '      Reason:       OOMKilled',
          '      Exit Code:    137',
          '    Limits:',
          '      memory:  2Gi',
          '    Requests:',
          '      memory:  2Gi'
        ),
      },
      {
        label: 'JVM options',
        command:
          "kubectl get deploy billing-worker -o jsonpath='{.spec.template.spec.containers[0].env}'",
        output:
          '[{"name":"JAVA_TOOL_OPTIONS","value":"-Xms2g -Xmx2g -XX:NativeMemoryTracking=summary"}]',
      },
      {
        label: 'Pod spec history',
        command: 'git log --oneline -3 -- deploy/billing-worker.yaml',
        output: lines(
          '9c1e2aa lower memory limit 3Gi -> 2Gi to save costs',
          '51d07f3 set heap to 2g',
          '0be4417 add billing-worker'
        ),
      },
      {
        label: 'JVM native memory',
        command: 'jcmd 1 VM.native_memory summary scale=MB',
        output: lines(
          'Total: reserved=3644MB, committed=2391MB',
          '-                 Java Heap (reserved=2048MB, committed=2048MB)',
          '-                     Class (reserved=1031MB, committed=19MB)',
          '-                    Thread (reserved=91MB, committed=91MB)',
          '-                      Code (reserved=245MB, committed=37MB)',
          '-                        GC (reserved=101MB, committed=101MB)'
        ),
      },
      {
        label: 'Node memory',
        command: 'kubectl top node node-a3',
        output: lines(
          'NAME      CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%',
          'node-a3   1210m        30%    7012Mi          44%'
        ),
      },
    ],
    causes: [
      {
        id: 'heap',
        label: 'A 2 GiB heap plus JVM overhead does not fit a 2 GiB limit',
        subsystem: 'kubernetes',
      },
      {
        id: 'eviction',
        label: 'The node is short of memory and evicts the pod',
        subsystem: 'kubernetes',
      },
      {
        id: 'probe',
        label: 'The liveness probe times out during big runs',
        subsystem: 'kubernetes',
      },
      { id: 'leak', label: 'A memory leak in the invoice code', subsystem: 'application' },
      { id: 'db', label: 'The database kills long transactions', subsystem: 'database' },
      { id: 'queue', label: 'The queue redelivers invoices too fast', subsystem: 'queue' },
    ],
    correctCauseId: 'heap',
    resolution:
      '-Xmx2g sets only the heap. The JVM also needs memory for metaspace, thread stacks, the JIT code cache, garbage collector data and direct buffers. When the limit dropped from 3Gi to 2Gi, heap plus everything else went over 2Gi during big runs, and the kernel OOM killer ended the process with SIGKILL (exit code 137). The JVM never saw an allocation fail, so it logged no OutOfMemoryError. Fix: raise the limit back, or size the heap below it, for example replace -Xms2g -Xmx2g with -XX:MaxRAMPercentage=75.',
    lesson:
      'A container memory limit covers the whole process, not just the heap. Leave at least a quarter of the limit for non-heap memory, and let the JVM size the heap from the container limit.',
  },
  {
    number: 8,
    title: 'Order events pile up while every consumer is busy',
    topic: 'queues',
    severity: 'SEV2',
    page: 'fulfilment: consumer lag 1.2M on order-events and rising. Shipping is 40 minutes behind.',
    symptoms: [
      'Lag started climbing at 10:20.',
      'The consumer pods are running and not restarting.',
      'A release at 10:15 added an address check to each order.',
    ],
    evidence: [
      {
        label: 'Consumer group',
        command:
          'kafka-consumer-groups.sh --bootstrap-server kafka:9092 --describe --group fulfilment',
        output: "Warning: Consumer group 'fulfilment' is rebalancing.",
      },
      {
        label: 'Consumer logs',
        command: "kubectl logs deploy/fulfilment --since=15m | grep -Ei 'poll|LeaveGroup'",
        output: lines(
          '10:27:41 WARN [Consumer clientId=fulfilment-2, groupId=fulfilment] consumer poll timeout has expired. This means the time between subsequent calls to poll() was longer than the configured max.poll.interval.ms, which typically implies that the poll loop is spending too much time processing messages.',
          '10:27:41 INFO [Consumer clientId=fulfilment-2, groupId=fulfilment] Member fulfilment-2-4c1e sending LeaveGroup request to coordinator kafka-1:9092'
        ),
      },
      {
        label: 'Consumer config',
        output: lines(
          'max.poll.records = 500',
          'max.poll.interval.ms = 300000',
          'enable.auto.commit = false   # offsets committed after each batch'
        ),
      },
      {
        label: 'Processing time',
        output: lines(
          'address check   p50 640 ms   p99 1.9 s   (one call per order, one at a time)',
          'records per poll   500'
        ),
      },
      {
        label: 'Broker health',
        output: lines(
          'brokers online 3/3   under-replicated partitions 0',
          'broker cpu 22%   disk 41%   request latency p99 8 ms'
        ),
      },
    ],
    causes: [
      {
        id: 'poll',
        label: 'Each batch takes longer than max.poll.interval.ms, so consumers drop out',
        subsystem: 'queue',
      },
      {
        id: 'partitions',
        label: 'The topic has too few partitions for the load',
        subsystem: 'queue',
      },
      { id: 'broker', label: 'A Kafka broker is down', subsystem: 'queue' },
      { id: 'api', label: 'The address check API is down', subsystem: 'third-party' },
      { id: 'db', label: 'The orders database is locked', subsystem: 'database' },
      { id: 'oom', label: 'The consumers are OOMKilled', subsystem: 'kubernetes' },
    ],
    correctCauseId: 'poll',
    resolution:
      'The release added an address check for every order, about 640 ms each, done one at a time. A poll returns up to 500 records, so one batch now takes more than 5 minutes, longer than max.poll.interval.ms (300000). The consumer is removed from the group, the group rebalances, the uncommitted batch is processed again by another consumer, and the cycle repeats. Every consumer stays busy while lag grows. Fix: lower max.poll.records (for example to 50), run the checks in parallel or cache them, and only then think about raising max.poll.interval.ms.',
    lesson:
      'max.poll.records times the worst time per record must stay well under max.poll.interval.ms. When you add a slow call to a consumer, measure the time per batch, not just per message.',
  },
  {
    number: 9,
    title: 'Search is down for everyone and nothing was deployed',
    topic: 'feature-flags',
    severity: 'SEV1',
    page: 'search: error rate 100% since 15:42. No deploys today.',
    symptoms: [
      'Errors started at 15:42 for every user at once.',
      'The deploy log has no code or infrastructure changes today.',
      'The search page shows "Search is unavailable".',
    ],
    evidence: [
      {
        label: 'App logs',
        command: 'kubectl logs deploy/web --since=10m | grep search',
        output: lines(
          '15:42:09 ERROR search request failed: dial tcp 10.0.8.21:9200: connect: connection refused',
          '15:42:09 ERROR search request failed: dial tcp 10.0.8.21:9200: connect: connection refused'
        ),
      },
      {
        label: 'Search hosts',
        command: 'dig +short search.internal; dig +short search-legacy.internal',
        output: lines('10.0.9.40', '10.0.8.21'),
      },
      {
        label: 'Search client code',
        output: lines(
          "const useNewSearch = flags.boolVariation('use-new-search', user, false);",
          "const host = useNewSearch ? 'search.internal' : 'search-legacy.internal';"
        ),
      },
      {
        label: 'Flag audit log',
        output: lines(
          '15:41  j.doe  use-new-search  archived  "at 100% for 11 months, cleanup"',
          '14:05  j.doe  dark-mode-beta  archived  "experiment over"'
        ),
      },
      {
        label: 'Flag SDK status',
        output: 'connected, last update 15:41:30, 211 flags (was 212)',
      },
    ],
    causes: [
      {
        id: 'archived',
        label: 'An archived flag now returns its default and routes to the old cluster',
        subsystem: 'application',
      },
      {
        id: 'flagsvc',
        label: 'The flag service is down, so the app cannot load flags',
        subsystem: 'application',
      },
      {
        id: 'targeting',
        label: 'A typo in the flag targeting rules',
        subsystem: 'application',
      },
      { id: 'cluster', label: 'The new search cluster is down', subsystem: 'database' },
      { id: 'dns', label: 'search.internal resolves to the wrong address', subsystem: 'dns' },
      { id: 'fw', label: 'A firewall rule blocks port 9200', subsystem: 'network' },
    ],
    correctCauseId: 'archived',
    resolution:
      'The use-new-search flag had served true to everyone for 11 months, so someone archived it as cleanup. The code still reads the flag, with a default of false. Once the flag was gone, every evaluation returned false and sent searches to search-legacy, a cluster that was switched off last month. Fix: restore the flag, then remove the flag check from the code and deploy before archiving it again.',
    lesson:
      'Retire a flag in two steps: first remove the code that reads it and deploy, then archive the flag. Make sure a default is safe today, not just on the day the flag was created.',
  },
  {
    number: 10,
    title: 'Rolled back, still broken',
    topic: 'deploys',
    severity: 'SEV1',
    page: 'accounts-api: 5xx 35% after v52. Rolled back to v51 at 09:20, errors continue.',
    symptoms: [
      'v52 went out at 09:05 and errors began within a minute.',
      'The on-call engineer rolled back to v51 at 09:20. Errors did not drop.',
      'Only profile reads and writes fail. Login works.',
    ],
    evidence: [
      {
        label: 'App logs (v51)',
        command: 'kubectl logs deploy/accounts-api --since=5m | tail -n 2',
        output: lines(
          '09:24:13 ERROR GET /profile 500: ERROR:  column users.display_name does not exist',
          'LINE 1: SELECT users.id, users.display_name, users.email FROM users WHERE ...'
        ),
      },
      {
        label: 'Migration log (v52)',
        output: lines(
          '== 20261028090100 RenameDisplayNameToFullName: migrating ==',
          '-- rename_column(:users, :display_name, :full_name)',
          '== 20261028090100 RenameDisplayNameToFullName: migrated (0.0123s) =='
        ),
      },
      {
        label: 'users table',
        command: "psql -c '\\d users'",
        output: lines(
          '                         Table "public.users"',
          '   Column   |           Type           | Collation | Nullable | Default',
          '------------+--------------------------+-----------+----------+---------',
          ' id         | bigint                   |           | not null |',
          ' email      | text                     |           | not null |',
          ' full_name  | text                     |           |          |',
          ' created_at | timestamp with time zone |           | not null | now()'
        ),
      },
      {
        label: 'Running image',
        command:
          'kubectl get pods -l app=accounts-api -o jsonpath="{.items[*].spec.containers[*].image}" | tr " " "\\n" | sort | uniq -c',
        output: '      4 registry.example.com/accounts-api:v51',
      },
      {
        label: 'Database health',
        output: 'accounts-db  cpu 12%  connections 41/200  no lock waits  replication lag 0 s',
      },
    ],
    causes: [
      {
        id: 'migration',
        label: "v52's migration renamed a column that v51 still reads",
        subsystem: 'database',
      },
      { id: 'overload', label: 'The database is overloaded', subsystem: 'database' },
      {
        id: 'lock',
        label: 'The migration still holds a lock on users',
        subsystem: 'database',
      },
      { id: 'rollout', label: 'The rollback did not reach every pod', subsystem: 'kubernetes' },
      { id: 'cache', label: 'A cache still serves v52 responses', subsystem: 'cache' },
      { id: 'oldbug', label: 'A bug in v51 that was always there', subsystem: 'application' },
    ],
    correctCauseId: 'migration',
    resolution:
      'v52 shipped a migration that renamed users.display_name to full_name. Migrations do not roll back with the code, so going back to v51 left the renamed column in place, and v51 still selects display_name. Fix forward: roll out v52 again, or run a migration that renames the column back. The safe pattern is expand and contract: add full_name, write to both, backfill, switch reads, and drop display_name in a later release.',
    lesson:
      'A rollback only works if the previous version runs against the new schema. Keep every schema change backward compatible for at least one release.',
  },
  {
    number: 11,
    title: 'Users are logged out and cannot log back in',
    topic: 'caching',
    severity: 'SEV1',
    page: 'auth: login success rate 12% (normal 97%) since 07:58.',
    symptoms: [
      'Some existing sessions still work. New logins fail.',
      'Sessions are stored in Redis.',
      'A marketing email went out at 07:30.',
    ],
    evidence: [
      {
        label: 'App logs',
        command: 'kubectl logs deploy/auth --since=5m | grep -m2 ERROR',
        output: lines(
          "07:58:12 ERROR session store: OOM command not allowed when used memory > 'maxmemory'.",
          '07:58:12 ERROR POST /login 500: could not save session'
        ),
      },
      {
        label: 'Redis memory',
        command:
          "redis-cli INFO memory | grep -E 'used_memory_human|maxmemory_human|maxmemory_policy'",
        output: lines(
          'used_memory_human:3.99G',
          'maxmemory_human:4.00G',
          'maxmemory_policy:noeviction'
        ),
      },
      {
        label: 'Redis keyspace',
        command: 'redis-cli INFO keyspace',
        output: lines('# Keyspace', 'db0:keys=18234011,expires=0,avg_ttl=0'),
      },
      {
        label: 'Session store history',
        command: 'git log --oneline -3 -- src/session/store.ts',
        output: lines(
          'a41c9de store sessions as hashes (HSET) for partial updates  (3 weeks ago)',
          '72b0e15 session TTL 14 days',
          '1f0c2d8 add Redis session store'
        ),
      },
      {
        label: 'Login traffic',
        output: 'login attempts per minute: 1,140 (same hour last week: 1,030)',
      },
    ],
    causes: [
      {
        id: 'nottl',
        label: 'Sessions are written without a TTL, so Redis filled up',
        subsystem: 'cache',
      },
      { id: 'small', label: 'Redis is too small for the campaign traffic', subsystem: 'cache' },
      { id: 'evict', label: 'Redis is evicting sessions too eagerly', subsystem: 'cache' },
      { id: 'password', label: 'A bug in the password check', subsystem: 'application' },
      { id: 'db', label: 'The users database is down', subsystem: 'database' },
      { id: 'dns', label: 'The app cannot resolve the Redis host', subsystem: 'dns' },
    ],
    correctCauseId: 'nottl',
    resolution:
      'Three weeks ago session storage moved from SETEX (a value with a 14 day TTL) to HSET, which sets no expiry. Since then no session has expired. Today Redis reached maxmemory, and with the noeviction policy it rejects every write with an OOM error. Reads still work, so some existing sessions survive, but new logins cannot save a session. Fix: write HSET and EXPIRE together in MULTI/EXEC (or a Lua script) so no session is left without a TTL, delete old session keys in batches to free memory now (or raise maxmemory for a while), and alert on memory use well before the limit.',
    lesson:
      'Every session or cache key needs a TTL. In INFO keyspace, a large keys count with expires=0 is a warning sign.',
  },
  {
    number: 12,
    title: 'Everyone is getting 429 Too Many Requests',
    topic: 'rate-limits',
    severity: 'SEV2',
    page: 'public-api: 429 responses are 94% of traffic since 13:10.',
    symptoms: [
      'Traffic volume is normal for this hour.',
      'Customers in different countries hit the limit at the same time.',
      'The platform team finished an ingress migration at 13:05.',
    ],
    evidence: [
      {
        label: 'Rate limiter log',
        output: lines(
          '13:12:01 limiter key=ip:10.0.3.17 count=1201/1000 per 60s -> 429',
          '13:12:01 limiter key=ip:10.0.3.17 count=1202/1000 per 60s -> 429',
          '13:12:02 limiter key=ip:10.0.3.18 count=1187/1000 per 60s -> 429'
        ),
      },
      {
        label: 'Request sample',
        output: lines('remote_addr       10.0.3.17', 'X-Forwarded-For   198.51.100.24'),
      },
      {
        label: 'Limiter config',
        output: lines('rate_limit:', '  key: remote_addr', '  limit: 1000', '  window: 60s'),
      },
      {
        label: 'Ingress pods',
        command:
          'kubectl get pods -n ingress -o custom-columns=NAME:.metadata.name,IP:.status.podIP',
        output: lines(
          'NAME                   IP',
          'ingress-7f9c4d-2kq9z   10.0.3.17',
          'ingress-7f9c4d-x8mwd   10.0.3.18'
        ),
      },
      {
        label: 'Traffic',
        output: 'requests per minute: 31,400 (same hour last week: 30,900)',
      },
    ],
    causes: [
      {
        id: 'key',
        label: 'The limiter counts requests per proxy address, not per client',
        subsystem: 'application',
      },
      {
        id: 'limit',
        label: 'The limit is set too low for normal traffic',
        subsystem: 'application',
      },
      { id: 'bot', label: 'A bot is flooding the API', subsystem: 'network' },
      { id: 'partner', label: 'A partner integration retries in a loop', subsystem: 'third-party' },
      { id: 'ingress', label: 'The new ingress pods are overloaded', subsystem: 'kubernetes' },
      { id: 'redis', label: "The limiter's Redis lost its counters", subsystem: 'cache' },
    ],
    correctCauseId: 'key',
    resolution:
      'Before the migration, clients connected straight to the API, so remote_addr was the client address. Now every request arrives from one of two ingress pods, so the limiter puts all users into two buckets of 1000 requests a minute. Only about 2,000 of 31,400 requests a minute get through, and the rest get 429. Fix: key the limiter on the client IP from X-Forwarded-For, trusting only the hops you run, or on an API key or user ID.',
    lesson:
      'When you add a proxy, check everything that uses the client IP: rate limits, allow lists, audit logs and geo rules. Only trust X-Forwarded-For entries added by your own proxies.',
  },
  {
    number: 13,
    title: 'The main branch build broke overnight with no commits',
    topic: 'ci-cd',
    severity: 'SEV3',
    page: 'CI: main pipeline failing since 06:00. 14 pull requests blocked.',
    symptoms: [
      'The last green build was yesterday at 18:40.',
      'The failing step is the Docker image build.',
      'No commit changed the Dockerfile or requirements.txt.',
    ],
    evidence: [
      {
        label: 'Build log',
        output: lines(
          '#7 [3/6] RUN pip install --no-cache-dir -r requirements.txt',
          '#7 12.81   Building wheel for orderhash (pyproject.toml): started',
          "#7 13.40   error: command 'gcc' failed: No such file or directory",
          '#7 13.42   ERROR: Failed building wheel for orderhash'
        ),
      },
      {
        label: 'Dockerfile',
        output: lines(
          'FROM python:3-slim',
          'WORKDIR /app',
          'COPY requirements.txt .',
          'RUN pip install --no-cache-dir -r requirements.txt'
        ),
      },
      {
        label: 'Python version per build',
        output: lines(
          'yesterday 18:40 (green)   Python 3.14.3',
          'today 06:00 (red)         Python 3.15.0'
        ),
      },
      {
        label: 'Wheels for orderhash',
        command:
          'pip download orderhash==2.1.0 --no-deps --only-binary=:all: --python-version 3.15 -d /tmp/w',
        output: lines(
          'ERROR: Could not find a version that satisfies the requirement orderhash==2.1.0 (from versions: none)',
          '# the same command with --python-version 3.14 saves orderhash-2.1.0-cp314-cp314-manylinux_2_28_x86_64.whl'
        ),
      },
      {
        label: 'Runner health',
        output: 'runner disk 38% used, gcc 14.2 installed on the runner host, docker 28.4',
      },
    ],
    causes: [
      {
        id: 'tag',
        label: 'The python:3-slim tag moved to a new Python version',
        subsystem: 'ci-cd',
      },
      { id: 'cache', label: 'The CI cache is corrupted', subsystem: 'ci-cd' },
      { id: 'runner', label: 'A runner update removed gcc', subsystem: 'ci-cd' },
      { id: 'registry', label: 'The package index is down', subsystem: 'third-party' },
      { id: 'tests', label: 'A commit broke the tests', subsystem: 'application' },
      { id: 'disk', label: 'The runner is out of disk', subsystem: 'host' },
    ],
    correctCauseId: 'tag',
    resolution:
      'The Dockerfile uses python:3-slim, a tag that follows every new Python release. Overnight it moved to 3.15. One dependency, orderhash, only publishes wheels for 3.14, so pip fell back to building it from source, and the slim image has no compiler. The runner has gcc, but the build runs inside the image. Fix: pin the base image to a minor version (python:3.14-slim) or a digest, and move to 3.15 on purpose in a pull request once your dependencies support it.',
    lesson:
      'Pin base images to a version or a digest and let an update bot open pull requests for new ones. A floating tag lets your build change without a commit.',
  },
  {
    number: 14,
    title: 'Every query on orders hangs after a tiny migration',
    topic: 'database',
    severity: 'SEV1',
    page: 'orders-api: p99 30 s (timeout), throughput down 90% since 11:02.',
    symptoms: [
      'A migration that adds a nullable column to orders started at 11:02.',
      'It is still running. It should take milliseconds.',
      'Database CPU is low.',
    ],
    evidence: [
      {
        label: 'Sessions on orders',
        command:
          'psql -c "SELECT pid, state, wait_event_type AS wait, now() - xact_start AS xact_age, left(query, 46) AS query FROM pg_stat_activity WHERE datname = \'shop\' ORDER BY xact_start LIMIT 4;"',
        output: lines(
          ' pid  |        state        |  wait  | xact_age |                     query',
          '------+---------------------+--------+----------+-----------------------------------------------',
          ' 4120 | idle in transaction | Client | 02:18:42 | SELECT * FROM orders WHERE id = 991 FOR UPDATE',
          ' 5333 | active              | Lock   | 00:04:51 | ALTER TABLE orders ADD COLUMN gift_note text',
          ' 5340 | active              | Lock   | 00:04:50 | SELECT * FROM orders WHERE customer_id = $1',
          ' 5341 | active              | Lock   | 00:04:50 | SELECT * FROM orders WHERE id = $1'
        ),
      },
      {
        label: 'Who blocks whom',
        command:
          'psql -c "SELECT pid, pg_blocking_pids(pid) FROM pg_stat_activity WHERE wait_event_type = \'Lock\' LIMIT 3;"',
        output: lines(
          ' pid  | pg_blocking_pids',
          '------+------------------',
          ' 5333 | {4120}',
          ' 5340 | {5333}',
          ' 5341 | {5333}'
        ),
      },
      {
        label: 'Session 4120',
        command:
          'psql -c "SELECT usename, application_name, client_addr, backend_start FROM pg_stat_activity WHERE pid = 4120;"',
        output: lines(
          ' usename | application_name | client_addr |     backend_start',
          '---------+------------------+-------------+------------------------',
          ' j.doe   | psql             | 10.0.12.5   | 2026-10-28 08:47:51+00'
        ),
      },
      {
        label: 'Migration settings',
        command: 'grep -rn -E "lock_timeout|statement_timeout" db/ config/database.yml',
        output: '(no matches)',
      },
      {
        label: 'Database host metrics',
        output: 'orders-db  cpu 9%  iops normal  replication lag 0 s  deadlocks 0',
      },
    ],
    causes: [
      {
        id: 'lockq',
        label:
          'The ALTER waits behind an open transaction, and every query queues behind the ALTER',
        subsystem: 'database',
      },
      {
        id: 'rewrite',
        label: 'The ALTER TABLE is rewriting the whole table',
        subsystem: 'database',
      },
      { id: 'deadlock', label: 'Two app transactions are deadlocked', subsystem: 'database' },
      { id: 'pool', label: 'The app connection pool is too small', subsystem: 'application' },
      { id: 'loss', label: 'Packet loss between the app and the database', subsystem: 'network' },
      { id: 'cpu', label: 'The database host is out of CPU', subsystem: 'host' },
    ],
    correctCauseId: 'lockq',
    resolution:
      "Just before 08:49 someone opened psql, ran SELECT ... FOR UPDATE inside a transaction and left it open. That transaction holds a lock on orders. ALTER TABLE needs an ACCESS EXCLUSIVE lock, so it waits for the transaction to end. Postgres grants locks in queue order, so every later query on orders, even a plain SELECT, waits behind the ALTER. Fix: end session 4120 (pg_terminate_backend). The ALTER finishes at once and the queue drains. Prevent it with SET lock_timeout = '5s' in migrations, retried later on failure, and with idle_in_transaction_session_timeout.",
    lesson:
      'A migration that runs in milliseconds can still stop all traffic while it waits for its lock. Always set lock_timeout for schema changes, and do not leave interactive transactions open on production.',
  },
  {
    number: 15,
    title: 'Customers got the same invoice email three times',
    topic: 'cron',
    severity: 'SEV2',
    page: 'support: 80 tickets in 30 minutes about duplicate invoice emails.',
    symptoms: [
      'The invoice mailer runs every 10 minutes as a Kubernetes CronJob.',
      'It has run that way for a year without problems.',
      "This morning's billing run created far more invoices than usual.",
    ],
    evidence: [
      {
        label: 'kubectl get jobs',
        command: 'kubectl get jobs -l app=invoice-mailer',
        output: lines(
          'NAME                      STATUS    COMPLETIONS   DURATION   AGE',
          'invoice-mailer-29886300   Running   0/1           27m        27m',
          'invoice-mailer-29886310   Running   0/1           17m        17m',
          'invoice-mailer-29886320   Running   0/1           7m         7m'
        ),
      },
      {
        label: 'CronJob spec',
        command:
          'kubectl get cronjob invoice-mailer -o yaml | grep -E "schedule|concurrencyPolicy"',
        output: lines('  concurrencyPolicy: Allow', '  schedule: "*/10 * * * *"'),
      },
      {
        label: 'Job logs',
        command: 'kubectl logs job/invoice-mailer-29886310 | head -n 4',
        output: lines(
          "09:10:02 selecting invoices WHERE status = 'ready' AND emailed_at IS NULL",
          '09:10:03 found 41,882 invoices (usual run: about 4,000)',
          '09:10:03 emailed_at will be set when the batch completes',
          '09:10:05 sending INV-77120 to billing@customer-4410.example'
        ),
      },
      {
        label: 'Run durations',
        output: lines(
          'last 30 days   p50 2m 50s   max 3m 40s',
          'today          27m and still running'
        ),
      },
      {
        label: 'Mail provider',
        output: 'accepted 126,104 messages today, 0 deferred, 0 retried by the provider',
      },
    ],
    causes: [
      {
        id: 'overlap',
        label: 'Runs now take longer than 10 minutes, overlap, and pick the same invoices',
        subsystem: 'scheduler',
      },
      {
        id: 'schedule',
        label: 'The schedule was changed to run every minute',
        subsystem: 'scheduler',
      },
      { id: 'dst', label: 'A clock change made the job run twice', subsystem: 'scheduler' },
      { id: 'provider', label: 'The mail provider delivered duplicates', subsystem: 'third-party' },
      {
        id: 'template',
        label: 'A bug in the email template sends three copies',
        subsystem: 'application',
      },
      { id: 'queue', label: 'The queue redelivered the email messages', subsystem: 'queue' },
    ],
    correctCauseId: 'overlap',
    resolution:
      'Today the job had ten times more invoices than usual, so a run took about half an hour instead of three minutes. The CronJob uses concurrencyPolicy: Allow, so a new run started every 10 minutes while the old ones were still going. Each run selected invoices with emailed_at still empty, because a run sets it only at the end, so three runs sent the same invoices. Fix: set concurrencyPolicy: Forbid. Then make each send idempotent: claim invoices with a lease that expires (or SELECT ... FOR UPDATE SKIP LOCKED), pass an idempotency key to the mail provider if it supports one, and mark each invoice as emailed right after its own send succeeds.',
    lesson:
      'Assume a scheduled job will one day run longer than its interval. Forbid overlapping runs, and make each unit of work idempotent so a second run cannot repeat side effects.',
  },
  {
    number: 16,
    title: 'The whole storefront returns 503 while every pod is healthy',
    topic: 'kubernetes',
    severity: 'SEV1',
    page: 'storefront: 503 rate 100% since 16:20. The ingress returns "503 Service Temporarily Unavailable".',
    symptoms: [
      'A Helm chart change was deployed at 16:19.',
      'All storefront pods are Running and Ready.',
      'Port-forwarding to a pod directly works.',
    ],
    evidence: [
      {
        label: 'Service',
        command: 'kubectl describe svc storefront',
        output: lines(
          'Name:              storefront',
          'Selector:          app=storefront,tier=web',
          'Type:              ClusterIP',
          'Port:              http  80/TCP',
          'TargetPort:        8080/TCP',
          'Endpoints:         <none>'
        ),
      },
      {
        label: 'Pod labels',
        command: 'kubectl get pods -l app.kubernetes.io/name=storefront --show-labels',
        output: lines(
          'NAME                              READY   STATUS    RESTARTS   AGE   LABELS',
          'storefront-web-6b7f9d8c5d-4hzx9   1/1     Running   0          9m    app.kubernetes.io/component=web,app.kubernetes.io/name=storefront,pod-template-hash=6b7f9d8c5d',
          'storefront-web-6b7f9d8c5d-9pqv2   1/1     Running   0          9m    app.kubernetes.io/component=web,app.kubernetes.io/name=storefront,pod-template-hash=6b7f9d8c5d'
        ),
      },
      {
        label: 'Release diff',
        output: lines(
          '# PR #812 "tidy up labels"',
          '- Deployment/storefront       removed',
          '+ Deployment/storefront-web   selector: app.kubernetes.io/name=storefront,app.kubernetes.io/component=web',
          '  Service/storefront          unchanged'
        ),
      },
      {
        label: 'Ingress controller log',
        output:
          'W1028 16:20:14.512301       7 controller.go:1214] Service "shop/storefront" does not have any active Endpoint.',
      },
      {
        label: 'Direct test',
        command:
          'kubectl port-forward pod/storefront-web-6b7f9d8c5d-4hzx9 8080:8080   # in a second terminal: curl -s localhost:8080/healthz',
        output: lines(
          'Forwarding from 127.0.0.1:8080 -> 8080',
          'Handling connection for 8080',
          'ok'
        ),
      },
    ],
    causes: [
      {
        id: 'selector',
        label: 'The Service selector no longer matches any pod labels',
        subsystem: 'kubernetes',
      },
      {
        id: 'readiness',
        label: 'Pods fail their readiness probe, so they are not endpoints',
        subsystem: 'kubernetes',
      },
      {
        id: 'targetport',
        label: 'The Service targetPort points at the wrong port',
        subsystem: 'kubernetes',
      },
      { id: 'ingress', label: 'The ingress controller is down', subsystem: 'network' },
      { id: 'dns', label: 'Cluster DNS cannot resolve storefront', subsystem: 'dns' },
      { id: 'app', label: 'The new release crashes on every request', subsystem: 'application' },
    ],
    correctCauseId: 'selector',
    resolution:
      'The chart change replaced the Deployment with storefront-web, which uses the recommended app.kubernetes.io labels. The Service was left alone and still selects app=storefront,tier=web. No pod has those labels now, so the Service has no endpoints and the ingress answers 503 for every request, even though every pod is healthy. Fix: point the Service selector at the new labels, or add the old labels back to the pod template.',
    lesson:
      'After any label change, check that each Service still has endpoints. A CI check that every Service selector matches a workload in the rendered chart catches this before it ships.',
  },
  {
    number: 17,
    title: 'Connections to the warehouse API open, then hang',
    topic: 'networking',
    severity: 'SEV2',
    page: 'reports-service: every request to warehouse.internal times out after 15 s.',
    symptoms: [
      'The warehouse API is in another data centre, reached over a new site-to-site VPN since 09:00.',
      'The TCP health check on port 443 passes.',
      'Requests hang after the connection opens, until they time out.',
    ],
    evidence: [
      {
        label: 'curl -v',
        command: 'curl -v --max-time 15 https://warehouse.internal/health',
        output: lines(
          '* Connected to warehouse.internal (10.20.0.15) port 443',
          '* TLSv1.3 (OUT), TLS handshake, Client hello (1):',
          '* Operation timed out after 15001 milliseconds with 0 bytes received'
        ),
      },
      {
        label: 'Ping with Do Not Fragment',
        command: 'ping -c 2 -M do -s 1472 10.20.0.15; ping -c 2 -M do -s 1372 10.20.0.15',
        output: lines(
          '2 packets transmitted, 0 received, 100% packet loss, time 1014ms',
          '1380 bytes from 10.20.0.15: icmp_seq=1 ttl=62 time=11.8 ms',
          '1380 bytes from 10.20.0.15: icmp_seq=2 ttl=62 time=11.6 ms'
        ),
      },
      {
        label: 'tcpdump on the client',
        command: 'tcpdump -nn host 10.20.0.15 and port 443',
        output: lines(
          '10:41:07.110 IP 10.10.4.21.51734 > 10.20.0.15.443: Flags [S], options [mss 1460]',
          '10:41:07.122 IP 10.20.0.15.443 > 10.10.4.21.51734: Flags [S.], options [mss 1460]',
          '10:41:07.122 IP 10.10.4.21.51734 > 10.20.0.15.443: Flags [.], ack 1',
          '10:41:07.123 IP 10.10.4.21.51734 > 10.20.0.15.443: Flags [P.], seq 1:518, length 517',
          '10:41:07.135 IP 10.20.0.15.443 > 10.10.4.21.51734: Flags [.], ack 518',
          '(nothing more from 10.20.0.15)'
        ),
      },
      {
        label: 'VPN tunnel settings',
        output: lines('tunnel dc2-vpn   mtu 1400', 'tcp mss clamping   off'),
      },
      {
        label: 'Edge firewall rules (both sites)',
        output: lines(
          'rule 10  allow tcp any -> 10.20.0.0/16 port 443',
          'rule 30  allow icmp type 0,8 (echo) any any',
          'rule 40  deny icmp type 3 (unreachable) any any   # "hardening", added 2024'
        ),
      },
    ],
    causes: [
      {
        id: 'pmtu',
        label: 'Large packets are dropped in the VPN, and blocked ICMP hides it',
        subsystem: 'network',
      },
      { id: 'port', label: 'A firewall blocks port 443', subsystem: 'network' },
      { id: 'loss', label: 'The VPN link drops packets at random', subsystem: 'network' },
      { id: 'cert', label: 'The warehouse API certificate has expired', subsystem: 'tls' },
      { id: 'dns', label: 'warehouse.internal resolves to the wrong IP', subsystem: 'dns' },
      { id: 'busy', label: 'The warehouse API is overloaded', subsystem: 'application' },
    ],
    correctCauseId: 'pmtu',
    resolution:
      'The VPN tunnel has an MTU of 1400 because of encryption overhead, but both hosts use 1500 and agree on an MSS of 1460. Small packets such as the TCP handshake and the TLS Client Hello pass. The server\'s first large reply, with its certificate chain, does not fit. The VPN gateway drops it and sends an ICMP "fragmentation needed" message so the server can send smaller packets, but the edge firewalls drop every ICMP "destination unreachable" message, which includes it. The server never learns, keeps resending the same large packets, and the request hangs. Fix: allow ICMP type 3 code 4 (and ICMPv6 Packet Too Big), and clamp the TCP MSS on the tunnel to 1360.',
    lesson:
      'Do not block ICMP type 3 ("destination unreachable"): path MTU discovery depends on it. When connections open but hang on the first large transfer, test with ping -M do at different sizes.',
  },
  {
    number: 18,
    title: 'The primary database disk is filling up fast',
    topic: 'database',
    severity: 'SEV2',
    page: 'orders-db: disk 96% used and climbing. About 40 minutes until full.',
    symptoms: [
      'Disk use has climbed slowly for 9 days.',
      'Table sizes have barely changed.',
      'Nothing was deployed in the last 3 days.',
    ],
    evidence: [
      {
        label: 'Disk use by directory',
        command: 'du -sh /var/lib/postgresql/17/main/base /var/lib/postgresql/17/main/pg_wal',
        output: lines(
          '96G     /var/lib/postgresql/17/main/base',
          '402G    /var/lib/postgresql/17/main/pg_wal'
        ),
      },
      {
        label: 'Replication slots',
        command:
          'psql -c "SELECT slot_name, slot_type, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained FROM pg_replication_slots;"',
        output: lines(
          '   slot_name   | slot_type | active | retained',
          '---------------+-----------+--------+----------',
          ' replica_hot   | physical  | t      | 12 MB',
          ' reporting_rep | physical  | f      | 401 GB'
        ),
      },
      {
        label: 'WAL archiver',
        command:
          'psql -c "SELECT archived_count, failed_count, last_failed_wal FROM pg_stat_archiver;"',
        output: lines(
          ' archived_count | failed_count | last_failed_wal',
          '----------------+--------------+-----------------',
          '         219884 |            0 |'
        ),
      },
      {
        label: 'WAL settings',
        command:
          "psql -c \"SELECT name, setting, unit FROM pg_settings WHERE name IN ('max_wal_size', 'wal_keep_size', 'max_slot_wal_keep_size');\"",
        output: lines(
          '          name          | setting | unit',
          '------------------------+---------+------',
          ' max_slot_wal_keep_size | -1      | MB',
          ' max_wal_size           | 4096    | MB',
          ' wal_keep_size          | 0       | MB'
        ),
      },
      {
        label: 'Infra change log',
        output: lines(
          'Oct 19  cost cleanup: shut down orders-db-reporting (reporting replica)',
          'Oct 19  cost cleanup: delete old snapshots'
        ),
      },
    ],
    causes: [
      {
        id: 'slot',
        label: 'An unused replication slot is holding on to WAL',
        subsystem: 'database',
      },
      {
        id: 'archive',
        label: 'WAL archiving is failing, so old WAL cannot be removed',
        subsystem: 'database',
      },
      { id: 'bloat', label: 'Table bloat because autovacuum is behind', subsystem: 'database' },
      { id: 'logs', label: 'Postgres server logs filled the disk', subsystem: 'host' },
      { id: 'backup', label: 'A backup job is writing dumps to the data disk', subsystem: 'host' },
      {
        id: 'traffic',
        label: 'A traffic spike is writing much more data',
        subsystem: 'application',
      },
    ],
    correctCauseId: 'slot',
    resolution:
      "The reporting replica used a physical replication slot. The replica was shut down on October 19, but its slot stayed on the primary. A slot makes the primary keep every WAL segment the replica has not received yet, so for 9 days no WAL could be removed and pg_wal grew to 402 GB. Fix: drop the slot (SELECT pg_drop_replication_slot('reporting_rep')); the next checkpoint removes the old WAL. Prevent it with max_slot_wal_keep_size and an alert on inactive slots.",
    lesson:
      'A replication slot is a promise to keep WAL until its consumer reads it. Drop the slot when you remove a replica or a CDC consumer, and cap slots with max_slot_wal_keep_size.',
  },
  {
    number: 19,
    title: 'Browsers say the shop connection is not private',
    topic: 'tls',
    severity: 'SEV1',
    page: 'shop.example.com: synthetic check failed: certificate has expired.',
    symptoms: [
      'Certificates renew automatically with certbot. Nobody has touched it for a year.',
      'The web server config was cleaned up about two months ago.',
      'All visitors are affected.',
    ],
    evidence: [
      {
        label: 'Certificate dates',
        command:
          'echo | openssl s_client -connect shop.example.com:443 -servername shop.example.com 2>/dev/null | openssl x509 -noout -dates',
        output: lines('notBefore=Jul 30 08:14:02 2026 GMT', 'notAfter=Oct 28 08:14:01 2026 GMT'),
      },
      {
        label: 'Renewal timer',
        command: 'systemctl list-timers certbot.timer',
        output: lines(
          'NEXT                        LEFT     LAST                        PASSED  UNIT           ACTIVATES',
          'Wed 2026-10-28 21:43:00 UTC 9h left  Wed 2026-10-28 09:43:11 UTC 2h ago  certbot.timer  certbot.service'
        ),
      },
      {
        label: 'Renewal log',
        command: 'journalctl -u certbot.service --since -1d',
        output: lines(
          'Certbot failed to authenticate some domains (authenticator: webroot). The Certificate Authority reported these problems:',
          '  Domain: shop.example.com',
          '  Type:   unauthorized',
          '  Detail: 203.0.113.10: Invalid response from https://shop.example.com/.well-known/acme-challenge/kX3q9: 404',
          'Failed to renew certificate shop.example.com with error: Some challenges have failed.'
        ),
      },
      {
        label: 'nginx config change',
        command: 'git show 7e1d0c4 -- sites-enabled/shop.conf  # "tidy up redirects", 2 months ago',
        output: lines(
          ' server {',
          '     listen 80;',
          '     server_name shop.example.com;',
          '-    location /.well-known/acme-challenge/ { root /var/www/certbot; }',
          '-    location / { return 301 https://$host$request_uri; }',
          '+    return 301 https://$host$request_uri;',
          ' }'
        ),
      },
      {
        label: 'DNS',
        command: 'dig +short shop.example.com',
        output: '203.0.113.10',
      },
    ],
    causes: [
      {
        id: 'renewal',
        label: 'Renewals have failed for weeks because the challenge path returns 404',
        subsystem: 'tls',
      },
      { id: 'timer', label: 'The certbot timer is disabled', subsystem: 'tls' },
      {
        id: 'ratelimit',
        label: 'The certificate authority rate-limited our renewals',
        subsystem: 'tls',
      },
      { id: 'clock', label: 'The server clock is wrong', subsystem: 'host' },
      { id: 'dns', label: 'shop.example.com points at an old server', subsystem: 'dns' },
      { id: 'cdn', label: 'The CDN serves an old certificate', subsystem: 'network' },
    ],
    correctCauseId: 'renewal',
    resolution:
      'Certbot renews a certificate when it has less than 30 days left, so it has tried twice a day since late September. The config cleanup replaced the port 80 block with a plain redirect. The CA follows the redirect to HTTPS, where nginx has no location for /.well-known/acme-challenge/, so it gets a 404 and refuses to issue. Every renewal failed quietly until the certificate expired. Fix: serve the challenge path again (or switch to the DNS-01 challenge), run certbot renew, reload nginx, and alert when any certificate has less than 14 days left.',
    lesson:
      'Automatic renewal still needs monitoring. Alert on certificate expiry dates and on failed renewal runs, and run certbot renew --dry-run after web server changes.',
  },
  {
    number: 20,
    title: "A customer sees another customer's account page",
    topic: 'caching',
    severity: 'SEV1',
    page: "security: two reports of users seeing someone else's name and orders on /account.",
    symptoms: [
      'The reports started 20 minutes after the 10:00 deploy.',
      'The site sits behind a CDN that caches static files.',
      'Session handling looks correct in the app logs.',
    ],
    evidence: [
      {
        label: 'Response headers',
        command: "curl -sI https://www.example.com/account -H 'Cookie: session=7f2c...'",
        output: lines(
          'HTTP/2 200',
          'content-type: text/html; charset=utf-8',
          'cache-control: public, max-age=300',
          'age: 212',
          'x-cache: HIT'
        ),
      },
      {
        label: '10:00 deploy diff',
        output: lines(
          '+ app.use((req, res, next) => {',
          "+   res.set('Cache-Control', 'public, max-age=300'); // faster pages",
          '+   next();',
          '+ });'
        ),
      },
      {
        label: 'CDN cache rules',
        output: lines(
          'cache key                host + path + query (cookies ignored)',
          'respect origin headers   yes',
          'unchanged since          March'
        ),
      },
      {
        label: 'Origin traffic for /account',
        output: lines(
          '09:55  912 requests/min',
          '10:05    4 requests/min',
          '10:15    3 requests/min'
        ),
      },
      {
        label: 'Session store',
        output: 'redis sessions: 0 key collisions, session IDs 128-bit random, no errors',
      },
    ],
    causes: [
      {
        id: 'public',
        label: 'The deploy made every response publicly cacheable, so the CDN shares pages',
        subsystem: 'cache',
      },
      {
        id: 'cachekey',
        label: 'A CDN change made the cache key ignore cookies',
        subsystem: 'cache',
      },
      {
        id: 'browser',
        label: 'Browsers on shared computers show cached pages',
        subsystem: 'cache',
      },
      { id: 'collision', label: 'Session IDs collide between users', subsystem: 'application' },
      { id: 'replica', label: 'A database replica returns the wrong rows', subsystem: 'database' },
      { id: 'hijack', label: 'Attackers stole session cookies', subsystem: 'network' },
    ],
    correctCauseId: 'public',
    resolution:
      "The 10:00 deploy added middleware that sets Cache-Control: public, max-age=300 on every response, including /account. The CDN respects origin headers and leaves cookies out of its cache key, so the first logged-in visitor's account page was stored and served to everyone who asked for /account for the next five minutes. The cache key was always like that; it was safe while dynamic pages were not cacheable. Fix: roll back, purge private paths from the CDN, send Cache-Control: private, no-store on personalised pages, and treat it as a data exposure.",
    lesson:
      'Make "do not cache" the default for dynamic responses and opt in for public ones. Add a test that every logged-in page returns Cache-Control: private or no-store.',
  },
  {
    number: 21,
    title: 'pricing-api pods die every six hours',
    topic: 'memory',
    severity: 'SEV3',
    page: 'pricing-api: 12 restarts today (OOMKilled). Short 5xx spikes on each restart.',
    symptoms: [
      'The restarts started three days ago.',
      'Each pod lives about 6 hours before it is killed.',
      'Traffic is the same as last week.',
    ],
    evidence: [
      {
        label: 'Memory per pod',
        output: lines(
          'pricing-api-7c5d9-k2q8x  working set (limit 1Gi)',
          '00:00 310Mi   02:00 550Mi   04:00 790Mi   05:50 1010Mi',
          '05:52 OOMKilled, restarted   05:53 300Mi'
        ),
      },
      {
        label: 'Heap snapshot diff',
        output: lines(
          'two snapshots one hour apart, largest growth:',
          '  Map (quoteCache)   +118 MB   +1,021,440 entries',
          '  string             +14 MB',
          '  Array               +2 MB'
        ),
      },
      {
        label: 'Code change 3 days ago',
        output: lines(
          '+ const quoteCache = new Map<string, Quote>();',
          '+ const key = `${customerId}:${sku}:${Date.now()}`;',
          '+ const cached = quoteCache.get(key);',
          '+ if (!cached) quoteCache.set(key, await fetchQuote(customerId, sku));'
        ),
      },
      {
        label: 'Cache hit rate',
        output: 'quoteCache hits 0.0%   misses 100%',
      },
      {
        label: 'Node memory',
        command: 'kubectl top nodes',
        output: lines(
          'NAME      CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%',
          'node-b1   1530m        38%    6120Mi          39%',
          'node-b2   1410m        35%    5880Mi          37%'
        ),
      },
    ],
    causes: [
      {
        id: 'leak',
        label: 'A new in-memory cache grows without limit',
        subsystem: 'application',
      },
      {
        id: 'slow',
        label: 'Slow requests pile up and hold memory',
        subsystem: 'application',
      },
      {
        id: 'listeners',
        label: 'Event listeners are added on every request',
        subsystem: 'application',
      },
      {
        id: 'limit',
        label: 'The memory limit is too low for normal load',
        subsystem: 'kubernetes',
      },
      { id: 'node', label: 'The nodes are out of memory', subsystem: 'host' },
      { id: 'redis', label: 'Redis is down, so every quote is fetched again', subsystem: 'cache' },
    ],
    correctCauseId: 'leak',
    resolution:
      'Three days ago a change added an in-process Map to cache price quotes. The key includes Date.now(), so almost every request creates a new key: the cache almost never gets a hit and never removes anything. Each pod grows by about 120 MB an hour until it reaches the 1Gi limit and is OOMKilled. Fix: take the timestamp out of the key and use a bounded cache with a maximum size and a TTL, or keep shared caches in Redis.',
    lesson:
      'Every cache needs a size limit and an eviction policy. A sawtooth memory graph that drops on each restart is a leak until proven otherwise.',
  },
  {
    number: 22,
    title: 'Payment calls got slow after the move to Kubernetes',
    topic: 'dns',
    severity: 'SEV3',
    page: 'checkout: p99 for payment calls 900 ms (was 150 ms on VMs). CoreDNS CPU alert.',
    symptoms: [
      'The checkout service moved from VMs to Kubernetes this week.',
      'The payment provider reports normal latency on their side.',
      'CoreDNS uses four times more CPU than last week.',
    ],
    evidence: [
      {
        label: 'resolv.conf in the pod',
        command: 'kubectl exec deploy/checkout -- cat /etc/resolv.conf',
        output: lines(
          'search shop.svc.cluster.local svc.cluster.local cluster.local',
          'nameserver 10.96.0.10',
          'options ndots:5'
        ),
      },
      {
        label: 'CoreDNS query log',
        output: lines(
          '[INFO] 10.42.1.9:41022 - 3311 "A IN api.payments.example.net.shop.svc.cluster.local. udp 65 false 512" NXDOMAIN qr,aa,rd 158 0.0003s',
          '[INFO] 10.42.1.9:41022 - 3312 "AAAA IN api.payments.example.net.shop.svc.cluster.local. udp 65 false 512" NXDOMAIN qr,aa,rd 158 0.0003s',
          '[INFO] 10.42.1.9:51877 - 1840 "A IN api.payments.example.net.svc.cluster.local. udp 60 false 512" NXDOMAIN qr,aa,rd 153 0.0002s',
          '[INFO] 10.42.1.9:33105 - 9921 "A IN api.payments.example.net.cluster.local. udp 56 false 512" NXDOMAIN qr,aa,rd 149 0.0002s',
          '[INFO] 10.42.1.9:46610 - 2207 "A IN api.payments.example.net. udp 42 false 512" NOERROR qr,rd,ra 58 0.0841s'
        ),
      },
      {
        label: 'HTTP client config',
        output:
          'PAYMENT_API_URL=https://api.payments.example.net   keepAlive=false (new connection per call)',
      },
      {
        label: 'One slow payment call',
        output: 'total 912 ms = dns 620 ms + connect 39 ms + tls 63 ms + response 190 ms',
      },
      {
        label: 'CoreDNS metrics',
        output:
          'queries 48k/s (last week 11k/s)   NXDOMAIN 81%   replicas 2 (unchanged for 6 months)   cpu throttled 34%',
      },
    ],
    causes: [
      {
        id: 'ndots',
        label: 'With ndots:5, each external lookup tries every search domain first',
        subsystem: 'dns',
      },
      { id: 'replicas', label: 'Someone scaled CoreDNS down this week', subsystem: 'dns' },
      { id: 'upstream', label: 'The upstream DNS resolver is slow', subsystem: 'dns' },
      { id: 'provider', label: 'The payment provider is slow', subsystem: 'third-party' },
      { id: 'netpol', label: 'A NetworkPolicy drops some DNS packets', subsystem: 'kubernetes' },
      { id: 'tls', label: 'TLS session resumption is turned off', subsystem: 'tls' },
    ],
    correctCauseId: 'ndots',
    resolution:
      'Pods get ndots:5 and three search domains. api.payments.example.net has only three dots, so the resolver first tries it with each search domain appended, for A and AAAA, before it asks for the real name: up to 8 queries per lookup. The HTTP client opens a new connection, with a new lookup, for every call. CoreDNS is flooded with NXDOMAIN answers, gets CPU throttled, and DNS becomes most of the latency. Fix: use the fully qualified name with a trailing dot (api.payments.example.net.) or set dnsConfig ndots: 2 for this workload, turn on keep-alive, and consider NodeLocal DNSCache. More CoreDNS replicas would ease the symptom but not remove the extra queries.',
    lesson:
      'Check resolv.conf when a service moves into Kubernetes. Under ndots:5 every external name costs several lookups, so reuse connections and use fully qualified names for busy external calls.',
  },
  {
    number: 23,
    title: 'The shipping-rates API keeps returning 429 after the rush',
    topic: 'rate-limits',
    severity: 'SEV2',
    page: 'checkout: 70% of shipping quotes fail. The partner API returns 429.',
    symptoms: [
      'A flash sale doubled checkout traffic at 12:00 for 10 minutes.',
      'Traffic has been back to normal since 12:10, but the 429s continue at 12:40.',
      'The partner allows 200 requests per second per API key.',
    ],
    evidence: [
      {
        label: 'Request rates',
        output: lines(
          'time    checkouts/s   calls to rates.partner.example/s',
          '11:50   140           140',
          '12:05   280           290',
          '12:20   145           1,410',
          '12:40   141           1,380'
        ),
      },
      {
        label: 'Retry config',
        output: lines(
          'retries: 9',
          'backoff: none',
          'retry_on: [429, 500, 502, 503, 504, timeout]',
          'respect_retry_after: false'
        ),
      },
      {
        label: 'Partner response',
        command:
          'curl -si https://rates.partner.example/v2/quote -H "Authorization: Bearer ..." | head -n 4',
        output: lines(
          'HTTP/1.1 429 Too Many Requests',
          'Retry-After: 20',
          'X-RateLimit-Limit: 200',
          'X-RateLimit-Remaining: 0'
        ),
      },
      {
        label: 'App logs',
        output: lines(
          '12:40:01.201 WARN rates attempt 1/10 -> 429, retrying now',
          '12:40:01.214 WARN rates attempt 2/10 -> 429, retrying now',
          '12:40:01.229 WARN rates attempt 3/10 -> 429, retrying now'
        ),
      },
      {
        label: 'Partner status page',
        output: 'All systems operational. No incidents reported today.',
      },
    ],
    causes: [
      {
        id: 'retries',
        label: 'Instant retries multiply our own traffic and keep us over the limit',
        subsystem: 'application',
      },
      { id: 'sale', label: 'Flash sale traffic is still too high', subsystem: 'application' },
      {
        id: 'peritem',
        label: 'A bug calls the rates API once per cart item',
        subsystem: 'application',
      },
      { id: 'quota', label: 'The partner lowered our rate limit', subsystem: 'third-party' },
      { id: 'cache', label: 'The shipping-rate cache was flushed', subsystem: 'cache' },
      { id: 'dns', label: 'The partner API moved and our DNS is stale', subsystem: 'dns' },
    ],
    correctCauseId: 'retries',
    resolution:
      'During the sale we went over 200 requests a second and got 429s. The client retries every 429 at once, up to 9 times, and ignores Retry-After, so each failed quote became up to 10 calls. Even with normal traffic, about 140 quotes a second, we sent about 1,400 requests a second, stayed over the limit, and almost every attempt failed. Fix: honour Retry-After, use exponential backoff with jitter, cap retries at 2 or 3, and add a circuit breaker. A short cache of quotes cuts calls further.',
    lesson:
      'Retries without backoff turn a short overload into a lasting one. Treat 429 as "slow down", not "try again now", and limit retries across the whole client.',
  },
  {
    number: 24,
    title: 'No new orders can be saved',
    topic: 'database',
    severity: 'SEV1',
    page: 'orders-api: POST /orders 100% errors since 03:17. Reads are fine.',
    symptoms: [
      'Every insert into orders fails. Reads work.',
      'No deploys in the last 2 days.',
      'Database CPU, memory and disk look normal.',
    ],
    evidence: [
      {
        label: 'App logs',
        command: 'kubectl logs deploy/orders-api --since=5m | grep -m1 ERROR',
        output:
          '03:17:44 ERROR insert order failed: ERROR:  nextval: reached maximum value of sequence "orders_id_seq" (2147483647)',
      },
      {
        label: 'orders table',
        command: "psql -c '\\d orders' | head -n 5",
        output: lines(
          '                                   Table "public.orders"',
          ' Column |  Type   | Collation | Nullable |              Default',
          '--------+---------+-----------+----------+------------------------------------',
          " id     | integer |           | not null | nextval('orders_id_seq'::regclass)"
        ),
      },
      {
        label: 'Sequence',
        command:
          'psql -c "SELECT last_value, max_value FROM pg_sequences WHERE sequencename = \'orders_id_seq\';"',
        output: lines(
          ' last_value | max_value',
          '------------+------------',
          ' 2147483647 | 2147483647'
        ),
      },
      {
        label: 'Row count',
        command:
          'psql -c "SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = \'orders\';"',
        output: lines('  estimate', '------------', ' 1204551168'),
      },
      {
        label: 'Locks and replication',
        output:
          'no lock waits on orders   primary is read-write   replication lag 0 s   disk 41% used',
      },
    ],
    causes: [
      {
        id: 'sequence',
        label: 'The id column is a 32-bit integer and its sequence ran out',
        subsystem: 'database',
      },
      { id: 'lock', label: 'A lock on orders blocks inserts', subsystem: 'database' },
      { id: 'readonly', label: 'The database failed over and is read-only', subsystem: 'database' },
      { id: 'validation', label: 'A validation bug rejects new orders', subsystem: 'application' },
      { id: 'disk', label: 'The database disk is full', subsystem: 'host' },
      { id: 'pool', label: 'The connection pool is exhausted', subsystem: 'application' },
    ],
    correctCauseId: 'sequence',
    resolution:
      'orders.id is an integer (a serial column), so its sequence stops at 2,147,483,647. The table holds about 1.2 billion rows, but rolled-back inserts and other gaps also use up sequence values, so the sequence hit its maximum first. Every insert now fails while reads still work. Fix: move the key to bigint. ALTER SEQUENCE orders_id_seq AS bigint lifts the sequence limit, and the column must change too. On a big table ALTER COLUMN id TYPE bigint rewrites the table under a lock, so teams often add a bigint column, backfill it in batches and swap.',
    lesson:
      'Use bigint for primary keys from day one, and alert when any sequence passes about 70% of its maximum (pg_sequences shows last_value and max_value).',
  },
  {
    number: 25,
    title: 'Pages load without styles during every deploy',
    topic: 'deploys',
    severity: 'SEV3',
    page: 'frontend: JS and CSS 404 rate 22% for 6 minutes during the 15:10 deploy.',
    symptoms: [
      'It happens on every deploy and stops when the deploy finishes.',
      'Users see a broken page; a reload usually fixes it.',
      'The same pods serve the HTML and the static files.',
    ],
    evidence: [
      {
        label: 'Access log',
        output: lines(
          '15:12:03 GET /                       200  pod=web-7f9c8-new1  (HTML links /assets/app.4c1e9a.js)',
          '15:12:03 GET /assets/app.4c1e9a.js   404  pod=web-5d2b1-old2',
          '15:12:04 GET /assets/app.4c1e9a.js   200  pod=web-7f9c8-new1'
        ),
      },
      {
        label: 'Rollout status',
        command: 'kubectl rollout status deploy/web',
        output:
          'Waiting for deployment "web" rollout to finish: 3 of 6 updated replicas are available...',
      },
      {
        label: 'Assets in each image',
        output: lines(
          'old image  /app/public/assets/app.9b07d2.js   app.51ac0e.css',
          'new image  /app/public/assets/app.4c1e9a.js   app.e2f7b1.css'
        ),
      },
      {
        label: 'Load balancing',
        output: 'round robin across all ready pods, no session affinity',
      },
      {
        label: 'Image build',
        output: 'build 15:04 ok   assets compiled: app.4c1e9a.js, app.e2f7b1.css   image pushed',
      },
    ],
    causes: [
      {
        id: 'skew',
        label: 'During the rollout, old and new pods serve different asset files',
        subsystem: 'ci-cd',
      },
      {
        id: 'missing',
        label: 'The build left the new assets out of the image',
        subsystem: 'ci-cd',
      },
      { id: 'wrongtag', label: 'The pipeline deployed the wrong image tag', subsystem: 'ci-cd' },
      { id: 'cdn', label: 'The CDN is down', subsystem: 'network' },
      { id: 'disk', label: 'The pods ran out of disk for static files', subsystem: 'host' },
      { id: 'readiness', label: 'Pods get traffic before they are ready', subsystem: 'kubernetes' },
    ],
    correctCauseId: 'skew',
    resolution:
      "Asset file names contain a content hash, and each image only has its own version. During a rolling update a new pod serves HTML that points at app.4c1e9a.js, and the browser's next request goes to an old pod that only has app.9b07d2.js, so it returns 404. Old HTML reaching a new pod fails the same way. Fix: upload assets to shared storage or a CDN before the rollout and keep the previous versions for a while, so every version of the HTML can find its files.",
    lesson:
      'During a rolling deploy two versions run at once. Anything they share, such as assets, APIs and database schemas, must work with both.',
  },
  {
    number: 26,
    title: 'Every outbound call fails after the policy rollout',
    topic: 'kubernetes',
    severity: 'SEV1',
    page: 'payments-api: 100% errors since 10:31. Logs say a host could not be resolved.',
    symptoms: [
      'The security team applied new NetworkPolicies to the payments namespace at 10:30.',
      'All pods are Running and Ready.',
      'Other namespaces are fine.',
    ],
    evidence: [
      {
        label: 'App logs',
        command: 'kubectl logs -n payments deploy/payments-api --since=5m | tail -n 2',
        output: lines(
          '10:31:12 ERROR getaddrinfo EAI_AGAIN payments-db.payments.svc.cluster.local',
          '10:31:12 ERROR getaddrinfo EAI_AGAIN api.cardnetwork.example'
        ),
      },
      {
        label: 'The new policy',
        command: "sed -n '/^spec:/,$p' k8s/payments/default-deny.yaml",
        output: lines(
          'spec:',
          '  podSelector: {}',
          '  policyTypes: [Egress]',
          '  egress:',
          '  - to: [{podSelector: {matchLabels: {app: payments-db}}}]',
          '    ports: [{protocol: TCP, port: 5432}]',
          '  - to: [{ipBlock: {cidr: 0.0.0.0/0, except: [10.0.0.0/8]}}]',
          '    ports: [{protocol: TCP, port: 443}]'
        ),
      },
      {
        label: 'Tests from a pod',
        command:
          'kubectl exec -n payments deploy/payments-api -- sh -c "nslookup payments-db; nc -zv -w 3 10.42.3.15 5432"',
        output: lines(
          ';; connection timed out; no servers could be reached',
          'Connection to 10.42.3.15 5432 port [tcp/postgresql] succeeded!'
        ),
      },
      {
        label: 'CoreDNS',
        command: 'kubectl get pods -n kube-system -l k8s-app=kube-dns',
        output: lines(
          'NAME                       READY   STATUS    RESTARTS   AGE',
          'coredns-5d78c9869d-6hxlb   1/1     Running   0          21d',
          'coredns-5d78c9869d-w9t2c   1/1     Running   0          21d'
        ),
      },
      {
        label: 'Ingress traffic',
        output: 'requests reaching payments-api pods: normal (1,920/min)',
      },
    ],
    causes: [
      {
        id: 'dnsegress',
        label: 'The new egress policy does not allow DNS',
        subsystem: 'kubernetes',
      },
      { id: 'dbport', label: 'The policy blocks the database port', subsystem: 'kubernetes' },
      {
        id: 'ingress',
        label: 'The policy blocks traffic coming in from the ingress',
        subsystem: 'kubernetes',
      },
      { id: 'coredns', label: 'CoreDNS is down', subsystem: 'dns' },
      { id: 'upstream', label: 'The external DNS resolver is down', subsystem: 'dns' },
      { id: 'nat', label: 'The NAT gateway is out of ports', subsystem: 'network' },
    ],
    correctCauseId: 'dnsegress',
    resolution:
      'The default-deny policy blocks all egress except the database on 5432 and the internet on 443. DNS is egress too: pods send queries to CoreDNS in kube-system on port 53, over UDP and sometimes TCP, and no rule allows that. Every lookup times out, so the app cannot find even the database, although a direct connection to its pod IP works. Fix: add an egress rule to the kube-dns pods in kube-system on UDP and TCP port 53.',
    lesson:
      'Every default-deny egress policy needs a DNS rule. Test a new policy in one namespace with a lookup and a connection to each dependency before rolling it out wider.',
  },
  {
    number: 27,
    title: 'The email queue is stuck and the consumers keep crashing',
    topic: 'queues',
    severity: 'SEV2',
    page: 'notifications: queue "emails" has 184k ready messages and is growing. 96 consumer restarts in 1 hour.',
    symptoms: [
      'The queue has drained normally for months.',
      'All three consumer pods restart every 30 to 60 seconds.',
      'Nothing was deployed today.',
    ],
    evidence: [
      {
        label: 'Consumer logs',
        command: 'kubectl logs deploy/email-consumer --previous | tail -n 3',
        output: lines(
          '09:14:22 INFO  consumed message id=7f3a1c redelivered=true',
          '09:14:22 panic: runtime error: invalid memory address or nil pointer dereference',
          '        render.go:88 template "welcome": user.Locale is nil'
        ),
      },
      {
        label: 'Log search, last hour',
        output: lines(
          'query: app=email-consumer AND "panic"   96 matches',
          'message consumed just before each panic: id=7f3a1c (96 of 96)'
        ),
      },
      {
        label: 'Queue status',
        command:
          'rabbitmqctl list_queues name type messages_ready messages_unacknowledged consumers',
        output: lines(
          'name     type      messages_ready   messages_unacknowledged   consumers',
          'emails   classic   184211           50                        1'
        ),
      },
      {
        label: 'Queue arguments',
        command: 'rabbitmqctl list_queues name arguments',
        output: lines('name     arguments', 'emails   []'),
      },
      {
        label: 'The message',
        output:
          'id=7f3a1c  type=welcome  user_id=88123  locale=null  source=partner-signup-import  created 09:13',
      },
    ],
    causes: [
      {
        id: 'poison',
        label: 'One bad message crashes each consumer that gets it, and it comes back forever',
        subsystem: 'queue',
      },
      {
        id: 'prefetch',
        label: 'Prefetch is too high and consumers run out of memory',
        subsystem: 'queue',
      },
      { id: 'broker', label: 'The RabbitMQ broker is out of memory', subsystem: 'queue' },
      { id: 'provider', label: 'The email provider rejects our mail', subsystem: 'third-party' },
      { id: 'oom', label: 'The consumer pods are OOMKilled', subsystem: 'kubernetes' },
      { id: 'deploy', label: 'A bad deploy of the consumer', subsystem: 'ci-cd' },
    ],
    correctCauseId: 'poison',
    resolution:
      'A partner import created a welcome email with no locale. The consumer panics on it before it can ack, so RabbitMQ requeues the message and hands it to the next consumer, which panics too. The queue has no dead-letter exchange and, as a classic queue, no delivery limit, so the loop never ends and 184k other messages wait. Fix: move the message aside, handle a missing locale, and catch errors per message so a failure is rejected to a dead-letter queue without requeue. A quorum queue with a delivery limit also stops this kind of loop.',
    lesson:
      'One message must never take down a whole consumer fleet. Use a dead-letter queue and a delivery limit, and alert on messages that are redelivered again and again.',
  },
  {
    number: 28,
    title: 'The release is stuck in ImagePullBackOff',
    topic: 'ci-cd',
    severity: 'SEV3',
    page: 'deploy: api rollout of 4f2c9e1 has not progressed for 15 minutes.',
    symptoms: [
      'The pipeline shows the deploy job as passed.',
      'The old pods are still serving traffic.',
      'A pipeline change to "make deploys faster" was merged this morning.',
    ],
    evidence: [
      {
        label: 'Pod events',
        command: 'kubectl describe pod api-6c8d7f5b9-tq4wz | tail -n 3',
        output: lines(
          '  Warning  Failed   2m (x4 over 4m)  kubelet  Failed to pull image "registry.example.com/shop/api:4f2c9e1": rpc error: code = NotFound desc = failed to pull and unpack image "registry.example.com/shop/api:4f2c9e1": failed to resolve reference "registry.example.com/shop/api:4f2c9e1": registry.example.com/shop/api:4f2c9e1: not found',
          '  Warning  Failed   2m (x4 over 4m)  kubelet  Error: ErrImagePull',
          '  Normal   BackOff  1m (x6 over 4m)  kubelet  Back-off pulling image "registry.example.com/shop/api:4f2c9e1"'
        ),
      },
      {
        label: 'Pipeline run',
        output: lines(
          'test          passed    1m52s',
          'build-image   failed    2m10s   failed to compute cache key: "/dist": not found',
          'push-image    skipped',
          'deploy        passed    0m14s   kubectl set image deployment/api api=registry.example.com/shop/api:4f2c9e1'
        ),
      },
      {
        label: 'Pipeline config diff',
        output: lines(
          '   deploy:',
          '-    needs: [push-image]',
          '+    needs: [test]',
          '+    if: always()'
        ),
      },
      {
        label: 'Registry tags',
        command: 'crane ls registry.example.com/shop/api | tail -n 3',
        output: lines('77be5c2', 'a81d03b', '9b07d2e'),
      },
      {
        label: 'Registry health',
        output:
          'registry.example.com: healthy, pulls of other tags succeed, pull secret valid until 2027-03-01',
      },
    ],
    causes: [
      {
        id: 'notpushed',
        label: 'The pipeline deployed a tag that was never built or pushed',
        subsystem: 'ci-cd',
      },
      { id: 'registry', label: 'The registry is down', subsystem: 'ci-cd' },
      { id: 'buildcache', label: 'The build cache served an old image', subsystem: 'ci-cd' },
      {
        id: 'secret',
        label: "The cluster's registry pull secret expired",
        subsystem: 'kubernetes',
      },
      { id: 'quota', label: 'A ResourceQuota blocks the new pods', subsystem: 'kubernetes' },
      { id: 'disk', label: 'The nodes are out of disk for images', subsystem: 'host' },
    ],
    correctCauseId: 'notpushed',
    resolution:
      "This morning's change made the deploy job depend only on the tests and run with if: always(), so it no longer waits for the image push. Today the image build failed (dist/ was missing), the push was skipped, and the deploy still pointed the Deployment at api:4f2c9e1, a tag that does not exist. The rolling update keeps the old pods until new ones are ready, so users were not affected, but the rollout is stuck. Fix: roll back the Deployment (kubectl rollout undo), make deploy depend on the push job, and let a failed build stop the pipeline.",
    lesson:
      'Deploy only an artifact that exists. Pass the image digest from the push step to the deploy step instead of rebuilding the tag name from the commit.',
  },
  {
    number: 29,
    title: 'The daily sale ended four hours early',
    topic: 'cron',
    severity: 'SEV2',
    page: 'support: customers say the "ends at midnight" coupon stopped working at 20:00 New York time.',
    symptoms: [
      'Coupons are set to expire at 23:59 shop time (New York).',
      'They stopped working at 20:00 New York time.',
      'The coupon service was rebuilt on a smaller base image yesterday.',
    ],
    evidence: [
      {
        label: 'Clock in the old and new images',
        command: 'docker run --rm coupon-svc:v40 date; docker run --rm coupon-svc:v41 date',
        output: lines('Wed Oct 28 20:02:10 EDT 2026', 'Thu Oct 29 00:02:11 UTC 2026'),
      },
      {
        label: 'Dockerfile diff',
        output: lines(
          '-FROM python:3.14',
          '-ENV TZ=America/New_York',
          '+FROM python:3.14-slim AS runtime',
          '+COPY --from=build /app /app'
        ),
      },
      {
        label: 'Coupon check',
        output: lines(
          'def is_active(coupon):',
          '    return datetime.now() <= coupon.expires_at  # both naive'
        ),
      },
      {
        label: 'Coupon row',
        command:
          'psql -c "SELECT code, expires_at, pg_typeof(expires_at) FROM coupons WHERE code = \'FALL26\';"',
        output: lines(
          '  code  |     expires_at      |          pg_typeof',
          '--------+---------------------+-----------------------------',
          ' FALL26 | 2026-10-28 23:59:59 | timestamp without time zone'
        ),
      },
      {
        label: 'Time sync',
        command: 'chronyc tracking | grep -E "Leap status|System time"',
        output: lines(
          'System time     : 0.000412 seconds fast of NTP time',
          'Leap status     : Normal'
        ),
      },
    ],
    causes: [
      {
        id: 'tz',
        label: 'The new image runs in UTC, and the code compares naive local times',
        subsystem: 'application',
      },
      {
        id: 'expiry',
        label: 'The coupon was created with the wrong expiry date',
        subsystem: 'application',
      },
      {
        id: 'logic',
        label: 'The comparison uses < where it should use <=',
        subsystem: 'application',
      },
      { id: 'clock', label: 'The server clock drifted by four hours', subsystem: 'host' },
      { id: 'db', label: 'The database converts timestamps to UTC', subsystem: 'database' },
      { id: 'cache', label: 'A cache serves stale coupon data', subsystem: 'cache' },
    ],
    correctCauseId: 'tz',
    resolution:
      "Coupon expiry is stored as a timestamp without a time zone, written in New York time, and the code compares it with datetime.now(), which returns the container's local time. The old image set TZ=America/New_York. The new slim image dropped that line, so the container runs in UTC, four hours ahead of New York in October. At 20:00 in New York it was already midnight UTC, so every coupon looked expired. Fix: convert the column to timestamptz, reading the old values as New York time (ALTER COLUMN expires_at TYPE timestamptz USING expires_at AT TIME ZONE 'America/New_York'), and compare it with an aware datetime.now(timezone.utc), so the server time zone no longer matters.",
    lesson:
      'Run servers in UTC, store moments with a time zone, and convert to local time only for display. Code that depends on the machine time zone breaks when the image or host changes.',
  },
  {
    number: 30,
    title: 'Users save their profile and the old data comes back',
    topic: 'database',
    severity: 'SEV3',
    page: 'support: users say profile changes "do not save". Every write returns success.',
    symptoms: [
      'The changes appear after about a minute.',
      'Nothing was deployed today.',
      'The database dashboards show no errors.',
    ],
    evidence: [
      {
        label: 'Replication status',
        command:
          'psql -c "SELECT application_name, state, write_lag, flush_lag, replay_lag FROM pg_stat_replication;"',
        output: lines(
          ' application_name |   state   |    write_lag    |    flush_lag    |   replay_lag',
          '------------------+-----------+-----------------+-----------------+-----------------',
          ' replica1         | streaming | 00:00:00.004122 | 00:00:00.006310 | 00:00:58.214070'
        ),
      },
      {
        label: 'Batch jobs and WAL volume',
        output: lines(
          'backfill-search-vector  started 13:00  UPDATE users SET search_vector = ... WHERE id BETWEEN $1 AND $2',
          '                        batches of 50,000 rows, no pause, 18.2M of 40M rows done',
          'WAL written per minute  12:50 0.2 GB   13:05 3.8 GB   13:20 4.1 GB'
        ),
      },
      {
        label: 'Replica activity',
        output: lines(
          'WAL replay (startup) process   cpu 99%',
          'longest running query          0.8 s',
          'recovery conflicts today       0'
        ),
      },
      {
        label: 'App database routing',
        output: 'GET requests -> replica1   writes -> primary   no read-your-writes routing',
      },
      {
        label: 'Profile API headers',
        command: 'curl -sI https://www.example.com/api/profile',
        output: lines('HTTP/2 200', 'cache-control: private, no-store', 'x-cache: MISS'),
      },
    ],
    causes: [
      {
        id: 'lag',
        label: 'The backfill floods the replica with WAL, so reads are a minute old',
        subsystem: 'database',
      },
      {
        id: 'conflicts',
        label: 'Long queries on the replica pause WAL replay',
        subsystem: 'database',
      },
      {
        id: 'primary',
        label: 'The primary is overloaded and slow to commit',
        subsystem: 'database',
      },
      { id: 'network', label: 'The network to the replica is slow', subsystem: 'network' },
      { id: 'cdn', label: 'A CDN caches the profile API', subsystem: 'cache' },
      {
        id: 'writes',
        label: 'Writes fail silently and are retried later',
        subsystem: 'application',
      },
    ],
    correctCauseId: 'lag',
    resolution:
      "The backfill updates 50,000 rows per batch with no pause, so the primary writes about 4 GB of WAL a minute instead of 0.2 GB. The replica receives it quickly (write and flush lag are milliseconds), but its single replay process cannot apply it that fast, so replay lag has grown to about a minute. The app reads a profile from the replica right after writing it to the primary, so users see their old data. Fix: throttle the backfill (smaller batches with pauses, or wait whenever replay_lag passes a few seconds), and read a user's own data from the primary for a short time after a write.",
    lesson:
      'Replicas are eventually consistent. Send read-your-own-writes paths to the primary, alert on replay_lag, and make bulk jobs watch replication lag.',
  },
  {
    number: 31,
    title: 'Some pods reach the database, others time out',
    topic: 'networking',
    severity: 'SEV2',
    page: 'orders-api: 33% of requests fail with database timeouts since 08:40.',
    symptoms: [
      'A new node pool was added at 08:30 to handle more traffic.',
      'Failing and healthy pods run the same image.',
      'The database is healthy and has free connections.',
    ],
    evidence: [
      {
        label: 'Errors by node',
        output: lines(
          'POD                  NODE       DB ERRORS (5 min)',
          'orders-api-6f7c-a1   pool-a-1   0',
          'orders-api-6f7c-a2   pool-a-2   0',
          'orders-api-6f7c-a3   pool-a-3   0',
          'orders-api-6f7c-a4   pool-a-1   0',
          'orders-api-6f7c-b1   pool-b-1   412',
          'orders-api-6f7c-b2   pool-b-2   398'
        ),
      },
      {
        label: 'Connection tests from pool-b',
        command: 'nc -zv -w 3 10.10.20.5 5432; nc -zv -w 3 10.10.20.9 6379',
        output: lines(
          'nc: connect to 10.10.20.5 port 5432 (tcp) timed out: Operation now in progress',
          'Connection to 10.10.20.9 6379 port [tcp/redis] succeeded!'
        ),
      },
      {
        label: 'Node pool subnets',
        output: lines(
          'pool-a   subnet app-a   10.10.1.0/24',
          'pool-b   subnet app-b   10.10.2.0/24'
        ),
      },
      {
        label: 'Database firewall',
        output: lines(
          'inbound rules for orders-db (10.10.20.5)',
          '  allow tcp 5432 from 10.10.1.0/24   "app subnet"',
          '  allow tcp 22   from 10.10.9.0/24   "bastion"',
          '  deny all'
        ),
      },
      {
        label: 'Firewall flow log',
        output: lines(
          '08:41:02 DENY tcp 10.10.2.14:43122 -> 10.10.20.5:5432   (pool-b-1 node address)',
          '08:41:02 DENY tcp 10.10.2.27:51870 -> 10.10.20.5:5432   (pool-b-2 node address)',
          '08:41:03 ALLOW tcp 10.10.1.11:38004 -> 10.10.20.5:5432  (pool-a-1 node address)'
        ),
      },
    ],
    causes: [
      {
        id: 'firewall',
        label: 'The database firewall only allows the old node subnet',
        subsystem: 'network',
      },
      {
        id: 'route',
        label: 'The new subnet has no route to the database network',
        subsystem: 'network',
      },
      {
        id: 'nat',
        label: 'The new nodes go through a NAT that is out of ports',
        subsystem: 'network',
      },
      { id: 'pool', label: 'The database ran out of connections', subsystem: 'database' },
      { id: 'dns', label: 'The new nodes resolve the database name differently', subsystem: 'dns' },
      { id: 'cni', label: 'The CNI plugin is broken on the new nodes', subsystem: 'kubernetes' },
    ],
    correctCauseId: 'firewall',
    resolution:
      'The database firewall allows port 5432 only from 10.10.1.0/24, the subnet of the original node pool. The new pool lives in 10.10.2.0/24, and pod traffic leaves each node with the node address, as the flow log shows, so connections from pods scheduled there are dropped silently and time out. Two of six pods run on the new nodes, which matches the 33% error rate, and the same nodes reach Redis in the same network, so routing works. Fix: allow the new subnet, or better, allow the nodes by security group or tag instead of by address range, and add a dependency check to node pool rollouts.',
    lesson:
      'Rules based on IP ranges break silently when capacity is added somewhere else. Reference groups or tags instead of subnets, and test every dependency from new nodes before they take traffic.',
  },
];
