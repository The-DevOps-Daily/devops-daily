---
title: 'Stop Compiling Postgres Extensions in Your Dockerfile: How pglayers Works'
excerpt: 'Adding pgvector or PostGIS to a Postgres image usually means apt-get, build tools, and a fat, slow image. pglayers ships each extension as a scratch Docker layer you COPY in. Here is how it works and when to use it.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2026-07-20'
publishedAt: '2026-07-20T10:00:00Z'
updatedAt: '2026-07-20T10:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Docker
  - PostgreSQL
  - Containers
  - DevOps
  - Databases
---

Everyone who runs Postgres in Docker eventually needs an extension the official image does not ship: pgvector for embeddings, PostGIS for geospatial, pg_cron for scheduling, TimescaleDB for time-series. And everyone reaches for the same tired pattern: a Dockerfile that runs `apt-get install build-essential`, clones the extension, compiles it, and installs it. The result is a fat image full of build tools you do not need at runtime, a slow build you cache-bust every time the base changes, and a version-pinning headache.

[pglayers](https://github.com/pglayers/pglayers), announced on the PostgreSQL news feed in July 2026, takes a genuinely different approach: it publishes each extension as a minimal, `FROM scratch` Docker image containing only the extension's files, and you compose them onto the official Postgres image with `COPY --from`. No compilation, no package manager, no build tools in the final image. It is a neat trick that leans on a Postgres 18 feature, and it is worth understanding even if you decide not to adopt it.

## TL;DR

- **The old way:** `apt-get` + compile extensions in your Dockerfile, bloating the image and the build.
- **pglayers:** each extension is a `FROM scratch` image with just its shared libraries, control files, and SQL scripts. You `COPY --from=ghcr.io/pglayers/pgx-<name>:<pg_major>` onto `postgres:<major>`.
- **Why it is clean:** file copies instead of builds, no runtime build tooling, per-extension version pinning via image tags.
- **The enabling feature:** Postgres 18's `extension_control_path` lets each extension live in its own directory instead of all piling into one shared path.
- **The caveat:** the extension layer's build environment (Debian Trixie, glibc 2.38) must match your base image, and this is Linux-container-only.

## Prerequisites

- Comfort with a Dockerfile and multi-stage-style `COPY --from`.
- You run Postgres in a container and have at least once fought to add an extension.
- Postgres 17 or 18 in mind (18 gets the cleanest behavior; more on that below).

## The problem, concretely

Here is the pattern pglayers replaces. To add pgvector the traditional way:

```dockerfile
FROM postgres:17

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential postgresql-server-dev-17 git \
    && git clone --branch v0.8.5 https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && cd /tmp/pgvector \
    && make && make install \
    && rm -rf /tmp/pgvector \
    && apt-get purge -y build-essential git \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*
```

That works, but look at what it costs: a compiler toolchain pulled in and then purged (and if you forget the purge, it ships), a build that reruns whenever the layer cache invalidates, and a whole dance repeated per extension. Add PostGIS and pg_cron and the Dockerfile triples.

## How pglayers does it instead

The same result with pglayers:

```dockerfile
FROM postgres:17

COPY --from=ghcr.io/pglayers/pgx-pgvector:17  / /
COPY --from=ghcr.io/pglayers/pgx-pg_cron:17   / /
COPY --from=ghcr.io/pglayers/pgx-postgis:17   / /
```

That is the whole thing. Each `pgx-*` image is built `FROM scratch` and contains only the files a Postgres extension actually needs on disk:

- the compiled shared library (`.so`)
- the control file (`.control`)
- the SQL install scripts
- placed at the correct filesystem paths for the target Postgres major version

`COPY --from=<image> / /` copies that entire minimal filesystem onto your Postgres image. Because the layer is just files, Docker treats it like any other layer: cached, deduplicated, fast. No build ran in your Dockerfile because the build already happened upstream when pglayers published the image.

```diagram
{
  "type": "flow",
  "title": "Composing a Postgres image with pglayers",
  "nodes": [
    { "label": "postgres:17 (official base)", "icon": "database" },
    { "label": "pgx-pgvector:17 (scratch layer)", "icon": "box" },
    { "label": "pgx-postgis:17 (scratch layer)", "icon": "box" },
    { "label": "Your composed image", "icon": "server" }
  ]
}
```

### The naming convention

pglayers publishes on GitHub Container Registry, not Docker Hub:

- **One extension:** `ghcr.io/pglayers/pgx-<extension>:<pg_major>`, e.g. `pgx-pgvector:17`
- **Pinned to a version:** `pgx-<extension>:<pg_major>-<version>`, e.g. `pgx-pgvector:17-v0.8.3`
- **A bundle profile:** `ghcr.io/pglayers/pglayers-full:17` (all 80-plus extensions) or `pglayers-azure:17` (the set Azure Database for PostgreSQL supports)

The image tag *is* your version pin. Want a specific pgvector against Postgres 18? `pgx-pgvector:18-v0.8.3`. That is easier to reason about than a `git clone --branch` buried in a RUN line.

### Extensions that need shared_preload_libraries

Some extensions (pg_cron, pgaudit, pg_partman, TimescaleDB, pg_net, pgsodium) have to be loaded at server start via `shared_preload_libraries`. Copying the files in does not do that; you still add one line:

```dockerfile
RUN echo "shared_preload_libraries = 'pg_cron,pgaudit'" \
    >> /usr/share/postgresql/postgresql.conf.sample
```

The bundle images (`pglayers-full`, `pglayers-azure`) set this up for their included extensions automatically, which is the main reason to reach for a profile over hand-picking layers.

## The Postgres 18 feature that makes this clean

pglayers works on Postgres 17, but Postgres 18 is where it gets tidy, and the reason is a genuinely useful new GUC worth knowing on its own: `extension_control_path` (and its companion `dynamic_library_path`).

Historically, every extension dumped its control file and libraries into one shared directory (`$SHAREDIR/extension` and the lib dir). Stacking many extensions there by copying layers risks files from different extensions colliding, and it makes it impossible to give any one extension its own isolated location.

Postgres 18's `extension_control_path` lets Postgres look for extensions across multiple directories, so pglayers can drop each extension into **its own namespace** and point Postgres at all of them. No collisions, clean separation, and the ability to swap one extension layer without disturbing the others. On PG 17 pglayers still works by placing files in the traditional paths; on 18-plus it uses the isolated layout.

This is a good example of an infrastructure feature (a search-path GUC) quietly unlocking a packaging pattern that was awkward before it existed.

## When to use it, and when not to

pglayers is a nice tool, not a religion. It fits some situations better than others.

**Good fit:**

- You add well-known extensions (pgvector, PostGIS, pg_cron, TimescaleDB) to the official Postgres image and are tired of the compile dance.
- You want per-extension version pinning that is visible in the Dockerfile rather than buried in build steps.
- You want lean images without a build toolchain baked in, and faster CI builds because nothing compiles.

**Think twice:**

- **Base image mismatch.** The layers are built against Debian Trixie (glibc 2.38). Your base image has to be ABI-compatible. Composing a Trixie-built `.so` onto an Alpine (musl) image will not work, and mismatched glibc versions can fail at load time. Match the base.
- **You already use a managed Postgres.** On RDS, Cloud SQL, Neon, or Supabase you do not build the image at all; you enable extensions from a supported list. pglayers is for people who run their own Postgres container.
- **An extension pglayers does not publish.** The catalog is broad (80-plus) but not infinite. A niche or in-house extension still needs the old build path.
- **Supply-chain caution.** You are now pulling extension binaries from a third-party registry instead of building from source you can inspect. For many teams that is a fine trade (you already pull the official Postgres image you did not build either), but if your threat model requires building extensions from audited source, keep compiling. Pin to digests if you adopt it.

## The takeaway

pglayers is a small idea executed well: treat a compiled Postgres extension as what it is on disk, a handful of files, and ship those files as a Docker layer instead of shipping a build. It turns a multi-line, toolchain-heavy Dockerfile into three `COPY --from` lines, and it is a clean demonstration of Postgres 18's `extension_control_path` earning its keep.

Whether or not you adopt it, the underlying lesson is portable: when a build step in your Dockerfile produces the same artifact every time, that artifact wants to be a cached layer, not a rebuild. pglayers just applied that lesson to Postgres extensions before you had to.
