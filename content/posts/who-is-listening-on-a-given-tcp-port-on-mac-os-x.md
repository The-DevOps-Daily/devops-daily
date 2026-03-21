---
title: 'Who is Listening on a Given TCP Port on Mac OS X?'
excerpt: "Need to find out which process is using a specific port on your Mac? Here's how to check which application is listening on a TCP port using built-in macOS tools."
category:
  name: 'Networking'
  slug: 'networking'
date: '2024-10-12'
publishedAt: '2024-10-12T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '4 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - macOS
  - TCP
  - Networking
  - Troubleshooting
  - Ports
---

When working with local development environments, you might occasionally hit an error like `port already in use`. To resolve it, you'll need to figure out which process is listening on that port. macOS includes everything you need to do this from the terminal.

In this guide, you'll learn how to check which process is listening on a specific TCP port using built-in tools like `lsof` and `netstat`.

## Prerequisites

To follow along, you'll need:

- A Mac running macOS (tested on macOS Ventura and above)
- Access to the Terminal
- A specific TCP port you'd like to check, e.g. `3000`

No additional software is needed.

## Step 1: Use `lsof` to Check Port Usage

The `lsof` command is the quickest way to see what's listening on a port. It lists open files, and on Unix systems, network sockets are treated as files too.

To check what's using TCP port 3000:

```bash
sudo lsof -iTCP:3000 -sTCP:LISTEN
```

**Explanation**:

- `-iTCP:3000` filters for TCP port 3000.
- `-sTCP:LISTEN` shows only processes that are actively listening (not just connected).

**Example output**:

```text
COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     2345 youruser   23u  IPv6 0x7f9eabc123456789      0t0  TCP *:3000 (LISTEN)
```

Here, the Node.js process with PID 2345 is listening on port 3000.

## Step 2: Use `netstat` as an Alternative

If `lsof` doesn't give you enough detail, you can fall back to `netstat`.

Run the following:

```bash
sudo netstat -anv | grep LISTEN | grep '\.3000'
```

This looks for lines with `LISTEN` that include `.3000`, which identifies TCP port 3000.

You might see something like:

```text
tcp46      0      0  *.3000                 *.*                    LISTEN
```

To match that port with a process, run:

```bash
sudo lsof -nP | grep LISTEN | grep 3000
```

This gives a full list of listening processes, including port numbers and PIDs.

## Step 3: Kill the Process (Optional)

Once you've identified the PID of the process using the port, you can stop it using `kill`:

```bash
kill -9 <PID>
```

For example:

```bash
kill -9 2345
```

**Note**: Use `kill -9` only if the process doesn't terminate cleanly with a regular `kill`. It forces termination, which might not allow the process to clean up resources.

## Bonus: Free Up the Port Automatically

If this happens often in your development workflow, consider adding a small alias to your shell profile (e.g., `.zshrc` or `.bash_profile`):

```bash
alias freeport="lsof -nP -iTCP -sTCP:LISTEN"
```

Now you can run:

```bash
freeport | grep 3000
```

And quickly see what's in the way.

---

If you're frequently switching between projects that use the same ports, these tools can save you a lot of time. You might also consider using tools like `devctl`, `direnv`, or Docker to isolate local environments and avoid port collisions altogether.
