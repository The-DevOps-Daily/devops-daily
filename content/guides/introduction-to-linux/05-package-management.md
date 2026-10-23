---
title: 'Linux Package Management: apt, dnf, Snap and Flatpak'
description: 'Install, update and remove software on Ubuntu, Debian, Fedora and RHEL with apt and dnf, add third-party repositories safely, and use Snap and Flatpak.'
order: 5
---

On Windows and macOS you often download an installer from a vendor's website. On Linux, you ask the **package manager**. It downloads software from your distribution's **repositories**, checks the signatures, installs everything the program depends on, and later updates all of it with one command. Security fixes for your web server, your SSH daemon and your kernel all arrive the same way.

This part covers `apt` on Ubuntu and Debian and `dnf` on Fedora and RHEL in depth, then the other package managers, Snap and Flatpak, and the mistakes that break systems.

## Prerequisites

- A Linux machine where you can use `sudo` ([Part 2](/guides/introduction-to-linux/02-getting-started)).
- The command line basics from [Part 3](/guides/introduction-to-linux/03-command-line-interface).

The `apt` output below comes from a fresh **Ubuntu 24.04.5 LTS** image and the `dnf` output from a **Fedora 44** image (dnf5 5.4.3). Both ran on an arm64 machine, so Ubuntu downloads from `ports.ubuntu.com` and package names end in `arm64` or `aarch64`. On a typical x86 PC or cloud server, you see `archive.ubuntu.com`, `security.ubuntu.com` and `amd64` instead. Versions and sizes change with every update.

## How Package Management Works

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Repository", "sub": "signed index + packages", "icon": "cloud", "tone": "blue" },
    { "label": "apt update", "sub": "download the index", "icon": "gear", "tone": "slate" },
    { "label": "apt install", "sub": "resolve dependencies", "icon": "branch", "tone": "violet" },
    { "label": "dpkg", "sub": "unpack + configure", "icon": "box", "tone": "amber" },
    { "label": "Installed", "sub": "files in /usr, /etc", "icon": "check", "tone": "green" }
  ]
}
```

- A **package** is an archive with the program's files, metadata (name, version, description) and a list of **dependencies**: other packages it needs.
- A **repository** is a server that publishes packages plus a signed index of everything it offers. Your system trusts a repository through its **signing key**.
- The high-level tool (`apt`, `dnf`) reads the index, works out the dependencies, downloads the packages and checks their signatures. The low-level tool (`dpkg`, `rpm`) installs a single package file and records what it installed.

| Family  | Distributions                                                     | Package format | High-level tool              | Low-level tool |
| ------- | ----------------------------------------------------------------- | -------------- | ---------------------------- | -------------- |
| Debian  | Debian, Ubuntu, Linux Mint, Pop!\_OS                              | `.deb`         | `apt` (`apt-get` in scripts) | `dpkg`         |
| Red Hat | Fedora, RHEL, Rocky Linux, AlmaLinux, CentOS Stream, Amazon Linux | `.rpm`         | `dnf` (`yum` is an alias)    | `rpm`          |
| SUSE    | openSUSE, SUSE Linux Enterprise                                   | `.rpm`         | `zypper`                     | `rpm`          |
| Arch    | Arch Linux, Manjaro                                               | `.pkg.tar.zst` | `pacman`                     | `pacman`       |
| Alpine  | Alpine Linux (common in containers)                               | `.apk`         | `apk`                        | `apk`          |

Use the package manager of your distribution, and only repositories built for your exact release.

## apt on Ubuntu and Debian

### Where Packages Come From

Current Ubuntu releases describe their repositories in the **deb822** format, one file per source, in `/etc/apt/sources.list.d/`. The old one-line `/etc/apt/sources.list` only holds a pointer now:

```terminal
{
  "title": "Ubuntu 24.04 package sources",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cat /etc/apt/sources.list",
      "output": "# Ubuntu sources have moved to the /etc/apt/sources.list.d/ubuntu.sources\n# file, which uses the deb822 format. Use deb822-formatted .sources files\n# to manage package sources in the /etc/apt/sources.list.d/ directory.\n# See the sources.list(5) manual page for details."
    },
    {
      "comment": "the file starts with comments that explain each field; skip them",
      "cmd": "grep -v '^#' /etc/apt/sources.list.d/ubuntu.sources",
      "output": "Types: deb\nURIs: http://ports.ubuntu.com/ubuntu-ports/\nSuites: noble noble-updates noble-backports\nComponents: main universe restricted multiverse\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n\nTypes: deb\nURIs: http://ports.ubuntu.com/ubuntu-ports/\nSuites: noble-security\nComponents: main universe restricted multiverse\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg"
    }
  ]
}
```

Each stanza lists the URL, the **suites** (`noble` is the codename of 24.04; `-updates` and `-security` carry fixes; `-backports` newer versions), the **components** (`main` is supported by Canonical, `universe` by the community, `restricted` and `multiverse` hold non-free software) and the key that signs it. On Debian 13 ("trixie") the components are `main`, `contrib`, `non-free` and `non-free-firmware`. Debian 13 still writes the one-line format during installation:

```text
deb http://deb.debian.org/debian trixie main non-free-firmware
deb http://security.debian.org/debian-security trixie-security main non-free-firmware
deb http://deb.debian.org/debian trixie-updates main non-free-firmware
```

The one-line format still works. apt 3.0, which ships with Debian 13, has `sudo apt modernize-sources` to convert old files to deb822.

### Update the Index and See What Can Be Upgraded

`apt update` downloads the current index from every repository. It installs nothing. Run it before you install or upgrade anything:

```terminal
{
  "title": "sudo apt update",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sudo apt update",
      "output": "Get:1 http://ports.ubuntu.com/ubuntu-ports noble InRelease [256 kB]\nGet:2 http://ports.ubuntu.com/ubuntu-ports noble-updates InRelease [126 kB]\nGet:3 http://ports.ubuntu.com/ubuntu-ports noble-backports InRelease [126 kB]\nGet:4 http://ports.ubuntu.com/ubuntu-ports noble-security InRelease [126 kB]\nGet:5 http://ports.ubuntu.com/ubuntu-ports noble/main arm64 Packages [1377 kB]\nGet:6 http://ports.ubuntu.com/ubuntu-ports noble/main Translation-en [513 kB]\nGet:7 http://ports.ubuntu.com/ubuntu-ports noble/universe arm64 Packages [15.3 MB]\nGet:8 http://ports.ubuntu.com/ubuntu-ports noble/universe Translation-en [5982 kB]\nGet:9 http://ports.ubuntu.com/ubuntu-ports noble/restricted arm64 Packages [91.9 kB]\nGet:10 http://ports.ubuntu.com/ubuntu-ports noble/restricted Translation-en [18.7 kB]\nGet:11 http://ports.ubuntu.com/ubuntu-ports noble/multiverse arm64 Packages [223 kB]\nGet:12 http://ports.ubuntu.com/ubuntu-ports noble/multiverse Translation-en [118 kB]\nGet:13 http://ports.ubuntu.com/ubuntu-ports noble-updates/main arm64 Packages [1455 kB]\nGet:14 http://ports.ubuntu.com/ubuntu-ports noble-updates/main Translation-en [310 kB]\nGet:15 http://ports.ubuntu.com/ubuntu-ports noble-updates/universe arm64 Packages [1748 kB]\nGet:16 http://ports.ubuntu.com/ubuntu-ports noble-updates/universe Translation-en [342 kB]\nGet:17 http://ports.ubuntu.com/ubuntu-ports noble-updates/restricted arm64 Packages [2678 kB]\nGet:18 http://ports.ubuntu.com/ubuntu-ports noble-updates/restricted Translation-en [411 kB]\nGet:19 http://ports.ubuntu.com/ubuntu-ports noble-updates/multiverse arm64 Packages [86.2 kB]\nGet:20 http://ports.ubuntu.com/ubuntu-ports noble-updates/multiverse Translation-en [14.0 kB]\nGet:21 http://ports.ubuntu.com/ubuntu-ports noble-backports/main arm64 Packages [40.7 kB]\nGet:22 http://ports.ubuntu.com/ubuntu-ports noble-backports/main Translation-en [9172 B]\nGet:23 http://ports.ubuntu.com/ubuntu-ports noble-backports/universe arm64 Packages [31.3 kB]\nGet:24 http://ports.ubuntu.com/ubuntu-ports noble-backports/universe Translation-en [18.6 kB]\nGet:25 http://ports.ubuntu.com/ubuntu-ports noble-backports/multiverse arm64 Packages [748 B]\nGet:26 http://ports.ubuntu.com/ubuntu-ports noble-backports/multiverse Translation-en [340 B]\nGet:27 http://ports.ubuntu.com/ubuntu-ports noble-security/main arm64 Packages [1206 kB]\nGet:28 http://ports.ubuntu.com/ubuntu-ports noble-security/main Translation-en [231 kB]\nGet:29 http://ports.ubuntu.com/ubuntu-ports noble-security/universe arm64 Packages [1298 kB]\nGet:30 http://ports.ubuntu.com/ubuntu-ports noble-security/universe Translation-en [246 kB]\nGet:31 http://ports.ubuntu.com/ubuntu-ports noble-security/restricted arm64 Packages [2573 kB]\nGet:32 http://ports.ubuntu.com/ubuntu-ports noble-security/restricted Translation-en [392 kB]\nGet:33 http://ports.ubuntu.com/ubuntu-ports noble-security/multiverse arm64 Packages [82.2 kB]\nGet:34 http://ports.ubuntu.com/ubuntu-ports noble-security/multiverse Translation-en [12.1 kB]\nFetched 37.5 MB in 15s (2533 kB/s)\nReading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\n10 packages can be upgraded. Run 'apt list --upgradable' to see them."
    },
    {
      "cmd": "apt list --upgradable",
      "output": "Listing... Done\nlibaudit-common/noble-updates 1:3.1.2-2.1ubuntu0.1 all [upgradable from: 1:3.1.2-2.1build1.1]\nlibaudit1/noble-updates 1:3.1.2-2.1ubuntu0.1 arm64 [upgradable from: 1:3.1.2-2.1build1.1]\nlibc-bin/noble-updates,noble-security 2.39-0ubuntu8.9 arm64 [upgradable from: 2.39-0ubuntu8.8]\nlibc6/noble-updates,noble-security 2.39-0ubuntu8.9 arm64 [upgradable from: 2.39-0ubuntu8.8]\nliblzma5/noble-updates,noble-security 5.6.1+really5.4.5-1ubuntu0.4 arm64 [upgradable from: 5.6.1+really5.4.5-1ubuntu0.3]\nlibssl3t64/noble-updates,noble-security 3.0.13-0ubuntu3.16 arm64 [upgradable from: 3.0.13-0ubuntu3.15]\nlibsystemd0/noble-updates,noble-security 255.4-1ubuntu8.18 arm64 [upgradable from: 255.4-1ubuntu8.17]\nlibudev1/noble-updates,noble-security 255.4-1ubuntu8.18 arm64 [upgradable from: 255.4-1ubuntu8.17]\nperl-base/noble-updates,noble-security 5.38.2-3.2ubuntu0.6 arm64 [upgradable from: 5.38.2-3.2ubuntu0.4]\nzlib1g/noble-updates,noble-security 1:1.3.dfsg-3.1ubuntu2.3 arm64 [upgradable from: 1:1.3.dfsg-3.1ubuntu2.2]"
    }
  ]
}
```

To install the upgrades:

```bash
sudo apt upgrade         # upgrade installed packages, never remove any
sudo apt full-upgrade    # also remove or replace packages when an upgrade needs it
```

`apt upgrade` lists what it will do and asks before it starts. Ubuntu rolls out some updates gradually (**phased updates**), so you may see "The following upgrades have been deferred due to phasing"; they arrive within a few days. If a kernel or core library was updated, the file `/var/run/reboot-required` appears and the login message says a reboot is needed.

### Search and Inspect Packages

```terminal
{
  "title": "search and inspect",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "--names-only searches package names, not descriptions",
      "cmd": "apt search --names-only '^jq$'",
      "output": "Sorting... Done\nFull Text Search... Done\njq/noble-updates,noble-security 1.7.1-3ubuntu0.24.04.2 arm64\n  lightweight and flexible command-line JSON processor"
    },
    {
      "comment": "which version would be installed, and from where",
      "cmd": "apt policy jq",
      "output": "jq:\n  Installed: (none)\n  Candidate: 1.7.1-3ubuntu0.24.04.2\n  Version table:\n     1.7.1-3ubuntu0.24.04.2 500\n        500 http://ports.ubuntu.com/ubuntu-ports noble-updates/main arm64 Packages\n        500 http://ports.ubuntu.com/ubuntu-ports noble-security/main arm64 Packages\n     1.7.1-3build1 500\n        500 http://ports.ubuntu.com/ubuntu-ports noble/main arm64 Packages"
    },
    {
      "cmd": "apt show jq",
      "output": "Package: jq\nVersion: 1.7.1-3ubuntu0.24.04.2\nPriority: optional\nSection: utils\nOrigin: Ubuntu\nMaintainer: Ubuntu Developers <ubuntu-devel-discuss@lists.ubuntu.com>\nOriginal-Maintainer: ChangZhuo Chen (陳昌倬) <czchen@debian.org>\nBugs: https://bugs.launchpad.net/ubuntu/+filebug\nInstalled-Size: 152 kB\nDepends: libc6 (>= 2.38), libjq1 (= 1.7.1-3ubuntu0.24.04.2)\nHomepage: https://jqlang.github.io/jq\nTask: ubuntu-desktop-minimal, ubuntu-desktop, cloud-image, cloud-image, server, ubuntu-server-raspi, ubuntu-desktop-raspi, kubuntu-desktop, xubuntu-minimal, xubuntu-desktop, lubuntu-desktop, ubuntustudio-desktop-core, ubuntustudio-desktop, ubuntukylin-desktop, ubuntukylin-desktop-minimal, ubuntu-mate-core, ubuntu-mate-desktop, ubuntu-budgie-desktop-minimal, ubuntu-budgie-desktop, ubuntu-budgie-desktop-raspi, ubuntu-unity-desktop, edubuntu-desktop-gnome-minimal, edubuntu-desktop-gnome-raspi, ubuntucinnamon-desktop-minimal, ubuntucinnamon-desktop-raspi\nDownload-Size: 64.6 kB\nAPT-Sources: http://ports.ubuntu.com/ubuntu-ports noble-updates/main arm64 Packages\nDescription: lightweight and flexible command-line JSON processor\n jq is like sed for JSON data – you can use it to slice\n and filter and map and transform structured data with\n the same ease that sed, awk, grep and friends let you\n play with text.\n .\n It is written in portable C, and it has minimal runtime\n dependencies.\n .\n jq can mangle the data format that you have into the\n one that you want with very little effort, and the\n program to do so is often shorter and simpler than\n you’d expect.\n\nN: There is 1 additional record. Please use the '-a' switch to see it"
    }
  ]
}
```

`apt policy` (also `apt-cache policy`) is the command to run when you wonder why apt picks a certain version: it lists every version it knows, the repository each comes from, and the **priority** that decides between them.

### Install Packages

```terminal
{
  "title": "install packages",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sudo apt install -y jq tree",
      "output": "Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\nThe following additional packages will be installed:\n  libjq1 libonig5\nThe following NEW packages will be installed:\n  jq libjq1 libonig5 tree\n0 upgraded, 4 newly installed, 0 to remove and 10 not upgraded.\nNeed to get 418 kB of archives.\nAfter this operation, 1396 kB of additional disk space will be used.\nGet:1 http://ports.ubuntu.com/ubuntu-ports noble/main arm64 libonig5 arm64 6.9.9-1build1 [172 kB]\nGet:2 http://ports.ubuntu.com/ubuntu-ports noble-updates/main arm64 libjq1 arm64 1.7.1-3ubuntu0.24.04.2 [135 kB]\nGet:3 http://ports.ubuntu.com/ubuntu-ports noble-updates/main arm64 jq arm64 1.7.1-3ubuntu0.24.04.2 [64.6 kB]\nGet:4 http://ports.ubuntu.com/ubuntu-ports noble-updates/universe arm64 tree arm64 2.1.1-2ubuntu3.24.04.2 [46.2 kB]\nFetched 418 kB in 1s (819 kB/s)\nSelecting previously unselected package libonig5:arm64.\n(Reading database ... 4408 files and directories currently installed.)\nPreparing to unpack .../libonig5_6.9.9-1build1_arm64.deb ...\nUnpacking libonig5:arm64 (6.9.9-1build1) ...\nSelecting previously unselected package libjq1:arm64.\nPreparing to unpack .../libjq1_1.7.1-3ubuntu0.24.04.2_arm64.deb ...\nUnpacking libjq1:arm64 (1.7.1-3ubuntu0.24.04.2) ...\nSelecting previously unselected package jq.\nPreparing to unpack .../jq_1.7.1-3ubuntu0.24.04.2_arm64.deb ...\nUnpacking jq (1.7.1-3ubuntu0.24.04.2) ...\nSelecting previously unselected package tree.\nPreparing to unpack .../tree_2.1.1-2ubuntu3.24.04.2_arm64.deb ...\nUnpacking tree (2.1.1-2ubuntu3.24.04.2) ...\nSetting up tree (2.1.1-2ubuntu3.24.04.2) ...\nSetting up libonig5:arm64 (6.9.9-1build1) ...\nSetting up libjq1:arm64 (1.7.1-3ubuntu0.24.04.2) ...\nSetting up jq (1.7.1-3ubuntu0.24.04.2) ...\nProcessing triggers for libc-bin (2.39-0ubuntu8.8) ..."
    },
    {
      "cmd": "jq --version",
      "output": "jq-1.7"
    },
    {
      "cmd": "echo '{\"distro\": \"ubuntu\", \"version\": \"24.04\"}' | jq -r .version",
      "output": "24.04"
    }
  ]
}
```

`jq` needed two libraries, so apt installed them too and marked them as **automatically installed**. Without `-y`, apt shows the plan and asks `Do you want to continue? [Y/n]`. Read that list, especially lines that say "REMOVED".

Ask `dpkg` what a package installed, and which package owns a file:

```terminal
{
  "title": "query installed packages with dpkg",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "dpkg -L tree",
      "output": "/.\n/usr\n/usr/bin\n/usr/bin/tree\n/usr/share\n/usr/share/doc\n/usr/share/doc/tree\n/usr/share/doc/tree/README.gz\n/usr/share/doc/tree/TODO\n/usr/share/doc/tree/changelog.Debian.gz\n/usr/share/doc/tree/copyright\n/usr/share/man\n/usr/share/man/man1\n/usr/share/man/man1/tree.1.gz"
    },
    {
      "cmd": "dpkg -S /usr/bin/jq",
      "output": "jq: /usr/bin/jq"
    },
    {
      "cmd": "dpkg -l jq tree",
      "output": "Desired=Unknown/Install/Remove/Purge/Hold\n| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend\n|/ Err?=(none)/Reinst-required (Status,Err: uppercase=bad)\n||/ Name           Version                Architecture Description\n+++-==============-======================-============-====================================================\nii  jq             1.7.1-3ubuntu0.24.04.2 arm64        lightweight and flexible command-line JSON processor\nii  tree           2.1.1-2ubuntu3.24.04.2 arm64        displays an indented directory tree, in color"
    }
  ]
}
```

`ii` in the first column means the package is installed and configured. `rc` means it was removed but its configuration files are still on disk.

### Remove Packages and Clean Up

```terminal
{
  "title": "remove, autoremove, hold",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sudo apt remove -y jq",
      "output": "Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\nThe following packages were automatically installed and are no longer required:\n  libjq1 libonig5\nUse 'apt autoremove' to remove them.\nThe following packages will be REMOVED:\n  jq\n0 upgraded, 0 newly installed, 1 to remove and 10 not upgraded.\nAfter this operation, 152 kB disk space will be freed.\n(Reading database ... 4433 files and directories currently installed.)\nRemoving jq (1.7.1-3ubuntu0.24.04.2) ..."
    },
    {
      "cmd": "sudo apt autoremove -y",
      "output": "Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\nThe following packages will be REMOVED:\n  libjq1 libonig5\n0 upgraded, 0 newly installed, 2 to remove and 10 not upgraded.\nAfter this operation, 1084 kB disk space will be freed.\n(Reading database ... 4425 files and directories currently installed.)\nRemoving libjq1:arm64 (1.7.1-3ubuntu0.24.04.2) ...\nRemoving libonig5:arm64 (6.9.9-1build1) ...\nProcessing triggers for libc-bin (2.39-0ubuntu8.8) ..."
    },
    {
      "comment": "keep a package at its current version",
      "cmd": "sudo apt-mark hold tree",
      "output": "tree set on hold."
    },
    {
      "cmd": "apt-mark showhold",
      "output": "tree"
    },
    {
      "cmd": "sudo apt-mark unhold tree",
      "output": "Canceled hold on tree."
    }
  ]
}
```

- `apt remove` deletes the program but keeps its configuration in `/etc`. `apt purge` deletes the configuration too.
- `apt autoremove` removes dependencies nothing needs any more, here the two libraries `jq` pulled in.
- `apt-mark hold` stops a package from being upgraded, for example a database server you upgrade by hand. Remember to `unhold` it, or it never gets security fixes.
- `sudo apt clean` deletes downloaded package files from `/var/cache/apt/archives` when you need the disk space.

To install a `.deb` file you downloaded, give apt the path (with `./`), so it also installs the dependencies: `sudo apt install ./package.deb`. Plain `dpkg -i` does not resolve dependencies.

:::tip
`apt` is meant for people at a terminal; its output format may change between versions. In scripts and Dockerfiles, use `apt-get`, which has a stable interface, and run `apt-get update` in the same step as `apt-get install -y --no-install-recommends ...` so you never install from an old index.
:::

### Add a Third-Party Repository the Modern Way

Some software comes from the vendor's own repository: Docker, HashiCorp, Kubernetes, PostgreSQL, Node.js and many more. Older tutorials add the vendor's key with `apt-key add`. Do not follow them: `apt-key` trusted the key for **every** repository on the system, it was deprecated for years, and Debian 13 and Ubuntu 25.04 and later no longer ship it.

The current method stores the key in its own file and references it with `Signed-By`, so the key can only sign packages from that one repository. These are Docker's official instructions for Ubuntu, which use a deb822 `.sources` file:

```terminal
{
  "title": "add Docker's apt repository",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "output shortened to the plan",
      "cmd": "sudo apt install -y ca-certificates curl",
      "output": "Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\nThe following additional packages will be installed:\n  krb5-locales libbrotli1 libcurl4t64 libgssapi-krb5-2 libk5crypto3\n  libkeyutils1 libkrb5-3 libkrb5support0 libldap-common libldap2 libnghttp2-14\n  libpsl5t64 librtmp1 libsasl2-2 libsasl2-modules libsasl2-modules-db libssh-4\n  libssl3t64 openssl publicsuffix\nSuggested packages:\n  krb5-doc krb5-user libsasl2-modules-gssapi-mit\n  | libsasl2-modules-gssapi-heimdal libsasl2-modules-ldap libsasl2-modules-otp\n  libsasl2-modules-sql\nThe following NEW packages will be installed:\n  ca-certificates curl krb5-locales libbrotli1 libcurl4t64 libgssapi-krb5-2\n  libk5crypto3 libkeyutils1 libkrb5-3 libkrb5support0 libldap-common libldap2\n  libnghttp2-14 libpsl5t64 librtmp1 libsasl2-2 libsasl2-modules\n  libsasl2-modules-db libssh-4 openssl publicsuffix"
    },
    {
      "cmd": "sudo install -m 0755 -d /etc/apt/keyrings"
    },
    {
      "cmd": "sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc"
    },
    {
      "cmd": "sudo chmod a+r /etc/apt/keyrings/docker.asc"
    },
    {
      "cmd": "sudo tee /etc/apt/sources.list.d/docker.sources <<EOF\nTypes: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: $(. /etc/os-release && echo \"${UBUNTU_CODENAME:-$VERSION_CODENAME}\")\nComponents: stable\nArchitectures: $(dpkg --print-architecture)\nSigned-By: /etc/apt/keyrings/docker.asc\nEOF",
      "output": "Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: noble\nComponents: stable\nArchitectures: arm64\nSigned-By: /etc/apt/keyrings/docker.asc"
    },
    {
      "cmd": "sudo apt update",
      "output": "Get:1 https://download.docker.com/linux/ubuntu noble InRelease [48.5 kB]\nHit:2 http://ports.ubuntu.com/ubuntu-ports noble InRelease\nHit:3 http://ports.ubuntu.com/ubuntu-ports noble-updates InRelease\nGet:4 https://download.docker.com/linux/ubuntu noble/stable arm64 Packages [69.3 kB]\nHit:5 http://ports.ubuntu.com/ubuntu-ports noble-backports InRelease\nHit:6 http://ports.ubuntu.com/ubuntu-ports noble-security InRelease\nFetched 118 kB in 1s (135 kB/s)\nReading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\n9 packages can be upgraded. Run 'apt list --upgradable' to see them."
    },
    {
      "cmd": "apt-cache policy docker-ce | head -n 6",
      "output": "docker-ce:\n  Installed: (none)\n  Candidate: 5:29.9.2-1~ubuntu.24.04~noble\n  Version table:\n     5:29.9.2-1~ubuntu.24.04~noble 500\n        500 https://download.docker.com/linux/ubuntu noble/stable arm64 Packages"
    }
  ]
}
```

The new repository shows up in `apt update`, and `apt policy` shows the candidate version from it. From here, `sudo apt install docker-ce` would install Docker from Docker's repository, and `apt upgrade` keeps it updated. The [Docker guide](/guides/introduction-to-docker) continues from this point.

A few rules for third-party repositories:

- Every repository you add can install code that runs as root on your machine. Add only vendors you trust, and only over HTTPS.
- Check that the vendor supports your release. A repository for an older codename may install packages built against libraries you do not have.
- Store keys in `/etc/apt/keyrings/` (your own) and reference them with `Signed-By`. Packages that ship their own keys use `/usr/share/keyrings/`.
- **PPAs** (Personal Package Archives on Launchpad) are third-party repositories too. `sudo add-apt-repository ppa:owner/name` (from the `software-properties-common` package) adds the source and its key in one step.

## Python, pip and "externally-managed-environment"

Since Debian 12 and Ubuntu 23.04, `pip install` outside a virtual environment stops with an error. That protects the Python packages your system tools depend on from being overwritten:

```terminal
{
  "title": "pip refuses to touch the system Python",
  "prompt": "$",
  "steps": [
    {
      "cmd": "pip install requests",
      "output": "error: externally-managed-environment\n\n× This environment is externally managed\n╰─> To install Python packages system-wide, try apt install\n    python3-xyz, where xyz is the package you are trying to\n    install.\n\n    If you wish to install a non-Debian-packaged Python package,\n    create a virtual environment using python3 -m venv path/to/venv.\n    Then use path/to/venv/bin/python and path/to/venv/bin/pip. Make\n    sure you have python3-full installed.\n\n    If you wish to install a non-Debian packaged Python application,\n    it may be easiest to use pipx install xyz, which will manage a\n    virtual environment for you. Make sure you have pipx installed.\n\n    See /usr/share/doc/python3.12/README.venv for more information.\n\nnote: If you believe this is a mistake, please contact your Python installation or OS distribution provider. You can override this, at the risk of breaking your Python installation or OS, by passing --break-system-packages.\nhint: See PEP 668 for the detailed specification."
    }
  ]
}
```

Install Python libraries that a system tool needs with apt (`sudo apt install python3-requests`). For your own projects, create a virtual environment with `python3 -m venv .venv` (install `python3-venv` first on Ubuntu) and run pip inside it. For command-line tools written in Python, use `pipx install <tool>`. Avoid `--break-system-packages` unless you understand what it can break.

## dnf on Fedora, RHEL, Rocky and AlmaLinux

Fedora 41 and later use **DNF5**, a rewrite in C++. RHEL 10, Rocky Linux 10 and AlmaLinux 10 still use DNF 4. Everyday commands are the same in both; the differences are in output and in a few subcommands such as `config-manager`. On RHEL and its rebuilds, `yum` is a link to `dnf`.

Repositories are `.repo` files in `/etc/yum.repos.d/`:

```terminal
{
  "title": "Fedora 44 repositories",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "dnf repolist",
      "output": "repo id               repo name\nfedora                Fedora 44 - aarch64\nfedora-cisco-openh264 Fedora 44 openh264 (From Cisco) - aarch64\nupdates               Fedora 44 - aarch64 - Updates"
    },
    {
      "cmd": "cat /etc/yum.repos.d/fedora.repo | head -n 12",
      "output": "[fedora]\nname=Fedora $releasever - $basearch\n#baseurl=http://download.example/pub/fedora/linux/releases/$releasever/Everything/$basearch/os/\nmetalink=https://mirrors.fedoraproject.org/metalink?repo=fedora-$releasever&arch=$basearch\nenabled=1\ncountme=1\nmetadata_expire=7d\nrepo_gpgcheck=0\ntype=rpm\ngpgcheck=1\ngpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-fedora-$releasever-$basearch\nskip_if_unavailable=False"
    }
  ]
}
```

Install, query and remove a package:

```terminal
{
  "title": "dnf install, query and remove",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "dnf info jq",
      "output": "Updating and loading repositories:\nRepositories loaded.\nAvailable packages\nName           : jq\nEpoch          : 0\nVersion        : 1.8.1\nRelease        : 3.fc44\nArchitecture   : aarch64\nDownload size  : 204.7 KiB\nInstalled size : 484.8 KiB\nSource         : jq-1.8.1-3.fc44.src.rpm\nRepository     : updates\nSummary        : Command-line JSON processor\nURL            : https://jqlang.org/\nLicense        : MIT AND ICU AND CC-BY-3.0\nDescription    : lightweight and flexible command-line JSON processor\n               :\n               :  jq is like sed for JSON data – you can use it to slice\n               :  and filter and map and transform structured data with\n               :  the same ease that sed, awk, grep and friends let you\n               :  play with text.\n               :\n               :  It is written in portable C, and it has zero runtime\n               :  dependencies.\n               :\n               :  jq can mangle the data format that you have into the\n               :  one that you want with very little effort, and the\n               :  program to do so is often shorter and simpler than\n               :  you'd expect.\nVendor         : Fedora Project"
    },
    {
      "cmd": "sudo dnf install -y jq",
      "output": "Updating and loading repositories:\nRepositories loaded.\nPackage    Arch    Version         Repository      Size\nInstalling:\n jq        aarch64 0:1.8.1-3.fc44  updates    484.8 KiB\nInstalling dependencies:\n oniguruma aarch64 0:6.9.10-4.fc44 fedora     766.7 KiB\n\nTransaction Summary:\n Installing:         2 packages\n\nTotal size of inbound packages is 418 KiB. Need to download 418 KiB.\nAfter this operation, 1 MiB extra will be used (install 1 MiB, remove 0 B).\n[1/2] jq-0:1.8.1-3.fc44.aarch64         100% | 611.1 KiB/s | 204.7 KiB |  00m00s\n[2/2] oniguruma-0:6.9.10-4.fc44.aarch64 100% | 494.2 KiB/s | 213.0 KiB |  00m00s\n--------------------------------------------------------------------------------\n[2/2] Total                             100% | 260.1 KiB/s | 417.7 KiB |  00m02s\nRunning transaction\n[1/4] Verify package files              100% | 166.0   B/s |   2.0   B |  00m00s\n[2/4] Prepare transaction               100% |  40.0   B/s |   2.0   B |  00m00s\n[3/4] Installing oniguruma-0:6.9.10-4.f 100% |  24.2 MiB/s | 768.8 KiB |  00m00s\n[4/4] Installing jq-0:1.8.1-3.fc44.aarc 100% |   1.7 MiB/s | 487.1 KiB |  00m00s\nComplete!"
    },
    {
      "comment": "which package owns this file, and what did it install?",
      "cmd": "rpm -qf /usr/bin/jq",
      "output": "jq-1.8.1-3.fc44.aarch64"
    },
    {
      "cmd": "rpm -ql jq | grep -v build-id | head -n 4",
      "output": "/usr/bin/jq\n/usr/lib64/libjq.so.1\n/usr/lib64/libjq.so.1.0.4\n/usr/share/doc/jq"
    },
    {
      "comment": "dnf removes dependencies nothing else needs",
      "cmd": "sudo dnf remove -y jq",
      "output": "Package    Arch    Version         Repository      Size\nRemoving:\n jq        aarch64 0:1.8.1-3.fc44  updates    484.8 KiB\nRemoving unused dependencies:\n oniguruma aarch64 0:6.9.10-4.fc44 fedora     766.7 KiB\n\nTransaction Summary:\n Removing:           2 packages\n\nAfter this operation, 1 MiB will be freed (install 0 B, remove 1 MiB).\nRunning transaction\n[1/3] Prepare transaction               100% |  25.0   B/s |   2.0   B |  00m00s\n[2/3] Removing jq-0:1.8.1-3.fc44.aarch6 100% | 163.0   B/s |  16.0   B |  00m00s\n[3/3] Removing oniguruma-0:6.9.10-4.fc4 100% |  76.0   B/s |  14.0   B |  00m00s\nComplete!"
    },
    {
      "cmd": "dnf history list | head -n 3",
      "output": "ID Command line                          Date and time       Action(s) Altered\n 8 dnf remove -y jq                      2026-10-23 20:10:45                 2\n 7 dnf install -y jq                     2026-10-23 20:10:44                 2"
    }
  ]
}
```

Add a third-party repository by downloading its `.repo` file. The `config-manager` syntax changed in DNF5:

```terminal
{
  "title": "add Docker's dnf repository (DNF5)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sudo dnf config-manager addrepo --from-repofile=https://download.docker.com/linux/fedora/docker-ce.repo",
      "output": " https://download.docker.com/linux/fedo 100% |   1.8 KiB/s | 811.0   B |  00m00s"
    },
    {
      "cmd": "dnf repolist",
      "output": "repo id               repo name\ndocker-ce-stable      Docker CE Stable - aarch64\nfedora                Fedora 44 - aarch64\nfedora-cisco-openh264 Fedora 44 openh264 (From Cisco) - aarch64\nupdates               Fedora 44 - aarch64 - Updates"
    }
  ]
}
```

On RHEL 10 and its rebuilds (DNF 4), the same step is `sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo`, which needs the `dnf-plugins-core` package. dnf imports the repository's GPG key the first time you install from it and asks you to confirm the fingerprint; compare it with the one the vendor publishes.

### apt and dnf Side by Side

| Task                                  | Ubuntu / Debian                                 | Fedora / RHEL                                               |
| ------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| Refresh the index                     | `sudo apt update`                               | automatic (`sudo dnf makecache` to force it)                |
| Upgrade everything                    | `sudo apt upgrade`                              | `sudo dnf upgrade`                                          |
| List available upgrades               | `apt list --upgradable`                         | `dnf check-upgrade`                                         |
| Install                               | `sudo apt install pkg`                          | `sudo dnf install pkg`                                      |
| Remove                                | `sudo apt remove pkg`                           | `sudo dnf remove pkg`                                       |
| Remove unused dependencies            | `sudo apt autoremove`                           | `sudo dnf autoremove`                                       |
| Search                                | `apt search word`                               | `dnf search word`                                           |
| Details                               | `apt show pkg`                                  | `dnf info pkg`                                              |
| Which package owns a file             | `dpkg -S /path`                                 | `rpm -qf /path`                                             |
| Which package provides a missing file | `apt-file search name`                          | `dnf provides '*/name'`                                     |
| Files in a package                    | `dpkg -L pkg`                                   | `rpm -ql pkg`                                               |
| Hold a version                        | `sudo apt-mark hold pkg`                        | `sudo dnf versionlock add pkg`                              |
| History and undo                      | `/var/log/apt/history.log`                      | `dnf history list`, `sudo dnf history undo <id>`            |
| Install a group of packages           | `sudo apt install build-essential`              | `sudo dnf group install development-tools`                  |
| Automatic security updates            | `unattended-upgrades` (on by default on Ubuntu) | `dnf5-plugin-automatic` (Fedora), `dnf-automatic` (RHEL 10) |

On RHEL 10, `dnf versionlock` and `dnf provides` work as shown, and `versionlock` needs the `python3-dnf-plugin-versionlock` package. Group names differ between distributions, so run `dnf group list` first.

### Other Package Managers

| Task                | openSUSE (`zypper`)                         | Arch (`pacman`)       | Alpine (`apk`)              |
| ------------------- | ------------------------------------------- | --------------------- | --------------------------- |
| Refresh and upgrade | `sudo zypper refresh && sudo zypper update` | `sudo pacman -Syu`    | `apk update && apk upgrade` |
| Install             | `sudo zypper install pkg`                   | `sudo pacman -S pkg`  | `apk add pkg`               |
| Remove              | `sudo zypper remove pkg`                    | `sudo pacman -Rs pkg` | `apk del pkg`               |
| Search              | `zypper search word`                        | `pacman -Ss word`     | `apk search word`           |

On Arch, always upgrade the whole system with `pacman -Syu` before installing; `pacman -Sy pkg` on its own (a partial upgrade) can leave libraries out of step. In Alpine-based container images, use `apk add --no-cache pkg` so the index does not stay in the image.

## Snap, Flatpak and AppImage

These formats bundle an application with its dependencies, so one build runs on many distributions. They are most useful for desktop applications and for tools that need a newer version than your distribution ships.

```tabs
{
  "title": "Universal package formats",
  "tabs": [
    {
      "label": "Snap",
      "lang": "bash",
      "code": "# Preinstalled on Ubuntu; Firefox and the snap store are snaps there\nsnap find kubectl\nsudo snap install kubectl --classic\nsnap list\nsudo snap refresh            # snaps also update themselves in the background\nsudo snap remove kubectl"
    },
    {
      "label": "Flatpak",
      "lang": "bash",
      "code": "sudo apt install flatpak     # or: sudo dnf install flatpak (preinstalled on Fedora Workstation)\nflatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\nflatpak install flathub org.gimp.GIMP\nflatpak run org.gimp.GIMP\nflatpak update\nflatpak uninstall org.gimp.GIMP"
    },
    {
      "label": "AppImage",
      "lang": "bash",
      "code": "# One file, no installation. Most AppImages need FUSE 2:\nsudo apt install libfuse2t64    # Ubuntu 24.04 and later; libfuse2 on older releases\nchmod +x MyApp-x86_64.AppImage\n./MyApp-x86_64.AppImage"
    }
  ]
}
```

- **Snap** is Canonical's format with a central store. Snaps run confined and update automatically, which is convenient on desktops and surprising on servers; control the timing with `sudo snap refresh --hold` or `snap set system refresh.timer=...`.
- **Flatpak** targets desktop applications, mostly from Flathub, and runs them in a sandbox.
- **AppImage** is a single executable file. It does not update itself and is not checked by any package manager, so download it only from the project's own site.

On servers, prefer your distribution's packages or the vendor's official repository. They get security updates through the same `apt upgrade` or `dnf upgrade` as everything else.

## Building From Source

When software is not packaged, the classic build is:

```bash
sudo apt install build-essential        # compilers and make (Fedora: sudo dnf group install development-tools)
./configure --prefix=/usr/local
make
sudo make install
```

Installing into `/usr/local` keeps your files apart from the distribution's. The package manager does not know about them, so it will not update or remove them, and nothing tells you about security fixes. For anything you run in production, a package, a vendor repository or a container image is easier to keep patched.

## Troubleshooting

**"Could not get lock /var/lib/dpkg/lock-frontend".** Another apt process is running, often `unattended-upgrades` right after boot. Wait for it to finish (`ps aux | grep -E 'apt|dpkg'`). Do not delete the lock files.

**"NO_PUBKEY" or "The following signatures couldn't be verified".** The repository's key is missing or expired. Download the current key from the vendor's documentation into `/etc/apt/keyrings/` and check that the `Signed-By` path in the `.sources` file matches.

**"Unmet dependencies" or a half-finished install.** Run `sudo apt --fix-broken install`, then `sudo dpkg --configure -a` if dpkg was interrupted.

**"The following packages have been kept back".** On Ubuntu this is usually a phased update; wait. Otherwise the upgrade needs to add or remove packages, which `sudo apt full-upgrade` allows after you review the list.

**404 errors for an old release.** Releases that reached end of life move to `old-releases.ubuntu.com` (Ubuntu) or `archive.debian.org` (Debian). Upgrade to a supported release instead of pointing at the archive.

**dnf: "Error: GPG check FAILED".** The package was not signed with a key dnf trusts. Import the vendor's key (`sudo rpm --import <url>`) after you have checked its fingerprint. Do not set `gpgcheck=0`.

## Common Mistakes

- **Following `apt-key` tutorials.** Use a keyring file and `Signed-By` as shown above.
- **Adding repositories for another distribution or release**, for example a Debian repository on Ubuntu or a `jammy` repository on `noble`. Dependencies break in ways that are hard to undo.
- **Piping a download into `sudo bash`** without reading the script first.
- **Skipping `apt update`** before installing, and getting 404 errors for package versions the mirror has already replaced.
- **Holding packages and forgetting them.** Check `apt-mark showhold` or `dnf versionlock list` during upgrades.
- **Using `pip install --break-system-packages`** instead of a virtual environment.

## Summary

- Packages come from signed repositories; `apt` and `dnf` resolve dependencies, `dpkg` and `rpm` install single files.
- On Ubuntu and Debian: `apt update`, `apt upgrade`, `apt install`, `apt remove`, `apt autoremove`, and `dpkg -L` / `dpkg -S` to query.
- Repositories live in deb822 `.sources` files in `/etc/apt/sources.list.d/`, with keys in their own keyring files referenced by `Signed-By`. `apt-key` is gone.
- On Fedora and RHEL: `dnf install`, `dnf upgrade`, `dnf remove`, `rpm -qf` / `rpm -ql`, and `.repo` files in `/etc/yum.repos.d/`.
- Snap, Flatpak and AppImage bundle dependencies and suit desktop apps; servers are easier to patch with distribution packages.
- Use virtual environments for Python libraries instead of the system `pip`.

Next: [User and Group Management](/guides/introduction-to-linux/06-user-management), where you create accounts, manage groups and set up `sudo` and SSH keys.

## Keep Learning

- Interview questions: [Linux package management](/interview-questions/junior/linux-package-management)
- [Introduction to Docker](/guides/introduction-to-docker), which starts from the Docker repository you added above
- [Linux Command Line Quiz](/quizzes/linux-quiz)
