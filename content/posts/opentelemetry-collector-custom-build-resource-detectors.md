---
title: 'OpenTelemetry Collector Custom Builds: 6.5x Smaller, and What Resource Detectors Cost at Startup'
excerpt: 'We built a small Collector with ocb and started it next to the contrib release on a droplet, in two network namespaces and on a Raspberry Pi, 5 times per case. The custom build is 6.5x smaller and holds under a quarter of the memory. Cloud detectors for clouds the host is not on held startup for the full 5 s timeout, even on another cloud, and one detector stopped the Collector from starting at all.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-11-05'
publishedAt: '2026-11-05T15:00:00Z'
updatedAt: '2026-11-05T15:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - OpenTelemetry
  - Observability
  - Go
  - Cloud
  - Linux
---

The contrib release of the OpenTelemetry Collector 0.164.0 is a 420.3 MB binary on linux/amd64. We built a Collector with the **OpenTelemetry Collector Builder (ocb)** that has only the 10 components a VM agent uses and only the `env` and `system` resource detectors. It is 64.3 MB, so contrib is 6.5 times larger. After 10 seconds idle, the custom build held 45.1 MiB of resident memory and contrib held 199.8 MiB. The anonymous part (heap, stacks and runtime data) was 8.0 MiB against 34.8 MiB.

The binary adds a little to startup: contrib needed 110 to 160 ms more than the small build on the droplet, and 300 to 500 ms more on the Pi. The detector list in your config can add seconds. We started both builds with cloud detectors for clouds the host was not on, in four network setups. In every list without `akamai`, each start waited for the slowest detector. When that detector got no answer, it waited for the whole `timeout`, which is 5 s by default. That happened on a Raspberry Pi with no metadata service. With a list of 13 cloud detectors it also happened on a DigitalOcean droplet, because two of them ask addresses that DigitalOcean does not answer. The detectors run in parallel, so where nothing answered, the list with 3 cloud detectors and the list with 13 cost the same 5 s.

`timeout: 1s` cut the wait to about 1 s in most cases. Two detectors do not obey it. `digitalocean` ignores the deadline, so where nothing answers it waits its own 2 s. `akamai` makes its network call while the processor is created. In all four setups we tested, none of them on Akamai, the Collector did not start. It exited at once where the request got an answer or a fast error, and after 30 s where it got no answer.

On 29 October the OpenTelemetry blog showed [how to compile detectors out with ocb](https://opentelemetry.io/blog/2026/collector-with-less-dependencies/) and reported a Kubernetes distribution about 20% smaller. This post measures three things that page does not cover. What does the same filter do to a small build? What does the build do to memory at idle? And what does the detector list cost at startup on hosts that are not on the clouds the config names? Every number below comes from a file in the companion repo.

## TL;DR

- **Size.** On amd64, contrib is 420.3 MB, the core `otelcol` release is 183.8 MB, our agent with every detector is 124.1 MB, and the same agent with only `env` and `system` is 64.3 MB. On this small build, the detector filter alone removed 48% of the binary and 64 Go modules: the AWS SDK, the Google Cloud clients, the Docker client, the Consul API and four more cloud metadata clients. arm64 gives the same picture.
- **Memory.** After 10 s idle: contrib 199.8 MiB RSS, core 98.4 MiB, our agent 61.5 MiB, the agent without cloud detectors 45.1 MiB. About four fifths of each number is file-backed memory (`RssFile`), which grows with the binary. The anonymous part (`RssAnon`) was 34.8 MiB for contrib and 8.0 MiB for the small build.
- **Startup with no cloud detectors:** about 190 to 220 ms for contrib and 45 to 85 ms for the small agents on the droplet, and 480 to 610 ms against 110 to 270 ms on the Pi.
- **Startup with cloud detectors for other clouds:** `[env, system, ec2, gcp, azure]` held startup for the full 5 s timeout where 169.254.169.254 got no answer. Where the connect failed at once, it held startup for 4.1 s, because the AWS SDK retries the connect. On the droplet those three cost under 4 ms each, but the 13-cloud list still took 5.1 s there, because `alibaba_ecs` and `scaleway` ask other addresses.
- **The timeout setting** bounds the wait: 1 s, 5 s or 10 s plus normal startup. The exceptions are `digitalocean`, which waits its own 2 s whatever you set when nothing answers, and `akamai`.
- **No start at all.** `akamai` in the list: exit 1 in all four setups, after 30 s in the two with no answer. `fail_on_missing_metadata: true`: exit 1 after the 5 s timeout. A detector that ocb compiled out but the config still names: `validate` passes, then a nil pointer panic at start. The processor's name for a detector in the ocb manifest (`ec2` instead of `aws_ec2`): the build stops.
- **What to do.** List only the detectors for the platform the host runs on, and build with the same list in `dist.resource.detection.detectors`. If one config must cover several clouds, keep the list short, set `timeout` to 1 or 2 s, and leave out `akamai`.

## Prerequisites

- An x86_64 Linux host for the builds, with about 3 GB of free disk. ocb cross-compiles the arm64 binaries there.
- `curl`, `python3` and `ip` (iproute2). Root only for the two network namespaces.
- An arm64 Linux host if you want the second architecture. We used a Raspberry Pi with 4 cores and less than 4 GB of memory.
- About an hour for a full run. The cases that fail after 30 s take most of it.

## What we built and where we ran it

We downloaded the official 0.164.0 releases of `otelcol-contrib` and `otelcol` for both architectures and checked each tarball against its published `.sha256`. Then ocb 0.164.0 built two versions of one small agent. It has the components a VM agent uses:

- receivers: OTLP, hostmetrics and filelog
- processors: batch, memory_limiter and resource_detection
- exporters: debug, OTLP and OTLP/HTTP
- extension: health_check

`otelcol-agent` uses the ocb default, so every detector is compiled in. `otelcol-agent-envsys` adds the ocb setting that compiles out every detector you do not list:

```yaml
# manifests/agent-envsys.yaml (excerpt, comment on detectors added)
dist:
  name: otelcol-agent-envsys
  version: 0.164.0
  build_tags: 'grpcnotrace' # same tag as the contrib release manifest
  resource:
    detection:
      detectors: # ocb 0.163.1 and later: every detector not listed gets an omit_detector_<name> build tag
        - env:
        - system:
```

`go version -m` on the release binaries reports go1.26.10, so we pinned the same Go for our builds. `go version -m` and `file` show `-trimpath=true`, `CGO_ENABLED=0` and stripped symbols for every binary (`results/buildinfo/`).

Every start ran the same pipeline: OTLP in, batch, debug out. The harness gave each start a clean environment with only `PATH` and an empty `HOME`. No `OTEL_*` or `AWS_*` variable and no `~/.aws` file could change what a detector found. The Pi runs also set `TZ=UTC`, so their logs use UTC like the droplet's; the droplet runs used an earlier revision of the harness without it. Only the `resource_detection` block changed between configs. Each case ran 5 times in a shuffled order, after one warm-up start per binary that we left out of the numbers.

```diagram
{
  "type": "infra",
  "groups": [
    {
      "label": "DigitalOcean droplet",
      "sub": "4 vCPU, 8 GB, amd64",
      "icon": "server",
      "tone": "blue",
      "nodes": [
        { "label": "host network", "sub": "metadata server answers", "icon": "net", "tone": "green", "status": "ok" },
        { "label": "blackhole namespace", "sub": "packets dropped", "icon": "shield", "tone": "red", "status": "down" },
        { "label": "noroute namespace", "sub": "connect fails at once", "icon": "shield", "tone": "amber", "status": "warn" }
      ]
    },
    {
      "label": "Raspberry Pi",
      "sub": "4 cores, under 4 GB, arm64",
      "icon": "cpu",
      "tone": "violet",
      "nodes": [
        { "label": "home network", "sub": "router drops 169.254.169.254", "icon": "globe", "tone": "red", "status": "down" }
      ]
    }
  ]
}
```

The four network setups matter more than the two architectures:

| Setup               | What a request to 169.254.169.254 gets                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Droplet host        | DigitalOcean's metadata server answers. The EC2 and Azure paths return 404 in about 1 ms. This is the "host on another cloud" case.                                                |
| Blackhole namespace | The default route goes to a dummy device, which discards every packet, so a connect gets no answer. DNS fails at once, because nothing listens on 127.0.0.53 inside the namespace. |
| Noroute namespace   | Loopback only. A connect fails at once with "network is unreachable".                                                                                                              |
| Raspberry Pi        | The home router drops the packets. DNS works. This is the plain "not on any cloud" host.                                                                                           |

```github
The-DevOps-Daily/otelcol-ocb-vs-contrib
```

## Size: what ocb removes

```chart
{
  "type": "bar",
  "title": "Binary size, linux/amd64, OpenTelemetry Collector 0.164.0",
  "unit": " MB",
  "caption": "results/sizes.tsv. Stripped, -trimpath, CGO_ENABLED=0, go1.26.10. The two agents have the same 10 components; only the compiled-in detectors differ.",
  "rows": [
    { "label": "otelcol-contrib (release)", "value": 420.3, "series": "release" },
    { "label": "otelcol core (release)", "value": 183.8, "series": "release" },
    { "label": "agent, all detectors", "value": 124.1, "series": "custom" },
    { "label": "agent, env + system only", "value": 64.3, "series": "custom" }
  ],
  "series": [
    { "name": "release", "color": "#94a3b8" },
    { "name": "custom", "color": "#f59e0b" }
  ]
}
```

The contrib manifest lists 246 components and 9 config providers, and the binary links 1,088 Go modules. The core release is not small either. Its 30 components include the Kafka and Prometheus receivers and exporters, and it also ships `resource_detection` with every detector. Our agent with every detector links 289 modules, and the detector filter takes it to 225.

The filter saves more on a small build than on a big one. The OpenTelemetry blog measured the Kubernetes distribution and got 182 MB to 147 MB with 13 fewer dependencies. On our agent it removed 59.8 MB of 124.1 MB (48%) on amd64, 52.9 MB of 112.7 MB (47%) on arm64, and 64 modules. A big distribution needs most of those SDKs for other components, so removing the detectors does not remove the SDKs. In a small agent, nothing else needs them. `results/deps/removed-by-detector-filter-amd64.txt` lists the 64: 15 `aws-sdk-go-v2` and `smithy-go` modules, the Google Cloud compute, auth and API clients, the Docker (moby) client, the Consul API with its HashiCorp libraries, and the Hetzner, Scaleway, Linode and DigitalOcean clients.

For containers, the official `otel/opentelemetry-collector-contrib:0.164.0` image is 116.1 MB compressed on amd64 (`results/images.tsv`). We did not build an image of the small agent. Its binary compresses to 20.3 MB with `gzip -6`, so a `FROM scratch` image would be near that, but that is an estimate, not a measurement.

One build difference favours our side. The contrib manifest asks for the `grpcnotrace` build tag and our builds use it, but the release binaries record no build tags in `go version -m`. We built `otelcol-agent-notag` to put a size on it: 124.23 MB against 124.11 MB, so the tag is worth 0.1%.

## Memory at idle

```chart
{
  "type": "bar",
  "title": "Resident memory after 10 s idle, droplet, amd64",
  "unit": " MiB",
  "caption": "Median of 5 starts, /proc/<pid>/status, config without resource_detection, results/summary.md. RssFile is resident file-backed memory; RssAnon is resident anonymous memory (heap, stacks, runtime).",
  "rows": [
    { "label": "contrib: RssAnon", "value": 34.8, "series": "RssAnon" },
    { "label": "contrib: RssFile", "value": 165.2, "series": "RssFile" },
    { "label": "core: RssAnon", "value": 18.7, "series": "RssAnon" },
    { "label": "core: RssFile", "value": 79.5, "series": "RssFile" },
    { "label": "agent, all detectors: RssAnon", "value": 11.2, "series": "RssAnon" },
    { "label": "agent, all detectors: RssFile", "value": 50.2, "series": "RssFile" },
    { "label": "agent, env + system: RssAnon", "value": 8.0, "series": "RssAnon" },
    { "label": "agent, env + system: RssFile", "value": 37.0, "series": "RssFile" }
  ],
  "series": [
    { "name": "RssAnon", "color": "#f59e0b" },
    { "name": "RssFile", "color": "#94a3b8" }
  ]
}
```

Resident memory follows the binary size, but not one to one. Contrib held 199.8 MiB, 4.4 times the 45.1 MiB of the small agent. About four fifths of every number is `RssFile`, resident memory backed by files. It grows with the binary: 165.2 MiB for contrib, 37.0 MiB for the small agent. That points at the binary's own pages, but we did not map them one by one. The kernel can drop clean file-backed pages under memory pressure and read them again later. `RssAnon` is anonymous memory, which it cannot drop without swap. There contrib held 34.8 MiB against 8.0 MiB. A Go program runs the `init` code of every package it links before `main`, so a likely part of that difference is setup work for code that this pipeline never uses. We did not profile the heap to prove it.

Detection with `[env, system]` added little: contrib went to 205.4 MiB and the small agent to 47.8 MiB. The Raspberry Pi gave the same order on arm64: contrib 183.8 MiB with 34.7 MiB anonymous, the small agent 40.6 MiB with 8.0 MiB.

We did not test what happens to `RssFile` under memory pressure, or how a cgroup memory limit counts it. Read the `RssAnon` column as the floor and `VmRSS` as what `top` shows you.

## Startup: the slowest detector sets the time

Median time from exec to the log line "Everything is ready", 5 starts each, from `results/summary.md`. Each cell is the small agent with every detector, then contrib in brackets:

| Config                      | Droplet host               | Blackhole namespace          | Noroute namespace          | Raspberry Pi                 |
| --------------------------- | -------------------------- | ---------------------------- | -------------------------- | ---------------------------- |
| `[env, system]`             | 79 ms (189 ms)             | 77 ms (210 ms)               | 83 ms (221 ms)             | 192 ms (481 ms)              |
| `+ ec2, gcp, azure`         | 81 ms (196 ms)             | 5,088 ms (5,203 ms)          | 4,098 ms (4,242 ms)        | 5,172 ms (5,486 ms)          |
| `+ 13 VM clouds, no akamai` | 5,090 ms (5,213 ms)        | 5,086 ms (5,203 ms)          | 4,087 ms (4,227 ms)        | 5,167 ms (5,393 ms)          |
| `+ akamai`                  | exit 1 after 0.1 s (0.2 s) | exit 1 after 30.1 s (30.2 s) | exit 1 after 0.1 s (0.2 s) | exit 1 after 30.2 s (30.5 s) |

Without a network wait, contrib needs about 110 to 160 ms more than the small agent to start on the droplet, and about 300 to 500 ms more on the Pi. That is real but small, and it matters only if you start collectors very often, for example one per short CI job.

The wait comes from three things in the processor source (`processor/resourcedetectionprocessor` at v0.164.1):

1. **Detectors run in parallel.** `detectResource` starts one goroutine per detector and then reads their results in order ([internal/resourcedetection.go, lines 203 to 222](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.1/processor/resourcedetectionprocessor/internal/resourcedetection.go#L203-L222)). The wait is the slowest detector, not the sum.
2. **The whole detection has one deadline: `timeout`.** The default is 5 s ([factory.go, lines 153 to 157](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.1/processor/resourcedetectionprocessor/factory.go#L153-L157)). With the default `retry.max_elapsed_time: 0`, `Refresh` puts that timeout on the context that every detector gets ([internal/resourcedetection.go, lines 159 to 168](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.1/processor/resourcedetectionprocessor/internal/resourcedetection.go#L159-L168)).
3. **Startup waits for it.** The processor's `Start` runs the first detection and returns its error ([resourcedetection_processor.go, lines 36 to 40](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.1/processor/resourcedetectionprocessor/resourcedetection_processor.go#L36-L40)). The Collector logs "Everything is ready" only after every processor has started.

The processor also records how long each detector took, in its own `otelcol_resourcedetection_detector_duration` histogram. We read it from the Collector's Prometheus endpoint after each start. This is the 13-cloud list in the blackhole namespace:

```chart
{
  "type": "bar",
  "title": "Time per detector, 13 VM cloud detectors, blackhole namespace, timeout 5s",
  "unit": " ms",
  "caption": "Median of 5 starts of the small agent with all detectors, from otelcol_resourcedetection_detector_duration in results/runs/droplet-blackhole-extra.jsonl. Every detector reported outcome=success: \"not on this cloud\" is a success with no attributes.",
  "rows": [
    { "label": "ec2", "value": 5000.7, "series": "waits for timeout" },
    { "label": "alibaba_ecs", "value": 4999.8, "series": "waits for timeout" },
    { "label": "azure", "value": 4999.7, "series": "waits for timeout" },
    { "label": "hetzner", "value": 5000.2, "series": "waits for timeout" },
    { "label": "scaleway", "value": 4999.6, "series": "waits for timeout" },
    { "label": "digitalocean", "value": 2000.6, "series": "own 2 s timeout" },
    { "label": "nova", "value": 2000.4, "series": "own 2 s timeout" },
    { "label": "upcloud", "value": 2000.7, "series": "own 2 s timeout" },
    { "label": "vultr", "value": 2000.8, "series": "own 2 s timeout" },
    { "label": "oraclecloud", "value": 200.7, "series": "fast" },
    { "label": "ibmcloud_vpc", "value": 1.2, "series": "fast" },
    { "label": "gcp", "value": 0.9, "series": "fast" },
    { "label": "tencent_cvm", "value": 0.7, "series": "fast" }
  ],
  "series": [
    { "name": "waits for timeout", "color": "#ef4444" },
    { "name": "own 2 s timeout", "color": "#f59e0b" },
    { "name": "fast", "color": "#10b981" }
  ]
}
```

The same histogram tells you which detector held each of the other setups:

| Setup               | Detectors that took the longest                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Droplet host        | `alibaba_ecs` and `scaleway`, 5.0 s each. They ask `100.100.100.200` and `169.254.42.42`, and nothing on DigitalOcean answers those. The other 11 finished in 2 to 20 ms (medians).                                                 |
| Blackhole namespace | Five detectors at 5.0 s and four at 2.0 s (see the chart).                                                                                                                                                                          |
| Noroute namespace   | `ec2` alone, 4.0 s. Every other detector finished in under 2 ms.                                                                                                                                                                    |
| Raspberry Pi        | Six detectors at 5.0 s: the five from the blackhole namespace and `ibmcloud_vpc`, which took 1.2 ms in the namespace. We did not trace why. The same four at 2.0 s. With working DNS, `gcp` took 13.5 ms and `tencent_cvm` 15.9 ms. |

How each detector probes decides how long it waits:

- **azure** sends one GET with a plain `&http.Client{}` that has no timeout ([internal/metadataproviders/azure/metadata.go, lines 33 to 38](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.1/internal/metadataproviders/azure/metadata.go#L33-L38)). When the packets get no answer, it waits for the processor's deadline. Then it returns an empty resource and no error ([internal/azure/azure.go, lines 55 to 63](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.1/processor/resourcedetectionprocessor/internal/azure/azure.go#L55-L63)).
- **ec2** uses the AWS SDK's IMDS client: a 250 ms dial timeout, a 500 ms response header timeout ([aws-sdk-go-v2 feature/ec2/imds v1.20.1, api_client.go, lines 277 and 278](https://github.com/aws/aws-sdk-go-v2/blob/feature/ec2/imds/v1.20.1/feature/ec2/imds/api_client.go#L277-L278)), and up to 3 attempts per request ([internal/aws/ec2/config.go, lines 16 to 19](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.1/processor/resourcedetectionprocessor/internal/aws/ec2/config.go#L16-L19)). A connect that fails at once is retried with backoff, which is why `ec2` took 4.0 s in the noroute namespace. With no answer at all and a 10 s timeout, it gave up by itself after 5.5 s.
- **gcp** calls `metadata.OnGCEWithContext`, which races a DNS lookup of `metadata.google.internal` against an HTTP probe. On a host that does not look like a Google VM, it trusts the first answer ([cloud.google.com/go/compute/metadata v0.10.0, metadata.go, lines 456 to 480](https://github.com/googleapis/google-cloud-go/blob/compute/metadata/v0.10.0/compute/metadata/metadata.go#L456-L480)). A fast NXDOMAIN or a fast DNS failure ends it.
- **digitalocean** ignores the context: its `Detect` takes `_ context.Context` ([internal/digitalocean/digitalocean.go, line 51](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.1/processor/resourcedetectionprocessor/internal/digitalocean/digitalocean.go#L51)), and the DigitalOcean metadata client has a fixed 2 s timeout ([digitalocean/go-metadata, client.go, lines 25 and 64](https://github.com/digitalocean/go-metadata/blob/e3650a3df44b/client.go#L25-L64)).

We started from this claim: on a host that is not on EC2, Google Cloud or Azure, each cloud detector adds a wait at startup. Two results would prove it wrong: no wait at all, or the same wait for 3 detectors and for 13. We got the second, so it was half wrong. The detectors do not each add a wait. During detection they overlap, and the slowest one sets the time. But a host on a cloud with a metadata server is not safe either, because not every cloud uses 169.254.169.254.

## The timeout setting

```chart
{
  "type": "line",
  "title": "Start to \"Everything is ready\" with [env, system, ec2, gcp, azure]",
  "unit": " ms",
  "caption": "Median of 5 starts per point, results/summary.md. The droplet host answers on 169.254.169.254; the blackhole namespace and the Pi do not. The noroute namespace fails the connect at once.",
  "x": ["timeout: 1s", "timeout: 5s (default)", "timeout: 10s"],
  "series": [
    { "name": "contrib, blackhole namespace", "data": [1238.8, 5203.1, 10235.4], "color": "#ef4444" },
    { "name": "agent, blackhole namespace", "data": [1077.1, 5087.6, 10085.4], "color": "#f59e0b" },
    { "name": "contrib, Raspberry Pi", "data": [1526.7, 5485.5, 10710.8], "color": "#8b5cf6" },
    { "name": "contrib, noroute namespace", "data": [1240.1, 4241.6, 4229.5], "color": "#0ea5e9" },
    { "name": "contrib, droplet host", "data": [209.3, 196.0, 216.0], "color": "#10b981", "dash": "6 5" }
  ]
}
```

Where nothing answers, the wait is the timeout plus normal startup, on both architectures. In the noroute namespace it stops at 4.1 to 4.2 s, where `ec2` gives up. `timeout: 1s` brought every three-cloud case that waited down to 1.1 to 1.2 s.

The 13-cloud list with `timeout: 1s` did not get there. In the blackhole namespace it started in 2,097 ms (contrib 2,234 ms), and on the Pi in 2,175 ms (contrib 2,410 ms), because `digitalocean` took its 2 s anyway.

A short timeout has a cost that we could not measure. On a real EC2, Google Cloud or Azure VM, a detector that needs more than 1 s gets cut off. It returns an empty resource with no error, and your telemetry has no cloud attributes. We did not run on those clouds, so we cannot say whether 1 s is enough there. Most examples in the processor README use `timeout: 2s`.

## Four ways the Collector does not start

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "ocb build", "sub": "unknown detector name: stops", "icon": "gear", "tone": "amber" },
    { "label": "otelcol validate", "sub": "passes a compiled-out detector", "icon": "check", "tone": "amber" },
    { "label": "create processor", "sub": "akamai fetches a token", "icon": "box", "tone": "red" },
    { "label": "Start: detection", "sub": "parallel, one deadline", "icon": "activity", "tone": "red" },
    { "label": "Everything is ready", "icon": "rocket", "tone": "green" }
  ]
}
```

### 1. The akamai detector

Of the 14 VM cloud detectors we ran, `akamai` is the only one that waited or failed while the processor was created. Its `NewDetector` calls `newAkamaiClient(context.Background())` ([internal/akamai/akamai.go, lines 43 to 57](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.1/processor/resourcedetectionprocessor/internal/akamai/akamai.go#L43-L57)), and the Linode metadata client fetches a token inside `NewClient` ([linode/go-metadata v0.3.1, client.go, lines 88 to 91](https://github.com/linode/go-metadata/blob/v0.3.1/client.go#L88-L91)). This happens before detection, so `timeout` does not apply, and a failure there is a failure to build the pipeline.

On the droplet, DigitalOcean's metadata server answers the token request, but not with a token, and the Collector exits at once:

```terminal
{
  "title": "results/runs/droplet-host-extra.jsonl, otelcol-contrib, configs/akamai.yaml",
  "prompt": "$",
  "steps": [
    {
      "cmd": "bin/linux-amd64/otelcol-contrib --config configs/akamai.yaml",
      "output": "Error: failed to build pipelines: failed to create \"resource_detection\" processor, in pipeline \"traces\": failed creating detector type \"akamai\": failed to refresh metadata token: failed to generate metadata token: no token returned from API"
    },
    { "comment": "exit code 1, 0.2 s after exec" }
  ]
}
```

In the noroute namespace it exited at once with `connect: network is unreachable`. In the blackhole namespace and on the Pi, the token request first waited for a 30 s dial timeout. The Collector exited after 30.1 s in the namespace and 30.2 s on the Pi (contrib: 30.2 s and 30.5 s). With `timeout: 1s` it still took 30 s.

### 2. fail_on_missing_metadata: true

This setting makes a cloud detector return an error when its metadata service is missing, instead of an empty resource. Retry is on by default ([factory.go, lines 142 to 151](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.1/processor/resourcedetectionprocessor/factory.go#L142-L151)), so the processor retries the detector with backoff until `timeout`, and then `Start` returns the error. With `[env, system, ec2, gcp, azure]`, the Collector exited with code 1 after 5.1 to 5.3 s in all three droplet setups. The config comment says the setting is for nodes that boot before their metadata service is ready ([config.go, lines 63 to 70](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.1/processor/resourcedetectionprocessor/config.go#L63-L70)). It also turns "not on EC2" into "does not start".

### 3. A detector that ocb compiled out

This is the trap in the new ocb feature. `otelcol-agent-envsys` has only `env` and `system`. We gave it the three-cloud config:

```terminal
{
  "title": "results/break/amd64-validate.txt and results/break/amd64-start.txt",
  "prompt": "$",
  "steps": [
    {
      "cmd": "bin/linux-amd64/otelcol-agent-envsys validate --config configs/clouds3.yaml",
      "output": "exit code: 0"
    },
    {
      "cmd": "bin/linux-amd64/otelcol-agent-envsys --config configs/clouds3.yaml",
      "output": "panic: runtime error: invalid memory address or nil pointer dereference\n[signal SIGSEGV: segmentation violation code=0x1 addr=0x18 pc=0x130a757]\n\ngoroutine 57 [running]:\ngithub.com/open-telemetry/opentelemetry-collector-contrib/processor/resourcedetectionprocessor/internal.(*ResourceProvider).detectWithRetry.func2()\n\tgithub.com/open-telemetry/opentelemetry-collector-contrib/processor/resourcedetectionprocessor@v0.164.1/internal/resourcedetection.go:314 +0xb7\n...\nexit code: 2"
    }
  ]
}
```

In v0.164.1 each `*_omit.go` stub returns `nil, nil` from `NewDetector`, for example [internal/aws/ec2/ec2_omit.go](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.1/processor/resourcedetectionprocessor/internal/aws/ec2/ec2_omit.go). The processor keeps the nil detector and calls it. This is [issue #52519](https://github.com/open-telemetry/opentelemetry-collector-contrib/issues/52519), open when we wrote this. On `main`, [#52063](https://github.com/open-telemetry/opentelemetry-collector-contrib/pull/52063) changes the stubs so they register no factory. It was merged after v0.164.1. With it, the processor returns `detector "ec2" is not compiled into this binary` with the list of compiled detectors. Until a release has that change, `validate` does not catch the mismatch, and the first sign is a crash.

### 4. The processor's names in the ocb manifest

ocb and the processor do not use the same detector names. The processor config says `ec2`, `nova` and `aks`. The ocb manifest wants the build tag names `aws_ec2`, `openstack_nova` and `azure_aks` ([cmd/builder/internal/builder/config.go, lines 117 to 151](https://github.com/open-telemetry/opentelemetry-collector/blob/cmd/builder/v0.164.0/cmd/builder/internal/builder/config.go#L117-L151)). This one fails early, which is the good kind of failure:

```terminal
{
  "title": "results/build/agent-badname-amd64.log",
  "prompt": "$",
  "steps": [
    {
      "cmd": "ocb --config manifests/agent-badname.yaml",
      "output": "Error: invalid configuration: ec2: unknown resource detector"
    }
  ]
}
```

## What to put in the manifest and the config

Make the two lists match, each in its own names:

```yaml
# ocb manifest: build tag names
dist:
  resource:
    detection:
      detectors:
        - env:
        - system:
        - aws_ec2: # the processor calls this one "ec2"
```

```yaml
# Collector config: processor names, the same detectors
processors:
  resource_detection:
    detectors: [env, system, ec2]
    timeout: 2s # the most a missing metadata service can add to startup
```

- Use one list per platform. A fleet on EC2 does not need `azure`, and a fleet on bare metal needs neither.
- If one config must cover several clouds, keep the list short and set `timeout` to 1 or 2 s. Expect `digitalocean` to add 2 s, whatever the timeout, on hosts where its request gets no answer.
- Leave `akamai` out unless the hosts run on Akamai Cloud.
- Keep `fail_on_missing_metadata` off unless "no metadata" should mean "do not start".
- Use the name `resource_detection`. In 0.164 the old name `resourcedetection` still works, with a deprecation warning (`results/break/amd64-legacy-name.txt`).
- Until the #52063 change is in a release, start each new custom build once with its real config before you ship it. `validate` is not enough.

## What we could not conclude

- **On a real AWS, Google Cloud or Azure VM.** We had no instances there, so we did not measure how long a detector takes when it succeeds, or whether a 1 s timeout cuts it off.
- **The container image of the small agent.** We report the compressed size of the official image and the gzip size of our binary. We did not build or push an image.
- **Memory under pressure.** `RssFile` can be reclaimed. We did not measure how much the kernel takes back, or how a cgroup limit counts it.
- **Small startup differences.** Each case has 5 starts. The 110 to 160 ms between contrib and the small agent repeats in every droplet setup. The Pi also ran other work, and three of its starts took 4.6 to 22 s. In all three, the time went before the Collector wrote its first log line, which points at reading the binary from the SD card, not at detection. We did not confirm that. They move the medians little, but they are in the min and max columns of `results/summary.md`.
- **Slow DNS.** DNS failed at once in the namespaces and answered on the Pi, so `gcp` and `tencent_cvm` were fast everywhere. A host whose DNS times out would make them wait too. We did not test that.
- **Other versions.** Everything here is 0.164.0 and 0.164.1. The akamai and omit behaviour may change in the next release.

Related reading:

- [Distributed tracing with OpenTelemetry](/posts/distributed-tracing-opentelemetry-instrumentation-visualization) runs a Collector end to end.
- [OpenTelemetry graduated](/posts/opentelemetry-graduated-what-to-retire-this-quarter) covers which vendor agents a Collector can replace.
- [Trace context in environment variables](/posts/trace-context-environment-variables) follows a trace through a CI pipeline.

## Summary

A custom Collector with only the components you use is 6.5 times smaller than contrib and holds under a quarter of its memory. On a small build, compiling out the unused detectors is half of the size saving. The binary costs tens to hundreds of milliseconds at startup. The detector list can cost seconds. Apart from `akamai`, the cloud detectors you list for clouds the host is not on share one wait: the slowest probe. Where that probe gets no answer, it usually runs to the full `timeout`, even on a host on another cloud. `digitalocean` waits its own 2 s instead, even past a shorter timeout. Keep the list to the platforms you run on, and build with the same list. Set a short timeout if the list must stay long. Start each new binary once with its real config. Leave `akamai` out unless you run on Akamai.
