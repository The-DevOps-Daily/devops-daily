---
title: 'When the Clock Is Wrong: TLS, JWT and Signed-Request Failures From Clock Skew'
excerpt: 'A few minutes of clock skew can look like a broken certificate, bad credentials, or an authentication regression. Learn how time checks fail, how to inspect Linux time sync, and how to alert before an incident.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2026-11-18'
publishedAt: '2026-11-18T07:00:00Z'
updatedAt: '2026-11-18T07:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Linux
  - NTP
  - chrony
  - TLS
  - JWT
  - Troubleshooting
  - Incident Response
---

A certificate can be freshly renewed and still be "not yet valid." A JWT can be correctly signed and still fail `iat` or `nbf`. An AWS request can have the right key and receive `RequestTimeTooSkewed`. When those symptoms arrive together, stop rotating credentials and check time first. A clock is an input to each decision, and a host that is only slightly early or late can turn an infrastructure problem into an authentication-looking incident.

This post maps the time check behind each failure, shows safe reproductions without changing a machine clock, and gives a Linux response path that makes loss of sync visible before users find it.

## TL;DR

- TLS validation compares the verifier's current time with `notBefore` and `notAfter`. It has no protocol-level grace period.
- JWT leeway is a verifier policy. PyJWT accepts a `leeway` argument, and its default is zero when you do not pass one.
- S3 documents a 15-minute request timestamp limit. MIT Kerberos defaults to 300 seconds. TOTP recommends 30-second steps and at most one step for network delay.
- On Linux, first check `timedatectl`, then use `chronyc tracking` and `chronyc sources -v` when chrony is your time daemon.
- Correct the host clock, not a container clock. Alert on sync state and offset, then preserve UTC timestamps and offsets in incident logs.

## Prerequisites

- Shell access to a Linux host or VM.
- Permission to inspect the active time service. Correcting time needs an approved change path because a clock step can surprise applications.
- `chrony` installed if you use the chrony commands and configuration below.
- OpenSSL and Python with PyJWT if you want to repeat the two local demonstrations.

## The time window behind the error

The same skew produces different errors because each protocol asks a different question. [RFC 5280](https://www.rfc-editor.org/rfc/rfc5280) requires certificate path validation to include the current time in the certificate validity period. [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519) defines `nbf`, `exp`, and `iat` as NumericDate-based claims. SigV4 includes a UTC request timestamp in the signature input. TOTP derives its moving value from time.

| Check           | Time comparison                                       | Documented tolerance                                                                                                                                                          | Typical symptom                                                                       |
| --------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| TLS certificate | Local verifier time versus `notBefore` and `notAfter` | None in the certificate validity check                                                                                                                                        | `certificate is not yet valid` or expired                                             |
| JWT             | Verifier time versus `nbf`, `exp`, and possibly `iat` | Library policy. [PyJWT 2.15.1 defaults to 0](https://github.com/jpadilla/pyjwt/blob/2.15.1/jwt/api_jwt.py); RFC 7519 permits small leeway, usually no more than a few minutes | `ImmatureSignatureError`, expired token                                               |
| AWS SigV4       | Signed request timestamp versus AWS time              | S3 rejects a difference greater than 15 minutes                                                                                                                               | `RequestTimeTooSkewed`; other signature paths can report signature mismatch or expiry |
| MIT Kerberos    | Client or service time versus KDC time                | `clockskew` default: 300 seconds                                                                                                                                              | `Clock skew too great`                                                                |
| TOTP            | Prover time step versus validator time step           | RFC 6238 recommends a 30-second step and at most one step for network delay                                                                                                   | A correct-looking code is rejected                                                    |

The S3 limit and error name come from [AWS's request authentication documentation](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/RESTAuthentication.html). AWS also documents `SignatureDoesNotMatch` and the `Signature expired` diagnostic for SigV4 troubleshooting in its [IAM guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-troubleshooting.html). MIT documents its 300-second default in [`krb5.conf`](https://web.mit.edu/Kerberos/www/krb5-current/doc/admin/conf_files/krb5_conf.html). RFC 6238 calls for a [30-second default step and at most one step of delay](https://www.rfc-editor.org/rfc/rfc6238#section-5.2). Those numbers are useful triage boundaries, not a reason to let time drift until the next boundary.

## Prove TLS time failures without changing the host clock

Do not set a workstation's clock backward to test certificate behavior. OpenSSL's [`-attime` verification option](https://docs.openssl.org/3.0/man1/openssl-verification-options/) supplies the verification time instead. That isolates the test from package updates, log ordering, token expiry, and every other process on the machine.

This run creates a local CA that began 30 days earlier and two leaf certificates issued at the run time. One leaf starts at issuance. The other has `notBefore` one hour earlier. The verifier clock is then simulated 10 minutes behind, and then 8 days ahead.

```terminal
{
  "title": "verify certificates at simulated times",
  "prompt": "$",
  "steps": [
    { "cmd": "openssl x509 -in leaf-now.pem -noout -startdate", "output": "notBefore=Nov 11 13:33:26 2026 GMT" },
    { "cmd": "openssl x509 -in leaf-backdated.pem -noout -startdate", "output": "notBefore=Nov 11 12:33:26 2026 GMT" },
    { "cmd": "openssl verify -CAfile ca.pem -attime 1794403407 leaf-now.pem          # verifier clock 10 min behind", "output": "CN = api.example.com\nerror 9 at 0 depth lookup: certificate is not yet valid\nerror leaf-now.pem: verification failed" },
    { "cmd": "openssl verify -CAfile ca.pem -attime 1794403407 leaf-backdated.pem    # same clock, notBefore 1 h earlier", "output": "leaf-backdated.pem: OK" },
    { "cmd": "openssl verify -CAfile ca.pem -attime $(( $(date +%s) + 8*86400 )) leaf-now.pem   # verifier clock 8 days ahead", "output": "CN = api.example.com\nerror 10 at 0 depth lookup: certificate has expired\nerror leaf-now.pem: verification failed" }
  ]
}
```

The result is not a claim about every public CA's issuance policy. It shows the direct consequence of the two validity timestamps: a verifier behind the issuing clock rejects the first leaf, while the locally backdated leaf passes. OpenSSL documents that it reports not-yet-valid or expired when the verification time is outside the validity window.

Shorter certificate lifetimes mean renewal happens more often. That increases the frequency of encounters with newly issued certificates, not the size of the clock error needed to fail. Check your renewal automation as described in [our 64-day certificate renewal check](/posts/lets-encrypt-64-day-certificates-renewal-check), and use the [SSL/TLS Handshake Simulator](/games/ssl-tls-handshake) to review where certificate validation belongs in the handshake.

## JWTs: a small leeway is a policy, not a clock fix

RFC 7519 says an implementation **may** provide small leeway, usually no more than a few minutes, for clock skew. It does not choose a value for you. PyJWT's [`decode()` examples](https://pyjwt.readthedocs.io/en/stable/usage.html) show that `leeway` can be seconds or a `datetime.timedelta`; its [2.15.1 source](https://github.com/jpadilla/pyjwt/blob/2.15.1/jwt/api_jwt.py) sets the default to zero.

Here is the complete local demonstration. The issuer clock is 90 seconds ahead of the verifier. The token has `iat`, `nbf`, and `exp`, so a validator that checks issued-at time rejects it before it is valid.

```python
# Clock skew demo for JWTs: the issuer's clock runs 90 seconds ahead of the API that validates the token.
import time, jwt

SECRET = "demo-secret-not-for-production-use-only"
skew = 90  # issuer clock minus verifier clock, in seconds
issuer_now = int(time.time()) + skew
token = jwt.encode({"sub": "svc-billing", "iat": issuer_now, "nbf": issuer_now, "exp": issuer_now + 300}, SECRET, algorithm="HS256")

for leeway in (0, 30, 120):
    try:
        jwt.decode(token, SECRET, algorithms=["HS256"], leeway=leeway)
        print(f"leeway={leeway:>3}s  accepted")
    except jwt.PyJWTError as e:
        print(f"leeway={leeway:>3}s  rejected: {type(e).__name__}: {e}")
```

```text
$ python jwt_skew.py   # PyJWT 2.15.1, issuer clock 90 s ahead of the verifier
leeway=  0s  rejected: ImmatureSignatureError: The token is not yet valid (iat)
leeway= 30s  rejected: ImmatureSignatureError: The token is not yet valid (iat)
leeway=120s  accepted
```

The 120-second value makes the test pass. It does not make a 90-second clock difference healthy. For a service, use a deliberately small policy allowance, such as 30 to 60 seconds if the threat model permits it, alert when it is consumed, and fix time sync. Never use a client-supplied timestamp as the authority for a security decision. Signed webhook schemes have the same replay-window concern, so keep the sender timestamp, receive time, and verifier decision in the delivery record. See [what production webhook delivery needs](/posts/reliable-webhook-delivery-retries-signatures-idempotency) for the surrounding signature and retry design.

## Inspect the Linux time path before restarting auth services

Start with the service-independent view:

```bash
timedatectl
```

Inspect `System clock synchronized` and `NTP service`. On a host using systemd-timesyncd, `timedatectl timesync-status` reports the selected server, leap state, offset, delay, jitter, and poll interval. The [systemd `timedatectl` manual](https://www.freedesktop.org/software/systemd/man/latest/timedatectl.html) documents those fields.

On a chrony host, inspect both the remaining system correction and the sources:

```bash
chronyc tracking
chronyc sources -v
```

In `tracking`, `System time` is the remaining offset between chronyd's NTP clock and the system clock. `Leap status: Not synchronised` is a bad state. In `sources -v`, `Reach` is an eight-bit octal reachability register, so `377` means a valid response on each of the last eight polls. A `?` source is not selectable, including when it is unreachable. Chrony's [`chronyc(1)` manual](https://chrony-project.org/doc/latest/chronyc.html) defines these fields and their selection markers.

The common failure modes are mundane:

- A device without a working RTC can boot at an old time and needs a usable time source before time-sensitive work starts. systemd-timesyncd records a synchronized time to help advance a machine without a battery-backed RTC on a later boot, but does not hold all units until accurate synchronization by default. See the [systemd-timesyncd manual](https://www.freedesktop.org/software/systemd/man/latest/systemd-timesyncd.service.html).
- A paused or restored VM can resume with stale time. [Chrony's FAQ](https://chrony-project.org/faq.html) calls out a virtual machine that is suspended and resumed with an incorrect time as a case that may need stepping on any clock update, not only at boot.
- A firewall rule can block NTP's UDP port 123. When `chronyc sources` shows no valid responses from a server, the [chrony FAQ](https://chrony-project.org/faq.html) points first at a firewall blocking requests to UDP port 123 or the replies.
- A Linux container shares the host kernel, so the container cannot independently repair the host's system clock. Fix the node or VM that owns the kernel. [Docker's container explanation](https://docs.docker.com/learn/content/what-is-a-container/) describes that shared-kernel model.

## Correct time safely, then make loss of sync noisy

Chrony normally slews a correction, which avoids a sudden jump but can take a long time for a large offset. Its [`makestep threshold limit` directive](https://chrony-project.org/doc/latest/chrony.conf.html) controls when it may jump instead. A useful boot-time policy is:

```text
# /etc/chrony.conf
# Step offsets over 1 second during the first three clock updates.
makestep 1.0 3

# Replace these with separate, approved NTS-capable sources.
server ntp-a.example.net iburst nts
server ntp-b.example.net iburst nts
```

The `nts` option enables Network Time Security, and chrony documents it as available since chrony 4.0. If a host is currently wrong and the operational impact of a jump has been assessed, `chronyc makestep` immediately applies the remaining correction. Chrony's manual warns that time jumps can seriously affect some software. Confirm the source state first, make the correction in the approved window, then re-run `chronyc tracking`.

For Prometheus, node_exporter's timex collector exposes `node_timex_offset_seconds` and `node_timex_sync_status`. Its [source](https://github.com/prometheus/node_exporter/blob/master/collector/timex.go) defines the former as offset between the local and reference clocks and the latter as `1` for synchronized and `0` for unsynchronized. Start with a rule that catches loss of sync or a sustained offset, then tune the threshold to the most time-sensitive system you operate:

```yaml
groups:
  - name: clock-health
    rules:
      - alert: NodeClockNotSynchronized
        expr: node_timex_sync_status == 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Node clock is not synchronized'
      - alert: NodeClockOffsetHigh
        expr: abs(node_timex_offset_seconds) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Node clock offset exceeds 50 ms'
```

`node_timex_sync_status` depends on the kernel time synchronization flag. Node exporter notes that time daemons must maintain that flag correctly, so pair the alert with the daemon's own status and `chronyc tracking` during investigation.

## Incident checklist

1. Record the failing host's UTC time, offset, synchronization state, source reachability, and the exact verifier error before changing anything.
2. Compare issuer, verifier, and identity-provider times. Do not assume that a successful `date` command on one pod says anything about the node behind another service.
3. Repair the source or network path, then use a safe step policy when the offset is too large to slew promptly.
4. Retest one TLS verification with `-attime`, one JWT with its configured leeway, and one signed request after the host reports synchronized.
5. Keep logs in UTC, include an offset where available, and return the server time in safe error responses. This makes cross-host event ordering possible without exposing sensitive details.

Time is shared infrastructure. Treat it like DNS or certificate trust: monitor it, make dependencies wait where they need accurate time, and investigate divergence before widening every authentication window.
