---
title: 'Policy as Code'
description: 'Write and enforce security policies using OPA, Kyverno, and Conftest. Automate policy validation in CI/CD and Kubernetes admission control.'
---

# Policy as Code

Policy as Code lets you define security requirements as code, version control them, and enforce them automatically. Instead of PDF documents that nobody reads, you write executable policies that block non-compliant changes.

## Why Policy as Code?

### Traditional Policy Management

```plaintext
📄 Security Policy Document (v3.pdf)
- Containers must not run as root
- All images must be scanned
- Resource limits are required

❌ Problems:
- Nobody reads 50-page PDFs
- No enforcement
- Violations found in audits
- Manual checking
```

### Policy as Code

```rego
package kubernetes.admission

deny[msg] {
  input.request.kind.kind == "Pod"
  container := input.request.object.spec.containers[_]
  container.securityContext.runAsNonRoot != true
  msg := sprintf("Container %v must set runAsNonRoot=true", [container.name])
}
```

✅ **Benefits:**
- Automatic enforcement
- Version controlled
- Testable
- Prevents violations before deployment

## Tools Comparison

| Tool | Best For | Learning Curve | K8s Native |
|------|----------|----------------|------------|
| **OPA** | General policies | Medium | No (needs Gatekeeper) |
| **Kyverno** | Kubernetes | Low | Yes |
| **Conftest** | CI/CD | Low | No |
| **jsPolicy** | JavaScript policies | Low | Yes |
| **Kubewarden** | WebAssembly policies | Medium | Yes |

## Open Policy Agent (OPA)

### Installation

```bash
# Download OPA
curl -L -o opa https://openpolicyagent.org/downloads/latest/opa_linux_amd64
chmod +x opa
sudo mv opa /usr/local/bin/

# Verify
opa version
```

### Writing Policies

**Rego Policy Language:**

```rego
package docker.security

# Deny if image not from trusted registry
deny[msg] {
  input.image
  not startswith(input.image, "ghcr.io/myorg/")
  msg := sprintf("Image %v not from trusted registry", [input.image])
}

# Deny if running as root
deny[msg] {
  input.user == "root"
  msg := "Container must not run as root"
}

# Require resource limits
deny[msg] {
  not input.resources.limits.memory
  msg := "Memory limit required"
}
```

### Testing Policies

**Input (test-pod.json):**
```json
{
  "image": "nginx:latest",
  "user": "root",
  "resources": {}
}
```

**Run OPA:**
```bash
opa eval -i test-pod.json -d policy.rego "data.docker.security.deny"

# Output
[
  "Image nginx:latest not from trusted registry",
  "Container must not run as root",
  "Memory limit required"
]
```

### Unit Tests

**policy_test.rego:**
```rego
package docker.security

test_deny_untrusted_image {
  deny[msg] with input as {"image": "nginx:latest"}
  msg == "Image nginx:latest not from trusted registry"
}

test_allow_trusted_image {
  count(deny) == 0 with input as {"image": "ghcr.io/myorg/app:v1"}
}

test_deny_root_user {
  deny[msg] with input as {"user": "root"}
  msg == "Container must not run as root"
}
```

**Run tests:**
```bash
opa test policy.rego policy_test.rego -v
```

## Conftest (CI/CD Integration)

Conftest uses OPA policies to test configuration files.

### Installation

```bash
# Using binary
curl -L https://github.com/open-policy-agent/conftest/releases/latest/download/conftest_linux_amd64.tar.gz | tar xz
sudo mv conftest /usr/local/bin/

# Verify
conftest --version
```

### Dockerfile Policy

**policy/dockerfile.rego:**
```rego
package main

import future.keywords

# Deny if no USER instruction
deny[msg] {
  input[_].Cmd == "from"
  not has_user_instruction
  msg := "Dockerfile must set USER (cannot run as root)"
}

has_user_instruction {
  input[_].Cmd == "user"
}

# Deny if using latest tag
deny[msg] {
  input[_].Cmd == "from"
  val := input[_].Value
  contains(val[_], ":latest")
  msg := "Do not use ':latest' tag. Pin specific versions."
}

# Deny if missing HEALTHCHECK
deny[msg] {
  input[_].Cmd == "from"
  not has_healthcheck
  msg := "Dockerfile must include HEALTHCHECK instruction"
}

has_healthcheck {
  input[_].Cmd == "healthcheck"
}
```

### Test Dockerfile

```bash
conftest test Dockerfile

# Output
FAIL - Dockerfile - main - Dockerfile must set USER (cannot run as root)
FAIL - Dockerfile - main - Do not use ':latest' tag. Pin specific versions.
FAIL - Dockerfile - main - Dockerfile must include HEALTHCHECK instruction

3 tests, 0 passed, 0 warnings, 3 failures
```

### Kubernetes Manifest Policy

**policy/kubernetes.rego:**
```rego
package main

# Require resource limits
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.resources.limits
  msg := sprintf("Container %s must have resource limits", [container.name])
}

# Require security context
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.securityContext.runAsNonRoot
  msg := sprintf("Container %s must set runAsNonRoot=true", [container.name])
}

# Deny privileged containers
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  container.securityContext.privileged == true
  msg := sprintf("Container %s cannot be privileged", [container.name])
}

# Require read-only root filesystem
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.securityContext.readOnlyRootFilesystem
  msg := sprintf("Container %s must use read-only root filesystem", [container.name])
}
```

### Test Manifest

```bash
conftest test deployment.yaml

# Test multiple files
conftest test k8s/*.yaml

# Custom policy path
conftest test --policy ./security-policies deployment.yaml
```

## Kyverno (Kubernetes Native)

Kyverno policies are Kubernetes resources — easier to write than Rego.

### Installation

```bash
kubectl create -f https://github.com/kyverno/kyverno/releases/latest/download/install.yaml

# Verify
kubectl get pods -n kyverno
```

### Policy: Require Labels

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-labels
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-team-label
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Label 'team' is required"
        pattern:
          metadata:
            labels:
              team: "?*"
```

### Policy: Disallow Privileged

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-privileged
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-privileged
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Privileged containers are not allowed"
        pattern:
          spec:
            containers:
              - securityContext:
                  privileged: false
```

### Policy: Require Image Signature

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-signature
      match:
        any:
          - resources:
              kinds:
                - Pod
      verifyImages:
        - imageReferences:
            - "ghcr.io/myorg/*"
          attestors:
            - count: 1
              entries:
                - keyless:
                    subject: "https://github.com/myorg/*"
                    issuer: "https://token.actions.githubusercontent.com"
                    rekor:
                      url: https://rekor.sigstore.dev
```

### Test Policies

```bash
# Apply policy
kubectl apply -f policy.yaml

# Test with a pod
kubectl run test --image=nginx --dry-run=server

# Should fail with policy violation
Error from server: admission webhook "validate.kyverno.svc" denied the request:

resource Pod/default/test was blocked due to the following policies:

require-labels:
  check-team-label: 'validation error: Label ''team'' is required'
```

## GitHub Actions Integration

```yaml
name: Policy Validation

on: [push, pull_request]

jobs:
  conftest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Conftest
        run: |
          curl -L https://github.com/open-policy-agent/conftest/releases/latest/download/conftest_linux_amd64.tar.gz | tar xz
          sudo mv conftest /usr/local/bin/
      
      - name: Test Dockerfile
        run: conftest test Dockerfile --policy policy/
      
      - name: Test Kubernetes manifests
        run: conftest test k8s/*.yaml --policy policy/
      
      - name: Test Terraform
        run: |
          terraform init
          terraform plan -out=tfplan
          terraform show -json tfplan > plan.json
          conftest test plan.json --policy policy/terraform/
```

## GitLab CI Integration

```yaml
stages:
  - policy

policy-check:
  stage: policy
  image: openpolicyagent/conftest:latest
  script:
    - conftest test Dockerfile --policy policy/
    - conftest test k8s/*.yaml --policy policy/
  only:
    - merge_requests
    - main
```

## Best Practices

### Start with Warnings

```rego
# Start with warnings, not denials
warn[msg] {
  input.image
  not startswith(input.image, "ghcr.io/myorg/")
  msg := sprintf("Image %v not from trusted registry", [input.image])
}

# Convert to deny after team adapts
# deny[msg] { ... }
```

### Organize Policies

```
policy/
├── dockerfile/
│   ├── security.rego
│   └── best-practices.rego
├── kubernetes/
│   ├── security.rego
│   ├── resources.rego
│   └── networking.rego
└── terraform/
    ├── aws.rego
    └── security-groups.rego
```

### Document Policies

```rego
package kubernetes.security

# METADATA
# title: Container Security Context
# description: Ensures containers run with secure settings
# custom:
#   severity: high
#   frameworks:
#     - CIS-1.6
#     - PCI-DSS

deny[msg] {
  # Check logic here
}
```

### Test Everything

```bash
# Run policy tests
opa test policy/ -v

# Test coverage
opa test policy/ --coverage
```

## Troubleshooting

### Policy Not Triggering

```bash
# Debug OPA evaluation
opa eval -i input.json -d policy.rego --explain full "data.main.deny"

# Check Kyverno policy status
kubectl describe clusterpolicy require-labels
```

### False Positives

```rego
# Add exceptions
deny[msg] {
  input.kind == "Pod"
  not is_exception
  # ... validation logic
}

is_exception {
  input.metadata.namespace == "kube-system"
}

is_exception {
  input.metadata.annotations["policy-exception"] == "approved"
}
```

## Next Steps

- **[Vulnerability Gates](./02-vulnerability-gates)** — Block critical CVEs in your pipeline
- **[Compliance Gates](./03-compliance-gates)** — Automate CIS, PCI-DSS checks
- **[CI/CD Integration](./04-cicd-integration)** — Complete pipeline integration

---

**Key takeaway**: Start with 3-5 critical policies, use warnings first, then convert to denials. Test policies like code.
