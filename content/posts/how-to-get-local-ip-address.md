---
title: 'How to Get Your Local IP Address'
excerpt: 'Learn multiple methods to find your local IP address using command line tools, programming languages, and system utilities across different operating systems.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2024-09-01'
publishedAt: '2024-09-01T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Networking
  - IP Address
  - Command Line
  - DevOps
  - System Administration
  - Cross-Platform
---

Finding your local IP address is a common task when setting up network services, configuring firewalls, or debugging connectivity issues. Your local IP address is the private address assigned to your device within your local network, different from your public IP that the internet sees.

There are several ways to retrieve this information depending on your operating system and preferred tools. Let's explore the most reliable methods across different platforms and programming languages.

## Understanding Local vs Public IP Addresses

Before diving into the methods, it's important to understand the difference between local and public IP addresses. Your local IP address (like 192.168.1.100 or 10.0.0.5) is used for communication within your local network. Your router assigns these addresses using DHCP or they can be set statically.

Your public IP address is what external servers see when you make requests to the internet. This guide focuses on finding your local IP address, which is what you'll need for most development and networking tasks.

## Command Line Methods

### macOS and Linux

The most straightforward way to get your local IP address on Unix-like systems is using the `ifconfig` command:

```bash
# Get all network interface information
ifconfig

# Filter to show only IP addresses
ifconfig | grep "inet " | grep -v 127.0.0.1
```

This command shows all network interfaces and their assigned IP addresses, excluding the loopback address (127.0.0.1). You'll typically see your active connection listed under interfaces like `en0` (Ethernet) or `wlan0` (WiFi).

For a more modern approach, use the `ip` command (available on most Linux distributions):

```bash
# Show all IP addresses
ip addr show

# Get just the IP addresses in a clean format
ip route get 1 | awk '{print $7}' | head -1
```

The second command is particularly useful because it shows the IP address that would be used to reach external networks, which is typically your main local IP.

### Windows

On Windows systems, use the `ipconfig` command:

```cmd
# Show all network configuration
ipconfig

# Show detailed information including DNS settings
ipconfig /all
```

For a PowerShell approach that gives you more control:

```powershell
# Get network adapter information
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"}

# Simple one-liner to get the main IP
(Get-NetRoute -DestinationPrefix "0.0.0.0/0").NextHop
```

This PowerShell method filters out loopback addresses and shows only IPv4 addresses from active network adapters.

## Cross-Platform Solutions

### Using hostname Command

The `hostname` command with the `-I` flag works on most Unix-like systems:

```bash
# Get all IP addresses assigned to the host
hostname -I

# Get just the first IP address
hostname -I | awk '{print $1}'
```

This is particularly useful in scripts because it's concise and works consistently across different Linux distributions.

### Using netstat

The `netstat` command can help identify your local IP by showing active connections:

```bash
# Show routing table to identify default gateway
netstat -rn | grep default

# On some systems, this works better
netstat -rn | grep "^0.0.0.0"
```

This shows your routing table, and your local IP will be listed as the source for the default route.

## Programming Language Solutions

### Python

Python offers several ways to get the local IP address. Here's a reliable method that works across platforms:

```python
import socket

def get_local_ip():
    """
    Get the local IP address by creating a socket connection.
    This method doesn't actually send data, just determines the route.
    """
    try:
        # Create a socket and connect to a remote address
        # We use Google's DNS server as it's always reachable
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        local_ip = sock.getsockname()[0]
        sock.close()
        return local_ip
    except Exception as e:
        return f"Error getting IP: {e}"

# Usage
ip_address = get_local_ip()
print(f"Your local IP address is: {ip_address}")
```

This method works by creating a socket connection to an external address and checking what local address the system would use for that connection. It's reliable because it doesn't depend on parsing command output.

For a more comprehensive approach that lists all network interfaces:

```python
import socket
import netifaces

def get_all_ip_addresses():
    """
    Get IP addresses from all network interfaces.
    Requires: pip install netifaces
    """
    ip_addresses = []

    for interface in netifaces.interfaces():
        addresses = netifaces.ifaddresses(interface)
        if netifaces.AF_INET in addresses:
            for address_info in addresses[netifaces.AF_INET]:
                ip = address_info['addr']
                if ip != '127.0.0.1':  # Skip loopback
                    ip_addresses.append((interface, ip))

    return ip_addresses

# Usage (after installing netifaces)
interfaces = get_all_ip_addresses()
for interface, ip in interfaces:
    print(f"Interface {interface}: {ip}")
```

### Node.js

JavaScript/Node.js provides built-in modules for network operations:

```javascript
const os = require('os');

function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();

  for (const interfaceName in interfaces) {
    const networkInterface = interfaces[interfaceName];

    for (const network of networkInterface) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (network.family === 'IPv4' && !network.internal) {
        return network.address;
      }
    }
  }

  return 'No external IPv4 address found';
}

// Usage
const localIP = getLocalIPAddress();
console.log(`Your local IP address is: ${localIP}`);
```

This function iterates through all network interfaces and returns the first non-internal IPv4 address it finds.

### Go

Go's net package provides clean methods for network operations:

```go
package main

import (
    "fmt"
    "net"
)

func getLocalIP() (string, error) {
    // Dial a connection to determine which local address would be used
    conn, err := net.Dial("udp", "8.8.8.8:80")
    if err != nil {
        return "", err
    }
    defer conn.Close()

    localAddr := conn.LocalAddr().(*net.UDPAddr)
    return localAddr.IP.String(), nil
}

func main() {
    ip, err := getLocalIP()
    if err != nil {
        fmt.Printf("Error getting local IP: %v\n", err)
        return
    }

    fmt.Printf("Your local IP address is: %s\n", ip)
}
```

This Go example uses the same principle as the Python version, creating a connection to determine the local address.

### Java

Java provides network utilities through the java.net package:

```java
import java.net.*;
import java.util.Enumeration;

public class LocalIPFinder {
    public static String getLocalIPAddress() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();

            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();

                if (networkInterface.isLoopback() || !networkInterface.isUp()) {
                    continue;
                }

                Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress address = addresses.nextElement();

                    if (address instanceof Inet4Address && !address.isLoopbackAddress()) {
                        return address.getHostAddress();
                    }
                }
            }
        } catch (SocketException e) {
            System.out.println("Error getting network interfaces: " + e.getMessage());
        }

        return "No IP address found";
    }

    public static void main(String[] args) {
        String localIP = getLocalIPAddress();
        System.out.println("Your local IP address is: " + localIP);
    }
}
```

This Java implementation iterates through network interfaces and finds the first non-loopback IPv4 address.

## Using curl for Quick Checks

Sometimes you need to quickly verify your local IP address from the command line. While curl typically shows your public IP, you can use it with local services:

```bash
# If you have a local web server running, this shows the IP it's bound to
curl -s http://localhost:8080/ip 2>/dev/null || echo "No local service available"

# Alternative: use a simple Python HTTP server to check
python3 -c "import socket; print(socket.gethostbyname(socket.gethostname()))"
```

The Python one-liner is particularly useful because it's cross-platform and doesn't require additional tools.

## Scripting for Automation

When you need to get the local IP in scripts, create reusable functions. Here's a robust shell script that works across different Unix-like systems:

```bash
#!/bin/bash

get_local_ip() {
    local ip=""

    # Try different methods in order of preference
    if command -v ip >/dev/null 2>&1; then
        # Modern Linux systems
        ip=$(ip route get 1 2>/dev/null | awk '{print $7}' | head -1)
    elif command -v ifconfig >/dev/null 2>&1; then
        # macOS and older Linux systems
        ip=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
    elif command -v hostname >/dev/null 2>&1; then
        # Fallback method
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi

    # Validate IP format
    if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$ip"
    else
        echo "Could not determine local IP address"
        return 1
    fi
}

# Usage
LOCAL_IP=$(get_local_ip)
echo "Local IP: $LOCAL_IP"
```

This script tries multiple methods and validates the result, making it reliable across different environments.

## Troubleshooting Common Issues

When you have multiple network interfaces (like both Ethernet and WiFi connected), you might see multiple IP addresses. In this case, the active connection is usually the one with the default route, which you can identify using the routing table.

If you're getting unexpected results, check that your network interfaces are up and properly configured. Sometimes VPN connections or virtual machine networks can add additional interfaces that might confuse automatic detection.
