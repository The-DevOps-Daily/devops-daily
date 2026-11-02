---
title: 'How Much Memory Does a CI Build Need? Five Real Builds at 2, 4 and 8 GB'
excerpt: 'We ran five real open-source builds inside 2, 4 and 8 GB memory limits. Four fit in 2 GB. The cgroup counter overstated most of them, and the one that failed was a Vite build that also runs a full type check. Every script is in the post.'
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2026-11-02'
publishedAt: '2026-11-02T18:00:00Z'
updatedAt: '2026-11-02T18:00:00Z'
readingTime: '17 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - CI/CD
  - Memory
  - cgroups
  - Docker
  - Gradle
  - Node.js
  - Go
  - DevOps
---

We ran five real open-source builds (a Vite app build, a TypeScript type check, a Gradle build, a Go build and a Docker image build) inside 2, 4 and 8 GB memory limits on one 4 vCPU machine, with Gradle both with and without its daemon, two or three times at each limit. Four of the five finished inside 2 GB. The one that did not was the Excalidraw web app: its Vite production build also runs a full TypeScript check, together they held 3,248 MiB of anonymous memory, and the kernel killed the build at 2 GB in all 3 runs.

The number that most tools show you was the wrong one for the other four. cgroup v2's `memory.peak` said the GitHub CLI's Go build peaked at 1,775 MiB, but only 424 MiB of that was anonymous memory, the heaps and stacks of its processes. Most of the rest was page cache, which the kernel drops when it needs the room, plus some kernel memory. A Docker image build looked like 2,072 MiB for the same reason. And a TypeScript type check that held 1,139 MiB with the whole machine available finished inside 2 GB with 970 MiB, because Node sizes its heap limit from the cgroup limit it finds.

This post shows the numbers, the five traps behind them, and every script we used, so you can size a runner from your own builds instead of from a guess.

## TL;DR

- **Four of five builds fit in 2 GB.** Only the Excalidraw Vite build needed more: 3,248 MiB of anonymous memory, killed at 2 GB, fine at 4 GB.
- **`memory.peak` counts page cache.** The Go build and the Docker build showed 1,775 and 2,072 MiB, but their anonymous memory peaked at 424 and 355 MiB. Size from anonymous memory plus a margin, then confirm by running the build inside that limit.
- **Runtimes size their heaps from the cgroup limit.** Inside 2 GB, Node's default heap limit was 1,120 MiB and the JVM's default maximum heap was 512 MiB. The type check used less memory at 2 GB than at 8 GB and still finished, about 24% slower.
- **The Gradle daemon keeps its memory after the build.** Five seconds after `gradlew` exited, the daemon still held 1,048 MiB of anonymous memory. With `--no-daemon`, that dropped to under 1 MiB, and in our one-command runs the daemon gave no repeatable speed-up.
- **Limiting the `docker` CLI did not limit the build.** The CLI's cgroup peaked at 40 MiB while the BuildKit container that did the work peaked at 2,072 MiB.
- Wall times on a shared-CPU droplet are noisy: the CPUs reported 23.5% steal time across the runs we tracked. Trust the memory columns more than the time columns.

## Prerequisites

- A Linux machine with cgroup v2 and systemd (any recent Ubuntu, Debian or Fedora). Check with `stat -fc %T /sys/fs/cgroup`, which prints `cgroup2fs`.
- Root access, for `systemd-run --scope` and for dropping the page cache.
- The toolchains for the builds you want to test. Our setup script installs Go, Node, Yarn, a JDK, Rust and Docker.
- If you want to rerun our matrix as it is: a 4 vCPU, 8 GB machine and about two hours. We used a droplet on [DigitalOcean](https://m.do.co/c/2a9bba940f39) (referral link).

## How we measured

We used one DigitalOcean droplet, size `s-4vcpu-8gb` in `fra1`, with Ubuntu 24.04 and kernel 6.8. The kernel reports 7,941 MiB of memory and there is no swap. Every build ran in its own transient systemd scope:

```bash
systemd-run --scope --slice=bench.slice --unit=p1-<build>-<limit>-<run> \
  -p MemoryMax=2G -p MemorySwapMax=0 -p AllowedCPUs=0-3 -p OOMPolicy=continue \
  /root/bench/wrap.sh <outdir> <timeout> <build command>
```

These are **cgroup limits on one droplet, not three real machine sizes.** A real 2 GB runner has a smaller kernel footprint, a runner agent and often a Docker daemon in the same memory, so it has less room than our 2 GB scope. The 8 GB limit is above the 7.9 GiB that the droplet has, so the 8 GB column means "the whole machine".

The rest of the setup:

- **CPU.** Every scope was pinned to the same 4 vCPUs with `AllowedCPUs=0-3`, and `nproc` printed 4 inside each one. Compilers start about one job per CPU, so a 2 vCPU runner would use less memory and an 8 vCPU runner more. We did not measure other CPU counts.
- **Cold build, warm dependencies.** We downloaded dependencies once before the runs: `yarn install`, `go mod download`, `cargo fetch`, the Gradle distribution and dependencies, and the base images for the Docker build. Before every run we deleted the build output and the compiler caches (`excalidraw-app/build`, `GOCACHE`, `target/`, Gradle's `build/` and `.gradle/`), stopped any Gradle daemon, and dropped the page cache. That is a CI job that restores a dependency cache but not a build cache.
- **What we recorded.** Wall time, the exit code, `memory.peak` at the end of the run, `memory.events` (how often the limit was hit, and OOM kills), and a sampler that read `memory.stat` every 100 ms for anonymous memory (`anon`) and page cache (`file`).
- **Repeats.** Runs went in round-robin order: run 1 of every cell, then run 2, then run 3, so a slow period on the shared host does not land on one build. Builds ran slower than we planned, so to stay inside our droplet budget the third round covered only the 8 GB and 2 GB limits. That gives **3 runs per cell at 8 GB and 2 GB, and 2 at 4 GB.** The tables show the median of 3, or the mean of 2 at 4 GB. Each build also had one warm-up run at 8 GB that we did not count; it downloaded Gradle and filled the image mirror.

The builds, all pinned to exact commits:

| Build                                           | Command                                      | Source                                            |
| ----------------------------------------------- | -------------------------------------------- | ------------------------------------------------- |
| Excalidraw app, Vite production build           | `yarn build:app:docker`                      | excalidraw/excalidraw `8bcdca45`                  |
| Excalidraw type check, 1,508 files              | `tsc -p tsconfig.json` (`noEmit` is set)     | same checkout                                     |
| PlantUML, Gradle 9.3.1 on JDK 21                | `./gradlew jar`, daemon on and `--no-daemon` | plantuml/plantuml `db06d70e`                      |
| GitHub CLI, Go 1.27.3                           | `go build ./cmd/gh`                          | cli/cli `9490d204`                                |
| Online Boutique frontend image, BuildKit 0.34.1 | `docker buildx build`                        | GoogleCloudPlatform/microservices-demo `c7cb6d5b` |
| ripgrep 15.2.0, Rust 1.99.1 (one run)           | `cargo build --release --locked`             | BurntSushi/ripgrep tag `15.2.0`                   |

Node was 24.22.2 with Yarn 1.22.22, Docker was 29.9.2 with Buildx 0.38.1.

## The results

| Build                                           | Anonymous peak at 8 GB | `memory.peak` at 8 GB | 8 GB      | 4 GB      | 2 GB                                          |
| ----------------------------------------------- | ---------------------- | --------------------- | --------- | --------- | --------------------------------------------- |
| Excalidraw `vite build`                         | 3,248 MiB              | 3,578 MiB             | ok, 66 s  | ok, 83 s  | 3 of 3 OOM-killed (run 1 from the kernel log) |
| Excalidraw `tsc` type check                     | 1,139 MiB              | 1,271 MiB             | ok, 59 s  | ok, 62 s  | ok, 73 s                                      |
| PlantUML Gradle, daemon                         | 1,143 MiB              | 1,474 MiB             | ok, 124 s | ok, 110 s | ok, 113 s                                     |
| PlantUML Gradle, `--no-daemon`                  | 1,144 MiB              | 1,475 MiB             | ok, 88 s  | ok, 119 s | ok, 100 s                                     |
| GitHub CLI `go build`                           | 424 MiB                | 1,775 MiB             | ok, 141 s | ok, 198 s | ok, 169 s                                     |
| Online Boutique frontend, `docker buildx build` | 355 MiB                | 2,072 MiB             | ok, 131 s | ok, 129 s | ok, 110 s                                     |

Times are medians of 3 runs at 8 GB and 2 GB, and the mean of 2 runs at 4 GB. Memory columns are from the 8 GB runs.

```chart
{
  "type": "bar",
  "title": "What the cgroup counter says vs what the build held (8 GB limit, median of 3)",
  "unit": " MiB",
  "caption": "memory.peak includes page cache; anonymous memory is the sampled peak of anon in memory.stat (100 ms). One s-4vcpu-8gb droplet, 4 vCPUs, 2 November 2026.",
  "rows": [
    {
      "label": "Vite build",
      "value": 3578,
      "series": "memory.peak"
    },
    {
      "label": "Vite build",
      "value": 3248,
      "series": "anonymous memory"
    },
    {
      "label": "tsc check",
      "value": 1271,
      "series": "memory.peak"
    },
    {
      "label": "tsc check",
      "value": 1139,
      "series": "anonymous memory"
    },
    {
      "label": "Gradle (daemon)",
      "value": 1474,
      "series": "memory.peak"
    },
    {
      "label": "Gradle (daemon)",
      "value": 1143,
      "series": "anonymous memory"
    },
    {
      "label": "Gradle (no daemon)",
      "value": 1475,
      "series": "memory.peak"
    },
    {
      "label": "Gradle (no daemon)",
      "value": 1144,
      "series": "anonymous memory"
    },
    {
      "label": "Go build",
      "value": 1775,
      "series": "memory.peak"
    },
    {
      "label": "Go build",
      "value": 424,
      "series": "anonymous memory"
    },
    {
      "label": "Docker build",
      "value": 2072,
      "series": "memory.peak"
    },
    {
      "label": "Docker build",
      "value": 355,
      "series": "anonymous memory"
    }
  ],
  "series": [
    {
      "name": "memory.peak",
      "color": "#94a3b8"
    },
    {
      "name": "anonymous memory",
      "color": "#f59e0b"
    }
  ]
}
```

Three things stand out. Only one build reached the 2 GB limit at all. The `max` counter in `memory.events`, which counts how often a cgroup's usage was about to go over its limit, stayed at 0 for every other run. Memory use at 4 GB and at 8 GB was almost the same for every build, so the extra 4 GB bought nothing. And the gap between `memory.peak` and anonymous memory is large for exactly the builds that read and write many files: the Go compiler and BuildKit.

The single Rust build, ripgrep 15.2.0 with `cargo build --release`, fits the same pattern: 896 MiB `memory.peak`, 572 MiB anonymous, 61.1 s. We ran it once at 8 GB only, because the full matrix did not fit our time budget.

## Trap 1: `memory.peak` counts page cache

`memory.peak` is the highest value of `memory.current` that the cgroup reached. `memory.current` charges the cgroup for everything it caused to be in memory, and that includes **page cache**: the source files the compiler read, the object files it wrote, the layers BuildKit unpacked. Page cache is reclaimable. When the cgroup gets close to its limit, the kernel drops clean cache pages and writes back dirty ones before it ever considers killing a process.

**Anonymous memory** is the part that cannot go anywhere without swap: heaps, stacks, the compiler's working data. `memory.stat` reports it as `anon`. That, plus a smaller amount of kernel memory (37 to 136 MiB in these builds), is what has to fit. Our sampler read it every 100 ms, so it can miss a shorter spike. `memory.peak` and the `max` counter cannot miss one, and they show that no build except Vite at 2 GB ever reached its limit. The safe test is still the one we ran: the build inside the limit you plan to buy.

The Go build of the GitHub CLI shows the difference well. Its peak was 1,775 MiB. Anonymous memory never went over 424 MiB; about 1,400 MiB was page cache from the module sources and the build cache that `go build` writes. At the 2 GB limit, the same build finished with the same peak, because 1,775 MiB is still under 2,048 MiB. With a smaller limit the kernel may reclaim that cache instead of failing the build, but we did not test below 2 GB, so test the lower limit before you rely on it.

So if a dashboard shows that your CI job "peaked at 1.8 GB", that does not mean a 2 GB runner is too small. Look at `anon` in `memory.stat` (or RSS in your container metrics), and then add a margin for the runner itself.

## Trap 2: a production build that is also a type check

The Excalidraw build needed far more memory than anything else: 3,248 MiB of anonymous memory, against 1,139 MiB for a full type check of the same code. The reason is in its [Vite config](https://github.com/excalidraw/excalidraw/blob/8bcdca4526867433f99fdfcb55a063668db0c9dc/excalidraw-app/vite.config.mts):

```ts
checker({
  typescript: true,
  eslint:
    envVars.VITE_APP_ENABLE_ESLINT === "false"
      ? undefined
      : { lintCommand: 'eslint "./**/*.{js,ts,tsx}"' },
  // ...
}),
```

`vite-plugin-checker` runs the TypeScript checker during `vite build` too: in version 0.7.2, which Excalidraw pins, `enableBuild` defaults to `true`. The production `.env` turns ESLint off but leaves the type check on, and the build also writes source maps. So one `vite build` is Rollup, source maps and a full `tsc` run at the same time.

At 2 GB the kernel killed it in all 3 runs, 69 to 122 seconds in, after the log said `✓ 1442 modules transformed.` The kernel log names the cgroup and the process it chose:

```text
oom-kill:constraint=CONSTRAINT_MEMCG,nodemask=(null),cpuset=p1-vite-2G-r2.scope,mems_allowed=0,oom_memcg=/bench.slice/p1-vite-2G-r2.scope,task_memcg=/bench.slice/p1-vite-2G-r2.scope,task=MainThread,pid=77242,uid=0
Memory cgroup out of memory: Killed process 77242 (MainThread) total-vm:11451308kB, anon-rss:1138988kB, file-rss:4864kB, shmem-rss:0kB, UID:0 pgtables:29992kB oom_score_adj:0
```

Our wrapper's record of that run shows the kill. `memory.events` counted 39,825 times that the cgroup was about to go over its limit, and one OOM kill:

```terminal
{
  "title": "vite build, 2 GB limit, run 2",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cat /root/res/p1/vite/2G/r2/result.env",
      "output": "rc=1\nt0=1793637034.083018067\nt1=1793637156.285208072\npeak=2147483648\ncurrent_after=867889152\nanon_after=801075200\nfile_after=38674432"
    },
    {
      "cmd": "cat /root/res/p1/vite/2G/r2/memory.events",
      "output": "low 0\nhigh 0\nmax 39825\noom 1\noom_kill 1\noom_group_kill 0"
    }
  ]
}
```

The process list right after the kill shows the second half of the build. The checker runs `tsc` as its own child process, and it was still running after Vite had died:

```text
  77265  1808 /bin/sh -c tsc --noEmit
  77266 799108 node /root/src/excalidraw/node_modules/.bin/tsc --noEmit
```

That `tsc` held 799,108 KiB (780 MiB) of resident memory under the 2 GB limit. Yarn reported `Command failed with exit code 1`, but the type check kept going until our harness stopped the scope. On a real runner it would keep using memory and CPU until the job ends.

We did not split the 3,248 MiB peak at 8 GB between Rollup and the checker, so we cannot say exactly how much the type check adds. What we can say: if your bundler runs a checker, your build step needs the memory of both, and moving the type check to its own CI job is the first thing to try before you buy a bigger runner.

## Trap 3: runtimes size their heaps from the limit

Node and the JVM both read the cgroup limit when they start and size their default heap from it. Our harness asks each runtime what it would use inside each limit:

```terminal
{
  "title": "probe inside a 2 GB scope",
  "prompt": "$",
  "steps": [
    {
      "comment": "what Node 24 and JDK 21 pick inside MemoryMax=2G (from p1.sh probe)"
    },
    {
      "cmd": "cat /root/res/p1/probe-2G.txt",
      "output": "nproc=4\nmemory.max=2147483648\nnode_heap_size_limit=1174405120\n      int ActiveProcessorCount                     = -1                                        {product} {default}\n   size_t MaxHeapSize                              = 536870912                                 {product} {ergonomic}\n   double MaxRAMPercentage                         = 25.000000                                 {product} {default}"
    }
  ]
}
```

All four places side by side:

| Inside                  | Node 24 `heap_size_limit` | JDK 21 default `MaxHeapSize` |
| ----------------------- | ------------------------- | ---------------------------- |
| 2 GB scope              | 1,120 MiB                 | 512 MiB                      |
| 4 GB scope              | 2,240 MiB                 | 1,024 MiB                    |
| 8 GB scope              | 2,240 MiB                 | 2,048 MiB                    |
| whole droplet, no scope | 2,240 MiB                 | 1,986 MiB                    |

Two consequences showed up in the runs.

**Heap use follows the limit.** `tsc --extendedDiagnostics` prints `Memory used`, which is Node's `heapUsed` at the end of the run, in units of 1,000 bytes. With the whole machine, the type check of 1,508 files reported `Memory used: 1018378K` (median of 3, about 971 MiB). Inside 2 GB it reported 886903K (about 846 MiB), anonymous memory fell from 1,139 to 970 MiB, and the check finished about 24% slower (median 72.7 s against 58.8 s). The 2 GB run was 9.5 to 14.2 seconds slower in each of the three rounds. In rounds 2 and 3, where we logged the CPU counters, its steal time was only 4 to 7 points higher, so steal explains only part of the gap. More frequent garbage collection under the smaller heap limit would explain the rest, but we did not record GC activity, so that is a hypothesis. A big heap number at a high limit says little about what the program needs. We expected this check to fail at 2 GB with a heap error, and it did not.

**Node stopped at 2,240 MiB even with more memory.** On our 8 GB machine, Node's default heap limit was 2,240 MiB with a 4 GB scope, an 8 GB scope and no scope at all. We did not test a bigger machine, so check what your runner gives you with `node -e 'console.log(require("v8").getHeapStatistics().heap_size_limit)'`. If a build reports `JavaScript heap out of memory`, that is Node's own limit, not the kernel's. Set `NODE_OPTIONS=--max-old-space-size=<MiB>` explicitly instead of only buying more memory.

The JVM takes 25% of the limit by default (`MaxRAMPercentage=25`), so a Maven build or a test JVM without `-Xmx` gets 512 MiB inside 2 GB. Gradle sets its own daemon heap, which brings us to the next trap.

## Trap 4: the Gradle daemon outlives the build

PlantUML's `gradle.properties` sets `org.gradle.jvmargs=-Xmx1g`. That cap kept the build inside 2 GB: anonymous memory peaked at about 1,143 MiB with the daemon and 1,144 MiB without it, and neither came near the limit.

The difference is what happens after `gradlew` exits. With the daemon, which is the default, the JVM stays alive and keeps its heap. Five seconds after the build, the scope still held 1,378 MiB, 1,048 MiB of it anonymous, in one process:

```text
37292 1105976 /usr/lib/jvm/java-21-openjdk-amd64/bin/java --add-opens=java.base/java.lang=ALL-UNNAMED ...
```

With `--no-daemon`, Gradle printed `To honour the JVM settings for this build a single-use Daemon process will be forked` and `Daemon will be stopped at the end of the build`, and five seconds after exit the anonymous memory in the scope was under 1 MiB.

```chart
{
  "type": "line",
  "title": "Anonymous memory around the end of the Gradle build (8 GB limit, run 1)",
  "unit": " MiB",
  "caption": "Max of 100 ms samples in each 5 s bin, labelled by the end of the bin; 0 s is the moment gradlew exits, +5 s is the 5 s after. One run each, PlantUML jar task, JDK 21, Gradle 9.3.1.",
  "x": [
    "-55 s",
    "-50 s",
    "-45 s",
    "-40 s",
    "-35 s",
    "-30 s",
    "-25 s",
    "-20 s",
    "-15 s",
    "-10 s",
    "-5 s",
    "0 s",
    "+5 s"
  ],
  "series": [
    {
      "name": "daemon (default)",
      "data": [
        637,
        857,
        927,
        982,
        1053,
        1059,
        1066,
        1073,
        1082,
        1110,
        1115,
        1143,
        1054
      ],
      "color": "#f59e0b"
    },
    {
      "name": "--no-daemon",
      "data": [
        476,
        516,
        559,
        807,
        921,
        970,
        1067,
        1072,
        1080,
        1084,
        1112,
        1144,
        0
      ],
      "color": "#0080ff"
    }
  ]
}
```

On a CI runner, that leftover daemon sits in the same memory as every later step of the job: the Docker build, the integration tests, the upload. At 8 GB the median time was 123.5 s with the daemon and 87.5 s without (112.7 s and 99.7 s at 2 GB), The ranges overlap and CPU steal was high, so we see no repeatable speed-up from the daemon for one Gradle command per job. The daemon is built to pay off across several Gradle commands in the same job, which we did not test. If a job runs one Gradle command, use `--no-daemon` (or `org.gradle.daemon=false`). If it runs several, consider keeping the daemon (we did not test that case), and run `./gradlew --stop` before the steps that need the memory.

## Trap 5: a limit on the `docker` CLI does not limit the build

`docker build` is a client. In our setup the work ran in a BuildKit container (Buildx's `docker-container` driver), which has its own cgroup. Other drivers and CI executors lay out cgroups differently, but the CLI is only a client in all of them. We wrapped the `docker buildx build` command in the same kind of scope as everything else, and at every limit that scope peaked at 39 to 42 MiB: the CLI, streaming logs.

To measure the build, we put the limit on the BuildKit container itself:

```bash
docker buildx create --name p1d8gr1 --driver docker-container \
  --driver-opt network=host --driver-opt image=moby/buildkit:v0.34.1 \
  --driver-opt memory=8g --driver-opt memory-swap=8g --driver-opt cpuset-cpus=0-3 \
  --buildkitd-config buildkitd.toml --bootstrap
```

and read `memory.peak` from `/sys/fs/cgroup/system.slice/docker-<container id>.scope`. That container peaked at 2,072 MiB, of which only 355 MiB was anonymous: the Go compiler inside the build. Most of the rest was page cache from the image layers and the build's output, plus 136 MiB of kernel memory.

This matters for runner sizing in two ways. Your CI's memory graph may not show the build at all, depending on whether it measures the job's process tree or the whole machine. And if a self-hosted runner limits only the job's process tree, a Docker build in that job can run outside the limit, so a "2 GB job" can push the host far past 2 GB. Check which cgroup your executor puts the Docker daemon in.

## Two method bugs that cost us a run

The first 2 GB Vite run left no result at all. The kernel killed the Vite process, and then systemd stopped the whole scope, including our wrapper script, before it could write anything. The journal said so:

```text
p1-vite-2G-r1.scope: A process of this unit has been killed by the OOM killer.
p1-vite-2G-r1.scope: Failed with result 'oom-kill'.
```

systemd 255 sets `DefaultOOMPolicy=stop`, and scopes follow it. We set `DefaultOOMPolicy=continue` before the next 2 GB run (the published `p1.sh` also passes `-p OOMPolicy=continue`), and checked with a 64 MiB scope that the wrapper now survives a kill and records `oom_kill 1`. Runs 2 and 3 at 2 GB have full records.

Then our rerun of run 1 failed too, for a different reason. systemd keeps a failed transient unit loaded, so starting a new scope with the same name was refused:

```text
Failed to start transient scope unit: Unit p1-vite-2G-r1.scope was already loaded or has a fragment file.
```

By the time we saw that, the Docker cache tests for the next post were running on the same droplet, so we did not try again. Run 1 still counts as a kill: its kernel log line reads `oom_memcg=/bench.slice/p1-vite-2G-r1.scope,...,task=MainThread,pid=36041`, and our sampler, which runs outside the scope, saw the cgroup reach 2,048 MiB, with up to 1,985 MiB anonymous, before its last sample at 70.5 seconds. The published `redo` mode now runs `systemctl reset-failed` first.

If you measure builds this way, set `OOMPolicy=continue` and give each run a unique unit name, or the runs that you care about most, the ones that fail, will be the ones with no data.

## A sizing table

From these runs, for a 4 vCPU runner. The "smallest limit that passed" column is measured. The last column is our rule of thumb, not a measurement: a real VM also holds the OS, the runner agent and any service containers, so we pick the smallest size that leaves at least 1 GB above the anonymous peak.

| Build like ours                                         | Anonymous peak                     | Smallest limit that passed every run | Runner we would pick                                                                   |
| ------------------------------------------------------- | ---------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Bundler that also type-checks (Excalidraw `vite build`) | 3,248 MiB                          | 4 GB                                 | 8 GB (moving the type check to its own job may make 4 GB enough; we did not test that) |
| Large type check on its own (`tsc`, 1,508 files)        | 1,139 MiB at 8 GB, 970 MiB at 2 GB | 2 GB                                 | 4 GB                                                                                   |
| Gradle with a 1 GB daemon heap (PlantUML `jar`)         | 1,143 MiB                          | 2 GB                                 | 4 GB, with `--no-daemon`                                                               |
| Go build of a mid-size CLI (`gh`)                       | 424 MiB                            | 2 GB                                 | 2 GB                                                                                   |
| Docker build of a Go service                            | 355 MiB inside BuildKit            | 2 GB                                 | 2 GB, plus what the Docker daemon and the other steps need                             |

Hosted CI services list their machines by vCPU and memory, so you can match a build to a size. [Bitrise](https://bitrise.io), for example, lists every Linux machine type on its pricing page with its vCPU count and memory, such as 2 vCPU with 8 GB, and also sells a remote build cache for Gradle, Bazel and Xcode (checked on its public pages on 2 November 2026). Whatever you use, measure anonymous memory first, then pick the size.

## What we could not conclude

- **Three limits on one machine are not three machines.** A real 2 GB runner has less page cache to spare, its own kernel, and a runner agent in the same memory. Leave a margin above the anonymous peak; our sizing table uses 1 GB.
- **CPU count changes memory.** Every run had 4 vCPUs. The Go compiler, Rollup's workers and Gradle's workers scale with CPUs, so these numbers are not valid for 2 or 16 vCPUs.
- **Wall times are noisy.** The droplet reported 23.5% CPU steal time across the 33 runs that our CPU counter log covered, and between 3.7% and 35.5% in single runs. The Go build took between 121.3 and 199.6 seconds at limits it never came close to. We do not read anything into a time difference between limits unless it repeats in every round, as the tsc gap did.
- **Two or three runs per cell is enough to see a failure repeat and a peak hold steady, and that is all.** The anonymous peaks varied by up to 21% for the Go build (353 to 441 MiB at 8 GB) and up to 15% for Gradle, and 6% or less for Vite, tsc and Docker between runs of the same cell.
- **We did not split shared builds.** We cannot say how much of the Vite build's memory is Rollup and how much is the checker, or how much of the Docker build's page cache is layer extraction.
- **Rust ran once.** One ripgrep build at 8 GB, so no repeats and no 2 GB or 4 GB data.

## Run it yourself

Create a 4 vCPU, 8 GB Ubuntu 24.04 machine, copy the files below to `/root/bench/`, and run:

```bash
bash /root/bench/setup.sh
bash /root/bench/p1.sh warmup   # probes the runtimes, one unmeasured run per build
bash /root/bench/p1.sh matrix   # 3 rounds x 3 limits x each build (we stopped it after round 2)
bash /root/bench/p1.sh round3   # what we ran as round 3: 8 GB and 2 GB only
bash /root/bench/p1.sh redo     # reruns any cell that left no result
python3 summarize_p1.py /root/res/p1
```

Each run writes its own directory with `result.env`, `memory.events`, `samples.json` and the build log, so you can read any single run on its own.

<details>
<summary>setup.sh: toolchains, pinned sources, dependencies, registries</summary>

```bash
#!/bin/bash
# Droplet setup: toolchains, pinned sources, dependency prefetch, local registries.
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive
mkdir -p /root/src /root/res
cloud-init status --wait || true   # first boot runs apt; wait for its lock

fetch_sha() { git init -q "$1"; git -C "$1" remote add origin "$2"; git -C "$1" fetch -q --depth 1 origin "$3"; git -C "$1" checkout -q FETCH_HEAD; }
fetch_sha /root/src/excalidraw https://github.com/excalidraw/excalidraw 8bcdca4526867433f99fdfcb55a063668db0c9dc
fetch_sha /root/src/plantuml https://github.com/plantuml/plantuml db06d70e18e71839dd5e330ac4086f3845371e3b
fetch_sha /root/src/cli https://github.com/cli/cli 9490d204a2ba95434153dedce99898ce9f281426
git clone -q --depth 1 --branch 15.2.0 https://github.com/BurntSushi/ripgrep /root/src/ripgrep
fetch_sha /root/src/msd https://github.com/GoogleCloudPlatform/microservices-demo c7cb6d5bfd6ea3aed768634ebbcb98cb7a523712

curl -fsSL https://go.dev/dl/go1.27.3.linux-amd64.tar.gz | tar -C /usr/local -xz
curl -fsSL https://nodejs.org/dist/v24.22.2/node-v24.22.2-linux-x64.tar.xz | tar -C /usr/local --strip-components=1 -xJ
curl -fsSL https://sh.rustup.rs | sh -s -- -y -q --profile minimal --default-toolchain stable
apt-get update -q
apt-get install -y -q openjdk-21-jdk-headless build-essential git jq zstd python3 ca-certificates curl
curl -fsSL https://get.docker.com | sh
export PATH=/usr/local/go/bin:/root/.cargo/bin:/usr/local/bin:$PATH GOTOOLCHAIN=local
npm install -g yarn@1.22.22

docker pull -q moby/buildkit:v0.34.1
docker pull -q registry:2.8.3
docker run -d --name reg-cache -p 127.0.0.1:5000:5000 registry:2.8.3
docker run -d --name mirror-hub -p 127.0.0.1:5001:5000 -e REGISTRY_PROXY_REMOTEURL=https://registry-1.docker.io registry:2.8.3
docker run -d --name mirror-gcr -p 127.0.0.1:5002:5000 -e REGISTRY_PROXY_REMOTEURL=https://gcr.io registry:2.8.3

# dependencies are downloaded once, outside the measured runs
(cd /root/src/excalidraw && yarn install --frozen-lockfile --network-timeout 600000)
(cd /root/src/cli && go mod download)
(cd /root/src/ripgrep && cargo fetch --locked)

# systemd stops a scope after an OOM kill by default; keep the wrapper alive to record the result
mkdir -p /etc/systemd/system.conf.d
printf '[Manager]\nDefaultOOMPolicy=continue\n' > /etc/systemd/system.conf.d/oom.conf
systemctl daemon-reexec
```

</details>

<details>
<summary>wrap.sh: runs inside the scope and records the result</summary>

```bash
#!/bin/bash
# Runs inside the systemd scope. usage: wrap.sh OUTDIR TIMEOUT_S cmd...
out=$1; tmo=$2; shift 2
cg=/sys/fs/cgroup$(sed -n 's/^0:://p' /proc/self/cgroup)
echo "$cg" > "$out/cgroup"
cat "$cg/memory.max" > "$out/memory.max"
t0=$(date +%s.%N)
timeout -k 15 "$tmo" "$@" > "$out/build.log" 2>&1
rc=$?
t1=$(date +%s.%N)
{
  echo "rc=$rc"
  echo "t0=$t0"
  echo "t1=$t1"
  echo "peak=$(cat "$cg/memory.peak")"
  echo "current_after=$(cat "$cg/memory.current")"
  awk '$1=="anon"||$1=="file"{print $1"_after="$2}' "$cg/memory.stat"
} > "$out/result.env"
cp "$cg/memory.events" "$out/memory.events"
for p in $(cat "$cg/cgroup.procs"); do
  [ "$p" = "$$" ] && continue
  ps -o pid=,rss=,args= -p "$p" | cut -c1-400
done > "$out/leftover.txt" 2>/dev/null
if [ -n "${LEFTOVER_WAIT:-}" ]; then
  sleep "$LEFTOVER_WAIT"
  echo "current_later=$(cat "$cg/memory.current")" >> "$out/result.env"
  awk '$1=="anon"{print "anon_later="$2}' "$cg/memory.stat" >> "$out/result.env"
  for p in $(cat "$cg/cgroup.procs"); do
    [ "$p" = "$$" ] && continue
    ps -o pid=,rss=,args= -p "$p" | cut -c1-400
  done > "$out/leftover_later.txt" 2>/dev/null
fi
touch "$out/done"
exit $rc
```

</details>

<details>
<summary>sample.py: polls memory.stat every 100 ms from outside the scope</summary>

```python
#!/usr/bin/env python3
"""Poll one cgroup v2 directory every 100 ms until a done file appears.

usage: sample.py CGROUP_DIR OUT_JSON DONE_FILE
Records the maximum of anon, file, kernel and memory.current, plus a series.
"""
import json, os, sys, time

cg, out, done = sys.argv[1:4]
start = time.time()
while not os.path.isdir(cg):
    if time.time() - start > 60 or os.path.exists(done):
        json.dump({"error": "cgroup never appeared"}, open(out, "w"))
        sys.exit(0)
    time.sleep(0.02)

keys = ("anon", "file", "kernel", "shmem")
mx = {k: 0 for k in keys}
mx["current"] = 0
series = []
t0 = time.time()
n = 0
while not os.path.exists(done):
    try:
        with open(os.path.join(cg, "memory.stat")) as f:
            st = {}
            for line in f:
                k, v = line.split()
                if k in keys:
                    st[k] = int(v)
        with open(os.path.join(cg, "memory.current")) as f:
            cur = int(f.read())
    except OSError:
        break
    n += 1
    for k in keys:
        mx[k] = max(mx[k], st.get(k, 0))
    mx["current"] = max(mx["current"], cur)
    series.append([round(time.time() - t0, 2), st.get("anon", 0), st.get("file", 0), cur])
    time.sleep(0.1)

json.dump({"max": mx, "samples": n, "interval_s": 0.1, "series": series}, open(out, "w"))
```

</details>

<details>
<summary>p1-cmds.sh: the builds, and what is deleted before each run</summary>

```bash
#!/bin/bash
# Build definitions for post 1. prep_* runs outside the cgroup, cmd_* inside it.
export PATH=/usr/local/go/bin:/root/.cargo/bin:/usr/local/bin:$PATH GOTOOLCHAIN=local
EX=/root/src/excalidraw PU=/root/src/plantuml GH=/root/src/cli RG=/root/src/ripgrep
FRONTEND=/root/src/msd/src/frontend

stop_gradle() { pkill -f GradleDaemon || true; pkill -f GradleWrapperMain || true; pkill -f KotlinCompileDaemon || true; sleep 1; }

prep_vite() { rm -rf $EX/excalidraw-app/build $EX/node_modules/.vite $EX/excalidraw-app/node_modules/.vite; }
cmd_vite() { cd $EX && yarn build:app:docker; }

prep_tsc() { find $EX -maxdepth 2 -name '*.tsbuildinfo' -delete; }
cmd_tsc() { cd $EX && node_modules/.bin/tsc -p tsconfig.json --extendedDiagnostics; }

prep_gradle_daemon() { stop_gradle; rm -rf $PU/build $PU/.gradle; }
cmd_gradle_daemon() { cd $PU && ./gradlew jar --console=plain --no-build-cache; }

prep_gradle_nodaemon() { stop_gradle; rm -rf $PU/build $PU/.gradle; }
cmd_gradle_nodaemon() { cd $PU && ./gradlew --no-daemon jar --console=plain --no-build-cache; }

prep_go() { rm -rf /root/gocache /root/out; mkdir -p /root/out; }
cmd_go() { cd $GH && GOCACHE=/root/gocache go build -o /root/out/gh ./cmd/gh; }

prep_rust() { rm -rf $RG/target; }
cmd_rust() { cd $RG && cargo build --release --locked; }

prep_docker() { docker buildx ls --format '{{.Name}}' 2>/dev/null | grep '^p1d' | xargs -r -n1 docker buildx rm >/dev/null 2>&1 || true; }

if [ "${BASH_SOURCE[0]}" = "$0" ]; then "$@"; fi
```

</details>

<details>
<summary>p1.sh: probe, warm-up, matrix, round 3, redo, and the docker build cell</summary>

```bash
#!/bin/bash
# Post 1 matrix. usage: p1.sh warmup | p1.sh matrix
set -u
B=/root/bench R=/root/res/p1
mkdir -p $R
source $B/p1-cmds.sh
LIMITS=(8G 4G 2G)
BUILDS=(vite tsc gradle_daemon gradle_nodaemon go rust docker)
# rust ran once (warmup) only: the matrix did not fit the droplet time budget
MATRIX_BUILDS=(vite tsc gradle_daemon gradle_nodaemon go docker)
CPUS=0-3
log() { echo "$(date -u +%FT%TZ) $*" | tee -a $R/progress.log; }

scope_run() { # unit limit out tmo cmd...
  local unit=$1 lim=$2 out=$3 tmo=$4; shift 4
  python3 $B/sample.py /sys/fs/cgroup/bench.slice/$unit.scope $out/samples.json $out/done &
  local sp=$!
  systemd-run --scope --quiet --slice=bench.slice --unit=$unit \
    -p MemoryMax=$lim -p MemorySwapMax=0 -p AllowedCPUs=$CPUS -p OOMPolicy=continue \
    $B/wrap.sh $out $tmo "$@"
  wait $sp
  systemctl stop $unit.scope 2>/dev/null || true
}

docker_cell() { # lim out tmo tag
  local lim=$1 out=$2 tmo=$3 tag=$4
  local name=$(echo p1d$tag | tr A-Z a-z) m=$(echo $1 | tr G g)
  docker buildx create --name $name --driver docker-container \
    --driver-opt network=host --driver-opt image=moby/buildkit:v0.34.1 \
    --driver-opt memory=$m --driver-opt memory-swap=$m --driver-opt cpuset-cpus=$CPUS \
    --buildkitd-config $B/buildkitd.toml --bootstrap > $out/create.log 2>&1
  local cid; cid=$(docker inspect -f '{{.Id}}' buildx_buildkit_${name}0)
  local cg=/sys/fs/cgroup/system.slice/docker-$cid.scope
  cat $cg/memory.max > $out/container_memory.max
  mkdir -p $out/cli
  python3 $B/sample.py $cg $out/container_samples.json $out/cli/done &
  local sp=$!
  scope_run p1-docker-$tag $lim $out/cli $tmo \
    docker buildx build --builder $name --progress=plain --provenance=false --output type=cacheonly $FRONTEND
  wait $sp
  { echo "container_peak=$(cat $cg/memory.peak)"; cat $out/cli/result.env; } > $out/result.env
  cp $cg/memory.events $out/container_memory.events
  cp $out/cli/build.log $out/build.log
  docker buildx rm $name > /dev/null 2>&1
}

run_cell() { # build limit run tmo
  local b=$1 lim=$2 r=$3 tmo=$4
  local tag=$b-$lim-$r out=$R/$b/$lim/$r
  rm -rf $out; mkdir -p $out
  prep_$b
  sync; echo 3 > /proc/sys/vm/drop_caches; sleep 2
  if [ $b = docker ]; then
    docker_cell $lim $out $tmo ${lim}$r
  else
    case $b in gradle_*) export LEFTOVER_WAIT=5 ;; esac
    scope_run p1-$tag $lim $out $tmo bash $B/p1-cmds.sh cmd_$b
    unset LEFTOVER_WAIT
  fi
  [ $b = gradle_daemon ] || [ $b = gradle_nodaemon ] && stop_gradle
  log "$tag $(tr '\n' ' ' < $out/result.env)"
}

probe() { # record what the runtimes see inside each limit
  for lim in "${LIMITS[@]}"; do
    systemd-run --scope --quiet --slice=bench.slice --unit=probe-$lim -p MemoryMax=$lim -p MemorySwapMax=0 -p AllowedCPUs=$CPUS \
      bash -c 'echo "nproc=$(nproc)"; echo "memory.max=$(cat /sys/fs/cgroup$(sed -n "s/^0:://p" /proc/self/cgroup)/memory.max)";
        echo "node_heap_size_limit=$(node -e "console.log(require(\"v8\").getHeapStatistics().heap_size_limit)")";
        java -XX:+PrintFlagsFinal -version 2>/dev/null | grep -E " (MaxHeapSize|MaxRAMPercentage|ActiveProcessorCount) "' > $R/probe-$lim.txt 2>&1
  done
  { echo "nproc=$(nproc)"; free -b | head -2; echo "node_heap_size_limit=$(node -e 'console.log(require("v8").getHeapStatistics().heap_size_limit)')";
    java -XX:+PrintFlagsFinal -version 2>/dev/null | grep -E " (MaxHeapSize|MaxRAMPercentage) "; } > $R/probe-host.txt 2>&1
}

case ${1:-} in
  warmup)
    probe
    for b in "${BUILDS[@]}"; do run_cell $b 8G r0 900; done
    log WARMUP-DONE ;;
  matrix)
    declare -A TMO
    for b in "${MATRIX_BUILDS[@]}"; do
      . <(grep -E '^t[01]=' $R/$b/8G/r0/result.env)
      w=$(python3 -c "print(int(float('$t1')-float('$t0')))")
      t=$((3 * w + 60)); [ $t -gt 600 ] && t=600; [ $t -lt 120 ] && t=120
      TMO[$b]=$t
    done
    log "timeouts: $(for b in "${MATRIX_BUILDS[@]}"; do printf '%s=%s ' $b ${TMO[$b]}; done)"
    for r in r1 r2 r3; do
      for b in "${MATRIX_BUILDS[@]}"; do
        for lim in "${LIMITS[@]}"; do run_cell $b $lim $r ${TMO[$b]}; done
      done
    done
    log MATRIX-DONE ;;
  round3) # third run at 8G and 2G only: the full round did not fit the droplet time budget
    declare -A TMO=([vite]=300 [tsc]=381 [gradle_daemon]=600 [gradle_nodaemon]=351 [go]=414 [docker]=351)
    log "round 3 at 8G and 2G only"
    for b in "${MATRIX_BUILDS[@]}"; do
      for lim in 8G 2G; do run_cell $b $lim r3 ${TMO[$b]}; done
    done
    log MATRIX-DONE ;;
  redo) # rerun cells that left no result (systemd stopped the scope after an OOM kill)
    declare -A TMO=([vite]=300 [tsc]=381 [gradle_daemon]=600 [gradle_nodaemon]=351 [go]=414 [docker]=351)
    for b in "${MATRIX_BUILDS[@]}"; do for lim in "${LIMITS[@]}"; do for r in r1 r2 r3; do
      d=$R/$b/$lim/$r
      if [ -d $d ] && ! grep -q '^rc=' $d/result.env 2>/dev/null; then
        rm -rf $d.lost; mv $d $d.lost; log "redo $b $lim $r"
        systemctl reset-failed p1-$b-$lim-$r.scope 2>/dev/null  # added after our run: a failed scope blocks its name
        run_cell $b $lim $r ${TMO[$b]}
      fi
    done; done; done
    log REDO-DONE ;;
  *) echo "usage: $0 warmup|matrix|round3|redo"; exit 2 ;;
esac
```

</details>

<details>
<summary>buildkitd.toml: send base image pulls to the local mirror</summary>

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
<summary>summarize_p1.py: medians per build and limit</summary>

```python
#!/usr/bin/env python3
"""Summarize post 1 runs: medians per build and limit over the measured runs (r1..r3)."""
import json, os, re, statistics, sys

root = sys.argv[1]
BUILDS = ["vite", "tsc", "gradle_daemon", "gradle_nodaemon", "go", "rust", "docker"]
LIMITS = ["8G", "4G", "2G"]
MiB = 2 ** 20

def env(path):
    d = {}
    if os.path.exists(path):
        for line in open(path):
            if "=" in line:
                k, v = line.strip().split("=", 1)
                d[k] = v
    return d

def events(path):
    d = {}
    if os.path.exists(path):
        for line in open(path):
            k, v = line.split()
            d[k] = int(v)
    return d

def run_info(d, build):
    r = env(os.path.join(d, "result.env"))
    if not r or "rc" not in r:
        return None
    log = open(os.path.join(d, "build.log"), errors="replace").read() if os.path.exists(os.path.join(d, "build.log")) else ""
    if build == "docker":
        if not r.get("container_peak"):
            return None  # warm-up run 0 recorded no container numbers (builder name case bug)
        ev = events(os.path.join(d, "container_memory.events"))
        smp = json.load(open(os.path.join(d, "container_samples.json")))
        peak = int(r["container_peak"])
        cli_peak = int(r["peak"])
    else:
        ev = events(os.path.join(d, "memory.events"))
        smp = json.load(open(os.path.join(d, "samples.json")))
        peak = int(r["peak"])
        cli_peak = None
    rc = int(r["rc"])
    wall = float(r["t1"]) - float(r["t0"])
    if rc == 0:
        outcome = "ok"
    elif ev.get("oom_kill", 0) > 0:
        outcome = "oom_kill"
    elif "heap out of memory" in log or "Reached heap limit" in log:
        outcome = "node_heap"
    elif "OutOfMemoryError" in log:
        outcome = "java_heap"
    elif rc in (124, 137):
        outcome = "timeout"
    else:
        outcome = f"fail_rc{rc}"
    mx = smp.get("max", {})
    return {
        "rc": rc, "outcome": outcome, "wall_s": round(wall, 1),
        "peak_mib": round(peak / MiB), "anon_max_mib": round(mx.get("anon", 0) / MiB),
        "file_max_mib": round(mx.get("file", 0) / MiB), "kernel_max_mib": round(mx.get("kernel", 0) / MiB),
        "samples": smp.get("samples"),
        "oom_kill": ev.get("oom_kill", 0), "max_events": ev.get("max", 0), "high_events": ev.get("high", 0),
        "after_mib": round(int(r.get("current_after", 0)) / MiB), "anon_after_mib": round(int(r.get("anon_after", 0)) / MiB),
        "cli_peak_mib": round(cli_peak / MiB) if cli_peak is not None else None,
        "later_mib": round(int(r["current_later"]) / MiB) if "current_later" in r else None,
        "anon_later_mib": round(int(r["anon_later"]) / MiB) if "anon_later" in r else None,
        "leftover_later": open(os.path.join(d, "leftover_later.txt")).read().strip() if os.path.exists(os.path.join(d, "leftover_later.txt")) else None,
        "leftover": open(os.path.join(d, "leftover.txt")).read().strip() if os.path.exists(os.path.join(d, "leftover.txt")) else "",
    }

def med(xs):
    xs = [x for x in xs if x is not None]
    return round(statistics.median(xs), 1) if xs else None

out = {}
for b in BUILDS:
    for lim in LIMITS:
        runs = {}
        for rn in ("r0", "r1", "r2", "r3"):
            d = os.path.join(root, b, lim, rn)
            if os.path.isdir(d):
                info = run_info(d, b)
                if info:
                    runs[rn] = info
        meas = [runs[k] for k in ("r1", "r2", "r3") if k in runs]
        ok = [x for x in meas if x["outcome"] == "ok"]
        out[f"{b}/{lim}"] = {
            "runs": runs, "n": len(meas), "n_ok": len(ok),
            "outcomes": [x["outcome"] for x in meas],
            "wall_med_ok": med([x["wall_s"] for x in ok]),
            "wall_med_all": med([x["wall_s"] for x in meas]),
            "peak_med": med([x["peak_mib"] for x in meas]),
            "anon_med": med([x["anon_max_mib"] for x in meas]),
            "file_med": med([x["file_max_mib"] for x in meas]),
            "peak_range": [min(x["peak_mib"] for x in meas), max(x["peak_mib"] for x in meas)] if meas else None,
            "anon_range": [min(x["anon_max_mib"] for x in meas), max(x["anon_max_mib"] for x in meas)] if meas else None,
            "wall_range": [min(x["wall_s"] for x in meas), max(x["wall_s"] for x in meas)] if meas else None,
            "after_med": med([x["after_mib"] for x in meas]),
            "anon_after_med": med([x["anon_after_mib"] for x in meas]),
            "cli_peak_med": med([x["cli_peak_mib"] for x in meas]),
            "later_med": med([x["later_mib"] for x in meas]),
            "anon_later_med": med([x["anon_later_mib"] for x in meas]),
            "max_events_med": med([x["max_events"] for x in meas]),
        }
json.dump(out, open(os.path.join(root, "summary.json"), "w"), indent=1)
print(f"{'cell':26} {'n':>2} {'ok':>2} {'wall_ok':>8} {'peak':>6} {'anon':>6} {'file':>6} {'after':>6} outcomes / ranges")
for k, v in out.items():
    print(f"{k:26} {v['n']:>2} {v['n_ok']:>2} {str(v['wall_med_ok']):>8} {str(v['peak_med']):>6} {str(v['anon_med']):>6} {str(v['file_med']):>6} {str(v['after_med']):>6} {v['outcomes']} wall{v['wall_range']} anon{v['anon_range']} peak{v['peak_range']} maxev={v['max_events_med']} cli={v['cli_peak_med']} later={v['later_med']}/{v['anon_later_med']}")
```

</details>

## Summary

Most CI builds need less memory than the cgroup counter suggests, because `memory.peak` includes page cache that the kernel gives back under pressure. Measure anonymous memory, run the build inside the limit you want to buy, and check `memory.events` for `max` and `oom_kill`. Then look for the traps: a bundler that runs a type checker, a runtime that sizes its heap from the limit, a Gradle daemon that stays after the build, and a Docker build that runs outside your cgroup. In our runs, fixing any of those was worth more than doubling the runner's memory.
