---
title: 'How Shopify Survives Black Friday: The Flash-Sale Playbook'
excerpt: "Shopify load tests at 150% of last year's peak, queues buyers at the edge and reserves stock during payment. We rebuilt checkout with k6 and measured it."
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-10-06'
publishedAt: '2026-10-06T09:00:00Z'
updatedAt: '2026-10-06T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Load Testing
  - k6
  - Scalability
  - System Design
  - Reliability
---

Shopify merchants sold [$14.6 billion over Black Friday Cyber Monday 2025](https://www.shopify.com/news/bfcm-data-2025), and the busiest minute, 12:01 p.m. EST on Black Friday, ran at $5.1 million in sales. A minute like that is not a surprise. It is on the calendar a year ahead, so the engineering problem is not reacting to a spike. It is rehearsing for one.

Shopify's engineering blog describes the rehearsal in unusual detail: load tests at 150% of last year's peak, capacity planned with the cloud providers months ahead, a throttle at the edge that queues buyers when checkout is full, and inventory reserved during payment so two buyers cannot claim the last unit. This post walks through each from Shopify's own write-ups, then rebuilds the checkout half on a Raspberry Pi with k6 to measure what the last two steps buy.

The short version: checking stock before payment oversold 41 to 47 units of 500 in three runs, and reserving the unit first sold exactly 500. When buyers arrived twice as fast as payment could take them, a plain queue charged more shoppers after they had given up than it confirmed purchases for. A simple waiting room kept checkout under 400 ms at p95 instead, at the cost of turning the overflow into shoppers who gave up waiting.

## TL;DR

- Shopify rehearses all year: its load generator, Genghis, runs checkout flows in production with flash-sale bursts on top, at 150% of last year's load, and capacity is planned months ahead.
- When checkout is full, an edge throttle queues buyers. The first version was a lottery that left some waiting 40 minutes; a signed first-attempt timestamp made it fair.
- Inventory is reserved when payment starts and claimed when it succeeds.
- In our runs the oversell from check-then-pay was roughly arrival rate times payment time: lower traffic shrank it but did not remove the race. At twice the payment capacity, the question was not how many orders got through but who got them.
- Our first batch of runs quietly skipped up to a fifth of its shoppers. Fail arrival-rate load tests on `dropped_iterations`.

## Prerequisites

- Comfort with HTTP, SQL transactions and the idea of a load test
- To run the demo: Node.js 22.13 or newer (for the built-in `node:sqlite`) and the k6 binary; no Docker, no database server
- About 25 minutes of machine time for the full set of recorded runs

## A flash sale is an overload you can schedule

Bart de Water, who worked on Shopify Payments, defined the term in his [QCon talk on Shopify's flash-sale architecture](https://www.infoq.com/presentations/shopify-architecture-flash-sale/): "A flash sale is a sale for a limited amount of time, often with limited stock. It's over in a flash because the product can sell out in seconds, even if there are thousands of items in inventory." He also draws the line that matters here: "Storefront is mostly about read traffic, while our checkout does most of the writing and has to interact with external systems as well."

Reads cache well. Writes that call a payment provider do not, and that is where Shopify got hurt. [The first of two posts on its checkout throttle](https://shopify.engineering/surviving-flashes-of-high-write-traffic-using-scriptable-load-balancers-part-i) describes Kylie Cosmetics running sales that sold out quickly, roughly every week, and one in February 2016 that "took down not just her store, but all others on the database shard where her store was allocated." What followed was a set of habits Shopify still writes about, and de Water's talk has the one-line reason they keep paying off: "today's flash sale will be tomorrow's base load."

Those habits answer three questions. Will the platform hold at the peak? What happens to buyers who arrive when checkout is full? Does the one write that matters stay correct under contention?

## Load testing as a discipline, not a launch task

Shopify's [2025 BFCM readiness post](https://shopify.engineering/bfcm-readiness-2025) opens with "Bimonthly fire drills all year, simulating 150% of last year's BFCM load." The tool is in-house:

> Our load testing tool Genghis runs scripted workflows that mimic user behavior like browsing, cart adds, and checkout flows. We gradually ramp traffic to find breaking points. Tests run on production infrastructure simultaneously from three GCP regions (us-central, us-east, and europe-west4) to simulate global traffic patterns. We inject flash sale bursts on top of baseline load to test peak capacity.

Five major scale tests ran from April to October 2025. The fourth reached 146 million requests per minute and more than 80,000 checkouts per minute; the last went to the p99 forecast of 200 million requests per minute. Early tests found that "core operations threw errors and checkout queues backed up", and adding authenticated checkout "exposed rate-limit paths that anonymous browsing never touches."

Three details worth copying at any scale:

- **Production-shaped targets.** De Water's talk describes Genghis hitting benchmark stores in production, at least one per pod, "at least weekly", paying through a benchmark gateway that "can respond with both successful and failed payments with a realistic distribution of response time latencies that we see in production." The demo copies that idea.
- **The burst, not just the volume.** A [2023 post](https://shopify.engineering/scale-performance-testing) lists a flash-sale flow in which "simulated users purchase a single product", plus an "abort switch" that stops every test at once.
- **Written-down failure.** [Toxiproxy](https://github.com/Shopify/toxiproxy), Shopify's open source tool for simulating network conditions, injects failures during load tests, and findings go into a Resiliency Matrix of failure scenarios, recovery objectives and runbooks.

### Pick the load model before the tool

What decides whether a load test can see a flash sale at all is the workload model. k6's page on [open and closed models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/) states the trap: "When the target system is stressed and starts to respond more slowly, a closed model load test will wait, resulting in increased iteration durations and a tapering off of the arrival rate of new VU iterations." A closed test slows down exactly when the system does and reports a calm result. Buyers at a drop do not wait for the previous buyer's page to load, so you need an open model, where arrivals follow a schedule whatever the server is doing.

All three common open source tools can drive an open model and fail a CI job; k6 and Gatling also have explicit closed-model options:

|              | k6                                                                                   | Gatling                                                                                                             | Artillery                                                                                   |
| ------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Scripts      | JavaScript                                                                           | Java, JavaScript, Kotlin, Scala                                                                                     | YAML, or JavaScript and TypeScript                                                          |
| Open model   | `constant-arrival-rate`, `ramping-arrival-rate`                                      | `constantUsersPerSec`, `rampUsersPerSec`                                                                            | phases with `arrivalRate` and `rampTo`                                                      |
| Closed model | VU-based executors such as `constant-vus`                                            | `constantConcurrentUsers`, `rampConcurrentUsers`                                                                    | arrival-based phases; `maxVusers` only caps concurrency                                     |
| Pass or fail | [thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/), non-zero exit | [assertions](https://docs.gatling.io/concepts/assertions/): "If at least one assertion fails, the simulation fails" | [`ensure` plugin](https://www.artillery.io/docs/reference/extensions/ensure), non-zero exit |

On merit: k6 is a single Go binary whose thresholds work on custom metrics, which made "fail if any unit was sold twice" a one-line rule in the demo. Gatling separates [open and closed injection](https://docs.gatling.io/concepts/injection/) in its API, so the model is explicit in every script, and suits JVM teams. Artillery's [YAML scenarios](https://www.artillery.io/docs/reference/test-script) are the quickest to write for plain HTTP, and its Playwright engine drives real browsers when the checkout page's JavaScript matters. Any of them could run the demo.

## Pre-scale for the peak you know is coming

Shopify's 2025 preparation started in March with capacity planning, including "submitting our estimates to our cloud providers so they don't run out of cloud." In the uncertain year of 2020, [Capacity Planning at Scale](https://shopify.engineering/capacity-planning-shopify) records the choice: "We decided to scale to our more aggressive growth scenarios to ensure our platform is stable regardless of what happens." Before scale tests, components are brought up to a "BFCM profile" ahead of time.

Change is managed the same way. A [2018 post](https://shopify.engineering/preparing-shopify-for-black-friday-cyber-monday) describes a feature freeze that "starts several weeks before BFCM" and a code freeze a few days before. The 2025 post puts it as a rule: "We don't use BFCM as a release deadline." Architectural changes and migrations land months earlier.

Why not let autoscaling handle it? Shopify's posts do not say they turn it off, and we found no primary source that does. But in the demo below the stock is gone about six seconds into the sale, while a Kubernetes Horizontal Pod Autoscaler checks metrics [every 15 seconds by default](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/), before a new pod is even scheduled. Autoscaling suits the slow tides of a long weekend; for the first minute of a drop, the capacity has to exist already. Our [Kubernetes HPA lab](/exercises/kubernetes-hpa-lab) and [horizontal vs vertical scaling simulator](/games/scaling-simulator) let you feel that lag safely.

Some capacity cannot be pre-scaled at all because it belongs to someone else, like a payment provider. The second experiment is about what to do when arrivals exceed it.

## Put the queue at the edge, not inside checkout

After the Kylie outage, Shopify had a week before the next sale. [Part I](https://shopify.engineering/surviving-flashes-of-high-write-traffic-using-scriptable-load-balancers-part-i) explains why a plain rate limit would not do: "For customers anything that looked like the website crashing would be interpreted as such." The team built a throttle into its Nginx and OpenResty edge tier:

> The solution we landed on was to throttle users using a leaky bucket algorithm built into our edge tier. [...] The number of requests served would be reset every period (in our case, 5 seconds), and it was up to us to inform the client when to retry a rejected request.

Buyers over the limit saw a queue page that polled `/checkout`; those who got through received a signed cookie to skip the throttle for the session. The platform held, and then buyers complained of waiting up to 40 minutes for a 40-minute sale. The post admits that "in reality they were randomly polling the throttle", a lottery.

[Part II](https://shopify.engineering/surviving-flashes-of-high-write-traffic-using-scriptable-load-balancers-part-ii) fixed fairness without adding state to the edge. A buyer's first checkout attempt is stamped with a timestamp in a signed cookie, and each load balancer computes a threshold, "the virtual version of the 'Now Serving: 42' counters at delis", that lets the earliest timestamps through to the leaky bucket. A feedback controller moves the threshold; after simulations, the team kept only its proportional term.

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "Buyer", "sub": "clicks checkout", "icon": "globe", "tone": "slate" },
    { "label": "Edge throttle", "sub": "Nginx + Lua", "icon": "shield", "tone": "amber" },
    { "label": "Checkout", "sub": "writes + payment", "icon": "server", "tone": "blue" }
  ],
  "branch": [
    { "label": "under capacity: signed cookie, straight through", "variant": "good" },
    { "label": "over capacity: queue page, poll, earliest timestamp first", "variant": "bad" }
  ]
}
```

Five years later, de Water's [10 tips for resilient payment systems](https://shopify.engineering/building-resilient-payment-systems) (2022) still describes "scriptable load balancers to throttle the amount of checkouts happening at any given time", with a waiting queue when demand exceeds capacity. It explains why with Little's Law and a sentence worth pinning above any capacity plan: "your application can't out scale the world." At the edge, a waiting buyer costs a cached page and a poll, not a worker, a database connection and a payment slot.

## Protect the one write that must not go wrong

The 2025 post calls checkout, payment processing, order creation and fulfillment "critical journeys". Older parts of the architecture exist to keep them alive:

- **Pods.** [A pod](https://shopify.engineering/a-pods-architecture-to-allow-shopify-to-scale) "consists of a set of shops that live on a fully isolated set of datastores", which limits how far one shop's sale can reach. De Water adds that some extra-large merchants get a pod to themselves, and other systems stop a big merchant's flash sale from trying to "monopolize all the capacity" of a shared pod.
- **Semian.** Shopify's [circuit breaker and bulkhead library for Ruby](https://github.com/Shopify/semian) starts from the fact that slow resources fail slowly, and while threads wait on one, "the slow resource has caused a cascading failure by occupying workers and therefore losing capacity."
- **Inventory reservations**, the part the demo rebuilds.

Shopify's May 2026 post, [We replaced Redis with MySQL for inventory reservations](https://shopify.engineering/scaling-inventory-reservations), says oversell protection works "by reserving inventory during payment processing", which it calls "a short hold that prevents two concurrent checkouts from claiming the same unit." Reserve holds items when payment starts; claim deducts them from the ledger when payment succeeds. The reservation used to be a Redis `DECR`, but then the claim step had to update the MySQL ledger and clean up Redis, two operations that could not be wrapped in one atomic step. In MySQL, the obvious schema failed: "A single row with a quantity column couldn't handle the contention." The shipped design uses one row per sellable unit, taken with `SELECT ... FOR UPDATE SKIP LOCKED` so concurrent checkouts take different rows, from a pool capped at 1,000 rows per item and location that a replenishment process refills. The post also ties this article's two halves together: "Slow reservations trigger throttling and a worse buyer experience." Remember the single-row detail; the demo's fix is the single-row version.

## Rebuilding the checkout half on a Raspberry Pi

The demo is a small checkout service and one k6 scenario, built to answer two questions a skeptical reader can check: does reserving before payment matter at modest traffic, and what does a queue in front of checkout change when arrivals exceed what payment can process?

```github
https://github.com/The-DevOps-Daily/flash-sale-playbook
```

Everything ran on a 4-core Raspberry Pi 4 that was also doing other work, with k6 2.3.0 and the service on the same machine, so absolute numbers are small. Every variant ran the same scenario on the same machine, interleaved with the others, and each run records the load average before and after it.

- **The service** is one Node.js 24 process, one product, and an SQLite database in memory-backed storage. One process stands in for a fleet: the `await` between the read and the write lets other requests run in between, as requests on separate servers would.
- **The payment provider** is a stand-in that takes 100 to 400 ms (uniform, seeded per run) and declines 5%. In the second experiment it also has a fixed number of slots.
- **The scenario** is a k6 `ramping-arrival-rate` executor with every VU created before the sale. Each iteration is one shopper. After the sale, `teardown()` asks the server what it sold and reports it as metrics, so thresholds fail the run on correctness, not just latency.

```javascript
// k6/flash-sale.js, trimmed
export const options = {
  scenarios: {
    flash_sale: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: profile.vus,
      maxVUs: profile.vus,
      stages: profile.stages, // drop: 0 -> 300/s over 10s, hold 20s, down over 5s
    },
  },
  thresholds: {
    dropped_iterations: ['count==0'], // k6 kept its own schedule
    oversold_units: ['count==0'], // reported by teardown() from the server
    orders_to_clients_that_left: ['count==0'],
    'http_req_duration{name:checkout}': ['p(95)<2000'],
  },
};
```

Before the recorded runs, `scripts/predict.mjs` simulated every variant 400 times with an idealized copy of k6's arrival schedule (it has one extra arrival at the very end) and the same payment model, ignoring server CPU time. Its output from the start of the first batch, kept with the discarded runs, is identical to the one used here. Every recorded order count below fell inside the simulated 5th to 95th percentile range; a few latency figures landed just outside it, which is unsurprising for a model with no CPU time.

### Experiment 1: check, pay, then write

The naive checkout is the order most people write first (simplified from `server.mjs`):

```javascript
async function checkoutNaive(shopper) {
  const { stock } = q.readStock.get(SKU); // SELECT stock ...
  if (stock <= 0) return { status: 409 }; // sold out
  const payment = await authorizePayment(); // 100-400 ms; other requests run here
  if (payment === 'declined') return { status: 402 };
  q.decrement.run(SKU); // UPDATE inventory SET stock = stock - 1
  recordOrder(shopper);
  return { status: 200 };
}
```

The fix moves a conditional decrement in front of payment, so the database decides who gets each unit:

```javascript
async function checkoutReserve(shopper) {
  // UPDATE inventory SET stock = stock - 1 WHERE sku = ? AND stock > 0
  const { changes } = q.reserve.run(SKU);
  if (changes === 0) return { status: 409 }; // sold out, no payment call
  const payment = await authorizePayment();
  if (payment !== 'paid') {
    q.release.run(SKU); // give the unit back
    return { status: 402 };
  }
  recordOrder(shopper);
  return { status: 200 };
}
```

The `drop` profile ramps from zero to 300 new shoppers a second over 10 seconds, holds for 20 and ramps down over 5: 8,249 shoppers for 500 units. Each mode ran three times, interleaved to spread background load across both:

| Run          | Checkout | Orders | Oversold | Stock counter after | Checkout p95 |
| ------------ | -------- | ------ | -------- | ------------------- | ------------ |
| drop, seed 1 | naive    | 544    | 44       | -44                 | 190 ms       |
| drop, seed 2 | naive    | 541    | 41       | -41                 | 174 ms       |
| drop, seed 3 | naive    | 547    | 47       | -47                 | 186 ms       |
| drop, seed 1 | reserve  | 500    | 0        | 0                   | 257 ms       |
| drop, seed 2 | reserve  | 500    | 0        | 0                   | 165 ms       |
| drop, seed 3 | reserve  | 500    | 0        | 0                   | 168 ms       |
| low, seed 1  | naive    | 508    | 8        | -8                  | 369 ms       |
| low, seed 1  | reserve  | 500    | 0        | 0                   | 372 ms       |

Every run started all its scheduled shoppers and used the same code, stamped by hash in its `run.json`. The p95 covers every checkout request, including the quick `409` sold-out answers most shoppers got.

```chart
{
  "type": "bar",
  "title": "Units sold beyond the 500 in stock",
  "unit": " units",
  "tickLabel": "predicted mean",
  "caption": "Recorded k6 runs on a Raspberry Pi 4. Tick marks show the mean of 400 simulated runs from scripts/predict.mjs. Reserve sold exactly 500 every time.",
  "rows": [
    { "label": "Drop, naive, seed 1", "value": 44, "series": "Naive", "tick": 42.5 },
    { "label": "Drop, naive, seed 2", "value": 41, "series": "Naive", "tick": 42.5 },
    { "label": "Drop, naive, seed 3", "value": 47, "series": "Naive", "tick": 42.5 },
    { "label": "Drop, reserve, seeds 1-3", "value": 0, "series": "Reserve", "tick": 0 },
    { "label": "Low, naive, seed 1", "value": 8, "series": "Naive", "tick": 6.6 },
    { "label": "Low, reserve, seed 1", "value": 0, "series": "Reserve", "tick": 0 }
  ],
  "series": [
    { "name": "Naive", "color": "#f59e0b" },
    { "name": "Reserve", "color": "#10b981" }
  ]
}
```

```terminal
{
  "title": "flash-sale-playbook",
  "prompt": "$",
  "steps": [
    { "comment": "two of the recorded runs, as scripts/run-all.sh started them" },
    { "cmd": "scripts/run.sh drop-naive-1 drop MODE=naive SEED=1", "output": "drop-naive-1: k6 exit 99, results in results/drop-naive-1" },
    { "cmd": "scripts/run.sh drop-reserve-1 drop MODE=reserve SEED=1", "output": "drop-reserve-1: k6 exit 0, results in results/drop-reserve-1" },
    { "comment": "what the server says it sold" },
    { "cmd": "jq -c '{mode: .config.mode, stockInitial, orders, oversold, stockNow}' results/drop-naive-1/server-stats.json", "output": "{\"mode\":\"naive\",\"stockInitial\":500,\"orders\":544,\"oversold\":44,\"stockNow\":-44}" },
    { "cmd": "jq -c '{mode: .config.mode, stockInitial, orders, oversold, stockNow}' results/drop-reserve-1/server-stats.json", "output": "{\"mode\":\"reserve\",\"stockInitial\":500,\"orders\":500,\"oversold\":0,\"stockNow\":0}" },
    { "comment": "why the naive run exited 99" },
    { "cmd": "grep -A14 THRESHOLDS results/drop-naive-1/k6-output.txt", "output": "  █ THRESHOLDS \n\n    dropped_iterations\n    ✓ 'count==0' count=0\n\n    http_req_duration{name:checkout}\n    ✓ 'p(95)<2000' p(95)=189.78ms\n\n    orders_to_clients_that_left\n    ✓ 'count==0' count=0\n\n    oversold_units\n    ✗ 'count==0' count=44" }
  ]
}
```

Every naive drop run sold units that did not exist, 8 to 9% more than the stock, and left the counter negative, so nothing downstream would have stopped those orders. Every reservation run sold exactly 500. Latency could not tell them apart (most shoppers arrived after the sellout and got a quick `409`), so a load test that only checked p95 and errors would have passed both.

The size of the oversell is predictable. Every shopper who passes the stock check before the counter reaches zero gets an order, and the counter only moves when a payment completes. So at the moment it hits zero, about (arrival rate × average payment time × share of payments approved) shoppers are still in flight. The 500th naive order landed about 6.2 seconds after the sale opened, with arrivals near 185 a second: 185 × 0.25 s × 0.95 ≈ 44. The simulation predicted a mean of 42.5, with 5th to 95th percentiles of 37 and 48; the runs landed at 44, 41 and 47.

Lower traffic shrinks it but does not remove the race: at a tenth of the arrival rate, the prediction was 4 to 9 and the run oversold 8 (1.6% of the stock). A slower payment step makes it larger. The bug is about how many payments are in flight when the last unit goes, not about Black Friday traffic.

### Experiment 2: more buyers than payment can take

The second scenario is the BFCM shape: plenty of stock, arrivals beyond what checkout can process. Payment has 8 slots and averages 250 ms, so it completes about 32 checkouts a second (Little's Law: 8 / 0.25 s). The `peak` profile ramps to 64 shoppers a second, twice that, holds for 30 seconds and ramps down over 10: 2,559 shoppers. Each will spend at most 15 seconds trying to buy, in one slow request or several tries.

Three variants, one change each, on the reservation code:

- **Queue**: no protection. Requests wait for a payment slot as long as it takes.
- **Deadline**: the baseline a hostile reader would ask for. k6 sends the time the shopper gives up, and the server skips the charge (`504`) when less than the stand-in's maximum payment time, 400 ms, is left.
- **Waiting room**: at most 8 checkouts in progress; everyone else gets `503` with `Retry-After: 1` and retries after a jittered half to one and a half seconds, giving up when the next wait would take them past 15 seconds. This is Shopify's random-polling first version, the lottery, not the timestamp fix.

| Three runs per variant, seeds 1 to 3  | Queue          | Deadline       | Waiting room     |
| ------------------------------------- | -------------- | -------------- | ---------------- |
| Shopper saw a confirmation            | 1,028 to 1,071 | 1,794 to 1,834 | 1,603 to 1,642   |
| Shopper saw a timeout                 | 1,437 to 1,481 | 0              | 14 to 18         |
| Shopper was refused at the deadline   | 0              | 636 to 670     | 0                |
| Shopper gave up after "please wait"   | 0              | 0              | 826 to 847       |
| Shopper saw a decline                 | 50 to 61       | 89 to 96       | 77 to 91         |
| Server charged a shopper who had left | 1,375 to 1,408 | 0              | 10 to 14         |
| Successful checkout request, p95      | 14.2 to 14.3 s | 14.9 s         | 387 to 395 ms    |
| Time to purchase, median              | 6.4 to 6.7 s   | 12.5 to 13.1 s | 4.3 to 5.0 s     |
| Most checkouts in progress at once    | 1,122 to 1,142 | 948 to 949     | 8                |
| Waiting-room responses served         | none           | none           | 21,892 to 22,188 |
| Predicted confirmations, mean         | 1,048          | 1,809          | 1,626            |
| Predicted charges after leaving, mean | 1,385          | 0              | 16               |

The first five rows add up to all 2,559 shoppers in every run. The charges in the sixth row overlap with the timeouts: in the queue variant, most shoppers who saw a timeout were charged anyway.

```chart
{
  "type": "bar",
  "title": "2,559 shoppers, payment capacity about 32 checkouts a second",
  "unit": " shoppers",
  "tickLabel": "predicted mean",
  "caption": "Mean of three recorded k6 runs per variant on a Raspberry Pi 4. Tick marks show the mean of 400 simulated runs from scripts/predict.mjs.",
  "rows": [
    { "label": "Queue: confirmed purchases", "value": 1049, "series": "Confirmed purchase", "tick": 1047.9 },
    { "label": "Queue: charged after giving up", "value": 1389, "series": "Charged after giving up", "tick": 1384.8 },
    { "label": "Deadline: confirmed purchases", "value": 1810, "series": "Confirmed purchase", "tick": 1809.5 },
    { "label": "Deadline: charged after giving up", "value": 0, "series": "Charged after giving up", "tick": 0 },
    { "label": "Waiting room: confirmed purchases", "value": 1622, "series": "Confirmed purchase", "tick": 1626.1 },
    { "label": "Waiting room: charged after giving up", "value": 12, "series": "Charged after giving up", "tick": 16.2 }
  ],
  "series": [
    { "name": "Confirmed purchase", "color": "#10b981" },
    { "name": "Charged after giving up", "color": "#ef4444" }
  ]
}
```

Through the 45 seconds of overload, every variant completed 29 to 31 orders a second, by the server's own timestamps. Payment was the limit and none of the three changed it. What changed was who got those orders, and how long everyone waited.

**The queue** turned the overload into charges nobody saw. The line for payment grew past 1,100 requests; once the wait passed 15 seconds, nearly every request was served after its shopper had given up. Of about 2,440 orders per run, roughly 1,390 went to shoppers whose browser had shown a timeout, more than the 1,050 or so who saw a confirmation. In a real shop, each is a card charged for a purchase the buyer thinks failed.

**The deadline** removed those charges and sold the most, about 1,810. The cost is time: the queue still settles near the patience limit, so the median buyer waited 12.5 to 13.1 seconds, with up to 949 requests open at once. In a thread-per-request server each would also hold a worker, the failure Semian exists to prevent.

**The waiting room** kept checkout fast: 8 in progress at most, under 400 ms at p95, and a median time to purchase of 4.3 to 5.0 seconds including the waiting. Between 826 and 847 shoppers per run gave up after close to 15 seconds of "please wait", and the server answered about 22,000 cheap `503`s, around 8.6 per shopper. That is the trade Shopify made by moving the wait to a cached page at the edge.

It confirmed about 10% fewer purchases than the deadline queue, and the timestamps show where most of that gap built up. Both sold about 30 a second through the overload. After arrivals stopped, 50 seconds into the sale, the deadline queue kept serving its newest arrivals, who still had patience left, until about 62 seconds; the waiting room ran dry at about 58. Server-recorded orders after the 50-second mark account for about 154 of the roughly 175-order gap. The cause is this particular polling policy rather than waiting rooms in general: admission is random, so shoppers who had waited longest gave up first; a shopper gives up as soon as the next random wait would cross the 15-second limit, up to 1.5 seconds early; and a freed slot sits idle until someone's retry arrives. It is Shopify's Part I lesson in miniature: random retries spend the patience of the people who came first. The 10 to 14 late charges are shoppers admitted with less patience left than their payment took. Adding the deadline check to the waiting room should remove most of them; we did not run that combination.

### The bug in our own load test

Our first full batch of runs, kept under `results/discarded/`, started with 50 pre-allocated VUs and let k6 create more on demand. In the peak runs every waiting shopper holds a VU; k6 could not create them fast enough and skipped the shoppers it could not start on time: 541, 542 and 440 of 2,559. The runs completed, the summaries looked plausible, and the queue variant looked far better than it should, because it had faced a lighter sale.

k6 reports this as `dropped_iterations`, and our summary script flagged it. The fix was to create every VU up front and fail the run on `dropped_iterations: ['count==0']`. Later, a burst of unrelated work on the Pi pushed the load average near 9 on four cores. One peak run in that window skipped 253 shoppers, and another started 2,557 of 2,559 without reporting any as dropped, which only surfaced when the summary script compared runs. Both were re-run once the machine was quiet and kept with a note. The rule for throwing a run away was incomplete delivery of the schedule, not load: `peak-queue-3` started under a load average of 8.9, delivered all 2,559 shoppers, landed inside its predicted ranges and was kept. Before you believe anything an arrival-rate test says, check that it delivered its schedule.

## What this does not show

- **Scale.** A few hundred requests a second on one small machine, with k6 and the server sharing four cores. The direction of each result should hold; the absolute numbers do not transfer.
- **Hot-row contention.** SQLite serializes writes, so the single-row conditional `UPDATE` never fought for a row lock the way it would in MySQL or Postgres. Shopify says that design "couldn't handle the contention" at its scale. The demo shows that reserving before payment is necessary, not that one row is enough.
- **The cost of a held request.** Node.js holds a waiting connection cheaply. In a thread-per-request server, the queue and deadline variants would look worse.
- **A fair waiting room.** Ours is the lottery Shopify replaced. A timestamp-ordered queue should change who gets served and narrow the spread of waits; we did not build one.
- **Real payment latency.** The stand-in and the predictor use a uniform 100 to 400 ms with no long tail. Real providers have tails, which make every queue worse.
- **Rare cases.** Three runs per variant (one for `low`) agree with each other, and their order counts sit inside the simulated ranges, but three runs cannot rule out an occasional bad one.

## The playbook, condensed

1. **Rehearse the shape, not just the volume.** Model the drop as a burst on baseline traffic with an open-model load test, and run it on a schedule.
2. **Make the load test check correctness.** After the run, ask the system what it sold. Fail on oversells, on charges to buyers who had left and on dropped arrivals, not only on p95.
3. **Have the capacity before the minute you need it.** Forecast, agree capacity with providers, scale up ahead of the peak and stop risky changes well before it.
4. **Bound the work that reaches checkout.** Admit what payment and inventory can finish and park everyone else somewhere cheap, ideally at the edge and in arrival order.
5. **Reserve before you charge, and release on failure.** The database decides who gets the last unit, not the application's memory of an earlier read.

Shopify's own posts are worth reading in full, starting with the [2025 readiness program](https://shopify.engineering/bfcm-readiness-2025), the [checkout throttle story](https://shopify.engineering/surviving-flashes-of-high-write-traffic-using-scriptable-load-balancers-part-i) and the [inventory reservations post](https://shopify.engineering/scaling-inventory-reservations). For the neighbouring problems, our post on [how Stripe avoids double-charging](/posts/how-stripe-avoids-double-charging-idempotency-keys) covers retries around the payment call, and the [rate limit simulator](/games/rate-limit-simulator) shows how leaky and token buckets behave under bursts.
