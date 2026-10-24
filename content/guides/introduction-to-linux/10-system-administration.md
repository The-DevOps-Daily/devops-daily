---
title: 'Linux System Administration Basics: systemd, Logs, Updates and Security'
description: 'Run services and timers with systemd, read logs with journalctl, automate updates, back up with rsync, harden SSH and fix full disks and failed boots.'
order: 10
---

System administration is the work that keeps a Linux machine useful after the installation: services that start at boot and come back after a crash, jobs that run on schedule, logs you can search, updates that arrive without you, backups you have actually restored, an SSH server that only lets the right people in, and the habit of checking the same few things first when something breaks.

This last part puts the earlier parts together on one server. The lab web site from Part 7 becomes a systemd service, the backup script from Part 9 runs every night from a timer, and you harden SSH, automate updates and practise the most common repairs.

## Prerequisites

- A Linux server or VM where you have `sudo`: Ubuntu 24.04 LTS or Debian 13 for the examples, Fedora or RHEL 10 where noted.
- The earlier parts, especially [users](/guides/introduction-to-linux/06-user-management), [processes and systemd](/guides/introduction-to-linux/07-process-management) and the [backup script](/guides/introduction-to-linux/09-shell-scripting).
- A fresh `~/lab` from [Part 3](/guides/introduction-to-linux/03-command-line-interface#h2-set-up-the-practice-directory) for the log rotation and backup examples.

Output that needs systemd, `sshd` or `logrotate` comes from a Debian 12 machine (systemd 252, OpenSSH 9.2), checked against unit and configuration files in a test directory; the blocks say so. The rest comes from Ubuntu 24.04.5 LTS. Commands that change a running system are shown with example output.

## Run Your Own Service With systemd

A **unit file** tells systemd how to run a service. This one runs the lab site as the `notes-site` system account created in Part 6, restarts it if it crashes, and uses systemd's sandboxing options so that a bug in the web server cannot change system files or read anyone's home directory. Create a working directory with `mkdir -p ~/units` and save the file as `~/units/notes-site.service`:

```ini
# /etc/systemd/system/notes-site.service
[Unit]
Description=Notes site (static files over HTTP)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=notes-site
Group=notes-site
WorkingDirectory=/srv/notes-site
ExecStart=/usr/bin/python3 -m http.server 8080 --bind 127.0.0.1 --directory /srv/notes-site
Restart=on-failure
RestartSec=5

# Sandboxing: read-only system, no access to /home, a private /tmp
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectControlGroups=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
# Resource limits (cgroup v2, Part 7)
MemoryMax=256M
TasksMax=50

[Install]
WantedBy=multi-user.target
```

Python's `http.server` is fine for a lab, not for production; for a real site, the same unit pattern runs nginx, Caddy or your application. The important lines:

- `[Unit]`: a description and ordering. `After=` only orders the start; `Wants=` pulls the other unit in.
- `[Service]`: give `ExecStart=` an absolute path (systemd also searches a short fixed list of directories for a bare name, but a full path removes any doubt). `Restart=on-failure` restarts the service when it exits with an error code, crashes or times out; a clean stop, including `systemctl stop` or a plain `kill` with SIGTERM, does not trigger a restart. `User=` drops root.
- `[Install]`: `WantedBy=multi-user.target` is what `systemctl enable` hooks into, so the service starts at boot.

Check a unit file before you install it. `systemd-analyze verify` takes a path, so you can check files in your working directory, and it catches typos in option names and values (output from a Debian 12 machine):

```terminal
{
  "title": "verify unit files (Debian 12)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "systemd-analyze verify ~/units/notes-site.service && echo \"notes-site.service: OK\"",
      "output": "notes-site.service: OK"
    },
    {
      "comment": "a unit with two mistakes",
      "cmd": "cat ~/units/broken.service",
      "output": "[Unit]\nDescription=A unit with mistakes\n\n[Service]\nExecStart=python3 -m http.server\nRestart=sometimes\nRestartSecs=5"
    },
    {
      "cmd": "systemd-analyze verify ~/units/broken.service",
      "output": "/home/dev/units/broken.service:6: Failed to parse service restart specifier, ignoring: sometimes\n/home/dev/units/broken.service:7: Unknown key 'RestartSecs' in section [Service], ignoring."
    }
  ]
}
```

Install and start it (these commands change the system, so the output is an example):

```bash
sudo mkdir -p /srv/notes-site && sudo cp -r ~/lab/site/. /srv/notes-site/
sudo cp ~/units/notes-site.service /etc/systemd/system/
sudo systemctl daemon-reload                  # re-read unit files after every change
sudo systemctl enable --now notes-site.service
systemctl status notes-site.service --no-pager
```

```text
● notes-site.service - Notes site (static files over HTTP)
     Loaded: loaded (/etc/systemd/system/notes-site.service; enabled; preset: enabled)
     Active: active (running) since Sat 2026-10-24 09:12:40 UTC; 4s ago
   Main PID: 4211 (python3)
      Tasks: 1 (limit: 50)
     Memory: 9.1M (max: 256.0M available: 246.8M peak: 9.3M)
        CPU: 98ms
     CGroup: /system.slice/notes-site.service
             └─4211 /usr/bin/python3 -m http.server 8080 --bind 127.0.0.1 --directory /srv/notes-site
```

To change a packaged unit, never edit the file under `/usr/lib/systemd/system/`: the next package update overwrites it. Run `sudo systemctl edit nginx.service` instead. It opens an editor for a **drop-in** file, `/etc/systemd/system/nginx.service.d/override.conf`, whose settings are added on top of the original, and it reloads systemd for you. `systemctl cat nginx.service` shows the original and every drop-in together.

## Schedule Jobs With Timers or cron

### systemd Timers

A timer starts a service on a schedule. You need two units: a service that does the work once (`Type=oneshot`), and a timer with the same name that says when.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "backup-site.timer", "sub": "OnCalendar 02:30", "icon": "activity", "tone": "violet" },
    { "label": "backup-site.service", "sub": "Type=oneshot", "icon": "gear", "tone": "blue" },
    { "label": "/usr/local/bin/backup-site", "sub": "script from Part 9", "icon": "box", "tone": "amber" },
    { "label": "journal", "sub": "journalctl -u backup-site", "icon": "database", "tone": "green" }
  ]
}
```

```ini
# /etc/systemd/system/backup-site.service
[Unit]
Description=Back up /srv/notes-site

[Service]
Type=oneshot
ExecStart=/usr/local/bin/backup-site --keep 7 /srv/notes-site /var/backups/notes-site
Nice=19
IOSchedulingClass=idle
```

```ini
# /etc/systemd/system/backup-site.timer
[Unit]
Description=Nightly backup of /srv/notes-site

[Timer]
OnCalendar=*-*-* 02:30:00
RandomizedDelaySec=15min
Persistent=true

[Install]
WantedBy=timers.target
```

`Persistent=true` runs a missed job at the next boot if the machine was off at 02:30, which cron cannot do. `RandomizedDelaySec` spreads the start over 15 minutes, so a hundred servers do not all hit the backup storage at the same second. `Nice=19` and `IOSchedulingClass=idle` keep the backup from slowing down the site.

Save both in `~/units` as well. `systemd-analyze verify` also checks that `ExecStart=` points to an executable file, so install the backup script from Part 9 first with `sudo install -m 0755 ~/scripts/backup-site /usr/local/bin/backup-site`. `systemd-analyze calendar` shows when an expression fires next, which saves a lot of guessing (output from a Debian 12 machine):

```terminal
{
  "title": "check the schedule (Debian 12)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "systemd-analyze verify ~/units/backup-site.service ~/units/backup-site.timer && echo \"units: OK\"",
      "output": "units: OK"
    },
    {
      "cmd": "systemd-analyze calendar '*-*-* 02:30:00'",
      "output": "Normalized form: *-*-* 02:30:00\n    Next elapse: Sat 2026-10-24 02:30:00 UTC\n       From now: 5h 1min left"
    },
    {
      "comment": "Monday to Friday at 08:00, and every 15 minutes",
      "cmd": "systemd-analyze calendar --iterations=2 'Mon..Fri 08:00' '*:0/15'",
      "output": "  Original form: Mon..Fri 08:00\nNormalized form: Mon..Fri *-*-* 08:00:00\n    Next elapse: Mon 2026-10-26 08:00:00 UTC\n       From now: 2 days left\n       Iter. #2: Tue 2026-10-27 08:00:00 UTC\n       From now: 3 days left\n\n  Original form: *:0/15\nNormalized form: *-*-* *:00/15:00\n    Next elapse: Fri 2026-10-23 21:30:00 UTC\n       From now: 1min 27s left\n       Iter. #2: Fri 2026-10-23 21:45:00 UTC\n       From now: 16min left"
    }
  ]
}
```

Install the two units, enable the **timer** (not the service), and run the service once by hand to test it (example output):

```bash
sudo cp ~/units/backup-site.service ~/units/backup-site.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now backup-site.timer
sudo systemctl start backup-site.service          # run it once now
journalctl -u backup-site.service --no-pager -n 6
```

```text
Oct 24 09:20:11 devbox systemd[1]: Starting backup-site.service - Back up /srv/notes-site...
Oct 24 09:20:11 devbox backup-site[4380]: 2026-10-24T09:20:11Z backup-site: archiving /srv/notes-site to /var/backups/notes-site/notes-site-20261024-092011.tar.gz
Oct 24 09:20:11 devbox backup-site[4380]: 2026-10-24T09:20:11Z backup-site: created 4.0K archive
Oct 24 09:20:11 devbox backup-site[4380]: 2026-10-24T09:20:11Z backup-site: done, 1 archive(s) kept
Oct 24 09:20:11 devbox systemd[1]: backup-site.service: Deactivated successfully.
Oct 24 09:20:11 devbox systemd[1]: Finished backup-site.service - Back up /srv/notes-site.
```

The script's messages on standard error ended up in the journal with no extra work. `systemctl list-timers` shows every timer, when it last ran and when it runs next. These are the timers on a Debian 12 machine:

```terminal
{
  "title": "systemctl list-timers (Debian 12)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "systemctl list-timers --no-pager",
      "output": "NEXT                        LEFT          LAST                        PASSED       UNIT                         ACTIVATES\nFri 2026-10-23 22:43:37 UTC 1h 40min left Fri 2026-10-23 05:06:05 UTC 15h ago      apt-daily.timer              apt-daily.service\nSat 2026-10-24 02:21:41 UTC 5h 18min left Fri 2026-10-23 04:06:56 UTC 16h ago      man-db.timer                 man-db.service\nSat 2026-10-24 03:01:29 UTC 5h 58min left Fri 2026-10-23 03:38:36 UTC 17h ago      apt-daily-upgrade.timer      apt-daily-upgrade.service\nSat 2026-10-24 10:17:46 UTC 13h left      Fri 2026-10-23 10:17:46 UTC 10h ago      systemd-tmpfiles-clean.timer systemd-tmpfiles-clean.service\nSat 2026-10-24 21:00:00 UTC 23h left      Fri 2026-10-23 21:00:01 UTC 2min 48s ago dpkg-db-backup.timer         dpkg-db-backup.service\nSat 2026-10-24 21:00:00 UTC 23h left      Fri 2026-10-23 21:00:01 UTC 2min 48s ago logrotate.timer              logrotate.service\nSun 2026-10-25 00:10:56 UTC 1 day 3h left Sun 2026-10-18 00:11:05 UTC 5 days ago   e2scrub_all.timer            e2scrub_all.service\nSun 2026-10-25 22:36:09 UTC 2 days left   Sun 2026-10-18 21:05:16 UTC 4 days ago   fstrim.timer                 fstrim.service\n\n8 timers listed.\nPass --all to see loaded but inactive timers, too."
    }
  ]
}
```

Packages ship their own timers: `logrotate.timer` rotates logs, `apt-daily.timer` and `apt-daily-upgrade.timer` drive unattended upgrades, and `fstrim.timer` trims SSDs.

### cron

cron is older, simpler and still everywhere. Edit your own schedule with `crontab -e` (jobs run as you) or root's with `sudo crontab -e`; each line is five time fields and a command:

```text
# minute  hour  day-of-month  month  day-of-week  command
*/15 * * * *    /home/alice/bin/check-disk
0 8 * * 1-5     /home/alice/bin/report
@reboot         /home/alice/bin/warm-cache
```

System-wide jobs live in files under `/etc/cron.d/`, with an extra field for the user. The nightly backup as a cron job would be:

```text
# /etc/cron.d/backup-site
30 2 * * *  root  /usr/local/bin/backup-site --keep 7 /srv/notes-site /var/backups/notes-site 2>&1 | logger -t backup-site
```

- `*` means every value, `*/15` every 15th, `1-5` a range (Monday to Friday), and `1,15` a list.
- cron runs commands with a minimal `PATH` (`/usr/bin:/bin`), no login files, and your crontab's time zone is the system's. Use absolute paths, and test the command with `env -i /bin/sh -c '...'` to see what cron sees.
- cron does not log a job's output; it tries to mail it to the user. Redirect it to the journal yourself: `... 2>&1 | logger -t backup-site`. cron's own messages go to `journalctl -u cron` (`crond` on Fedora and RHEL).
- Executable scripts dropped into `/etc/cron.daily/` (and `cron.hourly`, `cron.weekly`, `cron.monthly`) run on that schedule as root.

Use timers for new jobs on systemd machines: you get logs in the journal, `Persistent=`, randomized delays, resource limits and dependencies. Use cron when a crontab line is all you need or when the job must also run on systems without systemd. Try expressions in the [cron expression simulator](/games/cron-expression-simulator).

## Logs: journalctl and /var/log

systemd's **journal** collects the output of every service, the kernel's messages and the classic syslog stream in one indexed store. The options you will use daily:

| Command                                    | Shows                                                               |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `journalctl -u nginx`                      | one unit's log (add `-u` several times for more units)              |
| `journalctl -u nginx -f`                   | follow new lines live                                               |
| `journalctl -u nginx --since "1 hour ago"` | a time window; also `--since 2026-10-24 --until "2026-10-24 12:00"` |
| `journalctl -p err -b`                     | priority error and worse since the current boot                     |
| `journalctl -b -1`                         | the previous boot, after a crash or unexpected reboot               |
| `journalctl -k`                            | kernel messages (like `dmesg`)                                      |
| `journalctl -n 50 --no-pager`              | the last 50 lines, without the pager, for scripts                   |
| `journalctl -o json-pretty -n 1`           | one entry with all its fields                                       |

Output from a Debian 12 machine:

```terminal
{
  "title": "journalctl (Debian 12)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "journalctl -u logrotate.service -n 6 --no-pager",
      "output": "Oct 22 21:00:02 devbox systemd[1]: Starting logrotate.service - Rotate log files...\nOct 22 21:00:03 devbox systemd[1]: logrotate.service: Deactivated successfully.\nOct 22 21:00:03 devbox systemd[1]: Finished logrotate.service - Rotate log files.\nOct 23 21:00:01 devbox systemd[1]: Starting logrotate.service - Rotate log files...\nOct 23 21:00:02 devbox systemd[1]: logrotate.service: Deactivated successfully.\nOct 23 21:00:02 devbox systemd[1]: Finished logrotate.service - Rotate log files."
    },
    {
      "cmd": "journalctl --disk-usage",
      "output": "Archived and active journals take up 125.6M in the file system."
    }
  ]
}
```

The journal keeps itself to a size limit (by default 10% of the file system, at most 4 GiB). To set your own limit, add a drop-in and restart the journal:

```ini
# /etc/systemd/journald.conf.d/size.conf
[Journal]
SystemMaxUse=500M
```

Then run `sudo systemctl restart systemd-journald`. `sudo journalctl --vacuum-size=200M` trims old entries right away. If `/var/log/journal/` does not exist, the journal lives only in memory and is lost at reboot; current Debian, Ubuntu and Fedora create it, so logs are persistent.

Text log files in `/var/log` still matter:

- **Ubuntu** installs rsyslog, which copies journal messages into `/var/log/syslog` and `/var/log/auth.log` (logins, sudo, SSH).
- **Debian 12 and 13** no longer install rsyslog by default: use `journalctl`, or install `rsyslog` if a tool needs the files.
- **Fedora** logs to the journal only; **RHEL** keeps rsyslog with `/var/log/messages` and `/var/log/secure`.
- Applications such as nginx, Apache and PostgreSQL write their own files under `/var/log/<name>/`.

### Rotate Log Files With logrotate

Files that applications write grow forever unless something rotates them. **logrotate** runs daily from `logrotate.timer` and reads `/etc/logrotate.conf` and `/etc/logrotate.d/`. Here is a configuration for the lab logs; create its directory with `mkdir -p ~/logrotate-test` first.

Save it as `~/logrotate-test/lab.conf`:

```text
/home/dev/lab/logs/*.log {
    daily
    rotate 14
    missingok
    notifempty
    compress
    delaycompress
}
```

- `daily` and `rotate 14` keep two weeks; `missingok` and `notifempty` avoid errors and empty archives.
- `compress` gzips old files; `delaycompress` leaves the newest rotated file uncompressed, because a program may still be writing to it.
- For a service that keeps its log file open, add `postrotate` with `systemctl reload <service>` (or use `copytruncate` when the program cannot reopen its log).

Test a configuration with `-d` (debug, changes nothing) and force a rotation with `-f`. Packaged configurations need root, but your own configuration with a state file of your own works as a regular user. Debian does not put `/usr/sbin` on a regular user's `PATH`, so the commands use the full path (output from a Debian 12 machine):

```terminal
{
  "title": "logrotate: test, then force a rotation (Debian 12)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/logrotate-test"
    },
    {
      "cmd": "/usr/sbin/logrotate -d -s state lab.conf 2>&1 | head -n 12",
      "output": "warning: logrotate in debug mode does nothing except printing debug messages!  Consider using verbose mode (-v) instead if this is not what you want.\n\nreading config file lab.conf\nReading state from file: state\nstate file state does not exist\nAllocating hash table for state file, size 64 entries\n\nHandling 1 logs\n\nrotating pattern: /home/dev/lab/logs/*.log  after 1 days (14 rotations)\nempty log files are not rotated, old logs are removed\nconsidering log /home/dev/lab/logs/access.log"
    },
    {
      "cmd": "/usr/sbin/logrotate -f -s state lab.conf"
    },
    {
      "cmd": "ls ~/lab/logs",
      "output": "access.log.1\nerror.log.1"
    }
  ]
}
```

The current logs became `access.log.1` and `error.log.1`, uncompressed because of `delaycompress`; the next rotation compresses them. This configuration has no `create` line, so no new empty file appears: the application creates one when it writes again, or you add `create 0640 www-data adm` to have logrotate create it with the right owner.

## Keep the System Updated

Most break-ins on Linux servers use known vulnerabilities in software that was never updated. Automate security updates, and watch for the ones that need a restart.

**Ubuntu** installs and enables **unattended-upgrades**, which installs security updates every day through `apt-daily-upgrade.timer`. The switches are in `/etc/apt/apt.conf.d/20auto-upgrades` and what it may install is in `/etc/apt/apt.conf.d/50unattended-upgrades`. Check what it would do with `sudo unattended-upgrade --dry-run --debug`, and read `/var/log/unattended-upgrades/` afterwards. Ubuntu 24.04 servers also run **needrestart** after upgrades: it restarts services that still use the old versions of updated libraries, and lists what it cannot restart, such as your own login session.

**Debian** installs the same tool on request:

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades      # answer Yes to enable it
```

**Fedora** uses `dnf5-plugin-automatic` and **RHEL 10** uses `dnf-automatic`. Set `apply_updates = yes` in `/etc/dnf/automatic.conf` (in the `[commands]` section) and enable the timer:

```bash
sudo dnf install dnf5-plugin-automatic && sudo systemctl enable --now dnf5-automatic.timer   # Fedora
sudo dnf install dnf-automatic && sudo systemctl enable --now dnf-automatic.timer            # RHEL 10
```

A running program keeps using the old version of a library until it restarts, and a new kernel only runs after a reboot. On Ubuntu, the file `/var/run/reboot-required` appears when an update needs a reboot. On Debian, install `needrestart` and run `sudo needrestart -k`, which compares the running kernel with the newest installed one. On RHEL, `sudo dnf needs-restarting -r` (from `dnf-plugins-core`) tells you, and `sudo dnf needs-restarting -s` lists services to restart. Plan regular reboots, or use live kernel patching (Canonical Livepatch through Ubuntu Pro, which is free for personal use on a few machines, or `kpatch` on RHEL) for the time in between.

Know when your release stops getting fixes. Ubuntu 24.04 LTS gets standard security updates until May 2029. Debian 13 is supported until August 2028 and through Debian LTS until June 2030. Debian 12 moved to LTS on 12 July 2026, which runs until 30 June 2028, so plan its upgrade to Debian 13. Upgrade Ubuntu releases with `sudo do-release-upgrade`, and Debian by changing the codename in the sources and running `sudo apt full-upgrade`, after reading the release notes and taking a backup.

## Back Up, and Test the Restore

A backup you have never restored is a hope, not a backup. The usual rule is **3-2-1**: three copies of the data, on two different kinds of storage, one of them off the machine and off the site.

What to back up on a typical server:

- `/etc` (configuration), `/home`, `/srv` and `/root`;
- application data under `/var/lib/<app>`, taken with the application's own dump tool for databases (`pg_dump`, see the [Postgres guide](/guides/introduction-to-postgres/09-backup-and-recovery)), not by copying the live files;
- the list of installed packages: `dpkg --get-selections` or `dnf repoquery --userinstalled`;
- your infrastructure code, which lets you rebuild the rest.

The backup script from Part 9 makes full archives. `rsync` with `--link-dest` makes **snapshots** instead: every snapshot looks like a full copy, but files that did not change are hard links to the previous snapshot and take no extra space:

```terminal
{
  "title": "space-saving snapshots with rsync --link-dest",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "mkdir -p ~/snapshots"
    },
    {
      "comment": "the first snapshot is a full copy",
      "cmd": "rsync -a ~/lab/site/ ~/snapshots/2026-10-22/"
    },
    {
      "cmd": "echo '<p>News</p>' > ~/lab/site/news.html"
    },
    {
      "comment": "the next one hard-links unchanged files to the previous snapshot",
      "cmd": "rsync -a --link-dest=../2026-10-22 ~/lab/site/ ~/snapshots/2026-10-23/"
    },
    {
      "comment": "same inode number: one copy on disk, two names",
      "cmd": "ls -li ~/snapshots/*/index.html",
      "output": "595318 -rw-rw-r-- 2 dev dev 221 Oct 23 21:28 /home/dev/snapshots/2026-10-22/index.html\n595318 -rw-rw-r-- 2 dev dev 221 Oct 23 21:28 /home/dev/snapshots/2026-10-23/index.html"
    },
    {
      "comment": "du counts each hard-linked file once",
      "cmd": "du -sh ~/snapshots/*",
      "output": "24K\t/home/dev/snapshots/2026-10-22\n16K\t/home/dev/snapshots/2026-10-23"
    },
    {
      "comment": "test the restore: compare the snapshot with the original",
      "cmd": "diff -r ~/lab/site ~/snapshots/2026-10-23 && echo \"restore check: identical\"",
      "output": "restore check: identical"
    }
  ]
}
```

A path given to `--link-dest` is relative to the destination directory. Add `--delete` to mirror deletions, and `-e ssh` with a `host:path` destination to send the snapshot to another machine. For encrypted, deduplicated backups to object storage or another server, use **restic** or **BorgBackup**; both are packaged on every major distribution.

Whatever tool you use, put a restore on the calendar: pick a random file or a database dump, restore it to a scratch location, and check it.

## Harden the Server

### SSH

SSH is the front door of almost every server. Put your settings in a drop-in file instead of editing `/etc/ssh/sshd_config`, so package updates do not conflict with them:

```text
# /etc/ssh/sshd_config.d/10-hardening.conf
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
MaxAuthTries 3
X11Forwarding no
AllowGroups sudo ssh-users
# on Fedora and RHEL the admin group is wheel:
# AllowGroups wheel ssh-users
```

- Turn off passwords only after your SSH key login works ([Part 6](/guides/introduction-to-linux/06-user-management)), and keep a session open while you test.
- `AllowGroups` limits SSH to members of the listed groups; create `ssh-users` for people who need SSH but not `sudo`. Before you reload, check with `id` that your own account is in one of them.
- Old guides add `Protocol 2` (removed from OpenSSH long ago; current versions only speak protocol 2) and `ClientAliveCountMax 0` as an idle timeout (since OpenSSH 8.2, `0` disables the check instead). Leave both out.

**sshd uses the first value it finds** for most options, and Debian and Ubuntu read the drop-in files at the top of `sshd_config`, in alphabetical order. Cloud images often ship `50-cloud-init.conf` with `PasswordAuthentication yes`. Your `10-hardening.conf` is read first and wins; the same file named `60-hardening.conf` would lose. `sshd -t` checks the syntax and `sshd -T` prints the settings sshd would really use, so check both. You can try this safely as a normal user with a test configuration that copies that layout, because `sshd -t -f file` and `sshd -T -f file` only read files. `sshd` lives in `/usr/sbin`, which is not on a regular user's `PATH` on Debian, so the commands use the full path (output from a Debian 12 machine with OpenSSH 9.2):

```terminal
{
  "title": "build a test configuration in ~/sshd-test",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "mkdir -p ~/sshd-test/sshd_config.d && cd ~/sshd-test"
    },
    {
      "comment": "a host key for the test, so sshd can load the configuration",
      "cmd": "ssh-keygen -q -t ed25519 -f ssh_host_ed25519_key -N ''"
    },
    {
      "comment": "a main file that, like Debian and Ubuntu, reads the drop-ins first",
      "cmd": "printf '%s\\n' \"Include $HOME/sshd-test/sshd_config.d/*.conf\" \"HostKey $HOME/sshd-test/ssh_host_ed25519_key\" 'KbdInteractiveAuthentication no' 'UsePAM yes' > sshd_config"
    },
    {
      "comment": "what a cloud image ships",
      "cmd": "echo 'PasswordAuthentication yes' > sshd_config.d/50-cloud-init.conf"
    }
  ]
}
```

```terminal
{
  "title": "first match wins in sshd_config (Debian 12)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/sshd-test && ls sshd_config.d",
      "output": "50-cloud-init.conf"
    },
    {
      "cmd": "printf 'PermitRootLogin no\\nPasswordAuthentication no\\nMaxAuthTries 3\\n' > sshd_config.d/60-hardening.conf"
    },
    {
      "comment": "60-hardening.conf is read after 50-cloud-init.conf, so passwords stay on",
      "cmd": "/usr/sbin/sshd -T -f sshd_config | grep -E '^(permitrootlogin|passwordauthentication|maxauthtries) '",
      "output": "maxauthtries 3\npermitrootlogin no\npasswordauthentication yes"
    },
    {
      "cmd": "mv sshd_config.d/60-hardening.conf sshd_config.d/10-hardening.conf"
    },
    {
      "cmd": "/usr/sbin/sshd -T -f sshd_config | grep -E '^(permitrootlogin|passwordauthentication|maxauthtries) '",
      "output": "maxauthtries 3\npermitrootlogin no\npasswordauthentication no"
    },
    {
      "comment": "a typo: sshd -t refuses the configuration",
      "cmd": "echo 'PermitRootLogn no' >> sshd_config.d/10-hardening.conf"
    },
    {
      "cmd": "/usr/sbin/sshd -t -f sshd_config",
      "output": "/home/dev/sshd-test/sshd_config.d/10-hardening.conf: line 4: Bad configuration option: PermitRootLogn\n/home/dev/sshd-test/sshd_config.d/10-hardening.conf: terminating, 1 bad configuration options"
    }
  ]
}
```

On the server, run `sudo sshd -t` after every change and reload only if it prints nothing: `sudo systemctl reload ssh` on Debian and Ubuntu, `sudo systemctl reload sshd` on Fedora and RHEL.

:::warning
Ubuntu 24.04 starts SSH through **socket activation**: systemd, not sshd, listens on port 22. If you change `Port` or `ListenAddress` in `sshd_config`, run `sudo systemctl daemon-reload` and `sudo systemctl restart ssh.socket`, open the new port in the firewall first, and test from a second terminal before you close the first one.
:::

To slow down password-guessing bots, install **fail2ban**, which bans addresses after repeated failures. On Ubuntu, `sudo apt install fail2ban` with the default `sshd` jail is enough. Debian 12 and 13 log only to the journal, so also install `python3-systemd` and set `backend = systemd` for the `sshd` jail in `/etc/fail2ban/jail.local`. With password logins turned off, fail2ban mostly keeps the logs readable; the keys already stop the guessing. The [SSH hardening checklist](/checklists/ssh-hardening) has the complete list.

### Firewall, Services and Accounts

- Allow only the ports you need with ufw, firewalld or nftables, SSH first ([Part 8](/guides/introduction-to-linux/08-networking)).
- List what listens with `sudo ss -tlnp`, and stop what you do not use: `sudo systemctl disable --now cups.service`.
- Review who can log in and who has `sudo` (`getent group sudo`, or `wheel`), and lock accounts of people who left ([Part 6](/guides/introduction-to-linux/06-user-management)).

### File Permissions and setuid Programs

A setuid program runs with its owner's rights whoever starts it, and root-owned ones run as root (Part 4), so attackers look for them first. Know which ones you have; this is the full list on an Ubuntu 24.04 base image with `sudo` installed:

```terminal
{
  "title": "setuid programs on Ubuntu 24.04",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sudo find / -xdev -perm -4000 -type f 2>/dev/null | sort",
      "output": "/usr/bin/chfn\n/usr/bin/chsh\n/usr/bin/gpasswd\n/usr/bin/mount\n/usr/bin/newgrp\n/usr/bin/passwd\n/usr/bin/su\n/usr/bin/sudo\n/usr/bin/umount"
    }
  ]
}
```

Compare the list over time and investigate anything new. `sudo find / -xdev -type f -perm -o+w` lists world-writable files, which should be rare outside `/tmp`.

### Mandatory Access Control: AppArmor and SELinux

On top of normal permissions, Ubuntu and Debian confine many programs with **AppArmor** (`sudo aa-status` lists the loaded profiles), and Fedora and RHEL use **SELinux** (`getenforce` should print `Enforcing`). When SELinux blocks something, do not turn it off: read the denial with `sudo ausearch -m avc -ts recent`, and fix the file labels with `restorecon -Rv /path` or allow the specific case with `setsebool`.

To review a whole machine, **Lynis** (`sudo apt install lynis`, then `sudo lynis audit system`) runs hundreds of checks and prints suggestions. Use it as a checklist, not as a score to maximise.

## Troubleshooting

When something breaks, start with the same four commands; they answer "what failed, when, and why" on most systems:

```bash
systemctl --failed                     # units that failed
journalctl -p err -b --no-pager        # errors since this boot
journalctl -k -b | tail -n 30          # recent kernel messages: disks, OOM killer, hardware
df -h && df -i                         # space and inodes on every file system
```

### The Disk Is Full, but du Cannot Find the Files

A common puzzle: `df` says the disk is full, you delete a huge log file, and the space does not come back. A process still has the deleted file open, so the kernel cannot free it until that process closes it or exits. Here a `sleep` process plays the part of a daemon that keeps its log open:

```terminal
{
  "title": "find deleted files that still use space",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sleep 600 > ~/big.log &"
    },
    {
      "cmd": "head -c 30M /dev/zero > ~/big.log && ls -lh ~/big.log",
      "output": "-rw-rw-r-- 1 dev dev 30M Oct 23 21:28 /home/dev/big.log"
    },
    {
      "cmd": "rm ~/big.log"
    },
    {
      "comment": "+L1: open files with fewer than one link, that is, deleted ones",
      "cmd": "lsof +L1",
      "output": "COMMAND PID USER   FD   TYPE DEVICE SIZE/OFF NLINK   NODE NAME\nsleep    22  dev    1w   REG    8,1 31457280     0 595369 /home/dev/big.log (deleted)"
    },
    {
      "comment": "restart or stop the process that holds it, and the space is freed",
      "cmd": "kill %1"
    }
  ]
}
```

On a server, run `sudo lsof +L1`, then restart the service that holds the file (`sudo systemctl restart <service>`). To stop it happening, rotate logs with `copytruncate` or a `postrotate` reload, as shown above.

### High Load or Memory Pressure

`vmstat` shows the whole system in one line per interval:

```terminal
{
  "title": "vmstat: one line per second",
  "prompt": "$",
  "steps": [
    {
      "cmd": "vmstat 1 3",
      "output": "procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------\n r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu\n 2  1 1588588 1384480  44944 1395724    7   12   153    99  570    1  6  1 93  1  0  0\n 1  0 1588588 1384352  46204 1396464    4    0  2116    16 1958 2622 18  2 80  1  0  0\n 0  0 1588588 1385828  46204 1396464    0    0     0     0 1196 1727  5  2 94  0  0  0"
    }
  ]
}
```

`r` is the number of runnable processes (compare with the CPU count), `b` processes blocked on I/O, `si`/`so` memory swapped in and out per second (anything steady above zero means too little RAM), and `wa` the CPU time spent waiting for disk. Then find the process with `top` or `ps` ([Part 7](/guides/introduction-to-linux/07-process-management)). `sysstat` adds `iostat -x 1` and `pidstat 1`, which show live disk and per-process load, and `sar`, which shows history once collection is on: after installing it, run `sudo dpkg-reconfigure sysstat` on Debian and Ubuntu (answer Yes) or `sudo systemctl enable --now sysstat` on Fedora and RHEL, and check that `sysstat-collect.timer` is active. History starts from that moment.

### The System Does Not Boot

- **A wrong line in `/etc/fstab`** usually drops you into **emergency mode** with a root password prompt. Log in, run `mount -o remount,rw /`, fix the line (or add `nofail`), and reboot. Cloud servers without a console password need the provider's recovery console.
- **To get a minimal system** for repairs, hold **Shift** (BIOS) or press **Esc** (UEFI) at boot to reach the GRUB menu, press `e` on the entry, add `systemd.unit=rescue.target` (or `emergency.target`) to the line that starts with `linux`, and boot with **Ctrl+X**.
- **After a crash**, `journalctl -b -1 -p warning` shows what the previous boot logged before it went down, if the journal is persistent.
- `systemd-analyze blame` lists the services that took longest to start when the boot is just slow.

## A Checklist for a New Server

Run through this list on every fresh server, whether it is a VM at home or a cloud server (for example a DigitalOcean Droplet created through [this referral link](https://m.do.co/c/2a9bba940f39)).

1. Update everything: `sudo apt update && sudo apt full-upgrade` (or `sudo dnf upgrade`), then reboot if asked.
2. Create your own user with `sudo` and an SSH key; test it in a second session ([Part 6](/guides/introduction-to-linux/06-user-management)).
3. Harden SSH with a drop-in file and check it with `sshd -t` and `sshd -T`.
4. Enable the firewall with SSH allowed first ([Part 8](/guides/introduction-to-linux/08-networking)).
5. Turn on automatic security updates.
6. Set the time zone and check time sync: `timedatectl` (servers usually stay on UTC).
7. Run each service as its own user with a hardened unit file.
8. Set up backups, and restore one.
9. Make sure the journal is persistent and you know where each application logs.
10. Write down what you did, or better, put it in a script or an Ansible playbook so the next server is identical.

The exercise [Securing your Linux server: essential first steps](/exercises/linux-server-security) walks through the same list on a real machine.

## Common Mistakes

- **Editing packaged unit files or `sshd_config` directly** instead of drop-ins; updates overwrite or conflict with your changes.
- **Forgetting `systemctl daemon-reload`** after changing a unit file.
- **Enabling the service of a timer** instead of the timer itself.
- **cron jobs that rely on your `PATH`** or on output nobody reads.
- **Turning off password logins before testing keys**, or restarting SSH without a second session open.
- **Backups that were never restored**, or that live only on the same disk.
- **Disabling SELinux or AppArmor** to make an error go away.
- **Deleting big log files** that a process still holds open, instead of truncating or rotating them.

## Summary

- Write unit files with `User=`, `Restart=` and sandboxing options, verify them with `systemd-analyze verify`, and change packaged units with `systemctl edit`.
- Schedule jobs with systemd timers (`OnCalendar`, `Persistent`) or cron; check calendars with `systemd-analyze calendar`.
- Read logs with `journalctl -u`, `-p err -b` and `-f`; rotate application logs with logrotate.
- Automate security updates (unattended-upgrades, dnf-automatic) and plan reboots and release upgrades.
- Back up with archives or rsync snapshots following 3-2-1, and test restores.
- Harden SSH with a drop-in, mind the first-match rule, and check with `sshd -t` and `sshd -T`.
- Troubleshoot with `systemctl --failed`, `journalctl -p err -b`, `df`, `lsof +L1` and `vmstat`.

## Where to Go From Here

You now have the foundation that every other DevOps tool builds on. Good next steps:

- **Automate what you did by hand**: the [Bash guide](/guides/introduction-to-bash) and the [Ansible guide](/guides/introduction-to-ansible).
- **Containers**: the [Docker guide](/guides/introduction-to-docker) uses namespaces, cgroups and the networking from this guide, and the [Kubernetes guide](/guides/introduction-to-kubernetes) builds on Docker.
- **Networks**: the [Networking Fundamentals guide](/guides/networking-fundamentals) goes deeper into TCP/IP, DNS and routing.
- **Infrastructure as code**: the [Terraform guide](/guides/introduction-to-terraform) creates the servers you now know how to run.
- **Certifications**: the Linux Foundation's LFCS, Red Hat's RHCSA and CompTIA Linux+ test exactly these skills in hands-on or exam form.

## Keep Learning

- [SSH Hardening Checklist](/checklists/ssh-hardening)
- Exercise: [Securing your Linux server](/exercises/linux-server-security)
- Interview questions: [Linux system logs](/interview-questions/junior/linux-system-logs)
- [Linux Command Line Quiz](/quizzes/linux-quiz) and [Linux Fundamentals flashcards](/flashcards/linux-fundamentals)
- [Let's Encrypt 64-day certificates: check your renewal](/posts/lets-encrypt-64-day-certificates-renewal-check)
