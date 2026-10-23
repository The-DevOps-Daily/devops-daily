---
title: 'What Is Linux? The Kernel, Distributions and Their History'
description: 'What Linux is: the kernel and the software around it, how distributions differ, a short history from Unix to Linux 7, and how to choose a distribution.'
order: 1
---

Linux runs most of the internet's servers, every Android phone, almost every container, all of the world's 500 fastest supercomputers, and a large share of routers, TVs and cars. If you work in DevOps, cloud or backend development, Linux is the system your code ends up on, even when your laptop runs macOS or Windows.

This part explains what "Linux" actually means, what a distribution adds, where Linux came from, and how to pick a distribution. The rest of the guide is hands-on.

## What Linux Is

Strictly speaking, **Linux is a kernel**: the program that starts first, talks to the hardware, and shares the CPU, memory, disks and network between all other programs. Linus Torvalds started it in 1991, and thousands of developers and companies maintain it today.

A kernel alone is not usable. You also need a shell, basic commands (`ls`, `cp`, `grep`), a C library, an init system that starts services, a package manager, and often a graphical desktop. A **Linux distribution** ("distro") puts all of that together, tests it, and ships updates. When people say "I run Linux", they mean a distribution such as Ubuntu, Debian, Fedora or Red Hat Enterprise Linux.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "apps", "label": "Applications", "sub": "nginx, Postgres, your code", "icon": "box", "tone": "blue", "detail": "Programs you install with the package manager or deploy yourself. They never touch the hardware directly." },
      { "id": "tools", "label": "Shell and tools", "sub": "bash, coreutils, ssh", "icon": "gear", "tone": "slate", "detail": "The command-line environment from Part 3. On most distributions these come from the GNU project; Ubuntu 25.10 and later use the Rust uutils for most core commands." },
      { "id": "init", "label": "systemd", "sub": "PID 1, services, logs", "icon": "activity", "tone": "violet", "detail": "The first process. It starts and supervises services, collects logs and manages resources (Parts 7 and 10)." }
    ],
    [
      { "id": "libc", "label": "C library", "sub": "glibc or musl", "icon": "branch", "tone": "amber", "detail": "Turns normal function calls such as open() and connect() into system calls. glibc on most distributions, musl on Alpine." }
    ],
    [
      { "id": "kernel", "label": "Linux kernel", "sub": "processes, memory, files, network, drivers", "icon": "cpu", "tone": "accent", "detail": "The only software that talks to the hardware. Everything above asks it for resources through system calls." }
    ],
    [
      { "id": "hw", "label": "Hardware", "sub": "CPU, RAM, disks, NICs", "icon": "server", "tone": "slate", "detail": "Physical or virtual: a laptop, a server, or a cloud VM." }
    ]
  ],
  "edges": [["apps", "libc"], ["tools", "libc"], ["init", "libc"], ["libc", "kernel", "system calls"], ["kernel", "hw", "drivers"]]
}
```

### What the Kernel Does

- **Processes**: it starts programs, decides which one runs on which CPU and for how long, and keeps them apart (Part 7).
- **Memory**: each process gets its own address space; the kernel maps it to physical RAM and swap, and uses spare RAM as a disk cache.
- **Files**: it provides one directory tree on top of many file systems and devices (Part 4).
- **Networking**: interfaces, routing, firewalling and the TCP/IP stack live in the kernel (Part 8).
- **Hardware**: drivers for disks, network cards, USB, GPUs and everything else, most of them in the kernel source tree.
- **Isolation**: namespaces and cgroups, the features containers are built on.

Programs ask the kernel for all of this through **system calls**, such as `open`, `read`, `fork` and `connect`. Code that runs in the kernel is in **kernel space**; everything else, including root's programs, runs in **user space**.

You can ask a running system what it is:

```terminal
{
  "title": "which Linux is this?",
  "prompt": "$",
  "steps": [
    {
      "comment": "kernel name, operating system and hardware architecture",
      "cmd": "uname -s -o -m",
      "output": "Linux aarch64 GNU/Linux"
    },
    {
      "cmd": "head -n 4 /etc/os-release",
      "output": "PRETTY_NAME=\"Ubuntu 24.04.5 LTS\"\nNAME=\"Ubuntu\"\nVERSION_ID=\"24.04\"\nVERSION=\"24.04.5 LTS (Noble Numbat)\""
    }
  ]
}
```

`aarch64` is 64-bit ARM, as on a Raspberry Pi, AWS Graviton or an Apple Silicon Mac running a Linux VM; most PCs and cloud servers show `x86_64`. `uname -r` prints the kernel version.

### GNU/Linux, Android and Other Combinations

Most of the classic command-line tools on a Linux distribution come from the **GNU project**, which Richard Stallman started in 1983 to build a free Unix-like system. That is why some people say **GNU/Linux** and why `uname -o` prints it. The combination is not fixed, though:

- **Alpine Linux**, popular for small container images, uses BusyBox and the musl C library instead of the GNU tools and glibc.
- **Android** uses the Linux kernel with a completely different user space.
- **Ubuntu 25.10 and later** replaced most of the GNU core utilities with uutils, a rewrite in Rust (all of them from 26.10 on), and `sudo` with sudo-rs.

## A Short History

| Year         | Event                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| 1969         | Ken Thompson and Dennis Ritchie create Unix at Bell Labs                                                        |
| 1983         | Richard Stallman announces the GNU project                                                                      |
| 1987         | Andrew Tanenbaum publishes MINIX, a small Unix-like teaching system                                             |
| 1991         | Linus Torvalds, a student in Helsinki, announces his kernel on 25 August and releases version 0.01 in September |
| 1992         | Linux moves to the GNU General Public License (GPL) version 2, which it still uses                              |
| 1993         | Slackware and Debian, two of the oldest distributions still maintained, appear                                  |
| 1994         | Linux 1.0                                                                                                       |
| 2003 to 2004 | Red Hat splits into Fedora (community) and Red Hat Enterprise Linux; Ubuntu's first release                     |
| 2008         | The first Android phone ships                                                                                   |
| 2013         | Docker makes Linux containers mainstream                                                                        |
| 2017         | Every system on the TOP500 supercomputer list runs Linux, as they all have since                                |
| 2024         | CentOS Linux reaches its end of life; Rocky Linux and AlmaLinux continue as free RHEL rebuilds                  |
| 2026         | Linux 7.0 (April); Linux 7.3 is the current release as of 18 October 2026                                       |

The jump from 6.19 to 7.0 did not mean a big change. Torvalds raises the first number when the second one gets large. A new kernel version comes out every nine to ten weeks, and selected versions become **long-term support** (LTS) kernels with fixes for several years; 6.12 and 6.18 are current examples. Distributions ship their own tested kernel builds and backport security fixes, so a server's kernel version is usually older than the newest release on kernel.org, and that is expected.

## Distributions

Every distribution makes its own choices:

- **Package format and manager**: `.deb` with `apt`, `.rpm` with `dnf` or `zypper`, `pacman`, `apk` ([Part 5](/guides/introduction-to-linux/05-package-management)).
- **Release model**: **fixed releases** (a new version every six months to two years, with only fixes in between) or **rolling releases** (continuous updates to the newest versions).
- **Support lifetime**: from about a year to ten years or more.
- **Defaults**: desktop environment, file system, firewall tool, security framework (AppArmor or SELinux).

| Family      | Distributions                                                                         | Notes                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Debian      | Debian, Ubuntu, Linux Mint, Pop!\_OS, Raspberry Pi OS                                 | The largest family. Ubuntu is the most common cloud image                                                         |
| Red Hat     | RHEL, Fedora, CentOS Stream, Rocky Linux, AlmaLinux, Oracle Linux, Amazon Linux       | Standard in many enterprises. Fedora is the upstream for RHEL; CentOS Stream previews the next RHEL minor release |
| SUSE        | SUSE Linux Enterprise, openSUSE Leap and Tumbleweed                                   | Common in Europe and SAP environments                                                                             |
| Arch        | Arch Linux, Manjaro, EndeavourOS                                                      | Rolling releases, do-it-yourself installation                                                                     |
| Independent | Alpine (containers), NixOS (declarative configuration), Gentoo (compiled from source) | Specialised use cases                                                                                             |

### Support Lifetimes of the Main Server Distributions

| Release                      | Released         | Security updates until                         |
| ---------------------------- | ---------------- | ---------------------------------------------- |
| Ubuntu 24.04 LTS             | April 2024       | May 2029 (to 2034 with Ubuntu Pro)             |
| Ubuntu 26.04 LTS             | April 2026       | May 2031 (to 2036 with Ubuntu Pro)             |
| Debian 13 "trixie"           | August 2025      | August 2028, then Debian LTS until June 2030   |
| Debian 12 "bookworm"         | June 2023        | In Debian LTS since July 2026, until June 2028 |
| RHEL 10 (and Rocky, Alma 10) | May 2025         | May 2035                                       |
| Fedora                       | every six months | about 13 months per release                    |
| Amazon Linux 2023            | March 2023       | June 2029 (Amazon Linux 2 ended in June 2026)  |

Run a release that still gets security updates, and plan the upgrade before support ends.

### Which Distribution Should You Use?

- **Learning Linux for DevOps and cloud work**: Ubuntu Server 24.04 LTS or 26.04 LTS. It is the most common image on every cloud, and most tutorials assume it. This guide uses Ubuntu 24.04 LTS for its examples, with Debian 13 and Fedora or RHEL 10 where they differ.
- **Servers where the vendor or your company requires support**: RHEL, SUSE Linux Enterprise or Ubuntu Pro. For free RHEL-compatible servers: Rocky Linux or AlmaLinux.
- **Stable servers without a vendor**: Debian.
- **Desktop or laptop**: Ubuntu, Fedora Workstation or Linux Mint.
- **Container images**: Debian slim or Ubuntu for compatibility, Alpine or distroless images when size matters more than convenience.

The skills transfer. Package commands and a few configuration paths differ between families; the shell, files, processes, users, networking and systemd work the same.

## Where Linux Runs

- **Web servers**: W3Techs counts Linux on 63.2% of the websites whose operating system it can identify, and Unix-like systems (Linux plus servers it can only identify as "Unix") on 92.2% (23 October 2026).
- **Supercomputers**: all 500 systems on the TOP500 list have run Linux since November 2017.
- **Phones**: Android uses the Linux kernel.
- **Cloud and containers**: most cloud VMs run Linux, and the containers you build with Docker or run on Kubernetes are Linux containers, built from Linux kernel features. Docker Desktop on macOS and Windows runs a small Linux VM to provide them, and WSL 2 on Windows is a real Linux kernel in a VM.
- **Embedded devices**: routers, TVs, cars, set-top boxes and single-board computers.

## Open Source and Licenses

The kernel's source code is public and licensed under the **GPL version 2**: anyone may use, study, change and redistribute it, and whoever distributes a changed version must publish the source under the same license. Much of the rest of a distribution uses the GPL too, and many other projects use permissive licenses such as MIT, BSD or Apache 2.0, which do not require that.

For you as a user, this means you can read exactly what the system does, fix or work around problems yourself, and choose between many distributions built from the same code.

## Thinking the Linux Way

A few ideas run through the whole system and through the rest of this guide:

- **Small tools that do one job**, combined with pipes into bigger ones (Part 3).
- **Everything is a file**: devices, processes and kernel settings appear as files under `/dev`, `/proc` and `/sys` (Part 4).
- **Configuration is plain text** in `/etc`, so you can read it, diff it, keep it in Git and change it with scripts.
- **Automate what you repeat**: a command you typed twice belongs in a script (Part 9) or a configuration tool.
- **Least privilege**: work as a normal user and use `sudo` only when needed (Part 6).

## Common Misconceptions

- **"Linux is hard to use."** Modern desktop distributions install in minutes. The command line takes practice, which is what this guide is for.
- **"Linux and Unix are the same."** Linux is a Unix-like clone written from scratch; macOS and the BSDs are closer to the original Unix family. The commands are similar, but options and paths often differ.
- **"Containers mean I do not need Linux skills."** A Linux container is a Linux process isolated with namespaces and cgroups. Debugging one needs exactly the skills in Parts 3 to 8.
- **"The newest kernel is always better."** Servers run the kernel their distribution tests and patches.

## Summary

- Linux is a kernel; a distribution adds the tools, libraries, init system, package manager and updates.
- The kernel manages processes, memory, files, networking and hardware; programs use it through system calls.
- Distributions differ in package manager, release model and support lifetime. Ubuntu LTS, Debian and RHEL-compatible systems dominate servers.
- Linux is licensed under the GPL version 2 and developed in the open.

Next: [Getting Started with Linux](/guides/introduction-to-linux/02-getting-started), where you get a Linux system to practise on.

## Keep Learning

- Try commands in the browser: [Linux Terminal simulator](/games/linux-terminal)
- [Linux Fundamentals flashcards](/flashcards/linux-fundamentals)
- [Linux Command Line Quiz](/quizzes/linux-quiz)
