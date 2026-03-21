---
title: 'How to Find Which Process Is Listening on a Port in Windows'
excerpt: "Need to know which application is using a specific TCP or UDP port on Windows? Here's how to check using netstat, tasklist, PowerShell, and Resource Monitor."
category:
  name: 'Networking'
  slug: 'networking'
date: '2024-08-12'
publishedAt: '2024-08-12T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Windows
  - Networking
  - Troubleshooting
  - Ports
  - DevOps
---

When you're debugging a network issue or troubleshooting a blocked service, it helps to know which process is listening on a given TCP or UDP port. In this guide, you'll use built-in Windows tools to find that out.

## Prerequisites

You'll need:

- A Windows machine (10, 11, or Server)
- Administrator access to run some commands

## Step 1: Check Listening Ports with netstat

The `netstat` command shows open connections and listening ports.

Run this from an elevated Command Prompt:

```bash
netstat -aon | findstr LISTENING
```

This lists all listening TCP ports along with their associated process IDs (PIDs).

Example output:

```
  TCP    0.0.0.0:80       0.0.0.0:0       LISTENING       1248
  TCP    [::]:443         [::]:0          LISTENING       1580
```

Look at the PID in the last column. This is the identifier for the process using that port.

## Step 2: Match the PID to a Process

Once you have the PID, use `tasklist` to find the associated application:

```bash
tasklist /FI "PID eq 1248"
```

This might return:

```
Image Name                     PID Session Name        Mem Usage
========================= ======== ================ ============
nginx.exe                     1248 Console             10,300 K
```

Now you know that `nginx.exe` is using port 80.

## Step 3: Use PowerShell to Combine the Two

If you prefer PowerShell, you can fetch both the port and process name together:

```powershell
Get-NetTCPConnection -State Listen | ForEach-Object {
  $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
  [PSCustomObject]@{
    LocalPort = $_.LocalPort
    PID       = $_.OwningProcess
    Process   = $proc.Name
  }
}
```

This outputs a list of listening ports along with their owning processes:

```
LocalPort PID  Process
--------- ---  -------
80        1248 nginx
443       1580 nginx
```

To filter by a specific port:

```powershell
Get-NetTCPConnection -LocalPort 3306
```

## Step 4, Use Resource Monitor (Optional GUI)

If you prefer using a graphical interface:

1. Press `Ctrl + Shift + Esc` to open Task Manager
2. Go to the **Performance** tab
3. Click **Open Resource Monitor** at the bottom
4. Switch to the **Network** tab and expand **Listening Ports**

This view shows which ports are open and which processes are using them.

---

That's it, now you can quickly find out what's occupying a port in Windows using either the terminal or the GUI. This comes in handy when diagnosing port conflicts or service issues.
