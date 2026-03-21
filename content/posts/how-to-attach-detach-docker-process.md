---
title: "How Do You Attach and Detach from Docker's Process?"
excerpt: "Learn how to attach to a running Docker container's process, interact with it, and safely detach without stopping the container. Includes keyboard shortcuts, practical examples, and troubleshooting tips."
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-04-20'
publishedAt: '2025-04-20T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Containers
  - Terminal
  - DevOps
---

## TLDR

You can "attach" to a running Docker container to view its output or interact with its main process using `docker attach <container>`. To detach without stopping the container, use the keyboard shortcut `Ctrl-p` then `Ctrl-q`. This lets the container keep running in the background.

## Why Attach to a Container?

Attaching is useful when you want to:

- See real-time logs or output from the main process
- Interact with a shell or foreground process
- Debug or monitor a running container

## How to Attach to a Running Container

To attach to a running container, use:

```bash
docker attach <container-name-or-id>
```

This connects your terminal to the container's main process (usually PID 1). You'll see its standard output and can interact if it's a shell or interactive app.

**Example:**

```bash
docker run -it --name demo ubuntu bash
# In another terminal:
docker attach demo
```

Now, anything typed in the attached terminal is sent to the container's shell.

## How to Detach Without Stopping the Container

To safely detach and leave the container running, use this keyboard sequence:

```
Ctrl-p Ctrl-q
```

- Hold `Ctrl`, press `p`, then press `q` (release `Ctrl` after).
- Your terminal returns to the host shell, and the container keeps running.

## What Happens If You Use Ctrl-c?

Pressing `Ctrl-c` sends an interrupt signal (SIGINT) to the container's main process. This usually stops the process and the container exits. Use `Ctrl-p Ctrl-q` to detach instead if you want the container to keep running.

## Reattaching and Multiple Attachments

- You can attach again later with `docker attach <container>`.
- Multiple terminals can attach to the same container, but input/output may get mixed.
- For a new shell session, use `docker exec -it <container> bash` instead of attach.

## Troubleshooting

- If you can't detach, check if your terminal is capturing the key sequence (try a different terminal or SSH session).
- If the container stops when you detach, you may have pressed `Ctrl-c` or the main process exited.
- For containers started with `-d` (detached mode), you can still attach later.

## Conclusion

Attaching and detaching from Docker containers is a handy way to interact with running processes. Remember to use `Ctrl-p Ctrl-q` to detach safely, and use `docker exec` for new shell sessions without interfering with the main process.


## Related Resources

- [Enter Docker Container with New TTY](/posts/enter-docker-container-new-tty) — interactive sessions
- [How to Access Docker Container Shell](/posts/how-to-access-docker-container-shell) — shell methods
- [Docker TTY Error Fix](/posts/docker-tty-error-fix) — troubleshoot TTY issues
- [Introduction to Docker Guide](/guides/introduction-to-docker) — Docker fundamentals
