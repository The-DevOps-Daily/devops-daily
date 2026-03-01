---
title: 'How to Close TCP and UDP Ports via Windows Command Line'
excerpt: 'Learn how to close open ports on Windows using command-line tools. Find and terminate processes listening on ports, manage Windows Firewall rules, and stop services to free up ports.'
category:
  name: 'Windows'
  slug: 'windows'
date: '2025-03-28'
publishedAt: '2025-03-28T13:00:00Z'
updatedAt: '2025-03-28T13:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Windows
  - Networking
  - Command Line
  - Firewall
  - Troubleshooting
---

When a port is in use on Windows, you might need to close it to free it for another application, resolve conflicts, or improve security. Unlike Linux where you can directly kill processes bound to ports, Windows requires identifying the process first, then either stopping it or blocking the port via firewall rules.

This guide shows you how to find what's using a port and close it using Windows command-line tools.

## TLDR

Find the process using a port with `netstat -ano | findstr :PORT`, then kill it with `taskkill /PID <pid> /F`. To block a port with Windows Firewall, use `netsh advfirewall firewall add rule` to create a blocking rule. For services, use `net stop` or `sc stop` to stop the service listening on the port.

## Prerequisites

You need administrative privileges (Run as Administrator) for most port-closing operations. Basic familiarity with Windows Command Prompt or PowerShell helps.

## Finding What's Using a Port

Before closing a port, identify which process is using it.

### Using netstat

```cmd
netstat -ano | findstr :8080
```

Output:

```
TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       4532
TCP    [::]:8080              [::]:0                 LISTENING       4532
```

The last column (`4532`) is the Process ID (PID).

### Using PowerShell

```powershell
Get-NetTCPConnection -LocalPort 8080
```

Output shows more detail:

```
LocalAddress  LocalPort RemoteAddress RemotePort State       OwningProcess
------------  --------- ------------- ---------- -----       -------------
0.0.0.0       8080      0.0.0.0       0          Listen      4532
```

### Identify the Process Name

Once you have the PID, find which program it is:

```cmd
tasklist | findstr 4532
```

Output:

```
node.exe                      4532 Console                    1     45,234 K
```

Or get more details with PowerShell:

```powershell
Get-Process -Id 4532
```

## Killing the Process

Once you know the PID, terminate the process to free the port.

### Using taskkill

```cmd
taskkill /PID 4532 /F
```

The `/F` flag forces termination.

Or kill by process name:

```cmd
taskkill /IM node.exe /F
```

This kills all instances of `node.exe`.

### Using PowerShell

```powershell
Stop-Process -Id 4532 -Force
```

Or by name:

```powershell
Stop-Process -Name "node" -Force
```

### Verify Port is Closed

```cmd
netstat -ano | findstr :8080
```

No output means the port is now free.

## Stopping Windows Services

If a Windows Service is using the port, stop the service rather than killing the process.

### Find the Service

```cmd
sc query | findstr /C:"SERVICE_NAME"
```

Or use PowerShell to find services by PID:

```powershell
Get-WmiObject Win32_Service | Where-Object {$_.ProcessId -eq 4532} | Select Name, DisplayName
```

### Stop the Service

```cmd
net stop "Service Name"
```

Or using sc:

```cmd
sc stop ServiceName
```

PowerShell alternative:

```powershell
Stop-Service -Name "ServiceName"
```

### Common Services and Ports

```cmd
# Stop IIS (uses port 80/443)
iisreset /stop

# Stop SQL Server (port 1433)
net stop MSSQLSERVER

# Stop Remote Desktop (port 3389)
net stop TermService
```

## Blocking Ports with Windows Firewall

Instead of killing processes, block ports using firewall rules.

### Block Inbound Traffic on a Port

```cmd
netsh advfirewall firewall add rule name="Block Port 8080" dir=in action=block protocol=TCP localport=8080
```

This prevents any inbound connections to port 8080.

### Block Outbound Traffic

```cmd
netsh advfirewall firewall add rule name="Block Outbound 8080" dir=out action=block protocol=TCP localport=8080
```

### Block UDP Port

```cmd
netsh advfirewall firewall add rule name="Block UDP 53" dir=in action=block protocol=UDP localport=53
```

### Remove Firewall Rule

```cmd
netsh advfirewall firewall delete rule name="Block Port 8080"
```

### List All Firewall Rules

```cmd
netsh advfirewall firewall show rule name=all
```

Or filter for specific port:

```cmd
netsh advfirewall firewall show rule name=all | findstr 8080
```

## PowerShell Firewall Management

### Block a Port

```powershell
New-NetFirewallRule -DisplayName "Block Port 8080" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Block
```

### Remove Rule

```powershell
Remove-NetFirewallRule -DisplayName "Block Port 8080"
```

### List Rules

```powershell
Get-NetFirewallRule | Where-Object {$_.LocalPort -eq 8080}
```

## Closing Specific Application Ports

### Stop Web Servers

IIS (Internet Information Services):

```cmd
# Stop IIS
iisreset /stop

# Or stop specific site
%windir%\system32\inetsrv\appcmd stop site "Default Web Site"
```

Apache:

```cmd
# Stop Apache service
net stop Apache2.4

# Or if running from command line
httpd -k stop
```

### Stop Database Servers

SQL Server:

```cmd
net stop MSSQLSERVER
```

MySQL:

```cmd
net stop MySQL80
```

PostgreSQL:

```cmd
net stop postgresql-x64-13
```

### Stop Development Servers

Node.js applications:

```cmd
# Find all node processes
tasklist | findstr node.exe

# Kill them
taskkill /IM node.exe /F
```

Python Flask/Django:

```cmd
tasklist | findstr python.exe
taskkill /IM python.exe /F
```

## Handling "Access Denied" Errors

If you get "Access Denied" when trying to kill a process:

1. **Run as Administrator**: Right-click Command Prompt or PowerShell and select "Run as administrator"

2. **Check if it's a system process**: Some processes are protected. Use Process Explorer to see if it's a critical system process.

3. **Stop the parent service**: If the process is started by a service, stop the service instead.

## Preventing Processes from Restarting

Some processes automatically restart. To prevent this:

### Disable the Service

```cmd
sc config ServiceName start= disabled
net stop ServiceName
```

### Change Application Startup

For applications that start automatically:

1. Open Task Manager (Ctrl+Shift+Esc)
2. Go to Startup tab
3. Disable the application

Or via command line:

```powershell
Get-CimInstance -ClassName Win32_StartupCommand | Select-Object Name, Location, Command
```

## Troubleshooting Common Issues

### Port Still Shows as Listening

After killing a process, the port might remain in TIME_WAIT:

```cmd
netstat -ano | findstr :8080
```

Output:

```
TCP    127.0.0.1:8080    127.0.0.1:54321    TIME_WAIT       0
```

TIME_WAIT connections clear automatically within 30-120 seconds. To force it:

```powershell
# Restart TCP/IP stack (requires admin)
netsh int ip reset
```

Then restart your computer.

### Multiple Processes on Same Port

If multiple processes share a port:

```cmd
netstat -ano | findstr :80
```

Kill each PID:

```cmd
taskkill /PID 1234 /F
taskkill /PID 5678 /F
```

### Cannot Find Process

If netstat shows a port in use but you can't find the process:

```cmd
# Show all processes including system
netstat -anob
```

The `-b` flag shows the executable name (requires admin).

## Automating Port Cleanup

### PowerShell Script to Kill Process on Port

```powershell
# kill-port.ps1
param([int]$Port)

$process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($process) {
    Stop-Process -Id $process -Force
    Write-Host "Killed process $process using port $Port"
} else {
    Write-Host "No process found using port $Port"
}
```

Usage:

```powershell
.\kill-port.ps1 -Port 8080
```

### Batch Script

```cmd
@echo off
REM kill-port.bat
SET PORT=%1

FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :%PORT%') DO (
    taskkill /PID %%P /F
)
```

Usage:

```cmd
kill-port.bat 8080
```

## Security Considerations

**Don't kill critical system processes**: Processes like `svchost.exe`, `System`, or `csrss.exe` are critical. Killing them can crash Windows.

**Check what you're stopping**: Before killing a process, verify it's safe to terminate.

**Use firewall rules for security**: If you want to prevent access to a port, use firewall rules rather than constantly killing processes.

**Monitor for malware**: If unknown processes are binding to ports, scan for malware.

Closing ports on Windows involves finding the process using the port and either terminating it, stopping its service, or blocking the port via firewall rules. Use `netstat` or PowerShell to identify the process, `taskkill` or `Stop-Process` to terminate it, and `netsh` or `New-NetFirewallRule` to block ports. Always verify you're not stopping critical system processes before proceeding.
