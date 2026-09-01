---
title: 'Go Is Not Just for CLIs. It Runs the Cloud Native Control Plane'
excerpt: 'Docker, Kubernetes, etcd, Terraform, Vault, Prometheus, CoreDNS, Caddy, MinIO, CockroachDB: we pulled the real language breakdown of 17 infrastructure projects from GitHub, explain why Go keeps winning the control plane, list where it does not, and build a static cross-compiled binary to show the reason in 5 MB.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-02'
publishedAt: '2026-09-02T10:00:00Z'
updatedAt: '2026-09-02T10:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Go
  - Kubernetes
  - Docker
  - Cloud Native
  - DevOps
---

There is a meme that goes around every few months: a list of infrastructure tools, each followed by "is Go", ending with "still, you think Go is just for CLIs." It is funny because it is true, and it is worth taking seriously because the reasons behind it decide what a DevOps engineer should learn to read. So instead of repeating the list, we measured it. The language statistics below come from the GitHub API for each project's main repository on September 1, 2026, and the build demo at the end runs for real.

## TLDR

- Of 17 projects that define the cloud native stack, 16 are majority Go, most above 90%. The exception, Grafana, is a Go backend under a TypeScript frontend.
- The reasons are concrete, not fashion: one static binary, cross-compilation from one machine, goroutines for daemons that juggle thousands of connections, sub-minute compile cycles, and the gravitational pull of Docker and Kubernetes having chosen Go first.
- Go does not own everything. The fastest data paths (nginx, HAProxy, Redis, Envoy) are C and C++, the JVM still runs Kafka, Elasticsearch, and Jenkins, Ansible is Python, and Rust is taking the newest proxies and pipelines (Linkerd's proxy, Vector, Cloudflare's Pingora).
- For DevOps engineers the practical takeaway is not "rewrite your scripts in Go" but "learn enough Go to read the tools you operate." The upgrade path from reading Kubernetes source to writing an operator is short.

## Prerequisites

- Nothing to install to follow the argument; Go 1.22+ if you want to run the build demo at the end
- Familiarity with at least a few of the tools named below

## The list, measured

Everyone knows the meme list; here is what the repositories say. Percentages are bytes of code by language from the GitHub API, top language per project:

```chart
{
  "type": "bar",
  "title": "Share of Go in the main repository, by bytes of code",
  "unit": "%",
  "caption": "GitHub API language statistics, main repositories, 2026-09-01. Grafana is the one project where another language (TypeScript, 48.6%) leads.",
  "rows": [
    { "label": "CoreDNS", "value": 99.9 },
    { "label": "Terraform", "value": 99.7 },
    { "label": "MinIO", "value": 99.0 },
    { "label": "Helm", "value": 98.4 },
    { "label": "Istio", "value": 98.1 },
    { "label": "Caddy", "value": 98.1 },
    { "label": "containerd", "value": 97.8 },
    { "label": "Kubernetes", "value": 97.7 },
    { "label": "Docker (moby)", "value": 97.3 },
    { "label": "etcd", "value": 96.0 },
    { "label": "Hugo", "value": 93.8 },
    { "label": "Traefik", "value": 93.0 },
    { "label": "CockroachDB", "value": 91.4 },
    { "label": "Prometheus", "value": 88.3 },
    { "label": "Cilium", "value": 88.3 },
    { "label": "Nomad", "value": 82.1 },
    { "label": "Argo CD", "value": 80.4 },
    { "label": "Consul", "value": 76.0 },
    { "label": "Vault", "value": 66.2 },
    { "label": "Grafana", "value": 45.4 }
  ]
}
```

Three things the numbers say that the meme does not:

- **The core is Go even where the total is not.** Vault (66% Go) and Consul (76%) carry large JavaScript and SCSS shares because they ship web UIs; the servers are Go. Grafana is the honest outlier: the product is a TypeScript frontend and a Go backend in roughly equal measure, so "Grafana is Go" is half true.
- **The projects are polyglot at the edges.** Cilium is 10% C because its datapath is eBPF programs; Hugo carries 2.5% C for a bundled library; CockroachDB has 3% Starlark for Bazel build files. Go owns the control logic, not every byte.
- **The pattern holds across vendors and foundations.** HashiCorp, the CNCF projects, Grafana Labs, MinIO, and Cockroach Labs made the same choice independently, which is the interesting part.

## Why Go keeps winning the control plane

None of these teams picked Go because it is elegant. They picked it because the operational properties match what infrastructure software has to do.

**One static binary.** A Go program compiles to a single executable with no runtime to install and, with `CGO_ENABLED=0`, no shared libraries at all. `kubectl`, `terraform`, and `caddy` are downloaded as one file and run. The demo below shows what that looks like: a working HTTP server in about 5 MB, `ldd` reporting "not a dynamic executable". For tools that must run on a fleet of hosts you do not fully control, that is the whole ballgame. Compare distributing a Python tool (interpreter version, virtualenv, native wheels) or a JVM service (JDK, heap flags, startup time).

**Cross-compile from one laptop.** `GOOS=linux GOARCH=arm64 go build` produces an ARM Linux binary from a Mac in the same command that produced the x86 one. Release pipelines for these tools are a matrix of environment variables, not a fleet of build machines. This is why every one of them ships darwin, linux, and windows builds for two or three architectures on day one.

**Goroutines fit daemons.** A control-plane component holds thousands of long-lived connections: watch streams in the API server, gossip in Consul, scrape targets in Prometheus, backends behind Traefik. Goroutines make "one lightweight thread per connection" the natural design instead of a callback pyramid or a thread pool tuned by hand, and channels give the coordination primitives. The Kubernetes controller pattern (watch, queue, reconcile) is idiomatic Go.

**The compile loop is fast.** Kubernetes is one of the largest Go codebases in existence and still builds in minutes; a single package rebuilds in seconds. Teams that ship weekly, with hundreds of contributors, feel this daily.

**A garbage collector that is good enough, and predictable.** Infrastructure code allocates constantly (parsing YAML, JSON, protobuf), and Go's low-pause GC keeps tail latency acceptable for control-plane work without manual memory management. It is not free (see the counter-list), but it is the right trade for coordination software.

**Gravity.** Docker chose Go in 2013; Kubernetes followed in 2014; client libraries, CRD tooling, controller-runtime, and the CNCF's project template all came out Go-shaped. By 2018, starting an infrastructure project in anything else meant re-implementing the ecosystem's plumbing. Gravity is a real technical reason once it exists.

## Where Go does not run the show

The meme stops at the control plane on purpose, because the data plane and the older layers are a different story:

```chart
{
  "type": "bar",
  "title": "Primary language of infrastructure projects that are not Go",
  "unit": "%",
  "caption": "GitHub API language statistics, 2026-09-01. Redis counts 28.6% Tcl because its test suite is Tcl; the server is C.",
  "rows": [
    { "label": "nginx (C)", "value": 97.7, "series": "C / C++" },
    { "label": "HAProxy (C)", "value": 96.1, "series": "C / C++" },
    { "label": "Envoy (C++)", "value": 87.7, "series": "C / C++" },
    { "label": "Redis (C)", "value": 68.2, "series": "C / C++" },
    { "label": "Elasticsearch (Java)", "value": 99.2, "series": "JVM" },
    { "label": "Kafka (Java)", "value": 90.0, "series": "JVM" },
    { "label": "Jenkins (Java)", "value": 87.2, "series": "JVM" },
    { "label": "Ansible (Python)", "value": 86.6, "series": "Python" },
    { "label": "Pingora (Rust)", "value": 100.0, "series": "Rust" },
    { "label": "Linkerd2 proxy (Rust)", "value": 99.5, "series": "Rust" },
    { "label": "Vector (Rust)", "value": 65.3, "series": "Rust" }
  ],
  "series": [
    { "name": "C / C++", "color": "#64748B" },
    { "name": "JVM", "color": "#f59e0b" },
    { "name": "Python", "color": "#3b82f6" },
    { "name": "Rust", "color": "#ef4444" }
  ]
}
```

- **The hot data path is still C and C++.** nginx, HAProxy, Redis, and Envoy sit where every byte and every microsecond count, and a garbage collector is a cost they refuse to pay. Notice that Envoy, the proxy inside Istio, is C++ while Istio's control plane is 98% Go: the split inside one product is the cleanest illustration of the rule.
- **The JVM runs the big stateful systems.** Kafka, Elasticsearch, and Jenkins predate the Go wave and carry ecosystems too large to move. They cost more memory and startup time, and they are not going anywhere.
- **Python owns configuration management and glue.** Ansible is Python because its job is to be extended by people who are not systems programmers, and that audience is Python's.
- **Rust is winning the new data paths.** Linkerd rewrote its proxy from Go to Rust for exactly the latency and memory reasons above; Vector (observability pipelines) and Cloudflare's Pingora (which replaced nginx inside Cloudflare) chose Rust from the start. Where Go's GC is a cost, the new projects reach for Rust; where Go's productivity matters more, they still reach for Go.

The picture in 2026 is therefore two layers: Go for the control plane (scheduling, coordination, configuration, APIs) and C, C++, or increasingly Rust for the data plane (bytes on the wire, storage engines). A DevOps engineer touches the first layer constantly and the second rarely.

## The five-megabyte proof

The argument about static binaries is easy to make and easy to check. Here is a complete HTTP service:

```go
package main

import (
	"fmt"
	"net/http"
	"os"
	"time"
)

func main() {
	host, _ := os.Hostname()
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "ok from %s at %s\n", host, time.Now().UTC().Format(time.RFC3339))
	})
	fmt.Println("listening on :8080")
	http.ListenAndServe(":8080", nil)
}
```

We built it on a Raspberry Pi (arm64, Go 1.26) and cross-compiled it for three other targets from the same shell:

```terminal
{
  "title": "static binaries",
  "prompt": "$",
  "autoplay": true,
  "steps": [
    { "cmd": "CGO_ENABLED=0 go build -ldflags=\"-s -w\" -o healthz .", "output": "" },
    { "cmd": "ls -l healthz | awk '{print $5\" bytes\"}'", "output": "5374114 bytes" },
    { "cmd": "file healthz", "output": "healthz: ELF 64-bit LSB executable, ARM aarch64, statically linked, stripped" },
    { "cmd": "ldd healthz", "output": "\tnot a dynamic executable" },
    { "comment": "same source, other platforms, no other machines involved" },
    { "cmd": "for t in linux/amd64 darwin/arm64 windows/amd64; do GOOS=${t%/*} GOARCH=${t#*/} CGO_ENABLED=0 go build -ldflags=\"-s -w\" -o healthz-${t/\\//-} . && echo \"$t $(stat -c %s healthz-${t/\\//-}) bytes\"; done", "output": "linux/amd64 5771426 bytes\ndarwin/arm64 5428114 bytes\nwindows/amd64 5901312 bytes" }
  ]
}
```

Five and a half megabytes, no runtime, no shared libraries, four platforms from one directory. Every tool in the first chart ships this way, and that single property explains more of the meme than any language feature does. It is also why `FROM scratch` containers are normal in this ecosystem: the image is the binary.

## What this means if you run this stack

You do not have to write Go to benefit from the fact that your infrastructure is written in it, but reading it changes how you operate:

- **Error messages become searchable at the source.** When `kubectl` or `terraform` prints something cryptic, the string is in a Go file you can find in seconds, with the condition that produced it right above.
- **Configuration semantics stop being folklore.** The definitive answer to "what does this Helm flag do" is a short Go function, and it is usually clearer than the docs.
- **Extending the tools is the same language as the tools.** Kubernetes operators, Terraform providers, Prometheus exporters, Caddy modules, Traefik plugins: all Go, all built with libraries the projects themselves maintain. Our [guide to writing a simple Kubernetes operator](/posts/write-simple-kubernetes-operator) starts from exactly that position.
- **The language is small.** Go's spec fits in an afternoon; reading competence takes a weekend of following code in a project you already use. That is a better return than most certifications.

The meme is right, and the reason it is right is operational: the properties that make Go a good CLI language (one binary, fast start, cross-compile) are the same properties a control plane needs, plus goroutines for the daemons. The data plane will keep going to C and Rust. Everything that schedules, coordinates, and configures will keep being Go, and it is worth being able to read.
