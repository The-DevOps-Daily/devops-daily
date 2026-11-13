---
title: 'How to Get the Current Date, Time and Epoch Seconds in Linux and Bash'
excerpt: 'Print and format the current date and time with date, get Unix epoch seconds and milliseconds, convert between dates and timestamps, measure how long a command takes, and turn your favorite format into a custom command.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2025-03-28'
publishedAt: '2025-03-28T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Bash
  - date
  - Unix Time
  - Command Line
  - Shell Aliases
---

You need the current date and time in a log line, a timestamp in a backup name, or the Unix time for an API call or a time difference. One command does all of it: `date`. Bash also has builtins that give the same values without starting a process, which matters inside loops.

This post shows how to format the date, how to work with **epoch seconds** (seconds since 1970-01-01 00:00:00 UTC), and how to save the formats you use as short commands.

## TLDR

| Task                             | Command                                                   |
| -------------------------------- | --------------------------------------------------------- |
| Date and time in your own format | `date +"%Y-%m-%d %H:%M:%S"`                               |
| Today as YYYY-MM-DD              | `date +%F`                                                |
| ISO 8601 with time zone          | `date -Iseconds` (GNU)                                    |
| Seconds since the epoch          | `date +%s`, or `$EPOCHSECONDS` in Bash 5                  |
| Milliseconds since the epoch     | `date +%s%3N` (GNU)                                       |
| Date to epoch seconds            | `date -d "2026-01-15 14:30" +%s` (GNU)                    |
| Epoch seconds to a date          | `date -d @1704067200` (GNU), `date -r 1704067200` (macOS) |
| A short custom command           | `alias now='date +"%F %T"'` in `~/.bashrc`                |

## Prerequisites

- A Linux terminal. The `date -d`, `-I` and `%N` examples use GNU `date` from coreutils, which most Linux distributions ship. BusyBox `date` (Alpine) supports only part of them. macOS has BSD `date`; the differences are noted.
- Bash 4.2 or later for `printf '%(...)T'`, and Bash 5 for `$EPOCHSECONDS`.

## How Do I Get the Current Date and Time in Linux?

Run `date`:

```bash
date
# Fri Nov 13 09:30:12 UTC 2026
```

To choose the format, pass a format string that starts with `+`. The `%` codes are the same as in C `strftime`:

```bash
date +"%Y-%m-%d %H:%M:%S"        # 2026-11-13 09:30:12
date +"%Y-%m-%d_%H-%M-%S"        # 2026-11-13_09-30-12, safe in file names
date +"%A, %B %d, %Y %I:%M %p"   # Friday, November 13, 2026 09:30 AM
date -u +"%Y-%m-%dT%H:%M:%SZ"    # 2026-11-13T09:30:12Z, UTC
date -Iseconds                   # 2026-11-13T09:30:12+00:00 (GNU)
```

| Code | Meaning                  | Code | Meaning                      |
| ---- | ------------------------ | ---- | ---------------------------- |
| `%Y` | Year (2026)              | `%H` | Hour, 00-23                  |
| `%m` | Month, 01-12             | `%I` | Hour, 01-12                  |
| `%d` | Day of the month, 01-31  | `%M` | Minute, 00-59                |
| `%F` | Same as `%Y-%m-%d`       | `%S` | Second, 00-60                |
| `%T` | Same as `%H:%M:%S`       | `%p` | AM or PM                     |
| `%A` | Weekday name (Friday)    | `%Z` | Time zone abbreviation (UTC) |
| `%B` | Month name (November)    | `%z` | Offset from UTC (+0000)      |
| `%j` | Day of the year, 001-366 | `%s` | Seconds since the epoch      |

To show the time in another time zone, set `TZ` for the one command. The names come from the tz database in `/usr/share/zoneinfo`:

```bash
TZ=UTC date
TZ=America/New_York date +"%F %T %Z"
TZ=Asia/Tokyo date +"%F %T %Z"
```

Use UTC (`date -u`) for timestamps in logs and file names. They sort correctly and do not jump when daylight saving time starts or ends. A timestamp in a file name then looks like this:

```bash
cp app.conf "app.conf.$(date -u +%Y%m%dT%H%M%SZ).bak"
tar -czf "backup-$(date +%F).tar.gz" /etc/myapp
```

## Format the Date as YYYY-MM-DD in a Script

`date +%F` is short for `date +%Y-%m-%d`, and `date -I` prints the same. In Bash, the `printf` builtin formats the time without starting a `date` process, which adds up in a loop:

```terminal
{
  "title": "three ways to get YYYY-MM-DD",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "date +%F",
      "output": "2026-11-05"
    },
    {
      "cmd": "date -Iseconds",
      "output": "2026-11-05T16:25:52+00:00"
    },
    {
      "cmd": "printf -v today '%(%F)T' -1; echo \"$today\"",
      "output": "2026-11-05"
    },
    {
      "cmd": "sh -c 'printf \"%(%F)T\\n\" -1'",
      "output": "sh: 1: printf: %(: invalid directive"
    }
  ]
}
```

`-1` means "now". `%(...)T` needs Bash 4.2 or later, so it fails in `sh` (dash here). `date -I` and `date -d` are GNU options; on macOS, use `date +%F` and `date -v-1d +%F` for yesterday.

GNU `date -d` also does date arithmetic. Watch the month steps: "one month after 31 January" is 31 February, which `date` rolls over into March. For the last day of a month, start from the first:

```terminal
{
  "title": "relative dates with GNU date",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "date -d \"yesterday\" +%F",
      "output": "2026-11-04"
    },
    {
      "cmd": "date -d \"2026-11-05 -7 days\" +%F",
      "output": "2026-10-29"
    },
    {
      "cmd": "date -d \"2026-01-31 +1 month\" +%F",
      "output": "2026-03-03"
    },
    {
      "comment": "last day of this month",
      "cmd": "date -d \"$(date +%Y-%m-01) +1 month -1 day\" +%F",
      "output": "2026-11-30"
    },
    {
      "cmd": "date -d \"2026-13-01\" +%F",
      "output": "date: invalid date ‘2026-13-01’"
    }
  ]
}
```

The last command fails with exit code 1, so `date -d "$input" +%F >/dev/null` is a quick way to check that a string is a valid date.

## How Do I Get the Current Time in Seconds Since the Epoch in Bash?

Use `date +%s`. It prints the number of seconds since 1970-01-01 00:00:00 UTC:

```bash
date +%s
# 1794562212
```

Bash 5 has the same value in variables, so you do not need to start `date`:

```bash
echo "$EPOCHSECONDS"            # 1794562212
echo "$EPOCHREALTIME"           # 1794562212.564326, with microseconds
printf '%(%s)T\n' -1            # Bash 4.2+: -1 means "now"
```

The epoch value is the same in every time zone, so `TZ=Asia/Tokyo date +%s` prints the same number as `date +%s`. Only the conversion to a readable date depends on the time zone.

### Get Milliseconds or Nanoseconds

GNU `date` prints fractions of a second with `%N` (nanoseconds). `%3N` keeps the first three digits:

```bash
date +%s%3N      # milliseconds, 13 digits: 1794562212564
date +%s%6N      # microseconds
date +%s%N       # nanoseconds
```

BSD `date` on macOS does not support `%N`. In Bash 5, take the digits of `$EPOCHREALTIME` instead. It has six decimal places, so the digits are microseconds:

```bash
ms=$(( ${EPOCHREALTIME//[!0-9]/} / 1000 ))
```

`${EPOCHREALTIME//[!0-9]/}` removes the decimal separator, which is a comma instead of a dot in some locales.

### Convert Between Dates and Epoch Seconds

GNU `date -d` reads a date string, and `@` marks an epoch value:

```bash
date -d "2026-01-15 14:30:00" +%s           # local time to epoch
date -u -d "2026-01-15 14:30:00" +%s        # the same time read as UTC
date -d "3 days ago" +%s                    # relative dates work too
date -u -d @1704067200 +"%F %T"             # 2024-01-01 00:00:00
TZ=America/New_York date -d "today 00:00" +%s   # midnight in New York
```

On macOS, use `date -r 1704067200` for epoch to date, and `date -j -f "%Y-%m-%d %H:%M:%S" "2026-01-15 14:30:00" +%s` for a date to epoch.

To get the modification time of a file as epoch seconds, use `stat -c %Y file` on Linux (`stat -f %m file` on macOS), or let `date` read it: `date -r file +%s`.

### Measure How Long Something Takes

For whole seconds, use the `SECONDS` variable. It holds the number of seconds since the shell started, or since you last assigned a value to it:

```bash
SECONDS=0
./run-backup.sh
echo "backup took ${SECONDS}s"
```

For more precision, subtract two `$EPOCHREALTIME` values. Bash arithmetic has no decimals, so let `awk` do the subtraction:

```bash
start=$EPOCHREALTIME
curl -s -o /dev/null https://example.com
end=$EPOCHREALTIME
awk -v s="$start" -v e="$end" 'BEGIN { printf "request took %.3f s\n", e - s }'
```

This assumes the decimal separator is a dot. To time one command interactively, `time curl -s -o /dev/null https://example.com` prints real, user and system time.

To wait for a fraction of a second between steps, see [how to sleep for milliseconds in Bash](/posts/sleep-for-milliseconds).

### Epoch Time Limits

- A signed 32-bit counter ends at 2147483647, which is 2038-01-19 03:14:07 UTC (the **year 2038 problem**). 64-bit Linux uses a 64-bit time value. Old 32-bit systems and file formats that store 32-bit timestamps still have the limit.
- Unix time ignores leap seconds: every day has exactly 86400 seconds.

## How Do I Turn a Date Format Into a Custom Command?

Add an alias to `~/.bashrc`, then reload the file:

```bash
# in ~/.bashrc
alias now='date +"%Y-%m-%d %H:%M:%S"'
alias today='date +%F'
alias stamp='date -u +%Y%m%dT%H%M%SZ'
alias epoch='date +%s'
```

```bash
source ~/.bashrc
now        # 2026-11-13 09:30:12
```

An alias cannot take arguments in the middle of the command, so use a function when the format needs input:

```bash
timein() {
    if [[ -z ${1-} ]]; then
        echo "Usage: timein ZONE, for example timein Europe/Berlin" >&2
        return 1
    fi
    TZ="$1" date +"%F %T %Z"
}

backup() {
    local stamp
    stamp=$(date +%Y%m%d_%H%M%S)
    cp -- "$1" "$1.$stamp.bak" && echo "created $1.$stamp.bak"
}
```

The `backup` function computes the time once. If it called `date` twice, once for `cp` and once for the message, the two values could differ by a second.

For aliases for all users, add them to `/etc/bash.bashrc` on Debian and Ubuntu, or to a `.sh` file in `/etc/profile.d/` on Fedora and RHEL, whose `/etc/bashrc` reads that directory for every interactive shell. On Debian and Ubuntu, `/etc/profile.d/` is read only by login shells, and aliases are not passed on to the shells they start, so most terminal windows would not have them. [How to reload .bashrc and write aliases that take parameters](/posts/permanently-set-path-on-linux-unix#h2-how-do-i-reload-bashrc-without-logging-out) has more about startup files.

## Related Resources

- [Introduction to Bash: Bash Tools](/guides/introduction-to-bash/09-bash-tools): `date`, `printf` and other tools for scripts
- [Cron expression simulator](/games/cron-expression-simulator): build the schedule for a job that writes timestamped backups
- [How to sleep for milliseconds in Bash](/posts/sleep-for-milliseconds)
- [What does 2>&1 mean?](/posts/what-does-2-and-1-mean-linux-bash): add timestamps and error output to a log file
