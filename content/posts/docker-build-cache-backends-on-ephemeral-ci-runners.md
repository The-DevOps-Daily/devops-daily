---
title: 'Docker Build Cache on Ephemeral CI Runners: inline, registry and local, Measured'
excerpt: 'A fresh CI runner starts with no BuildKit cache. We rebuilt a real multi-stage Node service on a new builder every time, with no cache, inline, registry min and max, and a local cache directory, and measured cold builds, a one-line change, a dependency bump, the export cost and the cache size.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2026-11-02'
publishedAt: '2026-11-02T19:00:00Z'
updatedAt: '2026-11-02T19:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Docker
  - BuildKit
  - CI/CD
  - Caching
  - Docker Buildx
  - Performance
  - DevOps
---

A CI runner that starts empty has no BuildKit cache, so every `docker build` is a cold build unless you export the cache somewhere and import it on the next run. We rebuilt a real multi-stage Node service, the payment service from Google's Online Boutique demo, on a brand-new BuildKit builder every time, with five setups: no cache, `inline`, `registry` with `mode=min`, `registry` with `mode=max`, and a `local` cache directory.

For a one-line source change, every cache worked. The rebuild went from 79.0 s with no cache to 19.2 to 26.3 s with any registry-backed cache, because BuildKit skipped the whole `builder` stage, `npm install` included. For this Dockerfile, the cheapest backends were the best ones. Inline and registry `mode=min` cost 0.0 and 1.2 s to export. Inline adds only metadata to the image, and `mode=min` stored a separate 47.7 MB cache with the same layers as the image. `mode=max` stored 259.9 MB, added 29.8 s of export to every cold build, and made the dependency bump slower, not faster: the cached compiler toolchain saved no time once its layers had to be pulled, and the export added about 20 s. The local directory cache, written fresh each run, was the slowest of all for the one-line change.

## TL;DR

- **Source change: all caches skip the `builder` stage.** Median 19.2 to 26.3 s with inline or registry, against 79.0 s with no cache. In our three runs each, inline and `mode=min` did as well as `mode=max`, because BuildKit only loads the cache for the last step that matches.
- **Export cost is mostly compression.** `mode=max` spent 27.9 s in `preparing build cache for export` on a cold build, and about 2 s writing 259.9 MB to the registry. `mode=min` exported in 1.2 s, inline in 0.0 s.
- **Dependency bump: `mode=max` did not help.** It kept the compiler toolchain, but pulling and unpacking the cached base and toolchain layers took 15.0 to 20.6 s per build, about what `mode=min` spent pulling the base image and running `apk add` again (13.4 to 19.8 s). Its export then added 18.4 to 24.7 s. Median 132.4 s for `mode=max` against 110.8 s for `mode=min`.
- **Local cache, fresh directory each run:** 74.7 s for a one-line change, because it repeats the full `mode=max` export every time.
- **What did not change:** `npm install` ran on every dependency bump with every backend. A cache saves the steps before the change, never the step that changed.
- Our registry ran on the same machine, so these times leave out the network. The sizes carry over: 47.7 MB pulled per warm source build, 259.9 MB per `mode=max` cache.

## Prerequisites

- Docker with Buildx (we used Docker 29.9.2, Buildx 0.38.1 and BuildKit 0.34.1).
- A registry you can push to. We ran `registry:2.8.3` on the build machine; GHCR, ECR, Docker Hub or your own registry work the same way.
- Node.js and npm, only to create the dependency change (`npm install --package-lock-only`).
- If you want to rerun the whole matrix: a 4 vCPU Linux machine and about 80 minutes. We used a droplet on [DigitalOcean](https://m.do.co/c/2a9bba940f39) (referral link).

## Why a fresh builder changes everything

On a laptop, BuildKit keeps every layer it built in its own store, so the second `docker build` reuses them without any configuration. A CI runner that starts from a clean VM or container has no store. Unless you tell BuildKit where to import a cache from and where to export it to, every build is a cold build.

BuildKit can export its cache in several ways. `inline` writes cache metadata into the image you push. `registry` writes a separate cache manifest to a registry. `local` writes an OCI layout to a directory that your CI then saves and restores. `gha` and `s3` write to GitHub's cache service and to S3. `mode=min`, the default, exports only the layers of the final image. `mode=max` also exports the layers of every intermediate stage, such as a `builder` stage.

The question for a CI pipeline is which of those pays for itself, for the changes that you actually push.

## How we measured

**The Dockerfile.** We used `src/paymentservice` from Google's [Online Boutique](https://github.com/GoogleCloudPlatform/microservices-demo) demo at commit `c7cb6d5b`, without changes. It is a real multi-stage Node service, and both base images are pinned by digest. This is the whole Dockerfile without its license header:

```dockerfile
# Define a default value so it's not empty if the builder fails to provide it
ARG BUILDPLATFORM=linux/amd64

FROM --platform=$BUILDPLATFORM node:24.20.0-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS builder

# Some packages (e.g. @google-cloud/profiler) require additional
# deps for post-install scripts
RUN apk add --update --no-cache \
    python3 \
    make \
    g++

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=production

FROM alpine:3.24.1@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b

RUN apk add --no-cache nodejs

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules

COPY . .

EXPOSE 50051

ENTRYPOINT [ "node", "index.js" ]
```

The expensive work is in the `builder` stage: a compiler toolchain from Alpine's mirror, then `npm install`. The final stage installs Node from Alpine, copies `node_modules`, and copies the source last.

**An ephemeral runner, every time.** Each build got a new BuildKit builder (`docker buildx create --driver docker-container --bootstrap`), and we removed it after the build. Nothing survived in the builder's store between builds except what the cache backend exported. The base image mirror and the Docker host itself did persist. We recorded builder start-up separately; it is the same for every backend.

**Three scenarios:**

- **Cold:** an empty cache. The build exports its cache to the backend.
- **Source change:** one line in `server.js` (a log message). The build imports the cache that the last cold run wrote.
- **Dependency change:** `@grpc/grpc-js` from 1.14.4 to 1.14.7, made with `npm install --package-lock-only --save-exact`, the size of a typical Dependabot patch bump. The lockfile diff changes only that package (npm also re-sorted two keys in `package.json`). It imports the same cache.

Warm builds import from the cold cache and export to a separate scratch location, so every warm run starts from the same cache and still pays the export cost that a real pipeline pays.

**The backends:**

| Name          | Import                      | Export                                                 |
| ------------- | --------------------------- | ------------------------------------------------------ |
| none          | nothing                     | nothing                                                |
| inline        | `type=registry,ref=<image>` | `type=inline` (cache metadata inside the pushed image) |
| registry, min | `type=registry,ref=<cache>` | `type=registry,ref=<cache>,mode=min`                   |
| registry, max | `type=registry,ref=<cache>` | `type=registry,ref=<cache>,mode=max`                   |
| local         | `type=local,src=<dir>`      | `type=local,dest=<dir>,mode=max`                       |

Every build pushed its image with `--provenance=false --sbom=false`, so attestations do not add noise.

**Repeats.** We planned five runs of every backend and scenario. The shared droplet ran slower than planned and we had a fixed budget, so we got 5 cold runs per backend, 3 source-change runs, and 3 (2 for the local cache) for the dependency bump. Runs went in round-robin order inside each scenario (run 1 of every backend, then run 2, and so on), which spreads slow periods on the shared host across the backends but does not remove order effects (see the caveats). The tables show the median and the number of runs (with 2 runs, the median is their mean). We dropped the page cache before each build and logged the CPU counters around each one, because the droplet's vCPUs are shared and steal time moves build times.

**What we recorded.** Wall time of `docker buildx build`, BuildKit's own step timings from `--progress=plain` (which steps were `CACHED`, how long the export took), the cache size from the registry manifest or the cache directory, and the bytes BuildKit pulled from the cache registry, from the registry's access log.

**Where the cache lived.** The registry for `inline` and `type=registry` was a `registry:2.8.3` container on the same droplet, at `127.0.0.1:5000`. We did not have a container registry we could use at no cost, and DigitalOcean's Spaces object storage has a monthly minimum, so there was no remote store that cost nothing. On loopback, writing the 259.9 MB `mode=max` cache took about 2 s, so **our export and import times are close to the best case.** On a real runner the same bytes cross a network to GHCR, ECR or your own registry, and the time grows with the size. That is why the tables show bytes next to every time: the bytes carry over to your setup, our seconds do not.

**Base images.** Every fresh builder resolved `node:24.20.0-alpine` and `alpine:3.24.1`, and downloaded their layers whenever a step needed them. We pointed BuildKit at a pull-through mirror (`registry:2.8.3` with `REGISTRY_PROXY_REMOTEURL`, also on the droplet), so Docker Hub's rate limits and speed stay out of the numbers. A real ephemeral runner pulls them from Docker Hub or a mirror on every build that needs them, so add that time to the rows where the `FROM` step ran.

**Package downloads were real.** `apk add` fetched from Alpine's CDN and `npm install` fetched from the npm registry whenever those steps ran. That is the cost a cache saves, so we left it in.

**Why there is no `type=s3` or `type=gha`.** `type=s3` needs an S3 bucket. The only free option here was an S3 emulator on the same droplet, which would measure the emulator, not S3. `type=gha` works only inside GitHub Actions. We left both out.

## Cold builds and what the export costs

| Backend              | Runs | Cold build | Cache export | of which preparing | Cache size   |
| -------------------- | ---- | ---------- | ------------ | ------------------ | ------------ |
| none                 | 5    | 79.0 s     | -            | -                  | -            |
| inline               | 5    | 85.4 s     | 0.0 s        | -                  | in the image |
| registry, `mode=min` | 5    | 89.4 s     | 1.2 s        | 0.1 s              | 47.7 MB      |
| registry, `mode=max` | 5    | 128.0 s    | 29.8 s       | 27.9 s             | 259.9 MB     |
| local, `mode=max`    | 5    | 122.8 s    | 39.1 s       | 30.7 s             | 259.9 MB     |

Cold builds: median of 5 runs. Export is the `exporting cache` step in the BuildKit log; for inline, the `preparing layers for inline cache` line.

With no cache, a cold build took a median 79.0 s on a fresh builder. `npm install` was 45.3 s of that, the compiler toolchain (`apk add python3 make g++`) 6.5 s, and compressing and pushing the image about 9.5 s.

The totals in the table are noisier than the export column. `npm install` alone took between 29.2 and 70.9 s across the cold runs, because it downloads from the npm registry, and the droplet reported 8 to 27% CPU steal per build. Read the export column for what each backend costs:

- **inline** costs nothing measurable. BuildKit logged `preparing layers for inline cache 0.0s done`. The cache is metadata in the image config, and its layers are the image's own.
- **registry, `mode=min`** added 1.2 s for a 47.7 MB cache: the same 5 layers as the final image, stored under the cache tag.
- **registry, `mode=max`** added 29.8 s for 259.9 MB in 12 layers. 27.9 s of that was one line in the BuildKit log, `preparing build cache for export`: BuildKit compressing the `builder` stage's layers (the Node base image, the compiler toolchain and `node_modules`), which a `mode=min` export never touches. Writing the layers to the registry took about 2 s, on loopback.
- **local, `mode=max`** added 39.1 s for the same 259.9 MB, written as an OCI layout on disk. Preparing took 30.7 s here too.

So the expensive part of a `mode=max` export is compression, and it happens before a byte leaves the machine. On a real network, the upload of 259.9 MB comes on top.

## A one-line source change

| Backend              | Runs | Source change | Steps cached (of 8) | Pulling cached layers | `apk add` (builder) | `npm install` | Pulled from registry |
| -------------------- | ---- | ------------- | ------------------- | --------------------- | ------------------- | ------------- | -------------------- |
| none (a cold build)  | 5    | 79.0 s        | 0                   | -                     | 6.5 s               | 45.3 s        | -                    |
| inline               | 3    | 26.3 s        | 7                   | 16.9 s                | 0.0 s               | 0.0 s         | 47.7 MB              |
| registry, `mode=min` | 3    | 19.2 s        | 7                   | 12.4 s                | 0.0 s               | 0.0 s         | 47.7 MB              |
| registry, `mode=max` | 3    | 22.9 s        | 7                   | 15.7 s                | 0.0 s               | 0.0 s         | 47.7 MB              |
| local, `mode=max`    | 3    | 74.7 s        | 7                   | -                     | 0.0 s               | 0.0 s         | -                    |

The none row is the cold build. Pulling cached layers is the time BuildKit reported on the cached step that had to be unpacked; pulled from registry is from the cache registry's access log.

Every backend skipped the whole `builder` stage. BuildKit marked 7 of the 8 build steps `CACHED`, including `RUN npm install`, and only `COPY . .` ran. That was true for inline and registry `mode=min` too, although those caches do not contain a single layer of the `builder` stage.

That works because of how BuildKit finds a cache hit. A step's cache key comes from its instruction and the keys of the steps before it, and a `COPY` from the build context adds a checksum of the files it copies. In this graph, that let BuildKit match the final stage's `COPY --from=builder` step without running the `builder` stage. Its [solver documentation](https://github.com/moby/buildkit/blob/v0.34.1/docs/dev/solver.md) says it "will not require the cache to be loaded or exists for all the vertexes in the graph but will only load it for the final node that is determined to match cache". Here, that node is `COPY --from=builder`, which is a layer of the final image, and every backend exported it. The `builder` stage never ran, and none of its layers were downloaded: every registry build pulled the same 47.7 MB, the final image's layers, even from the 259.9 MB `mode=max` cache.

What a warm build still paid for was pulling and unpacking those cached layers to put `COPY . .` on top. BuildKit reports that time on the cached `COPY --from` step: a median of 12.4 to 16.9 s with the registry backends, out of 19.2 to 26.3 s for the whole build.

The local backend was the exception: 74.7 s. Importing from the directory was quick, but exporting to a fresh directory took 52.4 s, because every run wrote the full `mode=max` cache again. The registry backends exported to a new tag in the same repository, and that took 1.4 s or less, because the layers they referenced were already in the registry. We exported to a new directory on purpose, to stop the cache from growing; the section on the local cache below explains the trade.

## A dependency bump

| Backend              | Runs | Dependency bump | Steps cached (of 8) | Pulling cached layers | `apk add` (builder) | `npm install` | Pulled from registry |
| -------------------- | ---- | --------------- | ------------------- | --------------------- | ------------------- | ------------- | -------------------- |
| none (a cold build)  | 5    | 79.0 s          | 0                   | -                     | 6.5 s               | 45.3 s        | -                    |
| inline               | 3    | 105.7 s         | 2                   | 2.8 s                 | 9.1 s               | 60.0 s        | 26.0 MB              |
| registry, `mode=min` | 3    | 110.8 s         | 2                   | 2.3 s                 | 9.9 s               | 61.5 s        | 26.0 MB              |
| registry, `mode=max` | 3    | 132.4 s         | 4                   | 18.0 s                | 0.0 s               | 66.9 s        | 196.8 MB             |
| local, `mode=max`    | 2    | 132.1 s         | 4                   | -                     | 0.0 s               | 51.9 s        | -                    |

A changed lockfile invalidates `COPY package*.json` in the `builder` stage, so `npm install` ran in every build, with every backend. The backends differ only in the step before it, the compiler toolchain:

- **inline and registry `mode=min`** do not hold the `builder` stage, so BuildKit pulled the Node base image from the mirror (4.3 to 10.2 s) and ran `apk add python3 make g++` again (a median 9.9 s). Only the final stage's `RUN apk add --no-cache nodejs` and `WORKDIR` came from the cache.
- **registry `mode=max` and local** held it, and BuildKit marked the toolchain step `CACHED`. But to run `npm install` on top of it, BuildKit first had to pull and unpack the cached layers, the Node base image and the toolchain, including one layer of 112.3 MB. With the registry, that took 15.0 to 20.6 s per build, about the same as the 13.4 to 19.8 s that `mode=min` spent on the base image and `apk add`. The cache hit saved nothing.

We expected `mode=max` to win this scenario, and wrote that down before the runs. It did not.

Then the export. With `mode=max`, BuildKit also had to compress the `builder` stage's new `npm install` layer, which the image does not contain, and `preparing build cache for export` took 19.0 s, against 0.7 s for the whole `mode=min` export.

Put together, the dependency bump took a median 132.4 s with `mode=max` and 110.8 s with `mode=min`, and `mode=max` was slower in each of the three rounds. The export accounts for most of the gap: `mode=max` took 18.4 to 24.7 s to export, against under 1 s for `mode=min`, while the toolchain stage cost about the same either way. `mode=max` also pulled 196.8 MB from the cache registry per build, against 26.0 MB for `mode=min`. The local cache, also `mode=max`, took 132.1 s (2 runs). With a remote registry the gap would grow, because those 196.8 MB and the new `npm install` layer would cross the network.

```chart
{
  "type": "bar",
  "title": "Build time on a fresh builder (median)",
  "unit": " s",
  "caption": "One new BuildKit builder per build; cache registry on the same droplet (loopback). Medians; the none bars are the cold build; run counts are in the tables. s-4vcpu-8gb, 2 November 2026.",
  "rows": [
    {
      "label": "none",
      "value": 79.0,
      "series": "source change"
    },
    {
      "label": "none",
      "value": 79.0,
      "series": "dependency bump"
    },
    {
      "label": "inline",
      "value": 26.3,
      "series": "source change"
    },
    {
      "label": "inline",
      "value": 105.7,
      "series": "dependency bump"
    },
    {
      "label": "registry, mode=min",
      "value": 19.2,
      "series": "source change"
    },
    {
      "label": "registry, mode=min",
      "value": 110.8,
      "series": "dependency bump"
    },
    {
      "label": "registry, mode=max",
      "value": 22.9,
      "series": "source change"
    },
    {
      "label": "registry, mode=max",
      "value": 132.4,
      "series": "dependency bump"
    },
    {
      "label": "local, mode=max",
      "value": 74.7,
      "series": "source change"
    },
    {
      "label": "local, mode=max",
      "value": 132.1,
      "series": "dependency bump"
    }
  ],
  "series": [
    {
      "name": "source change",
      "color": "#f59e0b"
    },
    {
      "name": "dependency bump",
      "color": "#0080ff"
    }
  ]
}
```

## The local cache: an expensive export

`type=local` writes the cache as an OCI layout in a directory, and your CI saves and restores that directory between runs, for example with a cache action. In our runs the import side was cheap: reading the cache manifest took 0.1 s or less, and the cached layers came from local disk.

The export side was the most expensive of all the backends. A cold build spent 39.1 s on it, and a one-line change spent 52.4 s, because each run wrote the full `mode=max` cache into a new, empty directory. The registry backends wrote their warm cache to a new tag in a registry that already held the layers, and finished in 1.4 s or less.

We wrote to a fresh directory on purpose. When you export to the same directory you import from, BuildKit by default keeps every old blob. Docker's [GitHub Actions cache guide](https://docs.docker.com/build/ci/github-actions/cache/) puts it plainly: exporting to a directory that already holds a cache "leaves the blobs of the previous export behind, so the directory grows with every run". BuildKit 0.34.1 documents an export option for this, `reset=true`, which removes "any blobs in the cache directory that are not referenced by the current manifests in `index.json`" and is "useful for keeping the local cache directory from growing indefinitely". We planned to measure both the growth and `reset=true`, and ran out of droplet time first, so we cannot tell you how much either one changes.

## Which backend to use

For this Dockerfile, on a runner that starts empty:

- **Use inline or registry `mode=min`.** They gave the same warm builds as `mode=max` for a source change, cost 0 to 1.2 s to export, and stored no more than the image's own 47.7 MB of layers. Inline needs no extra tag at all, but it only works when you push the image, and its cache is only as old as the last image you pushed.
- **Use `mode=max` only when a `builder` step is slow to run and cheap to pull.** BuildKit pulls and unpacks a cached layer before it can build on top of it. Here the toolchain step took about 10 s to run, and pulling its cached layers with the base image took about as long as pulling the base image and running it again. A long compile that produces a small output layer is the opposite case, and that is where `mode=max` earns its export cost.
- **Price the export, not just the hit.** `mode=max` added about 30 s of compression to every cold build and 19.0 s to every dependency bump, before any upload.
- **Be careful with `type=local`.** Writing to a fresh directory each run, the older way to keep the cache small, repeats the full `mode=max` export every time: 52.4 s on a one-line change. Docker's guide now reuses the directory with `reset=true`, which needs Buildx 0.35 or later and removes blobs that the new cache no longer references. We did not get to test it.

To check your own Dockerfile, build it twice on a fresh builder with `--progress=plain` and read three lines per step: whether it says `CACHED`, how long its `DONE` takes after that (the pull), and how long `preparing build cache for export` takes. Those three numbers decide which backend wins.

## What we could not conclude

- **The cache registry was on loopback.** Our export and import times leave out the network. With a remote registry, add the transfer of 47.7 MB for a source change with any backend, and of the 259.9 MB `mode=max` cache on every cold export that writes new layers.
- **One Dockerfile.** In this one, the expensive work comes before `COPY . .`, so any cache skips it on a source change. In a Dockerfile whose expensive step comes after `COPY . .`, no backend can help with a source change. The Go frontend of the same demo is like that: its `go build` step took 66.0 to 105.8 s in each of our runs of it for the [CI memory post](/posts/how-much-memory-does-a-ci-build-need), cache or not.
- **No no-cache rerun of the changes.** With no cache, a source change or a dependency bump is a cold build, so we used the cold median (79.0 s) as the reference and did not rerun it with the changed files. The cold builds ran earlier in the session, when steal was lower (8 to 27%, against 15 to 39% for the warm builds), so if anything that reference is a little fast.
- **Fewer warm runs than planned.** Builds on the shared droplet ran slower than we planned, and we had a fixed budget. Cold builds have 5 runs per backend, source changes 3, and dependency bumps 3 (2 for the local cache). The direction of every comparison we draw held in every round; the exact medians would move with more runs.
- **Fixed order inside each round.** The backends ran in the same order in every round, so a backend's position could bias its time. The host-wide steal we logged per build does not show a pattern by position, but it rose over the session (from 8% to 39% per build). Dependency round 3 ran in the opposite order, `mode=max` first, and `mode=max` was still the slowest registry backend. We point at the step timings because they depend less on any of this.
- **The local result is about a fresh destination.** We exported each local warm build to a new, empty directory, while the registry backends exported next to layers that were already stored. That shows that a fresh local destination is expensive, not that `type=local` is slow in general, and we did not measure the cache action's save and restore of the directory.
- **Untested:** `type=gha` and `type=s3`, `RUN --mount=type=cache` cache mounts, two pipelines writing the same cache tag at once, and the `reset=true` option for local caches.

## Run it yourself

Create a 4 vCPU Ubuntu machine with Docker, copy the files below to `/root/bench/`, and run:

```bash
bash /root/bench/registries.sh
STOP_AT_UTC=2099-01-01 bash /root/bench/p2.sh prep   # contexts for the source and dependency changes
STOP_AT_UTC=2099-01-01 bash /root/bench/p2.sh cold   # 5 rounds x 5 backends
STOP_AT_UTC=2099-01-01 bash /root/bench/p2.sh warm   # 5 source rounds, then dependency rounds while time allows
python3 summarize_p2.py /root/res/p2
```

The script below is the one we ran. Our run did not use `warm` to the end: to fit the budget we stopped it after three source rounds, ran two dependency rounds with `warm2`, and a third with `dep3`, which starts with `mode=max`. `packnow` (a tar and zstd test of the local cache) and `grow` (the same directory in and out, with and without `reset=true`) are in the script too; we ran out of time before them.

Each build writes its own directory with the BuildKit log, the registry access log for that build, and the sizes, so you can check any single number.

<details>
<summary>registries.sh: cache registry, pull-through mirrors, pinned source</summary>

```bash
#!/bin/bash
# The cache registry and the two pull-through mirrors, all on the build machine.
docker pull -q moby/buildkit:v0.34.1
docker pull -q registry:2.8.3
docker run -d --name reg-cache -p 127.0.0.1:5000:5000 registry:2.8.3
docker run -d --name mirror-hub -p 127.0.0.1:5001:5000 -e REGISTRY_PROXY_REMOTEURL=https://registry-1.docker.io registry:2.8.3
docker run -d --name mirror-gcr -p 127.0.0.1:5002:5000 -e REGISTRY_PROXY_REMOTEURL=https://gcr.io registry:2.8.3
git init -q /root/src/msd
git -C /root/src/msd remote add origin https://github.com/GoogleCloudPlatform/microservices-demo
git -C /root/src/msd fetch -q --depth 1 origin c7cb6d5bfd6ea3aed768634ebbcb98cb7a523712
git -C /root/src/msd checkout -q FETCH_HEAD
```

</details>

<details>
<summary>buildkitd.toml: base image pulls go to the local mirror</summary>

```toml
[registry."docker.io"]
  mirrors = ["127.0.0.1:5001"]
[registry."gcr.io"]
  mirrors = ["127.0.0.1:5002"]
[registry."127.0.0.1:5000"]
  http = true
  insecure = true
[registry."127.0.0.1:5001"]
  http = true
  insecure = true
[registry."127.0.0.1:5002"]
  http = true
  insecure = true
```

</details>

<details>
<summary>p2.sh: one fresh builder per build, every backend and scenario</summary>

```bash
#!/bin/bash
# Post 2: BuildKit cache backends on a fresh builder per build.
# usage: p2.sh prep | smoke | cold | pack | warm | grow | warmnone
set -u
export PATH=/usr/local/bin:$PATH
B=/root/bench R=/root/res/p2 C=/root/p2
SVC=/root/src/msd/src/paymentservice
# stop starting new builds after this time, to stay inside a machine budget (our last stages used 2026-11-02T18:50:00Z)
STOP_AT=$(date -u -d "${STOP_AT_UTC:-tomorrow}" +%s)
REG=127.0.0.1:5000 BK=moby/buildkit:v0.34.1
mkdir -p $R $C/cache
log() { echo "$(date -u +%FT%TZ) $*" | tee -a $R/progress.log; }

prep() {
  rm -rf $C/ctx-*
  cp -a $SVC $C/ctx-base
  cp -a $SVC $C/ctx-src
  sed -i 's/PaymentService gRPC server started on port/PaymentService gRPC server listening on port/' $C/ctx-src/server.js
  cp -a $SVC $C/ctx-dep
  ( cd $C/ctx-dep && npm install --package-lock-only --save-exact --ignore-scripts --no-audit --no-fund @grpc/grpc-js@1.14.7 )
  for i in 1 2 3 4 5; do
    cp -a $SVC $C/ctx-grow$i
    sed -i "s/PaymentService gRPC server started on port/PaymentService gRPC server (build $i) started on port/" $C/ctx-grow$i/server.js
  done
  diff -u $SVC/server.js $C/ctx-src/server.js > $R/src-change.diff
  diff -u $SVC/package.json $C/ctx-dep/package.json > $R/dep-change.diff
  diff -u $SVC/package-lock.json $C/ctx-dep/package-lock.json >> $R/dep-change.diff
  grep -c "listening on port" $C/ctx-src/server.js
  head -60 $R/dep-change.diff
}

# build CFG SCEN RUN [CTX]
build() {
  local cfg=$1 scen=$2 r=$3 ctx=${4:-}
  local out=$R/$scen/$cfg/$r name=p2-$cfg-$scen-$r
  if [ $(date +%s) -gt $STOP_AT ]; then log "$scen $cfg $r SKIPPED (time budget)"; return; fi
  rm -rf $out; mkdir -p $out
  [ -z "$ctx" ] && case $scen in cold) ctx=$C/ctx-base ;; src) ctx=$C/ctx-src ;; dep) ctx=$C/ctx-dep ;; esac
  local img=$REG/paymentservice:$cfg-$scen from=() to=()
  case $cfg in
    none) ;;
    inline)
      to=(--cache-to type=inline)
      if [ $scen = cold ]; then img=$REG/paymentservice:inline-base
      else from=(--cache-from type=registry,ref=$REG/paymentservice:inline-base); fi ;;
    regmin|regmax)
      local m=${cfg#reg}
      if [ $scen = cold ]; then to=(--cache-to type=registry,ref=$REG/cache:$m,mode=$m)
      else from=(--cache-from type=registry,ref=$REG/cache:$m); to=(--cache-to type=registry,ref=$REG/cache:$m-scratch,mode=$m); fi ;;
    local)
      if [ $scen = cold ]; then rm -rf $C/cache/local; to=(--cache-to type=local,dest=$C/cache/local,mode=max)
      else rm -rf $C/cache/scratch; from=(--cache-from type=local,src=$C/cache/local); to=(--cache-to type=local,dest=$C/cache/scratch,mode=max); fi ;;
    grow)
      from=(--cache-from type=local,src=$C/cache/grow); to=(--cache-to type=local,dest=$C/cache/grow,mode=max) ;;
    growr)
      from=(--cache-from type=local,src=$C/cache/growr); to=(--cache-to type=local,dest=$C/cache/growr,mode=max,reset=true) ;;
  esac
  sync; echo 3 > /proc/sys/vm/drop_caches
  local t0 t1 t2 t3 rc
  t0=$(date +%s.%N)
  docker buildx create --name $name --driver docker-container --driver-opt network=host \
    --driver-opt image=$BK --buildkitd-config $B/buildkitd.toml --bootstrap > $out/create.log 2>&1
  t1=$(date +%s.%N)
  local cpu0; cpu0=$(grep '^cpu ' /proc/stat)
  docker buildx build --builder $name --progress=plain --provenance=false --sbom=false \
    --metadata-file $out/meta.json "${from[@]}" "${to[@]}" \
    --output type=image,name=$img,push=true,registry.insecure=true $ctx > $out/build.log 2>&1
  rc=$?
  t2=$(date +%s.%N)
  local cpu1; cpu1=$(grep '^cpu ' /proc/stat)
  docker buildx rm $name > /dev/null 2>&1
  t3=$(date +%s.%N)
  docker logs --since $t1 --until $t2 reg-cache > $out/registry.log 2>&1
  { echo "rc=$rc"; echo "t0=$t0"; echo "t1=$t1"; echo "t2=$t2"; echo "t3=$t3"; echo "ctx=$ctx"; echo "cpu0=$cpu0"; echo "cpu1=$cpu1"; } > $out/result.env
  case $cfg in
    local) if [ $scen = cold ]; then d=$C/cache/local; else d=$C/cache/scratch; fi
           echo "cache_bytes=$(du -sb $d | cut -f1)" >> $out/result.env
           echo "cache_blobs=$(ls $d/blobs/sha256 | wc -l)" >> $out/result.env
           [ $scen = cold ] || rm -rf $C/cache/scratch ;;
    grow|growr) echo "cache_bytes=$(du -sb $C/cache/$cfg | cut -f1)" >> $out/result.env
           echo "cache_blobs=$(ls $C/cache/$cfg/blobs/sha256 | wc -l)" >> $out/result.env ;;
  esac
  case $cfg-$scen in
    regmin-cold) python3 $B/regsize.py $REG cache min > $out/cache-size.json ;;
    regmax-cold) python3 $B/regsize.py $REG cache max > $out/cache-size.json ;;
    regmin-*) python3 $B/regsize.py $REG cache min-scratch > $out/cache-size.json ;;
    regmax-*) python3 $B/regsize.py $REG cache max-scratch > $out/cache-size.json ;;
  esac
  python3 $B/regsize.py $REG paymentservice ${img##*:} > $out/image-size.json
  log "$scen $cfg $r rc=$rc build=$(python3 -c "print(round($t2-$t1,1))")s"
}

pack_test() {
    for r in r1 r2 r3 r4 r5; do
      sync; echo 3 > /proc/sys/vm/drop_caches
      t0=$(date +%s.%N); tar -C $C/cache/local -cf - . | zstd -T0 -q -f -o $C/local.tar.zst; sync; t1=$(date +%s.%N)
      rm -rf $C/unpack; mkdir -p $C/unpack; sync; echo 3 > /proc/sys/vm/drop_caches
      t2=$(date +%s.%N); zstd -dc -q $C/local.tar.zst | tar -C $C/unpack -xf -; sync; t3=$(date +%s.%N)
      echo "$r pack_s=$(python3 -c "print(round($t1-$t0,2))") unpack_s=$(python3 -c "print(round($t3-$t2,2))") dir_bytes=$(du -sb $C/cache/local | cut -f1) tar_zst_bytes=$(stat -c %s $C/local.tar.zst)" | tee -a $R/pack.txt
    done
    rm -rf $C/unpack $C/local.tar.zst; log PACK-DONE
}

case ${1:-} in
  prep) prep ;;
  smoke) for c in none inline regmin regmax local; do build $c cold s0; done; log SMOKE-DONE ;;
  cold) for r in r1 r2 r3 r4 r5; do for c in none inline regmin regmax local; do build $c cold $r; done; done; log COLD-DONE ;;
  warm) # all source-change rounds first, then whole dependency rounds while they fit before STOP_AT
    for r in r1 r2 r3 r4 r5; do for c in inline regmin regmax local; do build $c src $r; done; done
    last=400
    for r in r1 r2 r3 r4 r5; do
      t=$(date +%s)
      if [ $((t + last)) -gt $STOP_AT ]; then log "dep $r and later skipped: a round needs about ${last}s"; break; fi
      for c in inline regmin regmax local; do build $c dep $r; done
      last=$(( $(date +%s) - t ))
    done
    log WARM-DONE ;;
  warm2) # switched to after source round 3: dependency rounds first, then the last source rounds, while they fit
    last=400
    for r in r1 r2 r3 r4 r5; do
      t=$(date +%s)
      if [ $((t + last)) -gt $STOP_AT ]; then log "dep $r and later skipped: a round needs about ${last}s"; break; fi
      for c in inline regmin regmax local; do build $c dep $r; done
      last=$(( $(date +%s) - t ))
      [ $r = r3 ] && break
    done
    for r in r4 r5; do
      t=$(date +%s)
      if [ $((t + 150)) -gt $STOP_AT ]; then log "src $r skipped: time budget"; break; fi
      for c in inline regmin regmax local; do build $c src $r; done
    done
    log WARM-DONE ;;
  dep3) # third dependency round, started after round 2 (time budget)
    for c in regmax regmin inline local; do build $c dep r3; done
    log WARM-DONE ;;
  packnow) pack_test ;;
  warmnone) for r in r1 r2 r3 r4 r5; do for s in src dep; do build none $s $r; done; done; log WARMNONE-DONE ;;
  pack) log "pack deferred until after the warm builds" ;;
  grow) # local cache pack/unpack test, then the same-directory growth test, without and with reset=true
    if [ $(date +%s) -lt $((STOP_AT + 120)) ]; then pack_test; fi
    rm -rf $C/cache/grow $C/cache/growr; cp -a $C/cache/local $C/cache/grow; cp -a $C/cache/local $C/cache/growr
    echo "start cache_bytes=$(du -sb $C/cache/grow | cut -f1) blobs=$(ls $C/cache/grow/blobs/sha256 | wc -l)" > $R/grow-start.txt
    for i in 1 2 3 4 5; do build grow src g$i $C/ctx-grow$i; build growr src g$i $C/ctx-grow$i; done; log GROW-DONE ;;
  *) echo "usage"; exit 2 ;;
esac
```

</details>

<details>
<summary>regsize.py: compressed bytes behind a registry tag</summary>

```python
#!/usr/bin/env python3
"""Sum the compressed layer bytes behind a registry tag (image or BuildKit cache)."""
import json, sys, urllib.request

reg, repo, tag = sys.argv[1:4]
ACCEPT = ", ".join([
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.docker.distribution.manifest.v2+json",
])

def get(ref):
    req = urllib.request.Request(f"http://{reg}/v2/{repo}/manifests/{ref}", headers={"Accept": ACCEPT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def walk(m, layers):
    for d in m.get("manifests", []):
        mt = d.get("mediaType", "")
        if "manifest" in mt or "index" in mt:
            walk(get(d["digest"]), layers)
        elif "layer" in mt:
            layers[d["digest"]] = d["size"]
    for d in m.get("layers", []):
        layers[d["digest"]] = d["size"]

try:
    top = get(tag)
except Exception as e:
    print(json.dumps({"error": str(e)})); sys.exit(0)
layers = {}
walk(top, layers)
print(json.dumps({"tag": f"{repo}:{tag}", "mediaType": top.get("mediaType"), "layers": len(layers), "bytes": sum(layers.values()), "sizes": sorted(layers.values(), reverse=True)}))
```

</details>

<details>
<summary>summarize_p2.py: parse BuildKit logs, registry logs and sizes into medians</summary>

```python
#!/usr/bin/env python3
"""Summarize post 2 runs: parse BuildKit plain progress, registry logs and sizes; medians per cell."""
import json, os, re, statistics, sys

root = sys.argv[1]
VERTEX = re.compile(r"^#(\d+) (.*)$")
DONE = re.compile(r"^DONE ([\d.]+)s$")
SUBDONE = re.compile(r"^(preparing layers for inline cache|preparing build cache for export|exporting layers|pushing layers|exporting manifest list|exporting config).*?([\d.]+)s done$")

def env(path):
    d = {}
    if os.path.exists(path):
        for line in open(path):
            if "=" in line:
                k, v = line.strip().split("=", 1)
                d[k] = v
    return d

def parse_build(path):
    v = {}
    order = []
    for line in open(path, errors="replace"):
        line = line.rstrip("\n")
        m = VERTEX.match(line)
        if not m:
            continue
        vid, rest = int(m.group(1)), m.group(2)
        if vid not in v:
            v[vid] = {"name": rest, "done": None, "cached": False, "error": False, "sub": {}}
            order.append(vid)
            continue
        if rest == "CACHED":
            v[vid]["cached"] = True
        elif rest.startswith("ERROR"):
            v[vid]["error"] = True
        else:
            d = DONE.match(rest)
            if d:
                v[vid]["done"] = float(d.group(1))
            s = SUBDONE.match(rest)
            if s:
                v[vid]["sub"][s.group(1)] = v[vid]["sub"].get(s.group(1), 0) + float(s.group(2))
    return [v[i] for i in order]

def registry_bytes(path):
    got = put = 0
    seen_logrus = False
    lines = open(path, errors="replace").read().splitlines() if os.path.exists(path) else []
    for line in lines:
        if 'msg="response completed"' in line:
            seen_logrus = True
            meth = re.search(r"http\.request\.method=(\w+)", line)
            uri = re.search(r'http\.request\.uri="([^"]+)"', line)
            w = re.search(r"http\.response\.written=(\d+)", line)
            if meth and uri and w and meth.group(1) == "GET" and "/blobs/" in uri.group(1):
                got += int(w.group(1))
    if not seen_logrus:
        for line in lines:
            m = re.search(r'"GET (/v2/[^ ]*/blobs/[^ ]*) HTTP/[\d.]+" (\d+) (\d+)', line)
            if m and m.group(2) == "200":
                got += int(m.group(3))
    return got

def step_time(vs, pattern):
    for x in vs:
        if re.search(pattern, x["name"]):
            return 0.0 if x["cached"] else x["done"]
    return None

def run(d):
    r = env(os.path.join(d, "result.env"))
    if not r:
        return None
    vs = parse_build(os.path.join(d, "build.log"))
    steps = [x for x in vs if re.match(r"^\[(builder|stage-\d+) \d+/\d+\]", x["name"])]
    exp = [x for x in vs if x["name"].startswith("exporting cache to")]
    img = [x for x in vs if x["name"] == "exporting to image"]
    imp = [x for x in vs if x["name"].startswith("importing cache manifest")]
    info = {
        "rc": int(r["rc"]),
        "bootstrap_s": round(float(r["t1"]) - float(r["t0"]), 2),
        "build_s": round(float(r["t2"]) - float(r["t1"]), 2),
        "steps": len(steps), "cached_steps": sum(1 for x in steps if x["cached"]),
        "cached_names": [x["name"] for x in steps if x["cached"]],
        "apk_builder_s": step_time(vs, r"RUN apk add --update"),
        "npm_install_s": step_time(vs, r"RUN npm install"),
        "apk_final_s": step_time(vs, r"RUN apk add --no-cache nodejs"),
        "copy_modules_s": step_time(vs, r"COPY --from=builder"),
        "export_cache_s": sum(x["done"] or 0 for x in exp) if exp else None,
        "export_image_s": img[0]["done"] if img else None,
        "inline_prep_s": img[0]["sub"].get("preparing layers for inline cache") if img else None,
        "prep_export_s": sum(x["sub"].get("preparing build cache for export", 0) for x in exp) if exp else None,
        "import_manifest_s": sum(x["done"] or 0 for x in imp) if imp else None,
        "pulled_from_cache_registry_bytes": registry_bytes(os.path.join(d, "registry.log")),
        "errors": [x["name"] for x in vs if x["error"]],
        # a CACHED step still reports DONE time when its layers must be pulled and unpacked for a later step
        "cached_pull_s": max([x["done"] or 0 for x in steps if x["cached"]] or [0]),
    }
    if "cpu0" in r and "cpu1" in r:
        a = [int(x) for x in r["cpu0"].split()[1:9]]
        b = [int(x) for x in r["cpu1"].split()[1:9]]
        dd = [y - x for x, y in zip(a, b)]
        info["steal_pct"] = round(100 * dd[7] / sum(dd), 1) if sum(dd) else None
    if "cache_bytes" in r:
        info["cache_bytes"] = int(r["cache_bytes"])
        info["cache_blobs"] = int(r["cache_blobs"])
    for f in ("cache-size.json", "image-size.json"):
        p = os.path.join(d, f)
        if os.path.exists(p):
            try:
                j = json.load(open(p))
                info[f.split(".")[0].replace("-", "_") + "_bytes"] = j.get("bytes")
                info[f.split(".")[0].replace("-", "_") + "_layers"] = j.get("layers")
            except Exception:
                pass
    return info

def med(xs):
    xs = [x for x in xs if x is not None]
    return round(statistics.median(xs), 2) if xs else None

out = {}
for scen in ("cold", "src", "dep"):
    for cfg in ("none", "inline", "regmin", "regmax", "local", "grow", "growr"):
        d0 = os.path.join(root, scen, cfg)
        if not os.path.isdir(d0):
            continue
        runs = {rn: run(os.path.join(d0, rn)) for rn in sorted(os.listdir(d0))}
        runs = {k: v for k, v in runs.items() if v}
        meas = [v for k, v in runs.items() if k.startswith("r")]
        keys = ["build_s", "bootstrap_s", "cached_steps", "apk_builder_s", "npm_install_s", "apk_final_s", "copy_modules_s", "export_cache_s", "export_image_s",
                "inline_prep_s", "prep_export_s", "import_manifest_s", "cached_pull_s", "pulled_from_cache_registry_bytes", "steal_pct", "cache_bytes", "cache_size_bytes", "image_size_bytes"]
        cell = {"n": len(meas), "rcs": [x["rc"] for x in meas]}
        for k in keys:
            cell[k] = med([x.get(k) for x in meas])
            vals = [x.get(k) for x in meas if x.get(k) is not None]
            if vals and k in ("build_s", "export_cache_s", "import_manifest_s"):
                cell[k + "_range"] = [min(vals), max(vals)]
        cell["runs"] = runs
        out[f"{scen}/{cfg}"] = cell
json.dump(out, open(os.path.join(root, "summary.json"), "w"), indent=1)
MB = 1e6
print(f"{'cell':14} {'n':>2} {'build':>7} {'range':>14} {'cached':>6} {'apkB':>6} {'npm':>6} {'expC':>6} {'expI':>6} {'impM':>5} {'pullMB':>7} {'cacheMB':>8} {'imgMB':>6}")
for k, c in out.items():
    cb = c.get("cache_size_bytes") or c.get("cache_bytes")
    print(f"{k:14} {c['n']:>2} {str(c['build_s']):>7} {str(c.get('build_s_range')):>14} {str(c['cached_steps']):>6} {str(c['apk_builder_s']):>6} {str(c['npm_install_s']):>6} {str(c['export_cache_s']):>6} {str(c['export_image_s']):>6} {str(c['import_manifest_s']):>5} {round((c['pulled_from_cache_registry_bytes'] or 0)/MB,1):>7} {round(cb/MB,1) if cb else '-':>8} {round(c['image_size_bytes']/MB,1) if c['image_size_bytes'] else '-':>6} rcs={c['rcs']}")
```

</details>

## Summary

A fresh CI runner has no BuildKit cache, so the backend you pick decides what gets reused. For this multi-stage Node service, the cheapest backends did the most: inline and registry `mode=min` cut a one-line rebuild from 79.0 s to about 20 s and cost almost nothing to export, because BuildKit could skip the whole `builder` stage by matching cache keys alone. `mode=max` stored five times as much, added about 30 s of compression to every cold build, and did not make the dependency bump faster: pulling the cached toolchain took as long as installing it, and the export came on top. Before you switch on `mode=max` because a guide says so, read `--progress=plain` for your own build and compare the pull time of each cached step with the time it takes to run.
