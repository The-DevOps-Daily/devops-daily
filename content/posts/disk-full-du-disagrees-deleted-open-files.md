---
title: 'Disk Full but du Disagrees: Finding Deleted Files That Still Use Space'
excerpt: 'When df reports a full filesystem but du cannot find the bytes, an unlinked log held open by a process is often the missing space. Find the holder, release space safely, and prevent the next midnight disk-full incident.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2026-11-12'
publishedAt: '2026-11-12T07:00:00Z'
updatedAt: '2026-11-12T07:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Linux
  - Troubleshooting
  - Disk Space
  - lsof
  - Logging
  - Incident Response
---

`df` says `/var` is full. `du -sh /var` is hundreds of gigabytes short. Someone has already removed the large log, so searching the directory tree turns up nothing. Do not start deleting packages yet. A process can keep an unlinked file, and every block behind it, alive through an open file descriptor. This is the fastest way to prove that is the problem, release the space without an unplanned restart, and keep log rotation from creating it again.

## TLDR

- `rm` removes a directory entry. If it was the last link but a process still has the file open, Linux releases the blocks only when the final descriptor closes. [unlink(2)](https://man7.org/linux/man-pages/man2/unlink.2.html) describes that lifetime.
- Start with `sudo lsof -nP -a +L1 <mountpoint>`. The `-a` matters: lsof normally ORs selections, while `-a` makes the deleted-file selection and mountpoint selection intersect.
- Prefer restarting the owner or making it reopen logs. Truncating `/proc/PID/fd/N` is an emergency action that discards the data, but it can return space immediately.
- If there is no deleted open file, check ext4 reserved blocks, files hidden below a mount point, and inode exhaustion with `df -i`.

## Prerequisites

- Root or equivalent access to the affected Linux node.
- The filesystem mount point that `df` reports as full, not just a directory that happens to be beneath it.
- `lsof` if installed. The `/proc` fallback below works without it.
- A decision from the service owner before restarting, reloading, or truncating a live writer.

## Why the deleted log still consumes space

On Linux, a pathname is a directory entry that refers to a file's inode. `rm` calls `unlink(2)`: it removes that name. When that was the last link and no process has the file open, the filesystem can reuse the space. If a process still has it open, the inode and its blocks remain until the last file descriptor closes. That is why `du`, which walks named directory entries, cannot count these bytes while `df`, which reports filesystem allocation, still can. [The `unlink(2)` manual page](https://man7.org/linux/man-pages/man2/unlink.2.html) states both conditions explicitly.

The descriptor can outlive the name because it refers through an open file description to the inode, rather than by resolving the old pathname again. Closing the final descriptor frees an unlinked file's occupied space. [POSIX `close(3p)`](https://man7.org/linux/man-pages/man3/close.3p.html) documents that result.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "app.log", "sub": "named file, 200 MiB", "icon": "server", "tone": "blue" },
    { "label": "rm", "sub": "name removed", "icon": "activity", "tone": "amber" },
    { "label": "FD 3 still open", "sub": "link count is zero", "icon": "lock", "tone": "red" },
    { "label": "close or truncate", "sub": "blocks become reusable", "icon": "check", "tone": "green" }
  ]
}
```

## Reproduce the mismatch, then find the holder

Here is a real run on Linux 6.12 with lsof 4.95.0 as packaged by Debian 12. A Python process opened a log for append, wrote 200 MiB on `/dev/shm`, and kept descriptor 3 open. The lsof warnings from an unprivileged invocation are trimmed below. The numbers are not a capacity benchmark, `/dev/shm` was chosen so this test could not fill a real filesystem.

```terminal
{
  "title": "A deleted 200 MiB log remains allocated",
  "prompt": "$",
  "steps": [
    { "cmd": "df -h /dev/shm", "output": "Filesystem      Size  Used Avail Use% Mounted on\ntmpfs           1.9G  201M  1.7G  11% /dev/shm" },
    { "cmd": "du -sh /dev/shm/ddemo", "output": "200M\t/dev/shm/ddemo" },
    { "cmd": "rm /dev/shm/ddemo/app.log" },
    { "cmd": "lsof -nP +L1 /dev/shm | wc -l", "output": "15" },
    { "cmd": "lsof -nP -a +L1 /dev/shm | wc -l", "output": "2" },
    { "cmd": "df -h /dev/shm", "output": "Filesystem      Size  Used Avail Use% Mounted on\ntmpfs           1.9G  201M  1.7G  11% /dev/shm" },
    { "cmd": "du -sh /dev/shm/ddemo", "output": "0\t/dev/shm/ddemo" },
    { "cmd": "lsof -nP -a +L1 /dev/shm | grep -E 'COMMAND|app.log'", "output": "COMMAND     PID   USER   FD   TYPE DEVICE  SIZE/OFF NLINK   NODE NAME\npython3 1586127 nobody    3w   REG   0,24 209715200     0 139344 /dev/shm/ddemo/app.log (deleted)" },
    { "cmd": "stat -L -c '%s bytes' /proc/1586127/fd/3", "output": "209715200 bytes" },
    { "cmd": ": > /proc/1586127/fd/3" },
    { "cmd": "df -h /dev/shm", "output": "Filesystem      Size  Used Avail Use% Mounted on\ntmpfs           1.9G  140K  1.9G   1% /dev/shm" },
    { "cmd": "lsof -nP -a +L1 /dev/shm | grep -E 'COMMAND|app.log'", "output": "COMMAND     PID   USER   FD   TYPE DEVICE SIZE/OFF NLINK   NODE NAME\npython3 1586127 nobody    3w   REG   0,24        0     0 139344 /dev/shm/ddemo/app.log (deleted)" }
  ]
}
```

The key line has `NLINK` equal to `0`, which is what `+L1` selects. `SIZE/OFF` is 209715200 bytes before the truncate and zero after it. With `+L`, lsof exposes the link-count column; `+L1` selects open files with a link count below one. [Its manual page](https://lsof.readthedocs.io/en/stable/manpage/) documents both behaviours.

Use this incident command against the mount point:

```bash
sudo lsof -nP -a +L1 /var
```

`-nP` avoids DNS and service-name lookups during an incident. `+L1` selects the unlinked open files. `/var` is a selection too, which produces an important lsof trap: selection options are normally ORed. `lsof -nP +L1 /var` therefore includes every deleted open file anywhere and every open file on `/var`. Adding `-a` ANDs all selection options, so it returns the intersection. [lsof documents its default OR behaviour and `-a`](https://lsof.readthedocs.io/en/stable/manpage/).

Pass a mount point. For a non-mount directory, lsof selects that directory rather than the entire filesystem. If you need a tree search, use lsof's `+D` or `+d` options instead. The [lsof tutorial](https://lsof.readthedocs.io/en/stable/tutorial/) shows the mountpoint form, `lsof -a +L1 /home`.

### When lsof is unavailable

`/proc/PID/fd` contains one symbolic link for every open descriptor. Search it as root, because access to another process's descriptor links is permission checked:

```bash
sudo find /proc/[0-9]*/fd -lname '*(deleted)' -printf '%p -> %l\n' 2>/dev/null

# Inspect an interesting result. -L follows the /proc descriptor link.
sudo stat -L -c '%s bytes' /proc/1586127/fd/3
```

The [proc_pid_fd(5) manual page](https://man7.org/linux/man-pages/man5/proc_pid_fd.5.html) describes these entries as links to the files a process has open and notes the access check. Expect races: a process can close a descriptor between `find` and `stat`.

Do not treat every deleted-looking target as disk usage. `/memfd:... (deleted)` is an anonymous in-memory file, not a file consuming your ext4 or XFS blocks. [memfd_create(2)](https://man7.org/linux/man-pages/man2/memfd_create.2.html) says it lives in RAM. A `(deleted)` executable or shared library after an upgrade is different again: it can be an old program image still mapped by a running process. That is normally a restart-planning signal, not the explanation for a full data filesystem.

## Release the space without making the incident worse

The clean fix is for the holder to close the file. Restart the affected service, or use its documented reopen operation. If a systemd unit has a reload action, use the service's runbook, for example:

```bash
sudo systemctl reload nginx
```

For nginx log rotation, rename the log first and then signal the master process to reopen logs. nginx documents `USR1` for this operation:

```bash
# Confirm the configured PID file before running this.
sudo kill -USR1 "$(cat /run/nginx.pid)"
```

After a successful reopen, nginx closes the old logs and workers open the new ones. [nginx's log-rotation documentation](https://nginx.org/en/docs/control.html) describes that sequence. Use the actual PID file for the installation, not the sample path blindly.

If the filesystem is full and a controlled restart or reopen is unavailable, truncate the specific deleted descriptor:

```bash
# Last resort: verify PID, FD, path, owner and size first.
sudo sh -c ': > /proc/1586127/fd/3'
```

That is what released the 200 MiB in the demo while Python kept running and descriptor 3 remained open. It also destroys the unrecovered log content. Copy it out first if it might be needed, to a different filesystem with confirmed free space. `/var/tmp` usually sits on the same full `/var`, so it is the wrong target:

```bash
# /mnt/recovery: a separately mounted volume with room for the file
df -h /mnt/recovery
sudo cp -- /proc/1586127/fd/3 /mnt/recovery/recovered-app.log
```

Truncation changes the file size but not the open file description's seek offset. [ftruncate(3p)](https://man7.org/linux/man-pages/man3/ftruncate.3p.html) says the seek pointer is not modified. A writer that does not use `O_APPEND` can therefore write again at its old offset, extending the file and leaving a zero-filled hole before the new data. That is a reason to treat truncation as an emergency measure, then repair the application's logging setup.

:::warning
Do not truncate a descriptor because its name ends in `(deleted)` alone. Check the mount point, type, `SIZE/OFF`, process identity, and whether its data is needed. A wrong `/proc/PID/fd/N` target can discard live application data.
:::

## Stop the mismatch from returning

The durable fix is to make every writer close and reopen its logs during rotation. A logrotate rule commonly creates the new file and runs a service-specific post-rotation reload:

```text
/var/log/myapp/app.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 myapp myapp
    postrotate
        systemctl reload myapp.service
    endscript
}
```

`delaycompress` leaves the most recently rotated file uncompressed until the next rotation, for programs that keep writing to the previous file for a while before they reopen. [logrotate's manual page](https://man7.org/linux/man-pages/man5/logrotate.conf.5.html) documents that directive.

`copytruncate` is sometimes needed for a process that cannot reopen a file, but it is a tradeoff. It copies the old file and truncates it in place. The logrotate manual page warns that there is a very small interval between those operations in which log data can be lost. Prefer a reopen signal whenever the software supports one.

Container logs need caps too. Docker's `json-file` driver accepts `max-size` and `max-file`; its defaults are unlimited size and one file, and changing the daemon setting affects only newly created containers. [Docker's `json-file` documentation](https://docs.docker.com/engine/logging/drivers/json-file/) covers those settings. This example limits a new container to three 10 MiB log files:

```bash
docker run --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  my-image:current
```

Docker Engine on servers still defaults to `json-file` with no rotation; we measured how that compares with the `local` driver that Docker Desktop now uses in [Docker Desktop's switch to the local log driver](/posts/docker-desktop-local-log-driver). On a host that uses the systemd journal, set a budget instead of relying on disk pressure:

```ini
# /etc/systemd/journald.conf.d/size.conf
[Journal]
SystemMaxUse=1G
```

`SystemMaxUse=` limits persistent journals under `/var/log/journal`. The current systemd documentation says the default maximum is 10% of the filesystem, capped at 4G, and only archived files are removed to reduce usage. `journalctl --vacuum-size=500M` removes oldest archived journal files until their usage falls below that target. [journald.conf(5)](https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html) and [journalctl(1)](https://www.freedesktop.org/software/systemd/man/latest/journalctl) document those limits and the active-file caveat.

Alert before a page becomes a disk-full outage. node_exporter exposes `node_filesystem_avail_bytes` as space available to non-root users, and its node-mixin uses `predict_linear` for a run-out forecast. [The collector source](https://github.com/prometheus/node_exporter/blob/master/collector/filesystem_common.go) and [the maintained alert rule](https://github.com/prometheus/node_exporter/blob/master/docs/node-mixin/alerts/alerts.libsonnet) show both names.

```yaml
- alert: FilesystemPredictedFullSoon
  expr: |
    predict_linear(
      node_filesystem_avail_bytes{mountpoint="/var",fstype!~"tmpfs|overlay"}[6h],
      24 * 60 * 60
    ) < 0
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: /var is predicted to run out of space within 24 hours
```

Host log rotation limits local damage. For the separate question of how log volume reaches an observability bill, see [Your Logs Cost More Than the Service That Emits Them](/posts/your-logs-cost-more-than-the-service).

## If no process is holding a deleted file

Two other mismatches are common.

**Reserved ext4 blocks.** ext2, ext3 and ext4 reserve blocks for privileged processes, so `df` availability for a normal user is not the same as raw free blocks. `mke2fs` defaults that reservation to 5 percent unless configured otherwise. `tune2fs -l` only reads the superblock, so it is safe to run against the mounted device:

```bash
sudo tune2fs -l /dev/mapper/vg0-var | grep -E 'Block count|Reserved block count|Block size'
```

[`mke2fs(8)`](https://man7.org/linux/man-pages/man8/mke2fs.8.html) documents the 5 percent default, while [`tune2fs(8)`](https://man7.org/linux/man-pages/man8/tune2fs.8.html) documents `-l` and adjustment of the reserved-block percentage. Do not lower the reservation on a system filesystem as a reflex. It exists so root-owned services can still write when unprivileged writers cannot.

**Files hidden under a mount point.** If a process writes `/var/log/old.log` before a separate volume mounts on `/var/log`, that file remains on the underlying root filesystem. After the mount, the old directory contents are invisible by that pathname. [mount(8)](https://man7.org/linux/man-pages/man8/mount.8.html) says a mount makes the previous contents of the directory invisible while it is mounted.

Inspect the underlying root through a temporary bind mount. A plain bind of `/` does not bring the child mount at `/var/log` along, so the root filesystem's hidden `/var/log` becomes visible at the alternate path. [mount(2)](https://man7.org/linux/man-pages/man2/mount.2.html) specifies that a directory bind mount does not include submounts unless it is recursive:

```bash
root_view=$(mktemp -d)
sudo mount --bind / "$root_view"
sudo du -xsh "$root_view/var/log"
sudo umount "$root_view"
rmdir "$root_view"
```

Finally, `No space left on device` can mean **inodes**, not blocks. `df -i /var` reports inode information instead of block usage, as documented by [df(1)](https://man7.org/linux/man-pages/man1/df.1.html). Millions of tiny files can exhaust the inode table while `df -h` still reports available bytes.

## Containers and Kubernetes

A deleted file held open by a container process still consumes storage on the node: the container's writable layer lives under the runtime's directory on the node's disk, and a volume lives wherever it is mounted from. Investigate from the node, not from inside the container, which often has neither `lsof` nor permission to see other processes. Find the container's host PID, then read its descriptors through `/proc`, which works across namespaces:

```bash
# containerd/CRI-O nodes: host PID of the container's main process
container_id='replace-with-container-id'
pid=$(sudo crictl inspect "$container_id" | jq -r '.info.pid')

# Link targets are shown as paths inside the container
sudo find "/proc/$pid/fd" -lname '*(deleted)' -printf '%p -> %l\n'
```

The paths in the link targets are relative to the container's mount namespace, so `/app/logs/app.log (deleted)` is the container's view. [Linux namespace documentation](https://man7.org/linux/man-pages/man7/namespaces.7.html) explains why the same file has different paths from the node and from the container.

Kubernetes has an extra blind spot. When kubelet manages local ephemeral storage, it measures container logs, writable container layers and non-memory `emptyDir` volumes. Its directory-scan mode does not track deleted files that remain open, so a container can retain space that the kubelet does not categorize as in use. The same [Kubernetes local ephemeral storage documentation](https://kubernetes.io/docs/concepts/storage/ephemeral-storage/) says a container can be evicted when its writable layer and log usage exceed its ephemeral-storage limit. Node-level disk pressure is still a reason to inspect the host.

For the lifecycle rules that apply when the data belongs on a PersistentVolume rather than a node's ephemeral storage, see [The Anatomy of Kubernetes Persistent Storage](/posts/anatomy-of-kubernetes-persistent-storage).

## Incident checklist

1. Confirm the affected mount with `df -h <mountpoint>` and compare a scoped `du` result.
2. Run `sudo lsof -nP -a +L1 <mountpoint>`, and record PID, FD, size, link count and owner before changing anything.
3. If lsof is absent, search `/proc/[0-9]*/fd` for `*(deleted)` as root and inspect candidate sizes with `stat -L`.
4. Recover required data to a different filesystem, then restart the service or use its documented log-reopen action.
5. Use `: > /proc/PID/fd/N` only for a verified emergency target, then confirm `df` changes and fix rotation or log limits.
6. If no holder exists, check `df -i`, ext4 reserved blocks, hidden files below mounts, and node-level container storage.

The important distinction is simple: deleting a pathname is not the same thing as closing the file. Once the incident response follows that distinction, the `df` and `du` disagreement becomes evidence instead of a mystery.
