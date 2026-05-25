---
title: 'How to Build an Effective On-Call Rotation and Escalation Policy'
excerpt: 'Your phone buzzed at 3:14 AM for a disk warning that auto-resolved by 3:16. Nobody fixes the alert. The next person on rotation hates their life. Here is how to build on-call schedules, escalation policies, and alert rules that respect your engineers.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-05-25'
publishedAt: '2026-05-25T09:00:00Z'
updatedAt: '2026-05-25T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - incident-management
  - on-call
  - escalation
  - alert-fatigue
  - sre
  - devops
  - observability
---

Your phone buzzes at 3:14 AM. It is a `DiskUsageHigh` warning on a staging node. By the time you grab your laptop, it has auto-resolved. You go back to sleep, except now you are wide awake at 4 AM staring at the ceiling, knowing the next page might be a real incident. On Monday, you mention it in standup. Someone says "yeah, that one fires all the time." Nobody opens a ticket. Next week the next person on rotation gets the same page.

This is how on-call rotations rot. Not from one bad incident, but from a slow leak of trust between engineers and the alerts they answer to. Building an on-call rotation that does not burn people out is a design problem, not a tooling problem. The tooling matters, but only after you decide what should wake a human up and what should not.

## TLDR

A good on-call rotation has three pieces: a schedule that is fair and predictable, an escalation policy that catches dropped pages without spamming everyone, and an alert pipeline that only pages humans for things humans can act on right now. Get all three right and on-call becomes tolerable. Get any one wrong and people will quit.

## Prerequisites

- An alerting backend like Alertmanager, PagerDuty, Opsgenie, or Grafana OnCall
- Prometheus or another metrics source that fires alerts
- A team of at least four engineers (anything smaller and you are running a hero rotation, which is a separate problem)
- Buy-in from your manager that on-call work is real work, not a side task

## Step 1: Design the Schedule Before You Pick the Tool

Most teams jump straight into PagerDuty and start clicking. Stop. Decide the shape of the rotation first.

The three common shapes:

- **Weekly rotation**: one engineer carries the pager for 7 days. Simple, but brutal if your service is noisy. Good for low-volume rotations.
- **Follow-the-sun**: hand off every 8 to 12 hours across timezones. Best if you have engineers in at least two regions. Nobody gets paged at 3 AM.
- **Split primary/secondary**: a primary handles the page, a secondary backs them up if the primary misses it. Adds redundancy without doubling the load.

For most teams between 5 and 15 engineers in one timezone, the right answer is a weekly rotation with a secondary on a separate, offset schedule. Here is what that looks like as Terraform with the PagerDuty provider:

```hcl
resource "pagerduty_schedule" "primary_oncall" {
  name      = "Platform Primary On-Call"
  time_zone = "Europe/London"

  layer {
    name                         = "Weekly Rotation"
    start                        = "2026-06-01T09:00:00Z"
    rotation_virtual_start       = "2026-06-01T09:00:00Z"
    rotation_turn_length_seconds = 604800  # 7 days
    users = [
      pagerduty_user.alice.id,
      pagerduty_user.bob.id,
      pagerduty_user.carol.id,
      pagerduty_user.dave.id,
      pagerduty_user.eve.id,
    ]
  }
}

resource "pagerduty_schedule" "secondary_oncall" {
  name      = "Platform Secondary On-Call"
  time_zone = "Europe/London"

  layer {
    name                         = "Offset Weekly Rotation"
    start                        = "2026-06-04T09:00:00Z"  # offset 3 days
    rotation_virtual_start       = "2026-06-04T09:00:00Z"
    rotation_turn_length_seconds = 604800
    users = [
      pagerduty_user.alice.id,
      pagerduty_user.bob.id,
      pagerduty_user.carol.id,
      pagerduty_user.dave.id,
      pagerduty_user.eve.id,
    ]
  }
}
```

The 3-day offset means the same person is never primary and secondary at the same time. It also means everyone gets a clear "I am on" week and a separate "I am the backup" week.

A few rules that prevent rotations from collapsing:

- **Publish the schedule at least 8 weeks ahead.** People plan weddings, holidays, school pickups. Surprise shifts kill morale faster than the actual pages do.
- **Let people swap shifts without asking permission.** Build a Slack channel, not a request queue. The only rule should be "find your own replacement before swapping."
- **Pay for it, or give time off in lieu.** Unpaid on-call is theft. If you cannot pay, give the on-call engineer a half-day off after a busy week.

## Step 2: Build an Escalation Policy That Actually Catches Drops

A page that nobody answers is worse than no page at all, because the incident keeps burning while you have a false sense of "someone is on it." Your escalation policy is the safety net.

The classic pattern: primary gets paged, has 5 minutes to acknowledge, then secondary, then a manager or incident commander.

```text
+---------------------+
|  Alert fires        |
+----------+----------+
           |
           v
+----------+----------+        +---------------------+
| Primary on-call     | -----> | ACK within 5 min?   |
+----------+----------+        +----------+----------+
                                          | No
                                          v
                              +-----------+-----------+
                              | Secondary on-call     |
                              +-----------+-----------+
                                          |
                                          | No ACK in 10 min
                                          v
                              +-----------+-----------+
                              | Incident Commander    |
                              | or Engineering Manager|
                              +-----------------------+
```

Here is the same policy in Terraform:

```hcl
resource "pagerduty_escalation_policy" "platform" {
  name      = "Platform Escalation"
  num_loops = 2

  rule {
    escalation_delay_in_minutes = 5
    target {
      type = "schedule_reference"
      id   = pagerduty_schedule.primary_oncall.id
    }
  }

  rule {
    escalation_delay_in_minutes = 10
    target {
      type = "schedule_reference"
      id   = pagerduty_schedule.secondary_oncall.id
    }
  }

  rule {
    escalation_delay_in_minutes = 15
    target {
      type = "user_reference"
      id   = pagerduty_user.engineering_manager.id
    }
  }
}
```

Three things worth calling out:

1. **5 minutes to acknowledge is the sweet spot.** Less than that and you escalate before someone has unlocked their phone. More than that and a real outage burns for too long before help arrives.
2. **`num_loops = 2` means the policy retries.** If the manager also misses it, it goes back to the primary. Without this, a sleeping team can drop a page entirely.
3. **The manager is a fallback, not the default.** If your manager is getting paged regularly, your team is too small or your alerts are too noisy. Probably both.

## Step 3: Cut Alert Noise Ruthlessly

This is where most on-call rotations live or die. The right number of pages per week per engineer is roughly **0 to 2**, and only one of those should happen outside business hours. If you are above that, you have a noise problem and no escalation policy will save you.

The fix is severity tiers. Not every alert deserves a phone call.

| Severity | Action               | Example                                              |
|----------|----------------------|------------------------------------------------------|
| `page`   | Wake someone up      | API error rate above 5% for 5 minutes                |
| `ticket` | File a ticket        | Disk at 80%, certificate expires in 14 days          |
| `info`   | Log only, no action  | Deploy started, cache warmed                         |

Encode this in your Prometheus alert rules. Example:

```yaml
groups:
- name: api-availability
  interval: 30s
  rules:
  - alert: APIHighErrorRate
    expr: |
      (
        sum(rate(http_requests_total{job="api",status=~"5.."}[5m]))
        /
        sum(rate(http_requests_total{job="api"}[5m]))
      ) > 0.05
    for: 5m
    labels:
      severity: page
      team: platform
    annotations:
      summary: "API 5xx error rate above 5% for 5 minutes"
      runbook: "https://runbooks.example.com/api-high-error-rate"
      dashboard: "https://grafana.example.com/d/api-overview"

  - alert: DiskSpaceWarning
    expr: |
      (1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})) > 0.80
    for: 30m
    labels:
      severity: ticket
      team: platform
    annotations:
      summary: "Disk usage above 80% on {{ $labels.instance }}"
      runbook: "https://runbooks.example.com/disk-space"
```

Then route on severity in Alertmanager. `page` goes to PagerDuty, `ticket` opens a Jira issue, `info` posts to a Slack channel nobody is required to read:

```yaml
route:
  receiver: slack-info
  group_by: ['alertname', 'cluster']
  routes:
  - matchers:
    - severity="page"
    receiver: pagerduty-platform
    group_wait: 30s
    group_interval: 5m
    repeat_interval: 4h

  - matchers:
    - severity="ticket"
    receiver: jira-platform
    group_wait: 5m

  - matchers:
    - severity="info"
    receiver: slack-info

receivers:
- name: pagerduty-platform
  pagerduty_configs:
  - service_key: <REDACTED>
    description: '{{ .CommonAnnotations.summary }}'
    details:
      runbook: '{{ .CommonAnnotations.runbook }}'
      dashboard: '{{ .CommonAnnotations.dashboard }}'

- name: jira-platform
  webhook_configs:
  - url: 'https://jira-bot.example.com/create'

- name: slack-info
  slack_configs:
  - api_url: 'https://hooks.slack.com/services/...'
    channel: '#alerts-info'
```

Two non-negotiable rules for any rule labelled `severity: page`:

1. **It must link to a runbook.** Not a wiki home page. A document with the actual commands to run. If you cannot write a runbook, the alert is not actionable enough to page on.
2. **It must include a `for:` clause of at least 2 minutes.** This prevents flapping. The disk that fills to 81% for 30 seconds because of a log rotation should not wake you.

## Step 4: Review Pages Every Week

The cheapest reliability work you can do is a weekly on-call review. 30 minutes, every Monday, with the off-going engineer talking through every page they got.

A simple template:

```text
On-Call Handover: 2026-05-18 to 2026-05-25
Engineer: Alice

Pages received: 4
  - Mon 02:14  APIHighErrorRate         REAL    fixed by rolling deploy
  - Tue 09:02  DiskSpaceWarning         NOISE   threshold too low, raised to 90%
  - Wed 04:33  PodCrashLoopBackOff      REAL    OOMKilled, increased memory limit
  - Sat 23:48  CertExpiryWarning        NOISE   renewal cron already running, ack window too short

Action items:
  1. Raise DiskSpaceWarning to 90% and move to severity=ticket (Alice, this week)
  2. Increase ack window on CertExpiryWarning from 5m to 30m (Bob, this week)
  3. Document OOM debug runbook (Carol, by next handover)
```

If an alert shows up as `NOISE` two weeks in a row, it gets fixed or it gets deleted. No exceptions. This is the single most important habit. Without it, your alert rules accumulate noise the same way a closet accumulates clothes you never wear.

## What You Should Do This Week

You probably will not redesign your entire on-call setup tomorrow. Pick one of these and do it before Friday:

1. **Pull last month of pages from PagerDuty.** Count how many were real vs noise. If the noise ratio is over 30%, your team is being trained to ignore the pager.
2. **Add a `runbook` annotation to your top 5 noisiest alerts.** Even a one-paragraph "if you see this, check X and Y" is enough to start.
3. **Add a secondary on-call schedule** if you do not have one. Even if it is the same five people, the escalation safety net is worth it.
4. **Schedule a 30-minute weekly handover meeting.** Block it on the calendar as recurring. Make it dead simple to attend, even from a phone in a coffee shop.

On-call will never be fun. But it should not be the reason your best engineers polish their CVs. Treat it like a system that needs maintenance, not a tax you collect from junior engineers, and your retention numbers will thank you.
