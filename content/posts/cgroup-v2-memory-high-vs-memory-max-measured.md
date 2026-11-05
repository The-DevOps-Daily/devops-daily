---
title: 'cgroup v2 memory.high Throttles, memory.max Kills: Measured on a Host Without Swap'
excerpt: 'We ran one allocating workload under memory.max, memory.high and both on a Linux 6.8 host with no swap. memory.max killed it in under half a second. memory.high did not kill it: new allocations waited, once per 64-page batch at best and once per page next to a busy neighbour on the same CPU. Here are the numbers, the kernel formula behind them, and what systemd, Docker and Kubernetes write.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2026-11-06'
publishedAt: '2026-11-06T07:00:00Z'
updatedAt: '2026-11-06T07:00:00Z'
readingTime: '24 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Linux
  - cgroups
  - Memory
  - systemd
  - Docker
  - Kubernetes
  - PSI
  - OOM
---

We ran one Python workload that allocates memory in 256 KiB steps, on a Linux 6.8 host with no swap, under cgroup v2 `memory.max`, `memory.high`, both and neither. When it asked for 320 MiB with only `memory.max` at 256 MiB, it ran at full speed and the kernel killed it 0.28 to 0.39 seconds after it started. With only `memory.high` at 230.4 MiB, the kernel did not kill it. It made new allocations wait instead, and after 150 seconds the workload held 11 to 12 MiB more than `memory.high`.

The case to worry about is the smaller one. A version of the workload that needs 239 MiB fits under `memory.max` and runs at full speed there. With `memory.high` at 90% of that limit, which is what Kubernetes MemoryQoS writes for a 256Mi limit and a zero memory request with the 1.36 default factor, its median allocation took 191.8 ms on a CPU of its own and 6.2 seconds on a CPU it shared with our 100 ms sampler, against 0.26 ms with no limit. It reported no error.

The kernel's throttle formula predicted the length of each sleep to within about 10%. The number of sleeps is what changed: once per 64-page batch, as the code suggests, or once per 4 KiB page. We found in review that our own sampler, on the same CPU, kept the task at once per page. Without it, the count still switched to once per page in phases, while other work ran on the host. And one condition changed both limits: when the program's own code was charged to its cgroup, the kernel reclaimed that code and read it back from disk over and over, and `memory.max` did not kill it within the 20 seconds we allowed.

This post has the numbers, the kernel formula, the method problems we found on the way, and a check of what systemd, Docker and Kubernetes write to these files.

## TL;DR

- **`memory.max` alone killed at full speed.** The 320 MiB workload ran at normal latency (p99 of the last 10% of operations 0.29 to 0.41 ms) and the kernel OOM-killed it 0.28 to 0.39 seconds after it started, in 3 of 3 runs.
- **`memory.high` alone did not kill within the 150 second cap. It made new allocations wait.** Each sleep was 1.06 to 1.10 times the kernel's formula at the median, `64000 x o^2` ms with `o` the share over `memory.high`. At the 2 s cap the median sleep was 2,047.9 ms, which fits the timer wheel's 64 ms step for a 2,000 ms timeout.
- **The number of sleeps decides the cost, and a neighbour on the same CPU decides the number.** The kernel's comment says one sleep per 64-page batch. With our sampler on the same CPU, the task slept once per 4 KiB page in 95% of the operations whose sleep was 50 ms or more. Without that neighbour (the workload on another CPU, or the sampler once a second), it switched between about 1 and 64 sleeps per batch in phases of tens of seconds, and spent 46% to 72% of that time in the slow phases.
- **A program that fits under `memory.max` but not under `memory.high` ran much slower and reported nothing.** With `memory.high` at 90% of a 256 MiB limit (the kubelet's value for a zero memory request and factor 0.9), the median allocation took 191.8 ms on its own CPU and 6,216 ms next to the busy sampler (15 to 17 of its 200 churn operations in 150 s), against 0.257 ms with no limit.
- **Both limits only delayed the kill.** With `memory.high` at 90% of `memory.max`, a leak was OOM-killed after 29.1 minutes next to the busy sampler. With `memory.max` alone the kill took 0.3 seconds. On a CPU of its own, it was not killed within the 120 second cap in 3 of 3 runs.
- **Code pages in the cgroup turn both limits into thrashing.** When the program's own binary was charged to its cgroup, the kernel reclaimed it and read it back from disk, 2.4 to 2.6 GB in 25 seconds at our 100 MiB/s disk cap. `memory.max` did not kill it within 20 seconds in 3 of 3 runs, and memory PSI showed only 8% while io PSI showed 85%.
- **Page cache is not throttled or killed.** Neither limit killed the file-reading runs or put them to sleep. They capped the cache, so later reads went to disk more often (p99 1.0 to 2.6 ms against 0.13 ms with no limit).
- **The tools:** systemd writes `MemoryHigh=` and `MemoryMax=` to `memory.high` and `memory.max` as given. Docker has no flag for `memory.high`, and on cgroup v2 `--memory-reservation` becomes `memory.low`. Kubernetes MemoryQoS writes `memory.high`; it is alpha and off in 1.36, and beta and on in 1.37 but with no throttling factor set, so no `memory.high` unless you set one.

## Prerequisites

- A Linux machine with cgroup v2 (`stat -fc %T /sys/fs/cgroup` prints `cgroup2fs`) and systemd
- Root, or a cgroup subtree delegated to your user
- Python 3 for the workload and the analysis scripts
- Check for swap first: `swapon --show`. Our results are for a host with no swap. With swap, the kernel can move anonymous memory out, and both limits behave differently

## Two limits, two code paths

Both files live in a cgroup v2 directory. Both act when the kernel charges a new page to the cgroup. They do different things when the cgroup is over its value.

- **`memory.max`** is the hard limit. The kernel docs for 6.8 say: "If a cgroup's memory usage reaches this limit and can't be reduced, the OOM killer is invoked in the cgroup." The charge path tries to reclaim first, retries, and calls the OOM killer only when reclaim makes no progress.
- **`memory.high`** is the throttle. The same docs say: "Going over the high limit never invokes the OOM killer and under extreme conditions the limit may be breached." The charge always succeeds. On the way back to user space, `mem_cgroup_handle_over_high()` tries to reclaim, and if usage is still over the value it puts the task to sleep.

The sleep length comes from `calculate_high_delay()` in `mm/memcontrol.c`. On the Ubuntu 6.8.0-147 kernel we ran, with `HZ=1000`, it works out to:

```text
o       = (usage - memory.high) / memory.high
penalty = 64000 * o^2 ms per charge batch of 64 pages (MEMCG_CHARGE_BATCH)
          no sleep if penalty <= 10 ms; at most 2000 ms (MEMCG_MAX_HIGH_DELAY_JIFFIES = 2 * HZ)
```

So the sleep is 0 until usage is 1.25% over `memory.high`, 160 ms at 5% over, 640 ms at 10% over, and it hits the 2 s cap at 17.7% over. The comment above the cap reads "Clamp the maximum sleep time per allocation batch to 2 seconds." Each `reclaim_high()` call adds 1 to the `high` counter in `memory.events`. When reclaim frees nothing, the kernel calls it 17 times before it sleeps (once, then `MAX_RECLAIM_RETRIES` = 16 retries). When reclaim frees something, it keeps retrying and does not sleep. So in a cgroup with nothing to reclaim, the counter rises by 17 per sleep, and that is how we count sleeps from outside the kernel.

```diagram
{
  "type": "graph",
  "columns": [
    [{ "id": "fault", "label": "page fault", "sub": "charge to the cgroup", "icon": "cpu", "tone": "slate" }],
    [
      { "id": "max", "label": "over memory.max", "sub": "before the charge", "icon": "shield", "tone": "red", "detail": "try_charge_memcg() reclaims and retries up to 16 times, then calls the memcg OOM killer if reclaim freed nothing." },
      { "id": "high", "label": "over memory.high", "sub": "after the charge", "icon": "activity", "tone": "amber", "detail": "The charge succeeds. mem_cgroup_handle_over_high() runs on the return to user space." }
    ],
    [
      { "id": "rmax", "label": "reclaim", "sub": "direct, in the fault", "icon": "gear", "tone": "slate" },
      { "id": "rhigh", "label": "reclaim_high x17", "sub": "+17 to memory.events high", "icon": "gear", "tone": "slate" }
    ],
    [
      { "id": "oom", "label": "OOM kill", "sub": "nothing reclaimable", "icon": "lock", "tone": "red", "status": "down" },
      { "id": "sleep", "label": "sleep", "sub": "64000 x o^2 ms, at most 2 s", "icon": "queue", "tone": "amber", "status": "warn" },
      { "id": "thrash", "label": "thrash", "sub": "reclaim frees the task's own code", "icon": "database", "tone": "violet", "status": "warn", "detail": "If the cgroup holds file pages, reclaim succeeds: no sleep and no OOM kill. The task faults the pages back in from disk." }
    ]
  ],
  "edges": [
    ["fault", "max"],
    ["fault", "high"],
    ["max", "rmax"],
    ["high", "rhigh"],
    ["rmax", "oom", "freed nothing"],
    ["rmax", "thrash", "freed file pages"],
    ["rhigh", "sleep", "freed nothing"],
    ["rhigh", "thrash", "freed file pages"]
  ]
}
```

Without swap, the kernel has nowhere to put anonymous memory: heaps, stacks, anything a process allocated and wrote. In our runs that memory was never reclaimed (`pgsteal` stayed 0 in every warm anonymous run). What reclaim could take were file pages: page cache and the mapped code of the program in the cgroup. That decides most of what follows.

## The lab

One host: Ubuntu 24.04, kernel 6.8.0-147-generic, systemd 255, 4 vCPU, 7.75 GiB of RAM, no swap device and zswap off, `CONFIG_HZ=1000`, transparent huge pages on `madvise` (`results/00-host.txt`). It is a shared development machine. So every run happened inside one transient systemd scope with `Delegate=yes` and `MemoryMax=1G`, every run got its own child cgroup, and no limit went above 1 GiB.

The workload is one script, `scripts/lib/workload.py`. Each operation maps a 256 KiB private anonymous chunk and writes all of it. That is 64 pages, which is also the kernel's charge batch. Each operation also copies one random chunk it already holds, so the working set stays in use. The phases:

1. **Grow** until the workload holds its target.
2. **Churn** 200 times: free one random chunk and allocate a new one, so usage stays flat while the program keeps allocating, like a busy service.

The random choices are seeded (mulberry32). Before and after every operation, the workload reads `memory.current` and the `high` and `max` counters in `memory.events` from open file descriptors, and writes one JSON line with the latency. A driver outside the cgroup samples `memory.current`, `memory.events`, `memory.pressure`, `io.pressure`, `memory.stat`, `cpu.stat` and each process's `/proc/<pid>/wchan` and `/proc/<pid>/stat` every 100 ms. The driver pinned itself to CPU 0, and the workload inherited that, so in the main matrix the two shared one CPU. We only saw that in review, and it changed one of the results a lot. The section on how many sleeps a task pays has the runs that measure it.

The two limits are fixed for every run:

- `memory.max` = 268435456 bytes (256 MiB)
- `memory.high` = 241590272 bytes (230.4 MiB). That is the value the kubelet computes with MemoryQoS for `limits.memory: 256Mi`, `requests.memory: 0` and the 1.36 default throttling factor of 0.9. It is the lowest `memory.high` that formula gives for a 256Mi limit. More on that below.

| Run                      | Workload                                                                      | What it shows                                                      |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `anon-fit-*`             | grows to 232 MiB (about 239 MiB in `memory.current`), then churns             | a program that fits under `memory.max` but not under `memory.high` |
| `anon-over-*`            | asks for 320 MiB                                                              | a program that needs more than the limit, like a leak              |
| `anon-over-4p-high`      | the same 320 MiB split over 4 processes                                       | whether the throttle is per process                                |
| `anon-fit-high-populate` | `mmap` with `MAP_POPULATE`                                                    | the same bytes, charged in one system call per chunk               |
| `anon-clamp-high`        | grows to 300 MiB, then sets its own `memory.high` so its usage is 33% over it | the 2 s cap                                                        |
| `*-owncode`              | a fresh copy of the interpreter binary                                        | a program whose code pages are charged to its own cgroup           |
| `file-over-*`            | reads 320 MiB of a 512 MiB file                                               | page cache instead of anonymous memory                             |
| `anon-over-both-long`    | `anon-over` with both limits, 45 minute cap                                   | how long until the OOM kill                                        |

Each of `none`, `max`, `high` and `both` ran 3 times, in a fixed order per repetition, with a 150 second cap. The `owncode` runs thrashed the disk in the smoke tests, so we capped them at 20 seconds. We also capped every run's disk reads and writes at 100 MiB/s with `io.max` on its own cgroup, so that a thrashing run would not take the shared disk from other work. One run, `anon-over-max-owncode-fastdisk`, keeps the uncapped disk.

```github
https://github.com/The-DevOps-Daily/cgroup-memory-high-vs-max
```

We wrote the claim and what would disprove it before the first run and committed it first (`CLAIM.md`). The smoke runs then changed the design twice, and we added those changes to the same file before the main matrix. Every run directory carries a hash of the run code. The summary script refuses a batch with mixed hashes, or a hash that matches no commit in the repository.

## memory.max: full speed, then the kill

With only `memory.max`, the workload never slowed down. In the three `anon-over-max` runs the median operation took 0.20 to 0.27 ms, the p99 of the last 10% of operations before the kill was 0.29 to 0.41 ms, and the kernel killed the process 0.28 to 0.39 seconds after it started (`results/summary.md`). In each run `memory.events` counted 35 times that a charge hit the limit, then one OOM kill. The kernel log names the cgroup:

```text
oom-kill:constraint=CONSTRAINT_MEMCG,nodemask=(null),cpuset=ddmemhigh-20261105T112606Z.scope,mems_allowed=0,oom_memcg=/ddmemhigh.slice/ddmemhigh-20261105T112606Z.scope/anon-over-max-r1,task_memcg=/ddmemhigh.slice/ddmemhigh-20261105T112606Z.scope/anon-over-max-r1,task=python3.12,pid=142949,uid=0
Memory cgroup out of memory: Killed process 142949 (python3.12) total-vm:276772kB, anon-rss:261504kB, file-rss:7296kB, shmem-rss:0kB, UID:0 pgtables:580kB oom_score_adj:0
```

Nothing in the cgroup could be reclaimed. The cgroup held only the program's anonymous pages, and without swap the kernel cannot free those. So reclaim found nothing, the charge path ran out of retries, and the OOM killer ran. Memory pressure stayed at 0: the task never waited for memory. It was killed.

The `anon-fit-max` runs are the other half of the same result. That workload needs 239.2 MiB, which fits under 256 MiB. It finished all 200 churn operations with a median of 0.277 ms per churn operation and a `max` counter of 0. With no limit, the same median was 0.257 ms. If a program fits under `memory.max`, the limit costs nothing.

## memory.high: slower and slower, not killed

With only `memory.high`, the same 320 MiB workload was not killed in any of the 3 runs within the 150 second cap. The kernel docs say `memory.high` never invokes the OOM killer, and our driver stopped each run at the cap. Once it was a few MiB over the limit, it moved at the speed of the kernel's sleep timer, not at the speed of a program:

```chart
{
  "type": "line",
  "log": true,
  "unit": "ms",
  "title": "Latency of one 256 KiB allocation vs memory.current",
  "x": ["226", "227", "228", "229", "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244", "245", "246", "247", "248", "249", "250", "251", "252", "253", "254", "255", "256"],
  "series": [
    {"name": "no limit", "data": [0.248, 0.252, 0.249, 0.251, 0.246, 0.253, 0.242, 0.26, 0.24, 0.252, 0.25, 0.256, 0.243, 0.24, 0.213, 0.226, 0.238, 0.242, 0.235, 0.215, 0.223, 0.224, 0.225, 0.214, 0.253, 0.234, 0.235, 0.215, 0.239, 0.218, 0.222], "color": "#94a3b8"},
    {"name": "memory.max only", "data": [0.236, 0.224, 0.242, 0.195, 0.242, 0.223, 0.238, 0.221, 0.211, 0.216, 0.224, 0.203, 0.215, 0.199, 0.207, 0.19, 0.202, 0.204, 0.246, 0.199, 0.233, 0.232, 0.191, 0.209, 0.229, 0.243, 0.216, 0.225, 0.233, 0.238], "color": "#0080ff"},
    {"name": "memory.high only, sampler on the same CPU", "data": [0.226, 0.216, 0.2, 0.206, 0.235, 0.228, 0.22, 25.621, 39.782, 209.811, 1525.021, 4583.747, 5839.866, 7303.861, 8839.941, 10295.852], "color": "#f59e0b"},
    {"name": "memory.high only, own CPU, sampler at 1 s", "data": [0.22, 0.259, 0.258, 0.272, 0.248, 0.27, 0.262, 14.873, 106.819, 519.352, 52.8, 71.752, 95.774, 119.723, 135.811, 171.815, 191.793, 323.75, 383.851, 851.785, 11251.414, 379.811, 1847.768, 1759.826, 1135.82, 1727.849, 3199.782], "color": "#a855f7"},
    {"name": "kernel formula, 1 sleep per 64 pages", "data": [0.243, 0.243, 0.243, 0.243, 0.243, 0.243, 0.243, 11.243, 20.243, 31.243, 44.243, 60.243, 79.243, 99.243, 123.243, 148.243, 176.243, 206.243, 239.243, 274.243, 312.243, 352.243, 395.243, 439.243, 487.243, 536.243, 588.243, 643.243, 700.243, 759.243, 821.243], "dash": "6 5", "color": "#10b981"},
    {"name": "kernel formula, 1 sleep per page", "data": [0.243, 0.243, 0.243, 0.243, 0.243, 0.243, 0.243, 704.243, 1280.243, 1984.243, 2816.243, 3840.243, 5056.243, 6336.243, 7872.243, 9472.243, 11264.243, 13184.243, 15296.243, 17536.243, 19968.243, 22528.243, 25280.243, 28096.243, 31168.243, 34304.243, 37632.243, 41152.243, 44800.243, 48576.243, 52544.243], "dash": "2 4", "color": "#ef4444"}
  ],
  "refs": [
    {"value": 1, "label": "1 ms"}
  ],
  "caption": "x axis: memory.current in MiB when the op started (memory.high = 230.4 MiB, memory.max = 256 MiB). Median per 1 MiB over 3 repetitions, warm code, Ubuntu 6.8.0-147, no swap. 'Sampler on the same CPU' is the main matrix (anon-over-high: the workload inherited the driver's CPU 0, sampled every 100 ms); 'own CPU' is diag-over-high-cpu2-1s (workload on CPU 2, sampled every 1 s). memory.max only stays flat up to 256 MiB, then the OOM kill. The formula lines add the no-limit median to the kernel's sleep: once per 64-page op, or once per 4 KiB page. Source: results/runs/anon-over-*/ops.jsonl, results/diag/diag-over-high-cpu2-1s-*/ops.jsonl, scripts/50-charts.py."
}
```

In the matrix runs (the orange line), up to 232 MiB an operation took about a quarter of a millisecond, the same as with no limit. Within the next 5 MiB the median went from 0.22 ms to 4.6 seconds, and at 241 MiB it was 10.3 seconds per 256 KiB. After 150 seconds `memory.current` was 241.5 to 242.2 MiB, 11 to 12 MiB over `memory.high`, and still growing by 25 to 30 KiB per second. The process used 0.59 to 0.72 seconds of CPU in those 150 seconds. In 98% to 99% of the samples it was in state `D`, in `mem_cgroup_handle_over_high`. The purple line is the same workload on a CPU of its own. It stays near the one-sleep-per-batch line for most of the range, with jumps when it falls into a slow phase. The section on how many sleeps a task pays explains both lines.

Here is the same workload through systemd's `MemoryMax=` and `MemoryHigh=`, without our driver. The progress line shows the slowest operation in each second:

```terminal
{
  "title": "results/25-demo.txt (no driver, no CPU pinning)",
  "prompt": "$",
  "steps": [
    {
      "comment": "commands as scripts/25-demo.sh prints them (it also passes --quiet --slice=ddmemhigh.slice); 320 MiB target"
    },
    {
      "cmd": "systemd-run --scope -p MemoryMax=256M python3 -I scripts/lib/workload.py --kind anon --target-mib 320 --progress",
      "output": "pid 173416 in /sys/fs/cgroup/ddmemhigh.slice/run-r765e1a07143e4aa1be21a9eb2292aaff.scope, memory.high=max memory.max=268435456\n   0.0s  held    0 MiB  memory.current    7.0 MiB  ops     1  slowest op     0.33 ms\nscripts/25-demo.sh: line 17: 173416 Killed                  systemd-run --scope --quiet --slice=ddmemhigh.slice -p MemoryMax=256M $w\nexit status 137"
    },
    {
      "cmd": "systemd-run --scope -p MemoryHigh=241590272 -p MemoryMax=256M python3 -I scripts/lib/workload.py --kind anon --target-mib 320 --progress --max-seconds 30",
      "output": "pid 173417 in /sys/fs/cgroup/ddmemhigh.slice/run-rbd28bd3d399c47a9ab104c3b6d4b6eaf.scope, memory.high=241590272 memory.max=268435456\n   0.0s  held    0 MiB  memory.current    6.7 MiB  ops     1  slowest op     0.30 ms\n   1.0s  held  231 MiB  memory.current  238.2 MiB  ops   924  slowest op    79.86 ms\n   7.1s  held  231 MiB  memory.current  238.5 MiB  ops   926  slowest op  5488.05 ms\n  12.8s  held  231 MiB  memory.current  238.8 MiB  ops   927  slowest op  5759.67 ms\n  19.0s  held  232 MiB  memory.current  239.0 MiB  ops   928  slowest op  6135.79 ms\n  25.5s  held  232 MiB  memory.current  239.3 MiB  ops   929  slowest op  6511.84 ms\n  27.5s  held  232 MiB  memory.current  239.8 MiB  ops   930  slowest op  1992.06 ms\n  28.5s  held  234 MiB  memory.current  241.1 MiB  ops   936  slowest op   359.79 ms\n  29.6s  held  234 MiB  memory.current  241.9 MiB  ops   939  slowest op   759.73 ms\nend: time after 30.4s, 940 ops, held 235 MiB, memory.current 242.1 MiB\nexit status 0"
    }
  ]
}
```

The first process was killed before its second progress line, so in less than a second, with exit status 137. The second got 11.7 MiB past `memory.high` in 30 seconds, and its operations took 5.5 to 6.5 seconds each until they sped up near the end. The next section explains that change.

The `anon-fit` runs matter more, because nothing in them is wrong. The program needs 239 MiB, fits under its 256 MiB `memory.max`, and runs at full speed there. With `memory.high` at 230.4 MiB added, it held about 239 MiB and every churn operation slept. In the matrix, where it shared its CPU with our sampler, the median churn operation took 6,216 ms instead of 0.257 ms, and it finished 15 to 17 of its 200 churn operations before the 150 second cap. That is about 24,000 times slower per operation, with the same memory use and no error anywhere. On a CPU of its own it was about 750 times slower. The next section explains the difference. `memory.max` was never reached and its counter stayed at 0.

## How many sleeps: it depends on who else runs on the CPU

To compare with the kernel, we count sleeps. In the warm runs reclaim never freed anything, so each sleep raised the `high` counter by 17, and an operation's sleep count is its rise divided by 17. We skip operations whose rise is not a multiple of 17 (11 to 13 per run, all at the edge of the limit, where the formula gives 10 ms or less and the kernel does not sleep). Then the measured latency divided by (sleeps x formula) should be 1.

It was 1.06 to 1.10 at the median in every single-process matrix run, and 97% to 100% of the throttled operations were within 30% of the formula (`results/predict.md`, section 1). The formula is right about how long each sleep is. The section on the 2 second cap shows where part of the extra 6% to 10% comes from.

The number of sleeps was the surprise. The kernel charges memory in batches of 64 pages and keeps the rest of a batch as a per-CPU precharge (`consume_stock()`), so the code comment on the cap says "per allocation batch". A 64-page operation should sleep about once. In the matrix, once the sleeps were 50 ms or longer, almost every operation slept 64 times, once per page:

| Formula sleep length | Operations | Median sleeps per 64 pages | Operations with 64 or more |
| -------------------- | ---------- | -------------------------- | -------------------------- |
| 11 to 25 ms          | 83         | 2                          | 24%                        |
| 25 to 50 ms          | 95         | 7                          | 23%                        |
| 50 to 100 ms         | 228        | 64                         | 92%                        |
| 100 to 200 ms        | 73         | 64                         | 100%                       |
| 200 to 400 ms        | 22         | 64                         | 100%                       |
| 400 to 2000 ms       | 29         | 64                         | 100%                       |

A new charge, and so a new sleep, only happens when the precharge is empty. `__refill_stock()` empties a CPU's precharge when a different cgroup charges memory on that CPU. In review we found a cgroup that did exactly that in every run: our own driver. It pinned itself to CPU 0 before it started the workload, so every workload in the matrix inherited CPU 0 (the `cpu` field of every operation says 0). The driver woke up every 100 ms to sample and parsed the files into Python objects, which charges memory to the driver's own cgroup on that CPU. We did not trace each drain, but the runs below show the effect.

So we ran the 320 MiB `memory.high` workload again, 3 times each, with the workload on CPU 0 or CPU 2 and the sampler every 100 ms or every second (`results/diag`, 120 second cap):

| Workload CPU        | Sampler      | Median sleeps per op (formula sleep 50 ms or more) | Share of that time in ops with 32 or more sleeps | `memory.current` at the cap |
| ------------------- | ------------ | -------------------------------------------------- | ------------------------------------------------ | --------------------------- |
| 0, with the sampler | every 100 ms | 64                                                 | 100%                                             | 241.3 MiB                   |
| 0, with the sampler | every 1 s    | 2                                                  | 46%                                              | 248.8 to 249.8 MiB          |
| 2, alone            | every 100 ms | 1                                                  | 53%                                              | 250.0 to 252.0 MiB          |
| 2, alone            | every 1 s    | 1                                                  | 72%                                              | 243.5 to 252.4 MiB          |

With the sampler on the same CPU every 100 ms, the task slept once per page for the whole run, as in the matrix: a median of 64 sleeps per operation, and 100% of the throttled time in operations with 32 or more sleeps. In the other three settings the median operation slept once or twice. But within each run the count switched between phases of about 1 sleep per operation and phases of 64, each lasting tens of seconds, and the slow phases still took 46% to 72% of the throttled time (`results/predict.md`, section 1c). That is consistent with other memory activity on the host emptying the precharge in those phases, but we did not trace it. The demo session further down ran with no driver and no pinning at all, and it also paid 5.5 to 6.5 seconds per 256 KiB operation for 25 seconds before it sped up.

So our sampler was not the only cause of the per-page cost. With it on the same CPU, the cost was constant. Read the matrix numbers as a task whose CPU also runs another cgroup that allocates memory every 100 ms. On its own CPU, the same `anon-fit` workload with `memory.high` took a median of 191.8 ms per churn operation in all 3 runs (`diag-fit-high-cpu2-1s`), and finished all 200 churn operations in 2 of the 3 runs within 120 seconds. That is about 750 times the no-limit median, instead of about 24,000 times.

`MAP_POPULATE` is a second control. It faults in the whole chunk inside the `mmap()` call, so the task returns to user space once per chunk. On CPU 0 with the 100 ms sampler, it slept 2 times in 592 of 600 churn operations and 3 times in the other 8, a median churn operation took 191.8 ms, and all 200 churn operations were done in about 41 seconds (`anon-fit-high-populate`). How a program touches its memory changed the cost of the same `memory.high` by a factor of 32 here, with the same neighbour on the CPU.

## The 2 second cap

None of the runs above got far enough over `memory.high` to reach the cap, because the throttle slowed them first. So `anon-clamp-high` gets there another way: it grows to 300 MiB with no limit, then writes 241590272 to its own `memory.high`. Its usage of 307.2 MiB is then 33.3% over the limit. The formula then asks for a sleep of about 7,100 ms, and the kernel caps it. Each churn operation then allocates one 4 KiB page.

| Run                  | Over `memory.high` | Formula without the cap | Sleeps per operation | Time per sleep, median | min        | max        |
| -------------------- | ------------------ | ----------------------- | -------------------- | ---------------------- | ---------- | ---------- |
| `anon-clamp-high-r1` | 33.3%              | 7,106 ms                | 1, 2                 | 2,047.9 ms             | 2,047.3 ms | 2,064.9 ms |
| `anon-clamp-high-r2` | 33.3%              | 7,108 ms                | 1, 2                 | 2,047.9 ms             | 2,021.8 ms | 2,048.0 ms |
| `anon-clamp-high-r3` | 33.3%              | 7,107 ms                | 1, 2                 | 2,047.9 ms             | 2,011.7 ms | 2,047.9 ms |

The median sleep took 2,047.9 ms in all three runs, not 2,000 ms. The cap is 2000 jiffies, and at `HZ=1000` the kernel's timer wheel keeps timeouts from 512 ms to 4,095 ms in 64 ms steps (`kernel/time/timer.c`), so a 2,000 ms timeout fires at one of those steps. The median of 2,047.9 ms fits that. Single sleeps ranged from 2,011.7 to 2,064.9 ms, depending on where in a step the timer started. The same rounding, at 8 ms steps from 64 to 511 ms, explains part of the 6% to 10% we saw on the shorter sleeps: with half a step added, the median ratio for sleeps of 64 ms or more drops to 1.030 to 1.055 in the matrix runs. Under 64 ms, where the step is 1 ms, it stays at 1.054 to 1.091, and we did not find the rest (`results/predict.md`, section 1).

So the cap holds, but it is per sleep, not per allocation. In these runs each 4 KiB operation slept twice after the first one, so it took 4,096 ms. A 256 KiB allocation that sleeps once per page at the cap would take more than two minutes.

## Both limits: high at 90% of max

systemd's man page recommends both: "use `MemoryHigh=` as the main control mechanism and use `MemoryMax=` as the last line of defense". The idea is that the program slows down before it dies. The `anon-over-both` runs show what that looks like with our 230.4 MiB and 256 MiB:

```chart
{
  "type": "line",
  "unit": " MiB",
  "title": "memory.current from 10 s to 150 s, the workload asks for 320 MiB",
  "x": ["10s", "20s", "30s", "40s", "50s", "60s", "70s", "80s", "90s", "100s", "110s", "120s", "130s", "140s", "150s"],
  "series": [
    {"name": "memory.high only, 1 process", "data": [237.3, 237.9, 238.4, 238.8, 239.2, 239.6, 239.9, 240.2, 240.5, 240.8, 241.1, 241.4, 241.6, 241.8, 242.1], "color": "#f59e0b"},
    {"name": "memory.high only, 4 processes", "data": [242.3, 243.4, 244.5, 245.6, 246.1, 246.6, 247.1, 247.5, 247.9, 248.3, 248.7, 249.1, 249.4, 249.8, 250.1], "color": "#a855f7"},
    {"name": "memory.high + memory.max", "data": [236.8, 237.5, 238.0, 238.5, 238.9, 239.3, 239.7, 240.0, 240.3, 240.6, 240.9, 241.2, 241.4, 241.7, 241.9], "color": "#0080ff"}
  ],
  "refs": [
    {"value": 230.4, "label": "memory.high"},
    {"value": 256, "label": "memory.max", "color": "#ef4444"}
  ],
  "caption": "Median of 3 repetitions at each 10 s mark, sampled from outside the cgroup every 100 ms. memory.max only reaches 256 MiB and is killed in under 2 s, so it is not drawn. Source: results/runs/anon-over-*/samples.jsonl."
}
```

Within the 150 second cap, `memory.high` plus `memory.max` behaved like `memory.high` alone, because the process did not get near `memory.max`. After 150 seconds all three runs were at 241.7 to 242.0 MiB, 14 MiB under the kill. The growth rate fits the model of one sleep per page: 4 KiB per sleep, at the formula's sleep length for the current usage, predicts 24.7 to 26.1 KiB/s at the end of the runs, and we measured 26.6 to 28.0 KiB/s over the last 60 seconds (`results/predict.md`, section 5).

To see when the kill comes, we ran the same workload once more with a 45 minute cap (`anon-over-both-long`, one run, the same setup as the matrix, so on CPU 0 next to the sampler). The kernel killed it after 1,747.7 seconds, 29.1 minutes:

```chart
{
  "type": "line",
  "unit": " MiB",
  "title": "memory.high at 90% of memory.max: the climb to the OOM kill",
  "x": ["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "10m", "11m", "12m", "13m", "14m", "15m", "16m", "17m", "18m", "19m", "20m", "21m", "22m", "23m", "24m", "25m", "26m", "27m", "28m", "29m"],
  "series": [
    {"name": "memory.current", "data": [239.7, 241.4, 242.8, 243.9, 244.8, 245.7, 246.4, 247.1, 247.8, 248.4, 248.9, 249.5, 250.0, 250.5, 250.9, 251.3, 251.7, 252.1, 252.5, 252.8, 253.2, 253.5, 253.9, 254.2, 254.5, 254.8, 255.1, 255.4, 255.7], "color": "#f59e0b"}
  ],
  "refs": [
    {"value": 230.4, "label": "memory.high"},
    {"value": 256, "label": "memory.max", "color": "#ef4444"}
  ],
  "caption": "One run, sampled every 100 ms, one point a minute. Source: results/runs/anon-over-both-long-r1/samples.jsonl."
}
```

In those 29 minutes the process used 1.19 seconds of CPU, its memory pressure `some` covered 1,742 seconds, and its slowest 256 KiB allocation took 53.2 seconds. From the point where the sleep starts (233.4 MiB, 0.3 seconds in), the formula with one sleep per page predicts 1,720 seconds to reach `memory.max`, 1.6% less than we measured. With one sleep per 64 pages it would have been 27 seconds (`results/predict.md`, section 3). Then the OOM kill came with 35 `max` events, as in the `memory.max` runs. `memory.high` did not save the program. It delayed the same OOM kill by half an hour.

On a CPU of its own (`diag-over-both-cpu2-1s`, 3 runs, 120 second cap), the same workload was not killed within the cap either. It reached 240.8 to 254.4 MiB, depending on how much of the run fell into the one-sleep-per-page phases. So we have two reference points, not a proven range: the formula's 27 seconds if every sleep covers 64 pages, and the 29.1 minutes we measured once next to the sampler.

## The throttle is per process

`memory.high` puts each allocating task to sleep on its own. In the matrix, the four processes of `anon-over-4p-high` all ran on CPU 0 next to the sampler. We cannot split `memory.events` per process, but their combined growth matches the model of one sleep per page for each process: about four times as fast as one process at the same overage. In `anon-over-4p-high` the four processes reached 249.1 to 250.8 MiB in 150 seconds, against 241.5 to 242.2 MiB for one process. Over the last 60 seconds they grew 34.0 to 42.3 KiB/s, where the one-sleep-per-page model predicts 31.9 to 38.0 KiB/s for four processes at that usage. A program with many allocating worker processes gets to `memory.max` sooner than a single process.

The four throttled processes also changed a number most dashboards show. While they slept, the host's load average was 5.33 on 4 vCPUs, and `vmstat` showed the CPUs 96% and 99% idle in the two one-second samples:

```terminal
{
  "title": "results/observed/loadavg-during-4p-high.txt",
  "prompt": "$",
  "steps": [
    {
      "comment": "recorded during anon-over-4p-high-r1: ps, vmstat 1 3, /proc/loadavg, nproc"
    },
    {
      "cmd": "cat results/observed/loadavg-during-4p-high.txt",
      "output": "# 2026-11-05T11:39:12Z during anon-over-4p-high-r1 (ps, vmstat 1 3, /proc/loadavg)\n 146187 D    mem_cgroup_handle_over_high       0.2 /usr/bin/python3.12 -I /root/dd-memory-high/scripts/lib/wor\n 146188 D    mem_cgroup_handle_over_high       0.2 /usr/bin/python3.12 -I /root/dd-memory-high/scripts/lib/wor\n 146189 D    mem_cgroup_handle_over_high       0.2 /usr/bin/python3.12 -I /root/dd-memory-high/scripts/lib/wor\n 146190 D    mem_cgroup_handle_over_high       0.2 /usr/bin/python3.12 -I /root/dd-memory-high/scripts/lib/wor\nprocs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------\n r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu\n 0  0      0 1407320  32980 5042700    0    0   835   650  876    2  4  1 94  0  1  0\n 0  0      0 1410512  32980 5042720    0    0     0     0 1627 1417  2  3 96  0  0  0\n 0  0      0 1413104  32980 5042736    0    0     0    28  621  787  1  0 99  0  0  0\n5.33 3.56 2.27 1/347 147320\n4"
    }
  ]
}
```

The kernel puts the task to sleep with `schedule_timeout_killable()`. That is a killable sleep: only a fatal signal ends it early. `ps` shows it as state `D`, and Linux counts it in the load average like other tasks in state `D`. A high load average with idle CPUs can mean throttled memory, not only slow disks.

## When the cgroup holds its own code, both limits thrash

So far the interpreter's code pages were in the page cache before each run started, charged to a different cgroup. That is the `warm` setup, and it is the reason the runs above had nothing to reclaim. A container on its first start is different: its binary and libraries are read from its image after it starts, so the page cache for its own code is charged to its own cgroup. The `owncode` runs copy the interpreter binary to a new file, drop it from the page cache (`mincore()` found 0 of its pages cached before each run), and run that copy, so the binary is read inside the run cgroup.

That gives the kernel something to reclaim, and it changes both limits:

| Run (20 s cap)                          | Outcome                     | `memory.current`   | Pages reclaimed    | Read from disk    | PSI memory `some` | PSI io `some`  |
| --------------------------------------- | --------------------------- | ------------------ | ------------------ | ----------------- | ----------------- | -------------- |
| `memory.high` only, 232 MiB target      | not killed in 20 s (3 of 3) | 230.4 MiB          | 591,486 to 617,906 | 2,426 to 2,535 MB | 11.4 to 11.9 s    | 19.9 to 21.2 s |
| both, 320 MiB target                    | not killed in 20 s (3 of 3) | 230.2 to 230.4 MiB | 633,090 to 634,192 | 2,593 to 2,598 MB | 12.4 to 14.3 s    | 21.3 to 21.5 s |
| `memory.max` only, 320 MiB target       | not killed in 20 s (3 of 3) | 255.9 MiB          | 631,197 to 633,258 | 2,585 to 2,594 MB | 1.9 to 2.1 s      | 21.3 to 21.7 s |
| `memory.max` only, uncapped disk, 1 run | not killed in 20 s (1 of 1) | 256.0 MiB          | 2,559,211          | 10,483 MB         | 6.2 s             | 13.6 s         |

Under `memory.high`, reclaim kept succeeding, and what it took was the program's own code. The task faulted it back in from disk, reclaim took it again, and so on. Because reclaim kept freeing pages, the kernel's retry loop never got to the sleep (`if (nr_reclaimed || nr_retries--)` retries as long as anything was freed). The sampler never found the process in `mem_cgroup_handle_over_high`, and only 1 of the 108 operations that raised the `high` counter raised it by a multiple of 17. The process sat at 230.2 to 230.4 MiB, right at `memory.high`. In 54% to 90% of the samples it was in `folio_wait_bit_common`, waiting for its code to come back from disk, and in the rest it was running. It never finished its grow phase.

Under `memory.max` alone, the same thing replaced the OOM kill. The charge path only calls the OOM killer after 16 tries in which reclaim freed nothing, and here reclaim kept finding code pages to free. The process held 255.9 MiB and was not killed in any of the three 20 second runs. `memory.events` counted 19,140 to 20,019 `max` events per run, and no OOM. On the uncapped disk, it read 10,483 MB in 25 seconds and was not killed either. In an earlier smoke run with the same setup (older code, in `results/_smoke5`), the kernel did kill it, 21.7 seconds after it started. So the kill does come in some runs, after a period of thrashing we could not predict. In another smoke run on the uncapped disk (`results/_smoke3`) it was still thrashing at 70 seconds when our driver stopped it.

Memory PSI under-counts this. In the `memory.max` runs with the 100 MiB/s cap, memory `some` was 1.9 to 2.1 seconds out of 25, about 8%, while io `some` was 21.3 to 21.7 seconds. The kernel counts a wait for a page read as a memory stall only when the page carries the workingset flag (`folio_wait_bit_common()` in `mm/filemap.c`), and most of this time went to the disk. A pressure-based killer that watches memory pressure alone would not see this as clearly as the warm `memory.high` runs, where memory `some` was 99%.

## Page cache: neither limit throttles or kills

The `file-over` runs read 320 MiB of a file in 256 KiB reads, then read random chunks of it. That is page cache, which the kernel can drop and read again. None of the 12 runs was killed or throttled:

| Run                | Outcome             | Peak MiB | Pages reclaimed  | PSI memory `some` | p99 per read    |
| ------------------ | ------------------- | -------- | ---------------- | ----------------- | --------------- |
| no limit           | not killed (3 of 3) | 327.7    | 0                | 0.00 s            | 82.1 to 86.5 ms |
| `memory.max` only  | not killed (3 of 3) | 256.0    | 20,608 to 21,440 | 0.02 s            | 83.4 to 88.6 ms |
| `memory.high` only | not killed (3 of 3) | 230.9    | 28,352 to 28,864 | 0.03 s            | 85.0 to 87.5 ms |
| both               | not killed (3 of 3) | 230.9    | 28,352 to 28,864 | 0.02 to 0.03 s    | 82.9 to 89.9 ms |

Both limits did what the docs say: `memory.current` stopped at the limit and the kernel reclaimed file pages to stay there. `memory.events` counted 416 to 430 `high` events and 322 to 335 `max` events per run. Every `high` event was a single reclaim pass with no sleep: the rise per operation was 1 or 2, never 17, because each pass freed enough to get back under the limit. The p99 of 82 to 90 ms is the same with no limit, so it is not the memory limits. The slow reads are in the first pass over the file, read from disk under our 100 MiB/s cap. The limits did cost something later: in the last 10% of operations, random reads that had to go back to disk gave a p99 of 1.0 to 2.6 ms, against 0.13 ms with no limit, where the whole file stayed cached. For a cache-heavy program without swap, both limits are a cache size, not a throttle and not a kill.

## What PSI and the counters show

PSI was a reliable witness for the warm throttle. In every warm single-process matrix run with `memory.high`, the cgroup's `memory.pressure` `some` total matched the time the operations spent over their normal latency, at a ratio of 0.998 to 1.068 (`results/predict.md`, section 4). In the diagnostic runs it was 0.997 to 1.286. PSI also counts the last operation, which was still asleep when the driver stopped the run, and our operation log does not, so the ratio goes above 1 in runs that ended in the middle of a long operation. With one task in the cgroup, `full` was the same as `some`, and `avg10` reached 97% to 99%. The host saw it too. During the long run, the host-wide `/proc/pressure/memory` read `some avg10=96.53` and `full avg10=95.09` (`results/observed/host-psi-during-long.txt`). Our test cgroup was the one we know was stalled, and the host-wide number was almost as high, so an alert on host memory pressure would fire.

The counters to watch, from these runs:

- `memory.events` `high` rising: the cgroup is over `memory.high`. 17 per sleep when nothing is reclaimable.
- `memory.events` `max` rising without `oom_kill`: the cgroup is at `memory.max` and reclaim keeps finding something. In the own-code runs that meant thrashing.
- `memory.stat` `pgsteal` and `workingset_refault_file` rising together: the cgroup reclaims pages and reads them straight back.
- `memory.pressure` `some` near 100% with almost no CPU use and state `D`: throttled by `memory.high`.
- `io.pressure` high while `memory.pressure` is low, in a cgroup at its memory limit: thrashing on file pages.

## What systemd, Docker and Kubernetes write

### systemd

systemd maps its properties one to one. We started transient scopes with each property and read the files back from inside (`results/10-systemd-map.txt`, systemd 255):

| Property               | File          | Value we set | Value in the file |
| ---------------------- | ------------- | ------------ | ----------------- |
| `MemoryMin=16M`        | `memory.min`  | 16M          | 16777216          |
| `MemoryLow=64M`        | `memory.low`  | 64M          | 67108864          |
| `MemoryHigh=241590272` | `memory.high` | 241590272    | 241590272         |
| `MemoryMax=256M`       | `memory.max`  | 256M         | 268435456         |
| `MemoryHigh=3%`        | `memory.high` | 3% of RAM    | 249806848         |

A property you do not set stays at the kernel default: `max` for `memory.high` and `memory.max`, 0 for `memory.min` and `memory.low`. `memory.oom.group` stayed 0 in every scope.

The systemd 255 man page says `MemoryHigh=` is "the main mechanism to control memory usage of a unit", and it recommends `MemoryMax=` "as the last line of defense". On a host with swap, the kernel can move cold anonymous pages out and hold the unit near the limit. We did not test that. Without swap, our runs show what "main mechanism" means: the unit does not stop at the limit, it slows down, and with `MemoryHigh=` alone the kernel never kills it.

`MemoryMin=` and `MemoryLow=` are the other direction. They protect a unit's memory from reclaim when something else needs it. They do not limit or slow the unit itself.

### Docker

Docker 29.9.3 has no flag for `memory.high`. `docker run --help` on the test host lists `--memory`, `--memory-reservation`, `--memory-swap`, `--memory-swappiness`, `--oom-kill-disable` and `--oom-score-adj` (`results/00-host.txt`). We followed the two memory flags through the source (`results/01-source-check.txt`):

- Docker puts `--memory` into the OCI spec as `memory.limit` and `--memory-reservation` as `memory.reservation` (`getMemoryResources` in moby `daemon/daemon_unix.go`, docker-v29.9.3).
- runc 1.5.2, the host's runtime, writes the limit to `memory.max` and the reservation to `memory.low` on cgroup v2 (`fs2/memory.go`). With the systemd cgroup driver it sets the `MemoryMax` and `MemoryLow` properties (`systemd/v2.go`).

So on cgroup v2, `--memory` is a hard limit and `--memory-reservation` is reclaim protection. The Docker docs call `--memory-reservation` "a soft limit smaller than `--memory` which is activated when Docker detects contention or low memory on the host machine." That wording comes from cgroup v1's soft limit. On v2 it is `memory.low`: it does not slow the container down at any size.

runc does accept `memory.high` through the OCI spec's `unified` map, and passes it on as the systemd `MemoryHigh` property. That is the path the kubelet uses. The Docker CLI does not expose it, so with plain `docker run` you only get the `memory.max` behaviour.

### Kubernetes MemoryQoS

The kubelet sets `memory.max` from `limits.memory` on cgroup v2 in every version. `memory.high` is a separate feature, **MemoryQoS** ([KEP-2570](https://github.com/kubernetes/enhancements/tree/master/keps/sig-node/2570-memory-qos)), and its status changed in the last two releases. All of this is from `results/01-source-check.txt`:

|                                   | Kubernetes 1.36 (v1.36.6)                   | Kubernetes 1.37 (v1.37.2)               |
| --------------------------------- | ------------------------------------------- | --------------------------------------- |
| `MemoryQoS` feature gate          | alpha, off by default                       | beta, on by default                     |
| `memoryThrottlingFactor` default  | 0.9                                         | nil: no `memory.high` unless you set it |
| `memoryReservationPolicy` default | `None`: `memory.min` and `memory.low` are 0 | `None`                                  |

With the gate on and a factor set, the kubelet computes, for each container whose memory request differs from its limit:

```text
memory.high = floor((requests.memory + factor * (limits.memory - requests.memory)) / pageSize) * pageSize
```

With no limit, it uses node allocatable memory instead of `limits.memory`. It puts the value in the CRI container config's `unified` map under the key `memory.high` (`kuberuntime_container_linux.go`), and the runtime writes it to the container's cgroup. runc passes a unified `memory.high` on as the systemd `MemoryHigh` property when it uses the systemd driver. In 1.36, a container whose memory request equals its limit gets no `memory.high`. 1.37 makes one exception: a container with no request and no limit can still get one when a factor is set.

Our `memory.high` value is this formula for `limits.memory: 256Mi`, `requests.memory: 0` and factor 0.9: 241590272 bytes. Two details matter here. If a pod sets a limit and leaves the request out, the API server sets the request equal to the limit (`SetDefaults_Pod` in `pkg/apis/core/v1/defaults.go`), and the kubelet then writes no `memory.high` at all. And with a request R between 0 and the limit, `memory.high` is R + 0.9 x (256Mi - R), so it sits between 230.4 MiB and 256 MiB. Our runs are the strictest case: a Burstable container with an explicit zero memory request on a 1.36 node with the MemoryQoS gate turned on. The `anon-fit` rows are the ones to read for that.

The KEP explains why it took so long. The 1.28 beta was cancelled because a workload "stays stuck indefinitely" at `memory.high`, and the KEP says kernel 5.9 fixed that livelock. On 6.8 our warm runs did make progress, slowly. The own-code runs barely did. The 1.37 beta turns the gate on but leaves `memoryThrottlingFactor` unset, so upgrading does not add `memory.high` to any container. If you set the factor to 0.9, you opt into the `both` rows above.

The two Kubernetes posts this week cover the other side of the same cgroups: [an empty `resources: {}` makes pods BestEffort](/posts/kubernetes-empty-pod-resources-besteffort) on 1.34 to 1.36 and changes their `oom_score_adj` and cgroup slice, and [the 1.37 review](/posts/kubernetes-1-37-garhwal-what-shipped) lists what else moved in that release.

## What we could not conclude

- **One host, one kernel, no swap.** Everything here is Ubuntu 6.8.0-147 on a 4 vCPU machine with no swap. With swap or zswap, reclaim can move anonymous pages out, so `memory.high` can hold a cgroup near the limit instead of only slowing it, and `memory.max` reaches the OOM killer later. We did not test that. Newer kernels have changed the memcg charge code, and we did not test them either.
- **What empties the precharge.** We measured how many sleeps a task paid, and we read in the source what makes a new charge necessary. We did not trace which event emptied the per-CPU precharge each time. Our sampler on the same CPU made it happen on almost every long sleep. Without it, the phases came and went with the host's other work, which we did not control. An idle machine, or one with more CPUs, could pay fewer sleeps.
- **The rest of the extra per sleep.** The timer wheel's rounding explains about half of the 6% to 10%. We did not split the rest into reclaim time, wake-up delay and our own probes.
- **When the own-code thrash ends.** Under `memory.max` it was not killed in 20 seconds in the matrix (one smoke run was killed at 21.7 seconds, another was still running at 70). We stopped these runs early because they read about 100 MB/s from a shared disk, so we cannot say how long a real container would thrash before the kill. The result also depends on disk speed, which we changed with `io.max`.
- **Run order and a shared host.** Every repetition ran the configurations in the same order, on a machine with other services. Background load can move a single run either way. The three repetitions agree closely, but we did not randomize the order.
- **Real programs.** Our workload is a Python loop that touches memory in a fixed pattern. A JVM, a Go program or a database touches memory differently, and the `MAP_POPULATE` run shows that the touch pattern alone changed the cost 32 times.
- **The 4-process numbers per operation.** `memory.events` counts the whole cgroup, so in the 4-process run one operation's rise in `high` includes the other processes' sleeps. We used that run only for growth, not for sleeps per operation.
- **Kubernetes on a real node.** We wrote the same `memory.high` value the kubelet would write, but we did not run a kubelet. The Kubernetes section is from the source at v1.36.6 and v1.37.2.

## What to do with this

- **Without swap, do not use `memory.high` as the only limit.** It does not stop growth. It slows new allocations, and a program that keeps allocating stays slow as long as it stays over the limit. The kernel never kills it for `memory.high`, so add `memory.max` or a pressure-based killer.
- **If you set both, leave room.** With `memory.high` at 90% of `memory.max`, a program that fits between the two ran about 750 times slower per allocation on a CPU apart from our sampler, and about 24,000 times slower next to it. Apart from the sampler it finished in 2 of 3 runs within 120 seconds; next to it, none finished within 150 seconds. Measure your program's peak first. Put `memory.high` above the normal working set, not at a fixed fraction of the limit.
- **Do not plan with the formula alone.** It gives the length of one sleep. How many sleeps a task pays depends on what else allocates memory on the same CPU, by up to 64 times, so test on a host that is as busy as production.
- **Read `memory.events` and `memory.pressure`, not only `memory.current`.** A throttled cgroup looks healthy by memory use: it sits a few MiB over its limit and uses no CPU. The `high` counter and memory `some` near 100% show it at once.
- **Watch `io.pressure` and `pgsteal` on cgroups at their limit.** Thrashing on a program's own code showed up there, not in memory pressure.
- **On Kubernetes 1.37, MemoryQoS is on but does not throttle until you set `memoryThrottlingFactor`.** If you set it, test your Burstable pods whose usage sits between the factor and the limit.

The scripts, the raw output of every run, and the claim we wrote before the first run are in the repository above.
