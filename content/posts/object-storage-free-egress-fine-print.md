---
title: 'Free Egress Has Fine Print: S3 vs R2, B2, Wasabi and More'
excerpt: 'Serving 50 TB a month costs $4,379 on S3 at list price and $62 on R2. But the cheapest number in our comparison breaks its provider's own terms. Nine storage offerings, four workloads, and the fine print that changes the answer, with a calculator you can run yourself.'
category:
  name: 'FinOps'
  slug: 'finops'
date: '2026-09-30'
publishedAt: '2026-09-30T09:00:00Z'
updatedAt: '2026-09-30T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - FinOps
  - Cloud
  - S3
  - Object Storage
  - Cloudflare R2
  - Egress
---

Serving 50 TB a month out of an S3 bucket in us-east-1 costs about $4,379 at list price, almost all of it data transfer. The same month on Cloudflare R2 costs about $62. That gap is why "zero egress" object storage is a whole product category now: Cloudflare R2, Backblaze B2, Wasabi, Tigris, and bundles from DigitalOcean, Hetzner and others.

The cheapest number in our comparison, though, is one you cannot rely on. Wasabi comes out at $15.60 for that 50 TB month, and that month is outside Wasabi's free-egress policy. Every provider in this category has fine print, and it is different for each one: a ratio to your stored data, a fair-use policy, a price per read, a minimum storage duration, a bundle that runs out. We put nine storage offerings from eight providers into a small calculator with their September 2026 prices and the main fine print applied, and ran four workloads through it.

```github
The-DevOps-Daily/object-storage-egress-calc
```

## TLDR

- **For egress-heavy workloads, the zero-egress providers win by one or two orders of magnitude.** Our 50 TB media month: R2 $62, Hetzner $76, Tigris $90, against $4,379 on S3 at list price.
- **Wasabi's free egress is a policy, not a price.** Egress should stay at or below the data you store. Above that there is no overage rate; Wasabi reserves the right to limit or suspend the service.
- **Backblaze B2 is free only up to 3x your stored data,** then $0.01/GB, unless you go through a partner CDN.
- **R2 egress is free, but reads are not.** In the media workload, GET requests were about half of the R2 bill.
- **Minimum storage durations beat egress for backups.** With 30-day retention, Wasabi's 90-day minimum triples its storage bill and puts it next to S3 at the bottom of the table.
- **AWS changed the math in November 2025** with flat-rate CloudFront plans. A direct per-GB comparison against S3 is no longer the whole story.

## Prerequisites

- A rough idea of your workload per month: data stored, data served to the internet, number of GET and PUT requests, and how long objects live.
- Python 3, if you want to run the calculator. It has no dependencies.

## The headline prices

This is what the pricing pages lead with, as of 28 September 2026. Every price comes from the provider's own pages. The [repository's `providers.json`](https://github.com/The-DevOps-Daily/object-storage-egress-calc/blob/main/providers.json) links the sources for every price the calculator uses, and other claims link their sources where they appear. Scenario totals are the calculator's estimates, not quotes.

| Provider                        | Storage per GB-month                 | Internet egress                                                          |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| AWS S3 Standard (us-east-1)     | $0.023                               | 100 GB free per account, then $0.09/GB, falling to $0.05/GB above 150 TB |
| Cloudflare R2 Standard          | $0.015                               | Free                                                                     |
| Cloudflare R2 Infrequent Access | $0.01                                | Free, but $0.01/GB retrieval on every read                               |
| Backblaze B2                    | $6.95 per TB                         | Free up to 3x stored, then $0.01/GB                                      |
| Wasabi                          | $7.99 per TB                         | Free, subject to policy                                                  |
| Tigris Standard                 | $0.02                                | Free                                                                     |
| DigitalOcean Spaces             | $5/month for 250 GiB, then $0.02/GiB | 1,024 GiB included, then $0.01/GiB                                       |
| Hetzner Object Storage          | $7.99/month for about 1 TB           | About 1 TB included, then $1.20/TB                                       |
| Storj Standard                  | $7 per TB                            | $7 per TB                                                                |

For context, the other two big clouds are in the same place as S3: [Google Cloud Storage](https://cloud.google.com/storage/pricing) lists $0.12/GiB for the first 10 TiB to most destinations, and [Azure](https://azure.microsoft.com/en-us/pricing/details/bandwidth/) includes 100 GB a month, then charges $0.087/GB for the next 10 TB from North America or Europe over its Premium Global Network.

Several of these prices are new. Backblaze went from $6 to $6.95/TB on 1 May 2026 and made standard API calls free (event notifications still cost). Wasabi went from $6.99 to $7.99/TB on 1 July. Hetzner raised its base price from EUR 4.99 to EUR 6.49 on 1 April. Storj moved to its "Simplified" pricing on 1 July. Comparisons written in 2025 are out of date.

## Four workloads

The calculator prices one month for each provider and prints a note wherever the workload breaks a rule. Here are the four workloads from `scenarios.sh`, with the results exactly as recorded in `runs/scenarios.txt`:

| Provider               | Downloads site                       | Backups                                       | Media                                | Side project                         |
| ---------------------- | ------------------------------------ | --------------------------------------------- | ------------------------------------ | ------------------------------------ |
| Workload               | 500 GB stored, 5 TB egress, 20M GETs | 10 TB stored, 200 GB egress, 30-day retention | 2 TB stored, 50 TB egress, 100M GETs | 50 GB stored, 200 GB egress, 1M GETs |
| AWS S3 Standard        | $460.55                              | $244.04                                       | $4,379.20                            | $10.60                               |
| Cloudflare R2 Standard | $10.95                               | $149.85                                       | $62.25                               | $0.60                                |
| Cloudflare R2 IA       | $73.09                               | $111.09                                       | $610.90                              | $3.49                                |
| Backblaze B2           | $38.41                               | $69.43                                        | $453.83                              | $0.78                                |
| Wasabi                 | $7.99, outside policy                | $234.00                                       | $15.60, outside policy               | $7.99, outside policy                |
| Tigris Standard        | $19.85                               | $204.85                                       | $90.30                               | $1.35                                |
| DigitalOcean Spaces    | $49.76                               | $200.00                                       | $529.76                              | $5.00                                |
| Hetzner Object Storage | $12.69                               | $87.69                                        | $75.55                               | $7.99                                |
| Storj Standard         | $38.50                               | $71.40                                        | $364.00                              | $5.00                                |

```chart
{
  "type": "bar",
  "title": "Media: 2 TB stored, 50 TB egress, 100M GETs per month",
  "unit": "$",
  "caption": "List prices on 28 September 2026, from the calculator in the linked repository. Wasabi's figure breaks its free-egress policy (egress above stored data), so it is not a price you can rely on. AWS S3 Standard for the same month is $4,379.20 at list price, off this scale.",
  "rows": [
    { "label": "Wasabi (outside policy)", "value": 15.6 },
    { "label": "Cloudflare R2 Standard", "value": 62.25 },
    { "label": "Hetzner", "value": 75.55 },
    { "label": "Tigris Standard", "value": 90.3 },
    { "label": "Storj Standard", "value": 364 },
    { "label": "Backblaze B2", "value": 453.83 },
    { "label": "DigitalOcean Spaces", "value": 529.76 },
    { "label": "Cloudflare R2 IA", "value": 610.9 }
  ]
}
```

Two things stand out. The order changes completely between workloads: Wasabi is cheapest for media and second most expensive for backups. And the reasons it changes are all in the fine print, not in the headline egress price. The rest of this post goes through that fine print, one rule at a time.

## Wasabi: free egress is a policy, not a price

[Wasabi's pricing FAQ](https://wasabi.com/pricing/faq) is explicit: if your monthly egress is at or below your active storage, your use case "is a good fit" for free egress. If it is above, it "is not a good fit", and if that happens "on a regular basis, we reserve the right to limit or suspend your service." There is no overage price to pay instead.

So Wasabi is a poor fit for workloads that regularly serve more than they store, such as downloads, media and most public assets, however good the number looks. The calculator prints the price with a note rather than hiding the row, because the policy is judged over time and a single heavy month is not the same as a pattern.

Wasabi also has three minimums: a 1 TB monthly minimum (the side project pays $7.99 for 50 GB), a 4 KB minimum object size, and a 90-day minimum storage duration, which is the next rule.

## Minimum storage duration: why Wasabi loses on backups

A backup bucket with 30-day retention deletes every object after 30 days. On a provider with a 90-day minimum, each of those objects is billed as if it stayed 90 days. In a steady state that is three times the storage you actually hold, and it is why Wasabi's backup month costs $234.00 instead of about $78.

```chart
{
  "type": "bar",
  "title": "Backups: 10 TB stored, 30-day retention, 200 GB restored",
  "unit": "$",
  "caption": "List prices on 28 September 2026, from the calculator. Wasabi bills each object for 90 days, so 30-day retention is charged at about three times the stored data. Storj and R2 Infrequent Access have 30-day minimums, which 30-day retention just meets.",
  "rows": [
    { "label": "Backblaze B2", "value": 69.43 },
    { "label": "Storj Standard", "value": 71.4 },
    { "label": "Hetzner", "value": 87.69 },
    { "label": "Cloudflare R2 IA", "value": 111.09 },
    { "label": "Cloudflare R2 Standard", "value": 149.85 },
    { "label": "DigitalOcean Spaces", "value": 200 },
    { "label": "Tigris Standard", "value": 204.85 },
    { "label": "Wasabi", "value": 234 },
    { "label": "AWS S3 Standard", "value": 244.04 }
  ]
}
```

The minimums across the providers here: Wasabi 90 days, and overwrites count as deletes. Storj 30 days. R2 Infrequent Access, Tigris Infrequent Access and DigitalOcean Cold Storage 30 days, Tigris Archive 90 days. None for S3 Standard, R2 Standard, B2 or Tigris Standard. Any bucket that churns, such as a build cache, CI artifacts or daily exports, pays the minimum on every object, whatever the egress price.

## Backblaze B2: free up to 3x what you store

[B2's egress](https://www.backblaze.com/cloud-storage/pricing) is free "up to 3x their average monthly storage", measured in byte-hours over the month, then $0.01/GB. It is unlimited only when you download to or through partner CDNs and compute providers (the page names Fastly, Cloudflare, bunny.net, CacheFly, CoreWeave, Equinix Metal, Vultr and phoenixNAP), or on B2 Overdrive, which needs a multi-petabyte commitment.

That is why B2 does well on backups and less well on the downloads site: 500 GB stored gives 1.5 TB of free egress, and the other 3.5 TB costs $35. The overage rate is still a ninth of S3's, and a partner CDN in front removes it.

## Cloudflare R2: egress is free, reads are not

[R2](https://developers.cloudflare.com/r2/pricing/) charges nothing for egress, with no ratio and no policy on the pricing page. It does charge for operations: every GET and HEAD is a Class B operation at $0.36 per million after the free 10 million a month. In the media workload, 100 million GETs cost $32.40 of the $62.25 total, more than the storage.

R2 Infrequent Access is a different product. It adds a $0.01/GB retrieval fee on every read or copy, a 30-day minimum, and no free tier. That is fine for backups, and after S3 it is the most expensive choice here for anything people download: $610.90 for the media month, because 50 TB of reads is $500 of retrieval.

Two more details. The `r2.dev` public URL is rate-limited and meant for development; public buckets in production should use a custom domain. And Cloudflare's [service terms](https://www.cloudflare.com/service-specific-terms-application-services/) say that, unless you are an Enterprise customer, serving video and other large files through its CDN requires one of its paid services, such as the Developer Platform (which includes R2), Images or Stream. Check those terms before you put a large-file origin hosted elsewhere behind Cloudflare.

## Bundles: a fixed amount of free egress, then per GB

Some providers sell a monthly bundle instead of a zero price:

- **[DigitalOcean Spaces](https://docs.digitalocean.com/platform/billing/bandwidth/):** $5 a month includes 250 GiB of storage and 1,024 GiB of outbound transfer shared across all buckets, then $0.02/GiB stored and $0.01/GiB transferred. The built-in CDN is included, and its traffic counts against the same allowance. Transfer from Spaces to Droplets in the same datacenter group is free, so a Spaces bucket next to DigitalOcean compute only pays for what leaves for the internet.
- **[Hetzner](https://docs.hetzner.com/storage/object-storage/overview/):** $7.99 (EUR 6.49) a month includes about 1 TB of storage and 1 TB of egress, accrued hour by hour, so a 30-day month holds 1.08 TB of egress. Extra egress is only $1.20/TB, which is why Hetzner is right behind R2 in the media workload. You pay the base price for any hour you have a bucket, even an empty one, and unused quota does not carry over.
- **[Storj](https://storj.dev/dcs/pricing/simplified):** no bundle and no free egress. $7/TB for storage and $7/TB for egress from the first byte, with a $5 minimum invoice (accounts that pay in USDC are exempt).

Bundles are easy to predict and cheap for small projects. DigitalOcean's $5 covers the side project workload in full. What matters is where the included transfer runs out: DigitalOcean's overage is $0.01 per GiB, the same number as B2's $0.01 per GB above 3x, and it is the main line on its media bill.

## Small objects pay more than their size

Several providers bill a minimum object size: Hetzner 64 KB, Storj 50 kB, Wasabi 4 KB, DigitalOcean 4 KiB (128 KiB for Cold Storage, on storage and on every read). A bucket of 10 KB thumbnails is billed at 6.4 times its real size on Hetzner. The calculator does not model this, so if your average object is small, check it against the list before you trust the result. R2, Tigris, S3 Standard and B2 state no minimum.

## AWS: the free 100 GB is per account, and CloudFront changed the math

[AWS's 100 GB of free internet egress](https://aws.amazon.com/s3/pricing/) is shared by the whole account, across all services and Regions, and the volume tiers also count all services together. A bucket in an account that also runs busy EC2 instances may never see the free 100 GB.

The bigger change is CloudFront. Transfer from S3 to CloudFront has long been free, and since 18 November 2025 CloudFront has [flat-rate plans](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html) with "no overage charges": Pro is $15 a month for a 50 TB allowance and 10 million requests, Business $200 for 50 TB and 125 million requests. Above the allowance, AWS says the first spike up to 3x will not affect service that month, but if you keep exceeding it without upgrading, "your traffic delivery might be adjusted", for example served from fewer or more distant edge locations.

We did not model this, because the bill then depends on cache hit rates and on how AWS treats sustained overuse. But it means "S3 costs $4,379 for 50 TB" is only true if you serve straight from the bucket. With S3 behind a flat-rate plan, the AWS number for a cache-friendly workload moves toward storage plus the plan fee, and that belongs in the same comparison as R2.

## Bytes you pay for but never deliver

AWS bills the bytes it sent when a client aborts a download, with its own example of 3 GB billed for a request cut off at 2 GB. DigitalOcean bills early disconnects "up to the full object size". For large downloads behind flaky networks, or players that seek around video files, billed egress can be noticeably higher than delivered bytes. Free-egress providers avoid this one by design.

## Units and rounding

The providers here do not agree on what a gigabyte is. AWS, Tigris, DigitalOcean and Wasabi bill binary units (GiB, or 1 TB = 1,024 GB), Storj and Hetzner decimal ones; R2 and B2 do not say. A GiB is about 7.4% larger than a decimal GB, and a TiB about 10% larger than a decimal TB. R2 rounds each line up to the next whole billing unit, and Storj rounds usage up to the whole GB. The calculator ignores all of this, which is fine for choosing a provider and not fine for forecasting a bill to the cent.

## Run your own numbers

```terminal
{
  "title": "object-storage-egress-calc",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python3 calc.py --storage-gb 500 --egress-gb 5000 --gets 20000000 --puts 10000",
      "output": "500 GB stored, 5,000 GB egress, 20,000,000 GETs, 10,000 PUTs, objects live 365 days (prices as of 2026-09-28)\n  Wasabi (pay-as-you-go)           $      7.99  billed for 1024 GB minimum; egress above stored data: outside Wasabi's free egress policy (no overage price; service may be limited)\n  Cloudflare R2 Standard           $     10.95\n  Hetzner Object Storage (USD)     $     12.69\n  Tigris Standard                  $     19.85\n  Backblaze B2                     $     38.41\n  Storj Standard                   $     38.50\n  DigitalOcean Spaces              $     49.76\n  Cloudflare R2 Infrequent Access  $     73.09\n  AWS S3 Standard (us-east-1)      $    460.55"
    }
  ]
}
```

`--lifetime-days` applies minimum storage durations, and every price in `providers.json` has its source URL, so you can update a number when a provider changes it.

## How to pick

| If your workload is mostly                                  | Look at first                                                       | Watch for                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| Downloads or media, serving more than you store             | Cloudflare R2 Standard, Hetzner, Tigris                             | R2 read operations; Hetzner's 64 KB minimum object size |
| Backups and archives with little egress                     | Backblaze B2, Storj, Hetzner                                        | Minimum durations if you delete early                   |
| Large public files through a CDN                            | B2 with a partner CDN, R2, or S3 behind a CloudFront flat-rate plan | The CDN's own terms and allowances                      |
| A small project next to your compute                        | DigitalOcean Spaces, R2's free tier                                 | Where the bundle's transfer runs out                    |
| Storage you keep and rarely read, with egress below storage | Wasabi                                                              | The 1 TB minimum and 90-day minimum                     |

## What we could not include

- **CDN plans in front of storage,** such as CloudFront's flat-rate plans or partner CDNs in front of B2. They can change the answer, but they depend on cache hit rates.
- **Committed-use and enterprise pricing.** Contracts and volume discounts are outside this comparison.
- **Scaleway.** Its page shows 75 GB of free egress and "EUR 0.01" after that, but does not print the unit clearly, so we left it out of the calculator rather than guess.
- **Performance.** This is a price comparison. We did not measure latency, throughput or availability.

## Summary

Zero egress is real, and for workloads that serve more than they store it changes the bill by one or two orders of magnitude compared with S3 list prices. But every provider pays for it somewhere else: a policy instead of a price, a ratio to storage, a charge per read, a minimum duration, a bundle that runs out. The right answer depends on the shape of your workload, not on the headline egress price, so run your own numbers with the fine print switched on before you move a bucket.
