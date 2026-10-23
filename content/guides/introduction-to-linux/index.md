---
title: 'Introduction to Linux'
seoTitle: 'Linux Tutorial for Beginners: Commands, Files, Users, Networking'
description: 'Learn Linux step by step: the command line, files and permissions, apt and dnf, users and sudo, processes, networking, Bash scripts and systemd.'
category:
  name: 'Linux'
  slug: 'linux'
publishedAt: '2025-05-14'
updatedAt: '2026-10-24'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Command Line
  - System Administration
  - Bash
  - Ubuntu
  - Open Source
---

Linux runs most of the servers on the internet, nearly every container, every Android phone and all of the world's fastest supercomputers. If you deploy software, operate infrastructure or debug production issues, sooner or later you sit in front of a Linux shell and need to find a log, free some disk space, restart a service or work out why a port does not answer.

This guide teaches those skills from the ground up. It starts with what Linux is and how to get a system to practise on, then covers the command line, the file system and permissions, installing software, users and `sudo`, processes and services, networking, Bash scripting, and the day-to-day work of running a server. Each part builds on the previous one, with a small practice website, its logs and a backup script that carry through from Part 3 to Part 10.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Basics", "sub": "Parts 1-2: what Linux is, install", "icon": "globe", "tone": "slate" },
    { "label": "Shell and files", "sub": "Parts 3-4: commands, permissions", "icon": "box", "tone": "blue" },
    { "label": "Software and users", "sub": "Parts 5-6: apt, dnf, sudo, SSH keys", "icon": "lock", "tone": "violet" },
    { "label": "Processes and network", "sub": "Parts 7-8: systemd, ip, ss, firewall", "icon": "net", "tone": "amber" },
    { "label": "Automate and operate", "sub": "Parts 9-10: Bash, timers, logs, security", "icon": "rocket", "tone": "green" }
  ]
}
```

## What You'll Learn

1. **[What Is Linux? The Kernel, Distributions and Their History](/guides/introduction-to-linux/01-understanding-linux-basics)**: the kernel and the software around it, distribution families, support lifetimes, and how to choose.
2. **[Getting Started: Install Linux in a VM, WSL, the Cloud or on Hardware](/guides/introduction-to-linux/02-getting-started)**: Multipass, VirtualBox, UTM, WSL, a cloud server or a dual boot, and the first steps after installing.
3. **[Linux Command Line Basics](/guides/introduction-to-linux/03-command-line-interface)**: moving around, managing files, reading logs, `find`, `grep`, pipes, redirection and exit codes.
4. **[Linux File System Hierarchy and File Permissions](/guides/introduction-to-linux/04-file-system-hierarchy)**: `/etc`, `/var`, `/usr` and `/proc`, `chmod` and `chown`, special bits, links, disk usage and mounting.
5. **[Package Management: apt, dnf, Snap and Flatpak](/guides/introduction-to-linux/05-package-management)**: install and update software, add third-party repositories the current way, and avoid broken systems.
6. **[User and Group Management](/guides/introduction-to-linux/06-user-management)**: `useradd`, groups, `/etc/passwd` and `/etc/shadow`, `sudo` rules, SSH keys and service accounts.
7. **[Process Management](/guides/introduction-to-linux/07-process-management)**: `ps`, `top`, signals, priorities, load and memory, systemd services and cgroups.
8. **[Networking in Linux](/guides/introduction-to-linux/08-networking)**: `ip`, `ss`, DNS, `tcpdump`, nftables, ufw and firewalld in a practice network you build yourself.
9. **[Bash Shell Scripting Basics](/guides/introduction-to-linux/09-shell-scripting)**: variables, quoting, conditions, loops, functions, error handling, ShellCheck, and a complete backup script.
10. **[Linux System Administration Basics](/guides/introduction-to-linux/10-system-administration)**: unit files, timers and cron, `journalctl`, automatic updates, backups, SSH hardening and troubleshooting.

## Which Versions This Guide Uses

The examples use **Ubuntu 24.04 LTS**, a long-term support release with security updates until May 2029, and point out where **Debian 13**, **Fedora 44** or **RHEL 10** differ. Everything also works on **Ubuntu 26.04 LTS**, with the differences noted where they matter (`sudo-rs` and the Rust core utilities).

| Component        | Version in the examples                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| Distribution     | Ubuntu 24.04.5 LTS; Fedora 44 for `dnf`                                          |
| Shell            | Bash 5.2                                                                         |
| Package managers | apt 2.8 (Ubuntu 24.04), apt 3.0 (Debian 13), DNF5 (Fedora 44), DNF 4 (RHEL 10)   |
| Init system      | systemd 255 on Ubuntu 24.04                                                      |
| Kernel           | whatever your distribution ships; Linux 7.3 is the newest release (October 2026) |

Terminal output in this guide comes from real runs, mostly in a fresh Ubuntu 24.04.5 image, with the user `dev` on a host called `devbox`. Output that needs systemd or the SSH server comes from a Debian 12 machine and is marked. Commands that change a whole system, such as rebooting or enabling a service, are shown with example output and say so.

### What Changed Since Older Linux Tutorials

Many Linux tutorials on the web were written for releases that are long out of support. These are the changes that trip people up most:

| Old way                                       | Current way                                                                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apt-key add` for third-party repositories    | A keyring file and `Signed-By` in a deb822 `.sources` file; `apt-key` is gone in Debian 13 and Ubuntu 25.04 and later ([Part 5](/guides/introduction-to-linux/05-package-management)) |
| `ifconfig`, `netstat`, `route`                | `ip addr`, `ss`, `ip route` ([Part 8](/guides/introduction-to-linux/08-networking))                                                                                                   |
| `iptables` rules                              | nftables (`nft`), or ufw and firewalld on top of it                                                                                                                                   |
| `/var/log/syslog` everywhere                  | `journalctl`; Debian 12 and later no longer install rsyslog by default ([Part 10](/guides/introduction-to-linux/10-system-administration))                                            |
| cgroup v1 paths and `MemoryLimit=`            | cgroup v2 and `MemoryMax=` ([Part 7](/guides/introduction-to-linux/07-process-management))                                                                                            |
| cron for every scheduled job                  | systemd timers, with cron still available                                                                                                                                             |
| `/bin` and `/usr/bin` as separate directories | merged `/usr`: `/bin` is a link to `/usr/bin` ([Part 4](/guides/introduction-to-linux/04-file-system-hierarchy))                                                                      |
| `yum`                                         | `dnf`, with DNF5 on Fedora 41 and later                                                                                                                                               |
| `pip install` into the system Python          | virtual environments or `pipx`; system Python is "externally managed"                                                                                                                 |
| Classic `sudo`                                | `sudo-rs` on Ubuntu 25.10 and 26.04 LTS, same commands                                                                                                                                |
| netplan `gateway4:` and RHEL `ifcfg` files    | netplan `routes:`, and NetworkManager keyfiles on RHEL 10                                                                                                                             |

## Who This Guide Is For

- Developers who want to understand the systems their code runs on.
- People moving into DevOps, SRE, cloud or platform engineering.
- Administrators coming from Windows who need to manage Linux servers.
- Students and anyone curious about Linux.

You need no Linux experience. You need a computer where you can install a virtual machine or WSL, or an account with a cloud provider ([Part 2](/guides/introduction-to-linux/02-getting-started) covers all three), and the patience to type the commands yourself rather than only read them.

## How to Practise

- Type every command. Change the examples and see what breaks.
- Use a VM or a cloud server you can throw away, and take snapshots before risky changes.
- Read error messages to the end: most of them say exactly what is wrong.
- When a command is new, run it with `--help` or read its manual page (`man`).

## Practice Hands-On

Try commands in the [Linux Terminal simulator](/games/linux-terminal) right in your browser, with no setup, and test yourself with the [Linux Command Line Quiz](/quizzes/linux-quiz) and the [Linux Fundamentals flashcards](/flashcards/linux-fundamentals).

## Keep Learning

- [Introduction to Bash](/guides/introduction-to-bash), to go deeper into scripting
- [Networking Fundamentals](/guides/networking-fundamentals), for TCP/IP, DNS and routing in depth
- [Introduction to Docker](/guides/introduction-to-docker), the natural next step after this guide
- Exercise: [Securing your Linux server](/exercises/linux-server-security)
