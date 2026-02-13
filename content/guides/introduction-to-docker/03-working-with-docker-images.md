---
title: Working with Docker Images
description: Learn how to find, pull, manage, and understand Docker images
order: 3
---

Docker images are the foundation of containers. They're read-only templates containing application code, libraries, tools, dependencies, and other files needed to run an application. In this section, you'll learn how to work with Docker images effectively.

## Understanding Docker Images

Docker images have several important characteristics:

1. **Layered**: Images consist of multiple layers, each representing a set of filesystem changes.
2. **Immutable**: Once built, an image doesn't change. To update an application, you create a new image.
3. **Tagged**: Images are identified by tags to track different versions.
4. **Shareable**: Images can be stored in registries and shared with others.

## Docker Image Naming Convention

Docker images follow a standard naming convention:

```
[registry/][username/]repository[:tag]
```

For example:

- `ubuntu:20.04`: Ubuntu image with tag 20.04
- `nginx:latest`: Nginx web server with the default "latest" tag
- `docker.io/mysql:8.0`: MySQL 8.0 from Docker Hub
- `gcr.io/tensorflow/tensorflow`: TensorFlow image from Google Container Registry

If you don't specify a tag, Docker assumes you want the `:latest` tag.

## Finding Docker Images

Docker Hub is the default public registry where you can find thousands of images. You can search for images directly on [Docker Hub](https://hub.docker.com/) or using the command line:

```bash
docker search nginx
```

This command returns a list of images related to Nginx:

```
NAME                              DESCRIPTION                                     STARS  OFFICIAL  AUTOMATED
nginx                             Official build of Nginx.                        16904  [OK]
...
```

## Pulling Docker Images

To download an image from a registry, use the `docker pull` command:

```bash
docker pull nginx:latest
```

This pulls the latest version of the official Nginx image. The output shows Docker downloading each layer of the image:

```
latest: Pulling from library/nginx
a603fa5e3b41: Pull complete
c39e1cda007e: Pull complete
90cfefba13f5: Pull complete
a38226fb7aba: Pull complete
5df5e7804d47: Pull complete
f9334680720f: Pull complete
Digest: sha256:2ab30d6ac53580a6db8b657abf0f68d75360ff5cc1670a85acb5bd85ba1b19c0
Status: Downloaded newer image for nginx:latest
docker.io/library/nginx:latest
```

## Listing Docker Images

To see the images you've pulled, run:

```bash
docker images
```

Or use the newer command:

```bash
docker image ls
```

The output shows all your available images:

```
REPOSITORY    TAG       IMAGE ID       CREATED         SIZE
nginx         latest    c919045c4c2b   5 days ago      142MB
ubuntu        20.04     54c9d81cbb44   2 weeks ago     72.8MB
hello-world   latest    feb5d9fea6a5   5 months ago    13.3kB
```

## Image Layers and Caching

One of Docker's most powerful features is its layer-based architecture. Each instruction in a Dockerfile creates a new layer.

To see the layers in an image, use:

```bash
docker history nginx:latest
```

Output:

```
IMAGE          CREATED      CREATED BY                                      SIZE      COMMENT
c919045c4c2b   5 days ago   /bin/sh -c #(nop)  CMD ["nginx" "-g" "daemon…   0B
<missing>      5 days ago   /bin/sh -c #(nop)  STOPSIGNAL SIGQUIT           0B
<missing>      5 days ago   /bin/sh -c #(nop)  EXPOSE 80                    0B
<missing>      5 days ago   /bin/sh -c #(nop)  ENTRYPOINT ["/docker-entr…   0B
...
```

When building or pulling images, Docker caches layers to improve efficiency. This makes subsequent builds and pulls much faster.

## Image Tags and Versioning

Tags help you manage different versions of the same image. You can add additional tags to an existing image:

```bash
docker tag nginx:latest mywebserver:v1
```

This creates a reference to the same image with a different name and tag.

To verify the new tag:

```bash
docker images
```

```
REPOSITORY    TAG       IMAGE ID       CREATED         SIZE
nginx         latest    c919045c4c2b   5 days ago      142MB
mywebserver   v1        c919045c4c2b   5 days ago      142MB
```

Notice both images have the same IMAGE ID because they point to the same content.

## Managing Disk Space

Docker images can consume substantial disk space. To see the total space used by Docker:

```bash
docker system df
```

To remove unused images:

```bash
docker image prune
```

This removes "dangling" images (those with no tags and not used by any container).

For a more aggressive cleanup that removes all unused images:

```bash
docker image prune -a
```

## Inspecting Images

To get detailed information about an image:

```bash
docker image inspect nginx:latest
```

This returns a JSON object with extensive information about the image, including its layers, configuration, environment variables, and more.

## Using Official vs Community Images

Docker Hub offers two primary types of images:

1. **Official images**: Maintained by Docker, Inc. or by the software's vendor, following best practices. Examples include `nginx`, `ubuntu`, and `node`.

2. **Community images**: Created and maintained by individual users or organizations. Their format is `username/image-name`.

For production use, prefer official images or well-maintained community images with good documentation and regular updates.

## Multi-Platform Images

Modern Docker supports images built for different CPU architectures. To see which platforms an image supports:

```bash
docker manifest inspect nginx:latest
```

When you pull an image, Docker automatically selects the version that matches your system's architecture.

## Saving and Loading Images

You can save images to a tarball file for offline transfer:

```bash
docker save nginx:latest -o nginx.tar
```

To load a saved image:

```bash
docker load -i nginx.tar
```

This is useful for transferring images to air-gapped environments or for backup purposes.

## Using DigitalOcean Container Registry

For team environments or production workloads, consider using a private registry like DigitalOcean Container Registry to store and share your custom images securely.

[Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) and get $200 in free credits to try their Container Registry service.

## Next Steps

Now that you understand how to work with Docker images, you're ready to start running containers from these images. In the next section, we'll cover how to create and manage Docker containers.
