---
title: 'Datadog Alternatives in 2026: 12 Tools, Their Real Prices, and What 300 GB of Logs Costs on Each'
excerpt: 'We read the pricing page of Datadog and 12 alternatives on the same day and priced one workload on each: 300 GB of logs a month. Datadog with standard indexing of every event is $780 to $1,155 a month; the alternatives we could price run from about $19 to $180. Here is each tool, who it suits, and the catch on its pricing page.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-10-12'
publishedAt: '2026-10-12T09:00:00Z'
updatedAt: '2026-10-12T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Observability
  - Datadog
  - OpenTelemetry
  - Logging
  - Monitoring
  - FinOps
---

Many teams start looking for a Datadog alternative the same way: a bill arrives, someone opens the usage page, and logs are a big line. Datadog charges separately to ingest logs (per GB) and to index them (per event). A busy service that writes small lines pays far more for indexing than its byte count suggests.

Every "Datadog alternatives" list says the alternatives are cheaper. Few say by how much, because the vendors price in different units: per GB, per event, per host, per user, per compute credit. So we did the arithmetic. On October 12, 2026 we read the pricing page of Datadog and 12 alternatives, and priced one workload on each at list price: **300 GB of logs a month, kept for 30 days**. Then we wrote down what each tool is good at and the catch we found on its pricing page.

## TLDR

- **The workload:** 300 GB of logs a month, 30-day retention, about 1 KB per log event (so 300 million events), list prices, no negotiated discounts.
- **Datadog:** $780 a month with annual billing if you index every event with 30-day retention, $1,155 on demand. Index 10% of events and it drops to $105, but the other 90% are then not searchable unless you archive them or use Flex Logs.
- **Cheapest on paper:** Uptrace ($19 to $25, its page gives two rates), Axiom ($25 if your logs compress at least 3:1 and you stay inside the included query compute), Better Stack ($45 in its EU region).
- **Generous free tiers:** Axiom Personal (500 GB of data loading), New Relic (100 GB of ingest), Grafana Cloud (50 GB each of logs, traces and profiles).
- **Best fit by need:** Grafana Cloud if you already run Prometheus, Honeycomb for debugging traces, SigNoz or OpenObserve if you may self-host later, ClickStack if you want ClickHouse and long retention.
- **The catches:** a 30% annual discount folded into a "pay as you go" price, ingest that stops when you pass the free tier, a daily quota that blocks data until midnight UTC, and region-based prices that differ 3.5x.

## Prerequisites

- A rough idea of your monthly log volume in GB. Your current vendor's usage page has it.
- Your average log event size. If you do not know it, divide bytes ingested by events ingested on your usage page.
- Ten minutes with the OpenTelemetry Collector docs if you plan to try two tools side by side (more on that at the end).

## How we priced it

Prices change often, so everything below is a snapshot of each vendor's own pricing page on October 12, 2026. We did not use third-party price lists.

The workload is logs only, because logs are the line that sends most people looking, and because every vendor prices logs in a way we can convert:

- **Volume:** 300 GB ingested per month (about 10 GB a day).
- **Retention:** 30 days. Where the listed price includes less, we say so.
- **Event size:** 1 KB on average, so 1 GB is 1 million events and the month is 300 million events. This matters for the vendors that bill per event. If your events are smaller, per-event pricing gets worse fast. Our [logs cost post](/posts/your-logs-cost-more-than-the-service) measured 209 bytes per nginx line on a real server, which is about 5 million events per GB.
- **Not included:** hosts, APM, metrics, support plans, cloud egress from wherever your workloads run, and query charges where they are separate (OpenObserve and Axiom bill queries; most others include them). We add a required user or plan fee where the vendor needs one to send logs at all, and call out the rest per vendor.

```chart
{
  "type": "bar",
  "title": "Monthly list price for 300 GB of logs",
  "unit": "$",
  "caption": "Vendor pricing pages, October 12, 2026. 1 KB per event (300M events), 30-day retention unless the label says otherwise. Logs only; query charges extra on OpenObserve and Axiom. Uptrace shows the higher of the two rates on its page. Axiom assumes at least 3:1 compression. ClickStack, Coralogix, Elastic, Honeycomb and self-hosting are left out because their pages do not give a single comparable figure; see each section.",
  "rows": [
    { "label": "Datadog, standard indexing, on demand", "value": 1155, "series": "Datadog" },
    { "label": "Datadog, standard indexing, annual", "value": 780, "series": "Datadog" },
    { "label": "Dash0", "value": 180, "series": "Alternatives" },
    { "label": "OpenObserve, annual commitment", "value": 150, "series": "Alternatives" },
    { "label": "Grafana Cloud", "value": 131.5, "series": "Alternatives" },
    { "label": "SigNoz (15-day)", "value": 90, "series": "Alternatives" },
    { "label": "New Relic, retention unconfirmed", "value": 90, "series": "Alternatives" },
    { "label": "Better Stack (EU)", "value": 45, "series": "Alternatives" },
    { "label": "Uptrace (28-day)", "value": 25, "series": "Alternatives" },
    { "label": "Axiom", "value": 25, "series": "Alternatives" }
  ],
  "series": [
    { "name": "Datadog", "color": "#632ca6" },
    { "name": "Alternatives", "color": "#f59e0b" }
  ]
}
```

A cheaper log line does not make a cheaper platform. Most of these tools also charge for metrics, traces or seats, and some charge for queries. Use the number to see the gap, then price your own mix with each vendor's calculator.

## The baseline: Datadog

**Pricing model:** per host for infrastructure and APM, per GB to ingest logs, per million events to index them. Infrastructure Pro is $15 per host per month billed annually ($18 on demand). APM is $31 per host ($36 on demand).

**300 GB of logs:** ingest is $0.10 per GB, so $30. Indexing with 30-day retention is $2.50 per million events billed annually, $3 billed monthly and $3.75 on demand. At 300 million events:

```text
annual:     $30 ingest + 300 x $2.50 = $780 per month
on demand:  $30 ingest + 300 x $3.75 = $1,155 per month
index 10%:  $30 ingest +  30 x $2.50 = $105 per month
```

**Fair to Datadog:** you rarely need to index every log. Exclusion filters, shorter retention (7-day indexing is $1.27 per million) and Flex Logs (storage at $0.05 per million events per month, with compute for queries priced separately) all cut the bill. The 10% figure above is only fair if the other 90% can stay unsearchable or go to an archive. Datadog also lists more than 1,000 integrations.

**The catch:** the billable host count is the "high-water mark of the lower 99 percent" of hourly usage. The top 1% of hours (about 7 hours in a 730-hour month) are dropped, so an autoscaling spike that lasts longer than that sets your host bill for the month. On the log side, a spike raises the ingest charge, and the indexing charge too if those events pass your index filters.

## 1. Grafana Cloud

**Best for:** teams that already run Prometheus, Loki or Grafana dashboards.

**Pricing model:** Pro is "from $19/month + usage". Logs, traces and profiles start at $0.05 per GB to process plus $0.40 per GB to write, and the first 30 days of retention are included. Metrics start at $6.50 per 1,000 active series.

**Free tier:** 10,000 active series, 50 GB each of logs, traces and profiles, 3 active users, 14-day retention.

**300 GB of logs:** $19 + (300 - 50) x $0.45 = **$131.50**.

**Strengths:** the open source stack underneath (Grafana, Loki, Tempo and Mimir, all AGPL-3.0), native PromQL, and a free tier that covers logs, traces and profiles. You can move to self-hosting later without changing query languages.

**The catch:** Loki indexes labels, not log content. Its own docs warn that too many label combinations give "a large index and small chunks", which "can actually reduce performance". Plan your labels before you send 300 GB. The pricing page also carries a banner saying Grafana is changing its pricing, so check it again before you commit.

## 2. SigNoz

**Best for:** teams that want one per-GB rate for logs and traces, and the option to self-host.

**Pricing model:** the Teams plan is $49 a month, and that includes $49 of usage. After that, logs and traces are $0.30 per GB ingested and metrics are $0.10 per million samples. No per-host or per-user fees.

**Free tier:** a cloud trial. Self-hosting is free; the code is MIT licensed apart from the `ee/` and `cmd/enterprise/` directories.

**300 GB of logs:** 300 x $0.30 = $90, which absorbs the $49 minimum, so **$90**, at the listed 15-day retention. The page offers 30, 90 and 180 days and a year, but the text we captured does not give their prices.

**Strengths:** built on OpenTelemetry and ClickHouse, with OTLP over gRPC and HTTP. Logs, traces and metrics share one UI and one query builder.

**The catch:** SSO and SAML are cloud only, RBAC is in beta, and audit logs and multi-tenancy are listed as "coming soon". If compliance features matter, check where they stand.

## 3. Better Stack

**Best for:** small teams that want uptime checks, on-call, status pages and logs on one bill.

**Pricing model:** per GB ingested plus per GB-month retained, priced by region. In Germany (the default) ingest is $0.10 per GB and retention $0.05 per GB per month. In the US it is $0.15 and $0.08. In Singapore $0.35 and $0.18. On-call responders are $29 a month per seat billed annually.

**Free tier:** 10 monitors, 1 status page, 3 GB of logs and 3 GB of traces (kept for 3 days), 30 GB of metrics.

**300 GB of logs:** 300 x $0.10 + 300 x $0.05 = **$45** in Germany, $69 in the US. The plan includes 3 GB a month (kept for 3 days), which changes this by less than a dollar.

**Strengths:** one of the lowest per-GB list prices here, a full UI, and OTLP over HTTP. You can keep the data in your own S3 bucket for $250 a month.

**The catch:** region matters more than you would guess: Singapore ingest costs 3.5x the German rate. The pricing page also says it is "currently not HIPAA compliant".

## 4. ClickStack (HyperDX on ClickHouse Cloud)

**Best for:** teams that want long retention on cheap storage, or already use ClickHouse.

**Pricing model:** you pay for ClickHouse Cloud compute and storage, not per GB of logs. Storage is $25.30 per TB per month. Compute is metered per minute at $0.2181 per unit-hour on Basic (a unit is 8 GiB of RAM and 2 vCPUs, AWS us-east-1), and the Basic tier offers 8 to 12 GiB of memory. Compute scales to zero when idle.

**Free tier:** $300 of credits for 30 days. HyperDX is MIT and ClickHouse is Apache-2.0, so you can self-host both.

**300 GB of logs:** it depends on how long compute runs. Logs arrive all day, so assume one 8 GiB unit stays awake: $0.2181 x 730 hours = $159.21. Storage at ClickHouse's own 10x compression estimate is 30 GB, about $0.76. That gives **about $160**, before backups and query load. We left it off the chart because the real figure depends on sizing you choose.

**Strengths:** storage is so cheap that a year of retention changes the bill very little. SQL on your logs, and native OTLP.

**The catch:** you are sizing a database, not buying a per-GB service. Continuous ingestion keeps compute awake, so at small volume the compute line dominates the bill.

## 5. OpenObserve

**Best for:** teams that want a cheap self-hosted option with a cloud fallback.

**Pricing model:** $0.50 per GB ingested plus $0.01 per GB queried, with 30 days of log retention included.

**Free tier:** a 14-day cloud trial. The self-hosted Enterprise edition is free up to 50 GB a day, and the open source version is AGPL-3.0.

**300 GB of logs:** 300 x $0.50 = **$150** at the annual-commitment rate (see the catch), plus queries (scanning 1 TB in a month adds $10).

**Strengths:** the free self-hosted tier is generous: 50 GB a day is 1.5 TB a month, five times our workload.

**The catch:** the page calls the $0.50 rate "pay-as-you-go, billed monthly", but a footnote says it "includes 30% discount for annual commitment". The page does not show the price without the commitment.

## 6. Axiom

**Best for:** high log volume with modest query load.

**Pricing model:** the Axiom Cloud plan is $25 a month, and that includes 1,000 GB of data loading, 100 GB-hours of query compute and 100 GB of storage. Past that, data loading starts at $0.12 per GB, queries at $0.20 per GB-hour, and storage at $0.03 per GB per month, charged on compressed data.

**Free tier:** the Personal plan gives 500 GB of data loading, 10 GB-hours of queries, 25 GB of storage and 30-day retention, with no card.

**300 GB of logs:** the loading fits in the included 1,000 GB. Storage is charged on compressed data, so 300 GB fits in the included 100 GB at any compression ratio better than 3:1. That leaves **$25**, plus query compute if you go past 100 GB-hours. If your logs compress worse than 3:1, storage adds up to $6 (at no compression, 200 GB over the allowance at $0.03).

**Strengths:** one of the cheapest results for our workload, and the largest free allowance for data loading on this list.

**The catch:** queries are metered, and query compute from AI agents counts the same as from people. A team that queries all day, or wires an assistant into its logs, should model query cost first.

## 7. Honeycomb

**Best for:** debugging distributed systems through traces with many unique attribute values.

**Pricing model:** per event, with unlimited seats. Each span, span event and link counts as an event. Pro starts at $150 a month for 50 million events and goes up to 750 million.

**Free tier:** 20 million events and 100 million metric data points a month.

**300 GB of logs:** our 300 million events fit inside Pro's range, but the page does not list the price for that tier, so we left it off the chart.

**Strengths:** built for asking new questions of trace data. High-cardinality fields (user ID, build ID, feature flag) cost nothing extra, because pricing is per event, not per field.

**The catch:** 60 days of retention are included, and longer retention is an Enterprise add-on. For our workload you need a quote, and per-event pricing means smaller events cost more per GB.

## 8. New Relic

**Best for:** small teams that fit in the free tier, and teams that want no host-based pricing.

**Pricing model:** $0.40 per GB beyond 100 free GB a month, plus users. Core users are $49 a month. A full platform user on Standard is $10 for the first and $99 each after that (up to 5).

**Free tier:** 100 GB of ingest a month, 1 full user, unlimited basic users.

**300 GB of logs:** (300 - 100) x $0.40 = $80, plus $10 for the first full platform user on Standard, so **$90**. The pricing page we read does not state log retention on paid plans (the free tier keeps data for at least 8 days), so confirm it covers 30 days.

**Strengths:** 100 GB of free ingest a month, OTLP support and no per-host charges.

**The catch:** on the free tier, going over 100 GB means "data ingest will cease and you will lose access to the platform" until you upgrade to a paid edition or the next month starts. New Relic says it warns you first, but it is still a bad surprise during an incident, which is exactly when log volume spikes.

## 9. Dash0

**Best for:** teams already standardized on OpenTelemetry.

**Pricing model:** per million signals, with separate ingest and storage prices. Spans and log records cost $0.060 per million to ingest and $0.540 per million to store for 30 days.

**Free tier:** a 14-day trial.

**300 GB of logs:** 300 x ($0.060 + $0.540) = **$180**.

**Strengths:** built around OpenTelemetry from the start, and storage is billed only on what you keep.

**The catch:** data you filter out still pays the ingest price, and per-event pricing punishes small events. At the 209-byte nginx line from our logs post, the same 300 GB would be about 1.4 billion events.

## 10. Coralogix

**Best for:** teams that want to keep logs in their own bucket and still query them.

**Pricing model:** units at $1.50 each, charged per GB by pipeline against a daily quota. The headline prices are $0.42 per GB for logs, $0.16 for traces and $0.06 for metrics.

**Free tier:** a 14-day trial with 8 units.

**300 GB of logs:** **$126 to $345**, depending on the pipeline. The headline $0.42 per GB gives $126. The FAQ on the same page prices Monitoring at $0.50 per GB ($150) and Frequent Search at $1.15 per GB ($345). The page does not say which pipeline the $0.42 applies to, which is why it is not on the chart.

**Strengths:** you can query the archive in your own bucket, and the priority pipelines let you pay less for logs you only keep for compliance.

**The catch:** when you hit the daily quota (2x with pay-as-you-go turned on), data is blocked until 00:00 UTC, and unused units expire.

## 11. Uptrace

**Best for:** cost-sensitive teams in Europe.

**Pricing model:** per GB for spans and logs, per million data points for metrics, 28-day retention. The page says "50 GB free/mo · then $0.075/GB" in one place and rates that "start at $0.10/GB" in another.

**Free tier:** 50 GB and 5,000 time series a month. The self-hosted Community Edition is AGPL-3.0.

**300 GB of logs:** (300 - 50) x $0.075 = $18.75, or $25 at $0.10. Call it **$19 to $25**, and check the page before you budget.

**Strengths:** among the lowest per-GB rates on this list, with unlimited users and hosts.

**The catch:** the pricing page contradicts itself on the starting rate, and the cloud runs in one region, Hetzner in Germany. That suits EU data residency, but workloads in the US or Asia send every log across an ocean.

## 12. Elastic Observability (Serverless)

**Best for:** teams that need full-text search across log content.

**Pricing model:** per GB ingested plus per GB retained. Logs Essentials is "as low as $0.07/GB" to ingest and "as low as" $0.017 to retain. The Complete tier lists logs and traces "as low as $0.09/GB". Limited support is included; higher support levels add 5% to 15%.

**Free tier:** a 14-day trial.

**300 GB of logs:** not computed. The page shows only the lowest volume tier ("as low as"), not the rate at 300 GB.

**Strengths:** it indexes the text of every log line, so full-text searches over long time ranges stay fast. Loki can also search log content, but it scans the chunks instead of using an index. Self-managed and hosted options exist.

**The catch:** the page shows only "as low as" rates, so you need the calculator for a real number.

## The self-hosted option: Prometheus, Grafana, Loki and Tempo

**Best for:** teams with spare infrastructure and the people to run it.

**Pricing model:** no license fee. Prometheus is Apache-2.0. Grafana, Loki, Tempo and Mimir are AGPL-3.0.

**300 GB of logs:** whatever your servers, object storage and on-call time cost. For 300 GB a month, Loki on object storage is cheap to store. The real cost is the people.

**Strengths:** full control, no per-GB pricing, and every piece speaks OpenTelemetry: Prometheus has an OTLP receiver (off by default, `--web.enable-otlp-receiver`), Loki accepts OTLP at `/otlp`, and Tempo takes OTLP natively.

**The catch:** four systems to deploy, upgrade, scale and back up. If nobody owns them, they rot.

## How to switch without a big-bang migration

Do not move everything at once. The cheap, safe way is to send the same data to two places and compare:

1. **Put an OpenTelemetry Collector in front of your apps** if you do not have one. Our post on [what to retire now that OpenTelemetry has graduated](/posts/opentelemetry-graduated-what-to-retire-this-quarter) covers the move.
2. **Add a second exporter** that sends logs to the tool you want to test. The Collector can fan out to several backends from one pipeline:

```yaml
exporters:
  datadog:
    api:
      key: ${env:DD_API_KEY}
  otlphttp/candidate:
    endpoint: https://otlp.example-vendor.com   # the candidate's OTLP endpoint
    headers:
      authorization: Bearer ${env:CANDIDATE_TOKEN}

service:
  pipelines:
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [datadog, otlphttp/candidate]   # send to both while you compare
```

3. **Run both for a full billing cycle.** One week is not enough, because month-end batch jobs and incident spikes change the volume.
4. **Compare three things:** the bill, whether your top 10 saved searches and alerts still work, and how long a real incident investigation takes in each tool.
5. **Move logs first.** Logs are often the largest and most portable line. Keep APM where it is until the logs move is done.

## Summary

- At list price, 300 GB of logs a month costs $780 on Datadog with annual billing if you index every event, and about $19 to $180 on the alternatives we could price. The biggest saving on Datadog itself is to index less.
- The cheapest log line is not the cheapest platform. Axiom, Uptrace and Better Stack win on logs alone. Grafana Cloud and New Relic win on free tiers. Honeycomb wins on trace debugging. ClickStack wins on long retention.
- Read the footnotes. We found a 30% annual discount in a "pay as you go" price, ingest that stops at the free-tier limit, a daily quota that blocks data until midnight UTC, regional prices 3.5x apart, and a page that gives two different rates.
- Event size changes everything for per-event vendors. Measure yours before you trust any comparison, including this one.
- Prices change. Every number here is from the vendors' own pages on October 12, 2026.
