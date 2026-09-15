---
title: 'Linux, Git, Docker: Why That Order Matters'
excerpt: 'Every DevOps roadmap lists the same tools. Almost none of them explain why the order is not arbitrary, or why learning Docker first makes containers feel like magic. Three steps, each one runnable in a terminal, each one making the next one obvious.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-15'
publishedAt: '2026-09-15T16:00:00Z'
updatedAt: '2026-09-15T16:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Linux
  - Git
  - Docker
  - Career
---

Every roadmap gives you the same list. Linux, Git, Docker, then a cloud, then Kubernetes, then something with the word "observability" in it. The lists are not wrong. They are just presented as a checklist, and a checklist does not tell you the thing that actually matters, which is that **each item only makes sense once the one before it is in your hands**.

Learn Docker before Linux and containers are magic. Magic is not a compliment here: it means you cannot debug it, because you have no model of what it is doing. Learn Git after six months of copying folders to `project-final-v2-REAL` and it is ceremony you resent.

This post is three steps. Each one is a handful of commands you can run right now, and each one exists to make the next one obvious rather than magical. The commands below were really run, and the output is what came back.

## TLDR

- **Linux first**, because everything above it is a process that owns some files. If those two words are not concrete to you, nothing above them can be.
- **Git second**, and learn it by breaking something and getting it back. That is the entire value proposition and it takes one minute to feel.
- **Docker third**, at which point it stops being magic: it is the same process you already met, with its own view of the machine.
- The payoff: the same script, on a host and in a container, reporting **pid 209964** and **pid 1**, and seeing **155 processes** against **3**.
- You do not need a cloud account, a course, or a Kubernetes cluster to do any of this.

## Prerequisites

- A Linux machine or a virtual machine. A cheap VPS, WSL on Windows, or a Raspberry Pi all work.
- Docker for the third step only.
- No prior experience. That is the point.

## Step one: a program is a process that owns some files

Not a definition to memorise. Something to watch.

```bash
cat > greet.sh <<'EOF'
#!/bin/sh
echo "hello from $(hostname), pid $$"
EOF
chmod +x greet.sh
./greet.sh
```

```terminal
{
  "title": "your first process",
  "prompt": "$",
  "steps": [
    { "cmd": "./greet.sh", "output": "hello from bobbyiliev, pid 209861\n  this shell sees 153 processes" }
  ]
}
```

Four things just happened that are worth more than any tutorial video.

**`chmod +x` was necessary.** A file is not a program because of its name or extension; it is a program because a permission bit says it may be executed. That is why the file you downloaded will not run.

**`$$` is the process id.** Your script became a process with a number, one of a couple of hundred the machine is running. Run it again and the number changes, because that process is gone and a new one exists.

**`$(hostname)` is the machine identifying itself.** Remember this line. It is the one that makes step three click.

**`/proc` is how the machine describes itself.** Counting the numbered directories in it counts the running processes, because Linux exposes its own state as files. This is why "everything is a file" is not a slogan.

You now have the two words that everything else is built on: **process** and **file**. Do not move on until the commands above feel boring. Boring is the goal.

## Step two: the point of Git is undoing your own mistakes

Every Git tutorial starts with `add`, `commit`, `push`, and a beginner reasonably concludes it is paperwork. The reason to use it never arrives, because nothing has gone wrong yet.

So let something go wrong on purpose.

```bash
git init
git add greet.sh && git commit -m "A script that greets"

echo 'rm -rf /' > greet.sh    # destroy it
cat greet.sh

git checkout -- greet.sh      # get it back
cat greet.sh
```

```terminal
{
  "title": "break it, then get it back",
  "prompt": "$",
  "steps": [
    { "comment": "commit, destroy the file, recover it" },
    { "cmd": "sh break-and-recover.sh", "output": "committed: 1c42e47 A script that greets\n  file now says: rm -rf /\n  after git checkout: echo \"hello from $(hostname), pid $$\"" }
  ]
}
```

That is the whole idea, and everything else in Git is machinery for doing it in more complicated situations: across a team, across months, across a mistake somebody else made.

Notice what `commit` actually bought. It was not a backup of a file. It was a **point you can return to**, and the sixty seconds you just spent are worth more than a long explanation of the staging area. Learn branches, remotes and merges after this, when you have a reason to want them.

**The order matters here too.** You needed step one to know that `greet.sh` is a file with contents and permissions, because that is the thing Git is tracking. Git is not tracking "your project". It is tracking files.

## Step three: a container is that same process, with its own view

Now Docker, and it should be underwhelming rather than magical.

```dockerfile
FROM alpine:3.22
COPY greet.sh /greet.sh
CMD ["/greet.sh"]
```

Three lines. Start from a minimal Linux, copy in the file from step one, say what to run. Build it and run the same script both ways:

```terminal
{
  "title": "the same script, twice",
  "prompt": "$",
  "steps": [
    { "comment": "on the host, then in a container" },
    { "cmd": "docker build -t journey-demo . && docker run --rm journey-demo", "output": "on the host:      hello from bobbyiliev, pid 209964\n  in the container: hello from 162f4d24197a, pid 1\n  host sees 155 processes, the container sees 3" }
  ]
}
```

Read those three lines slowly, because they are the whole concept.

**The hostname changed.** On the host the script says `bobbyiliev`. In the container it says `162f4d24197a`, a random id. Same script, same `hostname` command, different answer, because the container has its own idea of what machine it is on.

**The pid went from 209964 to 1.** On the host your script was one process among many, with a large number. In the container it is **process 1**, the first process, as though the machine had just booted. It is not a different kind of thing from step one. It is the same kind of thing with its own numbering.

**The host sees 155 processes and the container sees 3.** Everything running on that machine is still running. The container just cannot see it.

That is a container: **a normal Linux process that has been given its own view of the hostname, the process list and the filesystem.** Not a small virtual machine, not a magic box. If you did step one, you already know what a process and a file are, so there is nothing left to be mystified by.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "file", "sub": "with a permission bit", "icon": "box", "tone": "slate" },
    { "label": "process", "sub": "a pid, running", "icon": "cpu", "tone": "blue" },
    { "label": "tracked", "sub": "a point to return to", "icon": "branch", "tone": "violet" },
    { "label": "contained", "sub": "its own view, still a process", "icon": "gear", "tone": "green" }
  ]
}
```

## What to do next, and what to skip

**Next, in this order:**
- **Get comfortable in the shell.** `ps`, `ls`, `cat`, `grep`, pipes, and reading a path. Not because they are impressive, but because every error message above you assumes them.
- **Break things in Git deliberately.** Commit, branch, make a mess, recover. Do it while nothing is at stake.
- **Put something you wrote in a container** and run it somewhere that is not your laptop. A one dollar VPS is enough.
- **Then pick one cloud**, and learn it by putting that same container on it.

**Skip, for now:**
- **Kubernetes.** It is an answer to a question you have not been asked yet, which is roughly "how do I run a thousand of these across fifty machines". Running one container on one machine first is not a detour, it is the prerequisite.
- **Certifications.** Later, and for the job market rather than the learning.
- **The tool comparison arguments.** Whether you use one editor or another matters far less than whether you can read what the error is telling you.

## Summary

The reason these three come in this order is not tradition. Step one gives you the two nouns, a process and a file. Step two is about protecting files, which requires knowing what a file is. Step three is about isolating a process, which requires knowing what a process is.

Learn them in that order and Docker is obvious by the time you reach it. Learn them out of order and each one is a black box you are asked to trust.

Everything above takes about half an hour. The half hour where `pid 1` stops being trivia and starts being the thing that explains containers is the one worth having.
