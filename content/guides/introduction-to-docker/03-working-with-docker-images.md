---
title: 'Docker Images: Pull, Tag, Inspect and Clean Up'
description: 'Work with Docker images: how names, tags and digests work, pull and list images, inspect layers and configs, pick a base image variant and free disk space.'
order: 3
---

Every container starts from an image, so knowing how images are named, stored and updated saves you from the most common Docker surprises: the wrong version in production, a full disk, or an image that does not run on your CPU. This part covers image names, tags and digests, pulling and listing images, looking inside them, choosing between image variants, and cleaning up.

## Prerequisites

- Docker installed and working ([Part 2](/guides/introduction-to-docker/02-docker-installation)).
- The concepts from [Part 1](/guides/introduction-to-docker/01-docker-basics): layers, configs, registries.

## How Image Names Work

A full image reference has up to five parts:

```text
[registry/][namespace/]repository[:tag][@digest]

docker.io/library/nginx:1.30
ghcr.io/my-org/hello-api:1.0
nginx@sha256:a7675fcee220f59b4a99f7098c06a0d5d999c2c0ee37c0211efb780536e5cb20
```

Docker fills in what you leave out:

| You type                       | Docker reads it as                         |
| ------------------------------ | ------------------------------------------ |
| `nginx`                        | `docker.io/library/nginx:latest`           |
| `nginx:1.30`                   | `docker.io/library/nginx:1.30`             |
| `my-user/hello-api:1.0`        | `docker.io/my-user/hello-api:1.0`          |
| `ghcr.io/my-org/hello-api:1.0` | GitHub Container Registry, used as written |

- **Registry**: the server. If the first part has no dot or port and is not `localhost`, Docker uses Docker Hub (`docker.io`), so `localhost:5000/app` and `localhost/app` both mean a local registry.
- **Namespace**: the user or organization. Docker Official Images live in the special namespace `library`.
- **Tag**: a name for one version. If you leave it out, Docker uses `latest`.
- **Digest**: the SHA-256 hash of the image manifest or index. It identifies exactly one piece of content and never changes.

## Tags Move, Digests Do Not

A tag is a pointer that the publisher can move to a new image at any time. One image usually has several tags. This real run asks Docker Hub which digest four nginx tags point to. `crane digest` (from [Part 1](/guides/introduction-to-docker/01-docker-basics)) sends `HEAD` requests, which do not count against Docker Hub's pull limit:

```terminal
{
  "title": "four tags, one image (real run, 23 October 2026)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "for t in 1.30 1.30.6 stable stable-trixie; do\n  echo \"nginx:$t $(crane digest nginx:$t)\"\ndone",
      "output": "nginx:1.30 sha256:a7675fcee220f59b4a99f7098c06a0d5d999c2c0ee37c0211efb780536e5cb20\nnginx:1.30.6 sha256:a7675fcee220f59b4a99f7098c06a0d5d999c2c0ee37c0211efb780536e5cb20\nnginx:stable sha256:a7675fcee220f59b4a99f7098c06a0d5d999c2c0ee37c0211efb780536e5cb20\nnginx:stable-trixie sha256:a7675fcee220f59b4a99f7098c06a0d5d999c2c0ee37c0211efb780536e5cb20"
    }
  ]
}
```

Today `nginx:stable` and `nginx:1.30` point to nginx 1.30.6 on Debian trixie. When nginx 1.30.7 comes out, `1.30`, `stable` and `stable-trixie` move to it, and `1.30.6` stays where it is. When the next stable line starts, `stable` moves to it as well.

That gives you a choice of how specific to be:

- `nginx` or `nginx:latest`: whatever the publisher ships today, including new major versions. Avoid it outside of quick experiments.
- `nginx:1.30`: patch updates within one release line. A good default for most applications.
- `nginx:1.30.6`: one exact release. The publisher can still rebuild it, for example when the base image gets a security fix.
- `nginx:1.30.6@sha256:a7675f...`: exactly one image, forever. Docker ignores the tag and pulls by digest. Use this when you need reproducible builds, together with a bot that updates the digest ([Part 9](/guides/introduction-to-docker/09-docker-best-practices)).

## Pull an Image

`docker pull` downloads an image without running it. `docker run` pulls automatically when the image is missing, so you mostly pull to update a tag you already have, or to prepare a machine before it goes offline.

```bash
docker pull nginx:1.30
```

Example output (the layer IDs and the digest are the real values for `linux/amd64` on 23 October 2026):

```text
1.30: Pulling from library/nginx
f2be67225471: Pull complete
761a61a91594: Pull complete
5c5414878c03: Pull complete
a0ce7ca19271: Pull complete
4c08e406729d: Pull complete
649bf466f361: Pull complete
e22b67b873d0: Pull complete
Digest: sha256:a7675fcee220f59b4a99f7098c06a0d5d999c2c0ee37c0211efb780536e5cb20
Status: Downloaded newer image for nginx:1.30
docker.io/library/nginx:1.30
```

Each line is a layer. Layers are shared between images, and a pull skips the ones you already have. The first layer of `nginx:1.30` is Debian trixie, and so is the first layer of `postgres:18` and `python:3.14-slim`. This real run compares them:

```terminal
{
  "title": "three images, one base layer (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "for i in nginx:1.30 postgres:18 python:3.14-slim; do\n  echo \"$i $(crane config --platform linux/amd64 $i | jq -r '.rootfs.diff_ids[0]')\"\ndone",
      "output": "nginx:1.30 sha256:a70f6272827f64e1427d048ced77491aab5d64ab95725e56920802ff391197d7\npostgres:18 sha256:a70f6272827f64e1427d048ced77491aab5d64ab95725e56920802ff391197d7\npython:3.14-slim sha256:a70f6272827f64e1427d048ced77491aab5d64ab95725e56920802ff391197d7"
    }
  ]
}
```

So after `nginx:1.30`, a pull of `postgres:18` prints `f2be67225471: Already exists` for that layer and downloads only the rest.

Pull the Alpine variant of nginx as well, for comparison in the next section:

```bash
docker pull nginx:1.30-alpine
```

**Multi-platform images.** Docker picks the image for your CPU from the image index ([Part 1](/guides/introduction-to-docker/01-docker-basics)). To get another platform, for example to test an `amd64` image on an Apple silicon Mac, pass `--platform linux/amd64`. Docker Desktop then runs it under emulation, which works but is slower. Docker Engine on Linux can only run it after you register QEMU emulators (`docker run --privileged --rm tonistiigi/binfmt --install all`); otherwise the container fails with `exec format error`.

## List Images

```bash
docker image ls        # or the older alias: docker images
```

Docker Engine 29 shows a new default view. Example output with the containerd image store (the default for new installs), after the `hello-world` run from Part 2 and the two nginx pulls:

```text
                                                                       i Info →  U  In Use
IMAGE                ID             DISK USAGE   CONTENT SIZE   EXTRA
hello-world:latest   11a3eb1597e8       14.2kB         2.42kB    U
nginx:1.30           a7675fcee220        230MB         63.6MB
nginx:1.30-alpine    47928bf67eb6       89.7MB           26MB
```

- **ID** is the start of the image's digest, so it matches the digest from `docker pull`.
- **Content size** is the compressed data that was downloaded. **Disk usage** adds the unpacked files that containers use.
- **U** marks images that a container uses, even a stopped one. The `hello-world` container from Part 2 still exists, so you cannot remove that image until you remove the container.

`docker image ls --tree` expands each image into its platforms. `docker image ls --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}'` gives you the classic table that older tutorials show, and `docker image ls -a` also shows untagged images, which Engine 29 hides by default.

## Look Inside an Image

You can read an image's metadata before you run it. Locally, `docker image inspect nginx:1.30` prints the full JSON. Two parts of it matter most:

- `.Config`: the default command (`Cmd`), `Entrypoint`, environment (`Env`), `User`, `WorkingDir` and `ExposedPorts`.
- `.RootFS.Layers`: the layer digests.

`docker image history nginx:1.30` lists the Dockerfile steps that created each layer. The same information is in the image config in the registry, so you can read it before you pull. A real run for the Alpine variant of nginx:

```terminal
{
  "title": "how nginx:1.30-alpine was built (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "crane config --platform linux/amd64 nginx:1.30-alpine | jq -r '.history[].created_by' | cut -c1-90 | head -12",
      "output": "ADD alpine-minirootfs-3.24.3-x86_64.tar.gz / # buildkit\nCMD [\"/bin/sh\"]\nLABEL maintainer=NGINX Docker Maintainers <docker-maint@nginx.com>\nENV NGINX_VERSION=1.30.6\nENV PKG_RELEASE=1\nENV DYNPKG_RELEASE=1\nRUN /bin/sh -c set -x     && addgroup -g 101 -S nginx     && adduser -S -D -H -u 101 -h /v\nCOPY docker-entrypoint.sh / # buildkit\nCOPY 10-listen-on-ipv6-by-default.sh /docker-entrypoint.d # buildkit\nCOPY 15-local-resolvers.envsh /docker-entrypoint.d # buildkit\nCOPY 20-envsubst-on-templates.sh /docker-entrypoint.d # buildkit\nCOPY 30-tune-worker-processes.sh /docker-entrypoint.d # buildkit"
    }
  ]
}
```

The first lines tell you the base (Alpine 3.24.3, whose own `CMD ["/bin/sh"]` the nginx image later replaces), the user the image creates (`nginx`, UID 101) and the scripts it copies into `/docker-entrypoint.d`. The rest of the list, cut off here, ends with the `ENTRYPOINT` and `CMD` you saw in the config in [Part 1](/guides/introduction-to-docker/01-docker-basics). Steps marked `# buildkit` were built with BuildKit.

## Choose an Image Variant

Most official images come in variants. For the Python image:

- `python:3.14`: Debian with compilers and many libraries. Good for building, too big to ship.
- `python:3.14-slim`: Debian with only what Python needs. The usual choice for applications.
- `python:3.14-alpine`: Alpine Linux with musl instead of glibc. Smaller, but some Python packages with C extensions have no musl wheels and must compile.
- `gcr.io/distroless/python3-debian13`: Google's distroless image: Python and its libraries, no shell and no package manager. Its Python version is whatever Debian 13 ships (3.13), not one you choose.

The size difference is large. These numbers come from the registry manifests, with every layer unpacked to count its files:

```chart
{
  "type": "bar",
  "title": "Python base images, linux/amd64",
  "unit": " MB",
  "caption": "Measured on 23 October 2026 with crane 0.22.1: compressed = sum of the layer sizes in the manifest (what you download), unpacked = the same layers decompressed (close to what lands on disk). The full image is Debian trixie; the distroless image ships Python 3.13.",
  "rows": [
    { "label": "python:3.14 compressed", "value": 415.8, "series": "Compressed" },
    { "label": "python:3.14 unpacked", "value": 1143.5, "series": "Unpacked" },
    { "label": "python:3.14-slim compressed", "value": 43.5, "series": "Compressed" },
    { "label": "python:3.14-slim unpacked", "value": 123.9, "series": "Unpacked" },
    { "label": "distroless python3-debian13 compressed", "value": 22.6, "series": "Compressed" },
    { "label": "distroless python3-debian13 unpacked", "value": 62.3, "series": "Unpacked" },
    { "label": "python:3.14-alpine compressed", "value": 17.8, "series": "Compressed" },
    { "label": "python:3.14-alpine unpacked", "value": 50.2, "series": "Unpacked" }
  ]
}
```

The full image is nine times the size of `slim`. A smaller image downloads faster, starts faster on a new server, and contains fewer packages that a scanner can flag. [Part 5](/guides/introduction-to-docker/05-building-custom-docker-images) uses `python:3.14-slim` for the example app, and [Part 9](/guides/introduction-to-docker/09-docker-best-practices) shows how to keep the final image small even when you need build tools.

**Official, verified and community images.** On Docker Hub, prefer **Docker Official Images** (no namespace, like `nginx` or `postgres`), images from **Verified Publishers** (the vendor's own namespace, with a badge), and images from projects you know. Anyone can push to Docker Hub, and an image is software that runs on your machine.

## Tag an Image

`docker tag` adds a second name to an existing image. It copies nothing:

```bash
docker tag nginx:1.30 my-nginx:1.0
docker image ls
```

Example output: both names have the same ID, because they are the same image:

```text
                                                                       i Info →  U  In Use
IMAGE                ID             DISK USAGE   CONTENT SIZE   EXTRA
hello-world:latest   11a3eb1597e8       14.2kB         2.42kB    U
my-nginx:1.0         a7675fcee220        230MB         63.6MB
nginx:1.30           a7675fcee220        230MB         63.6MB
nginx:1.30-alpine    47928bf67eb6       89.7MB           26MB
```

Tagging is how you prepare an image for another registry: `docker tag hello-api:1.0 ghcr.io/my-org/hello-api:1.0`, then `docker push`. [Part 5](/guides/introduction-to-docker/05-building-custom-docker-images) does this for the example app.

## Move Images Without a Registry

`docker save` writes images to a tar archive and `docker load` reads it back. Use it for air-gapped machines or to copy an image to a server once:

```bash
docker save -o nginx-1.30.tar nginx:1.30
scp nginx-1.30.tar server:
ssh server docker load -i nginx-1.30.tar
```

Both commands accept `--platform` to save or load only one platform of a multi-platform image (Engine 28), and Engine 29 accepts several platforms at once. For anything you do more than once, push to a registry instead.

## Free Disk Space

Images, stopped containers and build cache add up. See where the space goes:

```bash
docker system df
```

Example output:

```text
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          3         1         319.4MB   319.4MB (99%)
Containers      1         0         0B        0B
Local Volumes   0         0         0B        0B
Build Cache     0         0         0B        0B
```

Then clean up from the safest command to the most aggressive. Nothing later in this guide depends on what you remove here: `docker run` pulls missing images again.

```bash
docker image rm my-nginx:1.0     # remove one name (the image stays while another tag points to it)
docker image prune               # remove dangling images: untagged leftovers of rebuilds
docker image prune -a            # remove every image that no container uses
docker builder prune             # remove the build cache
docker system prune              # stopped containers, unused networks, dangling images, build cache
```

`docker system prune` does not touch volumes unless you add `--volumes`, and even then it removes only anonymous volumes. Named volumes, which hold your data, are removed only by `docker volume rm` or `docker volume prune --all` ([Part 6](/guides/introduction-to-docker/06-working-with-docker-volumes)).

## Registries Besides Docker Hub

| Registry                         | Image names look like                                    |
| -------------------------------- | -------------------------------------------------------- |
| Docker Hub                       | `docker.io/my-user/app:1.0` (or just `my-user/app:1.0`)  |
| GitHub Container Registry        | `ghcr.io/my-org/app:1.0`                                 |
| Amazon ECR                       | `123456789012.dkr.ecr.eu-west-1.amazonaws.com/app:1.0`   |
| Google Artifact Registry         | `europe-west1-docker.pkg.dev/my-project/my-repo/app:1.0` |
| Azure Container Registry         | `myregistry.azurecr.io/app:1.0`                          |
| DigitalOcean Container Registry  | `registry.digitalocean.com/my-registry/app:1.0`          |
| Self-hosted (Harbor, registry:3) | `registry.example.com/team/app:1.0`                      |

Google's old Container Registry (`gcr.io/my-project/...`) has been replaced by Artifact Registry; public images that Google itself publishes, such as distroless, are still served from `gcr.io`. Log in to a registry with `docker login <registry>`, or with the cloud CLI's credential helper (`aws ecr get-login-password`, `gcloud auth configure-docker`, `az acr login`).

## Common Mistakes

- **Deploying `latest`.** Two servers that pull `latest` a day apart can run different versions. Use a version tag, and a digest when it matters.
- **Assuming `docker pull` updates running containers.** A pull only updates the image. Containers keep running the old image until you recreate them.
- **Pulling an `amd64`-only image on ARM.** The container fails with `exec format error`. Check the platforms with `docker buildx imagetools inspect` first.
- **Never cleaning up.** Build servers fill their disks with old images and build cache. Schedule `docker image prune -a --filter "until=168h"` and `docker builder prune` on them.

## Summary

- A reference is `registry/namespace/repository:tag@digest`; Docker Hub and `latest` are the defaults.
- Tags move, digests do not. Pin versions, and digests when you need reproducibility.
- Layers are shared between images, so related images download and store less.
- Pick the smallest variant that runs your app, usually `-slim`.
- `docker system df` shows the space; `prune` commands free it.

Next, run containers from these images in [Run Your First Docker Container](/guides/introduction-to-docker/04-creating-your-first-container).

## Keep Learning

- [Where Docker Images Are Stored on Your Host Machine](/posts/docker-image-storage-locations)
- [How to Remove Old and Unused Docker Images](/posts/remove-old-unused-docker-images)
- [Docker Complains About "No Space Left on Device": How to Clean Up?](/posts/docker-no-space-left-cleanup)
- [Why Your Base Image Has 1,684 CVEs](/posts/why-your-base-image-has-1684-cves)
- [Harbor vs Docker Hub](/comparisons/harbor-vs-docker-hub)
- Interview question: [Docker image layers and caching](/interview-questions/mid/docker-layers-caching)
