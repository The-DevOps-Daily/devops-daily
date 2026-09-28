---
title: 'containerd 1.7 Reaches End of Life: What Breaks on 2.x'
excerpt: 'We ran containerd 1.7.36, 2.3.6 and 2.4.1 against the same data and an old node config. The config still loaded and the mirrors still worked. What broke was pulling schema 1 images, and it stays hidden until a node has to pull one.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-09-29'
publishedAt: '2026-09-29T09:00:00Z'
updatedAt: '2026-09-29T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kubernetes
  - containerd
  - Containers
  - Upgrades
  - Docker
---

containerd 1.7 reaches the end of its support window this month, and Kubernetes has already moved on: 1.35 is the last Kubernetes release that supports containerd 1.x, and 1.36 dropped it. So the question for most clusters is no longer whether to move to containerd 2, but what the move will break.

The changelog makes it sound like a lot: a new config format, removed CRI APIs, registry mirrors on their way out, schema 1 images gone. We wanted to know which of those actually bite, so we ran the upgrade. Same old node config, same data directory, containerd 1.7.36, then 2.3.6, then 2.4.1, recording everything each version said. The config still loaded. The mirrors still worked. What broke was pulling schema 1 images, even on the upgraded node. The catch is that nothing pulls on an upgraded node until something forces it, so the failure tends to appear later, on the next fresh node.

```github
The-DevOps-Daily/containerd-2-upgrade-check
```

## TLDR

- **containerd 1.7 support ends in September 2026**, and Kubernetes dropped containerd 1.x support in 1.36.0. Recent EKS AL2023 node images already ship containerd 2.2.7.
- **An old version 2 config still loads on 2.x.** containerd migrates it in memory at startup and logs a warning. `containerd config migrate` writes `version = 4`, and it copies the dead sections into the new file.
- **Inline registry mirrors still work on 2.3 and 2.4.** Our logging mirror received five requests per pull on all three versions. Their removal date has moved from v2.1 to v2.4 to v2.7 depending on which version you ask.
- **Pulling schema 1 images is the real break.** An image pulled and converted under 1.7 is still in the image store after the upgrade, but any schema 1 pull on 2.x fails: `schema 1 image manifests are no longer supported`. It shows up when a node has to pull: a fresh node, a garbage-collected image, or `imagePullPolicy: Always`.
- **A read-only check script** in the repository reports all of this for a real node.

## Prerequisites

- Kubernetes nodes that run containerd. (We did not test Docker Engine hosts.)
- Root access to one node, to read its config and run `ctr`.
- `kubectl` if you want the cluster-wide view.

## Why now

Three dates line up:

- **containerd's own release table** lists 1.7 as an LTS release with end of life in September 2026, extended to that date for Kubernetes 1.30 to 1.32 on GKE. See [RELEASES.md](https://github.com/containerd/containerd/blob/main/RELEASES.md).
- **Kubernetes** agreed that the last release to support containerd 1.x is 1.35, with support dropped in 1.36.0. The kubelet exposes a `kubelet_cri_losing_support` metric: when it appears with a version label of `1.36.0`, that node's containerd is too old for the next Kubernetes version. See the [Kubernetes v1.35 sneak peek](https://kubernetes.io/blog/2025/11/26/kubernetes-v1-35-sneak-peek/).
- **Managed node images have moved already.** The EKS AL2023 AMI release [v20260923](https://github.com/awslabs/amazon-eks-ami/releases/tag/v20260923) ships containerd `2.2.7`. On managed Kubernetes the containerd version usually comes with the node image, so check your node image's release notes before you upgrade a pool.

To see what every node in a cluster runs today:

```bash
kubectl get nodes -o custom-columns=NAME:.metadata.name,RUNTIME:.status.nodeInfo.containerRuntimeVersion
```

## The experiment

The demo runs three containerd versions one after the other, against the same `--root` and `--state` directories, the way an in-place node upgrade reuses the node's data. Each one starts with the same config, written the way many Kubernetes nodes were set up in the 1.x era:

```toml
version = 2

[plugins."io.containerd.grpc.v1.cri"]
  sandbox_image = "registry.k8s.io/pause:3.9"

  [plugins."io.containerd.grpc.v1.cri".containerd]
    snapshotter = "overlayfs"
    default_runtime_name = "runc"

    [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc]
      runtime_type = "io.containerd.runc.v2"

      [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
        SystemdCgroup = true

  [plugins."io.containerd.grpc.v1.cri".registry.mirrors."docker.io"]
    endpoint = ["http://127.0.0.1:5055"]

[plugins."io.containerd.runtime.v1.linux"]
  shim = "containerd-shim"
  runtime = "runc"
```

The `docker.io` mirror points at a tiny local server that logs every request and answers 404, so containerd falls back to Docker Hub. That turns "is this setting still honoured?" into a number we can count.

```diagram
{
  "type": "flow",
  "title": "One data directory, three versions",
  "nodes": [
    { "label": "containerd 1.7.36", "sub": "old config, schema 1 pull", "icon": "box", "tone": "slate" },
    { "label": "containerd 2.3.6", "sub": "LTS, same root", "icon": "box", "tone": "blue" },
    { "label": "containerd 2.4.1", "sub": "latest, same root", "icon": "box", "tone": "violet" },
    { "label": "runs/", "sub": "every command and warning", "icon": "check", "tone": "green" }
  ]
}
```

For each version the script records `ctr deprecations list`, a CRI image pull through `crictl`, how many requests reached the mirror, the schema 1 steps, and the daemon's warnings. The terminal output below comes from those recordings; the commands are shown without the demo's socket flags, and trailing spaces are trimmed.

## Finding 1: the old config still loads

Both 2.x versions started with the version 2 config. They converted it in memory and said so once, at startup:

```terminal
{
  "title": "containerd 2.3.6 daemon log",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "output": "time=\"2026-09-28T23:41:57+03:00\" level=warning msg=\"Configuration migrated from version 2, use `containerd config migrate` to avoid migration\" t=\"31.333µs\""
    }
  ]
}
```

That is friendlier than the changelog suggests, and it is also a trap: a config that loads is not a config that is doing what it says. Running `containerd config migrate` with 2.3.6 or 2.4.1 printed a complete config with `version = 4`, and two details in it matter:

- The **runtime v1 section** came through unchanged as `[plugins.'io.containerd.runtime.v1.linux']`. Runtime v1 was removed in 2.0, so that block now configures nothing, silently.
- The **inline mirrors** came through too, moved to the new `io.containerd.cri.v1.images` section.

So `config migrate` gives you the new layout, not a clean config. Read the output and delete what no longer exists before you ship it.

## Finding 2: the mirrors still work, and the deadline keeps moving

The inline `registry.mirrors` setting has been deprecated since containerd 1.5. We expected 2.x to ignore it. It did not. Each version pulled a different busybox tag through the CRI, and the logging mirror recorded five requests per pull. Here is 2.4.1:

```terminal
{
  "title": "containerd 2.4.1",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "crictl pull docker.io/library/busybox:1.38.0",
      "output": "time=\"2026-09-28T23:42:10+03:00\" level=warning msg=\"Config \\\"/etc/crictl.yaml\\\" does not exist, trying next: \\\"/home/biliev/projects/containerd-2-upgrade-check/bin/crictl.yaml\\\"\"\nImage is up to date for sha256:d2482869a6b838d3b4c9cad0c8085c06277909482771eb525d298fc3a7d07927"
    },
    {
      "comment": "the local mirror's request log for that pull"
    },
    {
      "output": "requests the docker.io mirror received: 5\nHEAD /v2/library/busybox/manifests/1.38.0?ns=docker.io\nGET /v2/library/busybox/manifests/sha256:fd7dc98638c8e305f4dc34e979f1c0fdfdcaeb0fbf8fcff77ae834b6da3d7e6e?ns=docker.io\nGET /v2/library/busybox/manifests/sha256:365a051f12e05767b598e643676f14a450fb678a75ccf2beb0052c95d5c73b83?ns=docker.io"
    }
  ]
}
```

What changed is the removal date in the warning. Each version records it with `ctr deprecations list`:

| Version           | Mirrors "will be removed in" |
| ----------------- | ---------------------------- |
| containerd 1.7.36 | v2.1                         |
| containerd 2.3.6  | v2.4                         |
| containerd 2.4.1  | v2.7                         |

A deadline that has moved twice is still a deadline. There is also a side effect today: with inline mirrors in the config, 2.x logs `Found 'Registry.Mirrors' in CRI config which is incompatible with transfer service ... Falling back to local image pull mode.` In other words, keeping the old setting also keeps the old pull path.

The replacement is `config_path` plus one `hosts.toml` per registry:

```toml
# /etc/containerd/config.toml (version 3 or later)
[plugins.'io.containerd.cri.v1.images'.registry]
  config_path = '/etc/containerd/certs.d'
```

```toml
# /etc/containerd/certs.d/docker.io/hosts.toml
server = "https://registry-1.docker.io"

# Give "resolve" (tag lookups) only to mirrors you trust.
[host."https://mirror.gcr.io"]
  capabilities = ["pull"]
```

## Finding 3: schema 1 fails, but not where you are looking

Docker image manifest schema 1 is the format images were pushed in before Docker 1.10 introduced schema 2 in 2016. Some are still served that way. [`scripts/find-schema1.sh`](https://github.com/The-DevOps-Daily/containerd-2-upgrade-check/blob/main/scripts/find-schema1.sh) asks for newer formats first, the way a current client does, and `docker.io/library/busybox:1.24`, `gcr.io/google-containers/busybox:1.24`, `gcr.io/google-containers/pause:0.8.0` and `quay.io/coreos/etcd:v2.2.5` still came back as schema 1. containerd 1.7 still pulls them, converting on the way and warning about it; our 1.7.36 run did that with `busybox:1.24`. containerd 2.0 disabled schema 1 pulls (2.0.x can turn them back on with `CONTAINERD_ENABLE_DEPRECATED_PULL_SCHEMA_1_IMAGE=1`), and 2.1 removed them, according to containerd's [deprecation table](https://github.com/containerd/containerd/blob/main/RELEASES.md).

On 1.7.36 the pull worked, and the deprecation was recorded:

```terminal
{
  "title": "containerd 1.7.36",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "the demo keeps the last two lines of ctr's progress output"
    },
    {
      "cmd": "ctr -n demo images pull --platform linux/amd64 docker.io/library/busybox:1.24",
      "output": "unpacking linux/amd64 sha256:dc53f06b7ab95434d92cd20c00409fe5b5ded8d3b68f861e709f2e4b49067242...\ndone: 323.503075ms"
    },
    {
      "cmd": "ctr deprecations list",
      "output": "ID                                                LAST OCCURRENCE                   MESSAGE\nio.containerd.deprecation/cri-registry-mirrors    2026-09-28T20:41:42.439195342Z    The `mirrors` property of `[plugins.\"io.containerd.grpc.v1.cri\".registry]` is deprecated since containerd v1.5 and will be removed in containerd v2.1. Use `config_path` instead.\nio.containerd.deprecation/pull-schema-1-image     2026-09-28T20:41:54.047880144Z    Schema 1 images are deprecated since containerd v1.7 and removed in containerd v2.0. Since containerd v1.7.8, schema 1 images are identified by the \"io.containerd.image/converted-docker-schema1\" label."
    }
  ]
}
```

Then we upgraded the same data directory. On 2.3.6 and on 2.4.1 the converted image was still in the image store, with its label. (It is an amd64 image and the demo ran on an arm64 Pi, so we listed it but did not run it.) Pulling it again failed:

```terminal
{
  "title": "containerd 2.4.1, same data directory",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ctr -n demo images ls",
      "output": "time=\"2026-09-28T23:42:17+03:00\" level=warning msg=\"DEPRECATION: The `mirrors` property of `[plugins.\\\"io.containerd.grpc.v1.cri\\\".registry]` is deprecated since containerd v1.5 and will be removed in containerd v2.7. Use `config_path` instead.\"\nREF                            TYPE                                       DIGEST                                                                  SIZE      PLATFORMS   LABELS\ndocker.io/library/busybox:1.24 application/vnd.oci.image.manifest.v1+json sha256:dc53f06b7ab95434d92cd20c00409fe5b5ded8d3b68f861e709f2e4b49067242 661.3 KiB linux/amd64 io.containerd.image/converted-docker-schema1=sha256:8ea3273d79b47a8b6d018be398c17590a4b5ec604515f416c5b797db9dde3ad8"
    },
    {
      "comment": "the demo keeps the last two lines of ctr's output"
    },
    {
      "cmd": "ctr -n demo images pull --platform linux/amd64 docker.io/library/busybox:1.24",
      "output": "time=\"2026-09-28T23:42:17+03:00\" level=warning msg=\"DEPRECATION: The `mirrors` property of `[plugins.\\\"io.containerd.grpc.v1.cri\\\".registry]` is deprecated since containerd v1.5 and will be removed in containerd v2.7. Use `config_path` instead.\"\nctr: schema 1 image manifests are no longer supported: invalid argument"
    }
  ]
}
```

That is the whole trap. The pull fails everywhere, the upgraded node included. But an upgraded node that already has the image on disk has no reason to pull it, so nothing visible happens on upgrade day. The failure appears later, whenever a node has to pull:

- **A new node** from the autoscaler or a node pool upgrade has an empty image store and has to pull.
- **Image garbage collection** on a busy node deletes the cached copy, and the next pod start pulls again.
- **`imagePullPolicy: Always`**, or a rollback to an old tag that the new nodes have never pulled.

Each of these looks like a random `ImagePullBackOff` on one node, days after an upgrade that "went fine".

To find the images before they find you, look for the label containerd adds on conversion. The check script does this across every namespace, which on a Kubernetes node includes `k8s.io`. The fix is to stop depending on the old manifest: rebuild the image and push it with a current tool, which writes a schema 2 or OCI manifest, or move to a newer tag that already has one. Retagging the old image does not change its manifest.

## Check a real node

[`scripts/check-node.sh`](https://github.com/The-DevOps-Daily/containerd-2-upgrade-check/blob/main/scripts/check-node.sh) is read-only. Run it as root on a node before you upgrade. This is its output against the demo's 1.7.36 daemon after the schema 1 pull, with the paths overridden for the demo:

```terminal
{
  "title": "check-node.sh",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sudo CONTAINERD_CONFIG=configs/old-node-config.toml CONTAINERD_ADDRESS=/tmp/ctd-check/containerd.sock CTR=bin/containerd-1.7.36/ctr scripts/check-node.sh",
      "output": "== containerd version\n  Version:  v1.7.36\n  Revision: 2892c2042ee7fbd3be0e5bdc675e07b5acedb0bf\n\n== config: configs/old-node-config.toml\nconfig version: 2\nWARN inline registry.mirrors: deprecated; move to config_path and hosts.toml files\nWARN runtime v1 section: removed in 2.0; containerd 2.x ignores it\n\n== deprecations containerd has already seen (1.7.x and later)\nID                                                LAST OCCURRENCE                   MESSAGE\nio.containerd.deprecation/cri-registry-mirrors    2026-09-28T20:48:14.827082624Z    The `mirrors` property of `[plugins.\"io.containerd.grpc.v1.cri\".registry]` is deprecated since containerd v1.5 and will be removed in containerd v2.1. Use `config_path` instead.\nio.containerd.deprecation/pull-schema-1-image     2026-09-28T20:48:19.606197042Z    Schema 1 images are deprecated since containerd v1.7 and removed in containerd v2.0. Since containerd v1.7.8, schema 1 images are identified by the \"io.containerd.image/converted-docker-schema1\" label.\n\n== images that were converted from schema 1 (they keep working; pulling them again on 2.x fails)\nk8s.io  docker.io/library/busybox:1.24"
    }
  ]
}
```

`ctr deprecations list` is the most useful line in there. It lists the deprecations containerd has observed on that node: config problems it saw at startup, and deprecated features something actually used, such as a schema 1 pull. It is not a complete audit, but it reflects the node, not the changelog.

## An upgrade checklist

1. **List runtime versions** across the cluster with the `kubectl` command above, and watch for `kubelet_cri_losing_support`.
2. **Run the check** on one node per node pool or image type.
3. **Rebuild and push every schema 1 image** it finds, so it gets a schema 2 or OCI manifest, and search your manifests for old tags the check cannot see because no node has pulled them yet.
4. **Move mirrors** to `config_path` and `hosts.toml`.
5. **Run `containerd config migrate`**, then delete the sections for things that no longer exist, such as runtime v1, before you ship the new config.
6. **Upgrade one node pool**, then drain a node onto a fresh one, so the new node has to pull every image from scratch. That is where schema 1 fails, so test it on purpose.

## What we could not test

- **The CRI v1alpha2 removal.** containerd 2.0 removed the old CRI API. Any kubelet recent enough to still be supported uses CRI v1, but older tools that speak v1alpha2 will stop working. We had no such client to show it.
- **A real cluster.** The recordings come from standalone daemons on a Raspberry Pi 4 (arm64). The schema 1 images are amd64 only, so we pulled them with `--platform linux/amd64` and did not run them.
- **aufs, custom runtimes, NRI plugins and GPU setups.** A node that relies on any of these needs its own test.
- **Every managed platform.** Node images decide the containerd version and its defaults. Check your provider's release notes, as we did for EKS.

## Summary

The containerd 1.7 to 2.x upgrade is gentler than its changelog. An old config loads, deprecated mirrors keep working for now, and images already on the node stay in the image store. That gentleness is exactly what makes the one real break dangerous: schema 1 pulls fail on every node, but you only see it when a node has to pull, which usually means the fresh node next week, not the one you just upgraded. Run the check, rebuild the old images, clean up the config by hand after `config migrate`, and test the upgrade on an empty node before the node pool does it for you.
