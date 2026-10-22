---
title: 'PHP2Shell: How to Check That Every PHP You Run Is Actually Patched'
excerpt: 'PHP 8.5.12, 8.4.27, 8.3.36 and 8.2.35 fix two critical remote code execution bugs. Installing the update is the easy part. A patched Ubuntu PHP still says 8.3.6, running workers keep the old code, and 4.4 hours after the release 8 of 39 popular images still shipped a vulnerable PHP. Here is how to find the PHP you run and prove it is fixed.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2026-10-22'
publishedAt: '2026-10-22T09:00:00Z'
updatedAt: '2026-10-22T18:30:00Z'
readingTime: '19 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Linux
  - PHP
  - Security
  - Docker
  - Patch Management
  - CVE
---

On 21 October 2026 the PHP project released PHP 8.5.12, 8.4.27, 8.3.36 and 8.2.35 to fix CVE-2026-109618 and CVE-2026-109619, the pair now called PHP2Shell. Both are rated critical, CVSS v4.0 9.2. Unauthenticated remote code execution has been demonstrated against Apache with mod_php before any application code runs, and PHP says every installation that serves web requests is at risk.

So update. The trouble is that "we updated" can be true while the server is still vulnerable. Ubuntu and RHEL fix PHP without changing the version number, so `php -v` says the same thing before and after. PHP-FPM and Apache keep running the old code until they restart. A fixed base image fixes nothing until your image is rebuilt and the old containers are gone. This post shows how to find every PHP you run, how to prove each one is fixed, and what the interim settings do and do not block. It comes with a read-only check script, and a registry scan of 39 popular PHP images: by their own metadata, 8 still shipped a vulnerable PHP 4.4 hours after the scheduled release, and 3 still did at 5.5 hours.

## What to do now

1. **Update PHP everywhere** to 8.5.12, 8.4.27, 8.3.36 or 8.2.35, or to your distribution's fixed package. On Ubuntu and RHEL the fixed package keeps the old upstream version, so check the package version, not `php -v`.
2. **Restart every PHP process**: PHP-FPM, Apache with mod_php, php-cgi, LiteSpeed and FrankenPHP. Then confirm nothing still runs the replaced binary.
3. **Rebuild and redeploy containers**, then check what the running containers contain, not what the registry has.
4. **If you cannot update today**, set `session.upload_progress.enabled=0` (and the other settings below) in php.ini or the FPM pool, restart, and treat it as partial. PHP says only the update is a complete fix.
5. **PHP 8.1 and older get no upstream release.** Use a vendor backport or move to 8.2 or newer.
6. **Run the check** on every host and keep the output as your evidence.

## Prerequisites

- Shell access to the hosts that run PHP, and root if you want to see processes owned by other users.
- Python 3.6 or newer for the check script. It uses only the standard library.
- The docker or podman CLI on hosts that run PHP in containers, and `kubectl` for clusters.

## What was fixed

PHP published two advisories:

- **CVE-2026-109618**, [GHSA-w8hw-w9fx-j79w](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w), "RCE via OOM corruption". Out-of-memory handling can interrupt PHP while request data is only partly initialized, and request cleanup can then treat that data as valid.
- **CVE-2026-109619**, [GHSA-6wmf-4rv5-p3rp](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp), "RCE via stale global state". State owned by one request can survive after its memory is freed, and a later request handled by the same worker can use it.

| Branch        | Fixed in            | Note                                       |
| ------------- | ------------------- | ------------------------------------------ |
| 8.5           | 8.5.12              |                                            |
| 8.4           | 8.4.27              |                                            |
| 8.3           | 8.3.36              |                                            |
| 8.2           | 8.2.35              | End of life on 31 December 2026            |
| 8.1 and older | no upstream release | Source backports for 7.4, 8.0 and 8.1 only |

The timeline, all on 21 October unless noted (UTC):

- **20 October**: PHP announced the release for 21 October at 14:00 UTC and [reserved the right to release earlier](https://www.php.net/archive/2026.php#2026-10-20-1) if details became public.
- **02:29**: VirusTotal saw the first submission of a [leaked archive](https://blog.virustotal.com/2026/10/sizing-php-exposure-window-for-cve-2026.html) with technical details.
- **13:34**: the GitHub advisories were published. Ubuntu's [USN-8948-1](https://ubuntu.com/security/notices/USN-8948-1) followed at 13:56.
- **14:00**: the scheduled release time. The php.net [announcements](https://www.php.net/archive/2026.php#2026-10-21-5) carry no time of day; NVD published both CVEs at 14:17.
- **16:03**: the last of the 16 official `php` tags we scanned for 8.2 to 8.5 (linux/amd64) was built with a fixed PHP. Docker Hub showed the new version tags as pushed between 16:48 and 17:31.

The first report took about ten weeks to reach a release. [Calif](https://calif.io/php2shell/), which credits the discovery to Calif, OpenAI and Wiz, dates discovery to 1 August 2026, the first report to PHP to 11 August and the second to 21 August. Calif traces the earliest affected code path to PHP 5.4.0, and says a related out-of-memory issue found in a 2024 audit was left unfixed because exploitation was not proven. In OpenAI's account, Greg Brockman [wrote](https://x.com/gdb/status/2112921529650688312) that OpenAI had spent the past two months "leading a coalition to mitigate" the bug, found as part of its Patch the Planet initiative. OpenAI's own write-up is [here](https://openai.com/index/coordinated-disclosure-of-critical-vulnerabilities/).

## Who is really exposed

PHP's [advisory](https://www.php.net/archive/2026.php#2026-10-21-5) lists "all PHP installations serving web requests, including PHP-FPM, Apache with mod_php, php-cgi, FrankenPHP and LiteSpeed" and puts mod_php at the top. The GitHub advisories go into more detail per server API (SAPI):

| SAPI              | What the PHP advisories say                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apache mod_php    | Highest risk. Unauthenticated RCE validated over HTTP with default limits, before any application code runs.                                                                                                                                                                                                                                                              |
| PHP-FPM           | At risk. The CVE-2026-109619 session path was validated against FPM, but it needs a suitable application operation. For CVE-2026-109618, source analysis says FPM is susceptible, but no complete FPM exploit was shown. The advisory also names per-request settings sent by the web server (`PHP_VALUE` or `PHP_ADMIN_VALUE`) that produce a warning as a risk for FPM. |
| php-cgi           | Listed as at risk by php.net. The advisories do not discuss it separately.                                                                                                                                                                                                                                                                                                |
| FrankenPHP        | Listed. Source analysis says that, like mod_php, it is likely susceptible to CVE-2026-109618.                                                                                                                                                                                                                                                                             |
| LiteSpeed (LSAPI) | Listed. Application-specific exploits are described as likely but not validated.                                                                                                                                                                                                                                                                                          |
| CLI               | Not named. The bugs are in web request handling. But `php -S` serves HTTP from the CLI binary, and the CLI usually comes from the same source package as FPM and mod_php, so an old CLI is a sign of what else on the host is old.                                                                                                                                        |

Red Hat [rates both bugs Important, not Critical](https://security.access.redhat.com/data/csaf/v2/vex/2026/cve-2026-109618.json), because "Standard Red Hat Enterprise Linux deployments use PHP-FPM rather than mod_php." That is a statement about the default, not about your server. PHP names mod_php as the highest-risk setup, so if you run mod_php on RHEL, put it first even though Red Hat's rating is Important.

:::note
**The sources disagree on the affected range.** PHP's advisories and the CVE.org records list only 8.2 to 8.5. NVD marks every version below 8.2.35 as vulnerable, with no lower bound. Google Cloud says "All versions of PHP from 5.4 through 8.5.11", and PHP itself shipped source backports for 7.4, 8.0 and 8.1. Treat every PHP older than the fixed releases as affected, including end-of-life branches.
:::

## Why `php -v` does not tell you

Debian ships the new upstream release, so on Debian `php -v` changes when you are fixed: bookworm gets 8.2.35 and trixie gets 8.4.27. Ubuntu and RHEL backport the patch into the version they already ship. Ubuntu 24.04's fixed php8.3 still reports 8.3.6. So does the vulnerable one.

To show this with real packages, the repo's `scripts/ubuntu-backport-demo.sh` downloads `php8.3-fpm` and `php8.3-common` from the Ubuntu archive, from before the fix (`.12`) and with the fix (`.13`). It extracts them without installing or running anything, reads the PHP version compiled into `php-fpm8.3`, and searches the package changelog for the CVE IDs:

```terminal
{
  "title": "ubuntu-backport-demo.sh",
  "prompt": "$",
  "steps": [
    {
      "cmd": "scripts/ubuntu-backport-demo.sh",
      "output": "# 2026-10-21T18:26:56Z Ubuntu 24.04 php8.3 packages from http://archive.ubuntu.com/ubuntu/pool\nsha256 60187aae56db2056e916d99ba4854415993429f12732ace1b5eb5225bb33f584  php8.3-fpm_8.3.6-0ubuntu0.24.04.12_amd64.deb\nsha256 85e4fc03ff84fef7dfed923c99d1a2e0e6f49147a50bcd5eaca4e7cd05a835fa  php8.3-common_8.3.6-0ubuntu0.24.04.12_amd64.deb\nsha256 ae395e2c15c3b96da56da807a204f771a589eb5bf54a3e5e239b1f50ade2815b  php8.3-fpm_8.3.6-0ubuntu0.24.04.13_amd64.deb\nsha256 801cae4e842e1b9e9d60a542bf18ba831bf504b2f3070404892bf3f8fb943ea4  php8.3-common_8.3.6-0ubuntu0.24.04.13_amd64.deb\n\npackage 8.3.6-0ubuntu0.24.04.12\n  php-fpm8.3 embeds: PHP/8.3.6\n  changelog top:     php8.3 (8.3.6-0ubuntu0.24.04.12) noble-security; urgency=medium\n  PHP2Shell IDs:     none\npackage 8.3.6-0ubuntu0.24.04.13\n  php-fpm8.3 embeds: PHP/8.3.6\n  changelog top:     php8.3 (8.3.6-0ubuntu0.24.04.13) noble-security; urgency=medium\n  PHP2Shell IDs:     CVE-2026-109618 CVE-2026-109619 "
    }
  ]
}
```

Both binaries carry the same version. Only the package version and its changelog say which one has the fix. This is what the fixed packages looked like on the evening of 21 October:

| System                               | Fixed package                                                                                       | Does `php -v` change? |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------- |
| Debian 12 bookworm                   | php8.2 8.2.35-1~deb12u1 ([DLA-4848-1](https://security-tracker.debian.org/tracker/CVE-2026-109618)) | Yes, to 8.2.35        |
| Debian 13 trixie                     | php8.4 8.4.27-1~deb13u1 (DSA-6574-1)                                                                | Yes, to 8.4.27        |
| Ubuntu 26.04                         | php8.5 8.5.4-0ubuntu1.5 ([USN-8948-1](https://ubuntu.com/security/notices/USN-8948-1))              | No, stays 8.5.4       |
| Ubuntu 24.04                         | php8.3 8.3.6-0ubuntu0.24.04.13                                                                      | No, stays 8.3.6       |
| Ubuntu 22.04                         | php8.1 8.1.2-1ubuntu2.28                                                                            | No, stays 8.1.2       |
| Ubuntu 14.04 to 20.04 (ESM)          | php5, php7.0, php7.2, php7.4 ([USN-8948-2](https://ubuntu.com/security/notices/USN-8948-2))         | No                    |
| RHEL 8.10 EUS, php:7.4 module        | php-7.4.33-8.module+el8.10.0+25117+30337cca (RHSA-2026:87080)                                       | No, stays 7.4.33      |
| RHEL 8 php:8.2, RHEL 9, RHEL 10      | No fix listed at 16:49 UTC                                                                          |                       |
| packages.sury.org (Debian 12, arm64) | Still at 8.2.34, 8.3.35, 8.4.26 and 8.5.11 at about 18:10 UTC                                       | Yes, when it lands    |
| rpms.remirepo.net                    | php.net: "The repo will not have updates today"                                                     | Yes, when it lands    |

The same trap works in the other direction. A scanner that compares only the upstream version reports fixed Ubuntu and RHEL packages as vulnerable.

The right check compares the package version with your distribution's fixed version for that package, or finds both CVE IDs in the changelog of the package that owns the binary. The examples use Ubuntu 24.04's php8.3-fpm; take the fixed version for your release and package from its USN, DSA or RHSA:

```bash
# Ubuntu 24.04, php8.3-fpm from the Ubuntu archive (fixed in USN-8948-1)
dpkg --compare-versions "$(dpkg-query -W -f='${Version}' php8.3-fpm)" ge 8.3.6-0ubuntu0.24.04.13 \
  && echo fixed || echo NOT fixed

# Which package owns the binary that actually runs, and what its changelog says
dpkg-query -S "$(readlink -f /usr/sbin/php-fpm8.3)"
zcat /usr/share/doc/php8.3-fpm/changelog.Debian.gz | head -1
for id in CVE-2026-109618 CVE-2026-109619; do
  zgrep -q "$id" /usr/share/doc/php8.3-fpm/changelog.Debian.gz && echo "$id listed" || echo "$id NOT listed"
done

# RHEL, AlmaLinux, Rocky Linux: ask about the package that owns the binary
rpm -qf "$(readlink -f /usr/sbin/php-fpm)"
for id in CVE-2026-109618 CVE-2026-109619; do
  rpm -qf --changelog "$(readlink -f /usr/sbin/php-fpm)" | grep -q "$id" && echo "$id listed" || echo "$id NOT listed"
done

# Alpine packages carry the upstream version
apk info -v | grep -E '^php[0-9]+(-fpm|-cgi|-apache2|-embed)?-[0-9]'
```

Two details make the changelog check less simple than it looks:

- **On Debian and Ubuntu, `/usr/share/doc/php8.3-fpm` is usually a symlink** to `php8.3-common`'s docs. If an upgrade was partial and `php8.3-fpm` was held back, you read the newer package's changelog and conclude the old FPM binary is fixed. Check that the first line of the changelog names the version that `dpkg-query -W php8.3-fpm` reports. The check script refuses a changelog whose top entry does not match the installed package.
- **Container images often strip `/usr/share/doc`.** Then there is no changelog to read, and the package version against the distribution's tracker is the only evidence.
- **A changelog line is a mention, not proof.** A fix that was later reverted would still be listed. Treat it as supporting evidence next to the package version.

## Restart, or the old code keeps running

Upgrading the package replaces the files on disk. The PHP-FPM master and its workers, and every Apache child with mod_php loaded, still have the old binary mapped in memory. Linux marks a mapped file that has been replaced as `(deleted)`, which gives you a direct check:

```bash
# Run as root, or processes owned by other users are not visible.
# PHP-FPM, php-cgi, LiteSpeed and FrankenPHP processes on a replaced binary
sudo ls -l /proc/[0-9]*/exe 2>/dev/null | grep -E '(php|frankenphp).*\(deleted\)'

# Apache processes that still map a replaced libphp
sudo grep -l 'libphp.*(deleted)' /proc/[0-9]*/maps 2>/dev/null
```

Restart the service (`systemctl restart php8.3-fpm`, `systemctl restart apache2`), run both commands again until they print nothing, and then check the version or package of the binary the service runs. An empty result only says no replaced file is still mapped; it does not say the file on disk is the fixed one. `needrestart` on Debian and Ubuntu and `dnf needs-restarting` on RHEL also list processes that need a restart after an upgrade. PHP's own advice for the interim settings is to "restart every worker" as well, because a setting changed in php.ini does not reach a worker that is already running.

## Containers: rebuild, redeploy, then check what is running

A container keeps the PHP it was built with. Google's [guidance for Cloud Run](https://cloud.google.com/blog/products/identity-security/responding-to-core-php-vulnerabilities-cve-2026-109618-cve-2026-109619) says it plainly: services without automatic base image updates "must be rebuilt and redeployed", and "Container images you build yourself are your responsibility."

Rebuild with `--pull`, so the builder fetches the new base instead of a cached one:

```bash
docker build --pull -t registry.example.com/app:2026-10-21 .
```

If your Dockerfile pins a digest (`FROM php:8.4-fpm@sha256:...`), update the pin. If it pins a version tag, move to `8.4.27-fpm` or later. Then deploy the new tag or digest. On Kubernetes, `kubectl rollout restart` with a reused tag and `imagePullPolicy: IfNotPresent` starts the new pods from the image already cached on the node, which is the old one.

Then check the containers that are running, not the image you meant to deploy:

```bash
# Docker hosts (use podman the same way): the PHP CLI version in each running container
docker ps --format '{{.ID}} {{.Image}} {{.Names}}' | while read -r id image name; do
  printf '%-30s %-40s ' "$name" "$image"
  docker exec "$id" php -r 'echo PHP_VERSION, PHP_EOL;' 2>&1 || echo "PHP CLI check failed"
done

# Kubernetes: the image digests your pods are actually running
kubectl get pods -A -o jsonpath='{..imageID}' | tr ' ' '\n' | sort -u
```

The CLI version is a first look, not proof for the web server: a container can have a fixed CLI and an older FPM or mod_php, so check the binary that serves requests (`php-fpm -v`, or its package) as well. The repo's `registry_scan.py` takes repository-qualified digests (`registry/repository@sha256:...`) as arguments and reads the PHP version from each image's metadata without pulling it. Some runtimes report `imageID` in other forms, such as a bare digest, which you need to map back to a repository first. That works for images built `FROM php`, which carry `ENV PHP_VERSION`. For images that install PHP from distribution packages, look inside a running container, because the version is not in the metadata.

## How fast the popular images were rebuilt

We wanted to know how long "pull the new image" takes to become true, so `registry_scan.py` read the PHP version of 39 popular images from registry metadata only: the manifest and the image config, a few KB each, checked against their digests, never a layer. The version is the one the image declares in `ENV PHP_VERSION` (or Bitnami's `APP_VERSION`), which images built `FROM php` inherit. An image could replace PHP after that, so this is what the images report, not a look at the binary. The list is the official `php` image for 8.1 to 8.5, the official application images built on it, and widely used community images. `images.txt` in the repo says why each one is there. All results are for linux/amd64.

We ran the scan at 18:21 and 19:32 UTC on 21 October, 4.4 and 5.5 hours after the scheduled release, and again at 18:27 UTC on 22 October, about 24 hours later:

```chart
{
  "type": "bar",
  "title": "39 popular PHP images by the PHP version their metadata reports",
  "caption": "linux/amd64. PHP version from ENV PHP_VERSION (or Bitnami APP_VERSION) in each image config, read without pulling layers. Fixed: 8.5.12, 8.4.27, 8.3.36, 8.2.35; 8.1 and older count as vulnerable. Unknown: no full version in the metadata. Files: results/scan-20261021T182129Z.json, results/scan-20261021T193200Z.json, results/scan-20261022T182715Z.json.",
  "rows": [
    {
      "label": "21 Oct 18:21: vulnerable",
      "value": 8,
      "series": "vulnerable"
    },
    {
      "label": "21 Oct 18:21: unknown",
      "value": 2,
      "series": "unknown"
    },
    {
      "label": "21 Oct 18:21: patched",
      "value": 29,
      "series": "patched"
    },
    {
      "label": "21 Oct 19:32: vulnerable",
      "value": 3,
      "series": "vulnerable"
    },
    {
      "label": "21 Oct 19:32: unknown",
      "value": 2,
      "series": "unknown"
    },
    {
      "label": "21 Oct 19:32: patched",
      "value": 34,
      "series": "patched"
    },
    {
      "label": "22 Oct 18:27: vulnerable",
      "value": 3,
      "series": "vulnerable"
    },
    {
      "label": "22 Oct 18:27: unknown",
      "value": 2,
      "series": "unknown"
    },
    {
      "label": "22 Oct 18:27: patched",
      "value": 34,
      "series": "patched"
    }
  ],
  "series": [
    {
      "name": "vulnerable",
      "color": "#ef4444"
    },
    {
      "name": "unknown",
      "color": "#94a3b8"
    },
    {
      "name": "patched",
      "color": "#10b981"
    }
  ]
}
```

- **All 16 official `php` tags we scanned for 8.2 to 8.5 reported a fixed PHP** in every run, built 1.8 to 2.1 hours after the scheduled release.
- **At 18:21, 8 images still shipped a vulnerable PHP**: `php:8.1-fpm` and `php:8.1-apache` (8.1.34, last built in December 2025; there is no fixed 8.1 release to rebuild with), `joomla:latest` (8.4.26), `nextcloud:latest` and `nextcloud:fpm` (8.5.11), `phpmyadmin:latest` (8.3.35), `yourls:latest` (8.5.11) and `laravelsail/php84-composer:latest` (8.4.1, built in November 2024). The Laravel documentation uses that image to run Composer, not to serve traffic.
- **At 19:32, 3 were still vulnerable**: the two `php:8.1` tags and `laravelsail/php84-composer:latest`. `joomla`, both `nextcloud` tags, `phpmyadmin` and `yourls` had fixed images by then.
- **About 24 hours later, at 18:27 UTC on 22 October, the same 3 were still vulnerable**: `php:8.1-fpm`, `php:8.1-apache` and `laravelsail/php84-composer:latest`. None of them had a new build.
- **2 images could not be judged from metadata** in any run: `thecodingmachine/php:8.4-v5-fpm` sets `PHP_VERSION=8.4` without the patch level, and `linuxserver/nextcloud` installs PHP from Alpine packages and records no PHP version at all.

```chart
{
  "type": "dots",
  "title": "Hours from the scheduled 14:00 UTC release to the image build",
  "unit": " h",
  "caption": "Patched images only, by the 'created' time in each linux/amd64 image config, from results/scan-20261021T193200Z.json. This is when the image was built, not when the registry started serving it. Images still on a vulnerable PHP are not on this chart.",
  "series": [
    {
      "name": "Official php 8.2 to 8.5 (16)",
      "samples": [
        1.83,
        1.85,
        1.85,
        1.86,
        1.9,
        1.91,
        1.91,
        1.91,
        1.96,
        1.97,
        1.97,
        2.0,
        2.02,
        2.06,
        2.06,
        2.06
      ]
    },
    {
      "name": "Official app images (13)",
      "samples": [
        2.47,
        2.5,
        2.5,
        2.52,
        2.52,
        2.53,
        2.53,
        2.61,
        2.62,
        2.65,
        3.09,
        4.03,
        4.08
      ]
    },
    {
      "name": "Community images (5)",
      "samples": [
        2.23,
        3.11,
        3.68,
        3.69,
        4.05
      ]
    }
  ]
}
```

One result changes how you should read a registry. Docker Hub listed `joomla:latest` as pushed at 15:46 UTC, after the release. Its amd64 image was built at 01:52 UTC with PHP 8.4.26. So a fresh "last pushed" time is not evidence that the image you pull has a fixed PHP. The build time is not either: the fixed `joomla`, `phpmyadmin` and `yourls` images that the registry served at 19:32 were built between 16:28 and 16:36 UTC, but at 18:30 the registry still served the old ones for amd64. `nextcloud:latest` and `nextcloud:fpm` looked the same at 18:21; by 18:30 their amd64 images had moved to 8.5.12. To check the method, at 18:30 UTC we compared the amd64 digest from the Docker Hub API with the registry's own index for those three images and two others: they agreed for all five (`results/method-check-20261021T183037Z.txt`).

## The interim settings and their limits

If you cannot update today, PHP lists [settings that reduce exposure](https://www.php.net/archive/2026.php#2026-10-21-5) to specific paths. Its own words: they "reduce exposure to specific attack paths but do not make an installation safe."

For CVE-2026-109619, turn off session upload progress, and on PHP 8.5 fatal error backtraces. Set them where they apply before PHP parses the request: php.ini, the FPM pool, or the Apache config. PHP says not to rely on `ini_set()` or `.user.ini`, which apply too late.

```ini
; php.ini (and the php.ini of every SAPI: cli, fpm, apache2, cgi)
session.upload_progress.enabled = 0
; PHP 8.5 only
fatal_error_backtraces = 0
```

```ini
; PHP-FPM pool, for example /etc/php/8.3/fpm/pool.d/www.conf
php_admin_flag[session.upload_progress.enabled] = off
```

```apache
# Apache with mod_php
php_admin_flag session.upload_progress.enabled off
```

Then restart every worker. What this does and does not do, per the [advisory](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp):

- It "prevents the demonstrated early session producing and consuming operations. It does not mitigate the other lifecycle paths." `fatal_error_backtraces=0` "blocks the confirmed fatal backtrace path only."
- PHP lists it under CVE-2026-109619 only. For CVE-2026-109618 PHP suggests enforcing `memory_limit=-1` so applications cannot override it, and warns that an underlying allocation failure can still reach the bug. With no PHP memory limit, use a container or cgroup limit as the availability boundary, and do not use `RLIMIT_AS` or `RLIMIT_DATA`, which can cause the failure you are trying to avoid.
- Hiding warnings does not help. Changing `error_reporting`, `display_errors` or `log_errors`, or using `@`, does not protect against CVE-2026-109619. Instead, remove per-request settings that produce warnings or deprecation notices, including `PHP_VALUE` or `PHP_ADMIN_VALUE` lines your web server passes to FPM.
- If your application does not use multipart form data, PHP suggests blocking it at the frontend. It also suggests a low `post_max_size` (8M for applications that do not need file uploads, 32M for those that do) and proxy limits that also cover requests without a usable Content-Length.
- Edge rules help but do not replace the update. [Help Net Security](https://www.helpnetsecurity.com/2026/10/21/php2shell-php-vulnerabilities-patched-cve-2026-109618-cve-2026-109619/) reports that Cloudflare deployed WAF rules for the known exploit vectors to all customers, including Free, and [VirusTotal](https://blog.virustotal.com/2026/10/sizing-php-exposure-window-for-cve-2026.html) reports its CTO saying that only updating PHP fully protects a site.

PHP also suggests keeping `session.upload_progress.enabled=0` after you patch if you do not use upload progress bars, "as more attackers try to find flaws in this hardly-used and hardly-tested feature."

## PHP 8.1 and older

The PHP project does not release fixes for 8.1 or older. It published minimal source backports for 7.4, 8.0 and 8.1 for people who build from source, and points everyone else to their vendor. Some vendors have shipped them: Ubuntu for 22.04's PHP 8.1 and, under ESM, for 14.04 to 20.04, and Red Hat for the RHEL 8.10 EUS php:7.4 module.

The official `php:8.1` tags we scanned still reported 8.1.34, built in December 2025. Google's [guidance](https://cloud.google.com/blog/products/identity-security/responding-to-core-php-vulnerabilities-cve-2026-109618-cve-2026-109619) says App Engine applications on PHP 5.5, 7.2, 7.3, 7.4 and 8.1 remain vulnerable and must move to 8.2 or newer. VirusTotal [counted](https://blog.virustotal.com/2026/10/sizing-php-exposure-window-for-cve-2026.html) about 758,000 internet-facing hosts that announce an end-of-life PHP version from 5.4 to 8.1, out of about 1.1 million that announce a version at all. That counts exposed PHP, not confirmed vulnerable hosts, but it shows how much of the long tail has no simple update.

If you are on 8.2, the same applies on 31 December 2026, when it reaches end of life.

## Run the check

```github
The-DevOps-Daily/php2shell-check
```

`php2shell_check.py` is one file of standard-library Python, so you can copy it to a server and run it. For each PHP it finds, it reports the SAPI, the version compiled into the binary or Apache module (so mod_php is checked without running Apache; `-v` is the fallback for binaries without a readable string), the package that owns the file, and whether that package's changelog names both vulnerabilities by CVE or GHSA ID. A changelog only counts if it belongs to the installed package and `dpkg --verify` or `rpm -V` confirms the binary still matches that package. It also reports the interim settings from a fresh `php -i`, the FPM pool files, or the parsed php.ini files for mod_php, plus host web server lines that set them or pass `PHP_VALUE`. A running service started with other options can differ. Then it lists running PHP processes and marks any that still run a replaced binary. Through the first container CLI it finds (docker, then podman), it checks the PHP binaries inside each running container that has a PHP process, and adds an `unknown` result when no checked binary covers the kind of PHP process running there (for example an FPM process but only a CLI binary found). The interim settings are reported only: they never turn a vulnerable result into a pass.

This is the real output on the Raspberry Pi we build on, which has the PHP 8.4.23 CLI from packages.sury.org and no web server:

```terminal
{
  "title": "php2shell-check on the Pi",
  "prompt": "$",
  "steps": [
    {
      "comment": "2026-10-21T18:45:30Z Raspberry Pi, Debian 12, PHP CLI from packages.sury.org, no web server, run as a normal user"
    },
    {
      "cmd": "python3 php2shell_check.py",
      "output": "php2shell-check: fixed releases 8.2.35, 8.3.36, 8.4.27, 8.5.12\n\nPHP on disk\n  [vulnerable]   /usr/bin/php8.4                    cli\n      version: 8.4.23 (embedded string)\n      exposure: CLI: not a web SAPI unless it runs `php -S`; same package line often ships FPM/mod_php\n      also as: /bin/php, /bin/php8.4, /usr/bin/php\n      package: php8.4-cli 8.4.23-1+0~20260703.52+debian12~1.gbp817a0c (dpkg); CVE IDs in changelog: none\n      why: upstream 8.4.23 < 8.4.27\n      session.upload_progress.enabled: On  [php8.4 -i]\n      memory_limit=-1  post_max_size=8M\n\nRunning PHP processes\n  none\n\nContainers\n  none checked\nnote: no docker or podman CLI found; container processes are judged by the version in /proc\n\nresult: VULNERABLE or restart needed (exit 1)"
    },
    {
      "cmd": "echo $?",
      "output": "1"
    }
  ]
}
```

The exit code is 1 when anything is vulnerable or needs a restart. Otherwise it is 2 when anything could not be checked, and 0 when every PHP it found is patched or it found no PHP at all (it says which). Anything left `unknown`, such as a changelog that lists only one of the two CVEs on an older version, a pre-release build, or an unreadable process, gives 2 rather than 0, unless something else is vulnerable, which gives 1. It only knows the paths and names it searches, so a 0 means "nothing vulnerable found", not proof that no other PHP exists. To run it across hosts without copying it first:

```bash
for h in web1 web2 web3; do
  ssh "$h" 'sudo python3 - --json' < php2shell_check.py > "php2shell-$h.json"
  echo "$h exit $?"
done
```

The test suite builds fake hosts with the cases a version check gets wrong: an Ubuntu backport, the same version without the update, a partial upgrade whose symlinked changelog belongs to another package, an old binary copied over a patched package, a changelog with only one of the two CVEs, a source build where FPM was left on the old version, a process running a deleted binary, and containers on old and new images.

## How to prove you are fixed

For each host, keep evidence of all of these, not just the first:

1. **Package**: the upstream version is at or above the fixed release, or the package version is at or above your distribution's fixed version.
2. **Processes**: no PHP-FPM, php-cgi, LiteSpeed or FrankenPHP process runs a `(deleted)` binary, and no Apache process maps a `(deleted)` libphp.
3. **Containers**: the binary that serves requests inside each running container (`php-fpm`, mod_php, FrankenPHP) has a fixed version or a fixed package, not just the CLI. The image digest you deployed is the one running.
4. **Images**: every image you build FROM a PHP base has been rebuilt since the fix. The registry scan of its digest is a quick inventory check; the container check above is the proof.
5. **Exposure while vulnerable**: if a host was internet-facing and unpatched, check it for compromise. The [NCSC](https://www.ncsc.gov.uk/news/critical-security-issue-affecting-php) asks for this, and [Wiz](https://www.wiz.io/blog/php2shell-php-rce) suggests looking for unusual multipart requests followed by memory-limit errors or repeated HTTP 500 responses, unexpectedly large or malformed `PHPSESSID` response cookies, and unexplained worker churn.

## What we could not check

- **Containers on a real host.** The Pi we build on has no Docker, so the container checks are covered by the test fixtures only. The registry scan read real images.
- **Web servers.** The Pi runs PHP from the command line only. mod_php and FPM detection are covered by the tests.
- **Whether the interim settings block anything.** We did not test any part of the bugs, and the tool does not. PHP's own text is the source for what the settings cover.
- **Later distribution updates.** The distribution table is as of the evening of 21 October. At 16:49 UTC Red Hat listed a fix only for the RHEL 8.10 EUS php:7.4 module, the Debian 12 arm64 index on packages.sury.org still had the old versions at about 18:10 UTC, and PHP said Remi would not have updates that day.
- **Other architectures.** The registry scan reads linux/amd64 only. We did not measure arm64 images.
- **Unusual install paths.** The script searches distribution paths, Remi, cPanel, Plesk, CloudLinux alt-php, LiteSpeed, aaPanel and `$PATH`. PHP elsewhere, `.htaccess` overrides and stopped containers are not covered.

## Checklist

- [ ] Every host: PHP package updated, checked against the distribution's fixed version, not `php -v`
- [ ] Every PHP-FPM pool, Apache, php-cgi, LiteSpeed and FrankenPHP service restarted, with no `(deleted)` PHP binaries left in `/proc`
- [ ] Every image built FROM a PHP base rebuilt with `--pull` and redeployed by new tag or digest
- [ ] Running containers checked inside, including the binary that serves requests, and their image digests matched to what you deployed
- [ ] PHP 8.1 and older: vendor backport installed or upgrade to 8.2+ scheduled, with interim settings in place until then
- [ ] Interim settings applied where updates wait, in php.ini or the pool, with workers restarted
- [ ] `session.upload_progress.enabled=0` kept where upload progress bars are not used
- [ ] Internet-facing hosts that were unpatched checked for signs of compromise
- [ ] Check script output saved per host as evidence

Every fact in this post is listed with its source in the repo's `SOURCES.md`, together with the points where the sources disagree.
