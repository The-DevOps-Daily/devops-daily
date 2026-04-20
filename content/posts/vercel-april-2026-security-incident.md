---
title: 'The Vercel April 2026 Security Incident: What Happened and What to Do About It'
excerpt: 'Vercel disclosed a security incident that started with a compromised OAuth app at Context.ai, escalated through a Vercel employee Google Workspace account, and reached internal systems plus customer environment variables not marked sensitive. Here is the attack chain, what was exposed, and what to change in your deployments.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-04-20'
publishedAt: '2026-04-20T09:00:00Z'
updatedAt: '2026-04-20T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'Bobby Iliev'
  slug: 'bobby-iliev'
featured: true
tags:
  - security
  - vercel
  - supply-chain
  - oauth
  - google-workspace
  - devops
---

On April 19, 2026, Vercel [disclosed a security incident](https://vercel.com/kb/bulletin/vercel-april-2026-security-incident) involving unauthorized access to internal systems. The attack did not start at Vercel. It started at a third-party AI tool called Context.ai that a Vercel employee happened to use, traveled through a compromised Google Workspace OAuth app, and eventually reached Vercel's internal environments and a subset of customer environment variables.

This is the story of a supply chain attack where the "supply chain" is not your code or your npm packages. It is the SaaS apps your employees log into with Google. Here is what happened, how to tell if you are affected, and what to change.

## TLDR

| Detail | Info |
|--------|------|
| Disclosed | April 19, 2026 |
| Initial compromise | Context.ai AWS breach, March 2026 |
| Initial vector | Stolen OAuth tokens for a Google Workspace OAuth app |
| OAuth client ID | `110671459871-30f1spbu0hptbs60cb4vsmv79i7bbvqj.apps.googleusercontent.com` |
| Affected | "A limited subset of customers" whose Vercel credentials were compromised |
| Data exposure | Environment variables **not** marked sensitive may have been read |
| Data NOT exposed | Environment variables marked sensitive |
| Response | Mandiant engaged, law enforcement notified, affected customers contacted directly |
| Services | Remained operational throughout |

Official sources: [Vercel security bulletin](https://vercel.com/kb/bulletin/vercel-april-2026-security-incident) and [Vercel's announcement on X](https://x.com/vercel/status/2045865072074035664). Vercel CEO Guillermo Rauch also [followed up with context](https://x.com/rauchg/status/2045995362499076169).

## What Happened

The attack chain is worth understanding in full because it illustrates how modern "supply chain" breaches increasingly route through identity providers rather than through code.

1. **March 2026: Context.ai has an AWS breach.** Context.ai is an AI tooling startup. They disclosed a breach of their AWS infrastructure in March. [CrowdStrike](https://www.crowdstrike.com/) investigated on their behalf.
2. **OAuth tokens were stolen but not flagged.** The AWS breach also exposed OAuth tokens that Context.ai held for its Google Workspace integration. The investigation apparently did not catch this.
3. **A Vercel employee used Context.ai.** That employee had granted Context.ai access to their Google Workspace via OAuth, as you do with any third-party SaaS app that needs to read mail, files, or calendars.
4. **Attacker replayed the tokens.** With valid OAuth tokens, the attacker could impersonate the Context.ai app and access the Vercel employee's Google Workspace account. No password or MFA prompt is triggered when a pre-authorized OAuth app calls the Google APIs.
5. **Lateral movement into Vercel internal systems.** From the Workspace account, through a series of escalating moves, the attacker reached Vercel internal environments.
6. **Access to customer environment variables.** Once inside, the attacker could read environment variables on the Vercel platform that were **not** marked as "sensitive" by the customer. Vercel encrypts all env vars at rest, but variables flagged sensitive are unreadable even by Vercel staff and stayed out of reach.

Vercel detected the activity, engaged [Mandiant](https://cloud.google.com/security/mandiant), notified law enforcement, and disclosed publicly on April 19.

## What Was Exposed (and What Was Not)

### What Vercel officially confirmed

What the attacker may have accessed:

- Vercel credentials for "a limited subset of customers"
- Environment variables **not** marked sensitive on those customers' projects
- Deployment Protection tokens on those customers' projects
- Various internal Vercel systems and tooling

What the attacker did **not** access:

- Environment variables marked sensitive (these are locked even against Vercel staff)
- Anything at customers outside the named subset (Vercel reached out directly to those who were affected)
- Vercel's build/runtime infrastructure itself

> "Environment variables marked as 'sensitive' were **not** accessible to the threat actor."  
> Vercel Security Team, [April 2026 bulletin](https://vercel.com/kb/bulletin/vercel-april-2026-security-incident)

Services remained operational throughout. The public Vercel edge, the build system, and your deployments were not the attack surface.

### What the attackers are claiming

Separately from Vercel's official disclosure, a [tweet from security researcher @k1rallik](https://x.com/k1rallik/status/2045885869035323645) claims the threat actor is **ShinyHunters** (the group behind the 2024 Ticketmaster breach) and that a copy of Vercel's internal database is being advertised for $2M on BreachForums. According to that claim, the listing includes **NPM tokens and GitHub tokens** belonging to Vercel. The researcher also claims Vercel contacted the attackers directly on Telegram.

**This has not been officially confirmed by Vercel.** Treat it as a community signal, not established fact. But the risk it implies is worth taking seriously: if NPM tokens that publish packages Vercel maintains were stolen, the worst-case consequence is a malicious version of `next`, `@vercel/next`, `@vercel/analytics`, or any other Vercel-published package showing up on npm. Next.js alone has roughly 6 million weekly downloads, which would make this a textbook global supply chain attack in the same shape as the recent [axios compromise](/posts/axios-supply-chain-attack-what-happened-and-what-to-do).

We'll update this post if Vercel confirms or refutes the token theft.

## Are You Affected?

Vercel contacted affected customers directly. If you did not receive a notification, Vercel says there is no indication your account was compromised. That said, the conservative thing to do is verify.

### Check your notifications

1. Look in the inbox associated with your Vercel account owner for an email from Vercel dated on or around April 19, 2026.
2. Check the Vercel dashboard for banners or in-app notifications.
3. Search your spam / quarantine folder.

### Audit your account activity

```text
# In the Vercel dashboard:
# Settings → Security → Audit Log
```

Look for unfamiliar:

- Deployments you did not trigger
- New team members or project invites
- Token creations or SSH key additions
- Changes to environment variables
- Changes to domain or DNS settings

Pay extra attention to activity between **early April 2026** and the day you audit.

### Review recent deployments

```text
# Vercel dashboard → Project → Deployments
```

For each production deployment since early April, verify:

- The commit SHA matches what you expect in your git history
- The build log does not contain unexpected commands or outputs
- The deployment was triggered by a known user or CI pipeline

## How to Fix It If You Are Affected

If Vercel notified you, or if your audit turns up anything suspicious, assume your non-sensitive environment variables have been read and act accordingly.

### 1. Rotate every secret that was in a non-sensitive env var

This includes:

- Third-party API keys (Stripe, OpenAI, Sentry, PostHog, Resend, anything)
- Database connection strings and credentials
- OAuth client secrets and webhook signing keys
- Internal service-to-service tokens
- Any other credential that was stored as a regular env var rather than a sensitive one

Rotate in-place if you can. If not, issue new credentials, deploy them, then revoke the old ones.

### 2. Rotate Deployment Protection tokens

```text
# Vercel dashboard → Project → Settings → Deployment Protection → Rotate token
```

If an attacker had a DP token, they could bypass protection on your preview deployments.

### 3. Raise Deployment Protection to at least Standard

If Deployment Protection was set to None or below Standard on affected projects, bump it up. This prevents future unauthorized access to preview URLs.

### 4. Adopt sensitive environment variables going forward

Vercel offers a "sensitive" flag per variable. Sensitive values:

- Are readable only by the running deployment, never by the dashboard, the CLI, or Vercel staff
- Are not included in build logs
- Are not viewable after being set

Move every secret (keys, tokens, passwords) to sensitive. Reserve non-sensitive variables for truly non-secret config like feature flags, region names, or public URLs.

```text
# When adding a new env var in the dashboard, check the
# "Sensitive" checkbox. For secrets, always.
```

### 5. Rebuild and redeploy

After rotating, trigger a clean redeploy so the new values are live and the old values become inactive references in old builds only.

### 6. Pin your Next.js and Vercel-published npm dependencies

If you use Next.js or any package published by Vercel (`next`, `@vercel/*`, `@next/*`), pin to known-safe versions in your lockfile until Vercel officially confirms no publish tokens were exposed:

```bash
# See what you have locked
grep -E '"next":|"@vercel/|"@next/' package.json package-lock.json yarn.lock pnpm-lock.yaml 2>/dev/null

# In CI, use clean installs that respect the lockfile exactly
npm ci
# or
pnpm install --frozen-lockfile
# or
yarn install --frozen-lockfile
```

Disable `postinstall` scripts on untrusted dependencies in CI if you do not need them:

```bash
npm ci --ignore-scripts
```

Monitor the [npm feed for the `next` package](https://www.npmjs.com/package/next?activeTab=versions) for any unexpected release between April 19 and when Vercel gives the all-clear. An unscheduled patch release in that window is a red flag.

## How to Prevent the Same Class of Attack

This attack will happen again, to somebody. It is a pattern, not a one-off. Here is what to harden across your org, whether you use Vercel or not.

### 1. Treat OAuth app grants as access control

Every "Login with Google" grant your team accepts is a persistent access path into your identity provider. Most orgs never audit what's been granted.

```text
# Google Workspace admin: Security → Access and data control →
#   API controls → App access control → Manage Third-Party App Access
```

Review the list. Revoke anything nobody recognizes. Move high-value scopes (Drive, Gmail, Calendar read/write) onto an explicit allow-list so employees cannot silently grant new apps permission to read company data.

GitHub has [a similar review page](https://github.com/settings/applications) for OAuth apps that have been granted access to your org.

### 2. Minimize scopes on every OAuth integration

When you connect a third-party SaaS app to Workspace or Microsoft 365, check the scope list. If the app asks for `https://mail.google.com/` (full mail access) when it only needs to read your calendar, that is a scope you should refuse. Most employees accept whatever is asked for.

### 3. Mark every secret as sensitive, by default

Not just on Vercel. On every platform that offers a distinction:

- **Vercel**: sensitive env vars
- **AWS**: Secrets Manager, never plain env vars on Lambdas you can `kubectl get` on
- **GitHub Actions**: encrypted secrets, not plain env in workflow yaml
- **Kubernetes**: Secret objects at minimum, ideally sealed-secrets or External Secrets Operator backed by Vault

The principle: a secret should never be readable by a dashboard, a log, or a human administrator, only by the process that needs it at runtime.

### 4. Monitor Google Workspace for unusual token use

Workspace logs every OAuth app token access. You can alert on:

- Tokens from an OAuth app that hasn't been used in 30+ days suddenly activating
- Tokens used from unusual geographies or IPs
- OAuth apps reading large numbers of documents or emails in short bursts

This is exactly the kind of activity that would have caught the replay in this incident earlier. Most orgs have these logs but no alerts wired up to them.

### 5. Have an incident plan that covers "a vendor got breached"

The most common response to "one of our SaaS vendors got hacked" is to wait and see. That's too slow. Pre-write:

- Who on your team is the point of contact when a vendor discloses a breach
- Which secrets need to be rotated in which order (usually: identity providers first, then payment/billing, then product APIs)
- How to communicate to your own customers if the incident affects them
- Where the rotation runbook lives

Practice it once a year on a tabletop exercise. [Our BCDR simulator](/games/bcdr-simulator) walks through similar scenarios if your team wants to rehearse.

## The Bigger Lesson

The scary part of this incident isn't that Vercel was breached. It is that the initial vector was an AI tool nobody on the Vercel security team had any view into. Context.ai was compromised a month before anyone at Vercel knew there was a problem. CrowdStrike apparently did not flag the OAuth tokens as part of their investigation scope.

If you use [Vercel](https://vercel.com) or any serverless platform, your risk surface now includes every SaaS app every employee has ever signed into with their Google account. That is a very large surface. Auditing it, scoping it down, and alerting on unusual token activity is the only defense. Waiting for the vendor to disclose is not a strategy.

If you want to dig deeper into secure DevOps practices, our [security checklists](/checklists) cover the full lifecycle from config to runtime, and our [DevSecOps roadmap](/roadmap/devsecops) lays out the skills to build a team that catches this class of attack early.

---

Have questions about this incident or want to share how your team responded? Reply on [X](https://x.com/thedevopsdaily) or [LinkedIn](https://www.linkedin.com/company/thedevopsdaily). We update this post as Vercel releases new details.
