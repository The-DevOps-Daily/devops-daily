---
title: 'Environment Variables, Secrets and OIDC'
description: 'Keep configuration in GitHub Actions variables and credentials in secrets, see how masking works, and replace long-lived cloud keys with OIDC tokens.'
order: 5
---

A workflow needs two kinds of settings that do not belong in its YAML: configuration that differs between repositories or environments, such as a site title or an API URL, and credentials, such as an API token. GitHub Actions keeps the first in **variables** and the second in **secrets**. For cloud providers there is a better option than storing any credential at all: **OIDC** lets a job prove who it is and get short-lived cloud credentials for that one job.

In this part you set a variable and a secret with the GitHub CLI, see how GitHub masks secrets in logs, use the variable in the build, and look inside a real OIDC token.

## Prerequisites

- The repository from [Part 4](/guides/introduction-to-cicd/04-working-with-artifacts-and-dependencies).
- Admin access to it, to change its settings.

## Where Settings Live

| Kind                    | Where you set it                        | In the workflow                                        | Good for                                    |
| ----------------------- | --------------------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| `env:` in the YAML      | The workflow file                       | `$NAME` or `${{ env.NAME }}`                           | Values that are the same everywhere         |
| Configuration variables | Repository, environment or organization | `${{ vars.NAME }}`                                     | Non-secret settings: titles, URLs, regions  |
| Secrets                 | Repository, environment or organization | `${{ secrets.NAME }}`                                  | Tokens, passwords, keys (up to 48 KB each)  |
| `GITHUB_TOKEN`          | Created automatically for every job     | `${{ secrets.GITHUB_TOKEN }}` or `${{ github.token }}` | Calls to the GitHub API for this repository |
| OIDC token              | Requested by the job                    | The cloud provider's login action                      | Short-lived cloud credentials               |

`env:` can be set for the whole workflow, a job or a step; the narrowest one wins. A step can also set variables for the steps after it by appending `NAME=value` lines to the file in `$GITHUB_ENV`, and add directories to the `PATH` through `$GITHUB_PATH`.

Values set at more than one level follow the same idea: an environment's variable or secret overrides the repository's, which overrides the organization's.

## Set a Variable and a Secret

The build script reads the page title from `SITE_TITLE`. Store it as a repository variable, and create a secret for the demonstration. Piping the value in keeps it out of your shell history:

```terminal
{
  "title": "variables and secrets",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh variable set SITE_TITLE --body \"DevOps Command Cheatsheet\"",
      "output": "✓ Created variable SITE_TITLE for The-DevOps-Daily/guide-cicd-demo-2026-10-24"
    },
    {
      "comment": "a random 32-character value; in real life, the token you were given",
      "cmd": "openssl rand -hex 16 | gh secret set DEMO_API_TOKEN",
      "output": "✓ Set Actions secret DEMO_API_TOKEN for The-DevOps-Daily/guide-cicd-demo-2026-10-24"
    },
    {
      "comment": "secrets can be listed but never read back",
      "cmd": "gh variable list; gh secret list",
      "output": "NAME        VALUE                      UPDATED\nSITE_TITLE  DevOps Command Cheatsheet  less than a minute ago\nNAME            UPDATED\nDEMO_API_TOKEN  less than a minute ago"
    }
  ]
}
```

The same settings are in **Settings > Secrets and variables > Actions**. GitHub encrypts secrets before storing them, and nobody can read a secret back, not even an admin; you can only replace it.

## Use Them in a Workflow

This manual workflow uses both, and tries to print the secret:

```yaml
name: Config and secrets

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  show-config:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    env:
      SITE_TITLE: ${{ vars.SITE_TITLE }}
    steps:
      - name: Use a variable and a secret
        env:
          API_TOKEN: ${{ secrets.DEMO_API_TOKEN }}
        run: |
          if [ -z "$API_TOKEN" ]; then
            echo "::error::The DEMO_API_TOKEN secret is not set"
            exit 1
          fi
          echo "Site title: $SITE_TITLE"
          echo "Token length: ${#API_TOKEN}"
          echo "Printing the token anyway: $API_TOKEN"

      - name: Mask a value you create
        run: |
          session_id="session-$RANDOM$RANDOM"
          echo "::add-mask::$session_id"
          echo "Session: $session_id"

  oidc:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      id-token: write
    steps:
      - name: Request an OIDC token and show its claims
        run: |
          token=$(curl -sSf -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
            "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=sts.amazonaws.com" | jq -r .value)
          echo "::add-mask::$token"
          jq -R 'split(".")[1] | gsub("-";"+") | gsub("_";"/") | @base64d | fromjson
            | {iss, aud, sub, repository, ref, event_name, runner_environment}' <<< "$token"
```

Run it with `gh workflow run config.yml`. The first job's output:

```terminal
{
  "title": "masking",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view 40064104730 --log | grep -E 'Z (Site title|Token length|Printing the token anyway|Session):' | cut -f3-",
      "output": "2026-10-24T04:53:19.5063920Z Site title: DevOps Command Cheatsheet\n2026-10-24T04:53:19.5064811Z Token length: 32\n2026-10-24T04:53:19.5065611Z Printing the token anyway: ***\n2026-10-24T04:53:19.5413358Z Session: ***"
    }
  ]
}
```

GitHub replaced the secret with `***` everywhere in the log, including the `env:` listing at the start of the step. The value created in the step was masked too, because the step registered it with `::add-mask::` before printing it. A secret that is missing is an empty string, not an error, which is why the step checks for it first.

Masking has limits. It replaces the exact string, so a value you transform (base64-encode, reverse, cut in half) is printed in clear. GitHub cannot mask what it does not know is secret, such as a token you read from a file, unless you add a mask. And masking only covers logs and job summaries: a secret written to an artifact or a cache is stored as it is.

Now use the variable for real. In the `build` job of `ci.yml`, pass it to the build step:

```yaml
- run: npm run build
  env:
    SITE_TITLE: ${{ vars.SITE_TITLE }}
```

If the variable does not exist, `vars.SITE_TITLE` is empty and the build falls back to its default title.

## Who Gets the Secrets

- **Pull requests from forks** get no secrets (except `GITHUB_TOKEN`, which is read-only). Otherwise anyone could open a pull request that prints them. Plan for it: steps that need a secret should be skipped or use test values in fork pull requests.
- **Dependabot pull requests** get Dependabot secrets, a separate list under the same settings page, not your Actions secrets.
- **Environment secrets** are released only to jobs that run in that environment, and only after its protection rules pass, such as an approval. Part 6 uses this for deployments.
- **Organization secrets** can be limited to selected repositories.

Prefer the automatic `GITHUB_TOKEN` over a personal access token. It expires when the job ends, it can only access this repository, and the `permissions:` block limits it further. Part 9 covers it.

## OIDC Instead of Cloud Keys

The classic way to deploy to a cloud is to create an access key, store it as a secret and hope it never leaks. It lives until someone rotates it, and anyone who gets it can use it from anywhere.

With **OpenID Connect (OIDC)**, the job asks GitHub for a signed token that says which repository, branch, workflow and environment it is running for. The cloud provider checks the signature and the claims against a trust policy you created once, and returns credentials that expire after about an hour. No long-lived key exists.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Job", "sub": "id-token: write", "icon": "server", "tone": "blue" },
    { "label": "GitHub OIDC", "sub": "signed JWT", "icon": "shield", "tone": "violet" },
    { "label": "Cloud STS", "sub": "checks sub and aud", "icon": "cloud", "tone": "amber" },
    { "label": "Credentials", "sub": "expire in 1 hour", "icon": "lock", "tone": "green" }
  ]
}
```

The `oidc` job above requests a token with `permissions: id-token: write` and prints a few of its claims. It masks the token itself and never prints it:

```terminal
{
  "title": "OIDC claims",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view --job 120783604663 --log | grep 'show its claims' | cut -f3- | tail -n 9",
      "output": "2026-10-24T04:53:22.0360194Z {\n2026-10-24T04:53:22.0361039Z   \"iss\": \"https://token.actions.githubusercontent.com\",\n2026-10-24T04:53:22.0362172Z   \"aud\": \"sts.amazonaws.com\",\n2026-10-24T04:53:22.0363353Z   \"sub\": \"repo:The-DevOps-Daily@212527617/guide-cicd-demo-2026-10-24@1431822257:ref:refs/heads/main\",\n2026-10-24T04:53:22.0364981Z   \"repository\": \"The-DevOps-Daily/guide-cicd-demo-2026-10-24\",\n2026-10-24T04:53:22.0365971Z   \"ref\": \"refs/heads/main\",\n2026-10-24T04:53:22.0366451Z   \"event_name\": \"workflow_dispatch\",\n2026-10-24T04:53:22.0366968Z   \"runner_environment\": \"github-hosted\"\n2026-10-24T04:53:22.0367451Z }"
    }
  ]
}
```

The **`sub`** (subject) claim is what trust policies match on. Notice its format: `repo:The-DevOps-Daily@212527617/guide-cicd-demo-2026-10-24@1431822257:ref:refs/heads/main`. Since [15 July 2026](https://github.blog/changelog/2026-04-23-immutable-subject-claims-for-github-actions-oidc-tokens/), repositories created or renamed after that date get the owner and repository IDs after an `@`. The IDs never change, so if someone later creates an organization or repository with the same name, their tokens do not match your trust policy. Older repositories keep `repo:owner/name:...` unless you opt in. When a job uses an environment, the subject ends in `:environment:<name>` instead of the ref, which lets you limit cloud access to jobs that passed that environment's approval.

The login actions of the big clouds do the token exchange for you. These steps were checked with actionlint, not run against a cloud account; the role, identity and project names are placeholders:

```tabs
{
  "title": "OIDC login per cloud",
  "tabs": [
    {
      "label": "AWS",
      "lang": "yaml",
      "code": "name: Deploy to AWS\n\non:\n  push:\n    branches: [main]\n\npermissions:\n  contents: read\n  id-token: write\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment: production\n    steps:\n      - uses: aws-actions/configure-aws-credentials@v6\n        with:\n          role-to-assume: arn:aws:iam::123456789012:role/cheatsheet-deploy\n          aws-region: eu-west-1\n      - run: aws sts get-caller-identity"
    },
    {
      "label": "Azure",
      "lang": "yaml",
      "code": "name: Deploy to Azure\n\non:\n  push:\n    branches: [main]\n\npermissions:\n  contents: read\n  id-token: write\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment: production\n    steps:\n      - uses: azure/login@v3\n        with:\n          client-id: ${{ vars.AZURE_CLIENT_ID }}\n          tenant-id: ${{ vars.AZURE_TENANT_ID }}\n          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}\n      - run: az account show --query name --output tsv"
    },
    {
      "label": "Google Cloud",
      "lang": "yaml",
      "code": "name: Deploy to Google Cloud\n\non:\n  push:\n    branches: [main]\n\npermissions:\n  contents: read\n  id-token: write\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment: production\n    steps:\n      - uses: google-github-actions/auth@v3\n        with:\n          workload_identity_provider: projects/123456789/locations/global/workloadIdentityPools/github/providers/cheatsheet\n          service_account: deployer@my-project.iam.gserviceaccount.com\n      - uses: google-github-actions/setup-gcloud@v3\n      - run: gcloud auth list"
    }
  ]
}
```

The IDs in the Azure example are not secret, so they are variables. On the cloud side, you trust the issuer `https://token.actions.githubusercontent.com` once, then allow a role (AWS), a federated credential (Azure) or a workload identity pool provider (Google Cloud) to be used by tokens with a specific `sub` and `aud`. For AWS, the condition of the role's trust policy for jobs in the `production` environment of the companion repository would be:

```json
{
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
    "token.actions.githubusercontent.com:sub": "repo:The-DevOps-Daily@212527617/guide-cicd-demo-2026-10-24@1431822257:environment:production"
  }
}
```

Match the full subject. A wildcard such as `repo:my-org/*` lets every repository in the organization, and every branch and pull request in it, assume the role.

## Common Mistakes

- **Secrets in the workflow file.** Anything in the repository is visible to everyone with read access, and stays in the Git history after you delete it. If it happens, rotate the secret.
- **Printing transformed secrets.** Masking only catches the exact value.
- **Secrets in artifacts or caches.** Masking does not apply there.
- **One set of credentials for every environment.** Use environment secrets, so a staging job cannot read production credentials.
- **Long-lived cloud keys.** Use OIDC wherever the provider supports it, and match the full `sub` claim.
- **Expecting secrets in fork pull requests.** They are empty there by design.

## Summary

- `env:` holds fixed values, configuration variables (`vars`) hold settings, secrets (`secrets`) hold credentials.
- GitHub masks known secret values in logs and job summaries; register other sensitive values with `::add-mask::`, and keep secrets out of artifacts and caches.
- Fork pull requests get no secrets; environment secrets are released only after the environment's rules pass.
- OIDC replaces stored cloud keys with credentials that expire after about an hour; new repositories have an immutable `sub` claim with IDs.

In [Part 6](/guides/introduction-to-cicd/06-deployment-strategies-and-environments) you deploy the site to GitHub Pages through a protected environment that needs an approval.

## Keep Learning

- [Secrets Management Guide: Vault, AWS Secrets Manager, and Azure Key Vault](/posts/secrets-management-guide)
- [You Cannot Rotate a Secret You Cannot Find](/posts/you-cannot-rotate-a-secret-you-cannot-find)
- [Secrets Management Best Practices with HashiCorp Vault](/posts/hashicorp-vault-secrets-management-best-practices)
