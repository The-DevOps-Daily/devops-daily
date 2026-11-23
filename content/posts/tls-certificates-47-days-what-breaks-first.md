---
title: 'TLS Certificates Are Going to 47 Days: What Breaks First in Your Renewal Automation'
excerpt: 'Public TLS certificates have been capped at 200 days since March 2026, drop to 100 in 2027 and to 47 in 2029. We scanned the top 10,000 sites, read the renewal and alert defaults of 12 tools at pinned versions, and computed what each one does at every step. The ACME clients that follow ARI or renew at two thirds of the lifetime are ready. The settings around them are not: alert thresholds fixed in days, monthly jobs, change windows, copies on other machines and pinned keys.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2026-11-26'
publishedAt: '2026-11-26T15:00:00Z'
updatedAt: '2026-11-26T15:00:00Z'
readingTime: '17 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Networking
  - TLS
  - Certificates
  - Let's Encrypt
  - Monitoring
  - Automation
---

On 23 November 2026 we scanned the top 10,000 sites. **1,631 of 15,088 hostnames (10.8%) still serve a certificate issued before 15 March 2026**, most of them valid for about a year. Almost all of those certificates expire between December and April. Whatever replaces them is subject to the new limits: at most 200 days if it is issued before 15 March 2027, and at most 100 days after that. A certificate that was renewed once a year will be renewed about three times a year from now, five or six times a year from 2027, and about twelve times a year from 2029, if it is renewed at two thirds of its lifetime.

We also read the renewal and alert defaults of 12 tools from their source code at pinned versions, and computed what each default does at every lifetime step. The ACME clients that follow ARI, or renew at two thirds of the lifetime without it, keep working at every step. What fails earlier is the setup around them: alert thresholds fixed in days, renewal jobs that run monthly, change windows, certificate copies on machines the renewal hook does not reach, and pinned keys. One example: at 47 days, the default 28-day warning of the x509-certificate-exporter Helm chart is active on every certificate before every renewal, 11.6 times a year and 39% of the time, even when nothing is wrong.

## TL;DR

- **The schedule** (Baseline Requirements 2.3.1, sections 6.3.2 and 4.2.1): at most 200 days from 15 March 2026, 100 days from 15 March 2027, 47 days from 15 March 2029. Domain validation data can be reused for 200, then 100, then **10 days**. Let's Encrypt has its own schedule: 64 days from 10 February 2027 and 45 days from 16 February 2028.
- **What the top 10,000 sites serve:** 53.4% of trusted hostnames use certificates of 91 days or less, mostly from Let's Encrypt and Google Trust Services. 35.2% use certificates of 101 to 200 days, nearly all 198 or 199 days (Amazon, DigiCert, GlobalSign, Sectigo). 10.8% still use a certificate issued before March.
- **Copies can fall behind.** 43 of 9,359 hostnames with several addresses served different certificates on different addresses. On 7 of them (4 domains), one address served a certificate that was 81% to 89% through its lifetime, while another address served a newer certificate with the same name count and the same first five names. None of the old copies had expired, and 6 of the 7 still served both certificates an hour later.
- **No margin since March 2026:** a process that only changes certificates in a quarterly change window. With a 200-day certificate it has 16 days left at best and none after one missed window.
- **With Let's Encrypt's 64 days (February 2027):** a monthly renewal job has 2 days of margin at best. acme.sh 3.0.7 with its default renews about 5 days before expiry. A 28-day expiry warning goes off before every renewal.
- **At 47 days:** with renewal at two thirds of the lifetime, monthly and quarterly renewal schedules let certificates expire even when every run succeeds. A renewal every 31 days cannot reuse the validation from the previous renewal, which is more than 10 days old. Every manual copy of a certificate has to be redone about 12 times a year.
- **The repository** has the scan, the defaults with file and line references, the schedule model, and a read-only checker for your own configs, crontabs and alert rules.

## Prerequisites

- Shell access to the machines, repositories or Kubernetes manifests that issue, deploy or monitor your certificates
- Python 3.9 or later to run the checker (no dependencies)
- To reproduce the scan: Python 3.12 with `cryptography`, and outbound port 443

Everything we ran and every output file is in the repository:

```github
https://github.com/The-DevOps-Daily/tls-47-day-breakpoints
```

## The schedule, from the Baseline Requirements

The CA/Browser Forum adopted ballot SC-081 in April 2025. We read the limits from the current Baseline Requirements (version 2.3.1, pinned at commit `3574ae8` of `cabforum/servercert`), not from news coverage:

| Certificate issued   | Maximum validity | Domain validation reuse |
| -------------------- | ---------------- | ----------------------- |
| before 15 March 2026 | 398 days         | 398 days                |
| from 15 March 2026   | 200 days         | 200 days                |
| from 15 March 2027   | 100 days         | 100 days                |
| from 15 March 2029   | 47 days          | 10 days                 |

Some details matter for automation:

- **The date that counts is the issue date of the new certificate.** A certificate that expires in April 2027 but is replaced in February 2027 can get up to 200 days.
- **The limit is inclusive.** Validity is "the period of time from `notBefore` through `notAfter`, inclusive", and certificates SHOULD NOT exceed 199, 99 and 46 days. That is why the commercial CAs now issue 198 or 199 days. In our scan, Amazon issued 198 days, and DigiCert, Sectigo and GlobalSign 199 days.
- **Organization checks stay longer.** Subject identity information (the organization details in OV certificates) can still be reused for 398 days. The short cycle applies to domain control.
- **The validation methods change too.** Email to a constructed address (`admin@`, `hostmaster@` and similar, method 3.2.2.4.4) and email to a DNS CAA or TXT contact SHOULD NOT be used since 15 March 2026, and MUST NOT be used from 15 March 2028. Phone contact through DNS TXT or CAA records ends on 15 March 2027. If someone on your team clicks a link in a validation email, that step needs replacing.
- **A new method makes 10 days workable.** Method 3.2.2.4.22, "DNS TXT Record with Persistent Value", lets you publish a `_validation-persist` TXT record once, bound to your CA account. The CA can reuse such a validation for only 10 days, but it can check the record again without any change on your side. acme.sh 3.1.7 already supports it as `dns-persist-01`.

Let's Encrypt has its own, faster schedule, which we tested in an earlier post: [64-day certificates from 10 February 2027](/posts/lets-encrypt-64-day-certificates-renewal-check), and 45 days from February 2028. For many sites, the first step that matters is Let's Encrypt's, not the Forum's.

Renewals per year follow from the lifetime and the renewal rule. Here are two common rules: renew at two thirds of the lifetime (certbot, cert-manager and Caddy without ARI), and renew 30 days before expiry:

```chart
{
  "type": "line",
  "title": "Renewals per certificate per year, by lifetime step",
  "x": ["398 days (before 2026-03-15)", "200 days (2026-03-15)", "100 days (2027-03-15)", "47 days (2029-03-15)"],
  "series": [
    { "name": "renew at 2/3 of the lifetime", "data": [1.38, 2.74, 5.48, 11.65], "color": "#10b981" },
    { "name": "renew 30 days before expiry", "data": [0.99, 2.15, 5.21, 21.47], "color": "#f59e0b" }
  ],
  "caption": "Computed from the maximum lifetime at each step, 365-day year. The 30-day rule is certbot 2.9's default and what Traefik 3.8 does with its default 90-day setting. Source: results/02-schedule.md."
}
```

At 47 days, the 30-day rule renews 21 times a year, almost twice as often as the two-thirds rule. That works, but every step in the chain runs 21 times a year, including any step a person has to do.

## How we measured it

There are three parts. Each is a separate script that writes a file the next one reads.

**1. Defaults, read from source.** `01_fetch_defaults.py` downloads 18 files at pinned tags or commits and extracts each default with a regular expression. It records the line number and a hash of the file, and stops if a pattern no longer matches. Renewal side: certbot 5.10.0 and 2.9.0, cert-manager 1.21.3, CertMagic 0.25.6 (Caddy), Traefik 3.8.0, win-acme 2.4.1, acme.sh 3.0.7 and 3.1.7. Alert side: the x509-certificate-exporter 4.2.4 Helm chart, check_ssl_cert 2.103.6, the awesome-prometheus-alerts blackbox rules, the Datadog TLS check, Uptime Kuma 2.5.12 and cert-manager-mixin 1.6.0.

**2. The schedule.** `02_schedule.py` applies each rule to each lifetime, with no network and no randomness. It computes the renewal day, the days left, the renewals per year, the margin when renewal only runs every N days, and how long each alert stays active on a certificate that renews on time. Most clients follow ARI when the CA offers it, so for non-Let's Encrypt steps these are the fallback rules without ARI. For Let's Encrypt it uses the ARI windows we measured on staging in the 64-day post (day 42.04 to 43.32 of 64, day 29.56 to 30.46 of 45), with renewal at the end of the window, the worst case.

**3. The scan.** `04_scan.py` took the top 10,000 domains of Tranco list `8PW6V` (created 22 November 2026) and their `www.` names, and resolved every IPv4 address, up to eight per name. On each address it opened up to two TLS connections without verification, to read the leaf certificate even when it is expired or for the wrong name, and one connection with verification against the system trust store of the droplet (Ubuntu 24.04, `ca-certificates` 20260816, recorded in `results/04-scan-environment.txt`). If the first connection failed, it skipped the other two. It sent no HTTP requests. The run took nine minutes from one droplet in Frankfurt. An hour later, `04b_rescan_mixed.py` scanned every hostname with more than one certificate again.

```terminal
{
  "title": "the scan, on 23 November 2026",
  "prompt": "$",
  "steps": [
    { "cmd": "python3 scripts/04_scan.py 200", "output": "500/10000 domains, 694 distinct certificates\n1000/10000 domains, 1207 distinct certificates\n1500/10000 domains, 1640 distinct certificates\n2000/10000 domains, 2244 distinct certificates" },
    { "comment": "15 more progress lines" },
    { "output": "10000/10000 domains, 10457 distinct certificates\nwrote 04-scan.jsonl.gz, 04-certs.jsonl.gz: 37393 rows, 10457 certificates, stamp e69be3da9b42575c" },
    { "cmd": "python3 scripts/05_analyze.py | sed -n 5,7p", "output": "- 10000 domains, 16431 hostnames resolved (apex and www), 3561 did not\n- 15510 hostnames returned a certificate, 15088 of them a publicly trusted one on at least one address (8058 domains)\n- 10457 distinct leaf certificates" }
  ]
}
```

## What the top 10,000 sites serve

```chart
{
  "type": "bar",
  "title": "Lifetime of the certificate each trusted hostname serves",
  "unit": "%",
  "rows": [
    { "label": "47 days or less", "value": 0.76, "series": "short" },
    { "label": "48 to 91 days", "value": 52.61, "series": "short" },
    { "label": "92 to 100 days", "value": 0.64, "series": "short" },
    { "label": "101 to 200 days", "value": 35.18, "series": "200" },
    { "label": "201 to 398 days (issued before 2026-03-15)", "value": 10.81, "series": "old" }
  ],
  "series": [
    { "name": "short", "color": "#10b981" },
    { "name": "200", "color": "#f59e0b" },
    { "name": "old", "color": "#ef4444" }
  ],
  "caption": "15,088 hostnames that served a publicly trusted certificate on at least one address, Tranco top 10,000 plus www names, scanned 2026-11-23. Per hostname we count the certificate served most often across its addresses. Source: results/05-summary.md."
}
```

The issuers explain the shape:

- **48 to 91 days** (7,938 hostnames): Google Trust Services (4,272) and Let's Encrypt (3,423). Google's certificates last 90 days and about an hour, so we put the edge at 91 days.
- **101 to 200 days** (5,308): Amazon (1,692), DigiCert (1,535), GlobalSign (629) and Sectigo (550). 4,894 of these hostnames serve a certificate of 198 or 199 days, so the commercial CAs issue close to the maximum.
- **201 to 398 days** (1,631): the same commercial CAs. All of these certificates were issued before 15 March 2026, and the longest is 397 days.
- **47 days or less** (115): already in use. Fastly's CA, Certainly, issues 30-day certificates (77 hostnames), and Let's Encrypt's opt-in 45-day profile appeared on 6 certificates (10 hostnames).

We found no certificate issued on or after 15 March 2026 (by its `notBefore`) with more than 200 days on any hostname that passed verification.

The 1,631 hostnames with pre-March certificates share 1,082 distinct certificates. This is when they expire:

```chart
{
  "type": "bar",
  "title": "When the pre-March certificates still in use expire",
  "rows": [
    { "label": "Nov 2026", "value": 14 },
    { "label": "Dec 2026", "value": 236 },
    { "label": "Jan 2027", "value": 399 },
    { "label": "Feb 2027", "value": 507 },
    { "label": "Mar 2027", "value": 405 },
    { "label": "Apr 2027", "value": 70 }
  ],
  "caption": "Hostnames serving a publicly trusted certificate longer than 200 days, issued before 2026-03-15, by notAfter month. 217 hostnames (136 certificates) expire on or after 2027-03-15. Source: results/05-summary.json, section C."
}
```

Any replacement issued for these certificates from now on is subject to the new limits. A team that bought a one-year certificate in early 2026 renews this winter and gets a certificate of at most 200 days. If that renewal is a calendar reminder set for next year, the new certificate expires in the summer, about six months before the reminder. If the replacement is issued after 15 March 2027, it gets at most 100 days.

### Hostnames that serve two different certificates

When a certificate is copied to several machines (load balancer nodes, regional servers, an origin and its CDN), the copies can fall behind. A copy that a renewal never reached keeps its old certificate until someone replaces it or it expires.

Of 9,359 hostnames that answered on two or more addresses, **43 (0.46%) served more than one distinct certificate**. Most of these have normal reasons: different keys per region, two CAs on purpose, or a rollout in progress. We looked for one specific pattern: two certificates from the same CA, with the same lifetime, the same number of names and the same first five names (the scan kept only the first five), issued a month or more apart. 13 hostnames matched. On 7 of them (4 domains, all with Let's Encrypt 90-day certificates), the older certificate was 81% to 89% through its lifetime, past the usual two-thirds renewal point. Another address of the same hostname served the newer certificate, issued between 0.6 and 17 days before the scan. The extreme case was 9.8 days left on one address and 89.4 on the other. None of the old copies had expired, and all of them passed verification.

We scanned every hostname that had served more than one certificate again 1.03 hours later. 41 of the 43 still served more than one, and 6 of the 7 hostnames with an old copy past 80% of its lifetime still served both certificates. The seventh now served only the new one, so for that hostname the first scan caught a rollout in progress. An hour does not rule out a slow rollout for the other six, so we only report that the pattern persisted. Separately, 3 hostnames had one address that failed verification with a name mismatch while another passed, both times.

These are 7 hostnames out of 9,359, a small share, and the scan only sees the addresses our resolver returned. Two explanations fit the data: a renewal that did not reach every address, or independent servers that each renew on their own schedule. Either way, one address still served a certificate after the newer one had been out for up to 17 days. With 47-day certificates renewed at two thirds of the lifetime, a copy has 15.7 days left when the new certificate is issued. A copy that stays behind for 17 days serves an expired certificate.

## What breaks, and when

`02_schedule.py` applies each default to each step. In date order:

| From                             | Lifetime     | What fails                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| already, with Let's Encrypt      | 90 days      | A quarterly change window: even with every run on time, renewal comes 2 days after expiry. A monthly job: 28 days left when every run is on time, but 1.9 days too late in the worst case. Traefik with `certificatesDuration` set to a year renews 120 days before expiry, so on every weekly check (our [nginx vs Traefik comparison](/comparisons/nginx-vs-traefik) covers how each handles ACME).                   |
| 15 March 2026 (already)          | 200 days     | Yearly renewal by hand: the certificate expires 165 days before the reminder. A quarterly change window: 16 days left when every window is used, and expired after one missed window.                                                                                                                                                                                                                                   |
| 10 February 2027 (Let's Encrypt) | 64 days      | A monthly renewal job: 2 days left when every run is on time. acme.sh 3.0.7 with its default renews about 5 days before expiry. The x509-certificate-exporter default warning is active before every renewal, 8.4 times a year.                                                                                                                                                                                         |
| 15 March 2027                    | 100 days     | Replacements issued from this date get at most 100 days. A monthly job has 7 days left when every run is on time, 2.3 in the worst case.                                                                                                                                                                                                                                                                                |
| 16 February 2028 (Let's Encrypt) | 45 days      | certbot with `renew_before_expiry = 60 days` renews on every run, twice a day. Renewals that are not ARI replacements count against Let's Encrypt's limit of 5 certificates per exact set of names per 7 days. check_ssl_cert's default critical (15 days) goes off on a certificate renewed at the end of the ARI window (14.5 days left). acme.sh 3.0.7's default renews about 14 days after the certificate expired. |
| 15 March 2028                    | (validation) | Email to `admin@`, `hostmaster@` and other constructed addresses, and email to DNS CAA or TXT contacts, can no longer be used for domain validation.                                                                                                                                                                                                                                                                    |
| 15 March 2029                    | 47 days      | Monthly and quarterly renewal schedules, with renewal at two thirds of the lifetime: certificates expire even with every run on time. A renewal every 31 days cannot reuse the validation from the previous renewal, which is more than 10 days old. win-acme's defaults without ARI (55 days after issue, at least 7 days left) renew with 7 days left. Every manual copy has to be redone about 12 times a year.      |

Two of these need more explanation.

### The renewal job must run more often than the window

A client that renews at two thirds of the lifetime has a renewal window of one third of the lifetime: 66.7 days at 200, 33.3 at 100, 15.7 at 47. If the job that runs the client only runs every N days, two numbers matter:

- **Issued on a run:** the certificate was issued by a scheduled run, so renewal happens on the first run after the two-thirds point.
- **Any phase:** the renewal point falls just after a run, so the next run is up to N days later. This happens when a manual or early renewal has moved the certificate off the schedule.

Both assume that the renewal run succeeds. A failed run adds one more interval: at 100 days, a monthly job that fails once renews 24 days after expiry. Days left at renewal, issued on a run / any phase:

| Job runs                   | 200 days       | 100 days      | 64 days (LE, ARI window end) | 47 days         |
| -------------------------- | -------------- | ------------- | ---------------------------- | --------------- |
| twice a day                | 66.5 / 66.2    | 33 / 32.8     | 20.5 / 20.2                  | 15.5 / 15.2     |
| daily                      | 66 / 65.7      | 33 / 32.3     | 20 / 19.7                    | 15 / 14.7       |
| weekly                     | 60 / 59.7      | 30 / 26.3     | 15 / 13.7                    | 12 / 8.7        |
| monthly (31 days)          | 45 / 35.7      | 7 / 2.3       | 2 / **-10.3**                | **-15 / -15.3** |
| quarterly window (92 days) | 16 / **-25.3** | 8 / **-58.7** | **-28 / -71.3**              | **-45 / -76.3** |

A negative number means the certificate expires before the run that renews it. The same jobs with a "30 days before expiry" rule have more room at 47 days: a monthly run then renews on day 31, with 16 days left. certbot's packaged timer runs twice a day, so leave it as it is. The risk is in homemade cron entries such as `0 3 1 * * certbot renew`, and in organizations where certificates can only change in a change window.

### Alert thresholds fixed in days

An expiry alert fixed in days fits one lifetime. At 47 days, a certificate renewed at two thirds of its lifetime has 15.7 days left at renewal. Any warning threshold above that is active on every certificate before every renewal, even when renewal works:

```chart
{
  "type": "bar",
  "title": "Days per year in warning, on one certificate that renews on time, at 47 days",
  "unit": " days",
  "rows": [
    { "label": "x509-certificate-exporter chart (warning 28 days)", "value": 143.7, "series": "noisy" },
    { "label": "check_ssl_cert (warning 20 days)", "value": 50.5, "series": "noisy" },
    { "label": "awesome-prometheus-alerts blackbox (warning 20 days)", "value": 50.5, "series": "noisy" },
    { "label": "Datadog TLS check (warning 14 days)", "value": 0, "series": "quiet" },
    { "label": "cert-manager-mixin (relative to the renewal time)", "value": 0, "series": "quiet" }
  ],
  "series": [
    { "name": "noisy", "color": "#ef4444" },
    { "name": "quiet", "color": "#10b981" }
  ],
  "caption": "Defaults read from source at pinned versions (results/01-defaults.json). Renewal at 2/3 of the lifetime, 11.65 renewals a year. Time below the threshold, not a count of notifications: evaluation intervals, 'for' durations and repeats are not modelled. The blackbox rule rounds to 0.1 day, which gives about 49.9. Uptime Kuma's default thresholds of 21, 14 and 7 days are crossed at 21 days once per cycle, 11.6 times a year. Source: results/02-schedule.md."
}
```

Let's Encrypt users reach this earlier. At 64 days, with renewal at the end of the measured ARI window, 20.7 days are left. The x509-certificate-exporter default of 28 days is then active for 7.3 days before every renewal, 8.4 times a year, from February 2027. At 45 days in 2028, check_ssl_cert's critical threshold of 15 days goes off too, because the window ends with 14.5 days left. The comment next to the x509-certificate-exporter default shows it was chosen with 90-day certificates in mind: "cert-manager would renew Let's Encrypt certs before day 29".

The critical thresholds leave little room as well. At 47 days, the x509-certificate-exporter's critical threshold of 14 days goes off 1.7 days after a renewal should have happened. Two days of failed renewals page someone, which is maybe what you want, but it should be a decision.

One default in our list already avoids the problem. cert-manager-mixin 1.6 compares the time left with the time between the planned renewal and expiry, and its alert fires when 30% of that time has passed without a renewal. That threshold scales with the lifetime. Datadog's 14-day warning also stays quiet at every step, but only because 14 is below 15.7.

For certificates that renew at about two thirds of their lifetime, a Prometheus rule that does not depend on the lifetime looks like this:

```yaml
# Warn when a certificate has used more than 80% of its lifetime.
# x509-certificate-exporter only exports x509_cert_not_before
# when exposeNotBeforeMetric: true is set in its chart (default false).
- alert: CertificatePastRenewalPoint
  expr: |
    (time() - x509_cert_not_before) / (x509_cert_not_after - x509_cert_not_before) > 0.8
  for: 6h
  labels:
    severity: warning
# Keep a small absolute floor for the case where renewal never runs at all.
- alert: CertificateExpiresVerySoon
  expr: x509_cert_not_after - time() < 7 * 86400
  labels:
    severity: critical
```

With renewal at 67% of the lifetime, the 80% threshold gives 6 days of slack at 47 days and 27 days at 200. Set the share above the point where your client renews: a client that renews 30 days before expiry on a 200-day certificate is at 85%, so 0.8 would warn before every renewal. For the blackbox exporter, which does not expose `notBefore`, alert on failed renewals from the client itself and keep the absolute floor. To probe what each endpoint actually serves, with a threshold relative to the lifetime, see [Monitor Certificate Expiry](/guides/cryptography-essentials/03-tls-ssl#h2-monitor-certificate-expiry) in our TLS chapter.

## Every copy is a renewal you have to remember

The ACME client renews one file. Every other place that holds the certificate has to get the new one too:

```diagram
{
  "type": "graph",
  "title": "Where one renewal has to go",
  "columns": [
    [
      { "id": "ca", "label": "CA", "sub": "about every 31 days at 47", "icon": "shield", "tone": "violet" }
    ],
    [
      { "id": "client", "label": "ACME client", "sub": "certbot, acme.sh, cert-manager", "icon": "gear", "tone": "blue", "detail": "Renews the file on this host. Deploy hooks run after each successful renewal; anything outside the hooks needs something else to run it." }
    ],
    [
      { "id": "nginx", "label": "nginx on this host", "sub": "reload in the hook", "icon": "server", "tone": "green", "status": "ok" },
      { "id": "lb", "label": "Load balancer", "sub": "imported certificate", "icon": "net", "tone": "amber", "status": "warn", "detail": "AWS ACM does not renew imported certificates. Re-import them from the deploy hook, or let ACM issue its own." },
      { "id": "cdn", "label": "CDN or WAF", "sub": "uploaded by hand", "icon": "cloud", "tone": "amber", "status": "warn", "detail": "A custom certificate upload is a manual step about 12 times a year at 47 days. Most CDNs can issue and renew their own." },
      { "id": "box", "label": "Appliance", "sub": "PKCS#12 import", "icon": "cpu", "tone": "red", "status": "down", "detail": "Firewalls, VPN gateways, printers, NAS boxes: often no API, and often forgotten until the certificate expires." },
      { "id": "pin", "label": "App with a pinned key", "sub": "fails on a key it does not know", "icon": "lock", "tone": "red", "status": "down", "detail": "A pinned client rejects a new key that is not in its pin set. Reuse the key, ship a backup pin, or pin higher up the chain." }
    ]
  ],
  "edges": [
    ["ca", "client", "renews"],
    ["client", "nginx", "hook"],
    ["client", "lb", "hook?"],
    ["client", "cdn", "by hand"],
    ["client", "box", "by hand"],
    ["client", "pin", "app release"]
  ]
}
```

For each copy, ask whether it changes when the renewal happens, without a person. If not, at 47 days it needs a person about 12 times a year per certificate, or about 21 times with the "30 days before expiry" rule. Three common fixes:

- **Let the platform issue its own certificate.** ACM for AWS load balancers and CloudFront, managed certificates on Google Cloud, Cloudflare's edge certificates, cert-manager inside the cluster. In our scan, 1,692 hostnames served Amazon certificates of about 198 days. ACM renews eligible, DNS-validated certificates itself, starting 45 days before expiry for 198-day certificates (per AWS's February 2026 change). It never renews imported certificates.
- **Move the copy into the deploy hook.** certbot runs the executable scripts in `/etc/letsencrypt/renewal-hooks/deploy/` after each successful renewal, unless directory hooks are turned off. acme.sh runs `--reloadcmd`. A copy in the hook happens on every renewal; a copy in a runbook happens when someone remembers. Check what the endpoint serves afterwards, because a hook that ran is not a hook that worked.
- **Plan for key changes in pinned clients.** A client that pins keys rejects a renewed certificate whose key is not in its pin set. Keep the key across renewals (`certbot --reuse-key`, cert-manager `rotationPolicy: Never`) and ship a backup pin, or pin higher up the chain and plan for CA changes too.

If you are on Kubernetes, the [Kubernetes security checklist](/checklists/kubernetes-security) covers cert-manager. The [PKI chapter of our Cryptography Essentials guide](/guides/cryptography-essentials/04-pki#h2-the-certificate-lifecycle) walks through the full certificate lifecycle with a lab CA. To see how a client checks the certificate during the handshake, try the [SSL/TLS handshake simulator](/games/ssl-tls-handshake).

## Check your own files

`06_check_configs.py` reads crontabs, systemd timers, certbot and acme.sh renewal configs, shell scripts, Prometheus rules, Helm values, Traefik config and application code. It only reads files and changes nothing. It uses simplified rules: renewal at two thirds of the lifetime, the worst case for run intervals (with approximate cron intervals, 30.5 days for monthly), today's Let's Encrypt 90 days as the first step, and no knowledge of client versions. It treats an acme.sh `--days` value as uncapped, as in 3.0.7, although 3.1.4 and later cap it. For each setting it prints the first step its rules flag.

To test the checker, `07_break_fixtures.py` starts from a clean set of fixtures, applies 13 known breaks one at a time, and checks that the checker reports each break with the expected rule and step. The fixtures only prove that the checker finds what we put there. They do not prove that it finds every form of these settings. This is the test, and the checker's output on `fixtures/broken`, which combines the 10 breaks that do not change the same line (full output in `results/06-check-broken.txt`):

```terminal
{
  "title": "06_check_configs.py, tested on fixtures",
  "prompt": "$",
  "steps": [
    { "cmd": "python3 scripts/07_break_fixtures.py | grep -E '^(clean|FAIL|fixtures)'", "output": "clean fixtures: 0 problems\nfixtures/broken: 11 problems from the 10 breaks that do not change the same line" },
    { "cmd": "python3 scripts/07_break_fixtures.py | grep -c '^ok'", "output": "13" },
    { "cmd": "python3 scripts/06_check_configs.py fixtures/broken | grep -E '^(BREAK|MANUAL|REVIEW|NOISE)'", "output": "BREAK  fixtures/broken/etc/cron.d/certbot:2  slow-renewal-schedule: runs about every 30.5 days\nBREAK  fixtures/broken/etc/systemd/system/cert-renew.timer:5  slow-renewal-schedule: OnCalendar=monthly\nBREAK  fixtures/broken/traefik/traefik.yml:6  before-expiry-window: certificatesDuration 8760h, renews 120 days before expiry\nBREAK  fixtures/broken/root/.acme.sh/example.com/example.com.conf:2  fixed-age-renewal: 80 days after issue\nBREAK  fixtures/broken/etc/letsencrypt/renewal/example.com.conf:3  before-expiry-window: 60 days before expiry\nMANUAL fixtures/broken/scripts/push-cert.sh:3  manual-copy: AWS ACM (imported certificates are never renewed by ACM)\nREVIEW fixtures/broken/app/ApiClient.kt:7  pin: certificate or key pin\nREVIEW fixtures/broken/app/ApiClient.kt:8  pin: certificate or key pin\nNOISE  fixtures/broken/k8s/x509-certificate-exporter-values.yaml:3  alert-threshold: 28 days left\nNOISE  fixtures/broken/prometheus/tls.rules.yml:5  alert-threshold: 30 days left\nNOISE  fixtures/broken/scripts/check-expiry.sh:5  alert-threshold: 30 days left" },
    { "cmd": "python3 scripts/06_check_configs.py fixtures/broken | grep -A3 cron.d", "output": "BREAK  fixtures/broken/etc/cron.d/certbot:2  slow-renewal-schedule: runs about every 30.5 days\n       stops working already (90-day, Let's Encrypt default today)\n       worst case: the run interval is longer than the renewal window (a third of the lifetime), so a whole window can pass between two runs, for example after one failed or manual renewal\n       fix: run renewal at least daily (certbot's timer runs twice a day); the client decides whether anything is due" }
  ]
}
```

We also ran it on the upstream default files we downloaded. It flagged the same three alert defaults as the schedule: x509-certificate-exporter's 28 days (from February 2027) and the 20-day warnings of check_ssl_cert and the blackbox rules (from February 2028, at Let's Encrypt's 45 days). It did not flag check_ssl_cert's 15-day critical threshold, because at exactly two thirds of 45 days there are exactly 15 days left. The schedule, which uses the end of the measured ARI window, does flag it. See `results/06-check-upstream-alert-defaults.txt`.

The checker uses regular expressions and finds only the forms it knows, so treat a clean result as "none of the known patterns", not as proof. It cannot tell whether a copy script runs from CI or a scheduler, or which key a pin covers, so it reports those for review. It cannot see certificates installed through a web console, appliances configured by hand, or pins inside compiled apps. For those, keep an inventory: for every certificate, where it is installed, and who or what replaces it there.

For the ACME clients themselves, the earlier post covers what each one actually did on Let's Encrypt staging: [when certbot, acme.sh and lego renew a 64-day certificate](/posts/lets-encrypt-64-day-certificates-renewal-check). In short: certbot 5.8 renewed inside the ARI window, acme.sh 3.1.6 scheduled its renewal inside it, lego 5.5.2 allowed renewal from two thirds of the lifetime, and acme.sh 3.0.7 scheduled renewal 5 days before expiry, or 15 days after it with `--days 80`.

## A checklist for the next five months

1. **Find your pre-March certificates.** If you still have a one-year certificate, its replacement gets at most 200 days, or 100 if it is issued from 15 March 2027. Put the new expiry in the calendar. Better, replace the calendar reminder with ACME: DigiCert, Sectigo and GlobalSign all offer ACME endpoints.
2. **Run renewal at least daily.** Search for monthly cron entries and change-window rules that cover certificate changes. The client decides whether anything is due, so running it often costs nothing.
3. **Make expiry alerts relative to the lifetime.** Replace "less than 30 days" with a share of the lifetime above the point where your client renews, or alert on failed renewals, and keep a 7-day floor.
4. **List every copy.** For each certificate, list every load balancer, CDN, appliance, Java keystore and Kubernetes secret that holds it. Move each copy into a deploy hook, or let that platform issue its own.
5. **Replace email validation.** Use DNS or HTTP validation through ACME before March 2028, and look at `dns-persist-01` if changing DNS for every validation is hard.
6. **Check your pins.** If any client pins your server's key, make sure the next key is already in its pin set, or reuse the key across renewals.

## What this does not show

- **One vantage point, IPv4 only.** We scanned from Frankfurt, up to 8 addresses per name, with up to two unverified handshakes per address. CDNs that answer on one anycast address hide their edge servers. A copy that fell behind on one edge is invisible from here.
- **The top 10,000 is not the internet.** Large sites are likely more automated than the long tail, and internal certificates are not in any public list. Mail servers, VPN gateways and internal services are where we would expect manual renewals, and the scan does not see them.
- **A scan shows what is served, not how it got there.** We know which certificate each address served on 23 November, not who renewed it, with which tool, or how often renewals failed.
- **The defaults were read, not run.** The renewal rules here come from source code at the versions listed, and for most clients they are the fallback rules without ARI. We did not run certbot, cert-manager, Caddy, Traefik or win-acme for this post. The earlier 64-day post ran certbot, acme.sh and lego against Let's Encrypt staging, and the Let's Encrypt rows use the ARI windows measured there.
- **The model is simpler than real operations.** It uses the maximum lifetime (CAs issue 198 or 199 days, not 200), a fixed renewal day, and alert time below a threshold rather than notification counts. The acme.sh margins are about 5 and 14 days because acme.sh schedules from its own clock at issue, not from `notBefore`.
- **"A copy that fell behind" is our reading.** Two certificates from the same CA with the same name count and first five names, issued weeks apart, with the older one past 80% of its lifetime, look like a renewal that did not reach every address. They could also be independent servers on their own schedules.
- **We did not measure failure rates.** We know when each rule renews, not how often a renewal fails. Multiplying a failure rate by the larger number of renewals would be a projection, so we did not publish one.

The ACME client is usually fine. The settings around it were made for certificates that changed once a year: alert thresholds, cron entries, change windows, copies and pins. Most of those need changing before February 2027, when Let's Encrypt goes to 64 days.
