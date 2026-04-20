---
title: 'The Ory Ecosystem Explained: Identity, OAuth2, and SSO for Kubernetes'
excerpt: 'A practical breakdown of the Ory ecosystem - Kratos, Hydra, Polis, Oathkeeper, and Keto - what each one does, how they connect, and how to pick the right components for your auth stack.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-04-08'
publishedAt: '2026-04-08T09:00:00Z'
updatedAt: '2026-04-08T09:00:00Z'
readingTime: '18 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kubernetes
  - DevOps
  - Security
  - Identity
  - OAuth2
  - SSO
  - Helm
---

Authentication and identity management are the kind of things you really don't want to build from scratch. Roll your own password hashing, session management, OAuth2 flows, and SAML federation, and you'll spend months on security-critical code that still keeps you up at night.

Ory is an open-source ecosystem that gives you production-grade identity infrastructure. Each component handles a specific piece of the auth puzzle, and they work together as a complete stack. The problem is that the ecosystem has grown to include multiple products, and it's not always obvious which ones you actually need. This post breaks down each component, how they fit together, and which ones you can skip depending on your use case.

## TLDR

- **Kratos** handles user registration, login, recovery, and profile management - it's the identity store
- **Hydra** is a certified OAuth2/OIDC server that issues tokens
- **Polis** bridges SAML identity providers (Okta, Azure AD) into standard OAuth2 flows for enterprise SSO
- **Oathkeeper** is a reverse proxy for zero-trust auth - useful but optional if your app validates tokens itself
- **Keto** is a fine-grained authorization engine inspired by Google Zanzibar - only needed if you need centralized RBAC/ABAC across services
- All components are open source and can be deployed on Kubernetes via Helm

## Prerequisites

- Basic understanding of OAuth2 and OIDC concepts (access tokens, ID tokens, authorization flows)
- Familiarity with Kubernetes and Helm
- A PostgreSQL instance (all Ory services use Postgres)
- Experience with identity concepts like SSO, SAML, and SCIM is helpful but not required

## The Ory Ecosystem in Plain English

Before diving into the details, here's the simplest way to think about it. Imagine you're building a B2B SaaS product and a customer says "we need our employees to log in with their company Okta accounts." That one sentence involves a surprising number of moving parts:

- Somewhere to store user accounts (Kratos)
- Something to issue OAuth2 tokens so your API knows who's calling (Hydra)
- Something to translate between your customer's SAML-based Okta setup and the OAuth2 your app speaks (Polis)

Each Ory component handles exactly one of these jobs. You can think of it like a Unix philosophy for identity: small, focused tools that compose together.

```text
+----------+     +----------+     +----------+
|  Kratos  |     |  Hydra   |     |  Polis   |
| "Who are |     | "Here's  |     | "I speak |
|   you?"  |     | a token" |     |  SAML so |
|          |     |          |     | you don't|
|          |     |          |     | have to" |
+----------+     +----------+     +----------+
  Identity         Tokens        Enterprise SSO
```

If all you need is username/password login, Kratos alone is enough. Need API tokens? Add Hydra. Enterprise customers with SAML? Add Polis. You build up only what you need.

## Why Ory Instead of Auth0, Clerk, or Firebase Auth?

The short answer: control and cost at scale.

Managed auth services like Auth0 and Clerk are great until you hit their pricing tiers. Auth0 charges per monthly active user, and once you pass the free tier, costs climb fast. At 10,000 MAU, you're looking at hundreds of dollars per month. At 100,000, it's thousands.

| | Auth0 | Clerk | Firebase Auth | Ory (self-hosted) |
|---|---|---|---|---|
| 1,000 MAU | Free | Free | Free | Free (your infra cost) |
| 10,000 MAU | ~$230/mo | ~$100/mo | Free | ~$50-100/mo (infra) |
| 100,000 MAU | ~$1,300/mo | ~$500/mo | $0.06/MAU | ~$50-100/mo (infra) |
| SAML SSO | Enterprise plan | $50/connection | Not included | Included (Polis) |
| Data residency | Enterprise plan | Enterprise plan | GCP regions | You choose |
| Vendor lock-in | High | High | Moderate | None |

The tradeoff: you're responsible for running and maintaining the infrastructure. If your team is already comfortable with Kubernetes, this is manageable. If you don't have ops capacity, a managed service might be the better call until you do.

Beyond cost, there are cases where self-hosted is the only option: strict data residency requirements, air-gapped environments, or compliance rules that don't allow user data to leave your infrastructure.

## The Ory Components

### Kratos - Identity Management

Kratos is the core of the ecosystem. It handles everything related to user identities: registration, login, account recovery, email verification, and profile management. It exposes all of this through a headless API, meaning there is no built-in UI. You bring your own frontend or use their reference implementation.

The key concepts to understand:

- **Identity schemas** define what a user looks like (email, name, custom traits) using JSON Schema
- **Self-service flows** handle login, registration, recovery, and verification through API-driven workflows
- **Credentials** support multiple auth methods: passwords, OIDC, WebAuthn, TOTP, and lookup secrets
- **Two APIs**: a public API on port `4433` for user-facing operations and an admin API on port `4434` for identity CRUD and privileged operations

Kratos needs PostgreSQL with the `pg_trgm`, `btree_gin`, and `uuid-ossp` extensions enabled.

```bash
# Install Kratos via Helm
helm repo add ory https://k8s.ory.sh/helm/charts
helm repo update
helm install kratos ory/kratos -f kratos-values.yaml
```

A minimal `kratos-values.yaml` looks like this:

```yaml
kratos:
  config:
    dsn: postgres://kratos:password@postgres:5432/kratos?sslmode=disable
    identity:
      default_schema_id: default
      schemas:
        - id: default
          url: file:///etc/config/identity.schema.json
    selfservice:
      default_browser_return_url: https://your-app.example.com
      flows:
        login:
          ui_url: https://your-app.example.com/login
        registration:
          ui_url: https://your-app.example.com/register
```

### Hydra - OAuth2 and OpenID Connect Provider

Hydra is a certified OAuth 2.0 and OpenID Connect server. It issues access tokens, refresh tokens, and ID tokens. It handles consent flows and manages OAuth2 clients.

The important thing to understand about Hydra is that it delegates authentication decisions. When a user needs to log in, Hydra redirects to an external login UI (Kratos in this case). Once the user authenticates, Kratos tells Hydra the login was successful, and Hydra issues the tokens.

Key details:

- **OAuth2 clients** are registered applications that can request tokens
- **Consent flow** delegates login and consent decisions to an external UI
- **Token introspection** validates tokens for resource servers
- **Maester** is a CRD controller for managing OAuth2 clients as Kubernetes resources
- **Two APIs**: public API on port `4444` for OAuth2/OIDC endpoints and admin API on port `4445` for client and consent management

```bash
helm install hydra ory/hydra -f hydra-values.yaml
```

The public API exposes the standard OIDC endpoints:

```text
/oauth2/auth          - Authorization endpoint
/oauth2/token         - Token endpoint
/.well-known/openid-configuration  - OIDC discovery
```

Hydra needs PostgreSQL with the `uuid-ossp` extension.

### Polis - SAML-to-OIDC Bridge and Directory Sync

Polis is the enterprise SSO piece. When your customers use SAML identity providers like Okta, Azure AD, or OneLogin, Polis translates those SAML assertions into standard OAuth 2.0 flows. Your application never has to deal with SAML directly.

Beyond the auth bridge, Polis also provides SCIM 2.0 directory sync. This means when a customer adds or removes users in their identity provider, those changes automatically propagate to your system.

Key concepts:

- **SAML bridge** translates customer IdP SAML responses into standard OAuth 2.0 tokens
- **OIDC federation** also supports connecting to OIDC identity providers directly
- **Directory sync (SCIM 2.0)** auto-provisions and de-provisions users and groups from the customer's IdP
- **Multi-tenancy** keeps each tenant's SSO connections and directory sync configs isolated
- **Admin portal** provides a built-in UI for managing SSO connections

Polis runs on a single port (`5225`) that serves the public API, OAuth endpoints, admin portal, and SCIM endpoints:

```text
/oauth/authorize                  - OAuth 2.0 authorization
/oauth/token                      - Token endpoint
/oauth/userinfo                   - User info endpoint
/api/v1/sso/                      - SSO connection management
/api/v1/dsync/scim/v2.0/          - SCIM 2.0 directory sync
/.well-known/                     - Protocol discovery
```

Polis supports PostgreSQL, MySQL, MongoDB, Redis, and DynamoDB for storage, but PostgreSQL is the simplest choice if you're already running it for Kratos and Hydra.

The open-source version is based on BoxyHQ's Jackson project (`boxyhq/jackson` Docker image). Ory also offers an enterprise image through their private registry.

### Oathkeeper - Identity and Access Proxy

Oathkeeper is a reverse proxy that authenticates and authorizes incoming requests using zero-trust principles. It sits in front of your API, validates credentials, and mutates requests by adding auth headers before forwarding them upstream.

**You might not need this.** If your application already validates tokens (for example, by checking JWTs against the OIDC discovery endpoint), Oathkeeper adds an unnecessary layer. It's most useful when you have multiple services and want to centralize auth at the proxy level instead of implementing token validation in each one.

### Keto - Fine-Grained Authorization

Keto is an authorization engine inspired by Google's Zanzibar paper. It answers questions like "is user X allowed to perform action Y on resource Z?" and supports RBAC, ABAC, and ACL patterns.

**You probably don't need this either** unless you're building a multi-service system that needs centralized, cross-service authorization policies. If your application has its own RBAC system, Keto would be redundant.

## How They Connect Together

Here's how the components connect for a typical enterprise SSO setup:

```text
Customer's IdP (Okta, Azure AD, etc.)
        |
        | SAML or OIDC
        v
   +---------+
   |  Polis  |  Translates SAML/OIDC --> standard OAuth 2.0
   +---------+
        |
        | OAuth 2.0 / user identity
        v
   +---------+
   | Kratos  |  Stores user identities, manages sessions
   +---------+
        |
        | Login/consent delegation
        v
   +---------+
   |  Hydra  |  Issues OAuth2/OIDC tokens
   +---------+
        |
        | OIDC tokens (access_token, id_token)
        v
   +----------+
   | Nexboard |  Validates tokens via OIDC authenticator
   +----------+
```

### The Authentication Flow Step by Step

Let's say you're building a B2B analytics dashboard called Nexboard that needs enterprise SSO. Here's how the flow works:

1. A user visits Nexboard and needs to authenticate
2. Nexboard redirects to Hydra (the OIDC provider)
3. Hydra delegates to Kratos for login via the configured `login_url` and `consent_url`
4. Kratos uses Polis for SAML/OIDC federation with the customer's identity provider
5. The customer authenticates with their IdP (for example, Okta via SAML)
6. Polis bridges the SAML response back to Kratos as a standard OAuth flow
7. Kratos confirms the identity to Hydra (login + consent)
8. Hydra issues OIDC tokens (access_token, id_token)
9. Nexboard validates the token using Hydra's OIDC discovery endpoint

### The Directory Sync Flow

Separately from authentication, Polis handles SCIM-based user provisioning:

1. The customer configures SCIM in their identity provider (Okta, Azure AD)
2. The IdP pushes user and group changes to the Polis SCIM endpoint
3. Polis syncs those changes to Kratos, creating, updating, or deleting identities automatically
4. The result: when users are added or removed in the customer's IdP, they are automatically provisioned or deprovisioned in Nexboard's identity system

This means you never have to manually manage user accounts for enterprise customers. Their IT team handles it through their existing tools.

## Database Architecture

Each service gets its own database. They can share a PostgreSQL instance, but each needs a separate database:

| Service | Database | Required Extensions |
|---------|----------|---------------------|
| Kratos  | `kratos` | `pg_trgm`, `btree_gin`, `uuid-ossp` |
| Hydra   | `hydra`  | `uuid-ossp` |
| Polis   | `polis`  | None (standard Postgres) |

Set up the databases and extensions before deploying:

```sql
CREATE DATABASE kratos;
CREATE DATABASE hydra;
CREATE DATABASE polis;

\c kratos
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c hydra
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## OSS vs Enterprise

All the core functionality for identity management, OAuth2 token issuance, SAML bridging, and SCIM directory sync is available in the open-source versions.

| Feature | OSS | Enterprise (OEL) |
|---------|-----|-------------------|
| OIDC authentication | Yes (Kratos) | Yes |
| OAuth2 token issuance | Yes (Hydra) | Yes |
| SAML bridge | Yes (Polis/Jackson) | Yes |
| SCIM directory sync | Yes (Polis) | Yes |
| Resource Owner Password Credentials | No | Yes (Hydra OEL) |
| Custom token prefixes | No | Yes (Hydra OEL) |
| CVE patches with SLAs | No | Yes |
| Premium support | Community only | Yes |

The enterprise images are hosted on Ory's private Google Artifact Registry and require a GCP service account key for access:

```bash
# Create the pull secret for OEL images
kubectl create secret docker-registry ory-oel-gcr-secret \
  --docker-server=europe-docker.pkg.dev \
  --docker-username=_json_key \
  --docker-password="$(cat keyfile.json)" \
  --docker-email=your-email@example.com
```

Enterprise makes sense when you need SLA-backed security patches and support. For getting started and validating your architecture, the OSS versions are fully functional.

## Which Components Do You Actually Need?

Not every setup requires the full ecosystem. Here's a quick guide:

**Basic username/password auth:**
- Kratos only. It handles registration, login, recovery, and session management out of the box.

**OAuth2/OIDC token issuance (API auth, third-party integrations):**
- Kratos + Hydra. Kratos manages identities, Hydra issues tokens.

**Enterprise SSO (SAML customers, directory sync):**
- Kratos + Hydra + Polis. This is the full stack for B2B SaaS with enterprise customers.

**Centralized auth proxy (zero-trust, multiple backend services):**
- Add Oathkeeper to any of the above if you want to validate tokens at the proxy layer instead of in each service.

**Cross-service authorization (fine-grained RBAC/ABAC):**
- Add Keto if your application doesn't have its own authorization system and you need centralized policies across multiple services.

Start with the minimum set and add components as the requirements grow. Each piece is independent and can be added later without rearchitecting.

## Deploying on Kubernetes with Helm

All Ory components have official Helm charts:

```bash
helm repo add ory https://k8s.ory.sh/helm/charts
helm repo update

# Deploy in order: databases first, then Kratos, then Hydra, then Polis
helm install kratos ory/kratos -f kratos-values.yaml -n auth
helm install hydra ory/hydra -f hydra-values.yaml -n auth
```

For Polis, you may need a custom Helm chart or a plain Kubernetes deployment since it's based on the BoxyHQ Jackson project and may not have an official Ory Helm chart yet.

A few things to keep in mind:

- Run database migrations before starting services (`kratos migrate sql`, `hydra migrate sql`)
- Use Kubernetes secrets for database DSNs and sensitive configuration
- Set up proper ingress rules to expose only the public APIs (`4433`, `4444`, `5225`) and keep admin APIs (`4434`, `4445`) internal
- Hydra's `login_url` and `consent_url` must point to your Kratos-backed login UI

## Try It Locally with Docker Compose

Before deploying to Kubernetes, you can spin up Kratos and Hydra locally to get a feel for how they work together:

```yaml
# docker-compose.yml
version: "3.8"

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: ory
      POSTGRES_PASSWORD: ory
      POSTGRES_MULTIPLE_DATABASES: kratos,hydra
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data

  kratos-migrate:
    image: oryd/kratos:v1.3.0
    command: migrate sql -e --yes
    environment:
      DSN: postgres://ory:ory@postgres:5432/kratos?sslmode=disable
    depends_on:
      - postgres

  kratos:
    image: oryd/kratos:v1.3.0
    command: serve -c /etc/config/kratos.yml --dev --watch-courier
    environment:
      DSN: postgres://ory:ory@postgres:5432/kratos?sslmode=disable
    ports:
      - "4433:4433"  # Public API
      - "4434:4434"  # Admin API
    volumes:
      - ./kratos:/etc/config
    depends_on:
      - kratos-migrate

  hydra-migrate:
    image: oryd/hydra:v2.3.0
    command: migrate sql -e --yes
    environment:
      DSN: postgres://ory:ory@postgres:5432/hydra?sslmode=disable
    depends_on:
      - postgres

  hydra:
    image: oryd/hydra:v2.3.0
    command: serve all --dev
    environment:
      DSN: postgres://ory:ory@postgres:5432/hydra?sslmode=disable
      URLS_SELF_ISSUER: http://localhost:4444
      URLS_LOGIN: http://localhost:4433/self-service/login/browser
      URLS_CONSENT: http://localhost:4433/self-service/login/browser
    ports:
      - "4444:4444"  # Public API
      - "4445:4445"  # Admin API
    depends_on:
      - hydra-migrate

volumes:
  pg_data:
```

```bash
docker compose up -d
# Wait a few seconds for migrations

# Check Kratos is running
curl http://localhost:4433/health/alive

# Check Hydra's OIDC discovery
curl http://localhost:4444/.well-known/openid-configuration
```

This gives you a working Kratos + Hydra setup to experiment with. You can create identities, test login flows, and see how the two services interact before committing to a full Kubernetes deployment.

## Common Pitfalls

A few things that trip people up when first working with Ory:

**Forgetting database migrations.** Kratos and Hydra both require explicit migration steps before they'll start. If a pod keeps crash-looping, check if migrations ran successfully.

**Exposing admin APIs.** The admin APIs (`4434` for Kratos, `4445` for Hydra) allow full identity and client management with no authentication. Never expose these outside your cluster. Use Kubernetes NetworkPolicies or keep them on ClusterIP services only.

**Headless means headless.** Kratos has no login page. You need to build a frontend that calls Kratos APIs, or use the reference UI from Ory's GitHub. This catches people off guard if they're used to Auth0's hosted login page.

**Hydra does not authenticate users.** This is the most common misconception. Hydra issues tokens, but it delegates the actual "is this person who they say they are?" question to Kratos (or whatever login UI you configure). If your login page isn't working, the problem is usually in the Kratos configuration or your custom UI, not in Hydra.

**Cookie domains and CORS.** When running Kratos behind a different domain than your app, you'll hit CORS and cookie issues. Make sure `serve.public.cors` is configured in Kratos and that your cookie domain covers both your app and Kratos.

## Summary

The Ory ecosystem gives you a modular, open-source identity stack that you can deploy on your own infrastructure. The core trio of Kratos (identity), Hydra (tokens), and Polis (enterprise SSO) covers what most B2B applications need. Oathkeeper and Keto are there when you need them, but plenty of setups run fine without them.

The main tradeoff compared to managed auth services like Auth0 or Clerk is operational overhead. You're running and maintaining these services yourself. But you get full control, no per-user pricing, and no vendor lock-in. For teams already comfortable with Kubernetes, it's a solid alternative to managed identity platforms.
