---
title: 'We Built a Terraform Provider for Inngest: What the Real API Taught Us'
excerpt: 'A community Terraform provider for Inngest environments and webhooks, now on the Terraform Registry. How to use it, the three things the real Inngest API showed us that the OpenAPI spec did not, and the two limits the spec already set.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2026-11-25'
publishedAt: '2026-11-25T07:07:00Z'
updatedAt: '2026-11-25T07:07:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Terraform
  - Infrastructure as Code
  - Inngest
  - Webhooks
  - Go
  - Open Source
---

If you run [Inngest](https://www.inngest.com), you probably set up your environments and webhooks by hand in the dashboard. That works until you have a staging environment per team, a Stripe webhook in three places, and nobody remembers which transform is the real one. We wanted that setup in code, reviewed in pull requests, so we built a Terraform provider for it.

It is called `The-DevOps-Daily/inngest`, version 0.1.0 is on the [Terraform Registry](https://registry.terraform.io/providers/The-DevOps-Daily/inngest/latest), and the source is on GitHub at [The-DevOps-Daily/terraform-provider-inngest](https://github.com/The-DevOps-Daily/terraform-provider-inngest). It is a community provider. It is not affiliated with or endorsed by Inngest, Inc.

This post shows how to use it, and then the more interesting part: what changed when we pointed it at the real API. Inngest publishes OpenAPI specs for its REST API, and we built the first version from those specs. The spec already showed two hard limits: environments cannot be deleted, and keys cannot be created or rotated. The first run against a real account then found three more things the spec did not tell us. None of them are bugs in Inngest. They are the edges that any tool managing an API's resources has to handle, and all five shaped the design.

## TLDR

- The provider manages **custom environments** (create, archive, unarchive) and **webhooks** (create with a transform, event filter and response, rename, change the transform, delete). Seven data sources read environments, apps, webhooks and keys.
- Install it from the Registry with `source = "The-DevOps-Daily/inngest"` and `version = "~> 0.1"`. It reads `INNGEST_API_KEY`.
- What the real API taught us: new environments and production both come back without a `type`, API keys cannot read event or signing keys, and webhook lists need the `X-Inngest-Env` header. Two limits came from the spec itself: environments cannot be deleted (so destroy archives), and keys cannot be created or rotated through the API.
- Webhook updates and deletes go through the v1 API, which takes the environment's **signing key**, not an API key. You copy that key from the dashboard once and give it to the provider.
- Tests: unit tests and real `terraform` runs against a fake API on pushes to main and on pull requests, a real-API acceptance suite that passes in `production` and runs weekly (never on pull requests), `govulncheck`, and GPG-signed releases.

## Prerequisites

- Terraform 1.5 or newer (the examples set `required_version = ">= 1.5"`)
- An Inngest account. Environment and webhook management fit the free plan.
- An Inngest API key from [app.inngest.com/settings/api-keys](https://app.inngest.com/settings/api-keys)
- For webhook updates and deletes: the environment's signing key from the Inngest dashboard
- Basic Terraform knowledge. If you are new to it, start with the [Introduction to Terraform guide](/guides/introduction-to-terraform).

```github
https://github.com/The-DevOps-Daily/terraform-provider-inngest
```

## Why manage Inngest with Terraform

Inngest separates work into **environments**. Production is one. [Custom environments](https://www.inngest.com/docs-markdown/platform-and-operations/environments-and-branch-deploys) are for shared stages such as staging, QA or canary, and each one has its own keys, event history and functions. **Branch deploys** give each preview deployment its own isolated environment.

Once you have more than one or two of these, the dashboard stops being a good record of what exists and why. Terraform gives you three things here:

- **Environments per team or stage, created in a pull request.** A new team gets a `staging-payments` environment by adding one resource block. The PR is the record of who asked for it and when.
- **Webhooks in code.** An Inngest webhook is a URL plus a JavaScript transform that turns the provider's payload into an Inngest event. That transform is code, and code belongs in version control, next to the function that consumes the event.
- **Review before change.** `terraform plan` shows that a pull request renames a webhook in place, or that it replaces one and gives it a new URL, before anyone applies it. That second case matters, because a new URL means updating Stripe, GitHub or whoever sends the webhook.

The same reasoning applies to any SaaS with an API. We covered the general case in [how to build a Terraform provider with the Plugin Framework](/posts/build-a-terraform-provider-plugin-framework). This post is about one provider for an API we do not own, and what that taught us.

## Quick start

### The provider block

Put this in `main.tf`, export `INNGEST_API_KEY`, and run `terraform init` to download the provider from the Registry:

```hcl
terraform {
  required_providers {
    inngest = {
      source  = "The-DevOps-Daily/inngest"
      version = "~> 0.1"
    }
  }
}

# Reads INNGEST_API_KEY from the environment.
provider "inngest" {
  # Default environment for every resource and data source,
  # sent as the X-Inngest-Env header. Each block can override it.
  environment = "production"
}
```

The provider takes four settings, each with an environment variable:

| Argument      | Environment variable   | Default                   |
| ------------- | ---------------------- | ------------------------- |
| `api_key`     | `INNGEST_API_KEY`      | none (sensitive)          |
| `base_url`    | `INNGEST_API_BASE_URL` | `https://api.inngest.com` |
| `environment` | `INNGEST_ENV`          | `production`              |
| `signing_key` | `INNGEST_SIGNING_KEY`  | none (sensitive)          |

Keep both keys in environment variables or a secrets manager, not in `.tf` files.

### An environment

```hcl
resource "inngest_environment" "staging" {
  name = "staging"
}

# An environment kept for its history, with its functions switched off.
resource "inngest_environment" "legacy" {
  name     = "legacy-qa"
  archived = true
}
```

`archived` is optional. When you leave it out, Terraform does not manage the flag at all. That is on purpose: branch deploys [archive themselves](https://www.inngest.com/docs-markdown/platform-and-operations/environments-and-branch-deploys) three days after their latest deployment, and a managed flag would show that as drift on every plan.

### A webhook with a transform

```hcl
resource "inngest_webhook" "stripe" {
  # The environment name is sent as the X-Inngest-Env header.
  environment = inngest_environment.staging.name
  name        = "Stripe"

  # $${...} escapes HCL interpolation, so Inngest receives ${evt.type}.
  transform = <<-EOT
    function transform(evt, headers = {}, queryParams = {}, raw = "") {
      return {
        id: evt.id,
        name: `stripe/$${evt.type}`,
        data: {
          event: evt,
          // Pass these through so the function can verify the signature.
          raw: raw,
          sig: headers["Stripe-Signature"],
        },
      };
    }
  EOT

  event_filter = {
    filter = "ALLOW"
    events = ["stripe/checkout.session.completed", "stripe/invoice.*"]
  }
}

output "stripe_webhook_url" {
  description = "Endpoint URL to give to Stripe."
  value       = inngest_webhook.stripe.url
  sensitive   = true
}
```

Three details in that block are easy to miss:

1. JavaScript template literals use `${...}`, and so does HCL. Write `$${evt.type}` in the heredoc, or Terraform tries to interpolate `evt.type` itself and fails.
2. Setting `id: evt.id` passes Stripe's event ID through as the Inngest event ID, so Inngest drops duplicate deliveries. That comes from the [Inngest webhook guide](https://www.inngest.com/docs-markdown/durable-execution/guides-and-advanced/events-and-triggers/receive-webhook-events).
3. The same guide notes that Inngest does not verify the provider's webhook signature. The transform's fourth argument is the raw request body, and the guide's Stripe example passes it through with the `Stripe-Signature` header, as above. Your function verifies the signature with them before it does anything else. Our post on [reliable webhook delivery](/posts/reliable-webhook-delivery-retries-signatures-idempotency) covers why.

To check the example without an account, we built the provider from the repository (Go 1.27.4, Terraform 1.17.2) and planned the repo's `examples/complete` with **no API key set**. That works because the example only declares new resources: there is nothing to refresh and no data source to read, so the provider must not call the API until `apply`. CI runs the same plan on pull requests and pushes to main. `examples/complete` is the webhook above with the plain `data: evt` transform from the Inngest guide.

```terminal
{
  "title": "examples/complete, no API key",
  "prompt": "$",
  "steps": [
    { "comment": "provider built from the repo, installed with a dev_overrides CLI config" },
    { "cmd": "terraform validate -no-color", "output": "Warning: Provider development overrides are in effect\n...\nSuccess! The configuration is valid, but there were some validation warnings\nas shown above." },
    { "cmd": "terraform plan -input=false -no-color", "output": "  # inngest_environment.this will be created\n  + resource \"inngest_environment\" \"this\" {\n      + archived   = (known after apply)\n      + created_at = (known after apply)\n      + id         = (known after apply)\n      + name       = \"staging\"\n      + type       = (known after apply)\n    }\n\n  # inngest_webhook.stripe will be created\n  + resource \"inngest_webhook\" \"stripe\" {\n      + environment  = \"staging\"\n      + name         = \"Stripe\"\n      + url          = (sensitive value)\n      ...\n    }\n\nPlan: 2 to add, 0 to change, 0 to destroy." }
  ]
}
```

The warning appears because this build is installed with a development override instead of `terraform init`. Both outputs are trimmed to the lines that matter.

After `terraform apply`, get the URL with `terraform output -raw stripe_webhook_url` and paste it into Stripe.

### Data sources

Data sources read what already exists, including things made in the dashboard. Two useful ones:

```hcl
# Every active branch deploy, for example to find stale previews.
data "inngest_environments" "branches" {
  type = "BRANCH"
}

output "branch_environments" {
  value = [for e in data.inngest_environments.branches.environments : e.name]
}

# Warn on every plan when the billing app's latest sync failed.
data "inngest_app" "billing" {
  environment = "production"
  id          = "billing"
}

check "billing_app_synced" {
  assert {
    condition     = try(data.inngest_app.billing.latest_sync.status, "") != "error"
    error_message = "The billing app's latest Inngest sync failed: ${try(coalesce(data.inngest_app.billing.latest_sync.error, "no details"), "no details")}"
  }
}
```

The `check` block turns a data source into a guard: every plan warns you if the app's last sync failed. There are also `inngest_environment`, `inngest_apps`, `inngest_webhooks`, `inngest_event_keys` and `inngest_signing_keys`. The two key data sources have a catch, which is lesson 2 below.

### Import

You do not have to start from zero. Instead of creating new resources, you can import the ones you made in the dashboard. Write a resource block that matches what exists, then import it into that address:

```hcl
# A branch deploy created by a preview deployment.
resource "inngest_environment" "preview" {
  name = "feature/new-checkout"
}

# A webhook that already exists in production.
resource "inngest_webhook" "stripe_prod" {
  environment = "production"
  name        = "Stripe"
  transform   = "..." # copy the current transform from the dashboard
}
```

```bash
# Environments import by ID or exact name, branch deploys included.
terraform import inngest_environment.preview feature/new-checkout

# Webhooks import as <environment>/<webhook id>. Branch names can contain
# slashes, so the ID is the part after the last one.
terraform import inngest_webhook.stripe_prod production/5e627760-ce58-4068-861e-bcfe5161382e
```

Run `terraform plan` after each import. The `environment` in the block must match the one in the import ID, because a different environment plans a replacement. Copy the real transform, event filter and response, or the plan shows changes you did not mean to make.

Importing a branch deploy lets you archive or unarchive it from Terraform. The API cannot create branch deploys; your preview deployments do that.

## How the provider talks to Inngest

Inngest has two REST APIs, and the provider uses both. Each one takes a different credential:

```diagram
{
  "type": "graph",
  "title": "Which API the provider calls, and with which credential",
  "columns": [
    [
      { "id": "tf", "label": "terraform", "sub": "plan, apply, import", "icon": "gear", "tone": "slate" },
      { "id": "dash", "label": "Inngest dashboard", "sub": "where keys live", "icon": "lock", "tone": "amber", "detail": "Event and signing keys are managed here. The API cannot create or rotate them, and an API key cannot read them." }
    ],
    [
      { "id": "prov", "label": "terraform-provider-inngest", "sub": "Plugin Framework, Go", "icon": "box", "tone": "blue", "detail": "Sends X-Inngest-Env on every environment-scoped call, defaulting to production. Retries 429s with backoff, honouring Retry-After." }
    ],
    [
      { "id": "v2", "label": "REST API v2", "sub": "envs, webhooks (create, list), apps, keys", "icon": "server", "tone": "green", "detail": "Bearer API key. Environment chosen by the X-Inngest-Env header. No update or delete for webhooks, no delete for environments." },
      { "id": "v1", "label": "REST API v1", "sub": "webhooks (update, delete)", "icon": "server", "tone": "violet", "detail": "Bearer signing key of the environment. The provider tries the key as given, then in the hashed form the Inngest SDKs send." }
    ],
    [
      { "id": "env", "label": "Inngest environment", "sub": "production, staging, branches", "icon": "cloud", "tone": "slate" }
    ]
  ],
  "edges": [
    ["tf", "prov", "gRPC"],
    ["dash", "prov", "signing key you copy"],
    ["prov", "v2", "API key + X-Inngest-Env"],
    ["prov", "v1", "signing key"],
    ["v2", "env"],
    ["v1", "env"]
  ]
}
```

The v2 API does almost everything: environments, webhook creation and listing, apps, and key listing. It takes an API key as a Bearer token and picks the environment from the `X-Inngest-Env` header. What v2 does not have, in the spec we built from, is a webhook update or delete. The v1 API has both (`PUT` and `DELETE /v1/webhooks/{id}`), and the v1 spec names its auth scheme "The signing key from your environment". So a rename, a transform change or a `terraform destroy` on a webhook needs a different credential from everything else.

You can check this in the published spec (`make spec` downloads it). In the v2 spec, `/envs/{id}` has only `PATCH`, `/env/webhooks` has only `GET` and `POST`, and both key endpoints have only `GET`.

## What the real API taught us

The first version was built from the published specs and the open-source v2 service definition, with a fake API for tests. Then we ran it against a real account on 2026-11-20. The findings are in [GAPS.md](https://github.com/The-DevOps-Daily/terraform-provider-inngest/blob/main/GAPS.md), and the fixes are in the commit "Fix issues found against the real Inngest API". Lessons 1 to 3 are what that run found. Lessons 4 and 5 were in the spec from the start, and the run confirmed the archive call works.

### 1. A missing `type` does not mean production

The v2 spec defines the environment type as an enum of `PRODUCTION`, `TEST` and `BRANCH`, with `"default": "PRODUCTION"`. The service speaks protobuf JSON, which leaves an enum's zero value out of the response. So when a response had no `type`, the first version filled in `PRODUCTION`. That is a reasonable reading of the spec, and the commit that added it says why:

```go
// setDefaults fills in the type when the API leaves it out. The service
// speaks protobuf JSON, which omits an enum's zero value, and the zero value
// of v2EnvType is PRODUCTION (the spec's default).
func (e *Env) setDefaults() {
	if e.Type == "" {
		e.Type = EnvTypeProduction
	}
}
```

The real API showed it was wrong in a way that matters. `POST /v2/envs` returns the new custom environment **without** a `type`. `GET /v2/envs` lists both custom environments and the account's real `production` environment without one. Only branch deploys report a type (`BRANCH`).

Now follow that through `terraform destroy`. The provider protects production: destroying it only removes it from state, with a warning, because archiving your production environment by accident would be very bad. With the old rule, every environment Terraform created looked like production. So `terraform destroy` would have left each one active and only forgotten about it. On the free plan, where only active environments count toward the limits, that leaks a slot on every test run.

The fix keeps a missing type as null and protects only what is clearly production:

```go
// IsProduction protects only an explicit production type or the account's
// production environment. Custom environments also omit type in real responses.
func (e *Env) IsProduction() bool {
	return e.Type == EnvTypeProduction || (e.Type == "" && strings.EqualFold(e.Name, "production"))
}
```

A regression test now feeds the exact real response shapes (a created `staging` with no type, a listed `production` with no type, a branch with `BRANCH`) and checks that only production is protected. The fake API returns the same shapes, so the other tests run against what the real API does, not what the spec example shows.

The lesson for anyone writing a provider: **when your own code infers a value the API did not send, check what destroy does with it.** A wrong default in a read path is a display bug. A wrong default in a delete path is a leak or an outage.

### 2. API keys cannot read event or signing keys

The first version handled the v1 credential problem neatly, on paper. Before a webhook update, it called `GET /v2/keys/signing` with the API key, got the environment's signing key, and used it for the v1 call. No extra setting for the user.

The real API answered `403 access_denied`: "API key does not allow this operation". The same for `GET /v2/keys/events`, even for an API key with access to all resources. We checked the dashboard's API key settings: the permissions it offers are Accounts, Apps, Environments, Events, Experiments, Feedback, Functions, Images, Insights, Runs, Sandboxes, Sessions and Webhooks. There is no keys permission, so no API key setting makes those endpoints work.

That is a sensible security choice by Inngest. A signing key lets you act as the environment, so a broad automation key should not hand it out. But it meant the provider needed a new input. In 0.1.0, the v1 webhook calls use, in this order:

1. `signing_key` on the `inngest_webhook` resource
2. `signing_key` on the provider
3. `INNGEST_SIGNING_KEY`
4. A lookup through `/v2/keys/signing`, only if no key was supplied, for a credential that does have key access

When the lookup gets a 403, the error tells you what to do instead of showing a bare status code:

```text
inngest API keys cannot read signing keys. Set signing_key on the provider or the webhook (or INNGEST_SIGNING_KEY) to the environment's signing key from the Inngest dashboard
```

The provider tries a supplied key as given, then in the hashed form the Inngest SDKs send (the prefix, then the SHA-256 of the decoded rest). In the real-API runs, the dashboard key worked as given. A wrong supplied key fails; it does not fall back to a lookup that cannot work.

Two practical notes:

- **Only updates and deletes need it.** Creating a webhook goes through v2 with the API key. But a delete can happen inside a normal `apply`: changing a webhook's `environment`, `event_filter` or `response` replaces it, and the old one is deleted through v1. Set the signing key in every run that may change a webhook, not just at `terraform destroy`.
- **Prefer the provider setting or the environment variable.** A `signing_key` set on the resource is stored in Terraform state, like any other attribute. See the [state management chapter](/guides/introduction-to-terraform/05-state-management) for why state needs the same care as a secret.

The `inngest_event_keys` and `inngest_signing_keys` data sources stay in the provider for credentials that have key access. With an ordinary API key they return the 403 as a clear diagnostic. The repo has a test for exactly that path, against both the fake and the real API.

### 3. Webhook lists need the `X-Inngest-Env` header

Most v2 calls act on one environment, which the request names in the `X-Inngest-Env` header. The first version always sent it for webhook resources. The data sources (webhook list, apps, keys) left it out when no environment was set, so the API could pick its default, production.

For `GET /v2/env/webhooks`, the real API returned **400** without the header when the API key has access to all environments, so the `inngest_webhooks` data source failed. The signing key endpoint could also return 404 `env_not_found` without it. The key cannot guess which environment you mean, which is fair.

The fix is simple and now has its own test: every environment-scoped call always sends the header, and an empty environment becomes `X-Inngest-Env: production`. Account-wide calls such as listing environments do not send it. A test walks every environment-scoped client method with an empty name, `staging` and `feature/x`, and fails if any request goes out with the wrong header.

This one matters beyond our provider. If you call the Inngest API from a script or CI job with an all-environments key, send the header every time.

### 4. There is no delete for environments, so destroy archives

The v2 spec has `GET` and `POST` on `/envs`, and only `PATCH` on `/envs/{id}`. The patch body has one field, `isArchived`. The real API confirmed `{"isArchived":true}` works and returns the environment with `isArchived:true`.

So `terraform destroy` on an `inngest_environment` archives it. Inngest's docs describe archiving as stopping functions from triggering without deleting their data, which is a safe meaning for "destroy". The resource docs say this up front, and if archiving fails, the error says it again.

It has consequences you should plan for:

- **There is no rename either.** Changing `name` replaces the resource. Terraform archives the old environment first, then creates the new one, so there is a gap between the two. Your apps then need the new environment's keys.
- **Names may stay taken.** Whether an archived name can be reused is not settled (it is listed as open in GAPS.md). If a create gets a 409 conflict, the provider's error suggests importing the existing, possibly archived, environment instead.
- **Archived environments may drop out of the list.** The provider tolerates an archived environment disappearing from `GET /v2/envs` when it is already archived in state, instead of planning it again.

### 5. Keys stay in the dashboard

The key endpoints are read-only in the spec, and with an API key they are not readable at all. There is no endpoint to create, rotate or delete event keys or signing keys, and none to manage API keys. So the provider does not pretend to manage them.

In practice this means one manual step per new environment. After `terraform apply` creates it, open the environment in the dashboard, copy its event key and signing key, and put them where your app and your Terraform runs read secrets: `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` for the app, and the signing key for the provider if you will manage that environment's webhooks.

That is less automated than we wanted, but a provider that works around a missing endpoint tends to break in surprising ways later.

## How we test it

The provider has four layers of tests, all in the repo.

**Unit tests against `httptest` servers.** These check request shapes, retries, pagination, redaction and every real-API regression from the section above. They need no credentials.

**Real Terraform runs against a fake API.** The `TestMock*` tests run real `terraform` plan, apply, import, refresh and destroy cycles against an in-process fake of the Inngest API. The fake is built from the published OpenAPI specs plus the 2026-11-20 observations. The default fake API key gets a 403 on the key endpoints, like a real one does. The tests cover create, in-place update, replacement, import, resources deleted outside Terraform, 429 retries, pagination and API errors. CI runs them on pull requests and pushes to main.

With the specs downloaded, the client tests also check that every endpoint the provider calls, every JSON field it reads and the enums it validates still exist in Inngest's published specs. CI downloads the specs before testing, so if Inngest removes or renames something the provider uses, our build fails. The check does not catch everything: a new endpoint, or a change to a field's type or to authentication, passes it. The specs are not committed: the v1 spec names its license as Inngest, Inc. and the v2 spec has none, so the files stay with Inngest.

We ran the whole suite on the same machine (4 vCPUs, Go 1.27.4, Terraform 1.17.2), with no Inngest credentials:

```terminal
{
  "title": "unit and fake-API tests, no key",
  "prompt": "$",
  "steps": [
    { "cmd": "sh scripts/fetch-spec.sh", "output": "Downloaded the specs to .../terraform-provider-inngest/testdata/spec" },
    { "cmd": "INNGEST_REQUIRE_SPEC=1 INNGEST_REQUIRE_TERRAFORM=1 go test ./... -count=1 -timeout 600s -v", "output": "--- PASS: TestEnvironmentTypeOmission (0.00s)\n--- PASS: TestEnvironmentScopedCallsAlwaysSendHeader (0.00s)\n--- PASS: TestOperationsExistInSpec (0.01s)\n--- PASS: TestFieldsExistInSpec (0.01s)\nok  \tgithub.com/The-DevOps-Daily/terraform-provider-inngest/internal/client\t0.141s\n--- SKIP: TestAccEnvironment (0.00s)\n--- SKIP: TestAccWebhook (0.00s)\n--- SKIP: TestAccDataSources (0.00s)\n--- SKIP: TestAccKeysDenied (0.00s)\n--- PASS: TestMockEnvironmentProductionNotArchived (0.86s)\n--- PASS: TestMockKeysForbidden (0.48s)\n--- PASS: TestMockWebhookConfiguredSigningKey (3.82s)\n--- PASS: TestMockWebhook (4.65s)\nok  \tgithub.com/The-DevOps-Daily/terraform-provider-inngest/internal/provider\t27.771s" },
    { "comment": "selected lines: 64 top-level tests pass (36 in client, 28 in provider, including all 16 TestMock* tests), and the 4 TestAcc tests skip without a key" }
  ]
}
```

The whole run, including compiling, took 1 minute 20 seconds of wall time. The provider package's 27.8 seconds is mostly Terraform starting up for each plan and apply.

**Weekly real-API acceptance tests.** The `TestAcc*` tests use a real Inngest account, random `tf-acc-` names, and clean up after themselves. The [Acceptance workflow](https://github.com/The-DevOps-Daily/terraform-provider-inngest/actions/workflows/acceptance.yml) runs them every Monday at 06:00 UTC and on manual dispatch (the [2026-11-20 manual run](https://github.com/The-DevOps-Daily/terraform-provider-inngest/actions/runs/44768827231) passed all four tests in 13.1 seconds), with the API key and signing key stored as repository secrets. It has no `pull_request` trigger, so code from a fork never runs with those secrets. If the secrets are missing, the job skips with a notice instead of failing.

**Supply chain checks.** Every pull request and every push to main runs `govulncheck`, `golangci-lint`, `gofmt`, a check that the generated docs are committed, and `terraform validate` on every example. Actions are pinned to commit SHAs. Dependabot opens dependency updates, and on release day `govulncheck` caught advisories in `google.golang.org/grpc` and `golang.org/x/net` that we bumped before tagging. Releases are built by GoReleaser and the checksum file is GPG-signed, which the Terraform Registry checks when you run `terraform init`.

## Limits and what is next

Here is what has been proven against the real API, and what has not.

After the fixes, the real-API acceptance suite passed twice on 2026-11-20 in the `production` environment: once in a local `TF_ACC=1` run, and once in the [Acceptance workflow, started by hand](https://github.com/The-DevOps-Daily/terraform-provider-inngest/actions/runs/44768827231). All four tests passed: `TestAccEnvironment`, `TestAccWebhook`, `TestAccDataSources` and `TestAccKeysDenied`. `TestAccWebhook` creates a webhook, renames it and changes its transform through `PUT /v1/webhooks/{id}` (the URL stays the same), imports it, replaces it with an event filter and a response, deletes it outside Terraform and recreates it, and destroys it. So v1 updates and deletes with a dashboard signing key work. The key worked as given, without the hashed fallback.

:::warning
**Webhook updates and deletes are confirmed in `production` only.** Custom and branch environments, where branch deploys share one signing key, are not tested yet. The test also changes the name and the transform together, so whether a rename alone keeps an existing event filter and response is not tested.
:::

Other open points in GAPS.md:

- v1 webhook calls in custom and branch environments
- Whether archived environments stay in `GET /v2/envs`, and whether archiving reliably frees an active-environment slot
- Duplicate names, reuse of archived names, and names with capitals or spaces
- How empty event filters and transform whitespace come back from the real API
- Successful key reads with a credential that does have key access
- v1 error shapes and retry behaviour under real failures

And the limits that come from the API surface, not from us:

- No environment rename or delete, so `name` changes replace and destroy archives
- No key creation, rotation or deletion, and no API key management
- Changing a webhook's `event_filter` or `response` replaces it, because v1 can only change the name and transform. The replacement has a **new URL**, so the sender needs updating. If a webhook URL is wired into a provider you cannot update quickly, consider `lifecycle { prevent_destroy = true }` on it.

If Inngest adds endpoints for any of these, the provider can follow. The spec check will not flag new endpoints on its own, so tell us in an issue if you see one. We make no guesses about when that might happen.

If you run Inngest and try the provider, we would like to hear what breaks. [Open an issue](https://github.com/The-DevOps-Daily/terraform-provider-inngest/issues) with the plan output and the provider's error (it shows the method, path, status and the API's own error code, with keys and webhook URLs redacted). The repo also has `scripts/probe-api.sh`, which runs redacted, read-only API calls you can attach. Pull requests are welcome too; the contributing guide explains how to run the fake-API tests without an account.

## Summary

- `The-DevOps-Daily/inngest` 0.1.0 manages Inngest custom environments and webhooks from Terraform, with data sources for environments, apps, webhooks and keys, and import for both resources.
- Inngest's two APIs take two credentials: an API key for v2, and the environment's signing key for v1 webhook updates and deletes. API keys cannot read signing keys, so you copy that key from the dashboard.
- The real API differed from our reading of the spec in three places: missing types, key access, and the environment header. Two more limits came from the spec itself: archive instead of delete, and keys that only the dashboard manages. All five changed the design.
- The three real-API findings are now regression tests and part of the fake API, so CI tests against the observed behaviour. The real-API acceptance suite, including webhook updates and deletes through v1, passes in `production` and runs weekly.
- If you want to practise the plan, apply and destroy loop before you point it at a real account, try the [Terraform basics simulator](/games/terraform-terminal-simulator).

The provider is on the [Terraform Registry](https://registry.terraform.io/providers/The-DevOps-Daily/inngest/latest), and the source, issues and GAPS.md are at [github.com/The-DevOps-Daily/terraform-provider-inngest](https://github.com/The-DevOps-Daily/terraform-provider-inngest).
