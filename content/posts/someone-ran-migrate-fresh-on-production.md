---
title: 'Someone Ran migrate:fresh on Production'
excerpt: 'We wiped a 30,000-row Laravel production database on purpose, then recovered every row in under a second with a Neon point-in-time restore. Here is the full timed experiment, the recovery playbook, and the guardrails that stop it happening to you.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-08-21'
publishedAt: '2026-08-21T09:00:00Z'
updatedAt: '2026-08-21T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Laravel
  - Postgres
  - Neon
  - Disaster Recovery
  - Backups
---

Every Laravel team has the story, or knows a team that does. A terminal window pointed at the wrong environment. A deploy script with `migrate:fresh` left in from the prototype days. A `--force` flag added months ago to silence a CI prompt. And then: every table dropped, every row gone, on production.

`php artisan migrate:fresh` drops all tables and re-runs your migrations from zero. On your laptop it is the fastest way to a clean slate. On production it is the fastest way to a very bad week.

We built a Laravel 13 app with a production-looking dataset, ran the disaster on purpose, and timed both the damage and the recovery. The wipe took 21 seconds. The recovery, using point-in-time restore on Neon, took less than one. This post walks through the whole experiment so you can reproduce it, plus the guardrails that make the disaster much harder to trigger in the first place.

## TL;DR

- `migrate:fresh --force` wiped 5,000 customers and 25,000 orders in 21 seconds.
- Recovery was a single API call to restore the branch to a timestamp: the call returned in 0.63 seconds, and the very next query read the recovered data.
- The connection string never changed and the app needed no redeploy.
- The broken state is preserved as a separate branch for forensics, so recovery destroys no evidence.
- Nightly `pg_dump` cannot do this: your recovery point is the last dump, so you lose up to a day of writes. Point-in-time restore rewinds to any second inside the retention window.
- Laravel ships a guardrail: `DB::prohibitDestructiveCommands()`. Turn it on.

## Prerequisites

- PHP 8.3+ and Composer (Laravel 13 requires PHP 8.3)
- A Laravel app configured for Postgres
- A project on [Neon](https://neon.com) (the free plan covers this entire experiment)
- A Neon API key for the restore call

The companion repo has the full app, seeder, and restore script:

```github
The-DevOps-Daily/neon-laravel-pitr-demo
```

## The setup: a production that would hurt to lose

The demo app is a small orders system: `customers` and `orders` tables behind Eloquent models, plus a seeder that bulk-inserts a realistic dataset. An `app:stats` command prints what the database holds, which gives us proof at every step of the experiment.

```php
// app/Console/Commands/AppStats.php
$this->table(
    ['customers', 'orders', 'revenue'],
    [[
        number_format(Customer::count()),
        number_format(Order::count()),
        '$' . number_format(Order::where('status', 'paid')->sum('total_cents') / 100, 2),
    ]]
);
```

Point `.env` at your Lakebase Postgres connection string (`postgresql://...`), migrate, and seed:

```terminal
{
  "title": "seed production",
  "steps": [
    { "cmd": "php artisan migrate --force", "output": "2026_08_21_094951_create_customers_table .. 1s DONE\n2026_08_21_094952_create_orders_table .. 1s DONE" },
    { "cmd": "php artisan db:seed --force", "output": "INFO  Seeding database.  (23s)" },
    { "cmd": "php artisan app:stats", "output": "+-----------+--------+----------------+\n| customers | orders | revenue        |\n+-----------+--------+----------------+\n| 5,000     | 25,000 | $18,825,946.87 |\n+-----------+--------+----------------+" }
  ]
}
```

Five thousand customers, twenty-five thousand orders, $18.8M in recorded revenue. This is our production.

Before the disaster, note the current time. In a real incident you will reconstruct this from your monitoring or deploy logs, but it is the one input the recovery needs:

```bash
date -u +%Y-%m-%dT%H:%M:%SZ
# 2026-08-21T09:53:20Z
```

## The disaster, timed

`migrate:fresh` drops every table in the database and re-runs all migrations. With `--force` it does not even ask for confirmation in production:

```terminal
{
  "title": "the disaster",
  "steps": [
    { "comment": "the command someone meant to run against staging" },
    { "cmd": "php artisan migrate:fresh --force", "output": "Dropping all tables .... 14s DONE\n2026_08_21_094951_create_customers_table .. 1s DONE\n2026_08_21_094952_create_orders_table .. 1s DONE" },
    { "cmd": "php artisan app:stats", "output": "+-----------+--------+---------+\n| customers | orders | revenue |\n+-----------+--------+---------+\n| 0         | 0      | $0.00   |\n+-----------+--------+---------+" }
  ]
}
```

Twenty-one seconds, end to end. The schema is back, which makes it worse: the app boots, health checks pass, and every screen renders empty. Monitoring that only checks "can I connect and query" sees a healthy database.

## Why your nightly dump does not save you

The classic answer is "restore from backup." The problem is not whether you have a backup. It is *when* the backup is from. With a nightly `pg_dump`, your recovery point is last night. Every order placed since then is gone, and on top of that you spend real time locating the dump, provisioning somewhere to restore it, and replaying it.

**Recovery Point Objective (RPO)** is the amount of data you accept losing, measured in time. Dump-based backups give you an RPO equal to your dump interval:

```chart
{
  "type": "bar",
  "title": "Worst-case data loss by backup strategy",
  "unit": " min",
  "caption": "RPO = maximum minutes of committed writes lost. Dump strategies assume the disaster lands just before the next scheduled dump. Point-in-time restore rewinds to any second inside the retention window.",
  "rows": [
    { "label": "Nightly pg_dump", "value": 1440 },
    { "label": "Hourly pg_dump", "value": 60 },
    { "label": "Point-in-time restore", "value": 0 }
  ]
}
```

Point-in-time restore (PITR) changes the model. Instead of snapshots at intervals, the database keeps its full write history for a retention window, and you can rewind to any second inside it. Neon does this natively: storage is a log of every change, and a branch is a named position in that history. Restoring is not "replay a dump", it is "move the branch pointer."

## The recovery: one API call

The restore is a single call against the branch, passing the timestamp you want to return to. The `preserve_under_name` parameter keeps the current (broken) state as its own branch instead of discarding it:

```bash
curl -X POST \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches/$BRANCH_ID/restore" \
  -d '{
    "source_branch_id": "'$BRANCH_ID'",
    "source_timestamp": "2026-08-21T09:53:20Z",
    "preserve_under_name": "before-disaster-recovery"
  }'
```

Here is the measured recovery, straight from our run:

```terminal
{
  "title": "the recovery",
  "steps": [
    { "comment": "restore the branch to the pre-disaster timestamp" },
    { "cmd": "./scripts/restore-to-timestamp.sh $PROJECT_ID $BRANCH_ID 2026-08-21T09:53:20Z", "output": "Restore requested. API call returned in 0.63s.\nOld state preserved as branch 'before-disaster-recovery'." },
    { "cmd": "php artisan app:stats", "output": "+-----------+--------+----------------+\n| customers | orders | revenue        |\n+-----------+--------+----------------+\n| 5,000     | 25,000 | $18,825,946.87 |\n+-----------+--------+----------------+" }
  ]
}
```

The API call returned in 0.63 seconds. The first `app:stats` after it read all 30,000 rows, revenue matching to the cent. Three details matter operationally:

1. **The connection string does not change.** The endpoint moves with the branch, so the Laravel app needed no `.env` change, no redeploy, no restart. It was reading recovered data on its next query.
2. **No evidence is destroyed.** The wiped state lives on as the `before-disaster-recovery` branch. You can connect to it later and work out exactly what ran and when, which your postmortem will thank you for.
3. **Restore time does not scale with database size.** Nothing is copied or replayed. The branch pointer moves to a different position in history, which is why a 30,000-row demo and a 300 GB production database restore in roughly the same time.

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "09:53:20", "sub": "5,000 customers", "icon": "database", "tone": "green" },
    { "label": "09:55:32", "sub": "migrate:fresh", "icon": "gear", "tone": "red" },
    { "label": "Restore", "sub": "one API call", "icon": "branch", "tone": "blue" }
  ],
  "branch": [
    { "label": "main → rewound to 09:53:20, app reads it instantly", "variant": "good" },
    { "label": "before-disaster-recovery → wiped state kept for forensics", "variant": "bad" }
  ]
}
```

:::note
The rewind window is bounded by your project's **history retention** setting (the default is 1 day; paid plans can raise it). Anything older than the window is out of reach, so treat PITR as your fast first responder, not a replacement for long-term backups with a separate retention policy.
:::

## Guardrails: make the disaster hard to trigger

Recovery in under a second is great. Not needing it is better. Three layers, cheapest first.

**1. Prohibit destructive commands in production.** Laravel ships this switch, and it should be in every production app's `AppServiceProvider`:

```php
use Illuminate\Support\Facades\DB;

public function boot(): void
{
    // Blocks migrate:fresh, migrate:refresh, migrate:reset and db:wipe
    // whenever APP_ENV is production, even with --force.
    DB::prohibitDestructiveCommands($this->app->isProduction());
}
```

With this enabled, `migrate:fresh --force` on production throws instead of dropping tables. It costs one line.

**2. Separate the credentials.** The migration user your deploy pipeline uses does not need `DROP` rights on every table. A role that can `ALTER` and `CREATE` but not `DROP` turns a fat-fingered command into a permissions error. On Neon you can also point staging and preview environments at branches instead of at production, so "wrong terminal" hits a copy, not the real thing.

**3. Know your restore drill before you need it.** The recovery above has three inputs: project ID, branch ID, timestamp. Put them in a runbook, script the call like the companion repo does, and run the drill once against a non-production branch. An incident is a bad time to read API docs for the first time.

## Reproduce it yourself

The whole experiment is scripted in the companion repo: clone it, point `.env` at a fresh project on Neon, and you can run the disaster and the recovery in about five minutes. Wiping a database on purpose, and getting it back in under a second, is the kind of drill that permanently changes how your team thinks about backups.

```bash
git clone https://github.com/The-DevOps-Daily/neon-laravel-pitr-demo
cd neon-laravel-pitr-demo
composer install
cp .env.example .env && php artisan key:generate
# point DB_* at your Neon connection string, then follow README.md
```

## Summary

- `migrate:fresh --force` needs 21 seconds to erase a production database, and the app looks healthy afterwards because the schema survives.
- Dump-based backups bound your loss to the dump interval. Point-in-time restore bounds it to seconds, because the storage keeps full write history inside a retention window.
- On Neon the restore is one API call that moves the branch pointer: measured at 0.63 seconds, no connection string change, no redeploy, and the broken state preserved for the postmortem.
- Turn on `DB::prohibitDestructiveCommands()`, split your migration credentials, and drill the restore once. The disaster that motivated this post should be a non-event on your team.
