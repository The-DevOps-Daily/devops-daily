---
title: 'How to Fix SSH "Could Not Resolve Hostname" Error'
excerpt: "Troubleshoot and fix the SSH 'nodename nor servname provided, or not known' error with DNS checks, host file configuration, and SSH config debugging."
category:
  name: 'Networking'
  slug: 'networking'
date: '2025-01-18'
publishedAt: '2025-01-18T09:30:00Z'
updatedAt: '2025-01-18T09:30:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - SSH
  - Networking
  - DNS
  - Troubleshooting
  - Linux
  - macOS
---

**TLDR:** The "Could not resolve hostname" error means SSH can't translate the hostname into an IP address. Common causes include typos in the hostname, DNS server issues, incorrect SSH config entries, or network connectivity problems. Fix it by verifying the hostname, checking DNS resolution with `nslookup` or `dig`, reviewing your SSH config file, or using the IP address directly.

When you try to SSH into a server and see an error like this:

```
ssh: Could not resolve hostname example.server: nodename nor servname provided, or not known
```

Or on Linux:

```
ssh: Could not resolve hostname example.server: Name or service not known
```

SSH is telling you it can't figure out what IP address corresponds to the hostname you provided. This happens before SSH even attempts to connect - it's failing at the DNS lookup stage.

## Quick Diagnosis

Before diving into fixes, verify what's actually failing. Try to resolve the hostname manually:

```bash
# Test DNS resolution with nslookup
nslookup example.server

# Or use dig for more detailed output
dig example.server

# Or use host for a simpler output
host example.server
```

If these commands also fail with "not found" or similar errors, the problem is DNS resolution, not SSH specifically. If they work and return an IP address, the issue is with your SSH configuration.

## Common Causes and Fixes

### Typo in the Hostname

The simplest cause is a typo. Double-check the hostname you're using:

```bash
# Wrong - typo in hostname
ssh user@exampl.server

# Correct
ssh user@example.server
```

If you're copying hostnames from documentation or chat, watch for invisible characters or extra spaces:

```bash
# Check what you're actually typing
echo "example.server" | od -c
# Look for unexpected characters in the output
```

### SSH Config File Issues

If you're using an SSH config file (`~/.ssh/config`), the hostname might be defined there incorrectly:

```bash
# View your SSH config
cat ~/.ssh/config
```

A typical SSH config entry looks like this:

```
Host myserver
    HostName example.server.com
    User john
    Port 22
```

When you run `ssh myserver`, SSH looks up `myserver` in the config and uses `example.server.com` as the actual hostname. If there's a typo in `HostName`, you'll get the resolution error.

Common SSH config mistakes:

```
# Wrong - typo in HostName
Host prodserver
    HostName produciton.example.com  # typo: "produciton"
    User deploy

# Wrong - hostname doesn't exist
Host staging
    HostName staging.internal  # might not be resolvable from your network
    User deploy

# Correct
Host prodserver
    HostName production.example.com
    User deploy
```

To test if your config is the issue, try connecting with the full hostname directly:

```bash
# Bypass SSH config by using full hostname
ssh user@production.example.com

# If that works, the issue is in your SSH config
```

### DNS Server Issues

If your DNS server is down or unreachable, no hostnames will resolve:

```bash
# Check your DNS configuration (Linux)
cat /etc/resolv.conf

# You should see nameserver entries like:
# nameserver 8.8.8.8
# nameserver 1.1.1.1
```

On macOS, check DNS servers:

```bash
# View current DNS servers
scutil --dns | grep 'nameserver\['

# Or for a simpler view
networksetup -getdnsservers Wi-Fi
```

If you see "There aren't any DNS Servers set", that's your problem. Set DNS servers manually:

```bash
# macOS - set DNS servers for Wi-Fi
sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 1.1.1.1

# Linux - edit /etc/resolv.conf (changes might not persist)
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```

For a persistent fix on Linux systems using `systemd-resolved`:

```bash
# Edit the resolved configuration
sudo nano /etc/systemd/resolved.conf

# Uncomment and set DNS servers:
# [Resolve]
# DNS=8.8.8.8 1.1.1.1

# Restart the service
sudo systemctl restart systemd-resolved
```

### Hosts File Override

Sometimes you want to bypass DNS entirely and map a hostname to an IP address directly using the hosts file:

```bash
# Edit hosts file (Linux/macOS)
sudo nano /etc/hosts

# Add your mapping:
# 192.168.1.100  myserver.local
# 10.0.0.50      production.internal

# Windows: Edit C:\Windows\System32\drivers\etc\hosts
```

The hosts file is checked before DNS, so entries here take precedence. This is useful for development or when DNS isn't configured for internal hostnames:

```
# Development setup
127.0.0.1       localhost
192.168.1.100   devserver.local
192.168.1.101   staging.local

# Production servers (when DNS isn't available)
10.50.1.10      db-primary.internal
10.50.1.11      db-replica.internal
```

After editing the hosts file, the hostname should resolve immediately:

```bash
# Test the resolution
ping myserver.local

# Now SSH should work
ssh user@myserver.local
```

### Using IP Addresses Directly

If DNS is problematic and you know the IP address, skip hostname resolution entirely:

```bash
# Connect directly with IP
ssh user@192.168.1.100

# You can still use SSH config with IP addresses
# In ~/.ssh/config:
Host prodserver
    HostName 192.168.1.100
    User deploy
```

This works but you lose the benefit of DNS - if the server's IP changes, you'll need to update everywhere you've hardcoded it.

### Network-Specific Hostnames

Some hostnames only resolve on specific networks. For example, `.local` domains typically require mDNS (multicast DNS), and internal company domains might only resolve on the corporate VPN:

```bash
# This might only work on your local network
ssh user@raspberrypi.local

# This might only work when connected to VPN
ssh user@jenkins.internal.company.com
```

If you're getting resolution errors for internal hostnames:

1. Check if you're connected to the right network or VPN
2. Verify the domain suffix is correct (`.local`, `.internal`, `.corp`, etc.)
3. Try the fully qualified domain name (FQDN) if you've been using a short name

```bash
# Short name might not work
ssh webserver

# FQDN might resolve correctly
ssh webserver.internal.company.com
```

### Search Domain Configuration

Your system can be configured to automatically append domain suffixes to short hostnames. Check your search domains:

```bash
# Linux - check resolv.conf
cat /etc/resolv.conf
# Look for lines like: search internal.company.com company.com

# macOS
scutil --dns | grep 'search domain'
```

If search domains are configured, `ssh webserver` automatically tries `webserver.internal.company.com`. If these are misconfigured, short names won't resolve.

## Debugging with SSH Verbose Mode

When you're not sure where the resolution is failing, run SSH in verbose mode:

```bash
# Use -v for verbose output (or -vv for more detail)
ssh -v user@example.server

# Look for lines like:
# debug1: Connecting to example.server [IP] port 22.
# Or:
# ssh: Could not resolve hostname example.server: nodename nor servname provided, or not known
```

The verbose output shows you exactly what hostname SSH is trying to resolve and whether it's reading from your SSH config.

## Testing Name Resolution

Here's a systematic way to test name resolution:

```bash
#!/bin/bash
# test-resolution.sh - Diagnose hostname resolution

HOSTNAME=$1

if [ -z "$HOSTNAME" ]; then
    echo "Usage: $0 <hostname>"
    exit 1
fi

echo "Testing resolution for: $HOSTNAME"
echo "=================================="

# Test with different tools
echo -e "\n1. Testing with ping:"
ping -c 1 "$HOSTNAME" 2>&1 | head -2

echo -e "\n2. Testing with nslookup:"
nslookup "$HOSTNAME"

echo -e "\n3. Testing with dig:"
dig "$HOSTNAME" +short

echo -e "\n4. Checking /etc/hosts:"
grep -i "$HOSTNAME" /etc/hosts

echo -e "\n5. Current DNS servers:"
cat /etc/resolv.conf | grep nameserver
```

Run this script to see exactly where resolution succeeds or fails:

```bash
chmod +x test-resolution.sh
./test-resolution.sh myserver.example.com
```

## Special Cases

### Wildcard DNS

Some networks use wildcard DNS where `*.example.com` points to the same IP. If you're expecting this but it's not working:

```bash
# Test if wildcard is configured
dig random-name.example.com
dig another-random.example.com

# Both should return the same IP if wildcard DNS is active
```

### IPv6 vs IPv4

Sometimes a hostname has both IPv4 (A record) and IPv6 (AAAA record) addresses. If IPv6 resolution fails but IPv4 works:

```bash
# Force IPv4
ssh -4 user@example.server

# Force IPv6
ssh -6 user@example.server

# Check what records exist
dig example.server A      # IPv4
dig example.server AAAA   # IPv6
```

The most reliable fix for "Could not resolve hostname" is to verify the hostname is correct, test DNS resolution independently, and use IP addresses or the hosts file as a fallback. Most issues stem from typos, DNS misconfigurations, or trying to reach internal hostnames from the wrong network.
