---
title: 'Why Your Base Image Has 1,684 CVEs'
excerpt: 'I inventoried 17 base images straight from the registry and counted every advisory against the exact package versions inside. The totals are larger than you expect, one package produces most of them, and the runtime you actually run is not in the count at all.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2026-08-14'
publishedAt: '2026-08-14T09:00:00Z'
updatedAt: '2026-08-14T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Docker
  - Security
  - Containers
  - Supply Chain
  - Alpine
  - Debian
---

You add a scanner to CI, point it at the image you have shipped for two years, and the build goes red. The report says 1,684 vulnerabilities, 492 of them high or critical. Nobody on the team wrote any of that code. The ticket lands on you anyway, with a title like "remediate criticals before release".

So you do the obvious things. You rebuild against the newest tag. The number does not move at all. You switch to `-slim`. Sometimes the number collapses, sometimes it changes by nothing. You start to suspect the number is not measuring what the ticket assumes it measures.

It is not. This article takes 17 common base images, counts every advisory that applies to the exact package versions inside each one, and shows where the number comes from. The short version: it is an inventory count, one package produces three quarters of it, the language runtime you actually execute is not represented in it at all, and on a fully patched image every remaining finding is one you cannot fix.

## TLDR

- The count tracks **how many packages the image records**, not risk. `node:22` records 413 packages and 1,684 advisories. `node:22-slim` records 88 and 80.
- **73% of `node:22`'s advisories come from `linux-libc-dev`**, a package of C header files. Your container runs the host's kernel, so a finding there is not evidence that anything in your image is vulnerable.
- `node:22-slim` records the **identical 88 packages as `debian:bookworm`**. Node.js is installed from a tarball, so not one of those findings is about the runtime you actually execute.
- `debian:bookworm` and `debian:bookworm-slim` record the same 88 packages and the same 80 advisories. Slim removes docs, man pages and locales, not packages.
- On a **fully patched** Debian 12 image, all 80 have no fix available. The "fixable" number a scanner shows you is a measure of how far behind you are, not of your risk.
- Debian's own triage marks 27 of those 80 `unimportant`, including one the NVD scores **9.8 Critical** and marks Disputed.

## Prerequisites

- Familiarity with Dockerfiles and base image tags
- A rough idea of what a CVE and a CVSS score are
- `curl`, `tar`, `jq` and Node.js if you want to reproduce the measurements
- No Docker daemon required

## How I measured this, and what the method does not cover

There is no Docker daemon involved. A registry serves the manifest and each layer as an addressable blob, so you can stream a layer through `tar`, keep only the package database, and discard the rest. Layer blobs still get downloaded, they just never become a local image.

The package database is what a scanner reads to build its inventory:

- Debian and Ubuntu keep it at `/var/lib/dpkg/status`
- Alpine and Wolfi keep it at `/lib/apk/db/installed`
- Distroless splits it into one file per package under `/var/lib/dpkg/status.d/`

Every package was then queried against [OSV](https://osv.dev/) using the distro's own feed: `Debian:12`, `Debian:13`, `Ubuntu:24.04:LTS`, `Alpine:v3.24`, `Wolfi`. Distro advisories are keyed by **source** package, so binaries were collapsed onto their source first. Counting binary packages would inflate every total.

Three things about this method are worth stating plainly, because two of them made me throw away a set of numbers.

**This inventories OS package records, and nothing else.** It is not a full image scan. Anything installed outside the package manager is invisible to it, and that turns out to matter a great deal, as the second finding below shows.

**Layers must be replayed in order.** My first attempt walked layers from the top and stopped at the first package database it found. That is right for `dpkg/status`, which whichever layer last ran `apt` rewrites wholesale. It is wrong for distroless, which spreads `status.d/` across 19 layers, one file per package, so stopping at the top layer reported distroless as having exactly 1 package. Replaying every layer in order fixes it. Note that a faithful replay would also need to honour OCI whiteout markers for deleted files; none of these images delete package database entries, but a general-purpose tool must handle it.

**Follow the pagination.** `/v1/querybatch` returns at most 1000 vulns per query and hands back a `next_page_token`. `linux-libc-dev` alone exceeds that, so my first run reported `node:22` at 1,457. Paginating to exhaustion gave the real figure of 1,684. The truncation is documented, but a client that ignores the token undercounts by thousands and looks perfectly healthy doing it.

:::note
These are distinct advisory records affecting the exact installed versions, including ones with no fix. For the Debian images every record is a `DEBIAN-CVE-*` identifier mapping one to one onto a CVE, so calling them CVEs is fair here. A scanner you run will report a different total, for reasons covered in the FAQ.
:::

## The numbers

Measured 14 August 2026, `linux/amd64`.

| Image | Package records | Advisories | Size (compressed) |
| --- | --- | --- | --- |
| `chainguard/static` | 3 | 0 | 0.6 MB |
| `distroless/static-debian12` | 4 | 0 | 0.7 MB |
| `alpine:3.21` | 15 | 0 | 3.6 MB |
| `chainguard/wolfi-base` | 15 | 0 | 7.2 MB |
| `distroless/base-debian12` | 6 | 15 | 8.2 MB |
| `node:22-alpine` | 18 | 0 | 57.7 MB |
| `python:3.13-alpine` | 29 | 0 | 16.9 MB |
| `chainguard/python` | 25 | 0 | 26.1 MB |
| `chainguard/node` | 27 | 0 | 66.0 MB |
| `distroless/nodejs22-debian12` | 10 | 37 | 52.6 MB |
| `ubuntu:24.04` | 92 | 48 | 29.8 MB |
| `python:3.13-slim` | 87 | 72 | 43.0 MB |
| `debian:bookworm-slim` | 88 | 80 | 28.2 MB |
| `debian:bookworm` | 88 | 80 | 48.5 MB |
| `node:22-slim` | 88 | 80 | 79.9 MB |
| `python:3.13` | 469 | 1,167 | 412.8 MB |
| `node:22` | 413 | 1,684 | 408.4 MB |

Within this sample, ordering by advisory count is nearly the same as ordering by package count. That is not a law of nature and the sample mixes feeds that are not comparable, so treat it as what it is: in these images, the total mostly reflects how much the image records, and one source package dominates the largest entries.

```chart
{
  "type": "bar",
  "title": "Same app, same base distro, three image choices",
  "caption": "All three are Debian 12, counted against the same Debian:12 feed, so this comparison is like for like. Measured 14 August 2026.",
  "rows": [
    { "label": "node:22", "value": 1684, "series": "full" },
    { "label": "node:22-slim", "value": 80, "series": "slim" },
    { "label": "distroless/nodejs22", "value": 37, "series": "distroless" }
  ],
  "series": [
    { "name": "full", "color": "#ef4444" },
    { "name": "slim", "color": "#f59e0b" },
    { "name": "distroless", "color": "#10b981" }
  ]
}
```

## Finding 1: one package produces three quarters of the number

Breaking `node:22`'s 1,684 advisories down by source package puts one entry far out in front:

| Source package | Advisories |
| --- | --- |
| `linux` | 1,227 |
| `binutils` | 62 |
| `expat` | 25 |
| `postgresql-15` | 24 |
| `libheif` | 22 |
| `curl` | 21 |
| `openexr` | 21 |
| `openssh` | 21 |
| `tiff` | 20 |
| `python3.11` | 19 |

The `linux` source package produces exactly one binary here: `linux-libc-dev`. Debian describes it as ["Linux support headers for userspace development"](https://packages.debian.org/bookworm/linux-libc-dev), and its [file list](https://packages.debian.org/bookworm/amd64/linux-libc-dev/filelist) is headers under `/usr/include` plus package metadata. No kernel, no modules, nothing that executes.

Your container does not run its own kernel, it runs the host's. So a kernel CVE attached to the headers in your image is not evidence that your image is vulnerable, and it is not evidence that your host is either. It is an artefact of mapping "this package was built from a kernel source tree" onto "this image is affected".

That accounts for 1,227 of 1,684 advisories, **73% of the total**. Excluding it leaves 457.

Be careful about how far you take this. A vulnerable host kernel absolutely can be attacked from inside a container; the headers neither cause nor prevent that, and removing them from the report does not make the host safe. The correct conclusion is narrow: these findings are attributed to the wrong artefact, and the question they raise ("is the host kernel patched?") is not one the image scan can answer.

This is a long-running complaint against every scanner built on distro feeds. The Trivy issue asking for it was [closed as not planned](https://github.com/aquasecurity/trivy/issues/3010), with similar reports across [Trivy](https://github.com/aquasecurity/trivy/issues/693) and [GitLab container scanning](https://gitlab.com/gitlab-org/gitlab/-/issues/5526).

:::tip
Rather than a blanket ignore rule, record a scoped [VEX](https://www.cisa.gov/sites/default/files/2024-10/SBOM%20Framing%20Software%20Component%20Transparency%202024.pdf) statement of `not_affected` for kernel CVEs inherited through `linux-libc-dev`, with the justification written down, and track host kernel patching as its own control. A VEX statement is reviewable and expires. An ignore list in CI config is forgotten within a quarter.
:::

## Finding 2: the runtime you actually run is not in the count

Here is the result that changed how I read every one of these reports. I diffed the package name sets of `node:22-slim` and `debian:bookworm`:

```text
node:22-slim      88 package records
debian:bookworm   88 package records
identical sets:   true
dpkg entries matching node/npm/yarn:  none
```

`node:22-slim` records exactly the same 88 packages as plain `debian:bookworm`. The official Node images install Node from an upstream tarball into `/usr/local`, outside dpkg entirely. So when a scanner reports 80 findings against `node:22-slim`, **not one of them concerns Node.js, npm, or anything else you actually execute**. It is a report about Debian, delivered while a Node runtime sits next to it, unexamined.

The same holds for `python:3.13`, which builds CPython under `/usr/local`, and for `distroless/nodejs22-debian12`, whose 10 dpkg records are `base-files`, `libc6`, `libssl3`, `tzdata` and friends, with the Node binary copied in.

Contrast Chainguard, which packages the runtime through apk:

```text
chainguard/wolfi-base    15 packages
chainguard/node          27 packages
  node-related apk packages: nodejs-26, node-gyp, npm-12
```

This has a direct consequence for every "our image has fewer CVEs" comparison you will ever be shown, including the table earlier in this article. Wolfi's feed covers the Node runtime because Wolfi packages it. Debian's feed does not, because Debian is not shipping it. Those two numbers are not measuring the same surface, and the Debian-based one is flattered by an omission.

If you want an inventory that includes the runtime and your application dependencies, you need an SBOM built by a tool that catalogs language ecosystems, not just the OS package database.

## Finding 3: "slim" means two completely different things

```text
debian:bookworm         88 packages   80 advisories   48.5 MB
debian:bookworm-slim    88 packages   80 advisories   28.2 MB

node:22                413 packages 1684 advisories  408.4 MB
node:22-slim            88 packages   80 advisories   79.9 MB
```

For the first pair the package sets are identical, which the [official rootfs manifests](https://github.com/debuerreotype/docker-debian-artifacts) confirm. Debian's slim variant removes files, not packages: documentation, man pages, info files, locales and lintian data, per the [slimify exclusion list](https://github.com/debuerreotype/debuerreotype/blob/master/scripts/.slimify-excludes). It saves 20 MB and zero advisories. Anyone who moved from `debian:bookworm` to `debian:bookworm-slim` to fix a scan result changed nothing at all.

The second pair is a different operation. `node:22` is built on `buildpack-deps`, which installs a compiler toolchain, `git`, `subversion`, `mercurial`, image libraries and `libpq-dev` so native modules can build. `node:22-slim` skips all of it, and the 325 packages it drops carry the advisories.

So "use the slim tag" is good advice for a reason most people state wrongly. It helps when the slim variant omits packages. On the Debian base images it is purely a size optimisation. This is also specific to Debian and to this snapshot, not a general property of the word "slim" across distributions.

## Finding 4: on a patched image, nothing is fixable

Splitting each image's findings by whether a fixed version exists **for the release that image is actually on**:

| Image | Advisories | Fix available | No fix |
| --- | --- | --- | --- |
| `debian:bookworm` | 80 | 0 | 80 |
| `node:22-slim` | 80 | 0 | 80 |
| `node:22` | 1,684 | 0 | 1,684 |
| `python:3.13-slim` | 72 | 0 | 72 |
| `distroless/base-debian12` | 15 | 0 | 15 |
| `ubuntu:24.04` | 48 | 4 | 44 |
| `distroless/nodejs22-debian12` | 37 | 21 | 16 |
| `python:3.13` | 1,167 | 302 | 865 |

Getting this right took two attempts and the first one was wrong in a way worth describing, because the same mistake is easy to make in your own tooling. An OSV record carries one `affected` entry per distro release. My first pass asked "does any entry anywhere in this record have a fixed event", which answers a different question: Debian 13 having a patch says nothing about your Debian 12 image. Of the 2,046 records here, 1,615 have mixed fix status across their entries, so the loose version massively overstated how much was fixable. The count has to be scoped to the matching ecosystem and package.

Once scoped, the pattern is stark and it makes sense on reflection. Querying by installed version only returns advisories that version does not already satisfy. A fully up-to-date `debian:bookworm` therefore shows 80 findings of which **exactly zero have a fix**, because anything with an available fix was already installed. What is left is the residue Debian has recorded and chosen not to patch in this release.

The images with fixable findings are the ones running behind. `distroless/nodejs22-debian12` carries glibc `2.36-9+deb12u13` while `debian:bookworm` is on `u14`, and that single point release accounts for its 21 fixable findings:

```text
glibc 2.36-9+deb12u13   19 advisories   6 with "fixed": "2.36-9+deb12u14"
glibc 2.36-9+deb12u14   13 advisories   0 with a fix
```

This reframes what the scanner's "fixable" column actually is. It measures your patch lag. Drive it to zero and it stays at zero until the next advisory lands, which is exactly what you want from it. The other column, the permanently unfixed remainder, never moves no matter what you do, and it is the one the remediation ticket usually quotes.

:::warning
"No fix available" is not the same as "no action required". You can still remove the package, disable the affected feature, restrict the attack path, upgrade to a newer distro release, or record a reasoned exception with an expiry. If an unfixed finding is in [CISA's KEV catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog), it is being exploited in the wild right now and it needs mitigation today, patch or no patch. Blanket `--ignore-unfixed` in CI would hide exactly that case.
:::

## Finding 5: a 9.8 that Debian calls unimportant

Debian's security tracker records a triage verdict alongside each advisory, and OSV carries it through as `ecosystem_specific.urgency`. Of `debian:bookworm`'s 80 advisories, 27 are marked `unimportant`.

CVE-2019-1010022 in glibc is the clearest case. The [NVD record](https://nvd.nist.gov/vuln/detail/CVE-2019-1010022) carries the vector `CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`, which computes to a base score of **9.8, Critical**. That is the number your dashboard sorts on and your policy gate blocks on. The NVD also marks the record **Disputed**, and its description ends by quoting the glibc maintainers:

> NOTE: Upstream comments indicate "this is being treated as a non-security bug and no real threat.

Debian's [tracker entry](https://security-tracker.debian.org/tracker/CVE-2019-1010022) still lists it as unfixed in bookworm, and the machine-readable triage on the same advisory reads:

```json
{ "urgency": "unimportant" }
```

So a Critical-scored, unfixed finding sits in glibc, in essentially every glibc-based image, and the people who maintain the code say it is not a security bug. It has been there since 2019. Three of the four oldest glibc advisories here are of this type, and one of them, CVE-2010-4756, dates from 2010.

None of that makes CVSS useless. It makes a base score computed from a vector, with no knowledge of whether the code path is reachable in your image, a poor priority ranking. The distro maintainers published their assessment in a field almost nobody reads, and it disagrees with the number everyone acts on.

## Finding 6: zero does not mean clean

Alpine and the Chainguard images all report 0 here. Two different things produce that, and only one of them is about security.

The real part: these images record far fewer packages. `chainguard/node` records 27 against `node:22`'s 413. `alpine:3.21` records 15. Fewer packages means less to patch, less to inventory, and less to argue about in a review. That advantage is structural.

The artifact part is the feed. I checked how many records in each OSV feed describe a vulnerability with no fixed version:

| OSV feed | Package | Total records | With no fix |
| --- | --- | --- | --- |
| `Debian:12` | glibc | 160 | 11 |
| `Ubuntu:24.04:LTS` | glibc | 32 | 3 |
| `Alpine:v3.21` | musl | 6 | 0 |
| `Alpine:v3.24` | musl | 6 | 0 |
| `Wolfi` | glibc | 35 | 0 |

Debian's feed carries 160 glibc records where Wolfi's carries 35, and Debian is the only one of the four with a meaningful count of permanently unfixed entries. Alpine's OSV input is converted from its fix-oriented SecDB, which under-represents issues that have no fix yet; Alpine's own [security tracker](https://security.alpinelinux.org/) lists potentially-vulnerable issues that SecDB does not. Chainguard's own advisory system does publish unfixed states such as "under investigation" and "fix not planned", so the zero here reflects the OSV export and these specific installed versions rather than a policy of silence.

The honest reading is narrow: a large part of the gap between "80" and "0" is a difference in what each feed writes down, so cross-distro CVE totals compare disclosure practice as much as security. Comparing **within** one feed, as the `node:22` to `node:22-slim` to `distroless` chart does, is fair and shows a real effect.

## What actually moves the number

**Separate the build image from the runtime image.** The biggest lever, and free. The toolchain that makes `node:22` a 413-package image is needed at build time and never at run time.

```dockerfile
# Build stage: the fat image, with every toolchain you need
FROM node:22 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# Runtime stage: only what serves traffic
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# package.json matters at runtime: Node reads its "type" field to decide
# whether .js is ESM or CommonJS, so omitting it breaks ESM builds.
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
CMD ["node", "dist/server.js"]
```

Two things that bite here. Use a `.dockerignore` containing `node_modules`, or `COPY . .` will overwrite the clean Linux tree that `npm ci` just built with whatever your laptop has. And native addons compiled against libraries present in `buildpack-deps` can fail at runtime in `-slim` if the shared library is not there, so test the runtime image rather than assuming it starts.

That change takes the base from 1,684 advisories to 80 and from 408 MB to 80 MB. Your application's own dependencies then add both size and findings on top; the base image is a floor, not the final figure.

**Go further down if the runtime allows it.** `distroless/nodejs22-debian12` runs Node on 10 package records. Know the tradeoff first: there is no shell, so `kubectl exec -it ... -- sh` gets you nothing and debugging moves to ephemeral debug containers. You can still exec binaries that are present.

**Pin by digest and rebuild deliberately.** A weekly rebuild only picks up fixes if the base actually gets re-resolved. Tags are mutable and layer caching will happily reuse a stale base, so rebuild with `--pull`, or pin `FROM image@sha256:...` and update the digest on a schedule with something like Renovate. Pinning without a bump process is how images end up two point releases behind, which is precisely what happened to `distroless/nodejs22` above.

**Gate on something an engineer can satisfy.** "No criticals" fails on a bug glibc's maintainers call a non-issue and cannot be satisfied by any action, so teams add blanket exceptions, and the exceptions are what let a real finding through six months later. A workable policy blocks on findings with an available fix older than N days, blocks on anything in KEV regardless of fixability, and routes the unfixed remainder to a review queue rather than the build log. [EPSS](https://www.first.org/epss/) can help order that queue, as long as you remember it estimates exploitation activity and says nothing about whether the code is reachable in your image.

## Where this leaves the scanner

None of this says stop scanning. Scanners are how you learn that your image still carries the `curl` from before the last advisory, and that alone justifies running them.

What the measurements say is that the headline total is close to meaningless as a risk signal, and managing it as a target produces work with no security value. Three of the six findings here are cases where the number moved a lot without the image getting safer, or refused to move regardless of what anyone did. One is a case where the number said nothing at all about the software actually being executed.

The useful number is much smaller than the one on the dashboard: findings in packages you actually execute, with a fix available or a known exploit, in code paths your application reaches. Everything else is a report about Debian's bookkeeping, and it deserves a review queue rather than a release gate.

## Reproduce it yourself

With Docker and a scanner, the quick version:

```bash
# how many package records, which is most of the answer
docker run --rm node:22 sh -c 'dpkg -l | grep -c "^ii"'
docker run --rm node:22-slim sh -c 'dpkg -l | grep -c "^ii"'

# how much of the count is kernel headers
trivy image --scanners vuln node:22 --format json \
  | jq '[.Results[].Vulnerabilities[]? | select(.PkgName=="linux-libc-dev")] | length'
```

The registry-only method used here streams layer blobs and keeps just the package database:

```bash
REG=registry-1.docker.io
REPO=library/node
TAG=22-slim
DEST=$(mktemp -d)

TOKEN=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:$REPO:pull" \
  | jq -r .token)

# resolve the amd64 manifest out of the multi-arch index, and keep the digest
DIGEST=$(curl -s -H "Authorization: Bearer $TOKEN" \
  -H 'Accept: application/vnd.oci.image.index.v1+json' \
  "https://$REG/v2/$REPO/manifests/$TAG" \
  | jq -r '.manifests[] | select(.platform.architecture=="amd64" and .platform.os=="linux") | .digest')
echo "measuring $REPO@$DIGEST"

# replay layers in order into a fresh directory, keeping only the package db
for L in $(curl -s -H "Authorization: Bearer $TOKEN" \
    -H 'Accept: application/vnd.oci.image.manifest.v1+json' \
    "https://$REG/v2/$REPO/manifests/$DIGEST" | jq -r '.layers[].digest'); do
  curl -sL -H "Authorization: Bearer $TOKEN" "https://$REG/v2/$REPO/blobs/$L" \
    | tar -xz -C "$DEST" --wildcards \
        '*var/lib/dpkg/status' '*var/lib/dpkg/status.d*' '*lib/apk/db/installed' 2>/dev/null
done

grep -c '^Package: ' "$DEST/var/lib/dpkg/status"
```

Then query one package, scoping fix status to the release you are actually on:

```bash
curl -s -X POST https://api.osv.dev/v1/query \
  -d '{"package":{"name":"glibc","ecosystem":"Debian:12"},"version":"2.36-9+deb12u14"}' \
  | jq '{
      total: (.vulns | length),
      no_fix: [ .vulns[]
        | select([ .affected[]
            | select(.package.ecosystem=="Debian:12" and .package.name=="glibc")
            | .ranges[]?.events[]? | select(.fixed) ] | length == 0) ] | length
    }'
```

Note the nested `select` on ecosystem and package name. Without it you are asking whether the bug is fixed in some other Debian release, which is the mistake described in Finding 4.

## FAQ

**Does this mean base image CVEs never matter?**
No. It means the total is the wrong thing to manage. A fixable critical in a library your code calls on every request matters a great deal, and it is sitting in the same report as 1,227 kernel header findings that are attributed to the wrong artefact. The work is separating them, which is what reachability analysis, KEV and VEX exist to do.

**Why does my scanner report a different total?**
Different inventory catalogers, different advisory sources, different handling of aliases and source-to-binary mapping. Note that severity filtering is usually not the cause: Trivy reports all severities by default and only drops unfixed findings when you pass `--ignore-unfixed`, and Grype's `only-fixed` defaults to false. Expect the same shape and different digits.

**Is Alpine more secure than Debian?**
This data cannot answer that, and neither can a comparison of their CVE counts, for the reasons in Finding 6. Alpine images are smaller and carry fewer packages, which is a genuine advantage. musl and busybox also behave differently from glibc and coreutils in ways that occasionally break applications. Choose on package count, support lifetime, patch latency and runtime compatibility, not on a scanner total.

**What about `apt-get upgrade` in my Dockerfile?**
On a current base image it has nothing to do, since all 80 findings already lack a fix. It also makes builds non-reproducible, because the same Dockerfile produces different images on different days. Prefer pinning a digest and bumping it deliberately.

**Is distroless always the right answer?**
No. You lose the shell, which changes how you debug production, and the base is still Debian, so `distroless/base-debian12` still reports 15 advisories with no fix for any of them. It is a large improvement, not a zero. It also needs the same digest-bump discipline as anything else, as the two-point-release lag in `distroless/nodejs22` shows.
