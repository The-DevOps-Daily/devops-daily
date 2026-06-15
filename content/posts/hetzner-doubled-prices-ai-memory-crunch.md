---
title: 'Hetzner Doubled Its Prices Again. The AI Memory Crunch Is Why'
excerpt: 'On June 15, 2026, Hetzner raised prices on new orders by roughly 99% in Germany and 158% in the US, the latest in a string of 2026 increases. It is not greed and it is not just Hetzner: the AI memory supercycle has reached the infrastructure bill of teams that never touch AI.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-15'
publishedAt: '2026-06-15T19:30:00Z'
updatedAt: '2026-06-15T19:30:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - cloud
  - hetzner
  - finops
  - hardware
  - industry-insights
  - cost-optimization
---

If you run anything on Hetzner, you have probably already seen the notice. As of 08:00 CEST on June 15, 2026, [Hetzner adjusted its prices](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) again, and this round is the steepest yet: new cloud and dedicated server orders are up by an average of about 99% in Germany, 158% in its US locations, and 78% in Singapore, [according to heise](https://www.heise.de/en/news/Up-to-200-percent-Cloud-hoster-Hetzner-adjusts-prices-again-11333037.html). Some line items more than tripled.

For a host whose entire brand is "absurdly cheap European iron," a near-doubling is a shock. But the interesting part for anyone who runs infrastructure is not the number. It is the reason behind it, because that reason is going to show up in your bills too, whether or not you host on Hetzner and whether or not you do anything with AI.

## What actually changed

The adjustment applies to **new orders and cloud rescales** from June 15 onward. If you have an existing machine, you keep your current price until you reorder or resize it. Orders placed before the cutoff but delivered after still get the old price. Web hosting, managed and Exchange servers, IP addresses, storage boxes, and load balancers were left out of this round.

A few representative changes, taken from Hetzner's own price tables and heise's reporting:

| Server | Before | After | Change |
| --- | --- | --- | --- |
| CAX11 (ARM, DE/FI) | €4.49/mo | €5.99/mo | +33% |
| CCX13 (dedicated vCPU, DE/FI) | €15.99/mo | €42.99/mo | +169% |
| CPX41 (US region) | €38.99/mo | €120.49/mo | +209% |

Two patterns are worth pulling out of that table. The ARM line (CAX) took by far the smallest hit. The x86 dedicated-vCPU lines, the ones that come with more memory attached, took the largest. And US capacity rose far more than European, which tracks with where new hardware is hardest to get right now.

```chart
{
  "type": "bar",
  "title": "Average Hetzner price increase by region, June 15 2026",
  "unit": "%",
  "caption": "Averages across cloud and dedicated server lines, per heise reporting. New orders and rescales only; existing machines keep their price.",
  "rows": [
    { "label": "United States", "value": 158, "series": "increase" },
    { "label": "Germany", "value": 99, "series": "increase" },
    { "label": "Singapore", "value": 78, "series": "increase" }
  ],
  "series": [
    { "name": "increase", "color": "#f59e0b" }
  ]
}
```

This is also not a one-off. By several outlets' count it is the third price adjustment Hetzner has made in 2026, after a round on April 1 that raised cloud servers 30 to 43%, object storage 30 to 53%, and, most tellingly, memory add-ons by around 575%. The "again" in everyone's reaction is earned.

## The real story is in the memory market

Hetzner's stated reason is "extremely high procurement costs for new hardware." That is true, and it undersells how unusual the moment is. The component market is in the middle of what the industry is openly calling an AI supercycle, and the prices are genuinely historic.

The numbers behind the headlines, from [Tom's Hardware](https://www.tomshardware.com/pc-components/storage/perfect-storm-of-demand-and-supply-driving-up-storage-costs), [IEEE Spectrum](https://spectrum.ieee.org/dram-shortage), and TrendForce data:

- DRAM and NAND prices rose between 50% and 200% in the first half of 2026, with DRAM up roughly 171% year over year.
- AI data centers are projected to consume around 70% of high-end DRAM output in 2026, an inversion of who the memory makers used to build for.
- Samsung, SK hynix, and Micron have all redirected capacity toward high-bandwidth memory (HBM) and advanced DDR5 for AI accelerators. Micron's entire 2026 HBM output is reportedly already committed, which leaves less fab capacity for ordinary server DRAM.
- Hard drives are reportedly sold out for the year, and analysts expect tight allocation and elevated pricing to persist into 2027.

Server memory and storage are not a rounding error in a machine's bill of materials, they are most of it. When DRAM nearly doubles year over year and high-capacity drives are on allocation, the cost of building a new server rises sharply, and that 575% jump on Hetzner's memory add-ons back in April suddenly makes sense. A host running on thin margins cannot absorb that. It passes through.

## Why Hetzner shows it first

It is tempting to read this as a Hetzner problem and conclude that the hyperscalers are safer. The opposite is closer to the truth. Hetzner is a leading indicator, not an outlier.

Hetzner sells close to cost. It buys hardware, racks it, and rents it with little margin to cushion a shock, so when component prices spike, the increase reaches customers in weeks. AWS, Google Cloud, and Azure buy in enormous volume on long contracts, sit on far higher margins, and wrap everything in committed-use discounts and multi-year enterprise agreements. That hides a cost shock for a while. It does not prevent it. The same DRAM and the same drives go into their racks too, and the bill arrives later, as quietly worse renewal terms, thinner discounts, pricier memory-optimized instances, and instance families that stop getting cheaper the way they used to. If a near-cost provider just went up 99%, the providers selling the same silicon at a markup are not immune. They are just slower to show it.

## Is Hetzner still worth it?

Mostly, yes. Even after this increase, Hetzner remains dramatically cheaper than the hyperscalers for raw compute and bandwidth. A doubling of a number that started at a fraction of the AWS equivalent is still a fraction of the AWS equivalent. The moat narrowed, it did not close, and the egress story (where Hetzner is generous and the hyperscalers are punishing) did not change at all.

So the answer is not to rage-quit to a more expensive provider out of spite. It is to re-run the numbers you have probably not looked at since you set them, because the assumptions underneath them just moved.

## What to actually do about it

1. **Protect your grandfathered machines.** Existing servers keep their old price until you reorder or rescale. That means a casual resize now reprices the whole machine at the new rate. Before you bump a server up a tier, check what it will cost after the change, not before. If you were about to tear down and recreate something, that is now a price increase you are choosing.
2. **Treat memory as the cost center it has become.** The line item that exploded is RAM. Audit your over-provisioned instances, the ones sized for a peak that never comes, because every spare gigabyte is now meaningfully more expensive. Right-sizing memory was always good hygiene; this is the quarter it pays for itself.
3. **Look hard at ARM.** Hetzner's ARM line took a third of the increase the x86 lines did. If your stack runs on ARM, or could with a rebuild of your images, you dodge a large part of this and usually get better price-performance anyway. The same is true on the hyperscalers with Graviton and equivalents.
4. **Re-run your cost model and budget for hardware inflation everywhere.** This is not contained to one host or one quarter. Price your colo refresh, your cloud renewals, and yes, the RAM in your next batch of laptops, against a market that analysts expect to stay tight into 2027. If you build cost models, raise the memory and storage line and leave it raised.
5. **Do not over-correct.** Migrating providers has its own large costs in engineering time and risk. The right move for most teams is to measure, right-size, and renegotiate, not to flee. Panic migrations during a price shock are how you trade a 99% line-item increase for a 100% project you did not need.

## The bigger signal

Strip away the Hetzner specifics and here is what is left: the AI build-out is now large enough to move the price of the components every other computing workload depends on. You do not have to train a model, run inference, or ship a single AI feature to pay for the boom. If your service needs memory and disks, and all of them do, you are bidding for the same supply that the AI data centers are buying 70% of, and they are bidding harder.

Hetzner is just the first invoice to say so out loud. The rest will follow in their own time and their own quieter language. Plan your next year of infrastructure spend as if memory is expensive and scarce, because for the foreseeable future, it is.
