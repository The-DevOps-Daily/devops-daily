---
title: 'Policy as Code with OPA, Conftest and Kyverno'
description: 'Write Rego v1 policies, test them with opa test and Conftest in CI, and enforce them in Kubernetes with ValidatingAdmissionPolicy, Kyverno or Gatekeeper.'
order: 1
---

A security policy in a wiki page depends on people remembering it. **Policy as code** turns each rule into a small program that runs against your files and API requests: "containers must not run privileged" becomes a check that fails a pull request and rejects the `kubectl apply`. The policies live in Git, get reviewed like code, and have unit tests.

This part covers both places a policy runs:

- **In CI**, against files in the repository: Kubernetes manifests, Dockerfiles and Terraform. The tools are [Open Policy Agent](https://www.openpolicyagent.org/) (OPA) and [Conftest](https://www.conftest.dev/), and the language is Rego.
- **In the cluster**, at admission time, against every object the API server receives. The options are the built-in ValidatingAdmissionPolicy, Kyverno and OPA Gatekeeper.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "repo", "label": "Git repository", "sub": "manifests, Dockerfile, .tf", "icon": "branch", "tone": "slate" }
    ],
    [
      { "id": "ci", "label": "CI: conftest test", "sub": "fails the pull request", "icon": "gear", "tone": "accent", "detail": "Conftest runs your Rego policies against files before anything is built or deployed." },
      { "id": "kubectl", "label": "kubectl apply / Argo CD", "sub": "after merge", "icon": "rocket", "tone": "blue" }
    ],
    [
      { "id": "api", "label": "API server admission", "sub": "VAP, Kyverno or Gatekeeper", "icon": "shield", "tone": "green", "detail": "Admission control rejects objects that break the policy, including ones that never went through CI." }
    ],
    [
      { "id": "etcd", "label": "Stored in etcd", "sub": "only if admitted", "icon": "database", "tone": "violet" }
    ]
  ],
  "edges": [
    ["repo", "ci", "pull request"],
    ["repo", "kubectl", "merge"],
    ["kubectl", "api", "request"],
    ["api", "etcd", "allowed"]
  ]
}
```

You need both. The CI check gives fast feedback on the pull request. The admission check catches everything that does not come through that pipeline: a `kubectl edit` during an incident, a Helm chart someone installs by hand, or a controller that creates Pods for you.

## Prerequisites

- A Linux, macOS or Windows machine with a terminal.
- Basic knowledge of Kubernetes manifests and Dockerfiles.
- For the admission control section: optionally a test cluster (for example [kind](https://kind.sigs.k8s.io/)) running Kubernetes 1.30 or later. Every policy in this part can also be tested offline.

## The Example Repository

All four parts of this guide use one small service, `orders-api`, a Java API with a Kubernetes Deployment, a Dockerfile and some Terraform. This part adds the `policy/` directory:

```text
orders-api/
├── Dockerfile
├── k8s/
│   └── deployment.yaml
└── policy/
    ├── kubernetes.rego
    ├── kubernetes_test.rego
    └── docker.rego
```

Here is the Deployment as a developer first wrote it. It has an `api` container and a log shipper sidecar that someone copied from a blog post:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders-api
  labels:
    app: orders-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: orders-api
  template:
    metadata:
      labels:
        app: orders-api
    spec:
      containers:
        - name: api
          image: ghcr.io/example/orders-api:1.4.2
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
        - name: log-shipper
          image: fluent/fluent-bit:latest
          securityContext:
            privileged: true
```

It works, and it breaks several rules a platform team would care about. The sidecar runs privileged with full access to the node, it pulls a moving `latest` tag from Docker Hub, neither container has a memory limit, and nothing stops the processes from running as root.

## Install OPA and Conftest

OPA is the policy engine and has the `opa test`, `opa eval` and `opa fmt` commands. Conftest wraps the same engine with parsers for YAML, JSON, HCL, Dockerfiles and more, and with output and exit codes made for CI. This guide uses OPA 1.21.4 and Conftest 0.71.1.

```tabs
{
  "title": "Install OPA and Conftest",
  "tabs": [
    {
      "label": "Linux",
      "lang": "bash",
      "code": "# OPA: one static binary\ncurl -L -o opa https://openpolicyagent.org/downloads/v1.21.4/opa_linux_amd64_static\nchmod 755 opa && sudo mv opa /usr/local/bin/\n\n# Conftest\ncurl -LO https://github.com/open-policy-agent/conftest/releases/download/v0.71.1/conftest_0.71.1_Linux_x86_64.tar.gz\ntar xzf conftest_0.71.1_Linux_x86_64.tar.gz conftest\nsudo mv conftest /usr/local/bin/"
    },
    {
      "label": "macOS",
      "lang": "bash",
      "code": "brew install opa conftest"
    },
    {
      "label": "Windows",
      "lang": "powershell",
      "code": "# OPA\nInvoke-WebRequest -Uri https://openpolicyagent.org/downloads/v1.21.4/opa_windows_amd64.exe -OutFile opa.exe\n\n# Conftest: download conftest_0.71.1_Windows_x86_64.zip from\n# https://github.com/open-policy-agent/conftest/releases and unzip it\nInvoke-WebRequest -Uri https://github.com/open-policy-agent/conftest/releases/download/v0.71.1/conftest_0.71.1_Windows_x86_64.zip -OutFile conftest.zip\nExpand-Archive conftest.zip -DestinationPath ."
    }
  ]
}
```

On ARM machines, replace `amd64` with `arm64` in the OPA file name and `x86_64` with `arm64` in the Conftest file name. Pin the versions in CI rather than downloading `latest`, so a new release cannot change your results without a pull request. [Part 4](/guides/security-gates/04-cicd-integration#h2-pin-and-verify-the-gate-tools) shows how to verify the downloads before you run them.

```terminal
{
  "title": "check the versions",
  "prompt": "$",
  "steps": [
    {
      "cmd": "opa version",
      "output": "Version: 1.21.4\nBuild Commit: 05c845177c80747a2aabb607f9318f981993cc76-dirty\nBuild Timestamp: 2026-10-23T13:00:56Z\nBuild Hostname:\nGo Version: go1.27.3\nPlatform: linux/arm64\nRego Version: v1\nWebAssembly: available"
    },
    {
      "cmd": "conftest --version",
      "output": "Conftest: 0.71.1\nOPA: 1.21.1"
    }
  ]
}
```

Conftest embeds its own copy of OPA, so its OPA version can trail the standalone binary by a patch release.

## Rego v1: What Changed in OPA 1.0

OPA 1.0 (December 2024) made the **Rego v1** syntax the default. Most Rego examples on the internet, including many vendor docs and older versions of this guide, still use the old syntax and no longer load:

```rego
package main

deny[msg] {
  input.kind == "Deployment"
  msg := "old syntax"
}
```

```bash
opa check old-policy/
```

```text
2 errors occurred during loading:
old-policy/old.rego:3: rego_parse_error: `if` keyword is required before rule body
old-policy/old.rego:3: rego_parse_error: `contains` keyword is required for partial set rules
```

The rules in Rego v1:

- A rule body needs the `if` keyword: `allow if { ... }`.
- A rule that builds a set of messages needs `contains`: `deny contains msg if { ... }`.
- `in`, `every`, `if` and `contains` are keywords, so `import future.keywords` and `import rego.v1` are no longer needed.
- `opa fmt` rewrites code to the v1 style, and `opa check --strict` catches unused variables and imports.

If you have a large set of old policies, `opa check --v0-compatible` and `opa run --v0-compatible` load them while you migrate, and `opa fmt --v0-v1` rewrites a v0 file into v1 syntax.

## Write a Kubernetes Policy

Conftest looks for rules named `deny`, `violation` and `warn`. A `deny` or `violation` result fails the check and `warn` only prints a warning. Put the Kubernetes rules in their own package so they do not run against other file types:

```rego
package kubernetes

workload_kinds := {"Deployment", "StatefulSet", "DaemonSet", "Job"}

# The Pod spec lives in a different place for Pods and for workloads.
pod_spec := input.spec.template.spec if input.kind in workload_kinds

pod_spec := input.spec if input.kind == "Pod"

name := sprintf("%s/%s", [input.kind, input.metadata.name])

containers contains c if some c in pod_spec.containers

containers contains c if some c in pod_spec.initContainers

deny contains msg if {
	some c in containers
	c.securityContext.privileged == true
	msg := sprintf("%s: container %q must not run privileged", [name, c.name])
}

deny contains msg if {
	some c in containers
	not runs_as_non_root(c)
	msg := sprintf("%s: container %q must set runAsNonRoot: true", [name, c.name])
}

deny contains msg if {
	some c in containers
	not c.resources.limits.memory
	msg := sprintf("%s: container %q has no memory limit", [name, c.name])
}

deny contains msg if {
	some c in containers
	not startswith(c.image, "ghcr.io/example/")
	msg := sprintf("%s: image %q is not from ghcr.io/example/", [name, c.image])
}

deny contains msg if {
	some c in containers
	not pinned(c.image)
	msg := sprintf("%s: image %q must use a version tag or a digest, not latest", [name, c.image])
}

warn contains msg if {
	some c in containers
	not c.securityContext.readOnlyRootFilesystem
	msg := sprintf("%s: container %q should set readOnlyRootFilesystem: true", [name, c.name])
}

# runAsNonRoot can be set on the container or inherited from the Pod.
runs_as_non_root(c) if c.securityContext.runAsNonRoot == true

runs_as_non_root(c) if {
	pod_spec.securityContext.runAsNonRoot == true
	not c.securityContext.runAsNonRoot == false
}

pinned(image) if contains(image, "@sha256:")

pinned(image) if {
	not contains(image, "@")
	parts := split(image, "/")
	tag := split(parts[count(parts) - 1], ":")
	count(tag) == 2
	tag[1] != "latest"
}
```

A few things to notice:

- Each `deny contains msg if` block is one rule. If every line in the body is true for some container, the message goes into the `deny` set.
- `some c in containers` iterates; the rule fires once per matching container, so the developer sees every problem in one run.
- `not c.resources.limits.memory` is true when the field is missing. Missing fields are the most common way for a policy to pass by accident, so test them (see below).
- The messages name the object and the container. A gate that says only "policy failed" sends people to read Rego.

Run it against the Deployment:

```terminal
{
  "title": "conftest test",
  "prompt": "$",
  "steps": [
    {
      "cmd": "conftest test --namespace kubernetes k8s/deployment.yaml",
      "output": "WARN - k8s/deployment.yaml - kubernetes - Deployment/orders-api: container \"api\" should set readOnlyRootFilesystem: true\nWARN - k8s/deployment.yaml - kubernetes - Deployment/orders-api: container \"log-shipper\" should set readOnlyRootFilesystem: true\nFAIL - k8s/deployment.yaml - kubernetes - Deployment/orders-api: container \"api\" has no memory limit\nFAIL - k8s/deployment.yaml - kubernetes - Deployment/orders-api: container \"api\" must set runAsNonRoot: true\nFAIL - k8s/deployment.yaml - kubernetes - Deployment/orders-api: container \"log-shipper\" has no memory limit\nFAIL - k8s/deployment.yaml - kubernetes - Deployment/orders-api: container \"log-shipper\" must not run privileged\nFAIL - k8s/deployment.yaml - kubernetes - Deployment/orders-api: container \"log-shipper\" must set runAsNonRoot: true\nFAIL - k8s/deployment.yaml - kubernetes - Deployment/orders-api: image \"fluent/fluent-bit:latest\" is not from ghcr.io/example/\nFAIL - k8s/deployment.yaml - kubernetes - Deployment/orders-api: image \"fluent/fluent-bit:latest\" must use a version tag or a digest, not latest\n\n9 tests, 0 passed, 2 warnings, 7 failures, 0 exceptions"
    }
  ]
}
```

Conftest exits with code 1 when any `deny` fires, which fails the CI job. Warnings do not change the exit code unless you add `--fail-on-warn`.

Now fix the manifest. Mirror the log shipper into your own registry with a pinned version, drop `privileged`, add limits, set a Pod-level security context, and give the `api` container a writable `emptyDir` at `/tmp`, because Spring Boot's embedded Tomcat writes temporary files and the root file system is now read-only:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders-api
  labels:
    app: orders-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: orders-api
  template:
    metadata:
      labels:
        app: orders-api
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: api
          image: ghcr.io/example/orders-api:1.4.2
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              memory: 512Mi
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ['ALL']
          volumeMounts:
            - name: tmp
              mountPath: /tmp
        - name: log-shipper
          image: ghcr.io/example/fluent-bit:5.1.5
          resources:
            limits:
              memory: 128Mi
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ['ALL']
      volumes:
        - name: tmp
          emptyDir: {}
```

```terminal
{
  "title": "conftest test",
  "prompt": "$",
  "steps": [
    {
      "cmd": "conftest test --namespace kubernetes k8s/deployment.yaml",
      "output": "6 tests, 6 passed, 0 warnings, 0 failures, 0 exceptions"
    }
  ]
}
```

Conftest counts results rather than rules: the failing run above reports nine results from six rules, because one rule can fire once per container.

## Test Your Policies

A policy is code, and a bug in it either blocks good changes or lets bad ones through without a sound. OPA runs any rule whose name starts with `test_` as a unit test. `with input as` replaces the input for one expression, so you can build a known-good object once and break it one field at a time:

```rego
package kubernetes_test

import data.kubernetes

good := {
	"kind": "Deployment",
	"metadata": {"name": "orders-api"},
	"spec": {"template": {"spec": {
		"securityContext": {"runAsNonRoot": true},
		"containers": [{
			"name": "api",
			"image": "ghcr.io/example/orders-api:1.4.2",
			"resources": {"limits": {"memory": "512Mi"}},
			"securityContext": {"readOnlyRootFilesystem": true},
		}],
	}}},
}

test_compliant_deployment_passes if {
	count(kubernetes.deny) == 0 with input as good
	count(kubernetes.warn) == 0 with input as good
}

test_privileged_container_is_denied if {
	bad := json.patch(good, [{
		"op": "add",
		"path": "/spec/template/spec/containers/0/securityContext/privileged",
		"value": true,
	}])
	msgs := kubernetes.deny with input as bad
	`Deployment/orders-api: container "api" must not run privileged` in msgs
}

test_container_cannot_override_pod_run_as_non_root if {
	bad := json.patch(good, [{
		"op": "add",
		"path": "/spec/template/spec/containers/0/securityContext/runAsNonRoot",
		"value": false,
	}])
	msgs := kubernetes.deny with input as bad
	`Deployment/orders-api: container "api" must set runAsNonRoot: true` in msgs
}

test_missing_memory_limit_is_denied if {
	bad := json.remove(good, ["spec/template/spec/containers/0/resources"])
	msgs := kubernetes.deny with input as bad
	`Deployment/orders-api: container "api" has no memory limit` in msgs
}

test_latest_tag_is_denied if {
	bad := json.patch(good, [{
		"op": "replace",
		"path": "/spec/template/spec/containers/0/image",
		"value": "ghcr.io/example/orders-api:latest",
	}])
	count(kubernetes.deny) == 1 with input as bad
}

test_digest_is_allowed if {
	ok := json.patch(good, [{
		"op": "replace",
		"path": "/spec/template/spec/containers/0/image",
		"value": "ghcr.io/example/orders-api@sha256:0d3f5c1e9a4b7c2d8e6f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d",
	}])
	count(kubernetes.deny) == 0 with input as ok
}
```

```terminal
{
  "title": "opa test",
  "prompt": "$",
  "steps": [
    {
      "cmd": "opa test policy/ -v",
      "output": "policy/kubernetes_test.rego:59:\ndata.kubernetes_test.test_digest_is_allowed: PASS (79.693631ms)\npolicy/kubernetes_test.rego:50:\ndata.kubernetes_test.test_latest_tag_is_denied: PASS (81.140555ms)\npolicy/kubernetes_test.rego:44:\ndata.kubernetes_test.test_missing_memory_limit_is_denied: PASS (84.934668ms)\npolicy/kubernetes_test.rego:24:\ndata.kubernetes_test.test_privileged_container_is_denied: PASS (84.982353ms)\npolicy/kubernetes_test.rego:34:\ndata.kubernetes_test.test_container_cannot_override_pod_run_as_non_root: PASS (7.50419ms)\npolicy/kubernetes_test.rego:19:\ndata.kubernetes_test.test_compliant_deployment_passes: PASS (3.864482ms)\n--------------------------------------------------------------------------------\nPASS: 6/6"
    },
    {
      "comment": "coverage shows which policy lines no test reached",
      "cmd": "opa test policy/ --coverage --format=json | jq '.coverage'",
      "output": "92.47311827956989"
    }
  ]
}
```

Run `opa fmt --write policy/` and `opa check --strict policy/` before you commit, and run `opa test` in CI next to the policy check itself. `conftest verify --policy policy/` runs the same tests through Conftest if you prefer one tool.

:::warning
`opa eval` is a debugging tool, not a gate. It exits with code 0 even when `deny` contains messages, because the query itself succeeded. If you call `opa eval` from a pipeline, add `--fail-defined` and query for single messages (`data.kubernetes.deny[msg]`), or use Conftest.
:::

```terminal
{
  "title": "opa eval exit codes",
  "prompt": "$",
  "steps": [
    {
      "comment": "a deliberately broken copy of the manifest",
      "cmd": "sed 's/runAsNonRoot: true/runAsNonRoot: false/' k8s/deployment.yaml > bad.yaml"
    },
    {
      "cmd": "opa eval -i bad.yaml -d policy/ --format pretty 'data.kubernetes.deny'; echo \"exit code: $?\"",
      "output": "[\n  \"Deployment/orders-api: container \\\"api\\\" must set runAsNonRoot: true\",\n  \"Deployment/orders-api: container \\\"log-shipper\\\" must set runAsNonRoot: true\"\n]\nexit code: 0"
    },
    {
      "cmd": "opa eval -i bad.yaml -d policy/ --fail-defined 'data.kubernetes.deny[msg]' > /dev/null; echo \"exit code: $?\"",
      "output": "exit code: 1"
    }
  ]
}
```

## A Dockerfile Policy

Conftest parses a file named `Dockerfile` into a list of instructions, each with `Cmd`, `Value`, `Flags` and the build `Stage`. Here is the `orders-api` Dockerfile:

```dockerfile
FROM eclipse-temurin:21-jre
WORKDIR /app
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v2.32.0/opentelemetry-javaagent.jar /app/otel.jar
COPY build/libs/orders-api.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-javaagent:/app/otel.jar", "-jar", "app.jar"]
```

And three rules for it: base images pinned by digest, a numeric non-root `USER` in the final stage, and no remote `ADD` without a checksum:

```rego
package docker

final_stage := max({i.Stage | some i in input})

deny contains msg if {
	some i in input
	i.Cmd == "from"
	image := i.Value[0]
	image != "scratch"
	not earlier_stage(image, i.Stage)
	not contains(image, "@sha256:")
	msg := sprintf("FROM %s must be pinned by digest", [image])
}

# FROM <name> may reuse a stage that an earlier FROM ... AS <name> declared.
earlier_stage(name, stage) if {
	some j in input
	j.Cmd == "from"
	j.Stage < stage
	count(j.Value) == 3
	lower(j.Value[1]) == "as"
	lower(j.Value[2]) == lower(name)
}

deny contains msg if {
	not final_user
	msg := "the final stage must set a non-root USER"
}

# Kubernetes can only check runAsNonRoot against a numeric user, and a name or a
# variable could still resolve to root, so require a literal UID above 0.
deny contains msg if {
	not regex.match(`^[1-9][0-9]*$`, split(final_user, ":")[0])
	msg := sprintf("the final stage runs as %s: use a numeric, non-zero USER such as 10001", [final_user])
}

# The last USER instruction of the final stage decides who the container runs as.
final_user := users[count(users) - 1] if {
	users := [i.Value[0] | some i in input; i.Stage == final_stage; i.Cmd == "user"]
	count(users) > 0
}

deny contains msg if {
	some i in input
	i.Cmd == "add"
	not has_checksum(i)
	some src in array.slice(i.Value, 0, count(i.Value) - 1)
	regex.match(`^https?://`, src)
	msg := sprintf("ADD %s downloads without a checksum: use ADD --checksum", [src])
}

has_checksum(i) if {
	some flag in i.Flags
	startswith(flag, "--checksum=")
}
```

```terminal
{
  "title": "conftest test",
  "prompt": "$",
  "steps": [
    {
      "cmd": "conftest test --namespace docker Dockerfile",
      "output": "FAIL - Dockerfile - docker - ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v2.32.0/opentelemetry-javaagent.jar downloads without a checksum: use ADD --checksum\nFAIL - Dockerfile - docker - FROM eclipse-temurin:21-jre must be pinned by digest\nFAIL - Dockerfile - docker - the final stage must set a non-root USER\n\n4 tests, 1 passed, 0 warnings, 3 failures, 0 exceptions"
    }
  ]
}
```

The fixed Dockerfile pins the base image by digest and the Java agent by its published SHA-256, and runs as an unprivileged user. `--chmod=644` matters here: a file that `ADD` downloads from a URL gets mode 600 and belongs to root, so user 10001 could not read the agent. Dependabot and Renovate both update digest pins, so pinning does not mean you stop getting base image updates.

```dockerfile
FROM eclipse-temurin:21-jre-noble@sha256:35501d3f93173b420ac9001658eb68157e813316b865087e345c187fca422c4c
WORKDIR /app
ADD --chmod=644 --checksum=sha256:f787eb6c7f3d18e69a431e108a15278d25ee37f83d68b678f621e063f3988f82 \
    https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v2.32.0/opentelemetry-javaagent.jar /app/otel.jar
COPY build/libs/orders-api.jar app.jar
USER 10001
EXPOSE 8080
ENTRYPOINT ["java", "-javaagent:/app/otel.jar", "-jar", "app.jar"]
```

```terminal
{
  "title": "conftest test",
  "prompt": "$",
  "steps": [
    {
      "cmd": "conftest test --namespace docker Dockerfile",
      "output": "4 tests, 4 passed, 0 warnings, 0 failures, 0 exceptions"
    }
  ]
}
```

## Roll Out With Warnings First

Start each new rule as `warn`, check how many repositories it would break, fix those or agree on exceptions, then change `warn` to `deny`. Conftest has two switches that help:

- `--fail-on-warn` turns warnings into failures, useful on the main branch while pull requests only warn.
- `--output github` prints results as GitHub Actions annotations on the checked file (Conftest has no line numbers for these messages, so they point at the file); `--output sarif` and `--output junit` feed code scanning and test reports.

Conftest also supports **exceptions** as code: an `exception` rule whose result contains `"privileged"` switches off a rule named `deny_privileged` for the inputs it matches, and the summary counts it as an exception instead of a failure. Keep exceptions in the same pull request review flow as the policies, so every skip has an author and a reason.

## Enforce in the Cluster: Admission Control

CI checks only what goes through CI. Admission control runs inside the Kubernetes API server, after authentication and before the object is stored, so it also sees changes made with `kubectl`, Helm and controllers. You have four main options in October 2026:

|                                     | Pod Security Admission                                                              | ValidatingAdmissionPolicy                          | Kyverno 1.19                                                         | OPA Gatekeeper 3.23                   |
| ----------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------- |
| Install                             | Built in                                                                            | Built in, GA since Kubernetes 1.30                 | Helm chart, runs as a webhook                                        | Helm chart, runs as a webhook         |
| Policy language                     | Three fixed profiles                                                                | CEL expressions                                    | CEL (`ValidatingPolicy`); YAML patterns in the older `ClusterPolicy` | Rego or CEL in a `ConstraintTemplate` |
| Mutate or generate objects          | No                                                                                  | MutatingAdmissionPolicy, GA since Kubernetes 1.36  | Yes, both                                                            | Mutation only                         |
| Verify image signatures             | No                                                                                  | No                                                 | Yes (`ImageValidatingPolicy`)                                        | Through an external data provider     |
| Find violations in existing objects | A server-side dry run of a new `enforce` label lists the Pods that would violate it | No: `Warn` and `Audit` report on new requests only | Background scans write PolicyReports                                 | The audit controller lists violations |
| Test offline                        | Not needed                                                                          | `kyverno apply`                                    | `kyverno apply`, `kyverno test`                                      | `gator test`, `gator verify`          |

Start with **Pod Security Admission**: label each namespace with `pod-security.kubernetes.io/enforce: baseline` to block privileged containers and host namespaces without installing anything, or with `restricted` to also require non-root users, dropped capabilities and a seccomp profile. Add a policy engine for the rules that are specific to you, such as allowed registries, required labels and resource limits.

The same rule, "no privileged containers", in the three engines:

```tabs
{
  "title": "Deny privileged containers",
  "tabs": [
    {
      "label": "ValidatingAdmissionPolicy",
      "lang": "yaml",
      "code": "apiVersion: admissionregistration.k8s.io/v1\nkind: ValidatingAdmissionPolicy\nmetadata:\n  name: disallow-privileged\nspec:\n  failurePolicy: Fail\n  matchConstraints:\n    resourceRules:\n      - apiGroups: [\"\"]\n        apiVersions: [v1]\n        operations: [CREATE, UPDATE]\n        resources: [pods]\n      - apiGroups: [apps]\n        apiVersions: [v1]\n        operations: [CREATE, UPDATE]\n        resources: [deployments, statefulsets, daemonsets]\n  variables:\n    - name: podSpec\n      expression: \"object.kind == 'Pod' ? object.spec : object.spec.template.spec\"\n    - name: containers\n      expression: >-\n        variables.podSpec.containers +\n        (has(variables.podSpec.initContainers) ? variables.podSpec.initContainers : [])\n  validations:\n    - expression: >-\n        variables.containers.all(c, !has(c.securityContext) ||\n          !has(c.securityContext.privileged) || !c.securityContext.privileged)\n      messageExpression: >-\n        \"privileged containers are not allowed: \" +\n        variables.containers.filter(c, has(c.securityContext) &&\n          has(c.securityContext.privileged) && c.securityContext.privileged)\n        .map(c, c.name).join(\", \")\n---\napiVersion: admissionregistration.k8s.io/v1\nkind: ValidatingAdmissionPolicyBinding\nmetadata:\n  name: disallow-privileged\nspec:\n  policyName: disallow-privileged\n  validationActions: [Deny]"
    },
    {
      "label": "Kyverno ValidatingPolicy",
      "lang": "yaml",
      "code": "apiVersion: policies.kyverno.io/v1\nkind: ValidatingPolicy\nmetadata:\n  name: disallow-privileged\nspec:\n  validationActions: [Deny]\n  matchConstraints:\n    resourceRules:\n      - apiGroups: [\"\"]\n        apiVersions: [v1]\n        operations: [CREATE, UPDATE]\n        resources: [pods]\n  variables:\n    - name: containers\n      expression: >-\n        object.spec.containers +\n        (has(object.spec.initContainers) ? object.spec.initContainers : [])\n  validations:\n    - expression: >-\n        variables.containers.all(c,\n          !has(c.securityContext) || !has(c.securityContext.privileged) ||\n          !c.securityContext.privileged)\n      message: Privileged containers are not allowed"
    },
    {
      "label": "Gatekeeper",
      "lang": "yaml",
      "code": "apiVersion: templates.gatekeeper.sh/v1\nkind: ConstraintTemplate\nmetadata:\n  name: k8sdenyprivileged\nspec:\n  crd:\n    spec:\n      names:\n        kind: K8sDenyPrivileged\n  targets:\n    - target: admission.k8s.gatekeeper.sh\n      code:\n        - engine: Rego\n          source:\n            version: \"v1\"\n            rego: |\n              package k8sdenyprivileged\n\n              violation contains {\"msg\": msg} if {\n                spec := input.review.object.spec\n                some c in array.concat(object.get(spec, \"containers\", []), object.get(spec, \"initContainers\", []))\n                c.securityContext.privileged == true\n                msg := sprintf(\"Privileged container is not allowed: %s\", [c.name])\n              }\n---\napiVersion: constraints.gatekeeper.sh/v1beta1\nkind: K8sDenyPrivileged\nmetadata:\n  name: deny-privileged\nspec:\n  enforcementAction: deny\n  match:\n    kinds:\n      - apiGroups: [\"\"]\n        kinds: [\"Pod\"]"
    }
  ]
}
```

Four details that trip people up:

- **ValidatingAdmissionPolicy has no auto-generation.** If you match only `pods`, a bad Deployment is accepted and then its ReplicaSet fails to create Pods, so the error shows up as events instead of on the `kubectl apply`. The policy above matches the workload kinds too, and uses a variable to find the Pod spec in either shape.
- **Kyverno generates the workload rules for you.** A `ValidatingPolicy` that matches Pods is applied to Deployments, StatefulSets, Jobs and the other Pod controllers automatically, so the developer gets the error on the Deployment.
- **Check init containers too.** All three versions check `containers` and `initContainers`; a policy that looks only at `containers` lets a privileged init container through. Ephemeral containers added with `kubectl debug` need two more changes: add `spec.ephemeralContainers` to the list of containers the policy checks, and match the `pods/ephemeralcontainers` subresource, through which they are added.
- **Gatekeeper parses template Rego as v0 by default.** Without `version: "v1"` under `source`, the v1 syntax above fails to load. Gatekeeper also accepts CEL through the `K8sNativeValidation` engine, and the [Gatekeeper policy library](https://github.com/open-policy-agent/gatekeeper-library) ships most templates with both. Since Gatekeeper 3.20, templates with CEL code also generate a native ValidatingAdmissionPolicy by default, so the API server can enforce them without calling the webhook.

## Test Admission Policies Offline

You do not need a cluster to test these policies. The Kyverno CLI evaluates both Kyverno policies and native ValidatingAdmissionPolicies against YAML files, and `gator` runs Gatekeeper templates. Here they are against the original, privileged version of the Deployment:

For Gatekeeper, a `Suite` file lists sample objects and the result you expect for each, which makes it a regression test for the template:

```yaml
apiVersion: test.gatekeeper.sh/v1alpha1
kind: Suite
metadata:
  name: deny-privileged
tests:
  - name: deny-privileged
    template: template.yaml
    constraint: constraint.yaml
    cases:
      - name: privileged-pod-is-rejected
        object: samples/privileged-pod.yaml
        assertions:
          - violations: yes
      - name: privileged-init-container-is-rejected
        object: samples/privileged-init-container.yaml
        assertions:
          - violations: yes
      - name: restricted-pod-is-allowed
        object: samples/restricted-pod.yaml
        assertions:
          - violations: no
```

```terminal
{
  "title": "offline admission tests",
  "prompt": "$",
  "steps": [
    {
      "comment": "native ValidatingAdmissionPolicy, evaluated by the Kyverno CLI",
      "cmd": "kyverno apply admission/vap.yaml --resource admission/bad-deployment.yaml --remove-color",
      "output": "Applying 1 policy rule(s) to 1 resource(s)...\npolicy disallow-privileged -> resource default/Deployment/orders-api failed:\n1 - disallow-privileged privileged containers are not allowed: log-shipper\n\npass: 0, fail: 1, warn: 0, error: 0, skip: 0"
    },
    {
      "comment": "Kyverno ValidatingPolicy: matches Pods, auto-generated for the Deployment",
      "cmd": "kyverno apply admission/kyverno-policy.yaml --resource admission/bad-deployment.yaml --remove-color",
      "output": "Applying 1 policy rule(s) to 1 resource(s)...\npolicy disallow-privileged -> resource default/Deployment/orders-api failed:\n1 -  Privileged containers are not allowed\n\npass: 0, fail: 1, warn: 0, error: 0, skip: 0"
    },
    {
      "comment": "Gatekeeper template, constraint and test suite",
      "cmd": "gator verify admission/gatekeeper/",
      "output": "ok\tadmission/gatekeeper/suite.yaml\t0.048s\nPASS"
    }
  ]
}
```

The same commands run in CI on every change to `admission/`. Use `kyverno test` with a `kyverno-test.yaml` file when you want expected results per resource, like the Gatekeeper suite.

:::note
Kyverno 1.19 prints a deprecation warning for the older `kyverno.io/v1` `ClusterPolicy` kind: "migrate to ValidatingPolicy, MutatingPolicy, GeneratingPolicy or ImageValidatingPolicy (policies.kyverno.io)". `ClusterPolicy` still works in 1.19, but the Kyverno project plans to remove it in 1.20. Write new policies in the CEL-based kinds, and follow Kyverno's [migration guide](https://kyverno.io/docs/guides/migration-to-cel/) for existing ones.
:::

## Audit Before You Enforce

Every engine can report violations without blocking them. Use that mode for a week or two on a new policy, read what it would have blocked, then switch to enforcement:

| Engine                     | Report only                                           | Enforce                                    |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------ |
| ValidatingAdmissionPolicy  | `validationActions: [Warn, Audit]` on the binding     | `validationActions: [Deny]`                |
| Kyverno `ValidatingPolicy` | `validationActions: [Audit]`                          | `validationActions: [Deny]`                |
| Gatekeeper                 | `enforcementAction: dryrun` or `warn`                 | `enforcementAction: deny`                  |
| Pod Security Admission     | `pod-security.kubernetes.io/warn` and `/audit` labels | `pod-security.kubernetes.io/enforce` label |

`Warn` sends the message back to `kubectl` as a warning, so developers see it in their terminal while nothing breaks.

## Exceptions

Some workloads need what your policy forbids. A CNI plugin or a node monitoring agent may need privileged containers in `kube-system`. Handle that in the policy objects, not by disabling the policy:

- **ValidatingAdmissionPolicy**: add `matchConditions` (CEL) to the policy, or a `namespaceSelector` under the policy's `matchConstraints` or the binding's `matchResources`.
- **Kyverno**: create a `PolicyException` for the named policy and resources; you can restrict who may create exceptions with RBAC.
- **Gatekeeper**: use `excludedNamespaces` or `namespaceSelector` in the constraint's `match`, or the cluster-wide `Config` exemptions.

Whatever you use, keep exceptions in Git with an owner and a reason, and review them like any other change.

## Common Mistakes

- **Copying v0 Rego** from old examples into OPA 1.x. It fails with "`if` keyword is required before rule body". Run `opa fmt --v0-v1` on it.
- **Using `opa eval` as a gate** without `--fail-defined`; it passes even when `deny` has messages.
- **Policies that pass on missing fields.** `c.securityContext.privileged == true` is undefined (not false) when the field is missing, which is what you want for "deny if true", but the opposite for "require this field". Write a test for the missing case.
- **Matching only Pods in a ValidatingAdmissionPolicy**, so Deployment authors see no error.
- **Enforcing on day one.** Run new policies as warnings or audit first.
- **Putting the only copy of a rule in the cluster.** Run the same rules in CI so developers find out in the pull request, not during the deploy.

## Summary

- Write policies in Rego v1 (`deny contains msg if { ... }`), one package per input type, with messages that name the object and the fix.
- Test them with `opa test`, check them with `opa fmt` and `opa check --strict`, and run them with `conftest test` in CI.
- In the cluster, start with Pod Security Admission, then add ValidatingAdmissionPolicy, Kyverno or Gatekeeper for your own rules. Test those offline with `kyverno apply` and `gator verify`.
- Roll out new rules as warnings or in audit mode, and keep exceptions in Git.

Next, [Vulnerability Gates](/guides/security-gates/02-vulnerability-gates) applies the same idea to known CVEs in your dependencies, including a Rego policy that gates on exploited vulnerabilities rather than on CVSS alone.

## Keep Learning

- [Kubernetes Security Checklist](/checklists/kubernetes-security)
- [Implementing Pod Security Standards in Kubernetes](/flashcards/pod-security-standards-kubernetes) (flashcards)
- [Docker Security Best Practices](/posts/docker-security-best-practices)
- [Interview question: security architecture and DevSecOps](/interview-questions/senior/security-architecture)
