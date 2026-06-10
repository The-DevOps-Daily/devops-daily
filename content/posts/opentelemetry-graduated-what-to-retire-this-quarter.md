---
title: "OpenTelemetry Just Graduated: What to Retire from Your Stack This Quarter"
excerpt: "On May 21, 2026, CNCF graduated OpenTelemetry. All three core signals (traces, metrics, logs) are now production-ready, the project is the second-most-active in CNCF after Kubernetes itself, and Anthropic, Bloomberg, Capital One, eBay, and Heroku run it at scale. Here is the decision framework for what proprietary agents you can stop running, what is still risky, and the 90-day adoption checklist."
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-05-26'
publishedAt: '2026-05-26T10:00:00Z'
updatedAt: '2026-05-26T10:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: true
tags:
  - OpenTelemetry
  - Observability
  - CNCF
  - DevOps
  - Kubernetes
---

On May 21, 2026, the [Cloud Native Computing Foundation graduated OpenTelemetry](https://www.cncf.io/announcements/2026/05/21/cloud-native-computing-foundation-announces-opentelemetrys-graduation-solidifying-status-as-the-de-facto-observability-standard/) at the Observability Summit in Minneapolis. The headline number is that OTel is now the second-most-active project in the CNCF behind Kubernetes itself, with more than 12,000 contributors from 2,800 companies. The numbers most teams should care about are the ones underneath: traces, metrics, and logs are all production-stable as of this graduation. Profiling moved to alpha at the same time.

If your team has been running OpenTelemetry alongside a vendor-specific agent (Datadog Agent, New Relic Agent, Splunk Universal Forwarder, Dynatrace OneAgent, the AWS X-Ray daemon) because "OTel isn't quite there yet," the calculus changed last week. This post is the practical version: which proprietary agents you can actually retire, which to keep, and the 90-day rollout plan that gets you to a single OTel Collector shipping to whichever backends your team uses.

## TL;DR

- CNCF graduation criteria require independent security audit, formal governance review, and proven production adoption. OpenTelemetry cleared all three with the third-largest contributor base in cloud-native.
- All three core signals (traces, metrics, logs) are now production-ready. Profiles is alpha.
- The OTel Collector is the unified shipping layer. You run one collector per host or per cluster, and it fans out to any combination of backends. No more "one agent per vendor".
- Retire candidates: Datadog Agent, New Relic Infrastructure Agent, Splunk Universal Forwarder for logs+metrics, FluentBit/FluentD log-only paths, Prometheus node_exporter scrape pipelines you still own. Each has an OTel equivalent that's production-stable.
- Keep for now: vendor APM auto-instrumentation libraries on languages where OTel's contrib instrumentation hasn't caught up (Ruby on Rails edges, older PHP versions), eBPF profilers that depend on vendor-specific kernel modules.
- 90-day rollout: collector in shadow mode → one signal at a time → kill the proprietary agent → repeat per language runtime.

## Prerequisites

- A cluster or fleet where you can deploy a sidecar/DaemonSet without a change-management committee.
- At least one observability vendor account that can ingest OTLP/HTTP or OTLP/gRPC. Every major vendor accepts it now, but verify the endpoint and the auth header before you start a migration.
- Inventory of every agent currently running. `ps aux | grep -iE 'datadog|newrelic|splunkd|fluentd|fluent-bit|otelcol'` on one production host gets you a starting list.

## What graduation actually unlocks

CNCF graduation is more than a vanity badge. To clear the bar, a project needs to pass an independent security audit, hold a formal governance review with the TOC, and demonstrate widespread production adoption. The full criteria are in CNCF's [Graduation policy](https://github.com/cncf/toc/blob/main/process/graduation_criteria.md). Projects that have graduated before OTel include Kubernetes, Helm, Prometheus, etcd, and Envoy. The bar is meaningful.

For OpenTelemetry specifically, what changed at graduation is mostly social rather than technical. The bits were already there. Graduation tells your security team, your platform leads, and your CFO that this is a safe project to standardize on. The argument "let's wait until OTel is more mature" is now formally over. If you're still running three agents per host to satisfy three teams' tool preferences, the cost-of-status-quo math just shifted.

The most useful technical surface OTel offers is the [Collector](https://opentelemetry.io/docs/collector/). One binary, one config, and it can:

- Receive traces, metrics, and logs over OTLP (or scrape Prometheus, tail log files, pull host metrics, hook into eBPF).
- Process them (sample, batch, redact PII, attach k8s metadata, tail-sample on error).
- Export to anywhere. Datadog, New Relic, Splunk, Honeycomb, Grafana Cloud, Tempo, Mimir, Loki, ClickHouse, S3, whatever.

The "one collector, many backends" architecture is what makes the retire-the-vendor-agents play work. You're not removing your observability, you're removing the layer that locked you to a single ingestion path.

## What's actually production-stable

The CNCF announcement explicitly named all three core signals as production-ready:

```text
Traces       : Stable (since 2023)
Metrics      : Stable (since late 2023)
Logs         : Stable
Profiles     : Alpha (just promoted)
```

The signal-status nuance worth knowing:

- **Traces** were the first to stabilize and are by far the most mature. The auto-instrumentation libraries for Node.js, Python, Java, and .NET are at parity with the closed-source equivalents from APM vendors for most application frameworks. Go and Rust still benefit from manual instrumentation in some hot paths.
- **Metrics** are stable but have one foot in the Prometheus world. If your team already runs Prometheus servers, OTel metrics give you a way to ship the same metric to Prometheus AND a SaaS without scraping twice. The OTel-Prometheus interop story is solid.
- **Logs** stabilized later than traces and metrics. The OTel logging SDKs are production-ready, but the ergonomics on existing structured-logger libraries (log/slog in Go, the Python logging module, Java's Logback) still feel like a wrapper layer. Functional, but if you have a working Fluent Bit pipeline that nobody complains about, the migration ROI is lower than for traces.
- **Profiles** is alpha and should be treated as such. eBPF-based profilers (Parca, Pyroscope) are still the right choice if continuous profiling is core to your workflow. Revisit in 12 months.

## Retire-from-stack candidates, ranked by ROI

These are the proprietary agents where I'd push hardest to replace with the OTel Collector. ROI here is "engineering hours saved per quarter" plus "one-fewer-agent attack surface."

### High-confidence: replace

**Datadog Agent → OTel Collector + datadog exporter.** Datadog accepts OTLP natively now. The OTel Collector's `datadogexporter` is maintained by Datadog and ships traces/metrics/logs into your existing Datadog org. You keep the dashboards, the SLOs, the monitors. You stop running their proprietary agent on every host. Their docs at https://docs.datadoghq.com/opentelemetry/ walk through it.

**New Relic Infrastructure Agent → OTel Collector + otlp exporter.** Same shape. New Relic has supported OTLP ingestion for over a year. The cutover is a Collector config + an env var change on your services.

**Splunk Universal Forwarder for logs and metrics → OTel Collector + splunk_hec exporter.** Splunk Observability is built on OpenTelemetry internally, and Splunk Enterprise accepts HEC over OTLP. If you're still running UF on every host for the "send everything to indexer" pattern, the OTel Collector does it with smaller memory and CPU footprint.

**FluentBit / FluentD log-only deployments → OTel Collector with filelog receiver.** Slightly more controversial because FluentBit is excellent at what it does and has a smaller binary. The argument is consolidation: if you're already running an OTel Collector for traces and metrics, adding the filelog receiver removes the second daemon. If you're not, FluentBit stays the right call.

**Prometheus node_exporter + scrape pipeline you maintain → OTel Collector with hostmetrics receiver.** For the case where you're scraping a fleet you control, the hostmetrics receiver gives you the same dimensions (CPU, memory, disk, network, filesystem) with one less moving part. For the case where you scrape arbitrary apps that expose Prometheus endpoints, keep the scrape; the OTel Collector can do that scraping too.

### Keep for now

**Vendor APM auto-instrumentation libraries** on languages where OTel-contrib lags. Ruby on Rails apps that depend on the Datadog `dd-trace-rb` for AR span enrichment, older PHP 7.x where the OTel PHP SDK is still maturing. The right move is to keep the vendor lib in those services and use the OTel Collector as the egress layer.

**eBPF profilers with vendor-specific kernel modules.** Pyroscope and Parca have great OTel integration paths. Datadog's continuous profiler uses its own kernel hook. If you depend on the Datadog profiler today, OTel profiles being alpha is not enough to switch.

**AWS X-Ray daemon** if you're heavily invested in X-Ray as a backend. AWS accepts OTLP, but X-Ray's free tier and ECS Fargate-native integration make the X-Ray daemon a defensible choice for AWS-only shops. For multi-cloud, OTel.

## The 90-day rollout plan

The pattern that works is the same in every team I've seen do this without an incident:

**Days 1-14: shadow-mode collector.** Deploy the OTel Collector as a sidecar (per pod) or DaemonSet (per node) alongside your existing agents. Configure it to receive but not export to your production backend yet. The receiver-only config is two lines:

```yaml
receivers:
  otlp:
    protocols:
      grpc: { endpoint: 0.0.0.0:4317 }
      http: { endpoint: 0.0.0.0:4318 }
processors:
  batch: {}
exporters:
  debug: {}
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [debug]
```

Point one canary service at the collector via `OTEL_EXPORTER_OTLP_ENDPOINT`. Validate the data shape in the debug log. No production impact, no SLO risk.

**Days 15-30: fan-out to your real backend.** Add your vendor's OTel exporter. Run it as a parallel write path to your existing agent. Diff the dashboards. If traces show up in Datadog through both paths and the counts match within 1%, you have proof.

**Days 30-60: kill the agent, one signal at a time.** Start with traces (lowest dashboard surface area for most teams). Disable the vendor agent's tracing collection, leave its metrics and logs paths intact. Watch the trace dashboard for a week. If it stays steady, move metrics next, then logs.

**Days 60-90: standardize the collector config across the fleet.** Pull the per-service collector YAMLs into a shared Helm chart or Terraform module. Bake in the processors you actually need (PII redaction, tail sampling, k8s metadata enrichment). Add a regression test that fails CI if the collector config drifts.

By day 90 the canary service is fully on OTel, you've retired the vendor agent on one service tier, and you have a reusable rollout recipe for the rest of the fleet.

## What this doesn't fix

OpenTelemetry graduating doesn't mean observability is solved. Three things it still doesn't address:

- **Backend pricing.** Switching your shipping layer to OTel doesn't change what Datadog charges per host. You get optionality (you can swap backends later), not immediate cost savings.
- **Cardinality explosion.** OTel makes it easier than ever to instrument everything. If you add a `user_id` attribute to every span without sampling, your bill will go through the roof faster than before, just in OTLP format.
- **Correlation across signals.** OTel defines the formats. The actual cross-signal correlation (trace_id on a log, span_id on a metric exemplar) still depends on instrumentation discipline at each service. Graduation doesn't automatically wire your existing log lines into your traces.

## Summary

OpenTelemetry graduating from CNCF on May 21 is the formal signal that the standard-or-not debate is over. All three core signals are production-stable, the project's velocity is second only to Kubernetes, and every major observability backend now accepts OTLP. The realistic action for most teams: deploy the OTel Collector in shadow mode this quarter, validate against your existing pipeline, and retire one proprietary agent per signal over 90 days.

If you only do one thing this week, run `ps aux | grep -iE 'datadog|newrelic|splunkd|fluentd'` on a production host and count what's still there. That's your retire list. The collector that replaces all of them is one Helm install away.

Sources:
- [CNCF announcement: OpenTelemetry graduates](https://www.cncf.io/announcements/2026/05/21/cloud-native-computing-foundation-announces-opentelemetrys-graduation-solidifying-status-as-the-de-facto-observability-standard/)
- [OpenTelemetry Collector docs](https://opentelemetry.io/docs/collector/)
- [Datadog OTel ingestion docs](https://docs.datadoghq.com/opentelemetry/)
