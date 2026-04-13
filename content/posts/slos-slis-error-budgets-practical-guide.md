---
title: 'SLOs, SLIs, and Error Budgets: A Practical Implementation Guide'
excerpt: 'Your service went down at 2 AM and nobody could agree on whether it was "bad enough" to page someone. SLOs, SLIs, and error budgets fix that. Here is how to define, measure, and act on them with real Prometheus queries and alerting rules.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-04-13'
publishedAt: '2026-04-13T09:00:00Z'
updatedAt: '2026-04-13T09:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - sre
  - slos
  - slis
  - error-budgets
  - monitoring
  - observability
  - devops
  - prometheus
---

Your checkout service threw 500 errors for 12 minutes last Tuesday. The on-call engineer fixed it, wrote a short postmortem, and moved on. Then it happened again on Thursday, for 8 minutes this time. Product asked: "Is this normal? Should we stop shipping features until it's fixed?" Nobody had a good answer because there was no agreed-upon definition of "reliable enough."

That is the problem SLOs, SLIs, and error budgets solve. They give your team a shared, measurable contract for reliability so you can stop arguing about feelings and start making decisions with data.

## TLDR

**SLIs** (Service Level Indicators) are the metrics you measure, like request success rate or latency at the 99th percentile. **SLOs** (Service Level Objectives) are the targets you set for those metrics, like "99.9% of requests succeed over a 30-day window." **Error budgets** are the math that falls out: if your SLO is 99.9%, you have a 0.1% error budget, which means you can afford about 43 minutes of downtime per month. When the budget runs low, you slow down feature work and fix reliability. When there is plenty of budget left, you ship faster.

## Prerequisites

- A running service that handles HTTP or gRPC traffic
- Prometheus and Grafana (or a similar metrics and dashboards setup)
- Basic familiarity with PromQL queries
- Access to your alerting system (Alertmanager, PagerDuty, or similar)

## What Makes a Good SLI

An SLI is a measurement of your service's behavior from the user's point of view. The key word there is "user." CPU usage is not an SLI. Disk space is not an SLI. Those are infrastructure metrics. They matter, but they do not directly tell you whether users are happy.

Good SLIs fall into a few categories:

- **Availability**: Did the request succeed? (HTTP 5xx vs total requests)
- **Latency**: Was the response fast enough? (P99 under a threshold)
- **Correctness**: Did the response contain the right data?
- **Freshness**: Is the data recent enough? (For async pipelines)

For most web services, start with two SLIs: availability and latency. You can add more later.

Here is how to instrument a service with Prometheus to track both:

```python
from prometheus_client import Counter, Histogram

# Count all requests and errors
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

# Track latency with histogram buckets
REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency in seconds',
    ['method', 'endpoint'],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5]
)
```

Every request increments the counter with its status code, and the histogram records how long it took. These two metrics give you everything you need for availability and latency SLIs.

## Setting Your First SLO

An SLO is a target for your SLI, measured over a time window. It answers: "How reliable do we promise to be?"

Do not start at 99.99%. That sounds great on paper, but it means you can only have about 4 minutes of errors per month. Unless you are running payment infrastructure or a medical system, that target will paralyze your team.

Start here instead:

```text
Service: checkout-api
SLO Window: 30 days (rolling)

Availability SLO:
  SLI: Proportion of non-5xx responses
  Target: 99.9%
  Allowed errors: ~43 minutes/month

Latency SLO:
  SLI: Proportion of requests faster than 300ms
  Target: 99.0%
  Allowed slow requests: ~432 minutes/month
```

Why 99.9% for availability and 99.0% for latency? Because availability failures (errors) hurt more than slow responses. A 500 error means the user gets nothing. A slow response is annoying but usually still works.

Here is what different availability targets actually mean in practice:

```text
SLO Target   | Monthly Error Budget  | Roughly
-------------|----------------------|------------------
99%          | 7.3 hours            | One bad afternoon
99.5%        | 3.6 hours            | A couple incidents
99.9%        | 43.8 minutes         | One short outage
99.95%       | 21.9 minutes         | Half an incident
99.99%       | 4.3 minutes          | Barely any room
```

Pick a target that matches how your users actually experience your service. If your service already runs at 99.95% without trying, do not set a 99.99% SLO just because you can. Set it at 99.9% and use the extra budget to ship features faster.

## Calculating Error Budgets with Prometheus

The error budget is the gap between perfect (100%) and your SLO target. If your SLO is 99.9%, your error budget is 0.1% of all requests in the window.

Here is the PromQL query to calculate your remaining error budget over a 30-day rolling window:

```promql
# Availability: ratio of successful requests over 30 days
(
  sum(rate(http_requests_total{status!~"5.."}[30d]))
  /
  sum(rate(http_requests_total[30d]))
)
```

This gives you a number like 0.9994, meaning 99.94% of requests succeeded. If your SLO is 99.9% (0.999), you have used some budget but still have room.

To see how much budget remains as a percentage:

```promql
# Error budget remaining (1.0 = full budget, 0.0 = exhausted)
(
  (
    sum(rate(http_requests_total{status!~"5.."}[30d]))
    /
    sum(rate(http_requests_total[30d]))
  ) - 0.999
) / (1 - 0.999)
```

If this returns 0.4, you have used 60% of your error budget. If it hits 0 or goes negative, your budget is gone.

For latency, the query is similar but uses histogram buckets:

```promql
# Latency SLI: proportion of requests under 300ms
(
  sum(rate(http_request_duration_seconds_bucket{le="0.3"}[30d]))
  /
  sum(rate(http_request_duration_seconds_count[30d]))
)
```

## Building an SLO Dashboard in Grafana

A good SLO dashboard answers three questions at a glance: Are we meeting the SLO right now? How much error budget is left? Are we burning budget faster than expected?

Here is a Grafana dashboard definition you can import:

```json
{
  "panels": [
    {
      "title": "Availability SLI (30d rolling)",
      "type": "gauge",
      "targets": [{
        "expr": "sum(rate(http_requests_total{status!~\"5..\"}[30d])) / sum(rate(http_requests_total[30d]))",
        "legendFormat": "Availability"
      }],
      "fieldConfig": {
        "defaults": {
          "thresholds": {
            "steps": [
              { "value": 0, "color": "red" },
              { "value": 0.999, "color": "yellow" },
              { "value": 0.9995, "color": "green" }
            ]
          },
          "unit": "percentunit",
          "min": 0.99,
          "max": 1
        }
      }
    },
    {
      "title": "Error Budget Remaining",
      "type": "stat",
      "targets": [{
        "expr": "((sum(rate(http_requests_total{status!~\"5..\"}[30d])) / sum(rate(http_requests_total[30d]))) - 0.999) / (1 - 0.999) * 100",
        "legendFormat": "Budget %"
      }],
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "thresholds": {
            "steps": [
              { "value": 0, "color": "red" },
              { "value": 25, "color": "orange" },
              { "value": 50, "color": "green" }
            ]
          }
        }
      }
    }
  ]
}
```

The gauge turns yellow when you are close to violating the SLO and red when you have breached it. The stat panel shows the remaining budget as a percentage, so anyone on the team can see at a glance whether it is safe to ship.

## Alerting on Error Budget Burn Rate

Do not alert when the SLO is breached. By then it is too late. Instead, alert on the **burn rate**, which tells you how fast you are consuming budget.

A burn rate of 1 means you will exactly exhaust your budget by the end of the window. A burn rate of 10 means you are burning 10x faster than sustainable, and you will run out in 3 days instead of 30.

Here is an Alertmanager rule that fires when the burn rate gets dangerous:

```yaml
# Prometheus alerting rules for SLO burn rate
groups:
  - name: slo-burn-rate
    rules:
      # Fast burn: 14.4x over 1 hour AND 6x over 6 hours
      # Pages the on-call engineer
      - alert: HighErrorBudgetBurn
        expr: |
          (
            1 - (sum(rate(http_requests_total{status!~"5.."}[1h]))
            / sum(rate(http_requests_total[1h])))
          ) / (1 - 0.999) > 14.4
          and
          (
            1 - (sum(rate(http_requests_total{status!~"5.."}[6h]))
            / sum(rate(http_requests_total[6h])))
          ) / (1 - 0.999) > 6
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Checkout API burning error budget 14x faster than sustainable"
          description: "At this rate, the 30-day error budget will be exhausted in ~2 days."

      # Slow burn: 3x over 1 day AND 1x over 3 days
      # Creates a ticket, no page
      - alert: SlowErrorBudgetBurn
        expr: |
          (
            1 - (sum(rate(http_requests_total{status!~"5.."}[1d]))
            / sum(rate(http_requests_total[1d])))
          ) / (1 - 0.999) > 3
          and
          (
            1 - (sum(rate(http_requests_total{status!~"5.."}[3d]))
            / sum(rate(http_requests_total[3d])))
          ) / (1 - 0.999) > 1
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Checkout API slowly burning error budget"
          description: "Budget will be exhausted before the window resets if this continues."
```

The two-window approach (short and long) prevents alert fatigue. A brief spike triggers the short window but not the long one, so you do not get paged for a 30-second blip. A sustained problem triggers both, which means something is genuinely wrong.

## What to Do When the Budget Runs Out

This is where error budgets change how your team works. When the budget is exhausted, you have a clear policy:

```text
Error Budget Policy
-------------------

Budget > 50%:  Ship freely. Take risks. Run experiments.
Budget 25-50%: Ship with extra caution. Require rollback plans.
Budget 5-25%:  Freeze non-critical deploys. Focus on reliability work.
Budget < 5%:   Full feature freeze. All engineering effort goes to reliability.
Budget = 0%:   Postmortem required. No deploys until budget recovers.
```

Write this policy down. Get buy-in from engineering leadership and product management before you need it. The worst time to negotiate a feature freeze is during an incident.

Here is a simple script that checks the budget and posts to Slack:

```bash
#!/bin/bash
# check-error-budget.sh - Run via cron every hour

PROM_URL="http://prometheus:9090"
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
SLO_TARGET=0.999

# Query current availability over 30 days
AVAILABILITY=$(curl -s "${PROM_URL}/api/v1/query" \
  --data-urlencode 'query=sum(rate(http_requests_total{status!~"5.."}[30d])) / sum(rate(http_requests_total[30d]))' \
  | jq -r '.data.result[0].value[1]')

# Calculate remaining budget as a percentage
BUDGET=$(echo "scale=2; (($AVAILABILITY - $SLO_TARGET) / (1 - $SLO_TARGET)) * 100" | bc)

if (( $(echo "$BUDGET < 25" | bc -l) )); then
  curl -s -X POST "$SLACK_WEBHOOK" \
    -H 'Content-Type: application/json' \
    -d "{\"text\": \"Warning: checkout-api error budget is at ${BUDGET}%. Current availability: ${AVAILABILITY}\"}"
fi
```

## Common Mistakes to Avoid

**Setting SLOs too high.** A 99.99% SLO for an internal dashboard is a waste. You will spend all your time protecting a budget that nobody actually needs. Match the SLO to user expectations.

**Measuring the wrong thing.** Server-side health checks are not SLIs. If your health check returns 200 but users see timeout errors because of a broken load balancer, your SLI missed the problem. Measure as close to the user as possible.

**Ignoring the error budget policy.** If you set SLOs but never act on budget exhaustion, the whole system is theater. The budget only works if teams actually slow down when it runs out.

**Using SLOs as a performance review tool.** SLOs measure service reliability, not engineer performance. The moment you blame someone for a budget burn, people start gaming the metrics.

**Not revisiting SLOs.** Review your targets every quarter. If you never burn more than 10% of your budget, the SLO is too loose. If you breach every month, it is too tight, or you have real reliability problems to fix.

## Next Steps

1. Pick one service, ideally your most user-facing one, and define two SLIs: availability and latency
2. Set initial SLO targets at 99.9% availability and 99% latency. You can always adjust later
3. Add the Prometheus instrumentation from this post and build the Grafana dashboard
4. Set up burn rate alerts using the two-window approach shown above
5. Write an error budget policy and get sign-off from your team lead and product manager
6. Schedule a monthly SLO review meeting to check if targets still make sense

Start small. One service, two SLIs, one dashboard. You will learn more from running a real SLO for a month than from planning the perfect SLO framework on a whiteboard.
