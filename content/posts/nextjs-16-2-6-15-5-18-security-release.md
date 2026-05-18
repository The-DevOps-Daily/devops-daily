---
title: 'Next.js 16.2.6 and 15.5.18 Ship 13 Security Fixes: Patch Now'
excerpt: 'Vercel released back-to-back security updates for Next.js covering 7 high, 4 moderate, and 2 low severity advisories, including an upstream React denial-of-service issue. Here is what is broken, who is exposed, and the rollout path.'
category:
  name: 'Security'
  slug: 'security'
date: '2026-05-08'
publishedAt: '2026-05-08T10:00:00Z'
updatedAt: '2026-05-08T10:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: true
tags:
  - security
  - nextjs
  - react
  - vulnerability
  - cve
  - app-router
---

If you run any production Next.js app, you have work to do today. On May 7, 2026, Vercel published Next.js 16.2.6 and 15.5.18 with 13 security advisories rolled into the same release. Seven are rated high, four moderate, two low, and one of them is an upstream React vulnerability in the Server Components runtime that affects any framework using React 19. The exploitable surface stretches from middleware bypasses that defeat your auth checks all the way to a server-side request forgery in WebSocket upgrades.

The official guidance is the kind that gets your attention: "We strongly recommend upgrading as soon as possible." Self-hosted apps are squarely in the line of fire. Vercel-hosted apps get partial cover from platform-level mitigations on a few of the issues, but the framework patch is the only complete fix.

Here is what shipped, who needs to act, and how to roll it out without breaking your weekend.

## TLDR

| Detail | Info |
|--------|------|
| Releases | Next.js 16.2.6 and 15.5.18 |
| Advisories | 13 (7 High, 4 Moderate, 2 Low) |
| Worst CVSS | 8.6 (WebSocket SSRF) |
| Upstream React CVE | CVE-2026-23870 (Server Components DoS) |
| Affected versions | Varies by advisory; many cover 15.x &lt; 15.5.16 and 16.x &lt; 16.2.5, with some also reaching 13.x and 14.x |
| Patched versions | 15.5.18 (cumulative on the 15.x line) and 16.2.6 (cumulative on the 16.x line) |
| Node engine | 15.5.18 needs `^18.18.0 \|\| ^19.8.0 \|\| >=20.0.0`; 16.2.6 needs `>=20.9.0` |
| Vercel-hosted | Partially mitigated for some advisories |
| Self-hosted | Fully exposed until upgraded |
| What you do | `npm install next@latest` on the same major, redeploy, audit middleware-only authorization |

## What Shipped

Both releases bundle the same 13 advisories. The difference is the major version line you are on:

- **Next.js 15.x** users land on `15.5.18`. The cumulative fix actually started at `15.5.16`, with 15.5.18 picking up the rest.
- **Next.js 16.x** users land on `16.2.6`. Same pattern: a chunk of the fixes are in `16.2.5`, the rest are in `16.2.6`.

If you stayed on a 15.x release because you have not migrated to 16, you are not stuck. The 15.5 line is still being patched and gets the same coverage. There is no mandatory major upgrade hidden inside this release. You install the highest patch on your current major and you are done with the framework side of the work.

Note the Node version requirements differ between the two lines. Confirm your runtime before you bump:

- **Next.js 15.5.18** declares `engines.node` as `^18.18.0 || ^19.8.0 || >=20.0.0`. Same baseline as the rest of the 15.5.x stream.
- **Next.js 16.2.6** declares `engines.node` as `>=20.9.0`. If you are still on Node 18, you have to either pick up the 15.5.18 fix on the 15.x line or upgrade Node before you can move to 16.2.6.

Verify with `node --version` and your CI image before pinning.

## The High-Severity Advisories

Seven of the 13 are tagged High. They split into three rough groups: middleware/proxy bypass, denial of service, and one server-side request forgery that stands on its own.

### Middleware bypasses (four advisories, all 7.5+ CVSS)

This is the headline story. Four separate techniques for getting past Next.js middleware authorization checks shipped in the same release. If your app relies on `middleware.ts` for auth, RBAC, or any other access control, your authorization model is broken on the affected versions.

The four bypass paths:

1. **Segment-prefetch URLs (GHSA-267c-6grr-h53f)**: Specially crafted `.rsc` and segment-prefetch URLs resolve to the same protected page but slip past the middleware matcher. CVSS 7.5. Affects 15.2.0 through 15.5.15 and 16.0.0 through 16.2.4.
2. **Segment-prefetch incomplete fix follow-up (GHSA-26hh-7cqf-hhc6)**: A second variant of the same class that the original fix did not cover. Same severity, same affected range.
3. **Dynamic route parameter injection (GHSA-492v-c6pp-mqqv, CVE-2026-44574)**: Crafted query parameters change the dynamic route value the page sees while leaving the URL path untouched. Authorization checks that compare the path pass while the page renders content for a different parameter. CVSS 8.1, the second-worst score in this batch. Affects 15.4.0 through 15.5.15 and 16.0.0 through 16.2.4.
4. **Pages Router i18n (GHSA-36qx-fr4f-26g5)**: Apps using i18n in the Pages Router can be hit through the unprefixed `/_next/data/<buildId>/<page>.json` route. The middleware matcher does not protect this transport variant. CVSS 7.5.

The pattern across all four is the same: middleware was being matched against the human-facing URL, and Next.js had additional internal transport variants (RSC payloads, prefetch segments, raw data routes, query-injected routes) that resolved to the same page through code paths the matcher did not see. The patches extend the matcher to cover those variants.

This is not a new class of bug for Next.js. The historic CVE-2025-29927 from 2025 was a single middleware bypass. This release ships four. If your authorization story has been "the middleware will catch it," now is the time to revisit.

### Server-side request forgery (CVSS 8.6)

**GHSA-c4j6-fc7j-m34r** is the highest-rated single CVE in the release. A self-hosted Next.js app handling WebSocket upgrades can be tricked into proxying requests to arbitrary internal or external destinations. Cloud metadata endpoints (the AWS IMDS, GCP and Azure equivalents) and internal services on the cluster network are reachable from this primitive. The HTTP path already had safety checks. WebSocket upgrades did not.

Affects 13.4.13 through 15.5.15 and 16.0.0 through 16.2.4. Vercel-hosted apps are not exposed here. Self-hosted is.

### The upstream React DoS (CVSS 7.5)

**GHSA-8h8q-6873-q5fj** is the one Next.js does not own. The bug lives in `react-server-dom` (React Server Components 19.x) and is tracked upstream as **CVE-2026-23870**. A crafted POST to a Server Function endpoint forces the deserializer into excessive CPU work. The CWE is "allocation of resources without limits or throttling." A small request, an outsized cost.

Next.js patches the React dependency for you when you upgrade. If you are on a different React Server Components host (Remix, Waku, custom RSC stack), keep an eye on the React project for the equivalent fix on your runtime.

### Two more denial-of-service paths

- **GHSA-mg66-mrh9-m8jx** is a connection-exhaustion DoS in apps using **Cache Components**. A POST to a server action with a malicious `Next-Resume` header triggers a request-body handling deadlock that holds the connection open. Pile up enough of these and the server runs out of slots. The fix treats `Next-Resume` as an internal-only header and strips it from incoming requests.
- **GHSA-h64f-5h5j-jqjh** is a DoS in the **Image Optimization API** (moderate severity). The image pipeline can be pushed into expensive work by crafted requests.

## The Moderate and Low-Severity Items

The four moderate fixes are smaller in blast radius but worth a look:

- **GHSA-ffhc-5mcf-pf4q**: Stored XSS in App Router apps using CSP nonces behind shared caches. Malformed nonce values from request headers were reflected into rendered HTML, enabling cache poisoning. CVSS 4.7. Strip CSP-related request headers from untrusted sources at the edge if you cannot patch immediately.
- **GHSA-gx5p-jg67-6x7h**: XSS in `beforeInteractive` scripts when fed untrusted input.
- **GHSA-h64f-5h5j-jqjh**: The image optimization DoS mentioned above.
- **GHSA-wfc6-r584-vfw7**: Cache poisoning of React Server Component responses.

The two low-severity items are both cache-related: collisions in RSC cache-busting (GHSA-vfv6-92ff-j949) and middleware proxy redirect cache poisoning (GHSA-3g8h-86w9-wvmq).

Low CVSS does not mean ignore. If you run behind a shared CDN or a multi-tenant cache, cache-poisoning bugs let one user's request affect another user's response. Treat them as a coordinated patch with the rest.

## Are You Exposed?

A few quick checks before you reach for the patch:

```bash
# Confirm your installed version
npx next --version

# Or grep the lockfile if you don't want to run anything
grep '"next"' package.json
cat package-lock.json 2>/dev/null | grep -A1 '"node_modules/next":'
```

Decision matrix once you know your version:

| Your version | Exposure | Action |
|--------------|----------|--------|
| 15.5.18 or 16.2.6 (or later on the same line) | Patched | None on framework, audit your code |
| 15.5.16, 15.5.17, 16.2.5 | Most fixes landed; the cumulative patch is on 15.5.18 / 16.2.6 | Bump to the latest patch on your major |
| 15.x below 15.5.16 | Multiple advisories apply (exact set varies; ranges in each GHSA) | Upgrade to 15.5.18 |
| 16.x below 16.2.5 | Multiple advisories apply (exact set varies; ranges in each GHSA) | Upgrade to 16.2.6 |
| 13.x or 14.x | Subset of the advisories reach back to 13.x; partial backports unlikely | Plan a major upgrade |

Affected ranges vary per advisory. The simple call is "upgrade to 15.5.18 or 16.2.6 to cover the full batch." If you need the exact range for a single CVE, click into its GHSA from the release notes.

Vercel-hosted apps get platform-level mitigation for some of the bypass advisories. The framework patch is still the only complete fix and is required to clear the upstream React CVE and the Cache Components DoS.

## Rolling Out the Patch

The mechanics are short. Pin the new version, run the install, redeploy. Same major, no schema changes, no breaking config (mind the Node bump for 16.2.6 noted above).

<!--email_off-->

```bash
# 15.x line
npm install next@15.5.18
# or
pnpm add next@15.5.18
# or
yarn add next@15.5.18

# 16.x line
npm install next@16.2.6
```

<!--/email_off-->

Production rollout pattern that works for most teams:

<!--email_off-->

```bash
# 1) Bump the dependency in a branch
git checkout -b security/nextjs-patch
npm install next@16.2.6

# 2) Run your typecheck and tests
npm run typecheck
npm test

# 3) Build locally to catch any chunk regressions
npm run build

# 4) Deploy to staging first, smoke the auth flows you care about
#    - Sign-in / sign-out
#    - Any protected route reachable from the app shell
#    - Image optimization endpoints if you use them
#    - WebSocket / streaming routes if you self-host

# 5) Roll to production
```

<!--/email_off-->

If you cannot deploy immediately, a few of the advisories ship workarounds:

- **Dynamic route parameter injection (GHSA-492v-c6pp-mqqv)**: Implement authorization checks inside the route handler or page component, not only in middleware. This is good practice anyway.
- **Cache Components DoS (GHSA-mg66-mrh9-m8jx)**: Block requests carrying the `Next-Resume` header at your edge or proxy.
- **CSP nonce XSS (GHSA-ffhc-5mcf-pf4q)**: Strip inbound CSP-related request headers from untrusted clients.
- **WebSocket SSRF (GHSA-c4j6-fc7j-m34r)**: If you self-host and do not actually use WebSocket upgrades, drop them at the proxy.

These are stopgaps. They are not equivalent to the patch.

## Lessons for Your Architecture

A release with four middleware bypasses in one go is a strong hint about how to think about authorization in App Router apps.

**Defense in depth, not middleware only.** Middleware is fast and convenient. It is also one match function away from being routed around. Production-grade authorization for App Router apps belongs in two places at minimum: the middleware (cheap, early reject) and the route handler or page component (authoritative, runs after the framework has resolved the actual page being served). The dynamic route parameter injection bug is a textbook case where the middleware match was correct on the URL the user sent, but the page logic ran on a different parameter.

**Self-hosted means you own the perimeter.** The WebSocket SSRF and the Cache Components DoS are sharper for self-hosted deployments. If you are the one running the Next.js process behind nginx or a Kubernetes ingress, you also get to decide which headers and protocols pass through. Strip `Next-Resume` from inbound requests. Block WebSocket upgrades on routes that do not need them. Keep IMDSv2 enforced on EC2 (or the equivalent on GCP and Azure) so an SSRF cannot pull a session token from the metadata service.

**Treat shared caches as untrusted output.** Two of the moderate bugs and both lows involve cache poisoning. If you put a CDN or a shared cache in front of Next.js, every header your app reflects into HTML or sets as a cache key is a potential surface. Strip request headers you do not own at the edge. Set explicit `Cache-Control` and `Vary` so the cache is not deciding for you.

**Patch cadence is part of the architecture.** The patches are non-breaking. The pain of catching up after skipping six security releases is much higher than the pain of merging a Dependabot PR each time one lands. If you do not have automated dependency updates wired up, the cost lands on a future Monday morning instead.

## Self-Hosting Checklist

If you self-host Next.js (or you're about to), here is what to verify alongside the upgrade:

- [ ] Run a fresh build and confirm no warnings about removed APIs in the patch notes.
- [ ] Audit every `middleware.ts` matcher. If a matcher uses path patterns only, add an authorization check inside the route or page that is independent of the path.
- [ ] Confirm your reverse proxy strips `Next-Resume` and any other internal Next.js headers from inbound requests.
- [ ] Confirm WebSocket upgrades are only allowed on routes that need them.
- [ ] Pin a minimum Next.js version in a renovate or dependabot config so future security releases land automatically.
- [ ] Subscribe to the [Next.js GitHub security advisories](https://github.com/vercel/next.js/security/advisories) or the [GitHub Security Lab feed](https://github.com/advisories) so the next batch does not surprise you.

## Where to Run Your Patched App

Self-hosting Next.js is a real choice in 2026. You get to control the perimeter, you avoid platform lock-in, and you can size compute to your actual traffic instead of paying for cold-start headroom you do not use.

[DigitalOcean App Platform](https://m.do.co/c/2a9bba940f39) is a solid landing spot if you want a managed runtime that still behaves like a server you understand. Native Next.js support, git-push deployments, predictable pricing, and you keep control over the network surface that the SSRF and DoS advisories above care about. New accounts get $200 in credits, which is enough to run a small production app for a few months while you validate the move.

[Sign up for DigitalOcean](https://m.do.co/c/2a9bba940f39) if you want to test it out, or pair the App Platform with a small Droplet for the bits of your stack that need a real VM.

## Wrap-Up

Thirteen advisories in one release is a lot, but the rollout path is short: install the latest patch on your current major, redeploy, and stop relying on middleware alone for authorization. The middleware bypass family is the one to internalize beyond this single patch. Routes resolve through more transports than the URL the user types, and your auth model needs to be invariant to which transport handled the request.

If you operate Next.js anywhere reachable from the internet, this one is not optional. Patch today.

### Reference Links

- [Next.js 16.2.6 release notes](https://github.com/vercel/next.js/releases/tag/v16.2.6)
- [Next.js 15.5.18 release notes](https://github.com/vercel/next.js/releases/tag/v15.5.18)
- [Next.js security advisories](https://github.com/vercel/next.js/security/advisories)
- [Vercel announcement (X)](https://x.com/nextjs/status/2052489312944759202)
- [DigitalOcean App Platform ($200 credit)](https://m.do.co/c/2a9bba940f39)
