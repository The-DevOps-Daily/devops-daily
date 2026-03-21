---
title: 'How to Connect to Network Shares with Username and Password'
excerpt: "Learn how to mount SMB/CIFS network shares with credentials on Linux, macOS, and Windows, including persistent mounts and secure credential storage."
category:
  name: 'Networking'
  slug: 'networking'
date: '2025-04-15'
publishedAt: '2025-04-15T10:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Networking
  - SMB
  - CIFS
  - Windows
  - Linux
  - macOS
  - File Sharing
---

**TLDR:** On Linux, use `mount -t cifs //server/share /mnt/point -o username=user,password=pass` or store credentials in a file with `credentials=/path/to/creds`. On macOS, use Finder's "Connect to Server" with `smb://server/share` or the `mount_smbfs` command. On Windows, use `net use Z: \\server\share /user:username password`. For security, always use credential files instead of passing passwords on the command line.

Connecting to network shares (SMB/CIFS) with authentication is a common task when accessing file servers, NAS devices, or Windows shares from different operating systems. Here's how to authenticate and mount these shares properly.

## Connecting from Linux

Linux uses the CIFS (Common Internet File System) utilities to mount Windows/Samba shares. First, make sure you have the necessary package installed:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install cifs-utils

# RHEL/CentOS/Fedora
sudo dnf install cifs-utils

# Arch Linux
sudo pacman -S cifs-utils
```

### Basic Mount with Credentials

The simplest way to mount a share is to provide credentials directly:

```bash
# Create a mount point
sudo mkdir -p /mnt/shared

# Mount the share with username and password
sudo mount -t cifs //server.example.com/shared /mnt/shared \
    -o username=john,password=secretpass

# Or for Windows domain users
sudo mount -t cifs //server.example.com/shared /mnt/shared \
    -o username=DOMAIN\\john,password=secretpass
```

This works but has a security problem: your password appears in the process list and command history. Anyone with access to the system can see it with `ps aux` or by checking `.bash_history`.

### Using a Credentials File (Recommended)

A better approach is to store credentials in a file:

```bash
# Create a credentials file
sudo nano /etc/samba/credentials

# Add your credentials:
username=john
password=secretpass
domain=WORKGROUP

# For domain users:
# domain=COMPANYDOMAIN

# Secure the file so only root can read it
sudo chmod 600 /etc/samba/credentials
```

Now mount using the credentials file:

```bash
sudo mount -t cifs //server.example.com/shared /mnt/shared \
    -o credentials=/etc/samba/credentials
```

Your password never appears in logs or process listings.

### Additional Mount Options

You'll often need additional options for permissions and compatibility:

```bash
sudo mount -t cifs //server.example.com/shared /mnt/shared \
    -o credentials=/etc/samba/credentials,uid=1000,gid=1000,file_mode=0755,dir_mode=0755

# Options explained:
# uid=1000          - Files appear owned by user ID 1000
# gid=1000          - Files appear owned by group ID 1000
# file_mode=0755    - Permission mode for files
# dir_mode=0755     - Permission mode for directories
# iocharset=utf8    - Character encoding (useful for non-ASCII filenames)
# vers=3.0          - Force SMB version 3.0 (use if having issues)
```

To find your UID and GID:

```bash
id
# Output: uid=1000(john) gid=1000(john) groups=1000(john),...
```

### Persistent Mounts with /etc/fstab

To mount the share automatically at boot, add an entry to `/etc/fstab`:

```bash
sudo nano /etc/fstab

# Add this line:
//server.example.com/shared  /mnt/shared  cifs  credentials=/etc/samba/credentials,uid=1000,gid=1000,_netdev  0  0
```

The `_netdev` option tells the system to wait for network connectivity before mounting:

```
//server.example.com/shared              # Share location
/mnt/shared                               # Local mount point
cifs                                      # Filesystem type
credentials=/etc/samba/credentials        # Where to find username/password
uid=1000,gid=1000                        # Owner permissions
_netdev                                   # Wait for network
0                                         # No dump
0                                         # No fsck
```

Test the fstab entry without rebooting:

```bash
# Unmount if currently mounted
sudo umount /mnt/shared

# Mount using fstab entry
sudo mount -a

# Verify it worked
df -h | grep shared
```

### Troubleshooting Linux Mounts

If mounting fails, check these common issues:

```bash
# Check if the server is reachable
ping server.example.com

# Try SMB version 1.0 (older servers)
sudo mount -t cifs //server.example.com/shared /mnt/shared \
    -o credentials=/etc/samba/credentials,vers=1.0

# Enable verbose output to see what's failing
sudo mount -t cifs //server.example.com/shared /mnt/shared \
    -o credentials=/etc/samba/credentials -v

# Check kernel messages for errors
dmesg | tail -20

# View mount logs
sudo journalctl -xe | grep -i cifs
```

## Connecting from macOS

macOS has built-in SMB support and can connect through the GUI or command line.

### Using Finder

1. Open Finder
2. Press `Cmd+K` or go to `Go` → `Connect to Server`
3. Enter the server address: `smb://server.example.com/shared`
4. Click Connect
5. Enter username and password when prompted
6. Optionally check "Remember this password in my keychain"

The share appears in Finder under Locations and mounts at `/Volumes/shared`.

### Using Command Line

For scripting or automation, use `mount_smbfs`:

```bash
# Create mount point
mkdir ~/mounts/shared

# Mount with credentials
mount_smbfs //username:password@server.example.com/shared ~/mounts/shared

# Or prompt for password interactively
mount_smbfs //username@server.example.com/shared ~/mounts/shared
# Password: [enter password]
```

For domain users:

```bash
# Format: domain;username
mount_smbfs //DOMAIN;john:password@server.example.com/shared ~/mounts/shared
```

### Persistent Mounts on macOS

macOS doesn't use `/etc/fstab` for SMB shares. Instead, create a launch agent or use login items:

```bash
# Create a mount script
nano ~/bin/mount-shares.sh
```

Add this content:

```bash
#!/bin/bash
# mount-shares.sh - Mount network shares

# Wait for network
while ! ping -c 1 server.example.com &> /dev/null; do
    sleep 1
done

# Mount the share
mount_smbfs //username:password@server.example.com/shared ~/mounts/shared
```

Make it executable:

```bash
chmod +x ~/bin/mount-shares.sh
```

Add it to login items through System Preferences → Users & Groups → Login Items, or create a launch agent.

## Connecting from Windows

Windows has native SMB support and multiple ways to connect to shares.

### Using File Explorer

1. Open File Explorer
2. Right-click "This PC" → "Map network drive"
3. Choose a drive letter (e.g., Z:)
4. Enter the share path: `\\server.example.com\shared`
5. Check "Connect using different credentials" if needed
6. Click Finish
7. Enter username and password
8. Check "Remember my credentials" for persistent access

### Using Command Line

The `net use` command maps network drives:

```cmd
REM Map to drive Z: with credentials
net use Z: \\server.example.com\shared /user:username password

REM For domain users
net use Z: \\server.example.com\shared /user:DOMAIN\username password

REM Prompt for password interactively
net use Z: \\server.example.com\shared /user:username *

REM Make the mapping persistent across reboots
net use Z: \\server.example.com\shared /user:username password /persistent:yes
```

To disconnect:

```cmd
REM Disconnect the mapped drive
net use Z: /delete

REM Disconnect all mapped drives
net use * /delete
```

### Using PowerShell

PowerShell offers more control:

```powershell
# Create credential object (prompts for password)
$credential = Get-Credential -UserName "username"

# Map the drive
New-PSDrive -Name "Z" -PSProvider FileSystem `
    -Root "\\server.example.com\shared" `
    -Credential $credential -Persist

# Or with hardcoded password (not recommended for production)
$password = ConvertTo-SecureString "secretpass" -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential("username", $password)

New-PSDrive -Name "Z" -PSProvider FileSystem `
    -Root "\\server.example.com\shared" `
    -Credential $credential -Persist
```

View mapped drives:

```powershell
# List all mapped drives
Get-PSDrive -PSProvider FileSystem

# Show details of specific drive
Get-PSDrive Z
```

## Storing Credentials Securely

Never hardcode passwords in scripts that others can read. Here are better approaches:

### Linux: Credential Files with Restricted Permissions

```bash
# Store credentials in user's home directory
nano ~/.smbcredentials

# Content:
username=john
password=secretpass
domain=WORKGROUP

# Lock down permissions
chmod 600 ~/.smbcredentials

# Use in mount command
mount -t cifs //server/share /mnt/point -o credentials=/home/john/.smbcredentials
```

### macOS: Keychain Access

Store credentials in the system keychain:

```bash
# Add password to keychain
security add-generic-password -a username -s "//server/share" -w password

# Retrieve and use in script
PASSWORD=$(security find-generic-password -a username -s "//server/share" -w)
mount_smbfs //username:$PASSWORD@server/share ~/mounts/point
```

### Windows: Credential Manager

Use Windows Credential Manager for persistent storage:

```cmd
REM Add credentials to Windows Credential Manager
cmdkey /add:server.example.com /user:username /pass:password

REM Now map drive without specifying credentials
net use Z: \\server.example.com\shared

REM List stored credentials
cmdkey /list

REM Delete credentials
cmdkey /delete:server.example.com
```

Or via PowerShell:

```powershell
# Store credential in Windows Credential Manager
cmdkey /add:server.example.com /user:username /pass:password

# Map drive - will use stored credentials
New-PSDrive -Name "Z" -PSProvider FileSystem -Root "\\server.example.com\shared" -Persist
```

## Handling Special Characters in Passwords

Passwords with special characters can cause issues:

```bash
# Linux: Escape special characters in credential file
# If password is: P@ss!w0rd$123

# In credential file:
username=john
password=P@ss!w0rd$123

# No escaping needed in credential file
```

If passing password on command line (not recommended):

```bash
# Escape $ and other shell special characters
sudo mount -t cifs //server/share /mnt/point \
    -o username=john,password='P@ss!w0rd$123'

# Use single quotes to prevent shell interpretation
```

## Mounting NFS Shares (Linux/Unix Alternative)

For Linux-to-Linux or Unix shares, NFS is often simpler than SMB:

```bash
# Install NFS client
sudo apt-get install nfs-common  # Debian/Ubuntu
sudo dnf install nfs-utils        # RHEL/Fedora

# Mount NFS share (no credentials needed if properly configured)
sudo mount -t nfs server.example.com:/export/shared /mnt/shared

# In /etc/fstab:
server.example.com:/export/shared  /mnt/shared  nfs  defaults,_netdev  0  0
```

NFS relies on host-based authentication rather than username/password, making it more suitable for trusted networks.

The key to securely connecting to network shares is using credential files or credential managers instead of exposing passwords in command lines or scripts. Each platform provides tools to store credentials securely while allowing automated mounting.
