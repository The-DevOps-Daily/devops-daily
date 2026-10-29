---
title: 'A09:2025 Security Logging and Alerting Failures'
description: 'A09:2025 Security Logging and Alerting Failures: which events to log, JSON logs without secrets, log injection, and alert rules that reach a person.'
order: 10
---

**TLDR**: Attacks you cannot see last longer. Log every security decision (logins, access control failures, input validation failures, admin actions) as structured JSON with standard event names and a request ID; keep passwords, tokens and personal data out of the logs; ship them somewhere attackers cannot edit; and, most important in the 2025 edition, alert on them. A log that nobody watches does not detect anything.

The category kept ninth place in 2025, renamed from "Security Logging and Monitoring Failures" to Security Logging and **Alerting** Failures. The [A09:2025 page](https://owasp.org/Top10/2025/A09_2025-Security_Logging_and_Alerting_Failures/) explains the change: great logging with no alerting is of minimal value. The category is hard to test for, so it has few CVEs, and it made the list through the community survey for the third time. Its CWEs cover insufficient logging (CWE-778), sensitive data in logs (CWE-532) and missing output encoding in logs (CWE-117).

## Prerequisites

- The companion app from the [guide introduction](/guides/owasp-top-10#h2-the-companion-app), and a terminal in its directory.
- `jq` to read JSON logs.

## What to Log

OWASP's first prevention point: log all login, access control and server-side input validation failures with enough context to identify the account, and keep them long enough for an investigation that starts weeks later. In practice, log every place where a security control makes a decision, success or failure:

- authentication: logins, failed logins, requests refused by a rate limit, requests with an invalid or expired token, logouts, password changes and resets, MFA changes;
- authorization: every denied request;
- input validation failures on security-relevant fields, such as a refused URL in the SSRF check;
- administrative actions and changes to permissions, keys and configuration;
- high-value business transactions, such as transfers and refunds, with an audit trail; the companion app writes each transfer to an audit table in the same database transaction and logs a `transfer_created` event;
- application start, stop and errors.

Use consistent event names, so queries and alerts do not depend on message wording. The companion app uses names from the [OWASP Logging Vocabulary Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html), such as `authn_login_fail:alice`, `authz_fail:alice,invoice 1002` and `session_logout:bob`, and its own names in the same style where the vocabulary has none, such as `authn_token_invalid` and `transfer_created`.

## Structured Logs, Without Secrets

The companion app logs JSON lines with [pino](https://getpino.io/): one event per line, with a timestamp, a level, the service name and the event fields. A redaction list replaces secrets before the line is written:

```javascript
import pino from 'pino';

// JSON lines on stdout: one event per line, ready for a log pipeline.
// Secrets are replaced before the line is written.
export function createLogger(destination) {
  return pino(
    {
      base: { service: 'invoices' },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'password',
          '*.password',
          'token',
          '*.token',
        ],
        censor: '[REDACTED]',
      },
    },
    destination
  );
}
```

Run a few requests that the earlier parts showed, a failed login, an access to another user's invoice and a refused preview URL, and read the security events back:

```terminal
{
  "title": "security events in the application log",
  "prompt": "$",
  "steps": [
    {
      "cmd": "export DEMO_PASSWORD='correct horse battery staple'"
    },
    {
      "cmd": "node src/server.js > app.log 2>&1 &"
    },
    {
      "cmd": "until curl -s -o /dev/null localhost:3000/; do sleep 0.2; done"
    },
    {
      "cmd": "curl -s -o /dev/null localhost:3000/api/login -H 'content-type: application/json' -d '{\"name\": \"alice\", \"password\": \"wrong-password\"}'"
    },
    {
      "cmd": "ALICE=$(curl -s localhost:3000/api/login -H 'content-type: application/json' -d '{\"name\": \"alice\", \"password\": \"correct horse battery staple\"}' | jq -r .token)"
    },
    {
      "cmd": "curl -s -o /dev/null localhost:3000/api/invoices/1002 -H \"authorization: Bearer $ALICE\""
    },
    {
      "cmd": "curl -s -o /dev/null localhost:3000/api/preview -H \"authorization: Bearer $ALICE\" -H 'content-type: application/json' -d '{\"url\": \"http://169.254.169.254/\"}'"
    },
    {
      "cmd": "jq -c 'select(.event) | {time, level, event, ip, reqId}' app.log",
      "output": "{\"time\":\"2026-10-27T17:15:56.918Z\",\"level\":30,\"event\":\"sys_startup\",\"ip\":null,\"reqId\":null}\n{\"time\":\"2026-10-27T17:15:57.244Z\",\"level\":40,\"event\":\"authn_login_fail:alice\",\"ip\":\"127.0.0.1\",\"reqId\":\"3b648f44-3f4c-4af1-bef8-6d7a29d8c211\"}\n{\"time\":\"2026-10-27T17:15:57.405Z\",\"level\":30,\"event\":\"authn_login_success:alice\",\"ip\":\"127.0.0.1\",\"reqId\":\"0a9493e0-1c02-40cd-9d7f-72160fd497ac\"}\n{\"time\":\"2026-10-27T17:15:57.434Z\",\"level\":40,\"event\":\"authz_fail:alice,invoice 1002\",\"ip\":\"127.0.0.1\",\"reqId\":\"6a5b2742-17b9-4cbc-9de0-e2012ececb50\"}\n{\"time\":\"2026-10-27T17:15:57.464Z\",\"level\":40,\"event\":\"input_validation_fail:url,alice\",\"ip\":\"127.0.0.1\",\"reqId\":\"71173745-216c-4994-be67-86d226cbdbf9\"}"
    }
  ]
}
```

Levels are numbers in pino: 30 is `info` and 40 is `warn`. Note what is missing: the wrong password, the session token and the request bodies. The redaction list is a safety net for fields that end up in log calls by accident:

```terminal
{
  "title": "redaction",
  "prompt": "$",
  "steps": [
    {
      "cmd": "node --input-type=module -e \"import { createLogger } from './src/logger.js'; createLogger().info({ req: { headers: { authorization: 'Bearer abc123' } }, password: 'hunter2' }, 'redaction demo');\"",
      "output": "{\"level\":30,\"time\":\"2026-10-27T17:15:57.759Z\",\"service\":\"invoices\",\"req\":{\"headers\":{\"authorization\":\"[REDACTED]\"}},\"password\":\"[REDACTED]\",\"msg\":\"redaction demo\"}"
    }
  ]
}
```

Do not rely on it alone. Log specific fields instead of whole request objects, never log request bodies of authentication routes, and treat personal data in logs as personal data: subject to retention limits and access control.

## Log Injection

If logs are plain text lines, a user name containing a line break can forge a second, fake log line, and an attacker can hide activity or plant misleading entries. JSON logging prevents that, because the serializer escapes control characters inside the string:

```terminal
{
  "title": "a line break in a user name stays inside one event",
  "prompt": "$",
  "steps": [
    {
      "cmd": "curl -s -o /dev/null localhost:3000/api/login -H 'content-type: application/json' -d '{\"name\": \"bob\\n{\\\"event\\\":\\\"authn_login_success:admin\\\"}\", \"password\": \"x\"}'"
    },
    {
      "cmd": "tail -n 1 app.log",
      "output": "{\"level\":40,\"time\":\"2026-10-27T17:15:57.904Z\",\"service\":\"invoices\",\"event\":\"authn_login_fail:bob\\n{\\\"event\\\":\\\"authn_login_success:admin\\\"}\",\"ip\":\"127.0.0.1\",\"reqId\":\"79f0fe11-5094-400a-aad5-617c14ee951a\",\"msg\":\"login failed\"}"
    },
    {
      "cmd": "grep -c 'authn_login_success:admin' app.log",
      "output": "1"
    }
  ]
}
```

The fake event is inside the `event` string of a failed login, still one line, and a query on the `event` field will not mistake it for a real admin login. (The `grep -c` counts it, because grep reads text, not JSON fields; your log platform's parsed fields are what alerts should use.) If you must write plain text logs, encode or strip CR and LF in every user-supplied value. Also escape log data shown in log viewers and dashboards, since they are web pages too.

## Alerts That Someone Acts On

Detection needs a rule that turns events into a page or a ticket, and a person or team who owns it. With logs in a central system, alert rules are queries. These Loki rules from the companion repository fire on a client that keeps trying after the login rate limit refused it (the limiter logs each refusal as `authn_login_fail_max`), on a spike of failed logins across all accounts (credential stuffing from many addresses, each below the per-address limit), and on repeated access control failures from one address, a sign of someone walking through IDs:

```yaml
# A09 example: Loki alerting rules for the invoices app's JSON logs. They assume
# the log shipper sets the stream label service="invoices". Label regexes match the
# whole value and "." skips line breaks, so (?s) keeps a user name containing a line
# break from hiding an event.
groups:
  - name: invoices-security
    rules:
      - alert: LoginLimitHammered
        # authn_login_fail_max is logged for every request the rate limiter refuses
        expr: |
          sum by (ip) (
            count_over_time({service="invoices"} | json | event =~ "(?s)authn_login_fail_max:.*" [15m])
          ) > 10
        labels:
          severity: page
        annotations:
          summary: '{{ $labels.ip }} keeps trying to log in after hitting the rate limit'
          runbook: 'https://wiki.example.com/runbooks/credential-stuffing'

      - alert: LoginFailuresAcrossAccounts
        expr: |
          sum(count_over_time({service="invoices"} | json | event =~ "(?s)authn_login_fail:.*" [15m])) > 200
        labels:
          severity: page
        annotations:
          summary: 'Failed logins across all accounts are unusually high: possible credential stuffing'

      - alert: AccessDeniedBurst
        expr: |
          sum by (ip) (
            count_over_time({service="invoices"} | json | event =~ "(?s)authz_fail:.*" [10m])
          ) > 10
        labels:
          severity: ticket
        annotations:
          summary: 'More than 10 access control failures from {{ $labels.ip }} in 10 minutes'
```

The `(?s)` at the start of each regular expression matters: Loki matches the whole label value, and `.` does not match a line break, so without it a user name with a line break, like the one in the log injection example above, would hide its event from the alert. The rules pass `lokitool rules lint` and `lokitool rules check`. Even without a log platform you can run the same query by hand. From the session above:

```terminal
{
  "title": "failed logins per address",
  "prompt": "$",
  "steps": [
    {
      "cmd": "jq -r 'select(.event // \"\" | startswith(\"authn_login_fail\")) | .ip' app.log | sort | uniq -c",
      "output": "      2 127.0.0.1"
    },
    {
      "cmd": "kill %1"
    }
  ]
}
```

Good alerts have:

- **an owner and a runbook**: who responds, and what they check first;
- **thresholds from data**: start from your normal rate of failures, not a guess, and tune them so that alerts stay rare enough to be read; OWASP lists alert floods that hide real attacks as a failure in this category;
- **a test**: run the attack you want to detect against staging, for example a scripted series of failed logins, and confirm the alert fires. OWASP calls out penetration tests and DAST scans that trigger no alert as a failure; a passive scan such as the [ZAP baseline](/guides/owasp-top-10/05-security-misconfiguration#h2-scan-the-running-app-with-zap) sends no attacks, so check your active scans instead;
- **honeytokens**: fake credentials or records that no legitimate process uses, such as an API key in the database that is never issued. Any use of one is an attack, with almost no false positives.

## Protect the Logs

- **Ship logs off the host** as they are written. An attacker who controls a server can edit local files.
- **Make audit trails append-only**: a separate account or project for logs, object storage with a retention lock, or append-only database tables for business transactions.
- **Limit access** to logs, and log access to them.
- **Keep clocks synchronized** and timestamps in UTC, so events from different systems line up.
- **Keep the request ID** in every event of a request, and return it in error responses ([A02](/guides/owasp-top-10/05-security-misconfiguration#h2-errors-without-internals)), so a support ticket leads straight to the logs.

When an alert fires, follow an incident response plan. OWASP points to NIST SP 800-61; its third revision, published in April 2025, aligns incident response with the NIST Cybersecurity Framework 2.0.

The logging tests check the redaction and encoding behavior:

```terminal
{
  "title": "the logging tests",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "npm test -- tests/logging.test.js",
      "output": "> owasp-top-10-demo@1.0.0 test\n> node --test --test-reporter=spec tests/logging.test.js\n\n▶ A09 security logging\n  ✔ logs a failed login as one event, without the password (318.016047ms)\n  ✔ keeps a name with a line break inside one JSON log line (180.131927ms)\n✔ A09 security logging (692.941427ms)\nℹ tests 2\nℹ suites 1\nℹ pass 2\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 1600.297657"
    }
  ]
}
```

## Common Mistakes

- **Logging only successes**, or only failures, for logins.
- **Free-text messages** that alerts must parse with regular expressions.
- **Secrets and personal data in logs**: passwords, tokens, full request bodies.
- **Logs only on the host** where the attacker is.
- **Alerts without an owner**, or so many alerts that nobody reads them.
- **Never testing detection**: run the attack you want to detect, and check that the alert fires.

## Summary

- Log every security decision with a standard event name, the account, the client address and a request ID.
- Use structured JSON logs with redaction; never log credentials or request bodies of sensitive routes.
- JSON encoding stops log injection; escape log data wherever it is displayed.
- Write alert rules with owners, runbooks and tested thresholds, and add honeytokens.
- Ship logs off the host into append-only storage, and keep an incident response plan.

Next, [A10:2025 Mishandling of Exceptional Conditions](/guides/owasp-top-10/11-mishandling-exceptional-conditions), the new category, covers what happens when something goes wrong in the middle of a request.

## Keep Learning

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [Security Incident Response quiz](/quizzes/security-incident-response-quiz)
- [Monitoring and Observability checklist](/checklists/monitoring-observability)
- [On-Call Rotation and Escalation Policy checklist](/checklists/on-call-rotation-escalation-policy)
