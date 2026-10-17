---
title: 'Postgres 19 Slipped to November: Every Pulled Feature and Why'
excerpt: 'PostgreSQL 19 now ships on 19 November, and 13 items left its release notes after beta 1. Here is each pulled feature with the reason from its revert, what to use instead, a script that finds beta-era code that depends on them, and why "AI found too many bugs" is only part of the story.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-10-17'
publishedAt: '2026-10-17T09:00:00Z'
updatedAt: '2026-10-17T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - PostgreSQL
  - Databases
  - DevOps
  - Upgrades
  - Code Review
  - AI
---

PostgreSQL 19 was planned for October 2026, and the project's roadmap still says so. General availability is now planned for 19 November, with a second release candidate on 12 November. It will ship without SQL/PGQ graph queries, `UPDATE`/`DELETE ... FOR PORTION OF`, online checksum changes, `ALTER TABLE ... MERGE/SPLIT PARTITION`, and seven smaller features that were in the beta 1 release notes. The short version going around is that AI reviewers found more bugs than the developers could fix. That is part of it. Peter Eisentraut, who committed several of the reverted features, lists several possible causes and says it is probably a different combination for each feature. The mailing-list threads and the commit log fit his account, and which cause matters to you depends on what you planned to use.

This post goes through every feature that was pulled, with the reason given in its revert and what to use instead. It gives you a script that finds beta-era code using them, covers a limit in REPACK CONCURRENTLY (a feature that stayed) that its reference page does not mention, and counts what the commit log actually says about AI.

## TLDR

- **13 release-note items, covering 11 features, are gone since beta 1.** Ten features were reverted after beta 1 was stamped on 1 June. The eleventh was reverted in May, but its release-note entry stayed until 13 October.
- **The five big reverts landed between 27 August and 16 September.** Their revert messages list 47 commits (SQL/PGQ), 30 (online checksums, some only partly reverted), 23 (FOR PORTION OF), 14 (MERGE/SPLIT PARTITION) and 13 (`pg_get_*_ddl()`).
- **The causes, as Eisentraut describes them:** some code was not good enough, some features had design problems that beta could not fix, LLM-assisted review found a long tail of edge-case bugs faster than they could be handled, security work from April to August took the senior reviewers, and "everything works with everything" in Postgres makes some features very hard to finish.
- **The November date has its own reason:** the release team is folding the fixes from the 12 November minor releases into 19 before general availability.
- **AI in the commit log:** 23 of the 937 commits after beta 1 mention AI assistance, an AI tool or an AI lab. That counts only explicit credit, so it is a floor.
- **For your upgrade:** run the check script over migrations and ops code written against a beta, plan REPACK CONCURRENTLY runs one at a time across the whole cluster, and expect the first scheduled minor release on 11 February 2027.

## Prerequisites

- Code, migrations or runbooks written against a PostgreSQL 19 beta, if you want to check them
- `bash` and GNU `grep` for the check script
- Python 3 and an authenticated `gh` CLI if you want to rebuild the counts from the source tree

Everything below comes from the `REL_19_STABLE` branch at commit `221423812d` (17 October 2026), the release notes at the `REL_19_BETA1` tag, and the threads linked in each section. The scripts and the data snapshot are in the companion repo:

```github
https://github.com/The-DevOps-Daily/pg19-revert-ledger
```

## The timeline

Dates are commit and tag dates in the source tree. Public announcements follow a few days after a tag.

| Date                      | Event                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| April 2026                | Feature freeze for 19                                                                                              |
| 11 May                    | 23 security commits for the May minor releases                                                                     |
| 24 May                    | Database-specific logical replication snapshots reverted                                                           |
| 1 June                    | Beta 1 stamped                                                                                                     |
| 8 June to 17 July         | Four smaller reverts: fast defaults for domains, `pg_dumpall` formats, a lower `ALTER DOMAIN` lock, `GROUP BY ALL` |
| 13 July                   | Beta 2 stamped                                                                                                     |
| 10 August                 | Beta 3 stamped, and 35 security commits for the August minor releases                                              |
| 25 August                 | Robert Haas posts an LLM ranking of the riskiest PostgreSQL 19 features                                            |
| 27 August to 16 September | MERGE/SPLIT PARTITION, SQL/PGQ, CREATE SCHEMA, `pg_get_*_ddl()`, FOR PORTION OF and online checksums reverted      |
| 21 September              | Beta 4 stamped                                                                                                     |
| 12 October                | RC1 stamped                                                                                                        |
| 12 November               | RC2 planned, the same day as the minor releases                                                                    |
| 19 November               | General availability planned                                                                                       |

The cluster from late August to mid September is the part that made news. Five large features came out in three weeks, two of them in the week before the last beta.

## What was pulled, and why

The list comes from comparing the release notes at beta 1 with the branch head. An item counts as removed when none of the commits it cites appear in any current item, so items that were only reworded or merged do not count. That gives 13 items. The three `pg_get_*_ddl()` functions are one feature, so 11 features.

| Feature                                                                             | Reverted | Reason given                                                                                                                                                                                                                                                                                                                                                      | What to do instead                                                                                                                   |
| ----------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| SQL/PGQ property graphs (`CREATE PROPERTY GRAPH`, `GRAPH_TABLE`)                    | 7 Sep    | Open design questions the release management team listed on 2 September: graph metadata left orphaned by `DROP ... CASCADE` (which could make a graph impossible to dump and restore), how labels and properties are scoped, whether a graph needs a `pg_class` entry, and `pg_dump` dependency loops. Some fixes still needed catalog changes.                   | Recursive CTEs, or a graph extension such as Apache AGE (check its support for your version)                                         |
| `UPDATE`/`DELETE ... FOR PORTION OF`                                                | 15 Sep   | Lost updates under `READ COMMITTED` when concurrent temporal updates and deletes touched the same rows. The documented `SELECT ... FOR UPDATE` workaround did not cover `DELETE`.                                                                                                                                                                                 | Split the ranges in application code or a trigger. The `WITHOUT OVERLAPS` constraints from Postgres 18 still enforce no overlap.     |
| Online data checksums (`pg_enable_data_checksums()`, `pg_disable_data_checksums()`) | 16 Sep   | The revert message says it "saw a number of postcommit fixes during the beta period" and adds: "Suspicions were raised about the risk of more issues surfacing after GA."                                                                                                                                                                                         | `pg_checksums --enable` on a stopped cluster, as before. Clusters that `initdb` creates on 18 or later have checksums on by default. |
| `ALTER TABLE ... MERGE PARTITIONS` / `SPLIT PARTITION`                              | 27 Aug   | Reverted "due to multiple design issues which are too late to address in this release cycle". The thread lists moved rows decoded as plain inserts (which breaks logical replication), stored generated columns that silently get new values, partition-specific indexes and constraints that are silently lost, and open questions about publication membership. | `DETACH PARTITION`, create the new partition, `INSERT ... SELECT`, `ATTACH PARTITION`                                                |
| `pg_get_role_ddl()`, `pg_get_tablespace_ddl()`, `pg_get_database_ddl()`             | 13 Sep   | Design review: role output could not recreate password hashes the way `pg_dumpall` does, there was no dependency ordering, and it would be a second, separate implementation of translating catalog state into SQL beside `pg_dump`.                                                                                                                              | `pg_dumpall --roles-only` or `--tablespaces-only`, and `pg_dump --create` for the `CREATE DATABASE` statement                        |
| `pg_dumpall` custom, directory and tar formats, and `pg_restore --no-globals`       | 18 Jun   | A post-commit review recommended reverting and finishing it through a commitfest.                                                                                                                                                                                                                                                                                 | `pg_dumpall --globals-only`, plus `pg_dump -Fc` or `-Fd` per database                                                                |
| `GROUP BY ALL` (with no columns after it)                                           | 17 Jul   | Wrong results when `ORDER BY` used non-default equality semantics. A clean fix "seems like too much code churn for late beta", and the revert says "We'll revert and try again in v20".                                                                                                                                                                           | List the grouping columns                                                                                                            |
| Fast default for columns on domains with constraints                                | 8 Jun    | Failed with an empty table and an invalid default. The revert says the fix will involve an addition to the table access method API, so it was not ready for 19.                                                                                                                                                                                                   | Expect a table rewrite when you add such a column, as in 18                                                                          |
| More object types inside `CREATE SCHEMA`                                            | 11 Sep   | It depended on a change to the order of `CREATE SCHEMA` subcommands, and the compatibility risk of that change was judged larger than the gain. Foreign keys in `CREATE SCHEMA` still run at the end, because the SQL standard requires it.                                                                                                                       | Create the objects in separate statements after `CREATE SCHEMA`                                                                      |
| Lower lock level for `ALTER DOMAIN ... VALIDATE CONSTRAINT`                         | 18 Jun   | Unsafe: DML that had already started when a `NOT VALID` constraint was added could still write rows that violate it.                                                                                                                                                                                                                                              | It takes `ShareLock` on tables that use the domain, as before. Run it in a quiet window.                                             |
| Logical decoding plugins that skip shared catalogs (database-specific snapshots)    | 24 May   | The revert says it "was determined to have fundamental flaws".                                                                                                                                                                                                                                                                                                    | Nothing to replace, but it limits REPACK CONCURRENTLY (see below)                                                                    |

Two smaller behavior changes that never made the release notes were reverted too: forcing `LC_COLLATE` to `C` in the postmaster (the commit gives the reason as "Out of an abundance of caution") and basing identifier case folding on the default locale, which behaved differently for the builtin provider with locale `C` and a single-byte encoding.

Two features that stayed were cut back. REPACK CONCURRENTLY lost the snapshot change it depended on, which is the limit covered later in this post. The new fast path for foreign key checks went back to SPI on 15 October for keys whose values need a cast function.

## Cause 1: design problems that beta could not fix

Eisentraut starts his own list with the plain possibility that some of the code was not good enough. The threads behind the biggest reverts show something more specific: questions that had no agreed answer before the release.

FOR PORTION OF is the clearest example. On 10 September Andres Freund flagged its concurrency behavior in a code review, and the following day he showed that under `READ COMMITTED`, concurrent temporal updates and deletes on the same rows can lose all or part of the second operation. The leftover rows one statement inserts are not chained to the original row, and `EvalPlanQual` does not re-scan for them. With `DELETE ... FOR PORTION OF` in the mix, even the documented `SELECT ... FOR UPDATE` workaround did not prevent it. The author proposed raising a serialization failure so the client could retry. Andres replied:

> For better or worse, READ COMMITTED is extremely widely used, with one reason for that being not needing to retry, and making FPO not really work that way doesn't seem convincing to me.

When the release management team asked what the committer, Peter Eisentraut, was proposing, he answered: "I was trying to nudge toward reverting without saying it." He reverted it the next day.

SQL/PGQ went the same way. The release management team posted the list of open design issues on 2 September, and Tom Lane had already written on 25 August:

> At this point I'd be willing to bet dinner that if we ship it in v19 there will be post-release bug discoveries that are unfixable until v20.

His reason was specific: fixes still under discussion needed parse tree or catalog changes, which bump `catversion`. Minor releases do not change the catalog, so a bug that needs such a change after release can stay unfixed until 20.

MERGE/SPLIT PARTITION, the database-specific snapshots and the `pg_get_*_ddl()` functions were reverted for design reasons too. For the DDL functions, Noah Misch's review argued that PostgreSQL should not carry two independent implementations of the logic that translates catalog state into SQL. The fast default for domains needed an addition to the table access method API, and its revert says it was not ready for 19.

## Cause 2: a long tail found faster

Eisentraut's post about the reverts is the most direct account from someone on the receiving end. On the long tail:

> But with LLM-assisted code review, these kinds of things can get found much faster, and then you’re staring at a list of like forty defect reports. And even if each of them requires only a three-line fix on average, there is a fixed overhead to dealing with each of these, and then you run out of time.

He adds that most of the reverted code was written before LLM-assisted review was this useful, so "the effective quality bar has been raised after the time the feature was written and committed." He also says, as far as he can tell, the problem is not vibe coding: the code predates that.

A mailing-list post from 25 August shows how this fed the decisions. Robert Haas asked Claude to rank the PostgreSQL 19 features by the number and type of bugs already fixed after feature freeze, and posted the top six to ask whether any should be reverted. The counts are the model's tally of fixed bugs, not an audited total, and the ranking found no new bugs itself. Here are its six entries, sorted by fix count, next to what happened to each feature:

```chart
{
  "type": "bar",
  "title": "Post-freeze fixes per PostgreSQL 19 feature, as tallied by an LLM, and what happened to it",
  "unit": " fixes",
  "caption": "Counts from the LLM ranking Robert Haas posted to pgsql-hackers on 25 August 2026 (\"scary patch contest\"). Values marked ~ in the post are shown as the round number. Sorted by count; the post ranked the foreign key fast path first. Outcome from the REL_19_STABLE commit log, 17 October 2026.",
  "rows": [
    { "label": "REPACK / REPACK CONCURRENTLY", "value": 28, "series": "Kept in 19" },
    { "label": "Online data checksums", "value": 25, "series": "Reverted" },
    { "label": "UPDATE/DELETE FOR PORTION OF", "value": 17, "series": "Reverted" },
    { "label": "SQL/PGQ property graphs", "value": 17, "series": "Reverted" },
    { "label": "Foreign key check fast path", "value": 16, "series": "Kept in 19" },
    { "label": "postgres_fdw statistics import", "value": 7, "series": "Kept in 19" }
  ],
  "series": [
    { "name": "Kept in 19", "color": "#10b981" },
    { "name": "Reverted", "color": "#f59e0b" }
  ]
}
```

The feature with the most fixes, REPACK, is still in 19. The fix count did not decide anything on its own. In the threads, the reverted features had open design questions (FOR PORTION OF, SQL/PGQ) or a failure mode too dangerous to risk a long tail. For online checksums the ranking put it plainly: "A corruption-detection feature producing false positives is exactly the wrong failure mode."

### What the commit log says about AI

The commit messages credit AI in a few clear forms: security reports from Anthropic's and OpenAI's research teams, "Reported-by: Claude Code (via Noah Misch)", "Found by Bharath using AI assisted review with Claude", and disclosures that a draft of a patch was written with an LLM. Counting every commit whose message mentions AI assistance, an AI tool or an AI lab:

```chart
{
  "type": "line",
  "title": "REL_19_STABLE commits that mention AI assistance, tools or labs, and security commits, per month",
  "unit": " commits",
  "caption": "From the commit messages on REL_19_STABLE, 1 April to 17 October 2026 (1,501 commits). AI-credited = the message names Claude, Codex, an LLM, AI-assisted review, Anthropic, OpenAI or similar. Security = a 'Security: CVE-' trailer. Explicit credit only, so the AI line is a floor.",
  "x": ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"],
  "series": [
    { "name": "AI-credited", "data": [0, 1, 1, 2, 14, 2, 4], "color": "#8b5cf6" },
    { "name": "Security: CVE", "data": [0, 23, 0, 0, 35, 0, 0], "color": "#ef4444" }
  ]
}
```

After beta 1 that is 23 of 937 commits, or 2.5%. It only counts credit in the commit message. Much of the review happens on the mailing list, and a reviewer who used an LLM to find a bug and then reported it in their own words is not counted unless the commit says so. So read it as a floor, not as the share of bugs AI found.

The threads add two details that the headline version leaves out. In the FOR PORTION OF thread, Andres Freund raised the concurrency problem in his own review first. His reproduction of the lost update was then an AI-generated isolation test, but he wrote that he "really needed to force both Opus 5 and Fable 5.1 to get to it, they both swore up and down that this isn't a real issue at first". And in the `pg_get_*_ddl()` review, Noah Misch ran an Opus 4.8 review as well and wrote that it "found some minor issues that aren't worth addressing before the above". The revert came from his own design objections. In both cases the LLM was a tool in a person's review, and people made the calls.

## Cause 3: security work took the reviewers

The third cause is in Eisentraut's post too, and the commit log shows the timing. He calls it the "Vulnpocalypse": from April, the start of feature freeze, to August, the most recent security release, many senior developers were busy fixing security issues. The branch has 58 commits with a `Security: CVE` trailer since April, covering 40 CVEs, all on two days: 23 on 11 May and 35 on 10 August. Several of the AI-credited commits in August are those security fixes.

The review and testing that normally happens during beta was reduced while that work ran, and it picked up again in August. He offers that as the possible reason so many issues surfaced, and so many reverts happened, so late. Commit counts cannot measure how busy reviewers were, but the two security dates and the late-August cluster of reverts fit it. He thinks that with about two more months, much of the long tail could have been fixed, but the community chose to keep to the schedule instead of delaying for more fixes.

## Cause 4: everything works with everything

The last cause is structural. Eisentraut's example is a new SQL feature that has to work with domains, domains over composite types, a domain field with a `NOT NULL` constraint, a dropped and re-added column, a partition detached and reattached with a different column order, inside a view called from a security-definer function from a trigger. Nobody can test those combinations by hand. He says LLM-assisted fuzzing finds problems in them quickly and probably has to become part of feature development, and that internal interfaces should change so that each new combination does not open so many interactions.

He also points to something the project does not have: a way to commit a feature as experimental and mature it in the main tree. Some of the reverted work suffered from misunderstandings about exactly that.

## Why the date is 19 November

The reverts explain what is missing. They do not explain the date. The RC1 announcement does: the minor releases on 12 November "will include a large number of fixes", and "the release team decided to include these fixes in PostgreSQL 19 before its general availability". RC2 ships the same day as those minor releases, and general availability follows a week later.

So the extra weeks are for fixes going into 19, not for features coming back. Some of the reverted features are aimed at 20. The `GROUP BY ALL` revert says "We'll revert and try again in v20", and Eisentraut writes "I'm confident that many of the reverted features will come back before too long", with a few "80%-ready features" already queued for 20. Nothing promises any particular one.

## What this means for your upgrade

### Check code written against the betas

If your team wrote migrations, reports or runbooks against a 19 beta, they may use syntax that no longer exists. The companion repo has a check script for eight patterns: SQL/PGQ, `FOR PORTION OF`, `MERGE`/`SPLIT PARTITION`, bare `GROUP BY ALL`, the online checksum functions, `pg_get_*_ddl()`, `pg_dumpall` non-text formats and `pg_restore --no-globals`. It matches per line and on purpose loosely, so read each hit. `GROUP BY ALL region, status` has been valid since Postgres 14 (`ALL` is the default set quantifier) and is not flagged, but a valid `GROUP BY ALL` whose columns start on the next line is. A clean result means no pattern matched, not that the upgrade is safe. Here it is on the repo's example folders:

```terminal
{
  "title": "check-pulled-syntax.sh",
  "prompt": "$",
  "steps": [
    {
      "cmd": "scripts/check-pulled-syntax.sh examples/beta-era",
      "output": "FOR PORTION OF             examples/beta-era/migrations/20260901_orders.sql:11:UPDATE prices FOR PORTION OF valid_at FROM '2026-10-01' TO '2026-11-01'\nMERGE/SPLIT                examples/beta-era/migrations/20260901_orders.sql:2:ALTER TABLE orders MERGE PARTITIONS (orders_2026_07, orders_2026_08) INTO orders_2026_q3;\nGROUP BY ALL               examples/beta-era/migrations/20260901_orders.sql:8:SELECT region, status, count(*) FROM orders GROUP BY ALL\nonline checksums           examples/beta-era/ops/backup.sh:5:psql -c \"SELECT pg_enable_data_checksums()\"\npg_get_*_ddl()             examples/beta-era/ops/backup.sh:4:psql -Atc \"SELECT pg_get_role_ddl('app')\" > /backups/app-role.sql\npg_dumpall formats         examples/beta-era/ops/backup.sh:3:pg_dumpall --format=directory -f /backups/all-$(date +%F)\npg_restore globals         examples/beta-era/ops/backup.sh:6:pg_restore --no-globals -d postgres /backups/all-2026-09-01"
    },
    {
      "cmd": "echo \"exit $?\"",
      "output": "exit 1"
    },
    {
      "cmd": "scripts/check-pulled-syntax.sh examples/postgres-18",
      "output": "no pulled PostgreSQL 19 pattern matched under examples/postgres-18"
    },
    {
      "cmd": "echo \"exit $?\"",
      "output": "exit 0"
    }
  ]
}
```

It exits 1 on a hit and 2 if the scan itself fails, so you can run it in CI against the repository that holds your migrations:

```bash
# Fails the job if a pulled-syntax pattern matches. Pinned to a commit, not main;
# or copy the script into your own repo.
curl -fsSL -o check-pulled-syntax.sh \
  https://raw.githubusercontent.com/The-DevOps-Daily/pg19-revert-ledger/2588e0660651b4b6fd132a85699d12c35d16be62/scripts/check-pulled-syntax.sh
bash check-pulled-syntax.sh db/migrations
```

### Plan REPACK CONCURRENTLY one table at a time

`REPACK (CONCURRENTLY)` is one of the headline features of 19, and it stayed. But the change it relied on to build logical decoding snapshots per database was the one reverted in May. The revert message says what that means: it "restricts REPACK (CONCURRENTLY) so that only one process can run it concurrently on different tables and even on different databases". The original REPACK commit lists the same limit as a loose end, and Robert Haas's August post describes 19's REPACK CONCURRENTLY as "restricted to one process cluster-wide".

The `REPACK` reference page lists `max_repack_replication_slots` (default 5) as a limit, but not this one, and raising the slot setting does not lift it. If your plan was to run REPACK CONCURRENTLY across several bloated tables in parallel during one maintenance window, plan a queue instead. In the source, the decoding worker waits for every transaction that already has a transaction ID before it starts, so a second run most likely waits for the first. We did not run two at once, so treat that as a reading of the code, not a measurement.

### Plan the upgrade window

- **Test on RC1 now.** Feature-wise it is close to what ships. RC2 on 12 November adds the minor-release fixes.
- **Rehearse the upgrade on a copy of your data.** The pulled features are easy to find with the script; the changes that did ship are where an upgrade surprises you. If you run on Neon, a branch gives you a copy-on-write copy of production in seconds, so you can clean up beta-era migrations and test the queries the script flags against real data without touching the primary. A major version upgrade on Neon is a move to a new project on the new version, and Neon's [major version upgrade guide](https://neon.com/docs/postgresql/postgres-upgrade) covers the Import Data Assistant (for databases under 10 GB), dump and restore, and logical replication. Check which major versions Neon offers before you pick a date.
- **General availability is planned for 19 November.** The next scheduled minor release after that is 11 February 2027, per the project's roadmap. If your policy is to wait for the first minor release, that is when 19.1 is due, unless an out-of-cycle release comes first.
- **Do not plan on a pulled feature returning in a 19.x minor release.** Minor releases carry fixes, not new features, so the earliest any of them can return is 20.

## Summary

- 13 release-note items, covering 11 features, left the PostgreSQL 19 release notes after beta 1. Ten of the features were reverted after beta 1, one in May. The big ones are SQL/PGQ, FOR PORTION OF, online data checksums and MERGE/SPLIT PARTITION.
- The reasons differ by feature. In the threads, design questions with no agreed answer drove the big reverts. By Eisentraut's account, a long tail of edge-case bugs found faster with LLM-assisted review filled the queue, four months of security work took reviewers away during beta, and the need for every feature to work with every other one makes some of them very hard to finish.
- The commit log credits AI in 23 of 937 commits after beta 1. That is a floor, and in the threads people used the tools and people made the decisions.
- The 19 November date is about folding the 12 November minor-release fixes into 19, not about features coming back.
- Before you upgrade, check beta-era code with the script, and plan REPACK CONCURRENTLY as one run at a time across the cluster.

Sources: Peter Eisentraut, [The reverts will continue until morale improves](https://peter.eisentraut.org/blog/2026/10/09/the-reverts-will-continue-until-morale-improves); the [PostgreSQL 19 RC 1 announcement](https://www.postgresql.org/about/news/postgresql-19-rc-1-released-3409/); Robert Haas, [scary patch contest](https://www.postgresql.org/message-id/CA%2BTgmob9NY6m0YNFTQ4nFH2d0iC9SQRruDYxfndGKKzh8OC80w%40mail.gmail.com) and [Tom Lane's reply](https://www.postgresql.org/message-id/646368.1787697184%40sss.pgh.pa.us); the [SQL/PGQ design issues](https://www.postgresql.org/message-id/CAAKRu_bEtjWYWhYxSo0o_t3DaZYRQd5PkC0abA0g9Mp4%2BovH0w%40mail.gmail.com); the [FOR PORTION OF thread](https://www.postgresql.org/message-id/flat/62bf70cc-dc33-4188-8070-a8c177bb61de%40eisentraut.org); [pg_get_*_ddl() needs a redesign](https://www.postgresql.org/message-id/20260827015242.54.noahmisch%40microsoft.com); [MERGE/SPLIT PARTITIONS issues](https://www.postgresql.org/message-id/CAN4CZFNCU%3Dt09M%3D%2Br2t9hHLJuujdM4oQ8hCK_Sx-GpfiwMAicw%40mail.gmail.com); and [The Register's report](https://www.theregister.com/databases/2026/10/16/postgres-19-delayed-after-ai-reviewers-find-more-bugs-than-humans-can-fix/5303471).
