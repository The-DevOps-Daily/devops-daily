---
title: 'Docker Desktop Switched New Containers to the local Log Driver. We Measured What That Changes'
excerpt: 'Docker Desktop 4.94 made local the default log driver for new Linux containers, while Docker Engine on your servers still uses json-file with no rotation. We wrote the same 500,000 lines through both. local kept every line in 24 MB where json-file used 84 MB. A file-tailing collector read none of them.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2026-10-09'
publishedAt: '2026-10-09T09:00:00Z'
updatedAt: '2026-10-09T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Docker
  - Logging
  - Docker Desktop
  - Fluent Bit
  - Observability
  - DevOps
---

Docker Desktop 4.94.0 came out on October 5. One line in its [release notes](https://docs.docker.com/desktop/release-notes/) changes where your container logs go: "Changed the default logging driver for new Linux containers to `local` to enable automatic log rotation and reduce disk usage." Docker Engine, which runs on your servers, did not change. It still writes `json-file` logs, and by default it never rotates them.

So your laptop and your servers now store logs in two different formats. Most of the time you will not notice, because `docker logs` reads both. You will notice if something reads the log files directly, such as a collector that tails `/var/lib/docker/containers/*/*.log`. We wrote the same log lines through both drivers on Docker Engine 29.9.0 and recorded what each one stores, what `docker logs` gives back, and what a file-tailing collector reads.

## TLDR

- Docker Desktop 4.94 uses `local` for new Linux containers. Docker Engine still defaults to `json-file` with `max-size` unlimited, and Docker's docs say that is only for backward compatibility.
- 500,000 log lines (47.9 MB of text) took 83.8 MB with `json-file` and no options. `local` kept all 500,000 lines in 24.1 MB. `json-file` capped at 10 MB x 3 used 23.8 MB, but kept only 142,146 lines.
- `docker logs` returned all 500,000 lines from the uncapped `json-file` container and from the `local` one.
- Fluent Bit's `tail` input, set up the usual way for a Docker host, read 500,000 records from the `json-file` container and 0 from the `local` one. Pointed at the `local` file directly, it read binary framing that the docker parser could not parse.
- A changed default only reaches containers created after the change. Existing containers keep `json-file` until you recreate them.

## Prerequisites

- Docker Engine or Docker Desktop, and `docker info` access
- `sudo` on a Linux Docker host, if you want to look at the log files yourself
- Optional: the [demo repo](https://github.com/The-DevOps-Daily/docker-log-driver-check), which runs every test in this post

## What changed, and what did not

Docker has always written container output to files on the host, in a format chosen by the log driver. The default has been `json-file` since the early days: one JSON object per line, with the text, the stream and a timestamp. Its [documentation](https://docs.docker.com/engine/logging/drivers/json-file/) gives `max-size` a default of `-1`, which means unlimited, so one noisy container can fill the disk. The [logging overview](https://docs.docker.com/engine/logging/configure/) says Docker keeps `json-file` without rotation as the default "to remain backwards compatible with older versions of Docker", and recommends `local` for other cases because "it performs log-rotation by default, and uses a more efficient file format."

The [`local` driver](https://docs.docker.com/engine/logging/drivers/local/) keeps 5 files of 20 MB each per container, so 100 MB of log text, and compresses the files it rotates out. Docker Desktop 4.94 now uses it for new Linux containers. Docker Engine 29.9.0, the newest Engine release when we tested, still reports `json-file`:

```terminal
{
  "title": "Docker Engine 29.9.0 on Linux",
  "prompt": "$",
  "steps": [
    { "cmd": "docker version --format 'docker client {{.Client.Version}}, engine {{.Server.Version}}'", "output": "docker client 29.9.0, engine 29.9.0" },
    { "cmd": "docker info --format '{{.LoggingDriver}}'", "output": "json-file" }
  ]
}
```

We could not run Docker Desktop on our test machine. The Desktop behaviour in this post comes from its release notes. Every measurement comes from Docker Engine 29.9.0 with the same two drivers. The output above is from a daemon with no logging settings (`runs/.../00-default.txt`).

## The test

The [demo repo](https://github.com/The-DevOps-Daily/docker-log-driver-check) starts three containers that each print the same 500,000 lines, about 96 bytes each, shaped like access logs:

- `logs-json-default`: `json-file` with no options, which is what Docker Engine does out of the box
- `logs-json-capped`: `json-file` with `max-size=10m` and `max-file=3`, a common hand-made fix
- `logs-local`: `local` with its defaults, which is what Docker Desktop 4.94 now does

Then it measures the files each driver wrote, counts what `docker logs` returns, and runs a real collector against the files. We ran it on a Raspberry Pi 4 (arm64) with Docker Engine 29.9.0 and Fluent Bit 5.1.3. The outputs below come from `runs/2026-10-09-engine-29.9.0/` in the repo.

```terminal
{
  "title": "Same 500,000 lines, three setups (excerpt)",
  "prompt": "$",
  "steps": [
    { "cmd": "LINES=500000 ./scripts/01-write-logs.sh", "output": "logs-json-default: driver=json-file options={}\nlogs-json-capped: driver=json-file options={\"max-file\":\"3\",\"max-size\":\"10m\"}\nlogs-local: driver=local options={}" },
    { "cmd": "./scripts/02-measure.sh", "output": "container          driver       file_bytes  files   lines_kept  bytes_of_text\nlogs-json-default  json-file      83833258      1       500000       47888900\nlogs-json-capped   json-file      23833155      3       142146       13614435\nlogs-local         local          24134700      3       500000       47888900" },
    { "comment": "the file listings and byte dumps that follow are in 02-measure.txt" }
  ]
}
```

```chart
{
  "type": "bar",
  "title": "Size of the log files for the same 500,000 lines",
  "unit": "MB",
  "caption": "Docker Engine 29.9.0, 500,000 lines of about 96 bytes (47.9 MB of text). json-file with no options kept all 500,000 lines, json-file capped at 10 MB x 3 kept 142,146, local kept all 500,000. These lines repeat a lot; compression depends on your log content.",
  "rows": [
    { "label": "json-file, no options", "value": 83.8, "series": "json-file" },
    { "label": "json-file, 10m x 3", "value": 23.8, "series": "json-file" },
    { "label": "local, defaults", "value": 24.1, "series": "local" }
  ],
  "series": [
    { "name": "json-file", "color": "#0db7ed" },
    { "name": "local", "color": "#f59e0b" }
  ]
}
```

Three things stand out:

1. **`json-file` costs more than the text.** 47.9 MB of text took 83.8 MB of files, 1.75 times the text, because every line is wrapped in `{"log":...,"stream":...,"time":...}`. That is about 72 extra bytes per line here. With no `max-size`, the file only grows.
2. **Our size cap on `json-file` threw data away.** The capped container used 23.8 MB and `docker logs` returned only 142,146 of the 500,000 lines. The rest rotated out.
3. **`local` kept everything in about the same space.** It used 24.1 MB and returned all 500,000 lines. The current file was 19.4 MB, uncompressed, framing included. Each of the two rotated files was about 2.3 MB after gzip, and the driver rotates a file at 20 MB before compression.

The two capped setups do not have the same budget. `json-file` at 10 MB x 3 allows 30 MB. `local` allows 5 files of 20 MB each before compression, framing included, and it also drops its oldest lines when it reaches that limit. A container that writes more than about 100 MB of log records loses lines with either driver. These lines repeat a lot, so they compressed well; how well your logs compress depends on their content.

## The file format is what changes

`docker logs` returned all 500,000 lines from both uncapped containers, because it reads through the Docker daemon. The files on disk are a different story. Here are the first bytes of each file, from the same run:

```terminal
{
  "title": "First bytes of each driver's file, from 02-measure.txt (first 3 of 6 od lines)",
  "prompt": "$",
  "steps": [
    { "comment": "json-file: <container-id>/<container-id>-json.log" },
    { "output": "0000000   {   \"   l   o   g   \"   :   \"   2   0   2   6   -   1   0   -\n0000020   0   9   T   1   0   :   0   0   :   0   0   .   0   0   0   0\n0000040   0   1   Z       l   e   v   e   l   =   i   n   f   o       m" },
    { "comment": "local: <container-id>/local-logs/container.log" },
    { "output": "0000000  \\0  \\0  \\0   s  \\n 006   s   t   d   o   u   t 020 205 330 232\n0000020 342 244 221 265 356 030 032   _   2   0   2   6   -   1   0   -\n0000040   0   9   T   1   0   :   0   0   :   0   0   .   3   4   1   6" }
  ]
}
```

`json-file` writes one JSON object per line, in a file named `<id>-json.log` in the container's directory. `local` writes length-prefixed binary records in a `local-logs/` subdirectory, named `container.log`, and the rotated files end in `.gz`. Docker's [docs](https://docs.docker.com/engine/logging/drivers/local/) say these files "are designed to be exclusively accessed by the Docker daemon", and that reading them with external tools "should be avoided".

## What a file-tailing collector sees

Many Docker hosts ship logs with an agent that tails the files. We ran Fluent Bit 5.1.3 with its `tail` input and the `docker` parser on each container's `*.log` files, the usual setup for a Docker host:

```terminal
{
  "title": "Fluent Bit tail input, docker parser (excerpt)",
  "prompt": "$",
  "steps": [
    { "cmd": "./scripts/03-collector.sh", "output": "Fluent Bit: Fluent Bit v5.1.3\n\n== the usual Docker host pattern: <container dir>/*.log, docker parser\nlogs-json-default  records read: 500000\nlogs-json-capped   records read: 22860\nlogs-local         records read: 0\n\n== aimed at the local driver's own file: local-logs/container.log\nrecords read: 158382\nrecords the docker parser could parse: 0" },
    { "comment": "two sample records follow; the first 20 are in 03-local-raw-head.txt" }
  ]
}
```

The `json-file` container gave all 500,000 records. For the `local` container the counter reported 0, because `*.log` in the container directory does not match `local-logs/container.log`. When we pointed Fluent Bit at that file directly, it read 158,382 records and the parser understood none of them. The tail input splits on newline bytes, which this binary format also uses inside its framing, so the records are fragments: the first one holds only a length byte, and the others hold one message each with binary framing around it, in the form `^Fstdout^P...` (shown with `cat -v`). It also left out the two rotated `.gz` files.

The capped container's 22,860 is a side effect of the test. Fluent Bit started after the container had finished, so it found only the current `-json.log` file. A collector that runs all the time can read lines before they rotate, but this run did not test that.

What this means for other collectors depends on how they read:

- **Collectors that read through the Docker daemon** should keep working, because the daemon reads the `local` format for them, as it does for `docker logs`. Grafana Alloy's [`loki.source.docker`](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.source.docker/) "reads log entries from Docker containers" through the daemon address you give it. Vector's [`docker_logs`](https://vector.dev/docs/reference/configuration/sources/docker_logs/) source connects to `docker_host`. We did not test either of them with `local`.
- **Collectors that parse the files as Docker JSON** cannot decode `local`. Fluent Bit's `tail` input with the docker parser is one, as measured above. Filebeat's [container input](https://www.elastic.co/docs/reference/beats/filebeat/filebeat-input-container) reads files and parses the `docker` and `cri` formats, and the `local` format is neither. That input is deprecated, and Filebeat's docs say to use the `filestream` input with its `container` parser instead.

We tested Fluent Bit only. For the others, the docs above are our source, so test your own agent before you depend on this.

## Existing containers keep their driver

The log driver is set when a container is created. Docker's [docs](https://docs.docker.com/engine/logging/configure/) say that changing the default "only affects containers that are created after the configuration is changed". We checked it: we created a container, restarted the daemon with `local` as the default, then created a second one and restarted the first.

```terminal
{
  "title": "Changing the daemon default",
  "prompt": "$",
  "steps": [
    { "cmd": "./scripts/04-default-change.sh before", "output": "== before: daemon default is json-file\nlogs-before: json-file" },
    { "comment": "restart dockerd with --log-driver local" },
    { "cmd": "./scripts/04-default-change.sh after", "output": "== after: daemon default is local\nlogs-before (created before, started again now): json-file\nlogs-after  (created after): local" }
  ]
}
```

We tested this on Engine, not on a Desktop upgrade, but the rule is the same. On a laptop that you upgrade to 4.94, the containers you already have keep the driver they were created with. A container that you remove and run again, or that Compose recreates, gets the new default, unless its configuration names a driver. For a while, one machine can have both formats side by side.

## What to do

Check which driver each container actually has, not only the default:

```bash
# The daemon default
docker info --format '{{.LoggingDriver}}'

# The driver of every container, running or not
docker ps -aq | xargs docker inspect --format '{{.Name}} {{.HostConfig.LogConfig.Type}}'
```

**On servers running Docker Engine**, the risk is the old one: `json-file` with no limit. Pick a default in `/etc/docker/daemon.json`. Use `local` if your collectors read through the Docker API:

```json
{
  "log-driver": "local"
}
```

Or keep `json-file` for a file-tailing collector and give it a limit:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Restart the daemon, then recreate the containers so that they pick up the setting. As the measurements show, a size cap on `json-file` means the oldest lines are gone from disk. That is fine if a collector has already shipped them, and a loss if it has not.

**On Docker Desktop**, you probably need to do nothing. `docker logs` works with both drivers, and tools that use the same API should too. If you run a file-tailing collector on your laptop, set `"log-driver": "json-file"` in Docker Desktop's daemon settings, or move the collector to a source that reads through the Docker API. We could not see where 4.94 sets its new default, so run the `docker info` check above after the upgrade.

**In Compose files**, set the driver for each service if a service depends on it, so the laptop and the server do the same thing:

```yaml
services:
  api:
    image: example/api:1.4
    logging:
      driver: json-file
      options:
        max-size: '10m'
        max-file: '3'
```

To clear logs that already fill a disk, see [How to Clear Docker Container Logs Properly](/posts/how-to-clear-docker-container-logs-properly).

```github
https://github.com/The-DevOps-Daily/docker-log-driver-check
```

## Summary

Docker Desktop 4.94 moved new Linux containers to the `local` log driver. That is the driver Docker's own docs recommend, and in our test it kept all 500,000 lines in 24 MB of files where unbounded `json-file` used 84 MB. Docker Engine on servers still defaults to `json-file` with no rotation, so set a default on purpose. If something reads the files under `/var/lib/docker/containers`, it needs `json-file`. If it reads through the Docker API, `local` is the better default for both laptops and servers. In both cases, check `docker inspect`, because a new default does nothing for containers that already exist.
