---
title: 'Linux File System Hierarchy and File Permissions Explained'
description: 'What lives in /etc, /var, /usr and /proc, how Linux file permissions and chmod work, plus links, inodes, disk usage and mounting file systems.'
order: 4
---

Windows gives every disk its own letter. Linux has a single directory tree that starts at `/`, the **root directory**, and every disk, USB stick and network share appears somewhere inside it. Configuration lives in plain text files under `/etc`, logs under `/var/log`, programs under `/usr`, and the kernel shows its own state as files under `/proc` and `/sys`. Once you know the layout, you know where to look on any distribution.

The second half of this part covers **permissions**: who may read, change or run each file. Most "Permission denied" errors you will ever see make sense once you can read the ten characters at the start of `ls -l`.

## Prerequisites

- The commands from [Part 3](/guides/introduction-to-linux/03-command-line-interface): `cd`, `ls`, `mkdir`, `touch` and `find`.
- A Linux shell. The output below comes from Ubuntu 24.04.5 LTS; the layout is the same on Debian, Fedora and RHEL.
- A fresh `~/lab` from [Part 3](/guides/introduction-to-linux/03-command-line-interface#h2-set-up-the-practice-directory) (`rm -rf ~/lab && bash ~/make-lab.sh`), so your output matches.

## One Tree, Starting at /

```terminal
{
  "title": "the top of the tree",
  "prompt": "$",
  "steps": [
    {
      "cmd": "ls /",
      "output": "bin\nbin.usr-is-merged\nboot\ndev\netc\nhome\nlib\nmedia\nmnt\nopt\nproc\nroot\nrun\nsbin\nsbin.usr-is-merged\nsrv\nsys\ntmp\nusr\nvar"
    },
    {
      "comment": "on current distributions, /bin, /sbin and /lib are links into /usr",
      "cmd": "ls -ld /bin /sbin /lib",
      "output": "lrwxrwxrwx 1 root root 7 Apr 22  2024 /bin -> usr/bin\nlrwxrwxrwx 1 root root 7 Apr 22  2024 /lib -> usr/lib\nlrwxrwxrwx 1 root root 8 Apr 22  2024 /sbin -> usr/sbin"
    }
  ]
}
```

The layout follows the **Filesystem Hierarchy Standard** (FHS 3.0), and systemd documents the same conventions in `man file-hierarchy`. These are the directories you will visit most:

| Directory           | What it holds                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/etc`              | System-wide configuration, almost all of it plain text: `/etc/hosts`, `/etc/fstab`, `/etc/ssh/sshd_config`, `/etc/systemd/`                     |
| `/home`             | One directory per user, for example `/home/dev`. `~` is a shortcut for yours                                                                    |
| `/root`             | The home directory of the root user (not to be confused with `/`)                                                                               |
| `/usr`              | Installed software: `/usr/bin` (commands), `/usr/sbin` (admin commands), `/usr/lib` (libraries), `/usr/share` (docs, data)                      |
| `/usr/local`        | Software you install yourself outside the package manager, so it does not clash with distribution files                                         |
| `/opt`              | Self-contained third-party applications, each in its own directory                                                                              |
| `/var`              | Data that changes while the system runs: `/var/log` (logs), `/var/lib` (databases, package state, container images), `/var/cache`, `/var/spool` |
| `/srv`              | Data your server serves, for example web sites or Git repositories                                                                              |
| `/tmp`              | Temporary files that anyone may create. Do not keep anything important here                                                                     |
| `/boot`             | The kernel, the initial RAM disk and the boot loader files                                                                                      |
| `/dev`              | Device files: disks (`/dev/sda`, `/dev/nvme0n1`), terminals, and `/dev/null`                                                                    |
| `/proc` and `/sys`  | Virtual file systems where the kernel exposes processes, hardware and settings                                                                  |
| `/run`              | Runtime state such as PID files and sockets, kept in memory and cleared at boot                                                                 |
| `/mnt` and `/media` | Mount points: `/mnt` for temporary manual mounts, `/media` for removable media mounted by the desktop                                           |

### The Merged /usr

Older tutorials say that `/bin` holds essential commands and `/usr/bin` holds the rest. That split is gone. Fedora, RHEL, Debian 12 and later, and current Ubuntu releases have **merged /usr**: `/bin`, `/sbin` and `/lib` are symbolic links to their counterparts under `/usr`, as the listing above shows. `/bin/ls` and `/usr/bin/ls` are the same file. Ubuntu 24.04 also has empty `/bin.usr-is-merged` and `/sbin.usr-is-merged` directories, markers left by the transition; leave them alone.

Two more changes worth knowing: on Debian 13, `/tmp` is a **tmpfs** in memory by default, so its contents vanish at reboot; and on new Debian 13 and Fedora installs, systemd deletes files in `/tmp` that were not used for 10 days and files in `/var/tmp` after 30 days. Keep anything you need somewhere else.

## Configuration Lives in /etc

Most of `/etc` is human-readable text, which is why so much Linux administration is "edit a file, then reload a service". Some files are links to where the package manager keeps the real file:

```terminal
{
  "title": "a few files in /etc",
  "prompt": "$",
  "steps": [
    {
      "cmd": "ls -l /etc/hostname /etc/hosts /etc/os-release",
      "output": "-rw-r--r-- 1 root root  7 Oct 23 19:46 /etc/hostname\n-rw-r--r-- 1 root root 78 Oct 23 19:46 /etc/hosts\nlrwxrwxrwx 1 root root 21 Sep  6 14:29 /etc/os-release -> ../usr/lib/os-release"
    },
    {
      "cmd": "cat /etc/os-release",
      "output": "PRETTY_NAME=\"Ubuntu 24.04.5 LTS\"\nNAME=\"Ubuntu\"\nVERSION_ID=\"24.04\"\nVERSION=\"24.04.5 LTS (Noble Numbat)\"\nVERSION_CODENAME=noble\nID=ubuntu\nID_LIKE=debian\nHOME_URL=\"https://www.ubuntu.com/\"\nSUPPORT_URL=\"https://help.ubuntu.com/\"\nBUG_REPORT_URL=\"https://bugs.launchpad.net/ubuntu/\"\nPRIVACY_POLICY_URL=\"https://www.ubuntu.com/legal/terms-and-policies/privacy-policy\"\nUBUNTU_CODENAME=noble\nLOGO=ubuntu-logo"
    }
  ]
}
```

`/etc/os-release` is the standard way to find out which distribution and version you are on, on any modern system. Scripts can source it and read `$ID` and `$VERSION_ID`.

Before you edit a file in `/etc`, copy it (`sudo cp sshd_config sshd_config.bak`), and check whether the program supports a drop-in directory such as `/etc/ssh/sshd_config.d/` or `/etc/sysctl.d/`. A small file of your own in a drop-in directory survives package upgrades and is easy to review.

## The Kernel's Files: /proc, /sys and /dev

`/proc` and `/sys` take no disk space. The kernel generates their contents when you read them.

```terminal
{
  "title": "ask the kernel through files",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "load averages for 1, 5 and 15 minutes, then running/total tasks",
      "cmd": "cat /proc/loadavg",
      "output": "2.39 1.92 1.46 2/503 11"
    },
    {
      "cmd": "head -n 3 /proc/meminfo",
      "output": "MemTotal:        3887932 kB\nMemFree:          191916 kB\nMemAvailable:    1767700 kB"
    },
    {
      "comment": "every process has a directory named after its PID; self is the current one",
      "cmd": "ls /proc/self/ | head -n 8",
      "output": "attr\nautogroup\nauxv\ncgroup\nclear_refs\ncmdline\ncomm\ncoredump_filter"
    },
    {
      "comment": "kernel settings: the same values sysctl reads and writes",
      "cmd": "cat /proc/sys/kernel/pid_max",
      "output": "4194304"
    },
    {
      "comment": "1: this machine forwards packets between networks (a router, or a host for containers or VPNs); 0: it does not",
      "cmd": "cat /proc/sys/net/ipv4/ip_forward",
      "output": "1"
    },
    {
      "comment": "device files",
      "cmd": "file /dev/null /dev/zero /dev/urandom",
      "output": "/dev/null:    character special (1/3)\n/dev/zero:    character special (1/5)\n/dev/urandom: character special (1/9)"
    }
  ]
}
```

`/proc/<PID>/` describes one process (Part 7 uses it), `/proc/sys/` holds tunable kernel settings that `sysctl` changes, and `/sys` describes devices and drivers. In `/dev`, `/dev/null` discards everything written to it, `/dev/zero` returns zeros, and `/dev/urandom` returns random bytes. `/sys/class/net/` lists the network interfaces, and `/sys/block/` the disks.

## Reading Permissions

Every file has an **owner**, a **group**, and three sets of permissions: one for the owner (**u**ser), one for the **g**roup, and one for everyone else (**o**ther).

```terminal
{
  "title": "read the permission string",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd ~/lab"
    },
    {
      "cmd": "ls -l notes.txt",
      "output": "-rw-rw-r-- 1 dev dev 72 Oct 23 21:33 notes.txt"
    },
    {
      "cmd": "ls -ld site",
      "output": "drwxrwxr-x 4 dev dev 4096 Oct 23 21:33 site"
    },
    {
      "comment": "stat prints the same information in a format you choose",
      "cmd": "stat -c '%A  %a  %U:%G  %n' notes.txt site",
      "output": "-rw-rw-r--  664  dev:dev  notes.txt\ndrwxrwxr-x  775  dev:dev  site"
    }
  ]
}
```

The first ten characters of `-rw-rw-r--` read like this:

| Position | Characters | Meaning                                                                                                      |
| -------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| 1        | `-`        | File type: `-` regular file, `d` directory, `l` symbolic link, `c` or `b` device, `p` named pipe, `s` socket |
| 2 to 4   | `rw-`      | Owner (`dev`) can read and write                                                                             |
| 5 to 7   | `rw-`      | Group (`dev`) can read and write                                                                             |
| 8 to 10  | `r--`      | Everyone else can read                                                                                       |

For a file, `r` lets you read it, `w` lets you change it, and `x` lets you run it as a program. For a **directory** the letters mean something slightly different: `r` lists the names in it, `w` creates, renames and deletes entries in it, and `x` lets you enter it and reach the files inside. Deleting a file needs write permission on the **directory**, not on the file.

### Numeric (Octal) Modes

Each permission has a value: read is 4, write is 2, execute is 1. Add them up for each of the three sets:

| Number        | Permissions               | Typical use                                     |
| ------------- | ------------------------- | ----------------------------------------------- |
| `644`         | `rw-r--r--`               | Normal files: you edit, others read             |
| `600`         | `rw-------`               | Private files: SSH keys, files with secrets     |
| `755`         | `rwxr-xr-x`               | Programs, scripts and normal directories        |
| `700`         | `rwx------`               | Private directories such as `~/.ssh`            |
| `664` / `775` | `rw-rw-r--` / `rwxrwxr-x` | Files and directories a group works on together |

## Changing Permissions With chmod

```terminal
{
  "title": "chmod in symbolic and numeric form",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/lab"
    },
    {
      "cmd": "printf '#!/bin/bash\\necho \"deploying...\"\\n' > deploy.sh"
    },
    {
      "cmd": "./deploy.sh",
      "output": "bash: ./deploy.sh: Permission denied"
    },
    {
      "comment": "u+x adds execute for the owner",
      "cmd": "chmod u+x deploy.sh"
    },
    {
      "cmd": "./deploy.sh",
      "output": "deploying..."
    },
    {
      "comment": "numeric: owner rw, group and others nothing",
      "cmd": "printf 'API_TOKEN=example-only\\n' > secret.env && chmod 600 secret.env"
    },
    {
      "comment": "symbolic: set exact permissions per class",
      "cmd": "chmod u=rw,g=r,o= notes.txt"
    },
    {
      "cmd": "stat -c '%A %a %n' deploy.sh secret.env notes.txt",
      "output": "-rwxrw-r-- 764 deploy.sh\n-rw------- 600 secret.env\n-rw-r----- 640 notes.txt"
    }
  ]
}
```

Symbolic mode uses `u`, `g`, `o` and `a` (all), the operators `+`, `-` and `=`, and the letters `r`, `w` and `x`. It changes only what you name, which makes it safer than a numeric mode when you are unsure of the current state.

### Recursive Changes Without Breaking Things

`chmod -R 755 dir` makes every **file** executable too, and `chmod -R 644 dir` removes `x` from every **directory**, so nobody can enter them. Use a capital `X`, which adds execute only to directories (and to files that are already executable for someone):

```terminal
{
  "title": "chmod -R with a capital X",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/lab"
    },
    {
      "cmd": "chmod -R u=rwX,go=rX site"
    },
    {
      "cmd": "find site -exec stat -c '%A %n' {} +",
      "output": "drwxr-xr-x site\n-rw-r--r-- site/about.html\ndrwxr-xr-x site/css\n-rw-r--r-- site/css/style.css\ndrwxr-xr-x site/images\n-rw-r--r-- site/index.html"
    }
  ]
}
```

Directories got `rwxr-xr-x` and the HTML and CSS files got `rw-r--r--`. The same result with `find`: `find site -type d -exec chmod 755 {} +` and `find site -type f -exec chmod 644 {} +`.

### What Permission Denied Looks Like

You are not root here, so the kernel enforces every bit:

```terminal
{
  "title": "permissions enforced",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/lab"
    },
    {
      "cmd": "chmod 000 secret.env"
    },
    {
      "cmd": "cat secret.env",
      "output": "cat: secret.env: Permission denied"
    },
    {
      "comment": "a directory without x: you can see the names but not reach the files",
      "cmd": "mkdir private && touch private/plan.txt && chmod u-x private"
    },
    {
      "cmd": "ls private",
      "output": "plan.txt"
    },
    {
      "cmd": "cat private/plan.txt",
      "output": "cat: private/plan.txt: Permission denied"
    },
    {
      "cmd": "chmod 600 secret.env && chmod u+x private"
    }
  ]
}
```

The owner of a file can always change its permissions back, even after locking themselves out. Root ignores read and write permissions entirely, which is one reason to avoid working as root.

## The umask: Default Permissions for New Files

New files start from `666` and new directories from `777`, minus the bits in your **umask**. On Ubuntu and Debian, users who have their own private group (the default) get a umask of `0002`, so new files are `664` and new directories `775`. Root and systems without private groups use `0022`, which gives `644` and `755`.

```terminal
{
  "title": "umask in action",
  "prompt": "$",
  "steps": [
    {
      "cmd": "umask",
      "output": "0002"
    },
    {
      "cmd": "cd ~/lab && touch new-file && mkdir new-dir"
    },
    {
      "cmd": "stat -c '%A %n' new-file new-dir",
      "output": "-rw-rw-r-- new-file\ndrwxrwxr-x new-dir"
    },
    {
      "comment": "a stricter umask inside ( ), a subshell, so your own shell keeps 0002",
      "cmd": "(umask 077 && touch private-file && stat -c '%A %n' private-file)",
      "output": "-rw------- private-file"
    }
  ]
}
```

Set a umask for a service in its systemd unit (`UMask=0027`) rather than in a shell profile, because services do not read your profile.

## Ownership: chown and chgrp

Only root can give a file to another user. Changing the group works for the owner too, as long as they belong to the new group.

```bash
sudo chown alice report.txt            # new owner
sudo chown alice:developers report.txt # new owner and group
sudo chgrp developers report.txt       # new group only
sudo chown -R www-data:www-data /srv/site   # a whole tree
```

A classic mistake: you copy files into place with `sudo cp`, and they end up owned by root, so the service that runs as `www-data` cannot write to them. Check with `ls -l` after every `sudo cp` or `sudo tar -x`, and fix ownership with `chown -R`.

## Special Permission Bits

Three more bits sit in front of the usual nine. In numeric form they are the extra leading digit: 4 for setuid, 2 for setgid, 1 for sticky.

```terminal
{
  "title": "special bits on system files",
  "prompt": "$",
  "steps": [
    {
      "comment": "setuid: passwd and sudo run as their owner (root), whoever starts them",
      "cmd": "ls -l /usr/bin/passwd /usr/bin/sudo",
      "output": "-rwsr-xr-x 1 root root  72056 May 30  2024 /usr/bin/passwd\n-rwsr-xr-x 1 root root 335120 Oct  6 13:51 /usr/bin/sudo"
    },
    {
      "comment": "sticky bit: everyone may create files in /tmp, but only delete their own",
      "cmd": "ls -ld /tmp",
      "output": "drwxrwxrwt 2 root root 4096 Oct 23 19:56 /tmp"
    }
  ]
}
```

- **setuid** (`s` in the owner's `x` position) runs a program with the permissions of its owner. That is how `passwd` can write to `/etc/shadow` for an ordinary user. Setuid programs are a favourite target for attackers, so audit them (Part 10).
- **setgid** on a directory (`s` in the group's `x` position) makes new files inside it inherit the directory's group instead of the creator's primary group. Use it for shared project directories.
- **sticky** (`t` in the last position) on a directory lets users delete only their own files. `/tmp` uses it.

```terminal
{
  "title": "set the bits on your own directories",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/lab"
    },
    {
      "cmd": "mkdir shared dropbox"
    },
    {
      "cmd": "chmod 2775 shared && chmod 1777 dropbox"
    },
    {
      "cmd": "ls -ld shared dropbox",
      "output": "drwxrwxrwt 2 dev dev 4096 Oct 23 21:33 dropbox\ndrwxrwsr-x 2 dev dev 4096 Oct 23 21:33 shared"
    }
  ]
}
```

A shared directory for a team needs root to set its group. Here is the full recipe and the result it produces on a system where the `developers` group exists (example output):

```bash
sudo mkdir -p /srv/projects
sudo chgrp developers /srv/projects
sudo chmod 2775 /srv/projects
ls -ld /srv/projects
```

```text
drwxrwsr-x 2 root developers 4096 Oct 23 09:00 /srv/projects
```

Any file a member creates there belongs to the `developers` group, and with the `0002` umask the whole group can edit it. [Part 6](/guides/introduction-to-linux/06-user-management) creates the group and its users.

### Access Control Lists

When owner, group and other are not enough, for example when one extra user needs read access, use an **access control list** (ACL). ACLs work on ext4, XFS and Btrfs out of the box; install the `acl` package for the tools.

```bash
setfacl -m u:alice:r report.txt      # give alice read access
getfacl report.txt                   # show all entries
setfacl -x u:alice report.txt        # remove the entry again
```

A file with an ACL shows a `+` after its permissions in `ls -l` (`-rw-rw-r--+`). Use ACLs sparingly: they are easy to forget during audits.

## File Types, Links and Inodes

Everything is a file, but not every file holds data. `ls -l` shows the type in the first column, and `file` looks inside to tell you what kind of data it holds:

```terminal
{
  "title": "what kind of file is this?",
  "prompt": "$",
  "steps": [
    {
      "cmd": "file ~/lab/notes.txt ~/lab/site/index.html /usr/bin/ls /etc/os-release",
      "output": "/home/dev/lab/notes.txt:       ASCII text\n/home/dev/lab/site/index.html: HTML document, ASCII text\n/usr/bin/ls:                   ELF 64-bit LSB pie executable, ARM aarch64, version 1 (SYSV), dynamically linked, interpreter /lib/ld-linux-aarch64.so.1, BuildID[sha1]=00a639537eef557c0dcb20ad52892bc84863ed94, for GNU/Linux 3.7.0, stripped\n/etc/os-release:               symbolic link to ../usr/lib/os-release"
    }
  ]
}
```

Each file's metadata (owner, permissions, size, timestamps, and where its data is on disk) is stored in an **inode**. A directory entry is just a name that points to an inode. That explains the two kinds of links:

- A **hard link** is a second name for the same inode. Both names are equal; the data stays until the last name is removed. Hard links cannot cross file systems or point to directories.
- A **symbolic link** (symlink) is a small file that contains a path. It can point anywhere, including to directories and other file systems, but it breaks when the target moves.

```terminal
{
  "title": "hard links, symlinks and inodes",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/lab"
    },
    {
      "cmd": "ln notes.txt notes-hardlink.txt"
    },
    {
      "cmd": "ln -s notes.txt notes-symlink.txt"
    },
    {
      "comment": "-i shows inode numbers: the hard link shares one, the symlink has its own",
      "cmd": "ls -li notes*",
      "output": "595181 -rw-r----- 2 dev dev 72 Oct 23 21:33 notes-hardlink.txt\n595366 lrwxrwxrwx 1 dev dev  9 Oct 23 21:33 notes-symlink.txt -> notes.txt\n595181 -rw-r----- 2 dev dev 72 Oct 23 21:33 notes.txt"
    },
    {
      "cmd": "rm notes.txt"
    },
    {
      "comment": "the hard link still has the data; the symlink now points nowhere",
      "cmd": "cat notes-hardlink.txt | head -n 1",
      "output": "Practice notes"
    },
    {
      "cmd": "cat notes-symlink.txt",
      "output": "cat: notes-symlink.txt: No such file or directory"
    },
    {
      "cmd": "mv notes-hardlink.txt notes.txt && rm notes-symlink.txt"
    }
  ]
}
```

The number after the permissions in `ls -l` is the link count: `2` after the hard link was created. Deployments often use symlinks, for example a `current` link that points to the active release directory, so switching versions is one `ln -sfn` command. See [how to create symlinks](/posts/how-to-symlink-files-linux) for more.

## Hidden Files

Names that start with a dot are hidden from `ls` and from `*` wildcards. Your shell and tools keep their settings in them:

```terminal
{
  "title": "hidden files in your home directory",
  "prompt": "$",
  "steps": [
    {
      "cmd": "ls -A ~",
      "output": ".bash_logout\n.bashrc\n.profile\nlab\nmake-lab.sh"
    }
  ]
}
```

You will often edit `~/.bashrc` (shell settings), `~/.profile` (login settings), `~/.ssh/` (SSH keys and config, Part 6) and `~/.config/` (settings of many desktop and CLI programs).

## Finding Files by Owner, Permissions and Age

`find` can test the metadata from this part. These checks are common in audits:

```terminal
{
  "title": "find by metadata",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/lab"
    },
    {
      "comment": "files anyone may write to",
      "cmd": "find . -perm -o+w",
      "output": "./dropbox"
    },
    {
      "comment": "executable files",
      "cmd": "find . -type f -perm -u+x",
      "output": "./deploy.sh"
    },
    {
      "comment": "files changed in the last 10 minutes",
      "cmd": "find . -type f -mmin -10 | head -n 3",
      "output": "./logs/error.log\n./logs/access.log\n./secret.env"
    },
    {
      "comment": "everything owned by the user dev",
      "cmd": "find . -user dev | wc -l",
      "output": "20"
    }
  ]
}
```

On a server, `sudo find / -xdev -perm -4000 -type f` lists setuid programs and `sudo find / -xdev -nouser` finds files whose owner was deleted. `-xdev` keeps `find` on one file system, so it does not wander into `/proc` or network mounts.

## Disk Space: df and du

`df` reports free space per file system, and `du` adds up how much space directories use.

```terminal
{
  "title": "disk usage",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "df -h --output=fstype,size,used,avail,pcent,target /",
      "output": "Type  Size  Used Avail Use% Mounted on\next4   29G   26G  1.1G  97% /"
    },
    {
      "cmd": "du -sh ~/lab",
      "output": "72K\t/home/dev/lab"
    },
    {
      "comment": "biggest subdirectories first",
      "cmd": "du -h --max-depth=1 ~/lab | sort -rh",
      "output": "72K\t/home/dev/lab\n24K\t/home/dev/lab/site\n16K\t/home/dev/lab/logs\n4.0K\t/home/dev/lab/shared\n4.0K\t/home/dev/lab/private\n4.0K\t/home/dev/lab/new-dir\n4.0K\t/home/dev/lab/dropbox"
    }
  ]
}
```

When a disk fills up, start at the top: `sudo du -xh --max-depth=1 / | sort -rh | head`, then repeat inside the biggest directory. The usual suspects are `/var/log`, `/var/lib/docker` (or `/var/lib/containerd`), old kernels, and package caches. `df -i` shows **inodes**: a disk can run out of inodes, with plenty of space left, when something creates millions of tiny files. Part 10 covers the case where `df` says the disk is full but `du` cannot find the files.

## File Systems and Mounting

A **file system** organises data on a disk partition. You will meet these:

- **ext4**: the default on Ubuntu and Debian installs. Stable and well understood.
- **XFS**: the default on RHEL and Fedora Server. Good with large files; it can grow but not shrink.
- **Btrfs**: the default on Fedora Workstation and openSUSE, with snapshots, compression and checksums.
- **ZFS**: snapshots, checksums and RAID in one, available on Ubuntu as an option.
- **tmpfs**: lives in memory, used for `/run` and, on some systems, `/tmp`.
- **vfat** and **exFAT** for USB sticks and the EFI system partition; **NTFS** through the kernel's `ntfs3` driver.

**Mounting** attaches a file system to a directory, the **mount point**. These commands need root and a real disk, so the output is an example of a VM with one extra disk:

```bash
lsblk -f                         # disks, partitions, file systems and UUIDs
sudo mkfs.ext4 /dev/vdb1         # create a file system (erases the partition!)
sudo mkdir -p /mnt/data
sudo mount /dev/vdb1 /mnt/data   # attach it
findmnt /mnt/data                # check it is mounted
sudo umount /mnt/data            # detach it (not "unmount")
```

```text
NAME    FSTYPE FSVER LABEL           UUID                                 FSAVAIL FSUSE% MOUNTPOINTS
vda
├─vda1  ext4   1.0   cloudimg-rootfs 2f6b7e4c-8d1a-4c5e-9f3b-1a2b3c4d5e6f   21.4G    23% /
└─vda15 vfat   FAT32 UEFI            9C3A-21F0                              98.3M     6% /boot/efi
vdb
└─vdb1  ext4   1.0                   7d8e9f10-1a2b-4c3d-8e9f-0a1b2c3d4e5f
```

To mount a file system at every boot, add a line to `/etc/fstab`. Use the **UUID** from `lsblk -f`, not the device name: names such as `/dev/sdb` can change between boots.

```text
# <file system>                           <mount point>  <type>  <options>         <dump>  <pass>
UUID=7d8e9f10-1a2b-4c3d-8e9f-0a1b2c3d4e5f  /mnt/data      ext4    defaults,nofail   0       2
```

:::warning
A wrong line in `/etc/fstab` can stop the machine from booting. After every edit, run `sudo findmnt --verify` and `sudo mount -a` and fix any error before you reboot. The `nofail` option lets the system boot even if that disk is missing, which matters on cloud servers where volumes can be detached.
:::

## Common Mistakes

- **`chmod -R 777` to "fix" a permission error.** It lets every user and every compromised service change the files. Find out which user needs access, then fix the owner or group and use `755`/`644` or `775`/`664`.
- **`chmod -R 644` or `755` on a mixed tree.** Use `u=rwX,go=rX` or separate `find -type d` and `find -type f` commands.
- **Wrong owner after `sudo`.** Files copied or extracted with `sudo` belong to root. Check with `ls -l` and fix with `chown`.
- **Private keys readable by others.** SSH refuses keys that other users can read (`UNPROTECTED PRIVATE KEY FILE`). Use `chmod 600` on keys and `chmod 700` on `~/.ssh`.
- **Editing `/etc/fstab` without testing.** Always run `findmnt --verify` and `mount -a` first.
- **Storing data in `/tmp`.** It may live in memory and is cleaned automatically.

## Summary

- Linux has one directory tree. `/etc` holds configuration, `/var` changing data and logs, `/usr` installed software, `/home` your files, and `/proc` and `/sys` the kernel's view of the system.
- `/bin`, `/sbin` and `/lib` are links into `/usr` on current distributions.
- Permissions come in three sets (owner, group, other) of `r`, `w` and `x`; `x` on a directory means "may enter".
- `chmod` changes permissions (`u=rwX,go=rX` for trees), `chown` and `chgrp` change ownership, and the umask sets defaults.
- setuid, setgid and the sticky bit add special behaviour; ACLs add per-user exceptions.
- Hard links share an inode; symlinks store a path and can break.
- `df` and `du` find where the space went; mount disks by UUID and test `/etc/fstab` before rebooting.

Next: [Package Management](/guides/introduction-to-linux/05-package-management), where you install, update and remove software with `apt` and `dnf`.

## Keep Learning

- [Change permissions for a folder, its subfolders and files](/posts/change-permissions-folder-subfolders-files-linux)
- [List directories with their sizes](/posts/using-ls-list-directories-sizes)
- Interview questions: [Linux file permissions](/interview-questions/junior/linux-file-permissions)
- Practice octal permissions in the [binary simulator](/games/binary-byte-simulator)
- [Linux Fundamentals flashcards](/flashcards/linux-fundamentals)
