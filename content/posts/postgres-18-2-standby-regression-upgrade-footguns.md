---
title: 'PostgreSQL 18.2 Broke Standbys: The 18.x Upgrade Footguns'
excerpt: 'PostgreSQL 18.2 shipped regressions bad enough to force an out-of-cycle 18.3: halted standbys, substring crashes, and a pg_trgm segfault. Here is what went wrong and the quieter Postgres 18 upgrade traps to check before you patch.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-07'
publishedAt: '2026-07-07T09:00:00Z'
updatedAt: '2026-07-07T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - PostgreSQL
  - Databases
  - DevOps
  - Reliability
  - Upgrades
---

Minor PostgreSQL releases are supposed to be the boring ones. You read a short list of bug fixes, restart during a quiet window, and move on. PostgreSQL 18.2, shipped on February 12, 2026, was not boring. Its fixes over-corrected in a way that halted standby servers, made `substring()` throw on perfectly valid data, and crashed `pg_trgm`. The problems were serious enough that the project shipped an out-of-cycle 18.3 two weeks later, on February 26, to undo the damage.

If you run Postgres 18 in production, or you are about to upgrade to it, this is worth ten minutes. The regressions are real, and the quieter Postgres 18 upgrade footguns around them catch teams every week.

## TLDR

- **18.2 broke three things:** standbys halting with `could not access status of transaction`, a `substring()` encoding error on non-ASCII data, and a `pg_trgm` crash in `strict_word_similarity()`.
- **The cause:** two of them were security fixes that were too aggressive. The `substring()` regression came from the CVE-2026-2006 fix, the `pg_trgm` crash from the CVE-2026-2007 fix. The standby failure was a separate multixid wraparound bug.
- **The fix:** upgrade to **18.3** (out-of-cycle, February 26) or later. No dump and restore is needed between 18.x versions.
- **Watch the quieter traps too:** Postgres 18 turns data checksums on by default, which trips up `pg_upgrade`, plus the usual extension and replication checks.

## Prerequisites

- A PostgreSQL 18 deployment, or a plan to move to it from 17.
- Access to run minor upgrades and restart the server in a maintenance window.
- If you replicate, the ability to coordinate the upgrade across primary and standbys.

## What 18.2 actually broke

### Standbys halting on WAL replay

The headline failure: a standby replaying WAL that involved multixid truncation from an older minor version would stop with:

```text
FATAL:  could not access status of transaction 1234567
DETAIL:  Could not open file "pg_multixact/offsets/....": No such file or directory
```

The bug was in the logic that handles multixid wraparound coming from a previous version. The typical trigger is a standby on the latest minor version consuming WAL from an older primary, exactly the mixed-version state you pass through during a rolling minor upgrade. A halted standby means no read replica and no failover target until you fix it.

### substring() throwing on valid text

The CVE-2026-2006 fix tightened multibyte character validation to prevent a buffer over-read. It was too strict. On TOASTed (compressed) values containing non-ASCII characters, `substring()` and friends began raising spurious errors about incomplete characters on data that was completely valid:

```text
ERROR:  invalid byte sequence for encoding "UTF8": 0x..
```

Any query slicing text out of a column with, say, accented names or emoji could start failing. The 18.3 fix refined the validation so it stops crying wolf.

### pg_trgm crashing outright

The CVE-2026-2007 fix introduced a worse failure. In `strict_word_similarity()` and related `pg_trgm` functions, an internal bounds array that needed to grow did not return the updated pointer, so the function read freed memory. The result was a crash or garbage output, most reliably on input strings with more trigrams than first estimated, especially lowercased text under ICU locales with single-byte encodings. For anyone using `pg_trgm` for fuzzy search, that is a query that can take the backend down.

:::warning
Two of these regressions were themselves security fixes. That is the trap with minor releases: the same update that closes a CVE can open a functional regression. Read the release notes for the version you are jumping **to**, not just the one you are on.
:::

## Fix it: get to 18.3 or later

The fix is the upgrade. Minor PostgreSQL releases do not require a dump and restore, so it is an install plus a restart.

```terminal
{
  "title": "patch a minor version",
  "prompt": "$",
  "steps": [
    { "comment": "confirm what you are actually running" },
    { "cmd": "psql -tAc 'show server_version'", "output": "18.2" },
    { "comment": "upgrade the packages (Debian/Ubuntu, PGDG repo)" },
    { "cmd": "sudo apt-get update && sudo apt-get install --only-upgrade postgresql-18", "output": "postgresql-18 set to 18.3-1.pgdg" },
    { "comment": "restart during a maintenance window, then verify" },
    { "cmd": "sudo systemctl restart postgresql@18-main", "output": "" },
    { "cmd": "psql -tAc 'show server_version'", "output": "18.3" }
  ]
}
```

If you replicate, upgrade the standbys first, then the primary, so you never run a standby that is older than its primary. Because the standby regression triggered on mixed versions, the goal is to spend as little time as possible in a split-version state, and to land everything on 18.3 or newer (18.4 is out too).

## The quieter Postgres 18 upgrade footguns

Most of the pain around Postgres 18 is not the 18.2 regressions, it is the major-version jump from 17. Three traps show up again and again.

### Checksums are on by default now

Postgres 18 flips data checksums on by default at `initdb`. That is a good default, but `pg_upgrade` refuses to run when the old and new clusters disagree on checksums. If your 17 cluster was created with the old default (checksums off) and you `initdb` an 18 cluster with the new default (on), the upgrade stops cold.

```bash
# check the old cluster
psql -tAc 'show data_checksums'    # -> off

# option A: enable checksums on the old cluster first (offline; can be slow)
pg_checksums --enable -D /var/lib/postgresql/17/main

# option B: create the new cluster without checksums to match
initdb --no-data-checksums -D /var/lib/postgresql/18/main
```

Pick one before you run `pg_upgrade`, not after it fails halfway.

### Extensions, especially pgvector

`pg_upgrade` will happily migrate the catalog and leave you with an extension the new binaries cannot load. Confirm that every extension you use, `pgvector` above all given how many teams now depend on it, has a build for Postgres 18 installed on the new cluster before you cut over. Check `pg_extension` on the old cluster and match every entry.

### Test replication and failover, not just the primary

A major upgrade is exactly when replication edge cases surface, from conflict handling to slot state. Do a full rehearsal on a copy: upgrade, reconnect the standby, force a failover, and read from the promoted node. Finding a broken replica in staging is a Tuesday. Finding it during a real incident is not.

:::tip
Before any Postgres upgrade, write down your rollback. For a minor release that is "reinstall the previous package and restart." For a major one it is your pre-upgrade backup plus the old data directory, which `pg_upgrade` preserves unless you pass `--link`. Know which one you are relying on.
:::

## Summary

PostgreSQL 18.2 is a case study in why minor upgrades still deserve a read of the release notes: two security fixes over-corrected into a `substring()` error and a `pg_trgm` crash, and a separate multixid bug halted standbys mid-upgrade. The out-of-cycle 18.3 fixes all three, so get there or later. And when you make the bigger jump from 17 to 18, clear the quieter traps first, checksums now default on, every extension rebuilt, and replication rehearsed, so the boring upgrade stays boring.
