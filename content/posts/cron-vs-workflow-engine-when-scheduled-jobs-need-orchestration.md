---
title: 'Cron Is Not a Workflow Engine: When Scheduled Jobs Need an Orchestrator'
excerpt: 'We ran one nightly ETL job under plain cron, hardened cron, a Kubernetes CronJob, Kestra and Prefect, then broke all five the same way at the same time. Here is what each one did on its own, what a person had to fix, and a checklist for when cron is still enough.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-11-24'
publishedAt: '2026-11-24T15:00:00Z'
updatedAt: '2026-11-24T15:00:00Z'
readingTime: '24 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Cron
  - Kubernetes
  - Workflow Orchestration
  - Kestra
  - Prefect
  - Data Pipelines
  - Reliability
---

We took one nightly job (extract orders from an API, transform them, load them into Postgres, send a report) and scheduled it five ways on one box: plain cron, cron with the usual hardening, a Kubernetes CronJob, Kestra and Prefect. Then we broke all of them the same way at the same time: a step that dies halfway, a run that overlaps the next one, a poison record, a duplicate run, a reboot during a run, and the machine being off while schedules pass. Afterwards we backfilled the missed days by hand.

Out of 34 nightly partitions, before anyone touched anything:

- **Plain cron** left 9 wrong (missing, half loaded or doubled) and raised no alert.
- **Hardened cron** left 6 missing. The dead-man switch alerted on 2 of the 4 incidents behind them.
- **The Kubernetes CronJob** left 4 missing. After the reboot, a retried pod loaded the wrong day, and both Jobs involved said `Complete`.
- **Kestra** left 1 missing (the poison record). It needed no help otherwise, but a reboot froze its schedule for 6.5 minutes in one run and 11 in the other, before it caught up on its own.
- **Prefect** left 18 missing. The process crash was not retried, and after the reboot a run that no longer existed kept the deployment's only concurrency slot. Nothing ran for 42 minutes, until we forced that run to `Crashed`. A second reboot did the same. With the zombie-run automation from Prefect's docs added, a re-test of the reboot was back to normal 90 seconds later.

So an orchestrator is not automatically safer. What the orchestrators gave us was a record of every run, retries per step, and catch-up and backfill by the scheduled date. What decided whether the data was right was something else: whether the load and the report could be repeated safely. After the repairs, every setup with idempotent writes passed every check our scorer makes: the expected number of rows per day, no order loaded twice, and one report per day. The two without them needed a delete before every rerun, and had sent duplicate reports that nobody can take back.

All of it is reproducible:

```github
https://github.com/The-DevOps-Daily/cron-vs-workflow-lab
```

## TLDR

- Cron runs a command at a time. It has no idea of a run, so it cannot retry one, skip one on purpose, catch up after downtime or tell you anything failed. Everything else is your script.
- `flock`, `timeout`, retries and a dead-man ping fix a lot, but `flock -n` turns an overlap into a silently skipped day, and a dead-man check misses a killed run when the next run succeeds.
- A Kubernetes CronJob retries pods and records Jobs, but a pod that computes "yesterday" from the clock loads the wrong day when it is retried late. After downtime it starts only the most recent missed schedule.
- Kestra recovered every missed schedule with the right date, queued overlaps and duplicates, and has a backfill API. Its weak spot was a reboot mid-run: after the graceful shutdown, it waited out the termination grace period before it resubmitted the stuck task.
- Prefect's task and flow retries do not cover a process crash, and with a deployment concurrency limit, a run orphaned by a reboot blocked every later run until a person intervened. The zombie-run automation from Prefect's docs fixed the stall in our re-test.
- Idempotent writes are what kept the data right in every setup. No scheduler fixes a poison record.

## Prerequisites

- Comfortable with cron, shell scripts and basic SQL
- Some Kubernetes, if you want to follow the CronJob part (`kubectl`, Jobs, Pods)
- To rerun the lab: a disposable Ubuntu 24.04 VM with 4 vCPU and 8 GB RAM, Docker, k3s, and a second machine to drive the failures (the lab reboots and powers off the VM)

## The job and the five setups

The job is the one most teams have somewhere: every night, pull yesterday's orders from an API, clean them, load them into Postgres and send a summary report. In the lab it is one Python file, `etl/etl.py`, with four steps:

1. **extract**: page through `GET /orders?partition=...` (500 to 600 orders, 200 per page) into a file
2. **transform**: parse each amount into cents
3. **load**: write the rows into the setup's `orders` table
4. **report**: `POST /report` with the row count and total

Every setup runs that same file. The load and the report have two modes each, and those modes are the only code difference between the naive and the hardened versions:

```sql
-- --mode append: what most first versions do.
-- Committed every 100 rows, into a table with a surrogate key and no unique constraint.
INSERT INTO orders (order_id, partition, customer, amount_cents) VALUES (...);

-- --mode upsert: one transaction, safe to repeat.
INSERT INTO orders (order_id, partition, customer, amount_cents) VALUES (...)
ON CONFLICT (order_id) DO UPDATE SET customer = EXCLUDED.customer,
  amount_cents = EXCLUDED.amount_cents, loaded_at = now();

-- --report-mode once: claim the partition before sending.
-- Only the run that gets a row back sends the report. The transaction commits after
-- the POST succeeds, so a concurrent duplicate waits on the row lock and then skips.
-- It is not airtight: if the process dies after the POST and before the commit, a rerun
-- sends the report again. The lab never injected that failure.
INSERT INTO reports_sent (partition, run_id) VALUES (...)
ON CONFLICT (partition) DO NOTHING RETURNING partition;
```

The upstream is one small standard-library Python server. It plays the source API (with fault injection), the report sink, a dead-man switch with the [healthchecks.io semantics](https://healthchecks.io/docs/configuring_checks/) (period, grace time, `/start` and `/fail` signals), and an event log that every step of every run writes to. A scorer then checks each partition of each setup against what the API served. Every port the lab publishes binds to 127.0.0.1, because Docker's published ports bypass host firewalls such as ufw, and nothing in the lab needs to be reachable from outside; open the Kestra and Prefect UIs through an SSH tunnel.

| #   | Setup                         | Scheduler settings                                                                                            | Load and report     |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | Plain cron                    | `* * * * *` in `/etc/cron.d`, script with `set -euo pipefail`, output appended to a log file                  | append, always send |
| 2   | Hardened cron                 | `flock -n`, `timeout 240` per step, 3 attempts 10 s and 20 s apart, dead-man pings (period 60 s, grace 120 s) | upsert, send once   |
| 3   | Kubernetes CronJob (k3s 1.37) | `concurrencyPolicy: Forbid`, `startingDeadlineSeconds: 300`, `backoffLimit: 2`, `activeDeadlineSeconds: 240`  | upsert, send once   |
| 3b  | Same CronJob                  | identical                                                                                                     | append, always send |
| 4   | Kestra 2.0.10                 | standalone server and Postgres, 3 attempts per task, flow `concurrency` limit 1 with `QUEUE`                  | upsert, send once   |
| 5   | Prefect 3.9.4                 | server, Postgres and `flow.serve()`, `retries=2` per task, deployment concurrency limit 1 with `ENQUEUE`      | upsert, send once   |

Setup 3b exists for one reason: to show what Kubernetes retries do to a write that is not idempotent.

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "schedule tick", "icon": "activity", "tone": "slate" },
    { "label": "etl.py", "sub": "extract, transform, load, report", "icon": "gear", "tone": "accent" },
    { "label": "warehouse", "sub": "Postgres 17", "icon": "database", "tone": "violet" }
  ],
  "groups": [
    {
      "label": "One 4 vCPU / 8 GB droplet",
      "sub": "Ubuntu 24.04",
      "icon": "server",
      "tone": "blue",
      "groups": [
        { "label": "cron", "sub": "naive + hardened", "icon": "gear", "tone": "slate" },
        { "label": "k3s", "sub": "2 CronJobs", "icon": "k8s", "tone": "blue" },
        { "label": "Kestra", "sub": "server + Postgres", "icon": "branch", "tone": "green" },
        { "label": "Prefect", "sub": "server + Postgres + serve", "icon": "branch", "tone": "amber" }
      ],
      "nodes": [
        { "label": "upstream", "sub": "API, report sink, dead-man, event log", "icon": "globe", "tone": "slate" },
        { "label": "warehouse", "sub": "one schema per setup", "icon": "database", "tone": "violet" }
      ]
    }
  ]
}
```

### One night is one minute

Waiting for real nights was not an option, so the lab compresses time: every setup runs on `* * * * *`, and the run at minute T loads the partition for minute T-1, the same way a nightly job loads yesterday. Each failure is programmed against a partition, so all six setups hit it on the same tick. A normal run takes 3 to 11 seconds. (If you want to check what a schedule expression really does, the [cron expression simulator](/games/cron-expression-simulator) shows the next run times.)

One caveat: in real life a run that starts two minutes late still loads the right day; here it can load the wrong one. We point this out where it matters.

## The results

This is the state after the failures, before anyone helped. The full per-partition table is in [`results/timeline-score.txt`](https://github.com/The-DevOps-Daily/cron-vs-workflow-lab/blob/main/results/timeline-score.txt).

```chart
{
  "type": "bar",
  "title": "Partitions wrong after the failures, out of 34",
  "unit": "",
  "caption": "One run, partitions 17:00 to 17:33 UTC. Wrong means missing, partly loaded or loaded twice. Source: results/timeline-score.json in the lab repo.",
  "rows": [
    { "label": "Plain cron", "value": 9, "series": "cron" },
    { "label": "Hardened cron", "value": 6, "series": "cron" },
    { "label": "CronJob", "value": 4, "series": "Kubernetes" },
    { "label": "CronJob, append", "value": 7, "series": "Kubernetes" },
    { "label": "Kestra", "value": 1, "series": "orchestrator" },
    { "label": "Prefect", "value": 18, "series": "orchestrator" }
  ]
}
```

These are the defaults, plus the settings in the table above. Each tool has settings that change some of these outcomes: on Prefect, an automation that marks orphaned runs `Crashed` (we re-tested that one, see the reboot section); on Kestra, the termination grace period, which decides how long a reboot blocks the schedule; on the CronJob, passing the scheduled time into the pod instead of reading the clock; on cron, a systemd timer with `Persistent=true` for one catch-up run after downtime.

The count hides more than it shows, because the failures are not equal. Here is what each setup did on its own, failure by failure, including the second run described further down:

| Failure                                   | Plain cron                                  | Hardened cron                          | CronJob                                                     | Kestra                                         | Prefect                            |
| ----------------------------------------- | ------------------------------------------- | -------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------- | ---------------------------------- |
| Load dies after 300 of 574 rows           | 300 rows left, no retry                     | retried, correct                       | new pod, correct (append: 874 rows)                         | task retried, correct                          | run `Crashed`, not retried, 0 rows |
| Run takes about 110 s, next tick overlaps | both runs share a work file; slow run fails | next tick skipped by `flock`: day lost | next tick waits, then runs late                             | next tick waits, then runs                     | next run queued, then runs         |
| Poison record                             | fails, no alert                             | 3 attempts, `/fail` alert              | 3 pods, Job `Failed`                                        | 3 attempts, `FAILED`                           | 3 attempts, `Failed`               |
| Manual run during the scheduled one       | rows doubled, 2 reports                     | manual run skipped by `flock`          | runs in parallel, upsert keeps it correct (append: doubled) | queued, correct, 1 report                      | queued, correct, 1 report          |
| Reboot during a run                       | day lost (once the next day too)            | day lost, no alert                     | retried pod loads the wrong day                             | schedule blocked 6.5 to 11 min, then caught up | stuck until a person acts (42 min) |
| Box off for 3 ticks                       | 3 days lost                                 | 3 days lost, 1 late alert              | 2 lost, most recent one run                                 | all recovered                                  | all recovered (second run)         |

The rest of this post goes through these one at a time, then the repairs, then the cost.

## A step that dies halfway

The fault: on partition 17:03, the process running the load calls `os._exit(137)` after 300 of 574 rows, once per setup. That stands in for an OOM kill. Which process that is depends on the setup: in cron, the CronJob and Kestra it is a child process that runs only the load step, while in Prefect the steps run inside the flow-run process. So this test compares execution layouts as much as schedulers, and it is a synthetic exit, not a real OOM or eviction.

**Plain cron** committed every 100 rows, so 300 rows stayed in the table. The script stopped there because of `set -e`, so no report went out, and the next night ran as normal. Nothing tells you that 17:03 is incomplete. Rerunning it by hand would add another 574 rows on top of the 300, because the table has no unique key on `order_id`.

**Hardened cron** retried the step 10 seconds later. The upsert runs in one transaction, so the crash had rolled back the first 300 rows and the second attempt loaded all 574.

**The CronJob** did the same at the pod level: the container exited 137, the Job controller started a second pod, and the upsert made it correct. The append variant (3b) is the cautionary tale: its second pod inserted all 574 rows on top of the 300 the first pod had committed. The Job reports success, and the table holds 874 rows.

**Kestra** retried the `load` task (2 attempts in the execution record) and finished correctly.

**Prefect** marked the whole flow run `Crashed`:

```text
Process exited with status code: 137. Process was killed, likely due to an out-of-memory (OOM) condition.
```

The tasks in a served Prefect flow run inside the flow run's process. Task `retries=2` covers an exception raised by the task, as the poison record showed later, but a dead process takes the run with it, and a crashed run is not retried. Partition 17:03 stayed empty, and the next minute ran normally. No report, no alert unless you build one. If your failures are more likely to be kills than exceptions (memory limits, spot instances), this matters.

## A run that overlaps the next one

The fault: the API answers each page of partition 17:06 after 35 seconds, so that run takes about 105 to 113 seconds and is still going when the next tick fires.

**Plain cron** started the second run on time, and both runs wrote to the same `/var/tmp/etl-naive/raw.jsonl`. The second run truncated the file while the first was still appending to it. The second run finished fine. The first one then read a mix of both and failed:

```text
json.decoder.JSONDecodeError: Expecting ',' delimiter: line 1 column 17 (char 16)
```

Partition 17:06 was lost. A fixed scratch path is in many first versions of a script, and you only see the cost when two runs meet.

**Hardened cron** has strict mode, a cleanup trap and a lock, the habits from our [Bash best practices guide](/guides/introduction-to-bash/10-bash-best-practices). It did what `flock -n` is meant to do. The next run found the lock and exited:

```text
2026-11-20T17:08:01Z previous run still active, skipping 2026-11-20T17:07
```

That is correct from the lock's point of view and wrong from the data's. The skipped run was the only run that would ever load 17:07, so the day was lost. The dead-man switch stayed green, because the slow run and the run after the skip both pinged success within the grace time. `flock` without a wait (`flock -w`) or catch-up logic swaps an overlap for a gap.

**The CronJob** with `concurrencyPolicy: Forbid` logged `JobAlreadyActive` and skipped the tick. Then the docs' fine print applied: "when the previous Job run finishes, `.spec.startingDeadlineSeconds` is still taken into account and may result in a new Job run" ([Kubernetes docs](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)). The skipped Job was created when the slow one finished, 54 seconds late. Its pod computed "the previous minute" from the clock, got 17:07, and was right, but only because it started before the minute ended. We come back to this below.

**Kestra** does not overlap schedules by default. Its schedule trigger "stays locked while its execution runs" ([Kestra docs](https://kestra.io/docs/workflow-components/triggers/schedule-trigger)). The 17:08 execution was created at 17:08:52, right after the slow one finished, with `trigger.date` set to 17:08. Because the flow takes its partition from `trigger.date` rather than the clock, it loaded the right day however late it started.

**Prefect** held the next run back (the serving process logged `Aborted submission ... non-pending state 'SCHEDULED'` while the slot was taken). It ran at 17:09:35, after the 17:09 run, which had found the slot free first. Both loaded the right day anyway, because the flow takes its partition from `scheduled_start_time`, not from the order or the clock.

## A poison record

The fault: one record in partition 17:11 has the amount `"N/A"`, so `Decimal("N/A")` raises in the transform step. This failure is deterministic. Every retry fails the same way.

Every setup lost the partition, which is the right outcome: none of them can know what to do with that record. The differences are in what they spent and what they told you:

- Plain cron: one attempt, a traceback in `/var/log/etl-naive.log`, no alert.
- Hardened cron: 3 attempts, then a `/fail` ping. The dead-man switch went down at 17:12:39, 39 seconds after the tick. This was one of its two alerts in the whole run.
- CronJob: 3 pods, then `BackoffLimitExceeded` 46 seconds after the schedule. The Job is `Failed`, which you see if you look, or if something like kube-state-metrics feeds an alert.
- Kestra: 3 attempts on the `transform` task, execution `FAILED`.
- Prefect: 3 attempts, flow run `Failed`.

Retries are the wrong tool here. The fix lives in the code: validate records, write the bad ones to a quarantine table, and load the rest, so one bad row does not cost you a whole day. The [idempotency and retry lab](/games/idempotency-retry-lab) is a good place to get a feel for which failures a retry can and cannot fix.

## A duplicate run

The fault: 8 seconds into the scheduled run of partition 17:14, someone starts the job by hand, the way each setup is normally started by hand (`./etl.sh`, `kubectl create job --from=cronjob/etl`, a Kestra execution from the API, `prefect deployment run`).

- **Plain cron**: two runs, 1,072 rows instead of 536, two reports.
- **Hardened cron**: the manual run hit the lock and exited. Nothing to clean up.
- **CronJob**: `concurrencyPolicy` did not apply. The docs say it covers "Jobs created by this CronJob", and the controller logged `Saw a job that the controller did not create or forgot: manual-dup-...`. The two pods ran in parallel. The upsert kept the rows right, and the report claim meant one report. The append variant doubled the rows and sent two reports.
- **Kestra**: the flow-level `concurrency` limit applies to every execution, so the manual one went `CREATED > QUEUED > RUNNING > SUCCESS` after the scheduled one. It loaded the same partition again (harmless with the upsert) and did not send a second report.
- **Prefect**: same outcome through the deployment concurrency limit.

The orchestrators serialized the duplicate. Only idempotent writes made it harmless. If you trigger runs by hand, and everyone does during an incident, the load and the side effects need to survive being run twice. [How Stripe avoids double charging](/posts/how-stripe-avoids-double-charging-idempotency-keys) covers the same idea for API calls.

## The host reboots during a run

The fault: partition 17:18 is slow (20 seconds per page), and 25 seconds into its run we ran `systemctl reboot`. The box was back on SSH in 36 seconds. This was the most revealing failure.

**Plain cron** lost 17:18, the killed run. It also lost 17:19: cron started at 17:19:57 and fired the 17:20 run at 17:20:01, but Docker, and with it the API and Postgres, only came up at 17:20:13. The script failed with `Connection refused`. A boot-order race is an easy way to lose the first run after any reboot.

**Hardened cron** also lost 17:18, but its retry outlasted the boot race: the first attempt failed, the second, 10 seconds later, loaded 17:19. The dead-man switch did not notice the killed run. It had a `/start` from 17:19:00 without a matching success, but the next run sent a success at 17:20:21, well inside the 120-second grace time. Run IDs would not have helped: healthchecks.io's `rid` parameter pairs starts with successes to measure duration, but its grace-time check "will only monitor the execution time of the most recently started run" ([docs](https://healthchecks.io/docs/measuring_script_run_time/)). To catch a killed run, the job has to record each finished partition, and something has to check for days without one.

**The CronJob** made the most dangerous mistake in the whole lab. The Job for the 17:19 schedule lost its pod in the reboot. When k3s came back, the Job controller started a replacement pod at 17:20:40. That pod computed "the previous minute" from the clock, which was now 17:19, not 17:18. Then the Job for 17:20 started too, after waiting for the first one (`JobAlreadyActive`), and also loaded 17:19:

```text
setup       partition          exp  rows  dist rep runs err crash  verdict
k8s         2026-11-20T17:18   575     0     0   0    1   0     0  missing
k8s         2026-11-20T17:19   580   580   580   1    2   0     0  ok
k8s_append  2026-11-20T17:18   575     0     0   0    1   0     0  missing
k8s_append  2026-11-20T17:19   580  1160   580   2    2   0     0  dup
```

Both Jobs show `Complete`. Nothing anywhere says that 17:18 was never loaded. With real nights, a retried pod only crosses into the wrong day near midnight. That is less likely, not impossible, and it is a quiet way to lose data. Kubernetes has the fix half built: since v1.32, a CronJob puts the scheduled time on each Job as the `batch.kubernetes.io/cronjob-scheduled-timestamp` annotation. The pod does not see it unless you pass it in yourself.

**Kestra** kept the interrupted execution in `RUNNING`, and because the trigger is locked while its execution runs, the schedule stopped. The log repeated this every 10 seconds:

```text
No execution found, schedule is blocked since '2026-11-20T17:19:00.490197Z'
```

`systemctl reboot` shuts services down gracefully, and Kestra logged `Shutdown signal received. Initiating graceful shutdown.` at 17:19:28. Per the [server lifecycle docs](https://kestra.io/docs/administrator-guide/server-lifecycle), the tasks of a worker that stopped this way are resubmitted only after the termination grace period, so that a worker that comes back does not run them twice. Kestra logged `Resubmit WorkerTask` at 17:29:17, the blocked execution loaded its partition at 17:30:23, and then the trigger worked through every schedule it had missed: 13 partitions in 80 seconds, all with the right dates, no duplicates. In this run the wait overlapped with the power-off below, so the second run (further down) measures the reboot on its own.

**Prefect** is where the reboot did the most damage. The flow run that was executing stayed `Running`, because nothing was left to report that it died. Prefect calls this a zombie run. On Prefect Cloud a built-in policy catches it; self-hosted, you add an automation yourself (see the box below). We had not.

On its own that would cost one partition. Combined with the deployment concurrency limit, it cost everything after it. The zombie held the deployment's only slot, and every later run went to `AwaitingConcurrencySlot`:

```text
prefect.runner.state_proposer - Aborted submission of flow run '01a1f9f9-...': Server returned a non-pending state 'SCHEDULED'
```

The slot never came back by itself. Prefect hands out concurrency slots with a lease that the running process renews, and an expired lease releases the slot. Our reading of what happened: this server kept its leases in memory (`PREFECT_SERVER_CONCURRENCY_LEASE_STORAGE` defaults to the in-memory store), the server had rebooted too, so the lease that should have expired was gone, while the database still said `active_slots: 1`. We left it alone until 17:56, 37 minutes after the reboot, then started the repair described below. No run started between 17:19 and 18:01.

:::tip
**How to avoid this in Prefect.** The stall above is Prefect 3.9.4 with defaults, and Prefect documents the fix. We re-ran only this failure on a fresh box, once with and once without it ([`results/prefect-reboot-*.txt`](https://github.com/The-DevOps-Daily/cron-vs-workflow-lab/tree/main/results)):

- **Tested: the zombie-run automation.** Flow runs send heartbeats by default (`PREFECT_FLOWS_HEARTBEAT_FREQUENCY`, 180 s). The [docs' automation](https://www.prefect.io/docs/v3/advanced/detect-zombie-flows) marks a run `Crashed` when no flow-run event follows a heartbeat in time; it is in the repo as `setups/5-prefect/zombie-automation.py`. With 30-second heartbeats and the docs' 90-second window, a run orphaned by a reboot at 13:54:50 was marked `Crashed` at 13:56:00, which released the slot, and the next run started at 13:56:20. The orphaned day itself was still lost. In the control run on the same box, with default heartbeats and the automation paused, the slot was still held 13 minutes after the reboot, when we stopped watching. With the default 180-second heartbeat, the docs suggest a 540-second window, which would mean a stall of up to about 9 minutes (not tested).
- **Tested: flow retries do not cover this.** With `@flow(retries=1)`, a run whose process exited with 137 still ended `Crashed` after one attempt.
- **Not tested: a lease store that survives a restart.** `PREFECT_SERVER_CONCURRENCY_LEASE_STORAGE` selects it (default: the in-memory store); the `prefect-redis` integration ships a Redis one.
- **Not tested: `collision_strategy: CANCEL_NEW`.** It cancels runs that cannot get a slot instead of queueing them, which avoids a backlog like our 45 runs but not the stall.

:::

## The machine is down while schedules pass

The fault: `systemctl poweroff` at 17:25:20, power on through the DigitalOcean API at 17:27:50. The box booted at 17:28:09. Three ticks (17:26, 17:27, 17:28) passed while it was off.

**Cron** does not remember time it was not running. Both cron setups lost partitions 17:25, 17:26 and 17:27. The hardened setup's dead-man switch went `down` at 17:28:21 with reason `late`, then `up` at 17:29:09 when the next run succeeded. One alert for three lost days, and in this lab it fired after boot, because the dead-man ran on the same box. A hosted check would have fired while the box was still off. (If you have cron on systemd hosts, a timer with `Persistent=true` runs once after boot for a missed schedule. Once, not three times.)

**The CronJob** came back with the cluster, saw three missed schedules within its 300-second `startingDeadlineSeconds`, and started one Job, for the most recent one, at 17:28:39. The docs describe exactly this: "Jobs for the earlier missed schedules are never started". Partitions 17:25 and 17:26 were lost, 17:27 was loaded.

**Kestra** was still blocked from the reboot, so this run cannot separate the two failures. Its default `recoverMissedSchedules: ALL` is documented as running every missed schedule "as soon as the server is back up", and the second run below confirms it.

**Prefect** was still stuck.

## The second run: power-off and reboot, apart

In the first run, the power-off came while Kestra and Prefect were still stuck from the reboot, so it could not show what they do with missed schedules. We ran both failures again with [`lab/timeline-repeat.sh`](https://github.com/The-DevOps-Daily/cron-vs-workflow-lab/blob/main/lab/timeline-repeat.sh): first a power-off while no run was active (`poweroff` at 18:28:20, booted at 18:31:11, three ticks missed), then six normal ticks, then a reboot 25 seconds into a 60-second run. The score is in [`results/timeline-repeat-score.txt`](https://github.com/The-DevOps-Daily/cron-vs-workflow-lab/blob/main/results/timeline-repeat-score.txt).

The power-off on its own:

- **Both cron setups** lost the three partitions again. The dead-man switch alerted at 18:31:26, 15 seconds after boot.
- **The CronJob** created one Job, for the 18:31 schedule, at 18:31:44, and lost 18:28 and 18:29.
- **Kestra** loaded all three missed partitions by 18:32:59, under two minutes after boot, each with its own `trigger.date`.
- **Prefect** loaded all three by 18:32:54. Its scheduler creates runs ahead of time (at least three, and at least an hour ahead, [per the docs](https://www.prefect.io/docs/v3/automate/add-schedules)), so after boot those runs were simply late, and each ran with its own scheduled time.

The reboot on its own:

- **Both cron setups** lost the killed partition, 18:37. This time the first run after boot succeeded in both, so the boot race from the first run is a race, not a rule.
- **The CronJob** repeated the wrong-day load. The 18:38 Job lost its pod, and the replacement pod loaded 18:38 instead of 18:37. The append variant ended with 1,072 rows for 18:38 and none for 18:37. Both Jobs say `Complete`.
- **Kestra** logged `Resubmit WorkerTask` at 18:43:34, 5 minutes and 9 seconds after the reboot, which fits the 5-minute default termination grace period. The schedule was blocked from 18:38:00 until 18:44:39, then it caught up 8 partitions by 18:45:23. Nothing was lost.
- **Prefect** deadlocked again, the same way. When the run ended 15 minutes later, `active_slots` was still 1 and 15 partitions were missing.

Two samples are not a distribution, but all three patterns (the CronJob's wrong-day load, Kestra's block-then-catch-up, Prefect's stuck slot) happened twice.

## Backfilling three missed days

After the first run, the cron setups were missing the three outage partitions and the CronJob two of them. Here is what a backfill looks like in each setup, adapted from [`lab/recover.sh`](https://github.com/The-DevOps-Daily/cron-vs-workflow-lab/blob/main/lab/recover.sh):

```tabs
{
  "title": "Backfill 17:25, 17:26 and 17:27 (as root on the lab box, from /opt/lab)",
  "tabs": [
    {
      "label": "Plain cron",
      "lang": "bash",
      "code": "set -a; . ./.env; set +a          # DATABASE_URL\n# stop cron, then wait for a run that is still going: they share /var/tmp/etl-naive\nmv /etc/cron.d/etl-naive /root/\nwhile pgrep -f 1-cron-naive/etl.sh >/dev/null; do sleep 2; done\nfor p in 17:25 17:26 17:27; do\n  # append-only table: delete first, or the rerun doubles the rows\n  psql \"$DATABASE_URL\" -c \"DELETE FROM naive.orders WHERE partition = '2026-11-20T$p'\"\n  PARTITION=2026-11-20T$p setups/1-cron-naive/etl.sh\ndone\nmv /root/etl-naive /etc/cron.d/\n# then backfill the ticks that passed while cron was stopped"
    },
    {
      "label": "Hardened cron",
      "lang": "bash",
      "code": "set -a; . ./.env; set +a\n# idempotent, so a loop is safe. But the script exits 0 when it finds the lock taken,\n# and a long loop can make the scheduled run skip a day, so check the result after.\nfor p in 17:25 17:26 17:27; do\n  PARTITION=2026-11-20T$p setups/2-cron-hardened/etl.sh\ndone\npsql \"$DATABASE_URL\" -c \"SELECT partition, count(*) FROM hardened.orders\n  WHERE partition >= '2026-11-20T17:20' GROUP BY 1 ORDER BY 1\""
    },
    {
      "label": "CronJob",
      "lang": "bash",
      "code": "# kubectl create job --from cannot set env vars: render, patch, apply\nfor p in 17:25 17:26; do\n  kubectl -n lab create job --from=cronjob/etl bf-${p/:/} --dry-run=client -o json |\n    jq --arg p \"2026-11-20T$p\" '.spec.template.spec.containers[0].env += [{name: \"PARTITION\", value: $p}]' |\n    kubectl apply -f -\ndone\nkubectl -n lab wait --for=condition=complete --timeout=300s job/bf-1725 job/bf-1726"
    },
    {
      "label": "Kestra",
      "lang": "bash",
      "code": "set -a; . ./.env; set +a          # KESTRA_USER, KESTRA_PASSWORD\n# built in: replay the schedule between two dates (both ends included)\ncurl -X PUT -u \"$KESTRA_USER:$KESTRA_PASSWORD\" localhost:8088/api/v1/main/triggers/backfill/create \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"namespace\": \"lab\", \"flowId\": \"etl\", \"triggerId\": \"nightly\",\n       \"backfill\": {\"start\": \"2026-11-20T17:26:00Z\", \"end\": \"2026-11-20T17:28:00Z\"}}'"
    },
    {
      "label": "Prefect",
      "lang": "bash",
      "code": "# no backfill command for deployments: one run per partition, with a parameter.\n# The Prefect CLI and its API credentials live in the serving container.\nfor p in 17:25 17:26 17:27; do\n  docker exec lab-prefect-etl-serve-1 \\\n    prefect deployment run etl/nightly --param partition=2026-11-20T$p\ndone"
    }
  ]
}
```

Kestra had recovered those three partitions on its own, so we ran its backfill over them anyway to see what it does. It created three executions 5 seconds apart, with `trigger.date` set to 17:26, 17:27 and 17:28 (so the end date is inclusive), and labelled them. The docs warn that a backfill "also replays intervals that already succeeded", which is why it needs idempotent loads. Here the upsert left the rows as they were and the report claim stopped three duplicate reports. The [Kestra docs](https://kestra.io/docs/concepts/backfill) also describe the same backfill from the UI.

For the CronJob, our post on [triggering a Kubernetes CronJob manually](/posts/trigger-kubernetes-scheduled-job-manually) covers `kubectl create job --from`; a backfill also needs the date, so patch the rendered Job as above.

## What a person had to do

Finding the damage was the first job. Our scorer compares every partition with the source, which most teams do not have. Without it, plain cron shows nothing at all, hardened cron points at 2 of its 4 incidents, and the CronJob shows only the poison record as a `Failed` Job: its reboot and outage losses are missing Jobs and a Job that succeeded on the wrong day. Kestra and Prefect show every run and its state, so the damage is visible in their UIs.

Then the repairs, all in [`lab/recover.sh`](https://github.com/The-DevOps-Daily/cron-vs-workflow-lab/blob/main/lab/recover.sh), with what went wrong along the way. We stood in for "the upstream fixed the bad record" by clearing the poison fault.

| Setup         | What we ran                                                    | What went wrong during the repair                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plain cron    | delete each bad partition, rerun it with `PARTITION=...`       | The 105-second rerun of 17:06 shared `/var/tmp/etl-naive` with the scheduled 17:52 run and failed again. Second attempt: stop cron, rerun 8 partitions (225 s), restart cron, backfill the 3 ticks that passed while it was stopped (12 s more). Partition 17:14 has now had 3 reports sent.                                                                                                                                         |
| Hardened cron | loop over 6 partitions with `PARTITION=...` (84 s)             | The loop held the lock at 17:53:00, so the scheduled run skipped 17:52. Rerunning 17:52 at 18:03:57 then skipped 18:03. The third rerun was timed to start 15 s after a tick.                                                                                                                                                                                                                                                        |
| CronJob       | 4 Jobs rendered with `PARTITION`, `kubectl wait` (68 s)        | Nothing. The append variant needed a delete before each Job, and its reports for 17:03, 17:14 and 17:19 had already gone out 2 or 3 times.                                                                                                                                                                                                                                                                                           |
| Kestra        | restart the failed execution                                   | Restarting from the failed task reused the extracted file, which still held the poison record, so it failed a fourth time. A new execution with the partition as input fixed it. (The single-execution `restart` endpoint answered 404 `Requested Flow is not found` on 2.0.10; the bulk `restart/by-ids` endpoint worked.)                                                                                                          |
| Prefect       | free the slot, rerun 3 partitions with `--param partition=...` | `prefect flow-run cancel` moved the zombie to `Cancelling`, and it was still there 4 minutes later, because no process was left to cancel. Forcing it to `Crashed` (`set_flow_run_state(..., force=True)`) released the slot. The 45 queued runs then drained one at a time over 22 minutes (a waiting run retries for the slot every 30 seconds by default), each with its own scheduled date, so they loaded the right partitions. |

The surprise: on cron, the repair is a second source of the same failures, because the backfill shares the lock and the scratch files with the schedule. On the orchestrators, the obvious buttons misled us: "restart from the failed task" reused bad input, and "cancel" did nothing for a run whose process was gone.

## What each setup costs

The other side of the trade is what you have to run. We measured the anonymous (non-cache) memory of each setup's cgroups, 18 samples over 3 minutes after the second run, and counted the non-comment lines of configuration we wrote ([`results/footprint.jsonl`](https://github.com/The-DevOps-Daily/cron-vs-workflow-lab/blob/main/results/footprint.jsonl)):

| Setup         | Always running                                                                                        | Idle memory, median | Configuration we wrote                                | What else you now operate                                   |
| ------------- | ----------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| Plain cron    | `cron`                                                                                                | 0.25 MiB            | 1-line crontab, 10-line script                        | nothing                                                     |
| Hardened cron | `cron`                                                                                                | 0.25 MiB            | 1-line crontab, 29-line script                        | a dead-man check, ideally hosted elsewhere                  |
| CronJob       | k3s (API server, controllers, kubelet and containerd in one process), CoreDNS, local-path provisioner | 602 MiB             | 31 lines of YAML per CronJob, a 5-line Dockerfile     | the cluster, its datastore and its upgrades                 |
| Kestra        | Java server, Postgres                                                                                 | 1,429 MiB           | 52-line compose file, 77-line flow, 5-line Dockerfile | Kestra's database and storage, its upgrades                 |
| Prefect       | API server, Postgres, the serving process                                                             | 307 MiB             | 37-line compose file, 38-line flow, 5-line Dockerfile | Prefect's database, its upgrades, the zombie-run automation |

Two notes on the numbers. Kestra's figure is mostly the JVM with its default heap settings, and it includes Kestra's own Postgres. Prefect's serving process was idle during the sample (it was stuck from the second reboot); a run adds a Python process while it executes. The shared upstream and the warehouse are not in any row.

Memory is the smaller cost. The bigger one showed up in the repairs: for cron, you need to know your own script; for an orchestrator, you need to know the orchestrator's restart behavior, lease store and recovery endpoints. Only the second is documented by someone else.

## When cron is enough, and when to move

Start with the rules that held in every setup, because no scheduler did them for us:

- [ ] **The partition comes from the scheduled time, never from the clock.** Pass it in (`trigger.date`, `scheduled_start_time`, the CronJob's scheduled-timestamp annotation, or a `PARTITION` variable for cron).
- [ ] **Loads can run twice.** Upsert on a business key, or replace the whole partition in one transaction.
- [ ] **Side effects can run twice.** Claim the report, the email or the webhook in the database before you send it, and send a stable key (the partition) so the receiver can drop a repeat. The claim alone leaves a window between the send and the commit.
- [ ] **One bad record does not fail the day.** Quarantine it and load the rest.
- [ ] **Something alerts on silence, not only on failure**, from outside the box that runs the job.

Cron, with the hardening, is enough when all of these are true:

- [ ] The job is one step, or rerunning it from the start costs little.
- [ ] A run always finishes well inside the interval, so `flock` never has to skip one.
- [ ] A lost day can wait until a person notices, or the job loads "everything since the last success" instead of "yesterday", so the next run catches up on its own.
- [ ] Backfills are rare, and a loop over `PARTITION` values is an acceptable way to do them.
- [ ] The dead-man check is hosted elsewhere, and something also checks that every day has a finished load, because a later success hides a killed run.
- [ ] Losing the run that was in progress during a reboot is acceptable.

Move to an orchestrator when any of these is true:

- [ ] You need to know, for each day, whether it ran and how it ended, without reading logs.
- [ ] Schedules missed during downtime must run afterwards, each with its own date.
- [ ] You backfill date ranges often enough that a loop is a liability.
- [ ] Steps are expensive, and a failure in step 4 should not repeat steps 1 to 3.
- [ ] Jobs depend on each other: B runs for a day only after A succeeded for that day.
- [ ] Several people trigger runs by hand, and they need a queue and a history.

If you already run Kubernetes, the CronJob sits in between: you get retries, history and a concurrency policy for free, but you still need the partition passed in, idempotent writes, and alerts on failed Jobs and on Jobs that never got created.

And before you trust an orchestrator, run the failure that hurt both of ours: **reboot the box in the middle of a run** and watch what happens to that run, to the schedule, and to any concurrency limit. On Kestra, look at the termination grace period (`kestra.server.terminationGracePeriod`). On self-hosted Prefect, set up the zombie-run automation from the docs (it turned a 42-minute stall into 90 seconds in our re-test), and check where concurrency leases are stored.

Request-driven work (a signup, a payment) is a different problem. Durable execution engines such as Temporal and Inngest are built for it, and we covered them in [Running a Background Job That Must Not Be Lost](/posts/running-a-background-job-that-must-not-be-lost).

## What we could not conclude

- **Time is compressed.** One night is one minute. A run that starts a minute late lands in the wrong partition here, which with real nights only happens near midnight. The CronJob's wrong-day load is real, but compression makes it far more likely than it would be in production.
- **One box.** The reboot and the power-off hit every setup at once, and the dead-man switch, on the same box, could only alert after boot.
- **Single-node k3s.** The reboot took down the control plane and the node together. A multi-node cluster replaces pods from a failed worker only after the node is declared unreachable; we did not test that.
- **Two samples at most.** Each failure ran once in the first run, and the reboot and the power-off ran again in the second. Timings such as Kestra's 11-minute block will vary.
- **Mostly defaults.** We set the obvious options (retries, concurrency limits, deadlines) and left the rest at defaults. Apart from Prefect's zombie-run automation (re-tested once, above), we did not test the settings that would change the outcomes: a shorter Kestra termination grace period, a Redis lease store or workers instead of `serve()` for Prefect, the scheduled-timestamp annotation for the CronJob. (Kestra's `workerTaskRestartStrategy: IMMEDIATELY` would probably not have helped: the docs say a worker that terminates gracefully, as in a reboot, still gets the full grace period.)
- **Two orchestrators out of four.** We picked Kestra and Prefect because they were the quickest to self-host: one server plus Postgres for Kestra, and a server, Postgres and one serving process for Prefect. Dagster's documented Docker deployment has four long-running services (Postgres, a user code server, the webserver and the daemon that creates scheduled runs), and Windmill's compose file has six (Postgres, server, two kinds of workers, an extra service for the editor, and Caddy). That is about setup effort, not features; Dagster's partitions and backfills deserve their own test.
- **Versions.** Kestra 2.0.10, Prefect 3.9.4, k3s v1.37.2, Postgres 17.6, Ubuntu 24.04 cron.

## Summary

Cron starts a command at a time and forgets about it. Everything that makes a nightly job dependable (knowing the date it is for, retrying a step, not overlapping, catching up, being backfilled, telling someone) is either your script's job or a scheduler's job, and cron leaves all of it to the script.

The hardened script closes most of the gap, but the lock skips days, the dead-man check misses a killed run, and a backfill can collide with the schedule. The CronJob adds retries and history, and quietly loads the wrong day if the pod computes its own date. Kestra and Prefect remember every run and its scheduled date, which made catch-up and backfill correct, and both needed a setting or a person after a reboot mid-run.

So the question is not cron or orchestrator. It is how many of the checklist items above you are willing to own in shell. Pass the partition in, make every write repeatable, alert on silence from somewhere else, and then decide whether you want a scheduler that remembers. Everything here, including the raw logs and the scoring, is in the [cron-vs-workflow-lab repository](https://github.com/The-DevOps-Daily/cron-vs-workflow-lab), so you can rerun it against your own choices.
