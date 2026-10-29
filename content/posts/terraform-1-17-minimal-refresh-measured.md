---
title: "Terraform 1.17's -minimal-refresh: 202 API Calls Down to Zero, and the Drift Goes Quiet Too"
excerpt: 'Terraform 1.17 can skip the refresh for every resource you did not change. We measured it on 202 real DigitalOcean resources: API calls went from 202 to 0 and plan time halved, and then we broke three records behind its back to see what it stops noticing.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2026-10-31'
publishedAt: '2026-10-31T09:00:00Z'
updatedAt: '2026-10-31T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Terraform
  - IaC
  - Drift Detection
  - DigitalOcean
  - Performance
  - DevOps
---

Terraform 1.17.0 shipped on October 21 with a new plan option, `-minimal-refresh`. It refreshes only the resources that your configuration is about to change, and skips the API reads for everything else. We pointed it at 202 real resources on DigitalOcean. A normal plan made 202 API requests and took 9.5 seconds. With `-minimal-refresh` it made none and took 4.3 seconds.

Then we deleted one record, changed the TTL of two others behind Terraform's back, and planned again. A normal plan found all three. With `-minimal-refresh`, Terraform made no API requests and reported no changes.

That trade is the whole story of this flag. It is a real speed-up, and it is also a switch that turns off drift detection for most of your state. This post shows both, with the numbers, so you can decide where it belongs in your pipeline.

## TL;DR

- On 200 DNS records plus a zone and a CNAME (202 resources), a full refresh made 202 GET requests. `-minimal-refresh` made 0 when nothing changed in config and 1 when one record changed. Median plan time fell from 9.5 s to 4.3 s, about the same as `-refresh=false` (4.5 s).
- A second full plan within a minute of the first took 60 s instead of 9.5 s, because DigitalOcean allows 250 API requests per minute. The debug log showed a 50-second silence and no 429: the provider logs around its retry layer, so rate-limit waits do not look like errors.
- After we deleted one record and changed the TTL of two others out of band, a full plan found all three and `-minimal-refresh` found none. With a config change on `r[0]`, it refreshed only `r[0]` and still hid the drift on the CNAME that depends on it.
- A destroy plan with `-minimal-refresh` does not refresh at all, so it plans to delete resources that are already gone. The DigitalOcean provider treats the 404 on delete as already deleted, so our destroy still succeeded; a provider that returns an error there would fail.
- Use it for fast PR plans on large states, and keep a scheduled `terraform plan -refresh-only` (or a normal plan) so drift still has somewhere to show up.

## Prerequisites

- Terraform 1.17.0 or later (`terraform version`)
- A DigitalOcean API token with domain read, create and delete scopes, if you want to run the lab
- A zone name under a domain you control; the lab never delegates it, so no real DNS changes

## What the flag does

The [plan command docs](https://developer.hashicorp.com/terraform/cli/commands/plan) describe it in one line: it "reduces the number of remote API requests by refreshing only resource instances that Terraform plans to change". The implementation is in [PR #38953](https://github.com/hashicorp/terraform/pull/38953), which spells out the details:

- For each resource instance, Terraform first plans against the state it already has, without reading the remote object.
- If that plan has no change, the instance is not refreshed at all.
- If it has a change, Terraform throws that plan away, refreshes the instance, and plans it again.
- Each instance decides on its own. A refresh of one resource does not make the resources that depend on it refresh.
- Destroy plans, and deposed or orphaned instances, never refresh with this flag.

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "resource in state", "icon": "database", "tone": "slate" },
    { "label": "plan against state", "sub": "no API read", "icon": "gear", "tone": "blue" }
  ],
  "branch": [
    { "label": "no change: skip the refresh", "variant": "good" },
    { "label": "change: refresh, plan again", "variant": "bad" }
  ]
}
```

The docs also say what that costs: the option "causes Terraform to ignore external changes to resources that have no planned changes". The rest of this post measures both sides of that sentence.

## The lab

The [companion repository](https://github.com/The-DevOps-Daily/terraform-minimal-refresh-check) creates 202 resources on DigitalOcean: one DNS zone, 200 TXT records and one CNAME. DigitalOcean DNS costs nothing and needs no droplets, and a record refresh is one GET request, so counting requests is simple.

```hcl
resource "digitalocean_record" "r" {
  count  = var.records
  domain = digitalocean_domain.lab.id
  type   = "TXT"
  name   = format("r%03d", count.index)
  value  = count.index == var.changed ? "v2" : "v1" # -var changed=7 changes one record in config
  ttl    = 1800
}

# Depends on r[0], so a config change to r[0] touches it in the graph.
resource "digitalocean_record" "pointer" {
  domain = digitalocean_domain.lab.id
  type   = "CNAME"
  name   = "pointer"
  value  = "${digitalocean_record.r[0].fqdn}."
  ttl    = 1800
}
```

Each plan in the clean runs uses `TF_LOG=DEBUG`, because the DigitalOcean provider prints its API requests only at that level, and `plan.sh` counts the request lines and reads the planned changes from `terraform show -json`. The plans ran on a Raspberry Pi 3 B+ with 1 GB of RAM, so the absolute times are slower than on a laptop. The request counts do not depend on the machine. We wrote down what we expected before each measured run and committed it to the repository first. `SOURCES.md` in the repository keeps the exact excerpts from the docs, the PR and the provider source that this post quotes.

```github
https://github.com/The-DevOps-Daily/terraform-minimal-refresh-check
```

## Finding 1: 202 requests down to 0, and half the plan time

With nothing changed in the configuration, a full plan read every resource. `-minimal-refresh` read none. With one record changed in config, it read exactly that one record:

```terminal
{
  "title": "bench2.sh, round 1, then three full plans back to back",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cut -f1-5 results/bench2-20261029T114834Z.tsv | grep -E '^(label|quiet/[a-z]+/[a-z-]+/1|burst)'",
      "output": "label\tseconds\tgets\trequests\t429s\nquiet/full/no-change/1\t9.5\t202\t202\t0\nquiet/minimal/no-change/1\t4.3\t0\t0\t0\nquiet/minimal/one-change/1\t4.9\t1\t1\t0\nquiet/norefresh/no-change/1\t4.5\t0\t0\t0\nburst/full/no-change/1\t9.4\t202\t202\t0\nburst/full/no-change/2\t60.4\t202\t202\t0\nburst/full/no-change/3\t60.6\t202\t202\t0"
    }
  ]
}
```

Across three rounds, the median times were:

```chart
{
  "type": "bar",
  "title": "Median plan time, 202 DigitalOcean resources",
  "unit": "s",
  "caption": "Three runs each, every full plan after a 65 s pause so the per-minute rate limit stays out of it. Raspberry Pi 3 B+, Terraform 1.17.0, provider digitalocean 2.106.0. Source: results/bench2-20261029T114834Z.tsv.",
  "rows": [
    { "label": "full refresh (202 GETs)", "value": 9.5, "series": "refresh" },
    { "label": "-minimal-refresh, no change (0 GETs)", "value": 4.3, "series": "minimal" },
    { "label": "-minimal-refresh, 1 change (1 GET)", "value": 4.5, "series": "minimal" },
    { "label": "-refresh=false (0 GETs)", "value": 4.5, "series": "off" }
  ],
  "series": [
    { "name": "refresh", "color": "#64748b" },
    { "name": "minimal", "color": "#f59e0b" },
    { "name": "off", "color": "#94a3b8" }
  ]
}
```

Two things stand out. First, `-minimal-refresh` is as fast as `-refresh=false` here, because with nothing changed it does the same work. Second, a plan without any refresh still took about 4.3 s on this machine. Refreshing all 202 resources added about 5 s on top, roughly 25 ms of wall-clock time per resource with Terraform's default parallelism of 10. We did not split that into network time and Terraform or provider work, so expect both numbers to be different on your hardware.

## Finding 2: the rate limit is where full refreshes really hurt

Our first benchmark looked wrong. Identical full plans took anything from 9 to 62 seconds. The cause was our own script: it ran every plan twice in a row, once to time it and once with logging, so each full plan meant about 404 requests within a few seconds of each other. DigitalOcean [allows 5,000 requests per hour and 250 per minute](https://github.com/digitalocean/openapi/blob/main/specification/description.yml) per token. We marked that run as confounded in the repository and measured the effect on purpose instead: three full plans back to back.

```chart
{
  "type": "bar",
  "title": "Three full plans back to back",
  "unit": "s",
  "caption": "Each plan sends 202 GET requests; DigitalOcean allows 250 per minute. Source: results/bench2-20261029T114834Z.tsv.",
  "rows": [
    { "label": "1st plan", "value": 9.4 },
    { "label": "2nd plan", "value": 60.4 },
    { "label": "3rd plan", "value": 60.6 }
  ]
}
```

The odd part was the log. Every slow plan still showed exactly 202 GET requests and no `429` responses. A second run that kept the logs (`burst-log.sh`) narrowed it down. In the slow plan, the debug log has a 50-second stretch in which no API response arrived at all. The rest of the plan looked like the fast one.

The provider's source suggests why the log stays quiet. It builds its HTTP client with retries (4 by default, 1 to 30 s apart) and then wraps its request logging around that client, so the log records one request going in and one response coming out ([config.go](https://github.com/digitalocean/terraform-provider-digitalocean/blob/v2.106.0/digitalocean/config/config.go)). A `429 Too Many Requests` and the wait that DigitalOcean's `retry-after` header asks for would happen inside, out of sight. That fits what we saw, but the log alone cannot show which request was retried. If a plan suddenly takes a minute longer with no errors in `TF_LOG`, check the rate limit before you suspect Terraform.

This is where `-minimal-refresh` earns its keep. A CI system that runs a plan for every push to every open pull request can easily send several full refreshes a minute against the same token. With the flag, an unchanged resource costs no requests at all.

## Finding 3: the drift it stops seeing

`drift.sh` changes three records through the DigitalOcean API, behind Terraform's back:

- `r[42]` is deleted
- `r[43]` gets a TTL of 60 instead of 1800
- `pointer`, the CNAME that depends on `r[0]`, gets a TTL of 60

Then it plans in several ways. Each full-refresh plan waits a minute first, and no `429` was logged in any of them.

| Plan                                         | API reads | Changes it shows                                                                                                 |
| -------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| Full refresh                                 | 202       | `pointer` update, `r[42]` create, `r[43]` update                                                                 |
| `-minimal-refresh`                           | 0         | none                                                                                                             |
| Full refresh, `r[0]` changed in config       | 202       | `r[0]` update plus the three above                                                                               |
| `-minimal-refresh`, `r[0]` changed in config | 1         | `r[0]` update only                                                                                               |
| `-refresh-only`                              | 202       | no infrastructure actions; drift reported on `pointer`, `r[42]` and `r[43]` (applying it would update the state) |

Source: `results/drift-20261029T124036Z.tsv`. Full-refresh plans had a 65-second pause before them; the `-minimal-refresh` plans ran right after.

The second row is the one to remember. One record is gone and two have the wrong TTL, and the plan says there is nothing to do. It will keep saying that on every pull request until someone changes those resources in code or runs a plan that refreshes them.

The fourth row shows the rule from the PR in practice: each resource decides on its own whether to refresh. `pointer` depends on `r[0]`, and `r[0]` was refreshed because its config changed, but `pointer` had no planned change of its own, so its TTL drift stayed hidden. If you expected a change to one resource to pull its dependents into the refresh, it does not.

`-refresh-only` caught all three, which is what it is for. The docs say you cannot combine it with `-minimal-refresh`, so it cannot be made cheap the same way.

## Finding 4: destroy plans skip the refresh completely

With `-minimal-refresh`, a destroy plan skips the refresh of managed resources, as the PR describes. After `r[42]` was deleted out of band, a normal destroy plan refreshed, noticed it was gone, and planned 201 deletions. The `-minimal-refresh` destroy plan made no API requests and planned 202, including the record that no longer existed.

We then destroyed the lab with `terraform apply -destroy -minimal-refresh`. It exited 0 and reported 202 resources destroyed, one of which no longer existed (`results/teardown-20261029T124712Z.txt`). That worked only because the DigitalOcean provider's record delete [treats a 404 as already gone](https://github.com/digitalocean/terraform-provider-digitalocean/blob/v2.106.0/digitalocean/domain/resource_record.go). A provider that returns an error on a missing object would fail, possibly after some deletions have already completed. For destroy, let Terraform refresh.

## What went wrong while we measured

Three mistakes, all caught before writing, all kept in the repository:

- The first benchmark ran every plan twice back to back, so each full plan meant about 404 requests in quick succession, more than the 250 a minute DigitalOcean allows. Its request counts are right; its timings mix in rate-limit waits. The file says so on its second line, and `bench2.sh` has the clean timings.
- Our first drift run asked DigitalOcean to change the CNAME's TTL with a PATCH that sent only the TTL. The API answered `422: Data needs to end with a dot`, even though it stores the value without one, so the dependent-resource case did not run. The fixed script sends the value with the trailing dot.
- `plan.sh` first read only `resource_changes` from the plan JSON. A refresh-only plan reports what it found under `resource_drift`, so it looked like it found nothing. The script now records both.

A fourth check failed in a harmless way: `bench2.sh` tried to measure the cost of debug logging by unsetting `TF_LOG`, but the log was still written, so both rows were logged runs. An unlogged full plan from the first benchmark took 9.3 s, the same as the logged ones, so logging did not change the result much here, but we did not measure it properly.

## When to use it

`-minimal-refresh` fits the fast plan that runs on every merge request, if your state is large or your provider's rate limit is tight. The resources you changed are still refreshed, so their part of the plan starts from the real remote state. Treat it as early feedback, though: everything else, including resources that depend on the ones you changed, is planned from state, as Finding 3 shows. Run a fully refreshed plan before you apply.

It is the wrong tool anywhere you rely on plans to surface drift. Keep at least one plan that refreshes everything:

```yaml
# Assumes terraform init, the backend and provider credentials are set up
# in before_script or the image, and a pipeline schedule exists for drift-check.

# Fast plan for every merge request: only changed resources are read.
mr-plan:
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
  script:
    - terraform plan -minimal-refresh

# Nightly drift check: reads every resource and fails when anything moved.
drift-check:
  rules:
    - if: '$CI_PIPELINE_SOURCE == "schedule"'
  script:
    - terraform plan -refresh-only -detailed-exitcode # exit code 2 means drift
```

The docs add two more rules: do not use it, or `-refresh=false`, when you upgrade provider versions, and you cannot combine it with `-refresh-only` or `-refresh=false`. From our results we would add two more: do not use it for destroy plans you want to be accurate, and do not apply a plan made with it without a full refresh first.

## What we could not conclude

- **One provider, two resource types, all DNS.** A zone and its records are cheap to read. Providers with slow reads (databases, Kubernetes objects, large IAM policies) should save more time per skipped refresh; we did not measure them.
- **One slow machine.** The 4.3 s without a refresh was measured on a Raspberry Pi 3 B+. On other hardware both the baseline and the cost of the refresh will be different.
- **Other providers' destroy behaviour.** The DigitalOcean provider treats a 404 on delete as already deleted. A provider that returns an error there would fail the destroy instead.
- **Large states.** We stopped at 202 resources to stay inside DigitalOcean's 5,000 requests an hour, and our repeated runs still took the token down to 4 remaining requests once.

## Summary

`-minimal-refresh` does what it says. On 202 DigitalOcean resources it cut API requests from 202 to 0 or 1 and plan time from 9.5 s to 4.3 s, the same as `-refresh=false`, while still refreshing the resources you change. It also avoids the rate limit that made a second full plan take 60 s. The price is drift: with no config change it reported none of the three records we changed behind its back, and a change to one resource did not refresh the resource that depends on it. Use it for fast merge request plans, refresh fully before you apply, keep a scheduled full or refresh-only plan for drift, and do not use it for destroy.
