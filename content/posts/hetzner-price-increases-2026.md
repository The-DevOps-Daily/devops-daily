---
title: "Hetzner's Third Price Increase in Three Months: What DevOps Teams Should Do"
excerpt: 'Hetzner is changing dedicated server and cloud pricing again on June 15, 2026. Here is what changed, why customers are frustrated, and how to decide whether to stay, resize, or move workloads.'
category:
  name: 'FinOps'
  slug: 'finops'
date: '2026-05-28'
publishedAt: '2026-05-28T09:00:00Z'
updatedAt: '2026-05-28T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - FinOps
  - Cloud
  - Hetzner
  - DigitalOcean
  - Cost Optimization
  - Infrastructure
---

Hetzner has announced another pricing change, effective June 15, 2026. For many teams, the headline is not just "prices are going up." It is that this feels like the third Hetzner pricing shock in roughly three months, with the newest announcement landing before customers can see the final price table.

If you run production workloads on Hetzner, this is not a reason to panic migrate. It is a reason to get precise about exposure: which servers are protected by existing terms, which workloads need new capacity soon, and which systems could move without turning a pricing update into an outage.

## TL;DR

Hetzner's [May 27 announcement](https://www.hetzner.com/pressroom/standardization-and-price-adjustment-of-our-server-products/) says it is standardizing dedicated server products and increasing monthly prices for new orders. The changes take effect on June 15, 2026.

The operational takeaways:

- Existing rented servers keep their current terms for this adjustment.
- New orders, rescales, and future products can be affected.
- Dedicated servers and cloud plans at all locations are in scope.
- Server Auction, IPs, storage products, Load Balancers, Volumes, Snapshots, Object Storage, web hosting, and managed servers are listed as not affected by this specific announcement.
- Hetzner has not published the final new prices yet.
- The Reddit reaction is mostly about repeated adjustments and unclear numbers, not just the existence of a price increase.

The right move is to build a short exposure report before deciding anything. Stable existing servers may be fine. Workloads that need frequent resizing deserve a closer look.

## Prerequisites

Before you make a provider decision, gather:

- A current list of Hetzner cloud servers, dedicated servers, and Server Auction machines
- Monthly spend by product line, environment, and owner
- Planned capacity changes for the next 30-90 days
- A backup and restore status for every production datastore
- DNS TTLs, load balancer dependencies, and IP allowlists
- One realistic fallback provider for each workload class

## What Actually Changed

Hetzner's May 27 announcement has two separate parts.

First, Hetzner is standardizing the dedicated server portfolio. New dedicated server models will use clearer suffixes such as `-1`, `-2`, and `-3`. A `-1-Ltd` suffix will mark limited-quantity servers built from lower-cost hardware components.

Second, Hetzner says monthly prices are increasing for new orders. The company points to hardware procurement pressure, especially the cost of server components. It also says setup fees will be reduced for most dedicated servers.

For operators, the most important scope detail is this: currently rented servers are not affected by this specific adjustment. New orders, rescales of existing servers, and future products under the new structure are affected.

That creates two very different situations:

- A stable dedicated server fleet may not see an immediate bill change.
- A growing cloud or dedicated fleet can still be exposed as soon as it adds or rescales capacity.

That distinction matters. "Hetzner is raising prices" is too vague to act on. "Our CI runner fleet creates new cloud servers every week" is actionable.

## Why Customers Are Frustrated

The Reddit thread titled [Third price increase in three months](https://www.reddit.com/r/hetzner/comments/1tpwusm/third_price_increase_in_three_months/) is a good snapshot of the mood. Several comments focus on the same point: Hetzner announced another change, but the new prices are not visible yet.

That frustration did not come from nowhere. Hetzner's own pressroom shows a run of pricing-related updates in 2026:

| Date | Hetzner communication | What changed |
| --- | --- | --- |
| February 2, 2026 | [Statement on the adjustment of setup fees](https://www.hetzner.com/pressroom/statement-setup-fees-adjustment/) | Hetzner said dedicated server setup fees were changing because RAM and NVMe SSD procurement costs had risen. |
| February 23, 2026 | [Statement on price adjustment as of April 1st 2026](https://www.hetzner.com/pressroom/statement-price-adjustment/) | Hetzner announced price changes for existing products and new orders effective April 1. |
| April 29, 2026 | [Statement on the latest adjustment to setup fees](https://www.hetzner.com/pressroom/statement-on%20the-latest-adjustment-to%20setup-fees/) | Hetzner adjusted dedicated server setup fees again. |
| May 27, 2026 | [Standardization and price adjustment effective June 15, 2026](https://www.hetzner.com/pressroom/standardization-and-price-adjustment-of-our-server-products/) | Hetzner announced the new product structure and monthly price increases for new orders and rescales. |

Depending on how you count setup fees versus monthly prices, people will debate whether this is the third or fourth adjustment. For planning, that debate is less important than the pattern: teams can no longer assume Hetzner pricing is static across the year.

## The Risk Is Bigger Than the Monthly Bill

The obvious risk is a higher bill. The more useful question is whether the price change breaks an assumption in your infrastructure plan.

Examples:

- You planned to resize a database host after a traffic launch.
- You rely on cheap ephemeral cloud workers for CI or batch jobs.
- You sell hosting with thin margins and fixed customer pricing.
- You keep extra capacity around because adding capacity has historically been cheap.
- You assume Hetzner is always the cheapest acceptable provider, so no one has tested a fallback.

Those are different problems. A stable server that keeps its terms needs documentation and monitoring. A workload that creates new machines every day needs a cost model.

## Build an Exposure Report

Start with a small table. Do not try to solve the whole migration question in one meeting.

```text
Workload        Product type      Current state      Next resize?     Move difficulty
api-prod        Hetzner Cloud     existing           yes, 30 days     medium
postgres-prod   Dedicated AX      existing           no              high
ci-runners      Cloud             ephemeral          yes, weekly      low
object-store    Object Storage    existing           no              medium
staging         Cloud             existing           flexible        low
```

The useful column is `Next resize?`. Existing servers may be protected from this specific adjustment, but growth can still put you onto new pricing.

If you use the Hetzner Cloud CLI, export the current fleet first:

```bash
hcloud server list -o columns=id,name,type,location,status,ipv4
hcloud volume list -o columns=id,name,size,location,server
hcloud load-balancer list -o columns=id,name,type,location
```

Then add the context the CLI cannot know:

- Who owns the workload?
- Is it production, staging, CI, or batch?
- Does it need new capacity before June 15?
- Does it have tested backups?
- Could it run somewhere else with only DNS and secret changes?

This turns a provider announcement into a concrete task list.

## Decide by Workload Class

Do not make one global decision for everything on Hetzner.

### Stable dedicated servers

If an existing dedicated server is stable, well-utilized, and hard to move, staying put may be the best decision. The announcement says currently rented servers are not affected by this adjustment.

For these systems, do the boring work:

- Confirm the current billing terms.
- Record the hardware specs and replacement plan.
- Verify backups with a restore test.
- Keep a migration runbook current even if you do not plan to use it.

### Frequently resized cloud workloads

These deserve the closest review. If your workload adds capacity often, the "new orders and rescales" language matters.

Model total workload cost, not just VM price:

```text
Monthly workload cost =
  compute
+ block storage
+ snapshots
+ backups
+ load balancers
+ bandwidth overages
+ support
+ engineering time
```

The cheapest VM is not always the cheapest workload. If a provider saves $40/month but adds three hours of operational work every month, it is not cheaper for a real team.

### Low-risk disposable workloads

If you want to reduce provider concentration, start here:

- CI runners
- Preview environments
- Batch workers
- Staging apps
- Stateless internal tools

These systems are useful migration drills. They reveal missing Terraform modules, secrets assumptions, DNS gaps, and observability gaps without putting your primary database at risk.

## Keep One Simple Fallback Ready

For smaller teams, it helps to keep one boring fallback provider ready. DigitalOcean is a reasonable candidate for this role. It is not a perfect replacement for Hetzner dedicated servers, but it is easy to price, easy to explain, and good enough for many web apps, staging environments, internal tools, and smaller production services.

DigitalOcean's [Droplet pricing](https://www.digitalocean.com/pricing/droplets) currently starts at $4/month for basic VMs, and the pricing page says Droplets use per-second billing with a monthly cap. That kind of predictable pricing is useful when your goal is optionality, not chasing the absolute lowest benchmark score.

Use any fallback provider as a test target first:

```yaml
provider: digitalocean
candidate_workloads:
  - name: ci-runners
    reason: stateless and easy to recreate
    rollback: disable new runners and re-enable Hetzner runners
  - name: staging-api
    reason: low traffic with simple DNS rollback
    rollback: point staging DNS back to Hetzner
  - name: internal-dashboard
    reason: low customer impact and simple data model
    rollback: restore previous deployment target
```

The goal is not to move everything. The goal is to make sure your team has a path if the final prices change the math.

## Migration Checklist

If the June 15 prices push you toward migration, move in phases.

### Phase 1: Classify systems

```text
Class A: stateful production systems, high migration risk
Class B: stateless production services, medium migration risk
Class C: staging, CI, batch, internal tools, low migration risk
```

Move Class C first. Leave Class A alone until restore tests, load tests, and rollback steps are proven.

### Phase 2: Prove backups

For PostgreSQL, do not stop at "backup job succeeded." Restore it:

```bash
pg_dump --format=custom --file=prod.dump "$DATABASE_URL"
createdb restore_test
pg_restore --dbname=restore_test --clean --if-exists prod.dump
psql restore_test -c "select count(*) from users;"
```

For object storage, test reads from the restored copy:

```bash
aws s3 sync s3://current-bucket ./restore-check \
  --endpoint-url "$CURRENT_S3_ENDPOINT"

find ./restore-check -type f | head
```

### Phase 3: Lower DNS TTLs early

Set lower TTLs before the cutover window:

```text
api.example.com. 300 IN A 203.0.113.10
```

Do this before you need it. A five-minute TTL does not help if resolvers cached yesterday's one-day TTL.

### Phase 4: Move stateless services before databases

Move app instances first when possible. Keep the database in place, connect across providers temporarily, and measure latency. That gives you a safer rollback path than moving compute and data at the same time.

### Phase 5: Move state last

Only move databases after you have:

- A recent restore test
- A write-freeze or replication plan
- A rollback point
- Application-level health checks
- A clear error-budget agreement

## When Staying Is the Right Call

Staying with Hetzner may still be the best answer.

Stay if:

- Your existing contracts are not affected and the workload is stable.
- The workload uses dedicated hardware efficiently.
- Migration risk is higher than likely savings.
- You depend on Hetzner-specific networking, locations, or workflows.
- Your team does not have time to validate another provider properly.

FinOps is not "move providers whenever prices change." It is knowing which assumptions changed and which ones did not.

## What to Watch on June 15

When Hetzner publishes the final prices, check:

- Cloud plan prices by region
- Dedicated server monthly prices under the new `-1`, `-2`, `-3`, and `-1-Ltd` structure
- Setup fee reductions versus monthly increases
- Rescale behavior for existing cloud servers
- Whether limited products affect capacity planning
- Differences between Germany, Finland, Singapore, and US locations

Then update the exposure report with real numbers.

## Bottom Line

Hetzner's latest announcement is not automatically a migration trigger. It is a planning trigger.

If your fleet is stable, you may only need to document terms and wait for the final price table. If your workloads resize often, run close to margin, or depend on cheap disposable capacity, model the impact now.

The practical response is simple: know what is exposed, prove your backups, test one fallback path, and avoid making a rushed provider decision on June 15.
