---
title: 'You Cannot Rotate a Secret You Cannot Find'
excerpt: 'Trace one credential from a laptop to production and count the copies it leaves behind. That count is your rotation cost and your blast radius, and it is why most teams never rotate anything.'
category:
  name: 'Security'
  slug: 'security'
date: '2026-08-11'
publishedAt: '2026-08-11T09:00:00Z'
updatedAt: '2026-08-11T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Security
  - Secrets
  - DevOps
  - CI/CD
  - Kubernetes
---

Ask a team when they last rotated their database password. The answer is usually a pause, then "when we set it up".

That is not laziness. Rotation is avoided because nobody can say what will break. The password lives in more places than anyone can list, and the only way to find them all is to change it and see what pages. So it never gets changed, and it keeps working, and it stays in the same places for another two years.

This is about the count. Trace one credential from a laptop to production, count the copies it leaves behind, and you have the number that decides both how expensive rotation is and how bad a leak is.

## TL;DR

- References are easy to find. **Copies of the value** are the problem, and they are in different systems owned by different people.
- Run the inventory before you buy anything. Most teams are surprised by their own answer.
- A secret in git history is leaked even after you delete the file. The only fix is rotation.
- A Kubernetes Secret is base64, not encryption. `-o yaml` and `base64 -d` is the whole attack.
- In a leak, **revoke first, investigate second.** The instinct to understand before acting is the expensive one.
- Rotation is expensive because it is manual and risky. Both go away if the credential expires on its own, which is why short-lived beats stored.
- `.env` survives because it works offline with no auth dance. Any replacement that loses that will lose to it.

## Prerequisites

- A service with credentials in more than one environment
- Shell access to your repo and CI configuration

## Start by counting

Before choosing a tool, answer one question: for a single credential, how many places would you have to change?

Not "where is it referenced". References are the easy half and `grep` finds them. The hard half is copies of the *value*, which live in systems that do not grep: your CI provider's secret store, a running container's environment, a developer's laptop, a terminal scrollback, an error report.

Here is the reference count from one of our own repositories, a Next.js app with Stripe, Postgres and SES:

| Secret | CI config | App code | Config files | Total files |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | 1 | 1 | 4 | 6 |
| `STRIPE_SECRET_KEY` | 0 | 2 | 3 | 5 |
| `AWS_SECRET_ACCESS_KEY` | 0 | 2 | 2 | 4 |

You can produce the same table in a few seconds:

```bash
# Distinct secret names your CI knows about
grep -rhoE "secrets\.[A-Z_][A-Z0-9_]*" .github/workflows | sort -u

# Distinct environment variables the code expects
grep -rhoE "process\.env\.[A-Z_][A-Z0-9_]*" src/ | sort -u | wc -l

# Every file that mentions one specific secret
grep -rl "DATABASE_URL" --include="*.ts" --include="*.yml" \
  --include="*.yaml" --include="Dockerfile*" . | grep -v node_modules
```

That app has 48 distinct environment variables across the codebase and 10 secrets configured in CI. Those are small numbers for a small product, and the point is not that they are alarming. The point is that **six files is the number `grep` can see, and it is not the number that matters.**

## Where the copies actually get made

Follow one database password from a laptop to a running pod.

```diagram
{
  "type": "flow",
  "title": "Every hop is a chance to make a copy",
  "nodes": [
    { "label": "Developer laptop", "sub": ".env, shell history, editor cache", "icon": "cpu" },
    { "label": "Git", "sub": "one bad commit and it is permanent", "icon": "branch" },
    { "label": "CI secret store", "sub": "readable by every workflow in the repo", "icon": "gear" },
    { "label": "Build artefact", "sub": "baked into an image layer if you use ARG", "icon": "box" },
    { "label": "Orchestrator", "sub": "a Kubernetes Secret is base64, not encrypted", "icon": "k8s" },
    { "label": "Running process", "sub": "environment, crash dumps, error reports", "icon": "server" }
  ]
}
```

Four of those six are worth being specific about, because each one fails differently.

**Git.** Deleting the file in a later commit does nothing. The blob is still reachable, and if it was ever pushed, assume it was cloned. Rewriting history with `git filter-repo` does not help either, because the fork, the CI cache and somebody's laptop still have the old objects. A secret that reaches a remote is burnt. Rotate it and move on.

**The CI secret store.** These are write-only and masked in logs, which is good. But masking is a string replacement on output, not a boundary. Any workflow that can read the secret can also transform it, and a transformed secret does not match the mask:

```yaml
# This defeats log masking. Not a hypothetical: it is how
# a malicious dependency in a build step exfiltrates.
- run: echo "${{ secrets.API_KEY }}" | base64
```

The lesson is scope. A secret available to every workflow in the repo is available to every dependency those workflows install.

**Docker build arguments.** `ARG` values are recorded in image metadata. Anyone who can pull the image can read them:

```bash
docker history --no-trunc myimage:latest | grep -i secret
```

Use BuildKit secret mounts instead, which never enter a layer:

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npmtoken \
    NPM_TOKEN=$(cat /run/secrets/npmtoken) npm ci
```

**Kubernetes Secrets.** The name oversells it. The value is base64, and base64 is an encoding, not a cipher:

```bash
$ kubectl get secret db-creds -o jsonpath='{.data.password}'
c3VwZXJzZWNyZXQtdmFsdWUK

$ echo 'c3VwZXJzZWNyZXQtdmFsdWUK' | base64 -d
supersecret-value
```

Encryption at rest in etcd is off unless you configure an `EncryptionConfiguration`. Until then, anyone with read access to the Secret, or to an etcd backup, has the value.

:::warning
Check whether your cluster encrypts Secrets at rest before you assume it does. On a managed cluster this varies by provider and by how the cluster was created. An etcd snapshot in object storage is a plain-text copy of every secret you have.
:::

## What a leak actually costs

The expensive part of a leak is not the leak. It is the hour after it, when everyone wants to understand what happened before touching anything.

Invert that. **Revoke first, investigate second.** A revoked credential turns an incident into an outage, and an outage is a much better problem: it is visible, bounded and fixable in minutes. An un-revoked credential is an open door for as long as your investigation takes.

The order that works:

1. **Revoke or disable the credential.** Not rotate, revoke. Rotation implies a working replacement, and getting one takes time you do not have.
2. **Confirm it is dead.** Try to use it. An AWS key that still returns a caller identity has not been revoked.
3. **Then** work out the exposure window and what was reachable with it.
4. Issue the replacement and deploy.
5. Only now, work out how it escaped.

Step 2 catches a common mistake. Deleting an IAM user's access key is immediate; removing a key from your secret store is not, because everything already running still holds the old value in memory.

```bash
# Prove the old key is dead, do not assume it
AWS_ACCESS_KEY_ID=OLD AWS_SECRET_ACCESS_KEY=OLD \
  aws sts get-caller-identity
# Expect: InvalidClientTokenId
```

The exposure window is where your copy count comes back. If the credential was in six places, you have six timelines to reason about and six systems that might still be using it.

## Why rotation is expensive, and how to make it cheap

Rotation is avoided because it has two properties nobody wants: it is manual, and it can take production down. Every place holding the old value has to pick up the new one, and if one is missed, it fails at an unpredictable time.

The usual answer is to automate rotation. That helps, but it is treating the symptom. The real fix is to make the credential short-lived, because then rotation is not an event at all. It is just what the system does.

Three rungs, in the order that is worth climbing:

**Rung one: stop making new copies.** Cheap and immediate. Add secret scanning to pre-commit and CI so a credential cannot reach git in the first place. This does not fix anything existing, but it stops the count growing while you work on the rest.

```bash
# Fails the build on a detected secret, and scans history too
gitleaks detect --source . --redact --exit-code 1
```

**Rung two: replace static credentials with identity.** Most cloud credentials do not need to exist. If your CI can assume a role via OIDC, there is no key to leak, rotate or inventory:

```yaml
permissions:
  id-token: write   # lets the runner request an OIDC token
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::111122223333:role/ci-deploy
      aws-region: eu-west-1
```

That removes `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from your CI store entirely. Every cloud has an equivalent, and it is the single highest-value change on this list, because those two keys are the most damaging thing in most CI configurations.

**Rung three: make what remains expire on its own.** Some credentials genuinely have to exist, such as a database password. Issue them dynamically with a short lease, so a leaked value is worthless in an hour:

```bash
$ vault read database/creds/app-readonly
Key                Value
---                -----
lease_id           database/creds/app-readonly/9zK2...
lease_duration     1h
username           v-approle-app-readonly-x7Fq2mN
password           A1a-8sKd0PqWmZx3
```

Note what this changes about the copy count. A credential valid for an hour cannot accumulate copies, because the copies stop working. The inventory problem solves itself.

## Why .env files refuse to die

Every secrets product has spent a decade trying to kill the `.env` file, and it is still there. Worth being honest about why, because a replacement that ignores this will lose too.

`.env` works offline. It needs no login, no network, no token refresh, no VPN. It works on a plane, in a hotel with captive-portal wifi, and at 3am when the identity provider is the thing that is broken. It is one file you can read, edit and delete with tools you already have.

Every centralised alternative trades that away. Now starting your app locally needs an authenticated session with a service that can be down. That is a real cost, and teams route around it by exporting the secrets to a `.env` file once and forgetting about it, which puts you back where you started with an extra subscription.

The tools that win on developer machines are the ones that keep the ergonomics:

```bash
# The secret never lands on disk; it exists for the life of the process
doppler run -- npm run dev
infisical run -- npm run dev
op run --env-file=.env.template -- npm run dev
```

That shape works because it does not ask anyone to change how they start the app. If your rollout plan involves telling developers to do something more annoying than what they do now, plan for it to fail.

:::tip
Whatever you adopt, put `.env` in `.gitignore` and commit a `.env.example` with the keys and no values. It documents what the app needs, and it gives a new developer something to fill in without asking anyone.
:::

## Do these first

In order, because the order matters more than the tool:

1. **Count.** Pick your most sensitive credential and list every place it exists. Not references, copies. If you cannot finish the list, that is the finding.
2. **Scan history.** `gitleaks detect` over the full history. Anything it finds is already leaked and needs rotating, not deleting.
3. **Kill the static cloud keys.** Move CI to OIDC. This is the biggest single reduction in blast radius available to most teams.
4. **Check whether etcd encrypts Secrets** if you run Kubernetes, and check whether your backups are plain text.
5. **Write down the revoke procedure** for your top five credentials, before you need it. One page, per credential, revoke first.
6. **Then** compare tools, with your copy count as the requirement rather than a feature list.

## Build versus buy

Doing this yourself is viable. Cloud-native secret stores are competent, and if you are on one cloud, its own manager plus OIDC covers most of what matters. What you give up is the cross-environment story: developer laptops, CI, and several clouds behaving the same way.

That gap is what the vendors sell. [Infisical](https://infisical.com) and [Doppler](https://www.doppler.com) both centre on the `run --` shape above, which is the ergonomics problem rather than the storage problem. [1Password](https://1password.com/developers) comes at it from the human side, which fits teams already using it for passwords. [HashiCorp Vault](https://www.vaultproject.io) is the heavyweight, and dynamic credentials are its genuinely differentiating feature, at the cost of an operational burden that is real. We have written separately about [running Vault properly](/posts/hashicorp-vault-secrets-management-best-practices), and there is a [broader comparison of the managed options](/posts/secrets-management-guide).

The honest decision rule: if your answer to "how many copies" was small and you are on one cloud, you probably need OIDC and a scanner rather than a product. If the answer was large, or you could not finish counting, the value on offer is the inventory and the consistency, not the encryption. Everything encrypts adequately.

## What this does not cover

- **Encryption keys and certificates**, which have a different lifecycle. Rotating a signing key means thinking about what was signed with the old one.
- **Secret zero.** Every scheme needs one credential to bootstrap the rest. Cloud instance identity is the usual answer, and it is worth knowing which one you rely on.
- **Anything about who should have access.** This is about where secrets physically are, which is a separate question from authorisation, and the easier one.

The number to take away is your own copy count. It predicts your rotation cost, it predicts your blast radius, and unlike most security metrics you can measure it this afternoon with `grep` and an honest hour.

For the surrounding practice, we have written about [hardening a CI/CD pipeline](/posts/cicd-pipeline-hardening-guide) and [pre-commit hooks that catch problems before they land](/posts/pre-commit-hooks-security-guide).
