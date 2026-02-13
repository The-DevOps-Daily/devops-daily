---
title: 'Process Management'
description: 'Learn how to monitor, control, and optimize processes running on your Linux system.'
order: 7
---

Understanding how to manage processes is essential for effectively administering Linux systems. Whether you're troubleshooting high CPU usage, identifying memory leaks, or simply checking what's running on your system, process management skills are indispensable.

In this part, we'll explore how processes work in Linux and learn the commands to monitor, control, and optimize them.

## Understanding Linux Processes

### What is a Process?

A process is a running instance of a program. Each process has:

- A unique Process ID (PID)
- A parent process (PPID)
- Allocated memory and resources
- Process state (running, sleeping, stopped, etc.)
- Owner and permissions

### Process Lifecycle

1. **Creation**: When a program is executed, the kernel creates a new process
2. **Running**: The process uses CPU time to execute instructions
3. **Waiting**: The process may wait for resources or input
4. **Termination**: The process completes or is terminated

### Process Hierarchy

Linux processes form a tree structure:

- The `init` process (or `systemd` on modern systems) is the first process with PID 1
- All other processes are descendants of this initial process
- Each process (except PID 1) has a parent process

View the process tree with:

```bash
pstree
```

Or in a more detailed format:

```bash
ps f -e
```

## Basic Process Monitoring

### The ps Command

`ps` is the most basic command for viewing processes:

```bash
ps
```

This shows only processes in the current terminal. For more useful information, add options:

```bash
ps aux
```

The options mean:

- `a`: Show processes from all users
- `u`: Show detailed user-oriented format
- `x`: Include processes without a controlling terminal

Common columns in the output:

- `USER`: Owner of the process
- `PID`: Process ID
- `%CPU`: CPU usage
- `%MEM`: Memory usage
- `VSZ`: Virtual memory size
- `RSS`: Resident set size (physical memory)
- `TTY`: Terminal associated with the process
- `STAT`: Process state
- `START`: Start time
- `TIME`: CPU time used
- `COMMAND`: Command with arguments

Common process states:

- `R`: Running
- `S`: Sleeping (interruptible)
- `D`: Uninterruptible sleep
- `Z`: Zombie
- `T`: Stopped

List processes by a specific user:

```bash
ps -u username
```

Get detailed information about a specific process:

```bash
ps -fp PID
```

### The top Command

`top` provides a dynamic real-time view of processes:

```bash
top
```

Key information displayed:

- System summary (uptime, load averages, CPU usage, memory usage)
- Process list sorted by CPU usage by default

Useful `top` keyboard commands:

- `q`: Quit
- `h`: Show help
- `k`: Kill a process (enter PID when prompted)
- `r`: Renice a process (change priority)
- `f`: Select fields to display
- `o` or `O`: Change sort order
- `u`: Filter by user
- `M`: Sort by memory usage
- `P`: Sort by CPU usage
- `1`: Toggle individual CPU core stats

### The htop Command

`htop` is an improved version of `top` with a more user-friendly interface:

```bash
# Install if not available
sudo apt install htop    # Debian/Ubuntu
sudo dnf install htop    # Fedora/RHEL/CentOS

# Run htop
htop
```

Advantages of `htop`:

- Color-coded output
- Visual representation of CPU and memory usage
- Mouse support
- Horizontal and vertical scrolling
- More intuitive user interface
- Built-in ability to search, filter, and sort

Key `htop` keyboard commands:

- `F1-F10`: Functions shown at the bottom
- `F5`: Tree view
- `F6`: Sort by different columns
- `F9`: Kill process
- `/`: Search

### Process States and Information

Get a snapshot of current processes:

```bash
ps -eo pid,ppid,cmd,%cpu,%mem --sort=-%cpu | head
```

This shows the 10 most CPU-intensive processes.

For a process's complete environment:

```bash
cat /proc/PID/environ | tr '\0' '\n'
```

View open files for a process:

```bash
lsof -p PID
```

Check what's using a specific file:

```bash
lsof /path/to/file
```

View process limits:

```bash
cat /proc/PID/limits
```

## Process Control

### Sending Signals

Processes communicate using signals. Common signals include:

- `SIGTERM` (15): Graceful termination request
- `SIGKILL` (9): Forceful termination
- `SIGHUP` (1): Hang up, often used to reload configuration
- `SIGINT` (2): Interrupt (what Ctrl+C sends)
- `SIGSTOP` (19): Pause the process
- `SIGCONT` (18): Resume a paused process

Send signals with the `kill` command:

```bash
kill PID               # Send SIGTERM
kill -9 PID            # Send SIGKILL
kill -HUP PID          # Send SIGHUP
```

Send signals to processes by name with `pkill`:

```bash
pkill process_name     # Send SIGTERM
pkill -9 process_name  # Send SIGKILL
```

Send signals to all processes of a user:

```bash
pkill -u username
```

### Foreground and Background Processes

When running commands in a terminal:

- Foreground processes occupy the terminal until completion
- Background processes run without occupying the terminal

Run a command in the background by appending `&`:

```bash
command &
```

Send a running foreground process to the background:

1. Press `Ctrl+Z` to suspend the process
2. Run `bg` to continue it in the background

Bring a background process to the foreground:

```bash
fg %job_number
```

or simply:

```bash
fg
```

List background jobs:

```bash
jobs
```

### Process Priority with nice and renice

Linux uses a niceness value from -20 (highest priority) to 19 (lowest priority) to determine process scheduling priority.

Start a process with a specific niceness:

```bash
nice -n 10 command     # Start with lower priority
```

Change the niceness of a running process:

```bash
renice 10 -p PID       # Lower priority
```

Only root can set negative niceness values:

```bash
sudo nice -n -10 command     # Start with higher priority
sudo renice -10 -p PID       # Increase priority
```

### Resource Limits with ulimit

Limit the resources a process can use with `ulimit`:

```bash
# Show all limits
ulimit -a

# Set maximum file size (in KB)
ulimit -f 1000

# Set maximum number of open files
ulimit -n 2048
```

Set permanent limits in `/etc/security/limits.conf`.

## CPU Monitoring and Management

### View CPU Information

Get detailed CPU information:

```bash
lscpu
```

Or more detailed hardware info:

```bash
sudo dmidecode -t processor
```

Check CPU load averages:

```bash
uptime
```

The three numbers show the 1-minute, 5-minute, and 15-minute load averages. A load average close to the number of CPU cores indicates full utilization.

### CPU Performance Analysis

For detailed CPU usage analysis, use `mpstat`:

```bash
# Install if not available
sudo apt install sysstat    # Debian/Ubuntu
sudo dnf install sysstat    # Fedora/RHEL/CentOS

# Show CPU statistics
mpstat

# Show per-CPU statistics every 2 seconds
mpstat -P ALL 2
```

For process-specific CPU usage over time:

```bash
pidstat 2
```

### CPU Governor Control

Modern CPUs support frequency scaling. Control the CPU governor:

```bash
# Show current CPU frequency
cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_cur_freq

# Show available governors
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_available_governors

# Set performance governor (requires root)
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

## Memory Monitoring and Management

### View Memory Information

Get basic memory usage:

```bash
free -h
```

This shows:

- Total memory
- Used memory
- Free memory
- Shared memory
- Buffer/cache
- Available memory (free + reclaimable buffer/cache)

For more detailed memory information:

```bash
cat /proc/meminfo
```

### Memory Usage by Process

Find processes using the most memory:

```bash
ps -eo pid,ppid,cmd,%mem --sort=-%mem | head
```

For a specific process:

```bash
pmap PID
```

### Managing Swap

View swap information:

```bash
swapon --show
```

Create and enable a swap file:

```bash
# Create a 2GB swap file
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make it permanent by adding to /etc/fstab
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Adjust swap usage behavior:

```bash
# Show current swappiness (0-100, lower means less swap usage)
cat /proc/sys/vm/swappiness

# Set temporarily
sudo sysctl vm.swappiness=10

# Set permanently
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
```

## Disk I/O Monitoring

### Basic I/O Statistics

The `iostat` command provides disk I/O statistics:

```bash
# Install if not available (part of sysstat)
sudo apt install sysstat    # Debian/Ubuntu
sudo dnf install sysstat    # Fedora/RHEL/CentOS

# Show I/O statistics
iostat

# Show extended stats every 2 seconds
iostat -x 2
```

Key columns:

- `r/s`, `w/s`: Reads and writes per second
- `rkB/s`, `wkB/s`: Read and write kilobytes per second
- `await`: Average time for I/O requests (milliseconds)
- `%util`: Percentage of CPU time during which I/O requests were issued

### I/O by Process

Find which processes are doing I/O:

```bash
# Install if not available
sudo apt install iotop    # Debian/Ubuntu
sudo dnf install iotop    # Fedora/RHEL/CentOS

# Run iotop
sudo iotop
```

For a one-time display:

```bash
sudo iotop -b -n 1
```

Check I/O statistics for a specific process:

```bash
pidstat -d -p PID 1
```

### I/O Scheduling

Check the current I/O scheduler:

```bash
cat /sys/block/sda/queue/scheduler
```

Change the scheduler temporarily:

```bash
echo deadline | sudo tee /sys/block/sda/queue/scheduler
```

Options typically include:

- `cfq`: Completely Fair Queuing
- `deadline`: Deadline scheduler
- `noop`: No Operation scheduler
- `mq-deadline`: Multi-queue deadline scheduler

## Network Process Monitoring

### Viewing Network Connections

See which processes have network connections:

```bash
# Show all listening ports and their associated programs
sudo netstat -tulpn

# More modern alternative
sudo ss -tulpn
```

Key options:

- `t`: TCP connections
- `u`: UDP connections
- `l`: Listening sockets
- `p`: Show process using the socket
- `n`: Don't resolve hostnames or port names

### Monitoring Network Traffic by Process

Monitor network traffic by process:

```bash
# Install if not available
sudo apt install nethogs    # Debian/Ubuntu
sudo dnf install nethogs    # Fedora/RHEL/CentOS

# Monitor network traffic by process
sudo nethogs
```

For more comprehensive network monitoring:

```bash
# Install if not available
sudo apt install iftop    # Debian/Ubuntu
sudo dnf install iftop    # Fedora/RHEL/CentOS

# Monitor traffic on a specific interface
sudo iftop -i eth0
```

## Process Automation and Scheduling

### Running Processes at Scheduled Times with cron

The cron system runs commands at scheduled times.

Edit a user's crontab:

```bash
crontab -e
```

Crontab format:

```
# minute hour day_of_month month day_of_week command
0 2 * * * /path/to/backup.sh
```

This runs `backup.sh` at 2:00 AM every day.

Common crontab shortcuts:

- `@hourly`: Run once an hour
- `@daily`: Run once a day
- `@weekly`: Run once a week
- `@monthly`: Run once a month
- `@reboot`: Run at startup

View cron logs:

```bash
grep CRON /var/log/syslog
```

### Running Tasks Once with at

The `at` command schedules a one-time task:

```bash
# Install if not available
sudo apt install at    # Debian/Ubuntu
sudo dnf install at    # Fedora/RHEL/CentOS

# Schedule a task for 2 hours from now
at now + 2 hours
> /path/to/command
> Ctrl+D

# List scheduled tasks
atq

# Remove a task
atrm job_number
```

### Running Processes on a Schedule with systemd timers

Modern Linux systems use systemd timers as an alternative to cron:

```bash
# List active timers
systemctl list-timers

# Create a timer (example)
sudo nano /etc/systemd/system/backup.service
```

Content for the service file:

```
[Unit]
Description=Backup Service

[Service]
Type=oneshot
ExecStart=/path/to/backup.sh

[Install]
WantedBy=multi-user.target
```

Create the timer file:

```bash
sudo nano /etc/systemd/system/backup.timer
```

Content for the timer file:

```
[Unit]
Description=Run backup daily

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Activate the timer:

```bash
sudo systemctl enable --now backup.timer
```

## Advanced Process Management

### Process Control Groups (cgroups)

Control groups allow limiting, accounting, and isolating resource usage of process groups:

```bash
# Create a new cgroup (on systems with cgroupfs mounted)
sudo mkdir /sys/fs/cgroup/memory/mygroup

# Set memory limit (200MB)
echo 209715200 | sudo tee /sys/fs/cgroup/memory/mygroup/memory.limit_in_bytes

# Add a process to the cgroup
echo PID | sudo tee /sys/fs/cgroup/memory/mygroup/cgroup.procs
```

On systems using systemd, use systemd-run:

```bash
# Run a command with memory limit
sudo systemd-run --unit=myservice --property=MemoryLimit=200M /path/to/command
```

### Process Namespaces

Namespaces isolate processes from each other. This is the technology behind containers.

Run a process in a new namespace:

```bash
unshare --fork --pid --mount-proc /bin/bash
```

This gives the process its own PID namespace with its own process ID 1.

### Running Processes with Specific Resources

Use the `taskset` command to bind a process to specific CPU cores:

```bash
# Run on CPU 0
taskset -c 0 command

# Move running process to CPU 1
taskset -pc 1 PID
```

Use `cpulimit` to restrict CPU usage:

```bash
# Install if not available
sudo apt install cpulimit    # Debian/Ubuntu
sudo dnf install cpulimit    # Fedora/RHEL/CentOS

# Limit a process to 50% of one CPU core
cpulimit -p PID -l 50
```

## Practical Process Management Examples

### Finding and Fixing a CPU-Intensive Process

Suppose your system is slow and you need to identify the cause:

```bash
# Check load average
uptime

# Identify CPU-intensive processes
top -b -n 1 | head -n 20

# Examine a specific process
ps -fp PID

# Check if it's in an infinite loop or stuck
strace -p PID

# If needed, reduce its priority
sudo renice 19 -p PID

# Or terminate if necessary
sudo kill -15 PID
```

### Finding a Memory Leak

For a system with decreasing free memory:

```bash
# Check memory usage
free -h

# Find memory-intensive processes
ps -eo pid,ppid,cmd,%mem --sort=-%mem | head

# Examine detailed memory usage
sudo pmap -x PID | sort -k 3 -n | tail

# Check for memory growth over time
watch -n 10 'ps -o pid,vsz,rss,cmd -p PID'
```

### Troubleshooting High I/O Wait

If your system is slow due to high I/O:

```bash
# Check load average and I/O wait
top
# Look for high wa% in CPU stats

# Identify I/O-intensive processes
sudo iotop -o

# Check disk performance
iostat -x 1

# Find which files the process is accessing
sudo lsof -p PID | grep REG
```

### Setting Up a Resource-Limited Service

Create a service with resource limits:

```bash
sudo nano /etc/systemd/system/myapp.service
```

Service file content:

```
[Unit]
Description=My Application
After=network.target

[Service]
Type=simple
User=myappuser
WorkingDirectory=/opt/myapp
ExecStart=/opt/myapp/myapp
Restart=on-failure
# Resource limits
CPUQuota=25%
MemoryLimit=500M
IOWeight=500

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable --now myapp
```

## Process Management in the Cloud

When running Linux in cloud environments, efficient process management is crucial for controlling costs and ensuring performance.

### Cloud Process Management Example

For example, on a DigitalOcean Droplet (use [this link](https://www.jdoqocy.com/click-101674709-15836238) for $200 in credits):

1. Choose a Droplet size appropriate for your workload
2. Monitor resource usage to avoid over-provisioning

```bash
# Install monitoring tools
sudo apt update
sudo apt install htop iotop sysstat

# Set up daily resource usage summary
sudo nano /etc/cron.daily/resource-report
```

Script content:

```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d)
REPORT="/root/resource-reports/report-$DATE.txt"
mkdir -p /root/resource-reports/

echo "System Resource Report for $DATE" > $REPORT
echo "=================================" >> $REPORT

echo -e "\nUptime and Load Averages:" >> $REPORT
uptime >> $REPORT

echo -e "\nMemory Usage:" >> $REPORT
free -h >> $REPORT

echo -e "\nDisk Usage:" >> $REPORT
df -h >> $REPORT

echo -e "\nTop CPU Processes:" >> $REPORT
ps -eo pid,ppid,cmd,%cpu --sort=-%cpu | head -n 10 >> $REPORT

echo -e "\nTop Memory Processes:" >> $REPORT
ps -eo pid,ppid,cmd,%mem --sort=-%mem | head -n 10 >> $REPORT
```

Make the script executable:

```bash
sudo chmod +x /etc/cron.daily/resource-report
```

This script creates daily resource reports to help identify trends and optimize your cloud resource usage.

## Moving Forward

You now have a comprehensive understanding of Linux process management. These skills are essential for monitoring system health, troubleshooting performance issues, and optimizing resource usage.

In the next part, we'll explore networking in Linux, covering network configuration, troubleshooting, security, and more.

Process management is a core skill for any Linux user or administrator. Whether you're running a personal workstation, a server, or a container in the cloud, understanding how to monitor and control processes will help you maintain a healthy, efficient system.
