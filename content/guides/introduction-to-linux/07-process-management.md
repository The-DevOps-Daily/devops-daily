---
title: 'Linux Process Management: ps, top, kill, systemd and cgroups'
description: 'See what runs on Linux with ps and top, stop processes with signals, change priorities, read load and memory, and manage services with systemd.'
order: 7
---

Every program that runs on Linux is a **process**: your shell, the web server, the SSH daemon, the `ls` you just typed. When a server is slow, a port is taken, or memory runs out, the answer is in the process list. This part shows how to find processes, read what they are doing, stop them cleanly, change their priority, and manage long-running services with systemd.

## Prerequisites

- The command line basics from [Part 3](/guides/introduction-to-linux/03-command-line-interface) and users from [Part 6](/guides/introduction-to-linux/06-user-management).
- Python 3, which Ubuntu, Debian and Fedora install by default. It runs a tiny web server as the example process.
- A fresh `~/lab` from [Part 3](/guides/introduction-to-linux/03-command-line-interface#h2-set-up-the-practice-directory).

The output comes from Ubuntu 24.04.5 LTS, run inside a small lab container. A container has its own process list, so it shows only a handful of processes with low process IDs (PIDs); a real server lists hundreds. The `systemctl` output comes from a Debian 12 machine and says so.

## What a Process Is

Each process has:

- a **PID** (process ID) and a **PPID**, the PID of the parent that started it;
- an owner (the user whose permissions it has);
- a state: running, sleeping, stopped, or zombie;
- its own memory, open files, environment variables and current directory.

New processes are created by existing ones, so all processes form a tree. At the root is PID 1: on almost every distribution that is **systemd**, which starts services at boot and adopts orphaned processes. On a typical Ubuntu server, a branch of `pstree` looks like this (example output):

```text
systemd─┬─cron
        ├─sshd───sshd───sshd───bash───python3
        ├─systemd-journal
        ├─systemd-logind
        └─systemd-resolve
```

Inside a container, PID 1 is usually the application itself or a small init program, not systemd.

## See What Is Running

Start a process to look at: a small web server that serves `~/lab/site` in the background. `&` puts it in the background and gives you the prompt back; `$!` holds its PID.

```terminal
{
  "title": "start a background process and find it",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/lab"
    },
    {
      "cmd": "python3 -m http.server 8080 --bind 127.0.0.1 --directory site > logs/server.log 2>&1 &"
    },
    {
      "cmd": "SERVER_PID=$!; echo $SERVER_PID",
      "output": "11"
    },
    {
      "comment": "-o chooses the columns",
      "cmd": "ps -o pid,ppid,user,etime,cmd -p $SERVER_PID",
      "output": "    PID    PPID USER         ELAPSED CMD\n     11       2 dev            00:00 python3 -m http.server 8080 --bind 127.0.0.1 --directory site"
    },
    {
      "comment": "pgrep finds PIDs by name; -a shows the full command line",
      "cmd": "pgrep -a python3",
      "output": "11 python3 -m http.server 8080 --bind 127.0.0.1 --directory site"
    },
    {
      "comment": "the processes started from this shell, as a tree",
      "cmd": "pstree -p $$",
      "output": "bash(2)-+-pstree(19)\n        `-python3(11)"
    }
  ]
}
```

The two classic ways to list everything:

- **`ps aux`** (BSD style): every process with `USER`, `PID`, `%CPU`, `%MEM`, `VSZ` (virtual memory), `RSS` (memory actually in RAM, in KiB), `TTY`, `STAT`, `START`, `TIME` (CPU time used) and `COMMAND`.
- **`ps -ef`** (System V style): `UID`, `PID`, `PPID`, `C`, `STIME`, `TTY`, `TIME` and `CMD`. Use it when you need the parent PID.

Add `--sort=-%cpu` or `--sort=-%mem` to sort, and `--forest` (with `-ef`) to draw the tree. To find a process by name, prefer `pgrep -a name` over `ps aux | grep name`, which also finds the `grep` itself.

The **STAT** column shows the state:

| Code | State                 | Meaning                                                                                                                               |
| ---- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `R`  | Running               | On a CPU, or ready to run                                                                                                             |
| `S`  | Sleeping              | Waiting for something, such as network input; most processes are here                                                                 |
| `D`  | Uninterruptible sleep | Waiting for I/O, usually disk or NFS. Many `D` processes point to a storage problem, and they cannot be killed until the I/O finishes |
| `T`  | Stopped               | Paused, for example with Ctrl+Z                                                                                                       |
| `Z`  | Zombie                | Finished, but the parent has not collected its exit code yet                                                                          |

Extra letters: `s` session leader, `l` multi-threaded, `+` in the foreground, `<` high priority, `N` low priority.

## Look Inside a Process: /proc

Everything `ps` shows comes from `/proc/<PID>/`. You can read it directly:

```terminal
{
  "title": "what /proc knows about the web server",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "grep -E '^(Name|State|PPid|Uid|VmRSS|Threads)' /proc/$SERVER_PID/status",
      "output": "Name:\tpython3\nState:\tS (sleeping)\nPPid:\t2\nUid:\t1000\t1000\t1000\t1000\nVmRSS:\t   18860 kB\nThreads:\t1"
    },
    {
      "comment": "the command line, with NUL bytes between the arguments",
      "cmd": "tr '\\0' ' ' < /proc/$SERVER_PID/cmdline; echo",
      "output": "python3 -m http.server 8080 --bind 127.0.0.1 --directory site"
    },
    {
      "comment": "its current directory and open file descriptors",
      "cmd": "ls -l /proc/$SERVER_PID/cwd",
      "output": "lrwxrwxrwx 1 dev dev 0 Oct 23 21:28 /proc/11/cwd -> /home/dev/lab"
    },
    {
      "cmd": "ls -l /proc/$SERVER_PID/fd",
      "output": "total 0\nlr-x------ 1 dev dev 64 Oct 23 21:28 0 -> /dev/null\nl-wx------ 1 dev dev 64 Oct 23 21:28 1 -> /home/dev/lab/logs/server.log\nl-wx------ 1 dev dev 64 Oct 23 21:28 2 -> /home/dev/lab/logs/server.log\nlrwx------ 1 dev dev 64 Oct 23 21:28 3 -> socket:[5185631]"
    }
  ]
}
```

File descriptors 0, 1 and 2 are standard input, output and error: input comes from `/dev/null` and both outputs go to `server.log`, as the redirection asked. Descriptor 3 is the listening network socket.

## Which Process Uses a Port or a File

`ss` lists sockets and `lsof` lists open files. Both answer "who is using this?":

```terminal
{
  "title": "who listens on port 8080?",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ss -ltnp",
      "output": "State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess\nLISTEN 0      5          127.0.0.1:8080      0.0.0.0:*    users:((\"python3\",pid=11,fd=3))"
    },
    {
      "cmd": "curl -sI http://127.0.0.1:8080/ | head -n 1",
      "output": "HTTP/1.0 200 OK"
    },
    {
      "cmd": "lsof -i :8080",
      "output": "COMMAND PID USER   FD   TYPE  DEVICE SIZE/OFF NODE NAME\npython3  11  dev    3u  IPv4 5185631      0t0  TCP localhost:http-alt (LISTEN)"
    }
  ]
}
```

`ss -ltnp` means: **l**istening sockets, **t**CP, **n**umeric addresses and ports, with the **p**rocess. You see processes of other users only with `sudo`. The usual "Address already in use" error when a service starts means another process already holds the port, and these commands tell you which one. See [how to kill a process running on a port](/posts/kill-process-running-on-port-linux).

## Signals: Stopping and Reloading Processes

You control a running process by sending it a **signal**. The most important ones:

| Signal                | Number  | Default effect              | Used for                                                                   |
| --------------------- | ------- | --------------------------- | -------------------------------------------------------------------------- |
| `SIGTERM`             | 15      | Terminate                   | Polite stop request. The process can clean up first. The default of `kill` |
| `SIGINT`              | 2       | Terminate                   | What **Ctrl+C** sends                                                      |
| `SIGHUP`              | 1       | Terminate                   | Many daemons (nginx, sshd) reload their configuration on it instead        |
| `SIGKILL`             | 9       | Terminate, cannot be caught | Last resort: no cleanup, files may be left half-written                    |
| `SIGSTOP` / `SIGCONT` | 19 / 18 | Pause / resume              | What job control uses (**Ctrl+Z** sends the similar `SIGTSTP`)             |

```terminal
{
  "title": "send signals",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "kill -0 sends nothing; it only checks that the process exists and you may signal it",
      "cmd": "kill -0 $SERVER_PID && echo \"still running\"",
      "output": "still running"
    },
    {
      "comment": "ask it to stop (SIGTERM)",
      "cmd": "kill $SERVER_PID"
    },
    {
      "cmd": "sleep 1; ps -p $SERVER_PID || echo \"gone\"",
      "output": "    PID TTY          TIME CMD\ngone"
    },
    {
      "comment": "by name: pkill and pgrep take the same patterns",
      "cmd": "sleep 600 & sleep 700 &"
    },
    {
      "cmd": "pgrep -a sleep",
      "output": "31 sleep 600\n32 sleep 700"
    },
    {
      "cmd": "pkill -x sleep; sleep 0.5; pgrep -a sleep || echo \"no sleep processes left\"",
      "output": "no sleep processes left"
    }
  ]
}
```

Always try `SIGTERM` first and give the process a few seconds. Use `kill -9` only when it does not react. A process in state `D` ignores even `SIGKILL` until its I/O returns, and a zombie is already dead: to get rid of zombies, fix or restart the **parent**, which must collect them.

`pkill pattern` matches against process names; `pkill -f pattern` matches the whole command line, which is powerful and easy to get wrong. Check what will match with `pgrep -a` (or `pgrep -af`) first. `killall name` (from `psmisc`) kills by exact name.

## Foreground, Background and Jobs

In an interactive shell:

- **Ctrl+C** stops the foreground command.
- **Ctrl+Z** pauses it. `bg` lets it continue in the background, `fg` brings it back.
- `command &` starts it in the background directly. `jobs -l` lists the background jobs of this shell with their PIDs, and `kill %1` signals job number 1.

```terminal
{
  "title": "background jobs",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sleep 300 &"
    },
    {
      "cmd": "jobs -l",
      "output": "[1]+    37 Running                 sleep 300 &"
    },
    {
      "cmd": "kill %1"
    },
    {
      "cmd": "sleep 0.2; jobs -l"
    }
  ]
}
```

Background jobs belong to your shell session. When you close the terminal or the SSH connection drops, the shell sends them `SIGHUP` and they usually die. For work that must keep running:

- **`tmux`** or **`screen`**: a terminal session that survives disconnects. Run long jobs (upgrades, data migrations) inside one, and reattach with `tmux attach`.
- **`nohup command &`**: ignores `SIGHUP`; output goes to `nohup.out`.
- **A systemd service** (below and in Part 10): the right home for anything that should run permanently, restart on failure and start at boot.

## Priorities: nice and renice

The **nice** value tells the scheduler how generously to treat a process: from -20 (highest priority) to 19 (lowest), with 0 as the default. Regular users can only make their processes nicer (lower priority); only root can raise the priority.

```terminal
{
  "title": "run a job with a lower priority (example output)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "nice -n 10 sleep 300 &"
    },
    {
      "cmd": "JOB=$!; ps -o pid,ni,cmd -p $JOB",
      "output": "    PID  NI CMD\n   4127  10 sleep 300"
    },
    {
      "cmd": "renice -n 15 -p $JOB",
      "output": "4127 (process ID) old priority 10, new priority 15"
    },
    {
      "comment": "going back up needs root",
      "cmd": "renice -n 0 -p $JOB",
      "output": "renice: failed to set priority for 4127 (process ID): Permission denied"
    },
    {
      "cmd": "kill $JOB"
    }
  ]
}
```

Use `nice -n 19` for backups, compression and other batch jobs on a busy server. For disk-heavy jobs, `ionice -c 3 command` gives the process disk time only when nobody else needs it.

## CPU, Load and Memory

### Load Average

```terminal
{
  "title": "load and CPU count",
  "prompt": "$",
  "steps": [
    {
      "cmd": "uptime",
      "output": " 20:26:22 up 16 days, 10:31,  2 users,  load average: 0.50, 1.10, 1.40"
    },
    {
      "cmd": "nproc",
      "output": "4"
    }
  ]
}
```

The three **load averages** are the average number of processes that were running or waiting to run (including `D` processes waiting for disk) over the last 1, 5 and 15 minutes. As a rule of thumb, compare them with the number of CPUs from `nproc`: on this 4-CPU machine, a sustained load of 4 from CPU-bound work keeps every CPU busy, and 8 means processes are queuing. Because processes waiting for disk count too, check the CPU usage in `top` before you blame the CPUs. A rising 1-minute value with a low 15-minute value means the load just started.

### Find and Calm a CPU Hog

`yes` prints `y` forever, which makes it a perfect runaway process:

```terminal
{
  "title": "find the process that eats the CPU",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "yes > /dev/null &"
    },
    {
      "cmd": "HOG=$!; sleep 3"
    },
    {
      "comment": "sort by CPU usage, highest first",
      "cmd": "ps -o pid,%cpu,etime,cmd --sort=-%cpu -p $HOG",
      "output": "    PID %CPU     ELAPSED CMD\n     39 99.0       00:03 yes"
    },
    {
      "comment": "give it the lowest priority while you investigate, then stop it",
      "cmd": "renice -n 19 -p $HOG > /dev/null; kill $HOG"
    }
  ]
}
```

`top` shows the same thing live. On a server, `top -b -n 1 -o %CPU | head -n 8` prints the summary and the busiest process (example output):

```text
top - 09:14:02 up 16 days,  3:05,  1 user,  load average: 1.12, 0.61, 0.38
Tasks: 187 total,   2 running, 185 sleeping,   0 stopped,   0 zombie
%Cpu(s): 25.4 us,  0.8 sy,  0.0 ni, 73.6 id,  0.0 wa,  0.0 hi,  0.2 si,  0.0 st
MiB Mem :   3796.8 total,   1767.6 free,   1026.5 used,   1080.1 buff/cache
MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   2770.3 avail Mem

    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
   4131 dev       20   0    2700   1500   1396 R 100.0   0.0   0:03.18 yes
```

In the header, the load averages repeat `uptime`, and on the `%Cpu(s)` line `us` is time spent in user programs, `sy` in the kernel, `wa` waiting for disk, and `st` (steal) time a virtual machine waited for the hypervisor. A high `wa` points to storage, not CPU. Inside interactive `top`, press `P` to sort by CPU, `M` by memory, `1` to show each CPU, `k` to kill a process and `q` to quit. `htop` and `btop` are friendlier alternatives in the package repositories.

### Memory

```terminal
{
  "title": "memory at a glance",
  "prompt": "$",
  "steps": [
    {
      "cmd": "free -h",
      "output": "               total        used        free      shared  buff/cache   available\nMem:           3.7Gi       1.1Gi       1.3Gi       9.0Mi       1.4Gi       2.6Gi\nSwap:          2.0Gi       1.5Gi       496Mi"
    }
  ]
}
```

Do not read the `free` column as "memory left". Linux uses idle RAM as a disk cache (`buff/cache`) and gives it back as soon as programs need it. The number that matters is **available**: how much memory programs can get without the system starting to swap. Per process, look at `RSS` in `ps` or `RES` in `top`.

When memory runs out completely, the kernel's **OOM killer** ends the process it judges most expendable, often the biggest one. You find the evidence in the kernel log:

```bash
journalctl -k | grep -i -E 'out of memory|oom-kill'
```

On kernels with **pressure stall information** (PSI), `/proc/pressure/cpu`, `/proc/pressure/memory` and `/proc/pressure/io` show how much of the time processes were stalled waiting for each resource, which is a clearer warning sign than raw usage. For example, `some avg10=12.50` in `/proc/pressure/memory` means at least one process waited for memory 12.5% of the last 10 seconds. Part 10 covers `vmstat` and the `sysstat` tools (`iostat`, `pidstat`, `sar`) for longer investigations.

## Services With systemd

Long-running programs (web servers, databases, agents) run as **services** managed by systemd. systemd starts them at boot in the right order, restarts them when they crash, collects their output in the journal and limits their resources. You control them with `systemctl`. Output from a Debian 12 machine:

```terminal
{
  "title": "systemctl on a Debian 12 machine",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "systemctl status cron --no-pager --lines=0",
      "output": "● cron.service - Regular background program processing daemon\n     Loaded: loaded (/lib/systemd/system/cron.service; enabled; preset: enabled)\n     Active: active (running) since Wed 2026-10-07 09:53:43 UTC; 2 weeks 2 days ago\n       Docs: man:cron(8)\n   Main PID: 600 (cron)\n      Tasks: 1 (limit: 3914)\n        CPU: 32min 52.931s\n     CGroup: /system.slice/cron.service\n             └─600 /usr/sbin/cron -f"
    },
    {
      "cmd": "systemctl is-active cron; systemctl is-enabled cron",
      "output": "active\nenabled"
    },
    {
      "cmd": "systemctl list-units --type=service --state=failed --no-pager",
      "output": "  UNIT LOAD ACTIVE SUB DESCRIPTION\n0 loaded units listed."
    }
  ]
}
```

Read the status from the top: `Loaded` shows the unit file and whether the service starts at boot (`enabled`); `Active` shows whether it runs now and since when; `Main PID` and `CGroup` list its processes. On Ubuntu 24.04 and Debian 13, unit files that come with packages live in `/usr/lib/systemd/system/`; Debian 12 still uses `/lib/systemd/system/`, as above. Your own units go in `/etc/systemd/system/`.

The commands you will use most:

```bash
sudo systemctl start nginx         # start now
sudo systemctl stop nginx          # stop now
sudo systemctl restart nginx       # stop, then start
sudo systemctl reload nginx        # re-read the configuration without stopping (if supported)
sudo systemctl enable --now nginx  # start at boot, and start now
sudo systemctl disable nginx       # do not start at boot
systemctl status nginx             # state, recent log lines, processes
journalctl -u nginx -f             # follow the service's log
systemctl list-units --type=service --state=running
```

Part 10 writes a complete unit file for the lab web server and schedules jobs with timers.

## cgroups: Resource Limits for Groups of Processes

systemd puts every service in its own **control group** (cgroup), and the kernel accounts CPU, memory, I/O and process counts per cgroup. All current distributions use the unified **cgroup v2** hierarchy; systemd 258 and later no longer support the old v1 layout at all. Check yours:

```terminal
{
  "title": "cgroup v2 is mounted",
  "prompt": "$",
  "steps": [
    {
      "cmd": "stat -fc %T /sys/fs/cgroup",
      "output": "cgroup2fs"
    }
  ]
}
```

You set limits in the unit file, and systemd writes them to the cgroup:

```ini
[Service]
# hard memory limit; the OOM killer acts inside the service only
MemoryMax=512M
# at most half of one CPU
CPUQuota=50%
# at most 100 processes and threads, which stops fork bombs
TasksMax=100
# a smaller share of disk time than other services (default 100)
IOWeight=50
```

systemd only treats a line as a comment when `#` or `;` is its first character, so keep comments on their own lines: `MemoryMax=512M # limit` is an invalid value.

`systemd-cgtop` shows live usage per cgroup, and `systemd-cgls` the tree. Old tutorials use `MemoryLimit=` and write to paths such as `/sys/fs/cgroup/memory/`. Those come from cgroup v1: the paths do not exist on a cgroup v2 system, and `MemoryLimit=` is a deprecated name that newer systemd versions only translate for compatibility, so write `MemoryMax=`. To try a limit on a single command: `systemd-run --user --scope -p MemoryMax=200M -- ./big-job.sh`.

## Namespaces: How Containers Isolate Processes

cgroups limit what a group of processes may **use**. **Namespaces** limit what it can **see**: its own process list, network stack, mount table and hostname. Docker, Podman and Kubernetes combine both. You can try a PID namespace with `unshare`:

```terminal
{
  "title": "a process list of its own",
  "prompt": "$",
  "steps": [
    {
      "cmd": "unshare --user --map-root-user --pid --fork --mount-proc ps -ef",
      "output": "UID          PID    PPID  C STIME TTY          TIME CMD\nroot           1       0  0 21:28 ?        00:00:00 ps -ef"
    }
  ]
}
```

Inside the new namespace, `ps` is PID 1 and sees nothing else. On Ubuntu 23.10 and later, AppArmor blocks unprivileged user namespaces for most programs, so this command fails with `write failed /proc/self/uid_map: Operation not permitted`; run `sudo unshare --pid --fork --mount-proc ps -ef` there instead. The [Docker under the hood simulator](/games/docker-under-the-hood-simulator) walks through how a container runtime uses these features.

## Scheduled Jobs

Processes that should run at set times (backups, reports, cleanup) are started by **cron** or by **systemd timers**. [Part 10](/guides/introduction-to-linux/10-system-administration) covers both, with a timer for the backup script from Part 9.

## Common Mistakes

- **Reaching for `kill -9` first.** Send `SIGTERM`, wait, and only then `SIGKILL`.
- **Killing zombies.** They are already dead; restart or fix the parent process.
- **Reading `free` instead of `available`** and concluding the server is out of memory.
- **Comparing load average with 1** on a multi-core machine. Compare it with `nproc`.
- **Running long jobs in a plain SSH session.** Use `tmux`, or make it a service.
- **`pkill -f` with a short pattern** that also matches other users' processes or your own shell. Check with `pgrep -af` first.
- **Following cgroup v1 tutorials** (`MemoryLimit=`, `/sys/fs/cgroup/memory/...`); use `MemoryMax=` and the cgroup v2 files.

## Summary

- Processes have a PID, a parent, an owner and a state; PID 1 is systemd on most systems.
- `ps`, `pgrep -a`, `pstree`, `top` and `/proc/<PID>/` show what runs; `ss -ltnp` and `lsof` show who holds a port or a file.
- `kill` sends `SIGTERM` by default; `SIGKILL` is the last resort; `pkill` and `killall` work by name.
- `nice` and `renice` change CPU priority; only root can raise it.
- Load average is compared with the CPU count; for memory, read `available`.
- systemd manages services with `systemctl`, and cgroup v2 limits their resources.

Next: [Networking in Linux](/guides/introduction-to-linux/08-networking), where you configure interfaces, follow routes and troubleshoot connections.

## Keep Learning

- [Kill processes by partial name](/posts/kill-processes-by-partial-name)
- [Measure the actual memory usage of a process](/posts/measure-actual-memory-usage-of-process)
- Exercise: [Linux performance tuning and troubleshooting](/exercises/linux-performance-troubleshooting)
- Interview questions: [Linux process debugging](/interview-questions/senior/linux-process-debugging)
- See what happens when processes multiply: [fork bomb simulator](/games/fork-bomb-simulator)
