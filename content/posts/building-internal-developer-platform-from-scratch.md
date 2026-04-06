---
title: 'Building an Internal Developer Platform from Scratch'
excerpt: 'A step-by-step guide to designing and building an internal developer platform that gives your teams self-service infrastructure, faster deployments, and fewer tickets to the platform team.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-04-06'
publishedAt: '2026-04-06T09:00:00Z'
updatedAt: '2026-04-06T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - platform-engineering
  - developer-experience
  - idp
  - kubernetes
  - devops
  - self-service
  - backstage
---

Your platform team is drowning. Every new microservice means a Jira ticket: "Please create a new namespace, set up the CI pipeline, configure the database, add monitoring dashboards." The requesting developer waits two days. Your platform engineer copies a Terraform module, tweaks three variables, and runs `terraform apply`. Both people just wasted time on something a form could handle.

This is the problem an **internal developer platform** (IDP) solves. Not by replacing your infrastructure tools, but by putting a self-service layer on top of them. Developers get what they need in minutes. Platform engineers stop being ticket machines and start building the platform itself.

This guide walks through building one from scratch, with real code you can adapt.

## TLDR

- An IDP is a self-service layer on top of your existing infrastructure (Terraform, Kubernetes, CI/CD)
- Start with a service catalog and templates, not a custom UI
- Use Backstage as your developer portal, or build a thin API layer with service templates
- Define everything as templates: new services, databases, monitoring, CI pipelines
- Golden paths reduce cognitive load without restricting flexibility
- Measure success by time-to-first-deploy for new services, not portal adoption metrics

---

## Prerequisites

- A working Kubernetes cluster (or any container orchestration platform)
- Terraform or OpenTofu for infrastructure provisioning
- A CI/CD system (GitHub Actions, GitLab CI, or similar)
- Basic understanding of YAML templating and REST APIs
- Node.js 18+ (if using Backstage)

---

## Why Build an Internal Developer Platform?

Skip this section if you already know you need one. But if you're trying to convince your manager, here are the numbers.

A 2025 Puppet survey found that teams with a mature IDP deploy **4.3x more frequently** and spend **44% less time on infrastructure requests**. At a 50-person engineering org, that translates to roughly 2,000 hours per year saved on infrastructure busywork.

But the real cost isn't the platform engineer's time. It's the developer sitting idle waiting for their environment. Every day a developer waits for infrastructure is a day of lost product work.

The goal is simple: a developer should go from "I need a new service" to "my service is running in staging" in under 30 minutes, without filing a single ticket.

---

## Step 1: Define Your Golden Paths

Before writing any code, document what "creating a new service" actually requires at your company. Walk through it manually and write down every step.

Here's a typical list:

```text
1. Create a Git repository from a template
2. Set up CI/CD pipeline (build, test, deploy stages)
3. Create Kubernetes namespace and RBAC
4. Provision a database (if needed)
5. Configure DNS and ingress
6. Set up monitoring dashboards and alerts
7. Add service to the service catalog
8. Configure secrets management
```

That's 8 steps across 4-5 different systems. Each one is a potential ticket, a potential blocker, and a potential source of inconsistency.

A **golden path** is a pre-paved route through all of these steps. The developer fills in a few inputs (service name, team, language, needs a database yes/no) and the platform handles the rest.

Important: golden paths are defaults, not mandates. If a team needs something different, they can go off-path. But 80% of the time, the default is exactly right.

---

## Step 2: Build Service Templates

The core of any IDP is templating. Every new service should start from a well-tested template, not a copy-paste of someone's old project.

Here's a practical service template structure:

```text
service-templates/
├── go-api/
│   ├── skeleton/          # The actual project files
│   │   ├── main.go
│   │   ├── Dockerfile
│   │   ├── k8s/
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   └── ingress.yaml
│   │   └── .github/
│   │       └── workflows/
│   │           └── ci.yaml
│   └── template.yaml      # Metadata and input parameters
├── python-worker/
│   ├── skeleton/
│   └── template.yaml
└── react-frontend/
    ├── skeleton/
    └── template.yaml
```

Each `template.yaml` defines the inputs your platform needs:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: go-api-template
  title: Go API Service
  description: Create a new Go API with CI/CD, Kubernetes deployment, and monitoring
spec:
  owner: platform-team
  type: service
  parameters:
    - title: Service Details
      required:
        - name
        - owner
      properties:
        name:
          title: Service Name
          type: string
          pattern: '^[a-z][a-z0-9-]*$'
          description: Lowercase, alphanumeric, hyphens only
        owner:
          title: Owner Team
          type: string
          enum:
            - team-payments
            - team-search
            - team-platform
        needsDatabase:
          title: Needs PostgreSQL database?
          type: boolean
          default: false
        environment:
          title: Initial Environment
          type: string
          enum:
            - staging
            - staging-and-production
          default: staging
  steps:
    - id: scaffold
      name: Generate project files
      action: fetch:template
      input:
        url: ./skeleton
        values:
          name: ${{ parameters.name }}
          owner: ${{ parameters.owner }}
    - id: publish
      name: Create GitHub repository
      action: publish:github
      input:
        repoUrl: github.com?owner=your-org&repo=${{ parameters.name }}
        defaultBranch: main
    - id: provision-infra
      name: Provision infrastructure
      action: custom:terraform-apply
      input:
        module: service-base
        vars:
          service_name: ${{ parameters.name }}
          needs_database: ${{ parameters.needsDatabase }}
          environment: ${{ parameters.environment }}
    - id: register
      name: Register in service catalog
      action: catalog:register
      input:
        repoContentsUrl: ${{ steps.publish.output.repoContentsUrl }}
        catalogInfoPath: /catalog-info.yaml
```

This is a Backstage template, but the pattern works with any system. The key idea: one YAML file defines everything needed to create a fully working service.

---

## Step 3: Automate Infrastructure Provisioning

Your templates need to actually create infrastructure. Wrap your existing Terraform modules behind an API that the platform can call.

Here's a simple Terraform module for provisioning a service's base infrastructure:

```hcl
# modules/service-base/main.tf

variable "service_name" {
  type = string
}

variable "namespace" {
  type    = string
  default = ""
}

variable "needs_database" {
  type    = bool
  default = false
}

variable "environment" {
  type    = string
  default = "staging"
}

locals {
  namespace = var.namespace != "" ? var.namespace : var.service_name
}

# Kubernetes namespace with labels for ownership tracking
resource "kubernetes_namespace" "service" {
  metadata {
    name = local.namespace
    labels = {
      "app.kubernetes.io/managed-by" = "internal-platform"
      "platform.company.io/service"  = var.service_name
      "platform.company.io/env"      = var.environment
    }
  }
}

# Service account with least-privilege RBAC
resource "kubernetes_service_account" "service" {
  metadata {
    name      = var.service_name
    namespace = kubernetes_namespace.service.metadata[0].name
  }
}

# PostgreSQL database (conditional)
resource "helm_release" "postgres" {
  count      = var.needs_database ? 1 : 0
  name       = "${var.service_name}-db"
  namespace  = kubernetes_namespace.service.metadata[0].name
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "postgresql"
  version    = "15.5.0"

  set {
    name  = "auth.database"
    value = replace(var.service_name, "-", "_")
  }

  set {
    name  = "primary.resources.requests.memory"
    value = "256Mi"
  }

  set {
    name  = "primary.resources.requests.cpu"
    value = "250m"
  }
}

# Store database credentials in a Kubernetes secret
resource "kubernetes_secret" "db_credentials" {
  count = var.needs_database ? 1 : 0
  metadata {
    name      = "${var.service_name}-db-credentials"
    namespace = kubernetes_namespace.service.metadata[0].name
  }
  data = {
    DATABASE_URL = "postgresql://${var.service_name}:${helm_release.postgres[0].id}@${var.service_name}-db-postgresql:5432/${replace(var.service_name, "-", "_")}"
  }
}

output "namespace" {
  value = kubernetes_namespace.service.metadata[0].name
}

output "service_account" {
  value = kubernetes_service_account.service.metadata[0].name
}
```

To trigger this from your platform, create a thin API that runs Terraform:

```python
# platform-api/provision.py
import subprocess
import json
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class ServiceRequest(BaseModel):
    service_name: str
    owner: str
    needs_database: bool = False
    environment: str = "staging"

@app.post("/api/v1/services")
async def create_service(request: ServiceRequest):
    workdir = f"/tmp/terraform/{request.service_name}"
    os.makedirs(workdir, exist_ok=True)

    # Write terraform config
    tf_vars = {
        "service_name": request.service_name,
        "needs_database": request.needs_database,
        "environment": request.environment,
    }

    vars_path = os.path.join(workdir, "terraform.tfvars.json")
    with open(vars_path, "w") as f:
        json.dump(tf_vars, f)

    # Run terraform init and apply
    try:
        subprocess.run(
            ["terraform", "init", "-backend-config=key=services/{}.tfstate".format(
                request.service_name
            )],
            cwd=workdir,
            check=True,
            capture_output=True,
        )
        result = subprocess.run(
            ["terraform", "apply", "-auto-approve",
             "-var-file=terraform.tfvars.json"],
            cwd=workdir,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=e.stderr)

    return {
        "status": "created",
        "service_name": request.service_name,
        "namespace": request.service_name,
        "output": result.stdout,
    }
```

When a developer requests a new service, the flow looks like this:

```text
Developer clicks "Create Service"
         │
         ▼
┌──────────────────┐
│  Platform Portal │  (Backstage / custom UI)
│  Collects inputs │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Platform API   │  Validates, queues request
└────────┬─────────┘
         │
    ┌────┴────┬──────────┬──────────┐
    ▼         ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Create │ │Terraform│ │ CI/CD  │ │Register│
│  Repo  │ │ Apply  │ │ Setup  │ │Catalog │
└────────┘ └────────┘ └────────┘ └────────┘
```

---

## Step 4: Set Up the Developer Portal

You have two practical options here: use Backstage or build a minimal portal yourself. For most teams, Backstage is the right choice. It's open source, has a large plugin ecosystem, and handles the boring parts (authentication, catalog, search) for you.

Set up Backstage:

```bash
npx @backstage/create-app@latest
cd my-platform
yarn install
yarn dev
```

You should see output like:

```text
[0] Loaded config from app-config.yaml, app-config.local.yaml
[0] webpack compiled successfully
[1] Listening on :7007
```

Open `http://localhost:3000` and you'll have a working developer portal.

The key configuration is in `app-config.yaml`:

```yaml
# app-config.yaml
app:
  title: Acme Developer Platform
  baseUrl: http://localhost:3000

catalog:
  locations:
    # Load service templates from your templates repo
    - type: url
      target: https://github.com/your-org/service-templates/blob/main/*/template.yaml
      rules:
        - allow: [Template]
    # Auto-discover all services
    - type: url
      target: https://github.com/your-org/*/blob/main/catalog-info.yaml
      rules:
        - allow: [Component, API]

integrations:
  github:
    - host: github.com
      token: ${GITHUB_TOKEN}

techdocs:
  builder: external
  publisher:
    type: awsS3
    awsS3:
      bucketName: your-techdocs-bucket
```

Every service needs a `catalog-info.yaml` in its root:

```yaml
# catalog-info.yaml (goes in each service repo)
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: payment-service
  description: Handles payment processing
  annotations:
    github.com/project-slug: your-org/payment-service
    backstage.io/techdocs-ref: dir:.
  tags:
    - go
    - grpc
spec:
  type: service
  lifecycle: production
  owner: team-payments
  dependsOn:
    - resource:payment-db
  providesApis:
    - payment-api
```

---

## Step 5: Add Guardrails, Not Gates

A good platform makes the right thing easy and the wrong thing hard. It doesn't block developers with approval workflows.

Here's what guardrails look like in practice:

**Resource quotas per namespace** prevent a single service from eating the cluster:

```yaml
# Applied automatically by the platform for every new service
apiVersion: v1
kind: ResourceQuota
metadata:
  name: default-quota
  namespace: $SERVICE_NAME
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    persistentvolumeclaims: "5"
    services.loadbalancers: "2"
```

**Network policies** enforce service-to-service communication rules:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: $SERVICE_NAME
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              platform.company.io/env: $ENVIRONMENT
```

**OPA/Gatekeeper policies** catch misconfigurations before they hit production:

```yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: require-team-labels
spec:
  match:
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment"]
  parameters:
    labels:
      - key: "app.kubernetes.io/managed-by"
      - key: "platform.company.io/service"
      - key: "platform.company.io/owner"
    message: "All deployments must have managed-by, service, and owner labels"
```

When a developer tries to deploy without the required labels, they get a clear error:

```text
Error from server (Forbidden): error when creating "deployment.yaml":
admission webhook "validation.gatekeeper.sh" denied the request:
[require-team-labels] All deployments must have managed-by, service,
and owner labels. Missing: platform.company.io/owner
```

This is much better than a review process. The developer fixes it immediately instead of waiting for someone to notice in a PR review.

---

## Step 6: Measure What Matters

Don't measure portal logins or template usage. Measure the outcomes:

```text
┌────────────────────────────────────┬───────────┬────────────┐
│ Metric                             │ Before    │ Target     │
├────────────────────────────────────┼───────────┼────────────┤
│ Time to first deploy (new service) │ 3-5 days  │ < 30 min   │
│ Infrastructure tickets per week    │ 15-20     │ < 3        │
│ Time to onboard new engineer       │ 2 weeks   │ 2 days     │
│ Services with monitoring           │ 60%       │ 100%       │
│ Deployment frequency               │ 2x/week   │ 5x/day     │
│ Failed deployments requiring help  │ 30%       │ < 5%       │
└────────────────────────────────────┴───────────┴────────────┘
```

Track these from day one. If your platform isn't moving these numbers, you're building the wrong thing.

---

## Common Mistakes to Avoid

**Building a UI before the API.** Start with templates and CLI tools. If developers can run `platform create service --name=foo --db=true` and get a working service, you've solved 80% of the problem. A pretty portal can come later.

**Trying to support every workflow on day one.** Pick your top 3 most common service types and build golden paths for those. Expand once they're solid.

**Making the platform mandatory.** If your platform is good, people will use it voluntarily. If you have to force adoption, the platform isn't solving real problems. Fix the platform, don't mandate it.

**Ignoring the existing ecosystem.** Your IDP should wrap your current tools (Terraform, Kubernetes, GitHub Actions), not replace them. Developers who need to go deeper should still be able to use the underlying tools directly.

---

## What to Build Next

If you've followed along, you now have the building blocks for a basic IDP: service templates, automated provisioning, a developer portal, and guardrails. Here's how to prioritize what comes next:

1. **Week 1-2**: Set up Backstage and create templates for your two most common service types. Wire them to your existing Terraform modules. Get one real team to create a service through the platform.
2. **Week 3-4**: Add a service catalog that auto-discovers existing services from your GitHub org. Set up resource quotas and basic network policies.
3. **Month 2**: Add monitoring and alerting templates so every new service ships with dashboards. Build a CLI tool (`platform create service`) as an alternative to the portal.
4. **Month 3**: Add environment promotion workflows (staging to production) and integrate cost tracking per service.

Start small. Ship fast. Iterate based on what your developers actually need, not what conference talks say they should want.

The best internal developer platform is the one that removes real friction from your team's daily work. Build that, and adoption takes care of itself.
