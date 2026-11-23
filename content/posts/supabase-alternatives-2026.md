---
title: 'Best Supabase Alternatives in 2026: Free Plans Side by Side, and What Happens When a Project Goes Idle'
excerpt: 'We compared the free plans of Neon, Firebase, Appwrite, Convex, Nhost, AWS Amplify and PocketBase with Supabase: projects, database storage, compute, auth users, file storage and functions, read from each live pricing page on 24 November 2026. Then we timed what idle costs: an idle Neon compute answered its first query in under a second, and a paused Supabase project took about 3 minutes to restore by hand.'
category:
  name: 'Cloud'
  slug: 'cloud'
date: '2026-11-30'
publishedAt: '2026-11-30T07:07:00Z'
updatedAt: '2026-11-30T07:07:00Z'
readingTime: '20 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Cloud
  - Supabase
  - Neon
  - Postgres
  - Firebase
  - Backend as a Service
  - Free Tier
trackCampaign: 'neon'
---

**Short answer:** if you are leaving Supabase because of its free plan (two active projects, a 500 MB database, and a pause after a quiet week), **Neon** is the alternative with the most room on its Free plan: up to 100 projects, 1 GB of Postgres per project, branches that carry your data, and compute that scales to zero and wakes on the next query instead of pausing. Since September 2026 each Free project also gets Managed Better Auth (60,000 monthly active users), 5 GB of Object Storage and Functions. If you want a document database with offline-first mobile SDKs, **Firebase** is still the strongest free plan for that, but its file storage and functions now need a billing account. If you want to own the whole stack, **PocketBase** costs whatever your server costs. **Appwrite**, **Convex** and **Nhost** have real free plans with different limits, and **Turso**, **Xata** and **PlanetScale** are databases only.

Most "Supabase alternatives" lists compare features. This one compares the thing that decides most side projects, MVPs and hackathon apps: what you get for $0, and what happens to your app when nobody uses it for a week. We read every limit from the vendors' live pricing pages and docs, and we timed the idle behavior of the two Postgres platforms with a script instead of quoting it.

## TL;DR

- **Projects:** Neon allows 100 Free projects. Supabase allows 2 active ones, Appwrite 2, Nhost 1. Turso allows 100 databases, but it is a database only.
- **Database storage:** Neon gives 1 GB per project and 20 GB in total. Supabase gives 500 MB, Convex 0.5 GB, Nhost 1 GB, Firestore 1 GiB.
- **Auth, files, functions:** Neon's Free plan includes 60,000 auth MAU, 5 GB of file storage and 1 million function invocations per project. Appwrite has the highest auth cap (75,000 MAU, shared by its 2 projects). Firebase Spark has 50,000 auth MAU but no Cloud Storage and no Cloud Functions.
- **Branching:** Neon is the only backend in this list whose Free plan has branches that include the data (10 per project). Convex has preview deployments that start empty, and Turso branches are separate databases that count against its database quota.
- **Idle:** Neon's compute scales to zero after 5 minutes and wakes on the next query. We measured a median of 759 ms for the first query after a suspend. Supabase, Appwrite and Nhost pause a free project after about a week without activity, and you resume it by hand. Our paused Supabase project took about 3 minutes to answer a query again. Appwrite deletes a project that stays paused for 90 days, and Turso archives a database after 10 idle days.
- **Where Neon does not win:** Appwrite's MAU cap, Firebase's mobile SDKs and offline sync, Supabase's longer track record with Realtime (Neon's is in beta), and Firestore's 10 GiB of monthly egress against Neon's 5 GB per project. Neon's Functions and Object Storage also run in only four AWS regions so far.

## Prerequisites

- A rough idea of what your app needs from a backend: a database only, or also auth, file storage, functions and realtime
- To repeat the measurements: Node.js 20 or newer, a Neon API key and a Supabase access token for a Free organization

## How we compared

**Prices and limits.** Every limit in this post comes from the vendor's live pricing page or its docs, read on 24 November 2026 (verified on 2026-11-24). Each vendor section links the pages we used. Free plans change often: Neon raised its storage from 0.5 GB to 1 GB on 2 October 2026, Supabase now keeps a paused project restorable for up to a year, and Xata and PlanetScale no longer have free tiers at all. Check the linked page before you commit.

**Where a page did not say, we say so.** Several vendors do not state whether a card is needed to sign up, or what happens on the free plan at a limit. Those cells say "not stated" instead of a guess.

**Measurements.** We timed the idle behavior of Neon and Supabase from a 4 vCPU VM in DigitalOcean's Frankfurt region, with both databases in AWS eu-central-1 (Frankfurt):

1. **Neon.** A project on Postgres 17 with a 100,000-row table, using the Free plan's compute settings: autoscaling from 0.25 to 2 CU and a 5-minute scale-to-zero timeout. Our organization is on a paid plan, so these are the Free plan's settings, not a Free account. We timed project creation, 20 fresh connections to an awake compute, 30 cold starts 5 seconds after a suspend (20 over TCP, 10 over HTTP) and 10 more 60 seconds after one, the time from the last query to the automatic suspend, and 10 branches from the API request to the first query on the branch's copy of the data.
2. **Supabase.** A project in a Free organization, with the same 100,000-row table, reached through the session pooler with Supabase's CA certificate verified. We paused it through the Management API, tried to connect while it was paused, restored it, and timed the restore until a query returned the rows. Twice.

We did not wait a real week for Supabase to pause on its own: the API pause puts the project in the same paused state that the 7-day rule does, and the restore is the same button. Nothing else was measured; the other vendors' rows are read from their docs.

## The free plans side by side

The backends first: the platforms that give you a database plus at least some of auth, file storage and functions. "Per project" matters: Neon's limits are per project, while Supabase, Appwrite and Convex count most quotas across the whole organization or team.

| Free plan (verified 2026-11-24) | Projects                | Database                                                     | Compute                                                   | Auth users                                   | File storage                      | Functions                             |
| ------------------------------- | ----------------------- | ------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------- | --------------------------------- | ------------------------------------- |
| **Neon Free**                   | 100                     | Postgres, 1 GB per project, 20 GB total                      | 100 CU-hours per project per month, autoscaling to 2 CU   | 60,000 MAU per project (Managed Better Auth) | 5 GB per project                  | 1M invocations per project per month  |
| **Supabase Free**               | 2 active                | Postgres, 500 MB                                             | Shared-CPU Nano, up to 0.5 GB RAM, always on until paused | 50,000 MAU                                   | 1 GB, 50 MB max file              | 500K invocations, 2 s CPU per call    |
| **Firebase Spark**              | Not stated              | Firestore (documents), 1 GiB, 50K reads and 20K writes a day | Serverless                                                | 50,000 MAU                                   | None on Spark (needs Blaze)       | None on Spark (needs Blaze)           |
| **Appwrite Free**               | 2                       | Appwrite TablesDB, inside 2 GB shared storage                | Functions: 100 GB-hours                                   | 75,000 MAU                                   | 2 GB shared, 1 bucket per project | 750K executions, 2 per project        |
| **Convex Free**                 | 40 deployments per team | Convex documents, 0.5 GB per team                            | Serverless, 20 GB-hours of action compute                 | Convex Auth, no MAU cap stated               | 1 GB                              | 1M function calls                     |
| **Nhost Starter**               | 1 active                | Postgres, 1 GB                                               | 2 shared vCPUs and 1 GiB RAM across all services          | Unlimited users                              | 1 GB                              | 10 functions, 1 GB-hour, 10 s timeout |
| **AWS Amplify** (AWS Free plan) | Not stated              | DynamoDB, 25 GB                                              | Serverless (Lambda, AppSync)                              | 10,000 MAU (Cognito)                         | S3 from your credits              | 1M Lambda requests, 400K GB-s         |
| **PocketBase** (self-hosted)    | Your servers            | SQLite, your disk                                            | Your server                                               | No cap                                       | Your disk or S3                   | Go or JavaScript hooks                |

Then the rows that decide whether the plan works for a real app: realtime, branching, what idle does, and the limit most likely to bite.

| Free plan          | Realtime                                      | Branches on Free                                          | When the project goes idle                                                                      | The limit that bites                                                         |
| ------------------ | --------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Neon Free**      | Realtime, in beta (Postgres 18, four regions) | 10 per project, with the parent's data                    | Compute scales to zero after 5 min and wakes on the next query. No project pause.               | 5 GB of egress per project, shared by Postgres, Object Storage and Functions |
| **Supabase Free**  | 200 connections, 2M messages a month          | None (Pro plan)                                           | Paused after low activity over 7 days. Resume by hand.                                          | 2 active projects and the 7-day pause                                        |
| **Firebase Spark** | Realtime Database: 100 connections            | None                                                      | No pause stated                                                                                 | Daily Firestore read and write caps; a product over quota is shut off        |
| **Appwrite Free**  | 250 connections, 2M messages                  | None stated                                               | Paused after 7 days without development activity. Resume by hand. Deleted after 90 days paused. | The pause, then the deletion                                                 |
| **Convex Free**    | Built in, every query is live                 | Preview deployments, no data copied, deleted after 5 days | No pause stated                                                                                 | 0.5 GB of storage, and every index counts toward it                          |
| **Nhost Starter**  | GraphQL subscriptions                         | None                                                      | Paused after 1 week of inactivity. Unpause by hand.                                             | 1 active project, 10 s function timeout                                      |
| **AWS Amplify**    | AppSync, from credits                         | Per-developer sandboxes                                   | No pause; the AWS Free plan ends after 6 months or when credits run out                         | The account closes when the Free plan ends unless you upgrade                |
| **PocketBase**     | Built in                                      | None                                                      | Whatever your host does                                                                         | You run the server, TLS, backups and email                                   |

And the databases that people often list as Supabase alternatives but that replace only the Postgres part:

| Database only   | Free plan                                                                       | Branches                                                                                      | When idle                                                                           |
| --------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Turso**       | 100 databases, 5 GB, 500M rows read and 10M written a month                     | A branch is a new database with the data; it counts against the 100 and you delete it by hand | Archived after 10 days of inactivity; unarchive with the CLI or API                 |
| **Xata**        | No free tier: a free trial, or the open source version on your own servers      | Copy-on-write, with data                                                                      | Scales to zero after 30 min by default; wakes on a new connection in about a second |
| **PlanetScale** | No free plan; the cheapest is single-node Postgres at $5 a month, card required | Each Postgres dev branch is $5 a month and starts empty                                       | Always on                                                                           |

```chart
{
  "type": "bar",
  "title": "Projects allowed on the free plan",
  "unit": " projects",
  "caption": "From each vendor's live pricing page, verified on 2026-11-24. Firebase and AWS do not state a project limit for their free plans. Turso counts databases, not backend projects.",
  "rows": [
    { "label": "Neon Free", "value": 100, "series": "Neon" },
    { "label": "Turso Free (databases only)", "value": 100, "series": "Others" },
    { "label": "Supabase Free (active)", "value": 2, "series": "Others" },
    { "label": "Appwrite Free", "value": 2, "series": "Others" },
    { "label": "Nhost Starter (active)", "value": 1, "series": "Others" }
  ],
  "series": [
    { "name": "Neon", "color": "#10b981" },
    { "name": "Others", "color": "#94a3b8" }
  ]
}
```

## What happens when a project goes idle

This is the row that decides whether a free plan works for a side project. A demo that you show twice a month, an internal tool used on Mondays, a portfolio app: all of them spend most of their life idle. The free plans handle that in three different ways.

**Scale to zero, wake on the next query: Neon.** After 5 minutes without activity the compute stops, and the next connection starts it again. On the Free plan you cannot turn this off. Neon does not pause Free projects for inactivity, and there is no restore step. The cost is a slower first query.

**Pause after a quiet week, resume by hand: Supabase, Appwrite, Nhost.** The project goes offline, and every request fails until you open the dashboard and resume it. A paused Supabase project can be restored for up to a year. Appwrite deletes a project that stays paused for 90 days, after email alerts.

**No idle rule, but other clocks: Firebase, AWS, Turso.** Firebase states no pause for Spark projects. The AWS Free plan has no idle rule either, but the plan itself ends after 6 months or when the credits run out. Turso archives a free database after 10 days without activity, and you unarchive it with the CLI or the API.

### Neon: the first query after idle, measured

We suspended the compute through the API, waited until Neon reported it idle, and timed a fresh connection plus a `count(*)` over the 100,000 rows. The first pass waited 5 seconds after the suspend: 20 times over TCP with node-postgres, and 10 times over HTTP with the Neon serverless driver. Those numbers were spread out, so we ran a second pass on a new project that waited 60 seconds after each suspend, 10 times over TCP. For comparison, the same query on a fresh TCP connection to an awake compute took a median of 39 ms.

```chart
{
  "type": "dots",
  "title": "Neon: first query after the compute scaled to zero",
  "unit": "ms",
  "caption": "Fresh connection plus count(*) over 100,000 rows, from a VM in Frankfurt to aws-eu-central-1, on 23 November 2026 (UTC). Free plan compute settings (0.25 to 2 CU, 5-minute timeout) on a paid-plan organization. The awake row is the same query on a compute that was already running.",
  "series": [
    {
      "name": "60 s after suspend, TCP",
      "samples": [
        772.1,
        801,
        749.5,
        790.1,
        758.8,
        776.6,
        759.2,
        742.9,
        747.7,
        736.3
      ],
      "median": 759.0,
      "color": "#10b981"
    },
    {
      "name": "5 s after suspend, TCP",
      "samples": [
        1759.2,
        3392.2,
        1247.8,
        1866.3,
        2879.4,
        768.5,
        797.5,
        1466.8,
        1660,
        778.7,
        1300.7,
        761.3,
        820.2,
        808.1,
        1894.4,
        1273.9,
        1241.5,
        779.6,
        838.4,
        833.1
      ],
      "median": 1244.7
    },
    {
      "name": "5 s after suspend, HTTP driver",
      "samples": [
        902.3,
        769.8,
        829.6,
        775,
        758.7,
        1786.7,
        803.1,
        781.8,
        783.1,
        1361.3
      ],
      "median": 793.1
    },
    {
      "name": "Awake compute, TCP",
      "samples": [
        40.8,
        47.2,
        31.4,
        33.8,
        31.4,
        40,
        49.9,
        45.1,
        47.8,
        38.4,
        43.7,
        43.6,
        37.2,
        36.9,
        29.7,
        32.4,
        31,
        38.8,
        30.1,
        41.6
      ],
      "median": 38.6,
      "color": "#94a3b8"
    }
  ]
}
```

With a minute of idle before the query, which is closer to a real quiet stretch, the first query took a median of **759 ms**, and all 10 runs were between 736 and 801 ms. Right after a suspend, the wake was slower and less even: a median of 1,245 ms over TCP, with a worst case of 3,392 ms, and 793 ms over HTTP. Either way it is more than the "few hundred milliseconds" on Neon's pricing page, and a bit more than the 568 ms median we measured in June in our [Neon vs Supabase free tier benchmarks](/posts/neon-vs-supabase-free-tier-benchmarks). One night in one region is not enough to call that a trend. Plan for up to a second on the first request after a quiet stretch, and normal latency after it.

We also left the compute alone after a query and polled its state. It suspended 329 and 313 seconds after the last query. Anything that queries more often than that, such as a health check every 5 minutes, keeps the compute awake and spends CU-hours; we measured which clients do that in [what keeps a Neon compute awake](/posts/what-keeps-a-neon-compute-awake).

### Supabase: pause and restore, measured

We paused the Free project through the Management API. The pause took 91 and 90 seconds. While it was paused, a connection through the pooler failed straight away:

```text
(ENOTFOUND) tenant/user postgres.<project-ref> not found
```

So a paused Supabase project is not slow, it is gone: your app gets connection errors until someone resumes it. We then restored it. The project reported healthy after 199 and 184 seconds, and the first query that returned all 100,000 rows came 201 and 185 seconds after the restore request. The data was all there. Supabase does not resume a project on a connection: someone has to press the button in the dashboard or call the restore API. This is why people run scheduled jobs that query a free Supabase project, so that it never counts as inactive.

The trade is easy to state. Neon costs you about a second after every quiet stretch, and never needs you. Supabase costs you nothing while the project is active, but after a quiet week it needs a person and about 3 minutes before it answers again.

## Neon: the most room on a Free plan

[Neon](https://neon.com/pricing) is a set of backend services built around Lakebase Postgres. The Free plan needs no card and gives you, per project:

- **Postgres:** 1 GB of storage per project, up to 20 GB across your projects, and 100 CU-hours of compute a month, autoscaling up to 2 CU (8 GB of RAM). The default compute is 0.25 CU, so 100 CU-hours is about 400 hours at that size.
- **Branches:** 10 per project. A branch is a copy-on-write copy of the parent, so it has the data from the start. We timed 10 branches of the 100,000-row project: the median from the API request to the first query on the branch was 1.9 seconds, all 10 between 1.8 and 2.0 seconds, and every branch had all 100,000 rows.
- **Managed Better Auth:** up to 60,000 monthly active users per project, at no extra charge. The users live in a schema in your own database, so you can join them to your tables. We built a small app on it in [auth for a Postgres app, without a separate service](/posts/neon-auth-without-a-separate-service).
- **Object Storage:** 5 GB per project, S3-compatible, and it branches with the database.
- **Functions:** Node.js 24, 1 million invocations, 10 active capacity-hours and 400 waiting capacity-hours per project a month.
- **Data API** on every plan, and **Realtime** in beta, free during the beta.
- **Restore:** a 6-hour history window (up to 1 GB of changes) and one manual snapshot.

Creating a project took 3.0 to 5.3 seconds from the API request to the first query (median 3.1 seconds, 5 projects), so the 100-project limit is something you can use from a script: one project per customer demo, per hackathon, or per agent run.

At a limit, Neon stops instead of billing you. When a project uses up its 100 CU-hours or its 5 GB of network transfer for the month, its compute is suspended until the next month. Writes that would grow a project past 1 GB fail until you free space. No data is deleted.

Where Neon's Free plan is weaker:

- **Egress is 5 GB per project**, and Postgres, Object Storage and Functions share it. Serving images from Object Storage uses it up faster than queries do. Firestore gives 10 GiB a month.
- **Functions, Object Storage, the AI Gateway and Realtime run in four AWS regions** (us-east-1, us-east-2, eu-central-1, ap-southeast-1). Postgres and Managed Better Auth run in all of Neon's AWS regions.
- **Realtime is in beta** and needs Postgres 18. Supabase's Realtime has years of production use and published quotas.
- **The restore window is 6 hours.** That covers a bad migration you notice the same day, not one you notice next week.
- **An always-busy app runs out of compute.** 100 CU-hours covers about 400 hours a month at 0.25 CU, and a month has about 730. The Free plan fits apps that are idle part of the day, which is most free-plan apps.

Sources: [Neon pricing](https://neon.com/pricing), [plans](https://neon.com/docs/introduction/plans), [scale to zero](https://neon.com/docs/introduction/scale-to-zero), [regions](https://neon.com/docs/introduction/regions), [Functions](https://neon.com/docs/compute/functions/overview), [Object Storage](https://neon.com/docs/storage/overview), [Realtime](https://neon.com/docs/realtime/overview), [storage change on 2 October 2026](https://neon.com/docs/changelog/2026-10-02). For the two platforms in more detail, including paid plans, see the [Neon vs Supabase comparison](/comparisons/neon-vs-supabase).

## Supabase: the baseline

[Supabase's Free plan](https://supabase.com/pricing) is the one everyone compares against: Postgres, auth with 50,000 MAU, 1 GB of file storage, 500,000 Edge Function invocations, and Realtime with 200 concurrent connections and 2 million messages a month. The SDKs are mature and the Realtime product is out of beta.

The limits that send people looking: two active free projects (counted across every organization where you are an owner or admin), a 500 MB database on a fixed 2 GB disk that goes read-only at 95%, no branching (Pro plan only, and branches start without data by default), no backups, and the pause after 7 days of low activity. Quotas are per organization. If you keep exceeding them, Supabase can restrict the organization: read-only mode, pausing projects, or HTTP 402 on API requests.

Sources: [pricing](https://supabase.com/pricing), [free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [billing FAQ](https://supabase.com/docs/guides/platform/billing-faq), [Edge Function limits](https://supabase.com/docs/guides/functions/limits), [Realtime limits](https://supabase.com/docs/guides/realtime/limits).

## Firebase: the best free mobile SDKs, but files and functions need Blaze

The [Spark plan](https://firebase.google.com/pricing) needs no payment method. It gives you Cloud Firestore (1 GiB stored, 50,000 reads and 20,000 writes a day, 10 GiB of egress a month), the Realtime Database (1 GB, 100 simultaneous connections), and Authentication with 50,000 MAU. Its offline-first mobile and web SDKs are still the strongest reason to pick it.

What changed: Cloud Storage for Firebase and Cloud Functions are not available on Spark any more. The pricing page lists both as "Not applicable" on Spark, and Storage calls from Spark projects return 402 or 403. Both need the Blaze plan, which keeps a no-cost allowance but requires a billing account. If you want Postgres, Firebase's SQL Connect runs on Cloud SQL and comes as a 3-month trial.

Firebase states no pause for idle projects. Its limits work the other way: a product that goes over its no-cost quota is shut off for the rest of the month, and Firestore's read and write quotas are counted per day. If your reason to leave Supabase is Postgres itself, Firebase is the wrong move: Firestore is a document database, and moving back later means remodeling your data, as we explain in our [Firebase alternatives guide](/posts/firebase-alternatives-2026).

Sources: [pricing](https://firebase.google.com/pricing), [Firestore quotas](https://firebase.google.com/docs/firestore/quotas), [Auth limits](https://firebase.google.com/docs/auth/limits), [Storage changes](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

## Appwrite: the highest auth cap, and a pause with a deadline

[Appwrite Cloud's Free plan](https://appwrite.io/pricing) gives you 2 projects with 75,000 MAU, 2 GB of storage, 5 GB of bandwidth, 750,000 function executions and Realtime with 250 connections, all shared across both projects. The database on Free is Appwrite's own TablesDB; dedicated Postgres and MySQL databases start at $10 a month.

Idle is the strictest in this list. A free project is paused after 7 days without development activity, it is offline to your users while paused, and it is deleted after 90 days in that state (Appwrite emails you first). At a limit the project freezes and the Console goes read-only until you upgrade, delete resources or the billing cycle resets.

Sources: [pricing](https://appwrite.io/pricing) (and its [Markdown copy](https://appwrite.io/pricing.md), which we read because the table renders in the browser), [Free plan docs](https://appwrite.io/docs/advanced/billing/free), [changelog on paused project deletion](https://appwrite.io/changelog/entry/2026-06-29).

## Convex: realtime by default, small storage

[Convex](https://www.convex.dev/pricing) is a reactive backend with its own document database: every query is a live subscription, so realtime is built in rather than added. The Free plan allows 40 deployments per team, 0.5 GB of database storage, 1 GB of database I/O and 1 GB of egress a month, 1 million function calls, 20 GB-hours of action compute and 1 GB of file storage. Auth is Convex Auth (open source, users in your Convex database) or a provider like Clerk or Auth0.

Preview deployments work on the Free plan, but they start without production data (you seed them with a function) and are deleted after 5 days. We found no idle pause in the docs. At a limit, function calls can return errors and writes can fail.

Sources: [pricing](https://www.convex.dev/pricing), [limits](https://docs.convex.dev/production/state/limits), [deployments](https://docs.convex.dev/production/multiple-deployments), [auth](https://docs.convex.dev/auth/overview).

## Nhost: Postgres and GraphQL, one active project

[Nhost](https://nhost.io/pricing) is the closest in shape to Supabase: a dedicated Postgres with Hasura GraphQL, auth, storage and functions. The Starter plan has 1 active project with a 1 GB database, 1 GB of file storage, 5 GB of egress, unlimited auth users, and 10 functions with a 10-second timeout. All services share 2 vCPUs and 1 GiB of RAM. There are no daily backups. A project is paused after a week without activity and you unpause it yourself, the same pattern as Supabase.

Sources: [pricing](https://nhost.io/pricing), [compute resources](https://docs.nhost.io/platform/cloud/compute-resources).

## AWS Amplify: a 6-month free plan, then the AWS bill

Amplify has no free plan of its own. A Gen 2 backend runs on Cognito (auth), AppSync (GraphQL and realtime), DynamoDB (data), Lambda (functions) and S3 (files), and each is billed by AWS. Accounts created since 15 July 2025 get the [AWS Free plan](https://aws.amazon.com/free/): $100 in credits, up to $100 more for trying services, for up to 6 months. Some allowances do not expire: Cognito's 10,000 MAU, Lambda's 1 million requests and 400,000 GB-seconds, and DynamoDB's 25 GB.

There is no idle rule, but when the Free plan ends, the account closes unless you upgrade, and AWS keeps the data for 90 days. The [Amplify pricing page](https://aws.amazon.com/amplify/pricing/) still shows a "Free for 12 months" hosting column, which is the older model for accounts created before July 2025. We could not read the list of services covered by the new Free plan, because it renders in the browser.

Sources: [AWS Free plan FAQ](https://aws.amazon.com/free/free-tier-faqs/), [Cognito pricing](https://aws.amazon.com/cognito/pricing/), [Lambda pricing](https://aws.amazon.com/lambda/pricing/), [AppSync pricing](https://aws.amazon.com/appsync/pricing/).

## PocketBase: free software, your server

[PocketBase](https://pocketbase.io) is one MIT-licensed binary with SQLite, auth, file storage, realtime subscriptions and an admin UI. There is no hosted plan, so there are no quotas: the limits are your server's CPU, RAM and disk. You run the server, TLS (it can get Let's Encrypt certificates itself), backups and an SMTP server for email. It scales vertically on one server, it is still before version 1.0, and it is a volunteer project without promised support. For a small app on a VM you already pay for, it is the cheapest option here. If you are choosing between SQLite and Postgres for that, our [SQLite vs PostgreSQL comparison](/comparisons/sqlite-vs-postgresql) covers the trade.

Sources: [pocketbase.io](https://pocketbase.io), [FAQ](https://pocketbase.io/faq/), [going to production](https://pocketbase.io/docs/going-to-production/).

## Database only: Turso, Xata, PlanetScale

These come up in Supabase alternative searches, but they replace the database, not the backend. You add auth, storage and functions yourself.

**[Turso](https://turso.tech/pricing)** has the most generous database-only free plan: no card, 100 databases, 5 GB, 500 million rows read and 10 million written a month, and 1 day of point-in-time restore. A branch is a new database created from an existing one, so it carries the data, but it uses one of your 100 databases and you delete it by hand. Free databases are archived after 10 days without activity. If any one metric goes over quota, all your databases are blocked. It is SQLite-compatible, not Postgres.

**[Xata](https://xata.io/pricing)** is Postgres with copy-on-write branches and scale to zero (after 30 minutes by default, waking in about a second). It has no free tier now: there is a free trial, and the open source version is free on your own servers. Xata announced on 9 November 2026 that it is joining ClickHouse.

**[PlanetScale](https://planetscale.com/pricing)** has no free plan. Its cheapest option is single-node Postgres at $5 a month with a card on file, and each Postgres development branch is another $5 a month and starts without schema or data.

## Which one should you pick?

- **You want many small Postgres projects that survive being ignored:** Neon. 100 projects, no pause, branches with data, and auth, files and functions in the same project.
- **You want the most established all-in-one bundle and can live with 2 projects and the weekly pause:** stay on Supabase, and put a reminder in your calendar.
- **You are building a mobile app and want offline sync:** Firebase, and plan for Blaze as soon as you need file uploads or functions.
- **You need the most auth users on a free plan:** Appwrite (75,000 MAU), if you can keep the project active.
- **Your app is realtime first:** Convex, within its 0.5 GB of storage.
- **You already pay for a server:** PocketBase.
- **You only need a database:** Neon or Turso if you want a free plan, Xata if you want copy-on-write branches and can pay from the start.

Whatever you pick, read the idle rule before the storage number. A free plan that pauses your app after a quiet week costs you more in a demo than a cold start of about a second.

## How the cold start test works

The test script is about 200 lines of Node.js: it creates the projects, runs every step above, writes one JSON line per sample, and deletes everything it created. The core of the cold start test is short, and you can rebuild it with the Neon API and node-postgres:

```javascript
// Suspend the compute, wait until Neon reports it idle, then time a fresh connection plus a query.
await napi('POST', `/projects/${projectId}/endpoints/${endpointId}/suspend`);
while (
  (await napi('GET', `/projects/${projectId}/endpoints/${endpointId}`)).endpoint.current_state !==
  'idle'
) {
  await sleep(500);
}
await sleep(5000);

const started = performance.now();
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: true } });
await client.connect();
await client.query('select count(*) from notes'); // wakes the compute
console.log({ coldStartMs: performance.now() - started });
await client.end();
```

What we did not measure: a Supabase project pausing on its own after 7 days (we used the API pause, which leads to the same paused state), Neon on a Free account rather than the Free plan's settings on a paid organization, and any vendor other than Neon and Supabase. One session in one region on one night; your numbers will differ by region and by day.
