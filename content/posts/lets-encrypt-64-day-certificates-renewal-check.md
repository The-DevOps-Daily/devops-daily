---
title: "Let's Encrypt Goes to 64-Day Certificates: When Does Your ACME Client Actually Renew?"
excerpt: "Let's Encrypt moves to 64-day certificates on 10 February 2027, and its staging environment already issues them. We issued real 64-day staging certificates with certbot, acme.sh and lego and recorded when each one renews. The ARI clients renewed or scheduled their renewal around day 42. acme.sh 3.0.7 with --days 80 scheduled its renewal for day 79, 15 days after the certificate expired, and upgrading to 3.1.6 fixed that at the next check."
category:
  name: 'Networking'
  slug: 'networking'
date: '2026-10-15'
publishedAt: '2026-10-15T09:00:00Z'
updatedAt: '2026-10-15T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Networking
  - TLS
  - Let's Encrypt
  - certbot
  - acme.sh
  - Linux
---

Let's Encrypt will issue **64-day certificates by default from 10 February 2027**, down from 90, on the way to 45 days in 2028. Its staging environment switched on 14 October 2026, and we had a watcher waiting for it: the first 64-day certificate arrived at 21:35 UTC. We issued 64-day staging certificates with five ACME client installs and recorded when each one renews, and ran the same test at 45 and 90 days for comparison. The clients that use ARI renewed or scheduled a 64-day certificate for **day 42 or 43**, at the same two-thirds share of the lifetime as at 45 and 90 days. The one that breaks is old acme.sh: version 3.0.7 scheduled a 64-day certificate for day 59 with its defaults, five days before it expires, and for **day 79 with `--days 80`, fifteen days after it expired**. Upgrading to 3.1.6 moved that schedule to day 42 at the next check.

## TL;DR

- On 64-day staging certificates, Let's Encrypt's ARI endpoint suggested renewing between **day 42.04 and 43.32**, 65.7 to 67.7 percent of the lifetime. We measured the same share at 45 and 90 days. That is about 21 days before expiry.
- certbot 5.8 renewed inside that window (it picks a random time in it on every run), acme.sh 3.1.6 scheduled day 42.16, and lego 5.5.2 allowed renewal from day 42.67. These configurations are ready for shorter lifetimes.
- certbot 2.9, the version apt installed on our Ubuntu 24.04 machine, does not use ARI and became due 30 days before expiry: day 34 of 64. Early, but safe.
- acme.sh 3.0.7 schedules the next renewal at issue + `--days` - 1 day, with no check against the expiry date. Its default of 60 gave day 59.04 of 64, and `--days 80` gave day 79.04. Every acme.sh tag we scanned from 3.0.7 to 3.1.2 has the same default of 60.
- Search your cron jobs, wrapper scripts and monitoring for hardcoded 60, 80 and 83, as Let's Encrypt itself suggests, and still check your renewal timer, challenge path and deploy hook.

## Prerequisites

- A server that renews certificates with certbot, acme.sh or lego
- Shell access to check the client version and its stored renewal settings
- To reproduce the test: a throwaway VM with port 80 reachable, and `faketime`

Everything we ran, and every output file, is in the repository:

```github
https://github.com/The-DevOps-Daily/le-64-day-renewal-check
```

## What changes, and when

From Let's Encrypt's [announcement](https://letsencrypt.org/2026/10/07/64-day-certs) of 7 October 2026:

- **14 October 2026**: staging switches to 64-day certificates. Our watcher's request at 21:25 UTC still returned a 90-day certificate, and the one at 21:35 UTC returned a 64-day certificate.
- **10 February 2027**: all subscribers move to 64-day certificates by default. The last 90-day certificates expire around 11 May 2027.
- The **authorization reuse period** drops from 30 days to 10 days, and to seven hours in 2028.
- **2028**: 45-day certificates by default.

The advice in the announcement is short: if your renewals are automated and your client supports ARI, you should be all set; if not, renew at about two thirds of the lifetime, and look for hardcoded values such as 83, 80 or 60 in cron jobs, wrapper scripts and runbooks. We wanted to see which clients actually follow that, and what happens to the ones that do not.

## How we measured it

On a throwaway Ubuntu 24.04 droplet we installed five client versions side by side: certbot 2.9.0 from apt, certbot 5.8.0 from snap, acme.sh 3.0.7 and 3.1.6 from the upstream repository, and lego 5.5.2. They requested real certificates from the Let's Encrypt staging environment, using hostnames under `sslip.io` that resolved to the droplet, at three lifetimes. Where a client could not request a lifetime, we used copied state or its source:

- **64-day certificates** from the default `classic` profile, after staging switched. A watcher asked for a classic certificate every 10 minutes from 12:36 UTC and started the suite as soon as the lifetime dropped.
- **90-day certificates** from the same `classic` profile, earlier that evening.
- **45-day certificates** from the `tlsserver` profile, the lifetime planned for 2028. acme.sh 3.0.7 and certbot 2.9 cannot request a profile, so certbot 2.9 was tested on a copy of certbot 5.8's 45-day certificate and acme.sh 3.0.7 was read from its source.

Then, for each certificate:

- acme.sh stores its planned renewal time in its config, so we read it.
- lego prints, at issuance, when a renewal will be allowed; we ran it with ARI on and with `--ari-disable`.
- certbot only decides when `certbot renew` runs, so we ran it under `faketime` at chosen hours after issuance, each time on a fresh copy of the state, and recorded whether it renewed.
- A small script asked the ARI endpoint ([RFC 9773](https://www.rfc-editor.org/rfc/rfc9773)) for the suggested window of every certificate.

Days are counted from each certificate's `notBefore` time, which Let's Encrypt sets about an hour before issuance. This is the certbot 2.9 probe on the 64-day certificate, as recorded:

```terminal
{
  "title": "certbot 2.9.0 under faketime, 64-day staging certificate",
  "prompt": "$",
  "steps": [
    { "cmd": "probe-certbot.sh certbot $R/cb29 c29n.46-101-102-127.sslip.io 800 812 815 818 830", "output": "# certbot 2.9.0 c29n.46-101-102-127.sslip.io notBefore=Oct 14 20:37:00 2026 GMT notAfter=Dec 17 20:36:59 2026 GMT\nhour 800 (day 33.33, 2026-11-17 04:37:00 UTC): not due\nhour 812 (day 33.83, 2026-11-17 16:37:00 UTC): not due\nhour 815 (day 33.96, 2026-11-17 19:37:00 UTC): not due\nhour 818 (day 34.08, 2026-11-17 22:37:00 UTC): RENEWED\nhour 830 (day 34.58, 2026-11-18 10:37:00 UTC): RENEWED" }
  ]
}
```

Not due at day 33.96, renewed at day 34.08: the threshold is between the two, consistent with 30 days before the 64-day expiry.

## Results

| Client                             | 64-day                                        | 45-day                          | 90-day                          |
| ---------------------------------- | --------------------------------------------- | ------------------------------- | ------------------------------- |
| ARI suggested window               | day 42.04 to 43.32                            | day 29.56 to 30.46              | day 59.11 to 60.91              |
| certbot 5.8.0 (snap), ARI          | first renewal seen at day 42.50               | first renewal seen at day 30.29 | first renewal seen at day 59.92 |
| acme.sh 3.1.6, ARI                 | scheduled day 42.16                           | scheduled day 29.6 to 30.3      | scheduled day 60.7 to 60.9      |
| lego 5.5.2                         | allowed from day 42.67                        | allowed from day 30.0           | allowed from day 60.0           |
| certbot 2.9.0 (apt), no ARI        | due between day 33.96 and 34.08               | due between day 14.96 and 15.08 | due between day 59.79 and 60.21 |
| acme.sh 3.0.7, default `--days 60` | scheduled day 59.04, 5 days before expiry     | day 59, after expiry (source)   | scheduled day 59.0              |
| acme.sh 3.0.7, `--days 80`         | scheduled day 79.04, **15 days after expiry** | day 79, after expiry (source)   | scheduled day 79.0              |

```chart
{
  "type": "bar",
  "title": "Day each client renews, or plans to renew, a 64-day certificate",
  "unit": " days",
  "caption": "The certificate expires on day 64. Measured on Let's Encrypt staging on 2026-10-14, one certificate per row. certbot 2.9 became due between day 33.96 and 34.08. certbot 5.8 is its first renewal in our probes; it picks a random time inside the ARI window (day 42.04 to 43.32) on every run. acme.sh shows its stored schedule and lego the day it reported at issuance. The last bar is the --days 80 certificate after upgrading acme.sh to 3.1.6. Source: results/measured-64.txt in the repo.",
  "rows": [
    { "label": "certbot 2.9 (apt)", "value": 34, "series": "safe" },
    { "label": "certbot 5.8 (ARI)", "value": 42.5, "series": "safe" },
    { "label": "acme.sh 3.1.6 (ARI)", "value": 42.16, "series": "safe" },
    { "label": "lego 5.5.2", "value": 42.67, "series": "safe" },
    { "label": "acme.sh 3.0.7, defaults", "value": 59.04, "series": "tight" },
    { "label": "acme.sh 3.0.7, --days 80", "value": 79.04, "series": "expired" },
    { "label": "same, after upgrading to 3.1.6", "value": 42.23, "series": "safe" }
  ],
  "series": [
    { "name": "safe", "color": "#10b981" },
    { "name": "tight", "color": "#f59e0b" },
    { "name": "expired", "color": "#ef4444" }
  ]
}
```

### ARI clients: the window does the work

The ARI window opened at 65.7 percent of the lifetime and closed at 67.7 percent at all three lengths: day 42.04 to 43.32 of 64, day 29.56 to 30.46 of 45, and day 59.11 to 60.91 of 90. On a 64-day certificate, that is 21 to 22 days before expiry. A client that follows the window needs no change for 45 days in 2028 either.

While we waited, we projected the 64-day column from the 45-day and 90-day runs and committed the projection at 21:32 UTC (commit `f909cfc` in the repository). Our next request, at 21:35 UTC, returned the first 64-day certificate. Every 64-day result in the table matches that projection (`results/projection-64.txt` and `results/measured-64.txt`).

certbot 5.8 does not renew at one fixed moment. Each time it runs, it asks for the window, picks a random time inside it, and renews if that time has passed. From its source (`acme/client.py`):

```python
delta_seconds = (end - start).total_seconds()
random_seconds = random.uniform(0, delta_seconds)
random_time = start + datetime.timedelta(seconds=random_seconds)
```

So a run a third of the way into the window renews about a third of the time. These are our 64-day probes, each from a fresh copy of the same state:

```text
hour 1010 (day 42.08, 2026-11-25 22:37:12 UTC): not due
hour 1014 (day 42.25, 2026-11-26 02:37:12 UTC): not due
hour 1020 (day 42.50, 2026-11-26 08:37:12 UTC): RENEWED
hour 1030 (day 42.92, 2026-11-26 18:37:12 UTC): not due
```

The run at day 42.50 had about a 36 percent chance and renewed. The run at day 42.92 had about 68 percent and did not. This spreads renewals out, as RFC 9773 intends, so a fleet does not renew all at once. Once the window has closed, every run renews: on the 45-day and 90-day certificates, every probe after the window renewed. If the ARI request fails, certbot 5.8 catches the error and gets no ARI time; it then renews at two thirds of the lifetime (day 42.67 of 64), or by `renew_before_expiry` if that is set in the renewal config. We read this in its source (`results/certbot-5.8-ari-source.txt`) but did not test a failed ARI request.

acme.sh 3.1.6 scheduled its next renewal for day 42.16, with its default and with `--days 80`. It also stayed inside the window with `--days 60` at 45 days and with `--days 80` at 90 days. lego 5.5.2, checked at issuance, gave the same answer with ARI on and off: renewal allowed from day 42.67, exactly two thirds of the lifetime.

These are the clients' decisions, not your whole setup. A renewal still needs a timer or cron job that runs often enough, a working challenge path and a deploy hook that reloads the server.

### certbot 2.9: early, and fine

certbot added ARI support in [version 4.1.0](https://community.letsencrypt.org/t/certbot-4-1-0-release/238369) (June 2025). The certbot that apt installed on our Ubuntu 24.04 machine was 2.9.0, and its probes became due 30 days before expiry at every lifetime: between day 33.96 and 34.08 of 64, between day 14.96 and 15.08 of 45, and between day 59.79 and 60.21 of 90. It renews more often than it needs to, and it leaves about 30 days to notice and fix a failed renewal, if its timer runs normally.

### acme.sh 3.0.7: the one that breaks

acme.sh 3.0.7 computes the next renewal when it issues a certificate, and never compares it with the expiry date. From its source:

```bash
Le_NextRenewTime=$(_math "$Le_CertCreateTime" + "$Le_RenewalDays" \* 24 \* 60 \* 60)
Le_NextRenewTime=$(_math "$Le_NextRenewTime" - 86400)
```

`Le_RenewalDays` is the `--days` value, 60 by default. The 64-day staging run shows the result:

```text
acme307 a307n notBefore=Oct 14 20:37:26 2026 GMT notAfter=Dec 17 20:37:25 2026 GMT next='2026-12-12T21:36:01Z' days=
acme307 a307n80 notBefore=Oct 14 20:37:43 2026 GMT notAfter=Dec 17 20:37:42 2026 GMT next='2027-01-01T21:36:18Z' days='80'
```

Both certificates expire on 17 December. With the default, the next renewal is 12 December, day 59.04, so one failed renewal (a DNS hiccup, a firewall change, a rate limit) leaves very little time before expiry. With `--days 80`, the next renewal is 1 January 2027, day 79.04, fifteen days after the certificate expired, and acme.sh 3.0.7 does not try before then. The 90-day run gave the same days, 59 and 79, which were safe at that lifetime. At 45 days in 2028, the default fails too.

We scanned each acme.sh tag from 3.0.7 to 3.1.6 for the scheduling code (the scan is in the repo):

| acme.sh tag    | Tag date             | Default `--days` | Cap one day before expiry | ARI code                              |
| -------------- | -------------------- | ---------------- | ------------------------- | ------------------------------------- |
| 3.0.7 to 3.1.2 | Oct 2023 to Nov 2025 | 60               | no                        | none                                  |
| 3.1.3          | Apr 2026             | 30               | no                        | first ARI function                    |
| 3.1.4          | Jul 2026             | 30               | yes                       | ARI used when scheduling              |
| 3.1.5, 3.1.6   | Sep 2026             | 30               | yes                       | ARI also checked on every renewal run |

We only ran 3.0.7 and 3.1.6. The rows for the versions in between come from reading the source, so check your own version's behaviour if it is one of those.

### What upgrading does to an existing certificate

acme.sh stores `Le_RenewalDays` and the next renewal time in each certificate's config, so an upgrade does not by itself change a schedule written by an old version. We tested what happens next: we copied the state of the 64-day certificate that 3.0.7 had scheduled for day 79 and ran acme.sh 3.1.6 `--renew` on it, without `--force`:

```text
== before: acme.sh 3.0.7 state
Le_RenewalDays='80'
Le_NextRenewTimeStr='2027-01-01T21:36:18Z'
notAfter=Dec 17 20:37:42 2026 GMT
== acme.sh 3.1.6 --renew on the same state (no --force), 2026-10-14T23:22:34Z
[Wed Oct 14 23:22:34 UTC 2026] Renew: a307n80.46-101-102-127.sslip.io
[Wed Oct 14 23:22:34 UTC 2026] Renewing: 'a307n80.46-101-102-127.sslip.io'
[Wed Oct 14 23:22:34 UTC 2026] Renewing using Le_API=https://acme-staging-v02.api.letsencrypt.org/directory
[Wed Oct 14 23:22:35 UTC 2026] Current renewal time: 2027-01-01T21:36:18Z
[Wed Oct 14 23:22:35 UTC 2026] ARI suggestedWindow: 2026-11-25T21:36:11Z to 2026-11-27T04:18:13Z
[Wed Oct 14 23:22:35 UTC 2026] Updating renewal time picked from ARI window: 2026-11-26T02:10:18Z
[Wed Oct 14 23:22:35 UTC 2026] Skipping. Next renewal time is: 2026-11-26T02:10:18Z
== after
Le_RenewalDays='80'
Le_NextRenewTimeStr='2026-11-26T02:10:18Z'
```

The stored `--days 80` stays, but 3.1.6 asked the ARI endpoint on its first check and moved the renewal from 1 January, after expiry, to 26 November, day 42.23. The same test on the 90-day certificate gave the same result. Its source says it does this on every renewal check unless `NO_ARI=1` is set. On a CA without ARI, or with `NO_ARI=1`, the stored schedule is what counts.

## What to check on your servers

Find out which client and version renews each certificate, and what it has stored:

```bash
# certbot: version, and any renewal setting that overrides the default
certbot --version
grep -H renew_before_expiry /etc/letsencrypt/renewal/*.conf

# acme.sh: version, the stored --days, and the stored next renewal time
~/.acme.sh/acme.sh --version
grep -H -E '^Le_RenewalDays=|^Le_NextRenewTimeStr=' ~/.acme.sh/*/*.conf

# lego: version (ARI is on unless you pass --ari-disable)
lego --version
```

Then:

1. **Upgrade acme.sh** to 3.1.6 or later wherever it runs (`acme.sh --upgrade`), and run `acme.sh --cron` once to see the new schedule. On anything that has to stay on an older version, compare each stored `Le_NextRenewTimeStr` with the certificate's expiry, and lower `--days` so the next renewal comes well before it.
2. **Look for 60, 80 and 83** in cron jobs, systemd timers, wrapper scripts and runbooks, as Let's Encrypt suggests. A script that renews "when the certificate is 60 days old" leaves four days of margin at 64 days and none at 45.
3. **Check your expiry alerts.** The ARI clients chose renewal times with about 21 days left on our 64-day certificates, so an alert at 30 days left fires on every certificate while renewal is working fine, and people learn to ignore it. Alert on failed renewals, and on expiry with a threshold below the normal renewal point, for example 14 days left.
4. **Check what else issues certificates.** The shorter authorization reuse period (10 days instead of 30) does not change a renewal every 42 days, since both periods have passed by then. It matters when you issue again 10 to 30 days after the last validation, for example a manual reissue or a renewal forced early: that order now needs a fresh challenge.
5. **Rehearse on staging before February.** Staging's `classic` profile already issues 64-day certificates, and its `tlsserver` profile issues 45-day ones. Issue a staging certificate with separate state from production and run your normal renewal and deploy path against it.

## What this test does not show

- **One certificate per configuration.** We issued one 64-day certificate for each client setup, on one evening. certbot 5.8 picks a random time inside the window, so our probes show that it renews inside the window, not how its renewals spread across a fleet.
- **ARI windows can move.** Let's Encrypt can change a certificate's window, for example to ask for early renewal before a mass revocation. Clients that check ARI on each run, as certbot 5.8 and acme.sh 3.1.6 do, pick up the change; we did not test that. We measured the normal window. The acme.sh 3.0.7 and certbot 2.9 rows would not change, because neither looks at ARI.
- **acme.sh 3.0.7 at 45 days comes from its source.** It cannot request the 45-day profile, so we could not issue one with it. The 64-day and 90-day runs confirm the formula.
- **lego was checked at issuance only.** We recorded when it said a renewal would be allowed, not a renewal at that time.
- **Five client installs.** We did not test Caddy, Traefik, cert-manager, win-acme or hosting panels that embed their own ACME code. Check those against the same two questions: does it use ARI, and if not, how does it decide?
- **Staging, not production.** Production should behave the same way from February, but we only issued staging certificates.

The short version: in our tests, the clients with ARI enabled renewed on Let's Encrypt's window, and that window was the same share of the lifetime at 45, 64 and 90 days. If it does not, find out what number it renews on, because that number was chosen for 90 days.

For an expiry check that tests what your servers actually present, with a threshold set relative to the certificate's lifetime, read [Monitor Certificate Expiry](/guides/cryptography-essentials/03-tls-ssl#h2-monitor-certificate-expiry) in our Cryptography Essentials guide.
