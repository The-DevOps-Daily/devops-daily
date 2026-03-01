---
title: 'Using ls to list directories and their total sizes'
excerpt: 'How to show directory sizes from the shell - practical commands for macOS and Linux, and why `ls` alone is not enough.'
category:
  name: 'Shell'
  slug: 'shell'
date: '2025-04-22'
publishedAt: '2025-04-22T09:00:00Z'
updatedAt: '2025-04-22T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - macOS
  - CLI
  - du
  - ls
---

## TLDR

`ls` does not report the total size of a directory's contents - it reports metadata about the directory entry. To get directory sizes use `du` (disk usage) and combine it with `sort` or `ls`-style output if you need human-readable listings. This post shows practical commands for GNU/Linux and macOS, how to list directories only, and common pitfalls to watch for.

Working at the shell you might instinctively try `ls -lh` to learn which directories are taking space. That leads to confusion because `ls` shows the directory entry size, not the sum of files inside. Use `du` to measure contents and then sort or format the output so it looks familiar.

## Prerequisites

- A POSIX-like shell (bash, zsh).
- `du` and `sort` are available on macOS and Linux by default. GNU `du` (Linux) and BSD `du` (macOS) have slightly different flags - I show both variants below.

## Quick: human-friendly directory totals (recommended)

Before the code: this lists the size of each item in the current directory and sorts them smallest to largest. It works on both macOS and Linux.

```bash
# list sizes of items in current directory, human-readable, sorted by size
# - du: estimate file space usage
# - -sh: summarize each path and print sizes in human readable form
# - *: expands to all non-hidden items
# - sort -h: sort by human-readable numbers

du -sh * 2>/dev/null | sort -h
```

- What this does: prints one line per entry like "4.0K ./bin" and sorts by size.
- Why it matters: quick and reliable way to see which directories (and files) use space.

## Show only directories

Before the code: filter the results to directories only. This uses `find` to restrict to directories and `du -sh` to size them.

```bash
# GNU and BSD compatible: find directories at depth 1 and show their sizes
find . -maxdepth 1 -type d -print0 | xargs -0 du -sh 2>/dev/null | sort -h
```

- What this does: finds only first-level directories (including `.`), sizes them, and sorts the output.
- Why it matters: avoids listing files, which is useful if you only care about directory totals.

## Recursive view with depth (GNU vs macOS)

Before the code: get sizes of top-level directories with a single command. Flags differ between GNU and BSD variants.

```bash
# GNU (Linux): show human sizes, only depth 1
du -h --max-depth=1 | sort -h

# BSD (macOS): show human sizes, only depth 1
du -h -d 1 | sort -h
```

- What this does: prints cumulative sizes for the current directory and its immediate children.
- Why it matters: a concise tree-like view of where space is going.

## Add a familiar ls-like column layout

Before the code: if you prefer a two-column layout similar to `ls -lh`, transform `du` output to align columns.

```bash
# align columns: size and name
du -sh * 2>/dev/null | sort -h | awk '{printf "%-8s %s\n", $1, $2}'
```

- What this does: sorts the sizes and prints a formatted column with size then name.
- Why it matters: easier to scan when you want a neat table in scripts or notes.

## Handling hidden files and permission errors

Hidden files starting with a dot are not matched by `*`. To include them use a shell expansion or `find`:

```bash
# include hidden entries (bash/zsh): dotglob on bash or use this pattern in zsh
# bash: shopt -s dotglob; du -sh * .[!.]* ..?*; shopt -u dotglob
# portable: use find at depth 1
find . -mindepth 1 -maxdepth 1 -print0 | xargs -0 du -sh 2>/dev/null | sort -h
```

Permissions can block `du` from reading subdirectories. You may see "Permission denied" messages - redirect stderr to /dev/null if you prefer a clean list, but investigate denied paths when you expect to be able to read them.

## Why `ls` alone is misleading

- `ls -ld some_dir` prints the size of the directory inode - this is not the sum of files inside.
- `stat` also reports filesystem metadata, not recursive totals.

Example that confuses people:

```bash
# shows directory entry size, not content size
ls -ld mydir
stat mydir
```

If you need the contents' total, use `du` as shown above.

## Useful scripts and aliases

Before the code: a small shell alias you can add to `~/.zshrc` or `~/.bashrc` for convenience.

```bash
# add to shell config (zsh or bash)
# 'ds' for directory sizes in current folder
alias ds='du -sh -- * 2>/dev/null | sort -h'

# macOS variant (BSD du uses -d)
alias ds_mac='du -h -d 1 | sort -h'
```

- What this does: gives a quick command `ds` to inspect sizes.
- Why it matters: small ergonomics change that saves time in daily work.

## ASCII workflow - quick mental model

```
list entries -> size them with du -> sort by human numbers -> display
   |                |                      |
  shell           du(estimate)          sort -h
```

## Short practical conclusion

Use `du` for directory totals and combine it with `sort -h` to get readable, ordered results. Use `find` and `xargs` when you want to restrict to directories or include hidden entries. Add a small alias if you run this often so you can check disk usage at a glance.

Next steps you can explore: pipe the output into monitoring scripts, use `ncdu` for interactive exploration, or integrate these commands into periodic disk usage reports.
