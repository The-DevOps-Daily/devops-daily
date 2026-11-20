---
title: 'Terraform Drift Detection, Measured: What a Scheduled Plan and a Cloud Inventory Each Miss'
excerpt: 'We made 12 kinds of drift on a real DigitalOcean stack, the way people make them: a console edit, a DNS hotfix, a deleted tag, resources created by hand. A scheduled refresh-only plan caught 7, a cloud inventory diff caught 6, and together they caught 10. One change got past both for good, and one for about ten minutes. Here is what each method misses, how long detection takes, what import blocks do with the leftovers, and a drift budget to finish with.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2026-11-23'
publishedAt: '2026-11-23T15:00:00Z'
updatedAt: '2026-11-23T15:00:00Z'
readingTime: '19 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Terraform
  - OpenTofu
  - Drift Detection
  - IaC
  - DigitalOcean
  - CI/CD
---

We made 12 kinds of drift on a small DigitalOcean stack managed by Terraform, the way people make it: a firewall rule opened during an incident, a DNS record repointed in a hurry, a tag removed in a cleanup, records, firewalls and droplets created by hand. Then we checked each change with Terraform, OpenTofu and a cloud inventory, and measured what each one reported.

A scheduled `terraform plan -refresh-only -detailed-exitcode` caught 7 of the 12 for the right reason (an eighth only through a side effect on a counter). A cloud inventory diff, the approach driftctl made popular, caught 6. Three of those overlap, so together they caught 10. Two changes got past both: a droplet created by hand with no tags, which nothing ever reported, and backups switched on outside Terraform, which the plan only showed 4 to just over 10 minutes later, because the API field it reads lags behind. OpenTofu 1.13 gave the same answer as Terraform 1.17 on every one.

This post shows which drift each method sees, why, how long detection takes on a schedule, what import blocks do with the leftovers, and ends with a drift budget: what to revert automatically, what to import, and what to send to a person.

## TL;DR

- **The plan sees edits to what it owns.** Firewall rules, DNS values, tags, deletes and project moves all showed up in a refresh-only plan within one run. It cannot see anything that is not in state: a hand-made DNS record in a managed zone, a second firewall on the managed droplet, a debug droplet. Those three were invisible to every plan we ran.
- **The inventory sees what the plan cannot.** Comparing resource IDs in DigitalOcean with IDs in state found every resource created or deleted by hand inside its scope; the deletes and the new tag the plan saw too. It missed every attribute change, because it compares IDs only, and the untagged droplet, because it was outside the scope.
- **A clean stack can exit 2.** `plan -refresh-only -detailed-exitcode` exited 2 on a stack with no drift after 5 of 23 revert applies, because counters like a tag's `droplets_count` change after an apply. Dropping drift that touches only computed attributes, using the provider schema, removed 3 of those 5 false alarms.
- **Removing a tag removed the firewall.** The firewall targets droplets by tag. 30 seconds after someone removed the tag, port 22 on the droplet answered from another server. The plan's only planned change was the droplet's tag list; the firewall showed nothing but computed status fields.
- **Import blocks adopt cleanly in Terraform, not yet in OpenTofu.** `-generate-config-out` produced config for a droplet, a firewall, a record and a tag that planned with zero changes in Terraform. OpenTofu wrote `tag = ""` for the DNS record, which fails validation until you delete that line.
- **Some settings reach the plan late.** The provider reads `backups` from the droplet's `features` list, which caught up 4 to just over 10 minutes after each toggle (four direct measurements and one inferred from the matrix). The backup policy endpoint was right at the first poll every time we checked it.
- **Time to detect is your schedule.** With a plan every 10 minutes and an inventory every 2 for an hour, drift the inventory owns was reported 17 and 40 seconds after it landed, drift only the plan sees after 3 to 10 minutes. The untagged droplet was never reported.

## Prerequisites

- For the techniques: Terraform 1.5 or later (import blocks and `-generate-config-out`) or OpenTofu 1.6 or later
- For the lab: Terraform 1.6 or later and OpenTofu (we used 1.17.2 and 1.13.9; the scripts run both), doctl (2.7.0) and Python 3.10 or later
- A DigitalOcean token with read and write access to droplets, firewalls, tags, domains, projects and SSH keys, if you want to run the lab
- A zone name under a domain you control; the lab never delegates it, so no real DNS changes
- About $0.006 an hour for the droplet while the lab runs, plus DigitalOcean's $0.01 minimum for each droplet the scenarios create

## The lab

The [companion repository](https://github.com/The-DevOps-Daily/terraform-drift-lab) creates ten resources: a `s-1vcpu-512mb-10gb` droplet, a firewall that applies to every droplet tagged `dl-web`, two tags, an SSH key, a DNS zone with three records (A, CNAME, TXT) and a project that holds the droplet and the zone. The firewall allows port 22 only from `203.0.113.0/24`, a documentation range, so in practice nobody can reach SSH.

```diagram
{
  "type": "infra",
  "groups": [
    {
      "label": "project drift-lab",
      "sub": "managed by Terraform",
      "icon": "box",
      "tone": "blue",
      "nodes": [
        { "label": "droplet dl-web-1", "sub": "tags dl-web, dl-env-lab", "icon": "server", "tone": "blue" },
        { "label": "zone tf-drift-lab", "sub": "app, www, @ TXT", "icon": "globe", "tone": "violet" }
      ]
    },
    {
      "label": "account level",
      "sub": "managed by Terraform",
      "icon": "cloud",
      "tone": "slate",
      "nodes": [
        { "label": "firewall dl-web", "sub": "targets tag dl-web", "icon": "shield", "tone": "green" },
        { "label": "tags, SSH key", "icon": "lock", "tone": "slate" }
      ]
    }
  ]
}
```

If `-detailed-exitcode`, `-refresh-only` and `ignore_changes` are new to you, [how to find out state no longer matches reality](/posts/who-owns-the-terraform-state-file#h2-question-3-how-do-you-find-out-state-no-longer-matches-reality) explains them on a local example. This post is about what those checks miss on a real cloud.

`matrix.py` runs each drift on its own. It checks that the lab is clean (a normal plan and a refresh-only plan both exit 0, the inventory finds nothing), makes one change with `doctl`, waits five seconds and then runs four detectors one after the other, about 10 seconds in all: Terraform refresh-only, a normal Terraform plan, OpenTofu refresh-only against a copy of the same state, and `inventory.py`. Then it deletes whatever was made by hand, applies, and starts the next one. We ran eleven of them twice and `backups-enabled` once, for reasons the backups section explains. We wrote down what we expected before the first measured run and committed it first (`results/predictions-matrix.md`).

```github
https://github.com/The-DevOps-Daily/terraform-drift-lab
```

## The 12 drifts

| Scenario                 | What we did with doctl                           | The real-life version                          |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------- |
| firewall-rule-added      | add an inbound rule for port 22 from `0.0.0.0/0` | "open SSH for five minutes" during an incident |
| dns-hotfix               | point `app` at another IP, TTL 1800 to 60        | failover to a standby during an outage         |
| tag-removed              | remove `dl-web` from the droplet                 | a tag cleanup                                  |
| tag-added                | create `dl-owner-oncall` and attach it           | someone tags the droplet in the console        |
| record-deleted           | delete the TXT record                            | "unused" record removed in a DNS cleanup       |
| record-created           | add an A record `debug` in the zone              | a debug record nobody writes down              |
| firewall-created         | a second firewall opening 8080 on the droplet    | a quick fix that becomes permanent             |
| droplet-created-tagged   | a copy of the web droplet with tag `dl-web`      | a debug copy of production                     |
| droplet-created-untagged | a droplet with no tags in the default project    | a scratch box                                  |
| backups-enabled          | turn on droplet backups                          | a console toggle that costs money              |
| project-moved            | move the droplet to the default project          | a console tidy-up                              |
| firewall-deleted         | delete the managed firewall                      | the worst one on the list                      |

## What the plan catches

This is what each detector reported. "Yes" means the detector flagged the drift, with the resource and the attributes it named. The verdicts were the same in both rounds. Some runs also listed extra computed attributes (covered in the next section), and in round 2 the plans for `record-deleted` also showed the backups change left over from the scenario before it.

| Scenario                 | refresh-only plan (Terraform and OpenTofu)           | normal plan                 | inventory               |
| ------------------------ | ---------------------------------------------------- | --------------------------- | ----------------------- |
| firewall-rule-added      | yes: `firewall.web` (`inbound_rule`)                 | yes: update `firewall.web`  | no                      |
| dns-hotfix               | yes: `record.app` (`ttl`, `value`)                   | yes: update `record.app`    | no                      |
| tag-removed              | yes: `droplet.web` (`tags`)                          | yes: update `droplet.web`   | no                      |
| tag-added                | yes: `droplet.web` (`tags`)                          | yes: update `droplet.web`   | yes: unmanaged tag      |
| record-deleted           | yes: `record.verify` deleted                         | yes: create `record.verify` | yes: missing record     |
| record-created           | no                                                   | no                          | yes: unmanaged record   |
| firewall-created         | no                                                   | no                          | yes: unmanaged firewall |
| droplet-created-tagged   | only through a counter: `tag.web` (`droplets_count`) | no                          | yes: unmanaged droplet  |
| droplet-created-untagged | no                                                   | no                          | no                      |
| backups-enabled          | no (within 5 s, see below)                           | no                          | no                      |
| project-moved            | yes: `project.lab` (`resources`)                     | yes: update `project.lab`   | no                      |
| firewall-deleted         | yes: `firewall.web` deleted                          | yes: create `firewall.web`  | yes: missing firewall   |

The pattern is simple once you see it. A plan refreshes the resources in state and nothing else. For each one it asks the provider to read the object back and compares. An edit to anything the provider reads back shows up: a rule, a value, a tag list, the list of resources in a project. A resource that is not in state never gets read, so a plan cannot report it. That is why `record-created`, `firewall-created` and both hand-made droplets never appeared in a plan as resources. Two refresh-only plans still exited 2 next to them, for side effects: the tagged droplet raised a tag counter, and in round 2 the new firewall moved the managed firewall's computed `status`. The zone resource does not list its records, and the droplet resource does not list the firewalls that apply to it.

Our predictions got two of the twelve wrong. We expected the plan to catch `backups-enabled` (it did not, within five seconds) and to miss `droplet-created-tagged` (the refresh-only plan caught it by accident, because the new droplet raised the `dl-web` tag's `droplets_count` from 1 to 2). A normal plan does not count that as a change, and the filter in the next section removes it on purpose, so do not count on it.

OpenTofu 1.13.9 and Terraform 1.17.2 flagged the same resources in every scenario; the only differences were computed attributes that moved between two runs a few seconds apart. That is expected: both run the same DigitalOcean provider (2.108.0), and the provider decides what a refresh reads. If you are weighing the two, the [Terraform vs OpenTofu comparison](/comparisons/terraform-vs-opentofu) and [OpenTofu in 2026](/posts/opentofu-2026-switch-from-terraform) cover the differences that do matter.

## A clean stack can exit 2

The first refresh-only plan we ran, right after the first apply, exited 2 on a lab nobody had touched:

```text
digitalocean_tag.env {'total_resource_count': (0, 1), 'droplets_count': (0, 1)}
digitalocean_tag.web {'total_resource_count': (0, 1), 'droplets_count': (0, 1)}
```

Terraform created the tags before the droplet, wrote their counters (0) to state, and then attached them to the droplet. The next refresh read the new counters, and a refresh-only plan reports any difference between state and the real object as a change, so `-detailed-exitcode` returned 2. A normal plan exits 0 here, because no argument in the code differs from reality.

`matrix.py` records the refresh-only plan right after every revert apply. Out of 23 revert applies, 5 left the stack in this state:

- 2 after `tag-removed`: the tag counters again.
- 1 after `droplet-created-tagged`: the firewall's `status` and `pending_changes`, while DigitalOcean applied the firewall to one droplet fewer.
- 2 after `firewall-deleted`: `droplet_ids` on the recreated firewall.

A scheduled check that pages on exit 2 would have paged on all five. There are two ways to quiet it. One is to run `terraform apply -refresh-only` right after every deploy, so state starts from what the API reports. Be careful with it: it accepts everything it finds into state, real drift included, so read its plan first, and accept it only when the only changes are the counters the apply just caused. After that, a refresh-only check compares reality with the new state, not with your code, so anything it accepted goes quiet. The last three baselines in `matrix-20261120T115337Z.jsonl` show the same blind spot from another direction: refresh-only exited 0 because state and the API both said backups were on, and only a normal plan, which compares with the code, exited 2. If anyone on the team runs `apply -refresh-only`, add a normal plan to the drift job; our `check.py` runs only the refresh-only plan. The other way is to filter the plan. The provider publishes which attributes are computed-only (`terraform providers schema -json`: `computed` true, `optional` and `required` false). `check.py` in the repo drops a drifted resource when every attribute that changed is one of those. That removes the counters and the firewall status, 3 of the 5. It does not remove `droplet_ids`, an optional argument the code does not set, so 2 of the 5 false alarms still get through. Filter, then look at what is left.

## Removing a tag removed the firewall

`tag-removed` looks harmless in the plan: one droplet whose tag list lost an entry. The impact is somewhere else. The firewall applies to droplets tagged `dl-web`, so the droplet without the tag has no firewall at all. `exposure.py` measured it from another server, connecting to port 22 on the droplet:

```terminal
{
  "title": "exposure.py (results/exposure-20261120T122350Z.json, abridged)",
  "prompt": "$",
  "steps": [
    { "comment": "firewall in place: port 22 is open only to 203.0.113.0/24" },
    { "cmd": "probe droplet:22   # 3 tries", "output": "TimeoutError after 5.0 s (3 of 3)" },
    { "comment": "12:22:36 someone removes the dl-web tag" },
    { "cmd": "doctl compute droplet untag 621604794 --tag-name dl-web" },
    { "cmd": "probe droplet:22   # every 10 s", "output": "12:22:41 TimeoutError\n12:22:56 TimeoutError\n12:23:06 connected: SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.2" },
    { "cmd": "terraform plan -detailed-exitcode", "output": "changes: digitalocean_droplet.web (update)\ndrift:   digitalocean_droplet.web (tags)\n         digitalocean_firewall.web (pending_changes, status)\n         digitalocean_tag.web (droplets_count, total_resource_count)" }
  ]
}
```

Thirty seconds after the tag went, SSH answered a connection from another server on the internet. The plan did catch it, as a tag change on the droplet. The firewall resource showed only computed attributes, the same kind of entry the filter above drops as noise. So read a tag change on anything that a firewall, a load balancer or a policy selects by tag as a security change. After the revert apply, port 22 timed out again on all three tries.

## What the plan cannot see: a cloud inventory

The second method lists what exists and compares it with the state. driftctl was the open-source tool for this. Its README now says "This project is now in maintenance mode"; the last release, v0.40.0, is from December 2023, and it supports AWS, Azure, GCP and GitHub, not DigitalOcean. Since v0.17 it shows changed attributes only in its `--deep` mode; the default scan reports unmanaged and missing resources. GoogleCloudPlatform/terraformer, which can generate Terraform from existing DigitalOcean resources, was archived on March 16, 2026.

So the repo has a small inventory script, about 110 lines of Python with no dependencies. It works like driftctl's default scan: it compares IDs, not attributes. The hard part is not the diff. It is the **scope**: which resources in the account belong to this stack? Listing everything in the account flags every resource of every other stack as unmanaged, unless you load all their states too. `inventory.py` starts from the state and walks outward:

- every record in the managed zone, minus the SOA and NS records DigitalOcean creates
- every droplet in the lab project or carrying a managed tag
- every firewall that targets one of those droplets or tags
- every tag attached to one of those droplets

On the scenarios, that scope caught every resource created or deleted by hand that touched the stack: the `debug` record, the second firewall (it targets the managed droplet), the tagged debug droplet, the new tag, and the deleted record and firewall. It found none of the attribute changes, by design. The untagged droplet in the default project had no link to anything in state, so it was outside the scope. Only an account-wide list would find it, and then the problem becomes noise from everything else in the account.

`check.py` runs both: the refresh-only plan with the computed-only filter, then the inventory. Here it is before and after three drifts (`results/check-demo-20261120T122801Z.txt`):

```terminal
{
  "title": "check.py, the scheduled check",
  "prompt": "$",
  "steps": [
    { "cmd": "python3 scripts/check.py", "output": "plan 2.22 s, inventory 4.23 s, 9 inventory requests" },
    { "cmd": "echo $?", "output": "0" },
    { "comment": "open port 22, add a debug record, create a tagged debug droplet" },
    { "cmd": "python3 scripts/check.py", "output": "DRIFT     digitalocean_firewall.web: inbound_rule\nUNMANAGED droplet 621616958 (tagged dl-web)\nUNMANAGED record 1839110469 (A debug in zone)\nignored   digitalocean_tag.web: computed only (droplets_count, total_resource_count)\nplan 2.33 s, inventory 4.21 s, 10 inventory requests" },
    { "cmd": "echo $?", "output": "2" }
  ]
}
```

## Backups: the change the plan saw late

`backups-enabled` was the surprise. The `enable_backups` action completed at 12:00:57, and the plan five seconds later reported nothing. The DigitalOcean provider sets `backups` from the droplet's `features` list (`d.Set("backups", slices.Contains(features, "backups"))` in the read function), and `features` did not include `backups` yet. Between 12:05:08 and 12:05:28 it did: from then on refresh-only plans reported `backups` as drift, and normal plans wanted `backups = true -> false`.

That made us measure the lag directly. `backups_lag.py` switches backups on or off with doctl and polls the droplet about every 15 seconds until `features` agrees, and checks the backup policy endpoint at each poll. These are the lag of the API field the plan reads, not plan runs. The times count from the start of the doctl action to the end of the poll that saw the change, so each is up to one poll interval late. The matrix row is different: it counts from the action's completion and is inferred from two plans about 20 seconds apart (`results/backups-lag-20261120T133125Z.jsonl`):

| Run             | Action  | `features` agreed after | Backup policy endpoint   |
| --------------- | ------- | ----------------------- | ------------------------ |
| matrix, round 1 | enable  | 4m 11s to 4m 31s        | not checked              |
| 1               | enable  | 6m 43s                  | agreed at the first poll |
| 1               | disable | 10m 1s                  | agreed at the first poll |
| 2               | enable  | 10m 17s                 | agreed at the first poll |
| 2               | disable | 10m 0s                  | agreed at the first poll |

So for 4 to just over 10 minutes after a toggle, the plan reports the old value, and after a revert apply it keeps asking to revert something that is already reverted. In round 2 of the matrix the revert apply sent `disable_backups`, the next plan still saw `true`, and the baseline check applied again: four `disable_backups` actions in under two minutes, all of them "completed" in the droplet's action history (`results/droplet-actions-20261120T121013Z.txt`), before `matrix.py` gave up. A scheduled job that auto-reverts would loop the same way.

The lesson is not specific to backups. A plan only knows what the provider reads, from the field the provider reads it from. When that field is eventually consistent, the plan is too. For settings that cost money or that an auditor asks about, read the authoritative API directly in a separate check, here the backup policy endpoint, which was right at every poll.

## Time to detect

The matrix ran each detector five seconds after the change. A real check runs on a schedule, so the delay is mostly the wait for the next run. `watch.py` ran the two detectors on their own schedules for an hour, a refresh-only plan every 10 minutes and the inventory every 2 minutes, and injected six drifts at seeded random times without reverting any of them (`results/watch-20261120T123001Z.jsonl`):

| Drift                    | Landed at | Caught by | Time to detect                      |
| ------------------------ | --------- | --------- | ----------------------------------- |
| record-created           | 7m 24s    | inventory | 40 s                                |
| dns-hotfix               | 10m 26s   | plan      | 9m 38s                              |
| droplet-created-untagged | 12m 26s   | nothing   | not in the hour                     |
| firewall-created         | 21m 47s   | inventory | 17 s                                |
| firewall-rule-added      | 22m 48s   | plan      | 7m 15s, by address only (see below) |
| tag-removed              | 26m 59s   | plan      | 3m 5s                               |

```chart
{
  "type": "bar",
  "title": "Time from the change to the first run that reported it",
  "unit": "s",
  "caption": "watch.py, seed 23, 2026-11-20. Plan every 10 min, inventory every 2 min. The untagged droplet was never reported, and the firewall rule is left out because its detection rests on the address alone (see below).",
  "rows": [
    { "label": "record-created", "value": 40.1, "series": "inventory" },
    { "label": "firewall-created", "value": 16.9, "series": "inventory" },
    { "label": "tag-removed", "value": 184.7, "series": "plan" },
    { "label": "dns-hotfix", "value": 578.2, "series": "plan" }
  ],
  "series": [
    { "name": "inventory", "color": "#10b981" },
    { "name": "plan", "color": "#f59e0b" }
  ]
}
```

Nothing here is surprising, and that is the point: with a check every N minutes, a change waits up to N minutes plus one run, which is about 3 seconds for the plan and 4 for the inventory at this size. So the schedule is the number to choose, and you can choose it per method. The inventory is cheap enough to run every few minutes. The plan costs at least one request per resource, so on a large state it runs less often, and the drift it alone can see (edits to managed resources, which includes the firewall rule) waits longer.

Two more things showed up in that hour. The plan at the 10-minute mark flagged `digitalocean_firewall.web` although nobody had touched the firewall yet. `watch.py` records only the addresses, so we cannot say which attribute moved; in the matrix runs the same resource reported changes to its computed `status` and `pending_changes`. An unfiltered check would have raised a false alarm there, and the firewall stayed on the list for the rest of the hour. So when the real firewall rule landed at 22 minutes, the plan after it showed the same resource name as the false alarm before it. Our 7m 15s for that row is the time to the first plan after the change that listed the address; `watch.py` did not record whether that plan showed `inbound_rule`. The matrix shows a plan does catch that rule within seconds, but in this run only the attributes would have told the two apart. And the inventory reported the hand-made record in 27 runs in a row, every two minutes, for as long as nobody acted on it. Decide up front whether a finding alerts once or on every run.

## What the checks cost

On the clean lab, ten runs of each, interleaved (`results/bench-20261120T122351Z.tsv`):

| Detector                       | median | min to max     | API requests per run |
| ------------------------------ | ------ | -------------- | -------------------- |
| `terraform plan -refresh-only` | 2.30 s | 2.06 to 2.64 s | 11                   |
| `terraform plan`               | 2.20 s | 1.96 to 2.88 s | 11                   |
| `tofu plan -refresh-only`      | 2.40 s | 2.02 to 2.63 s | 11                   |
| `inventory.py`                 | 3.59 s | 3.19 to 3.96 s | 9                    |

At this size both are cheap. They grow differently. A plan sends at least one read per resource in state. The inventory lists the zone's records 200 at a time, so 200 records cost it one request, but it makes at least two calls per managed tag (the tag, then its droplets page by page) and one per droplet in scope, and it lists every firewall in the account before it filters them. So its cost follows the size of the account, not only the stack, and each run here was slower than a plan (3.59 against 2.30 seconds). Our script also reads only the first 200 resources of the project, a limit a large project would hit. On a zone with 200 TXT records and a CNAME (202 resources), a full plan sent 202 requests and took 9.5 seconds, and two full plans within a minute went over DigitalOcean's 250 requests per minute ([-minimal-refresh, measured](/posts/terraform-1-17-minimal-refresh-measured)). DigitalOcean also allows 5,000 requests an hour per token, which decides how often you can afford to plan a large state. And do not switch on `-minimal-refresh` in the drift job: it skips the refresh of anything without a config change, which is everything a drift check is looking for.

## Adopting what the inventory finds: import blocks

Some unmanaged resources should stay. The hotfix firewall may be needed, the debug record may be the fix. Since Terraform 1.5 (OpenTofu 1.6), an `import` block brings an existing object under management through a normal plan, and `-generate-config-out` writes the resource block for you. Both docs still call config generation experimental.

`adopt.py` is a recorded demonstration, not an adoption you can continue from. It creates a debug record, a hotfix firewall and a tagged debug droplet with a new tag, runs the inventory, writes one import block per unmanaged resource, and plans in copies of the working directory under `.lab/adopt-terraform` and `.lab/adopt-tofu`. Nothing is applied, and the script deletes the four resources when it finishes. The import blocks it wrote looked like this:

```hcl
import {
  to = digitalocean_firewall.adopted_1
  id = "5773450e-1b09-457f-bb8d-80105936682c"
}

import {
  to = digitalocean_record.adopted_3
  id = "tf-drift-lab.devops-daily.com,1839114581" # records import as zone,id
}
```

```bash
terraform plan -generate-config-out=generated.tf   # writes the resource blocks; the file must not exist yet
terraform plan -detailed-exitcode                  # plans again with them
```

Terraform generated all four resource blocks, and the plan with them read `Plan: 4 to import, 0 to add, 0 to change, 0 to destroy.` It still exited 2: with `-detailed-exitcode`, a pending import counts as a change. So an adoption plan is not an "is it clean" check until the import has been applied.

OpenTofu wrote all four blocks too, then failed validation on the record:

```text
Error: expected tag to be one of [issue issuewild iodef], got

  with digitalocean_record.adopted_3,
  on generated.tf line 28, in resource "digitalocean_record" "adopted_3":
  28:   tag      = ""
```

Terraform wrote `tag = null` for the A record; OpenTofu wrote `tag = ""`. The field belongs to CAA records, and when it is set the provider accepts only `issue`, `issuewild` or `iodef`. After deleting that one line, the OpenTofu plan matched Terraform's: `4 to import, 0 to add, 0 to change, 0 to destroy` (`results/adopt-20261120T133020Z/`).

Even the clean output is a starting point, not finished code. The generated firewall says `droplet_ids = [621604794]` where your own code would say `[digitalocean_droplet.web.id]`. The generated droplet has `ssh_keys = null`, so if anything forced a replacement, the new droplet would come up without a key. Both docs say to review generated config before you commit it, and these are the reasons. For a real adoption, run the same two plans in your own working directory with the live IDs the inventory reports, move each generated block into the right file, replace literal IDs with references, then apply the import and delete the `import` blocks (or keep them as a record; they do nothing once the resource is in state).

## The drift budget

Not every drift deserves the same response, and "revert everything" breaks the on-call engineer who opened a port to fix an outage. Sort drift into classes before it happens, and decide once what each class gets. This is the budget we would set for a stack like the lab, with the detector that catches each class in our runs:

| Class                                                      | Lab examples                                                        | Caught by           | Response                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A managed resource widened or detached from its protection | firewall-rule-added, tag-removed                                    | plan                | Page now. Revert automatically after a short grace period (we would use 30 minutes) unless someone claims it in the alert.                                                                                                                                                                 |
| A managed resource deleted                                 | record-deleted, firewall-deleted                                    | plan and inventory  | Recreate automatically, but only from a saved plan that contains nothing except those creates. In round 2 the plan that restored the deleted record also tried to change backups. Alert so someone learns why it went.                                                                     |
| A managed value changed on purpose                         | dns-hotfix, project-moved                                           | plan                | Alert, never auto-revert: reverting a failover is a second outage. The owner either moves the change into code (edit, then `apply -refresh-only` if needed) or reverts it.                                                                                                                 |
| Something new attached to the stack                        | record-created, firewall-created, droplet-created-tagged, tag-added | inventory           | Alert with an owner and a deadline. Adopt it with an import block or delete it. Do not delete automatically: you do not know what depends on it.                                                                                                                                           |
| Something new with no link to any state                    | droplet-created-untagged                                            | nothing in this lab | Handle at account level: a tag policy, a billing alert, an account-wide inventory against all states.                                                                                                                                                                                      |
| A setting the provider reads late or not at all            | backups-enabled                                                     | plan, minutes later | A direct API check for the settings that cost money or that an auditor asks about.                                                                                                                                                                                                         |
| Computed counters and status                               | tag `droplets_count`, firewall `status`                             | plan (noise)        | Ignore: filter with the provider schema, and run `apply -refresh-only` after each deploy.                                                                                                                                                                                                  |
| Values another system owns                                 | an autoscaler's size                                                | plan (noise)        | `ignore_changes`, with a comment naming the owner ([how to ignore one attribute](/posts/who-owns-the-terraform-state-file#h3-how-do-i-ignore-changes-to-one-attribute)). That stops the plan from reverting it, but a refresh-only check still reports it, so exclude it in the check too. |

Two rules make the budget work. First, every alert says which class it is, so the person who opens it does not have to work that out at 3 a.m. Second, any automatic revert or recreate goes through the same pipeline as a normal change, with a saved plan and the same review rules. A plan gate like the one in [Gate Your Terraform Plans](/posts/terraform-plan-gate-digitalocean-inference), which fails the job on changes that risk data loss or public exposure, can stop an automatic revert that would do more than undo.

## What went wrong while we measured

Every run below is kept in the repository; the discarded ones carry a note on the second line of the result file:

- **The first version of `matrix.py` recorded only resource addresses.** On the very first plan, the tag counters made a clean lab look drifted, and an address alone cannot tell a counter from a firewall rule. We stopped the run, made `plan()` record the changed attributes and whether each is computed-only, and started again. That is what made the filter possible.
- **`doctl compute droplet tag` needs the tag to exist.** The console creates a tag on the fly; the API returns 404. The first full run crashed on `tag-added`. The scenario now creates the tag first.
- **The backups lag broke our own baseline check.** In round 2, plans started to show `backups = true -> false`, the revert apply disabled backups, the flag did not follow, and `matrix.py` stopped after three tries because the lab was never clean. The rest of round 2 ran later, without `backups-enabled`, in a second file. An earlier attempt to run that remainder still listed `backups-enabled` and was stopped before its first scenario.
- **The first adoption run was confounded.** Its second Terraform plan also showed an update to the managed droplet: the backups flag again. We reran it once the flag had settled. On the rerun, the step that removes `tag = ""` did not run, because we had not copied the new `adopt.py` to the server; a third run has it.

## What we could not conclude

- **One provider, ten resources.** What a plan sees depends on what the provider reads back. Another provider may track records on the zone, or firewall attachments on the droplet, and change the table. We tested DigitalOcean only.
- **The backups lag is five samples.** Four to ten minutes, in one region on one afternoon. The delay depends on DigitalOcean internals we cannot see, and it may be different elsewhere or tomorrow.
- **The exposure was measured once.** Thirty seconds from untag to an open port is one run from one server.
- **One schedule, one seed.** The time-to-detect run used a 10-minute plan and a 2-minute inventory for one hour. Detection time scales with the interval you pick; the shape of the result (plan-only drift waits for the plan, inventory-only drift waits for the inventory, the untagged droplet never shows up) is what transfers.
- **Our inventory's scope is a design choice.** A different scope gives different misses. Ours trades the untagged droplet for zero noise from the rest of the account.
- **We did not test hosted drift detection products** such as Firefly, ControlMonkey, Spacelift, env0 or Terramate, so we make no claim about what they catch. The workflow in `examples/drift-check.yml` was not run in GitHub Actions either: `watch.py` ran the schedule on a server.

## Summary

A scheduled refresh-only plan and a cloud inventory diff look at different halves of drift. On 12 changes made the way people make them, the plan caught the 7 edits and deletes to resources in its state, and nothing that lived outside it. The inventory caught the 6 changes that created or deleted something inside its scope (a new tag counts), and none of the attribute edits. Three of them, the two deletes and the new tag, showed up in both. Run both, on separate schedules: in our hour, the 2-minute inventory reported its drift within 40 seconds, and the 10-minute plan took up to almost 10 minutes.

Expect noise and plan for it. A refresh-only plan exited 2 with nothing drifted after 5 of 23 applies, from counters and status fields; filtering computed-only attributes with the provider schema removed 3 of those 5, and an `apply -refresh-only` after each deploy helps only if you read what it accepts. Read tag changes as security changes when firewalls select by tag: removing one opened SSH on our droplet in 30 seconds. Treat settings the provider reads late, like backups, as their own check. Adopt what should stay with import blocks, review the generated config before you commit it, and on OpenTofu 1.13 expect to fix `tag = ""` on DNS records by hand. Then write the drift budget down, so the alert already says what happens next.

The scripts, the raw results and the predictions are in [terraform-drift-lab](https://github.com/The-DevOps-Daily/terraform-drift-lab). The lab ran for about two and a half hours: one droplet the whole time, ten extra droplets the scenarios made by hand (most for a few minutes, one for 48), and under an hour of droplet backups. DigitalOcean bills droplets per second with a minimum of 60 seconds or $0.01, whichever is higher, so the ten extra droplets cost at least $0.10 and the main one about $0.014: roughly $0.12 in all, plus the backups, which are priced as a share of the droplet price. Everything was destroyed at the end, and a check for anything named `dl-` found nothing left. If you are new to state and refresh, start with [Terraform state management](/guides/introduction-to-terraform/05-state-management) and practice the plan and apply loop in the [Terraform simulator](/games/terraform-terminal-simulator).
