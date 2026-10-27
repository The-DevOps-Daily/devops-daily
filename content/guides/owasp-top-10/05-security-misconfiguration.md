---
title: 'A02:2025 Security Misconfiguration'
description: 'A02:2025 Security Misconfiguration: default credentials, stack traces, missing headers, and Kubernetes and cloud settings, checked with ZAP and Trivy.'
order: 3
---

**TLDR**: Security misconfiguration rose from fifth to second place in the OWASP Top 10:2025, because more of every application's behavior now lives in configuration. Ship no default credentials, return generic errors from one central handler, send security headers, and harden containers, Kubernetes manifests and cloud resources in code. Then check all of it automatically: a ZAP baseline scan for the running app and Trivy for the configuration files, on every change.

Misconfiguration is a setting, not a code bug: a framework left in development mode, a database with its default password, a storage bucket readable by anyone, a container running as root. According to the [A02:2025 page](https://owasp.org/Top10/2025/A02_2025-Security_Misconfiguration/), every tested application had some form of it, with more than 719,000 occurrences across 16 CWEs. The category also includes XML external entities (CWE-611) and cookies without the `Secure` or `HttpOnly` flags.

## Prerequisites

- The companion app from the [guide introduction](/guides/owasp-top-10#h2-the-companion-app), and a terminal in its directory.
- For the scans: Docker to run ZAP, and [Trivy](https://trivy.dev/) 0.76 or later. The output below comes from the companion repository's CI workflow.

## What Misconfiguration Looks Like

The OWASP description boils down to these questions. An application is likely vulnerable if the answer to any of them is yes:

- Are default accounts and passwords still enabled?
- Are unnecessary features installed or enabled: ports, sample apps, admin consoles, debug endpoints?
- Do error messages show stack traces or internal details to users?
- Are security headers missing, or set to weak values?
- After an upgrade, are the new security features left switched off for compatibility?
- Are cloud permissions or storage settings broader than needed?
- Do configuration files, images or pipelines contain static secrets instead of short-lived credentials from the platform?

## No Default Credentials

A database started with its documented default password is one of the oldest misconfigurations, and it still appears in Compose files that move from a laptop to a server:

```yaml
# A02 example: default credentials and a database port open to the network. Do not run it.
services:
  db:
    image: postgres:18
    environment:
      POSTGRES_PASSWORD: postgres
    ports:
      - '5432:5432'
```

The fixed version reads the password from a secret file created at deploy time and does not publish the database port at all:

```yaml
# The same database without default credentials or a published port.
services:
  db:
    image: postgres:18
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    # No "ports:": only containers on this Compose network can connect.

secrets:
  db_password:
    file: ./secrets/db_password.txt # created at deploy time, never committed
```

Applications should behave the same way: refuse to start with a missing or weak secret rather than fall back to a default. The companion app does that (`env -u` makes sure the variable is not set from an earlier part):

```terminal
{
  "title": "no password, no start",
  "prompt": "$",
  "steps": [
    {
      "cmd": "env -u DEMO_PASSWORD node src/server.js",
      "output": "file:///home/dev/guide-owasp-top-10-demo-2026-10-27/src/db.js:8\n    throw new Error('DEMO_PASSWORD must be set and at least 15 characters long');\n          ^\n\nError: DEMO_PASSWORD must be set and at least 15 characters long\n    at openDb (file:///home/dev/guide-owasp-top-10-demo-2026-10-27/src/db.js:8:11)\n    at file:///home/dev/guide-owasp-top-10-demo-2026-10-27/src/server.js:6:18\n\nNode.js v24.22.1"
    }
  ]
}
```

## Errors Without Internals

When the vulnerable app gets a request it cannot parse, Express's built-in error handler answers. Outside production mode it sends the stack trace, with file paths and line numbers, to the client:

```terminal
{
  "title": "the default error handler, development mode",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "export DEMO_PASSWORD='correct horse battery staple'"
    },
    {
      "cmd": "node vulnerable/server.js > vulnerable.log 2>&1 &"
    },
    {
      "cmd": "until curl -s -o /dev/null localhost:3001/; do sleep 0.2; done"
    },
    {
      "cmd": "curl -s localhost:3001/api/login -H 'content-type: application/json' -d '{\"name\": \"alice\",'; echo",
      "output": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>SyntaxError: Expected double-quoted property name in JSON at position 17 (line 1 column 18)<br> &nbsp; &nbsp;at JSON.parse (&lt;anonymous&gt;)<br> &nbsp; &nbsp;at parse (/home/dev/guide-owasp-top-10-demo-2026-10-27/node_modules/body-parser/lib/types/json.js:93:21)<br> &nbsp; &nbsp;at /home/dev/guide-owasp-top-10-demo-2026-10-27/node_modules/body-parser/lib/read.js:194:18<br> &nbsp; &nbsp;at AsyncResource.runInAsyncScope (node:async_hooks:227:14)<br> &nbsp; &nbsp;at invokeCallback (/home/dev/guide-owasp-top-10-demo-2026-10-27/node_modules/raw-body/index.js:238:16)<br> &nbsp; &nbsp;at done (/home/dev/guide-owasp-top-10-demo-2026-10-27/node_modules/raw-body/index.js:227:7)<br> &nbsp; &nbsp;at IncomingMessage.onEnd (/home/dev/guide-owasp-top-10-demo-2026-10-27/node_modules/raw-body/index.js:287:7)<br> &nbsp; &nbsp;at IncomingMessage.emit (node:events:514:28)<br> &nbsp; &nbsp;at endReadableNT (node:internal/streams/readable:1783:12)<br> &nbsp; &nbsp;at process.processTicksAndRejections (node:internal/process/task_queues:90:21)</pre>\n</body>\n</html>"
    }
  ]
}
```

`NODE_ENV=production` makes Express hide the stack, which is the minimum. Do not stop there: a setting that one environment variable can undo is fragile. The fixed app has its own error handler that never sends internals, in every environment, and logs the details with a request ID instead:

```javascript
// One central error handler: full details go to the log, the client gets a
// short message and the request ID, never a stack trace or a SQL error.
export function errorHandler({ log }) {
  // Express recognizes error handlers by their four parameters.
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    const status =
      Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status >= 500) {
      log.error({ err, reqId: req.id, method: req.method, path: req.path }, 'request failed');
    }
    if (res.headersSent) return req.socket.destroy();
    res.status(status).json({
      error: status >= 500 ? 'Internal error' : err.expose ? err.message : 'Bad request',
      requestId: req.id,
    });
  };
}
```

```terminal
{
  "title": "the central error handler",
  "prompt": "$",
  "steps": [
    {
      "cmd": "node src/server.js > app.log 2>&1 &"
    },
    {
      "cmd": "until curl -s -o /dev/null localhost:3000/; do sleep 0.2; done"
    },
    {
      "cmd": "curl -s localhost:3000/api/login -H 'content-type: application/json' -d '{\"name\": \"alice\",'; echo",
      "output": "{\"error\":\"Expected double-quoted property name in JSON at position 17 (line 1 column 18)\",\"requestId\":\"03455d99-5c66-4718-a849-0ab31089bcbf\"}"
    }
  ]
}
```

The client learns that its request was bad and gets an ID to quote to support. [A10](/guides/owasp-top-10/11-mishandling-exceptional-conditions) covers errors in more depth.

## Security Headers

Browsers have defenses that the server must switch on with response headers. With both apps still running, compare the vulnerable one, which sends Express's defaults, with the fixed one, then stop both:

```terminal
{
  "title": "response headers, before and after",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "curl -sI localhost:3001/",
      "output": "HTTP/1.1 200 OK\nX-Powered-By: Express\nContent-Type: text/html; charset=utf-8\nContent-Length: 71\nETag: W/\"47-lmlc+6CxawP7D/aGYgeSkLJJmoc\"\nDate: Tue, 27 Oct 2026 17:15:26 GMT\nConnection: keep-alive\nKeep-Alive: timeout=5"
    },
    {
      "cmd": "curl -sI localhost:3000/",
      "output": "HTTP/1.1 200 OK\nContent-Security-Policy: default-src 'self';base-uri 'self';font-src 'self';form-action 'self';frame-ancestors 'none';img-src 'self';object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self';upgrade-insecure-requests\nCross-Origin-Opener-Policy: same-origin\nCross-Origin-Resource-Policy: same-origin\nOrigin-Agent-Cluster: ?1\nReferrer-Policy: no-referrer\nStrict-Transport-Security: max-age=31536000; includeSubDomains\nX-Content-Type-Options: nosniff\nX-DNS-Prefetch-Control: off\nX-Download-Options: noopen\nX-Frame-Options: SAMEORIGIN\nX-Permitted-Cross-Domain-Policies: none\nX-XSS-Protection: 0\nPermissions-Policy: camera=(), microphone=(), geolocation=()\nX-Request-Id: 4e9432af-d3f9-43fe-bfeb-1f43a174cf1f\nContent-Type: text/html; charset=utf-8\nContent-Length: 190\nETag: W/\"be-F6cgsuiqCFvv7iTz0ZacEJ8M7nY\"\nDate: Tue, 27 Oct 2026 17:15:27 GMT\nConnection: keep-alive\nKeep-Alive: timeout=5"
    },
    {
      "cmd": "kill %1 %2"
    }
  ]
}
```

The fixed app sets them with [Helmet](https://helmetjs.github.io/) plus two additions:

```javascript
// Security headers; helmet also removes X-Powered-By. The CSP replaces helmet's
// "https:" and "data:" sources with 'self', since this app loads nothing else.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'font-src': ["'self'"],
        'img-src': ["'self'"],
        'style-src': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    },
  })
);
app.use((req, res, next) => {
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(requestId);
```

```javascript
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store'); // API responses hold private data and tokens
  next();
});
```

What the important headers do:

- **`Content-Security-Policy`** limits where scripts, styles and other resources may load from, which turns many cross-site scripting bugs into harmless text ([A05](/guides/owasp-top-10/03-injection)). Helmet's default policy allows any `https:` source for styles and fonts; this app loads nothing external, so it narrows those to `'self'`. Tune the policy to what your pages really load.
- **`Strict-Transport-Security`** (HSTS) tells browsers to use HTTPS only for this site. Browsers ignore it on plain HTTP, so it takes effect once the app is served over TLS.
- **`X-Content-Type-Options: nosniff`** stops browsers from guessing a different content type, for example running an uploaded text file as a script.
- **`X-Frame-Options`** and the CSP `frame-ancestors` directive stop other sites from framing your pages (clickjacking).
- **`Cache-Control: no-store`** on API responses keeps tokens and private data out of browser and proxy caches.
- **`X-XSS-Protection: 0`** switches off an old browser filter that caused more problems than it solved. Do not set it to `1`.
- **No `X-Powered-By`**: it only advertises the framework.

### Cookies

The companion app uses bearer tokens, but most web applications use cookies. Set the flags explicitly:

```javascript
res.cookie('__Host-session', sessionId, {
  httpOnly: true, // no access from JavaScript
  secure: true, // HTTPS only
  sameSite: 'lax', // not sent on cross-site POST requests
  path: '/', // required, together with secure and no domain, for the __Host- prefix
  maxAge: 60 * 60 * 1000,
});
```

The `__Host-` prefix makes the browser reject the cookie unless it is `Secure`, has `Path=/` and no `Domain`, so a subdomain cannot overwrite it.

## Scan the Running App With ZAP

A [ZAP](https://www.zaproxy.org/) baseline scan crawls the app for a minute and runs passive checks only: it reads responses and does not send attacks, so it is safe to run against any environment you own. This is the scan of the vulnerable app in CI (`-I` reports warnings without failing, and `-s` hides the 60-odd passed checks):

```terminal
{
  "title": "ZAP baseline, vulnerable app",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "start both apps again, as earlier in this part"
    },
    {
      "cmd": "node vulnerable/server.js > vulnerable.log 2>&1 &"
    },
    {
      "cmd": "node src/server.js > app.log 2>&1 &"
    },
    {
      "cmd": "docker run --rm --network host ghcr.io/zaproxy/zaproxy:2.17.0 zap-baseline.py -t http://127.0.0.1:3001/ -I -s",
      "output": "Using the Automation Framework\nWARN-NEW: Missing Anti-clickjacking Header [10020] x 2\nWARN-NEW: X-Content-Type-Options Header Missing [10021] x 2\nWARN-NEW: Server Leaks Information via \"X-Powered-By\" HTTP Response Header Field(s) [10037] x 4\nWARN-NEW: Content Security Policy (CSP) Header Not Set [10038] x 2\nWARN-NEW: Storable and Cacheable Content [10049] x 4\nWARN-NEW: CSP: Failure to Define Directive with No Fallback [10055] x 2\nWARN-NEW: Permissions Policy Header Not Set [10063] x 4\nWARN-NEW: Cross-Origin-Embedder-Policy Header Missing or Invalid [90004] x 6\nFAIL-NEW: 0\tFAIL-INPROG: 0\tWARN-NEW: 8\tWARN-INPROG: 0\tINFO: 0\tIGNORE: 0\tPASS: 60"
    }
  ]
}
```

And the fixed app:

```terminal
{
  "title": "ZAP baseline, fixed app",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker run --rm --network host ghcr.io/zaproxy/zaproxy:2.17.0 zap-baseline.py -t http://127.0.0.1:3000/ -I -s",
      "output": "Using the Automation Framework\nWARN-NEW: Storable and Cacheable Content [10049] x 4\nWARN-NEW: Cross-Origin-Embedder-Policy Header Missing or Invalid [90004] x 2\nFAIL-NEW: 0\tFAIL-INPROG: 0\tWARN-NEW: 2\tWARN-INPROG: 0\tINFO: 0\tIGNORE: 0\tPASS: 66"
    }
  ]
}
```

The headers removed most warnings. The two that remain are decisions, not defects: "Storable and Cacheable Content" applies to the public HTML pages, which may be cached, and the `Cross-Origin-Embedder-Policy` header only matters for pages that need cross-origin isolation, which this app does not. The baseline crawl only follows links, so it never reached the API; a test checks that API responses, errors included, send `no-store`.

To use the baseline scan as a gate, drop `-I` and give it a rules file that records those decisions. Each line sets a rule to `IGNORE`, `INFO`, `WARN` or `FAIL`, and comments hold the reasons (`zap-baseline.py -g rules.conf` writes a starting file with every rule). An `IGNORE` applies to every URL, so make sure the reason holds everywhere; here, a test covers the API responses that the crawl does not reach:

```text
# ZAP baseline rules for the invoices app: rule ID <tab> IGNORE, INFO, WARN or FAIL <tab> (note).
# Rules not listed keep their default (WARN). Review these lines when the app changes.
# Cacheable content: the baseline crawl only reaches the public pages, which may be
# cached. API responses send no-store, checked in tests/errors.test.js. (An OUTOFSCOPE
# URL pattern for this rule still left a WARN with 0 instances in ZAP 2.17.0.)
10049	IGNORE	(Storable and Cacheable Content)
# The app does not need cross-origin isolation.
90004	IGNORE	(Cross-Origin-Embedder-Policy Header Missing or Invalid)
```

```terminal
{
  "title": "ZAP baseline as a gate, fixed app",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "mkdir -p zap && cp zap-rules.conf zap/rules.conf && chmod -R a+rwX zap"
    },
    {
      "cmd": "docker run --rm --network host -v \"$PWD/zap:/zap/wrk:rw\" ghcr.io/zaproxy/zaproxy:2.17.0 zap-baseline.py -t http://127.0.0.1:3000/ -c rules.conf -s",
      "output": "Using the Automation Framework\nIGNORE: Storable and Cacheable Content [10049] x 2\nIGNORE: Cross-Origin-Embedder-Policy Header Missing or Invalid [90004] x 2\nFAIL-NEW: 0\tFAIL-INPROG: 0\tWARN-NEW: 0\tWARN-INPROG: 0\tINFO: 0\tIGNORE: 2\tPASS: 66"
    },
    {
      "cmd": "kill %1 %2"
    }
  ]
}
```

The scan exits with 0, the two reviewed rules count as `IGNORE`, and any new warning makes it exit with a non-zero code. The container runs as its own user, which is why the `zap` directory must be writable for it.

## Containers and Kubernetes

This is what a first Deployment often looks like: a `latest` tag, a password in plain text and a privileged container:

```yaml
# A02 example: what a quick first Deployment often looks like. Do not apply it.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: invoices
spec:
  replicas: 1
  selector:
    matchLabels:
      app: invoices
  template:
    metadata:
      labels:
        app: invoices
    spec:
      containers:
        - name: app
          image: example.com/invoices:latest
          env:
            - name: DEMO_PASSWORD
              value: 'changeme-changeme'
          securityContext:
            privileged: true
```

Trivy's configuration scanner checks Kubernetes manifests, Dockerfiles, Terraform and other formats against a built-in set of rules. Its JSON output, reduced to one line per finding with `jq`:

```terminal
{
  "title": "trivy config, insecure Deployment",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "trivy config --quiet --format json examples/insecure | jq -r '.Results[] | .Target as $file | .Misconfigurations[]? | [$file, .Severity, .ID, .Message] | @tsv'",
      "output": "Dockerfile\tHIGH\tDS-0002\tSpecify at least 1 USER command in Dockerfile with non-root user as argument\nDockerfile\tLOW\tDS-0026\tAdd HEALTHCHECK instruction in your Dockerfile\ndeployment.yaml\tMEDIUM\tKSV-0001\tContainer 'app' of Deployment 'invoices' should set 'securityContext.allowPrivilegeEscalation' to false\ndeployment.yaml\tLOW\tKSV-0003\tContainer 'app' of Deployment 'invoices' should add 'ALL' to 'securityContext.capabilities.drop'\ndeployment.yaml\tLOW\tKSV-0004\tContainer 'app' of 'deployment' 'invoices' in 'default' namespace should set securityContext.capabilities.drop\ndeployment.yaml\tLOW\tKSV-0011\tContainer 'app' of Deployment 'invoices' should set 'resources.limits.cpu'\ndeployment.yaml\tMEDIUM\tKSV-0012\tContainer 'app' of Deployment 'invoices' should set 'securityContext.runAsNonRoot' to true\ndeployment.yaml\tMEDIUM\tKSV-0013\tContainer 'app' of Deployment 'invoices' should specify an image tag\ndeployment.yaml\tHIGH\tKSV-0014\tContainer 'app' of Deployment 'invoices' should set 'securityContext.readOnlyRootFilesystem' to true\ndeployment.yaml\tLOW\tKSV-0015\tContainer 'app' of Deployment 'invoices' should set 'resources.requests.cpu'\ndeployment.yaml\tLOW\tKSV-0016\tContainer 'app' of Deployment 'invoices' should set 'resources.requests.memory'\ndeployment.yaml\tHIGH\tKSV-0017\tContainer 'app' of Deployment 'invoices' should set 'securityContext.privileged' to false\ndeployment.yaml\tLOW\tKSV-0018\tContainer 'app' of Deployment 'invoices' should set 'resources.limits.memory'\ndeployment.yaml\tLOW\tKSV-0020\tContainer 'app' of Deployment 'invoices' should set 'securityContext.runAsUser' > 10000\ndeployment.yaml\tLOW\tKSV-0021\tContainer 'app' of Deployment 'invoices' should set 'securityContext.runAsGroup' > 10000\ndeployment.yaml\tLOW\tKSV-0030\tEither Pod or Container should set 'securityContext.seccompProfile.type' to 'RuntimeDefault'\ndeployment.yaml\tMEDIUM\tKSV-0104\tcontainer \"app\" of deployment \"invoices\" in \"default\" namespace should specify a seccomp profile\ndeployment.yaml\tLOW\tKSV-0106\tcontainer should drop all\ndeployment.yaml\tLOW\tKSV-0110\tdeployment invoices in default namespace should set metadata.namespace to a non-default namespace\ndeployment.yaml\tHIGH\tKSV-0118\tdeployment invoices in default namespace is using the default security context, which allows root privileges\ndeployment.yaml\tMEDIUM\tKSV-0125\tContainer app in deployment invoices (namespace: default) uses an image from an untrusted registry."
    }
  ]
}
```

The hardened Deployment runs as a non-root user with a read-only root file system, no extra Linux capabilities, the default seccomp profile, no service account token, resource requests and a password from a Secret:

```yaml
# A02 example: the same Deployment with secure settings.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: invoices
  namespace: invoices
spec:
  replicas: 2
  selector:
    matchLabels:
      app: invoices
  template:
    metadata:
      labels:
        app: invoices
    spec:
      automountServiceAccountToken: false
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        runAsGroup: 10001
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: app
          # Pin by digest in real use; the tag here keeps the example readable.
          image: example.com/invoices:1.0.0
          env:
            - name: DEMO_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: invoices
                  key: demo-password
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ['ALL']
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              memory: 256Mi
```

And the image it runs comes from a Dockerfile with a pinned base image, production dependencies only, no Node.js package managers (npm, corepack, Yarn) in the final image and a non-root user. Debian's own `apt` and `dpkg` remain; a distroless base image would remove those too:

```dockerfile
# Hardened image for the demo app: pinned base image, production dependencies
# only, no Node.js package managers in the final image, and a non-root user.
FROM node:24.22.1-trixie-slim@sha256:43b9ba1142b8dcf33fa8f922ca1be85714adc444e0586c7cf7726daaeabc1bea AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24.22.1-trixie-slim@sha256:43b9ba1142b8dcf33fa8f922ca1be85714adc444e0586c7cf7726daaeabc1bea
# npm, corepack and Yarn are build tools; the running app does not need them.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
    /usr/local/bin/corepack /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "src/server.js"]
```

```terminal
{
  "title": "trivy config, hardened files",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "trivy config --quiet --format json examples/deploy | jq -r '.Results[] | .Target as $file | .Misconfigurations[]? | [$file, .Severity, .ID, .Message] | @tsv'",
      "output": "deployment.yaml\tLOW\tKSV-0011\tContainer 'app' of Deployment 'invoices' should set 'resources.limits.cpu'\ndeployment.yaml\tMEDIUM\tKSV-0125\tContainer app in deployment invoices (namespace: invoices) uses an image from an untrusted registry."
    }
  ]
}
```

Two findings remain, and both are accepted on purpose: a CPU limit (KSV-0011) throttles the app under load, so it sets CPU requests instead, and the "untrusted registry" check (KSV-0125) flags `example.com`, which stands for an internal registry here.

## Fix or Accept, Never Ignore Silently

Every scanner finding needs one of two outcomes: fix it, or accept it with a reason that someone reviewed. Record accepted findings in one file in the repository, not as inline comments scattered through the code, so a change to the list is visible in review. Give each entry an expiry date, so it comes back for another look. This is the Trivy ignore file for the companion app:

```yaml
# Accepted Trivy findings. Each entry says why it is accepted, and expires so
# that someone reviews it again. Changes to this file need a security review.
# The statements describe controls outside this repository that the examples
# assume; an exception is only valid while its statement is true.
misconfigurations:
  - id: KSV-0011
    statement: >-
      No CPU limit on purpose: limits throttle the app under load. CPU requests are
      set, and the namespace has a ResourceQuota.
    expired_at: 2027-04-30
  - id: KSV-0125
    statement: >-
      example.com stands for the internal registry, which only accepts images
      built and signed by CI.
    expired_at: 2027-04-30
  - id: AWS-0089
    statement: >-
      Object access is recorded with CloudTrail data events in the audit account,
      not with S3 server access logs.
    expired_at: 2027-04-30
  - id: AWS-0132
    statement: >-
      The AWS managed KMS key meets the requirements for this data. Revisit if the
      bucket starts to hold card data.
    expired_at: 2027-04-30
```

```terminal
{
  "title": "the hardened files with the accepted findings",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "trivy config --quiet --ignorefile .trivyignore.yaml --exit-code 1 examples/deploy",
      "output": "Report Summary\n\n┌────────────────────┬────────────┬───────────────────┐\n│       Target       │    Type    │ Misconfigurations │\n├────────────────────┼────────────┼───────────────────┤\n│ Dockerfile         │ dockerfile │         0         │\n├────────────────────┼────────────┼───────────────────┤\n│ deployment.yaml    │ kubernetes │         0         │\n├────────────────────┼────────────┼───────────────────┤\n│ networkpolicy.yaml │ kubernetes │         0         │\n└────────────────────┴────────────┴───────────────────┘\nLegend:\n- '-': Not scanned\n- '0': Clean (no security findings detected)"
    }
  ]
}
```

The statements name controls outside this repository that the example assumes: a ResourceQuota, an internal registry that only accepts signed images, and CloudTrail data events. In a real project, an exception is only valid while its statement is true, so the review checks the statement, not only the finding. With `--exit-code 1`, any finding that is not in the file fails the job, and when an entry expires its finding fails the job again. Protect the ignore file the same way as the workflow: require a review from the security owners for changes to it. On GitHub, that takes a `CODEOWNERS` entry for the file plus a branch protection rule or ruleset that requires code owner review; protect the `CODEOWNERS` file itself the same way. The same rule applies to every tool in this guide: no inline skip comments, exceptions in one reviewed file, and an expiry date on each.

## Cloud Resources

Cloud defaults have improved: since April 2023, new Amazon S3 buckets have Block Public Access on and ACLs off by default. Still, set the protections explicitly in code, so that a console change shows up as drift in the next plan, and so the setting survives in accounts with different defaults. The companion repository's Terraform example (the instance at the end belongs to the [SSRF part](/guides/owasp-top-10/10-ssrf)):

```hcl
terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

variable "ami_id" {
  type        = string
  description = "AMI for the app server"
}

# A02: a private bucket. Block public access explicitly, even though new buckets
# get these settings by default, so a console change shows up as drift.
resource "aws_s3_bucket" "invoices" {
  bucket_prefix = "invoices-"
}

resource "aws_s3_bucket_public_access_block" "invoices" {
  bucket                  = aws_s3_bucket.invoices.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "invoices" {
  bucket = aws_s3_bucket.invoices.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "invoices" {
  bucket = aws_s3_bucket.invoices.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# SSRF defense in depth: require IMDSv2 session tokens. A hop limit of 1 also keeps
# tokens from containers on bridge networks; containers on the host network still
# reach the service, so block it for them in the host firewall, or set
# http_endpoint = "disabled" when nothing on the instance needs metadata.
resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = "t4g.small"

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    encrypted = true
  }
}
```

```terminal
{
  "title": "trivy config, Terraform",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "trivy config --quiet --format json examples/terraform | jq -r '.Results[] | .Target as $file | .Misconfigurations[]? | [$file, .Severity, .ID, .Message] | @tsv'",
      "output": "main.tf\tLOW\tAWS-0089\tBucket has logging disabled\nmain.tf\tHIGH\tAWS-0132\tBucket does not encrypt data with a customer managed key."
    }
  ]
}
```

The configuration also turns on versioning for the bucket and encryption for the instance's root volume, two findings from an earlier scan that were worth fixing. The two that remain, S3 server access logging and a customer managed KMS key, are accepted in the same ignore file, with reasons.

Prefer identity federation and short-lived credentials over static keys everywhere: workload identity in Kubernetes, instance roles on virtual machines, and OpenID Connect from CI to the cloud. A key that does not exist cannot leak from a configuration file.

## XML Parsers

XML external entities (XXE) are a configuration problem too: an XML parser that resolves external entities can read local files or make requests on the server's behalf. Most current parsers, including the common Node.js ones, leave this off by default. Keep it off, never enable options such as `noent` or DTD loading for untrusted input, and prefer JSON where you control the format.

## Make Hardening Repeatable

- **Define every environment from the same code**, with different credentials per environment. A setting changed by hand in production is a misconfiguration waiting to be overwritten, or to be copied.
- **Start minimal.** Remove sample apps, unused features and default accounts from images and servers.
- **Scan on every change**: Trivy for configuration files in pull requests, ZAP baseline against a preview environment.
- **Detect drift**: a scheduled `terraform plan` or a cloud security posture tool reports manual changes.
- **Review the rest**: OWASP suggests at least a yearly manual review of anything you cannot verify automatically.

## Common Mistakes

- **Relying on `NODE_ENV`** or a framework's production mode alone to hide errors. Write your own error handler.
- **Copying a CSP from a blog post** without testing it. Start from a strict policy and add only the sources your pages use; a report-only header (`Content-Security-Policy-Report-Only`) helps you test.
- **Treating scanner output as a to-do list.** Each finding needs a decision: fix it, or accept it with a reason that someone reviewed.
- **Hardening production only.** Staging and preview environments often hold copies of real data.
- **Secrets in manifests and pipelines.** Use the platform's secret store and short-lived credentials.

## Summary

- A02 moved up to second place; configuration is now a large part of every application.
- No default credentials: fail to start instead.
- One central error handler that never returns internals.
- Security headers from a library, with a CSP tuned to your pages and `no-store` on private responses.
- Harden containers, manifests and cloud resources in code, and check them with Trivy and ZAP on every change.

Next, [A03:2025 Software Supply Chain Failures](/guides/owasp-top-10/06-vulnerable-components) covers the code you did not write: dependencies, build tools and CI.

## Keep Learning

- [Docker Security checklist](/checklists/docker-security)
- [Kubernetes Security checklist](/checklists/kubernetes-security)
- [AWS Security checklist](/checklists/aws-security)
- [Splunk Shipped an Unauthenticated Database Sidecar: CVE-2026-20253](/posts/splunk-postgres-sidecar-rce-cve-2026-20253), a default configuration that exposed a database
- [Security Gates guide](/guides/security-gates), for turning these scans into pipeline decisions
