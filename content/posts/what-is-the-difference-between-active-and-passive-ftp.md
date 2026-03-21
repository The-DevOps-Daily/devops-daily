---
title: 'What is the Difference Between Active and Passive FTP?'
excerpt: 'Active and passive FTP differ in how the data connection is established. Learn how each mode works, when to use them, and how they interact with firewalls and NAT.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2025-04-10'
publishedAt: '2025-04-10T11:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Networking
  - FTP
  - Protocols
  - Firewall
  - File Transfer
---

FTP (File Transfer Protocol) uses two separate connections: one for commands (control connection) and one for data transfer (data connection). The difference between active and passive FTP lies in how the data connection is established. This seemingly small detail has major implications for firewalls, NAT, and network security.

Understanding active vs passive FTP helps you troubleshoot connection problems and configure FTP servers and firewalls correctly.

## TLDR

In active FTP, the server initiates the data connection back to the client. In passive FTP, the client initiates both connections to the server. Passive FTP works better with firewalls and NAT because the client (behind the firewall) makes all outbound connections. Use passive mode for clients behind firewalls or NAT, and active mode in controlled network environments.

## Prerequisites

Basic understanding of TCP connections and ports will help. Familiarity with firewalls and NAT concepts is useful when understanding why passive mode is often necessary.

## FTP Connection Basics

Every FTP session uses two TCP connections:

**Control connection (Command channel):**
- Port 21 on the server
- Carries FTP commands (USER, PASS, LIST, RETR, etc.)
- Stays open throughout the session

**Data connection (Data channel):**
- Transfers actual file content and directory listings
- Opened when needed, closed after transfer
- How this connection is established differs between active and passive modes

## Active FTP Mode

In active mode, the client initiates the control connection, but the server initiates the data connection.

### How Active FTP Works

Here's the step-by-step process:

```
1. Client connects to server port 21 (control connection)
   Client (port 52000) -> Server (port 21)

2. Client sends USER and PASS commands
   Client -> "USER alice" -> Server
   Client -> "PASS secret" -> Server

3. Client sends PORT command with its IP and port
   Client -> "PORT 192,168,1,100,203,144" -> Server
   (Tells server: "Connect back to 192.168.1.100:52112")

4. Server initiates data connection FROM port 20
   Server (port 20) -> Client (port 52112)

5. Data transfer happens
   Server -> File data -> Client

6. Server closes data connection
```

The PORT command format encodes the IP and port:
```
PORT 192,168,1,100,203,144
     └─────┬─────┘└───┬──┘
       IP Address   Port
                 (203×256 + 144 = 52112)
```

### Active FTP Diagram

```
Client                           Server
  |                                 |
  |----(1) Control: port 21-------->|
  |                                 |
  |----(2) PORT command------------>|
  |    (tells server which port     |
  |     to connect to)              |
  |                                 |
  |<---(3) Data: port 20------------|
  |                                 |
  |<---(4) File transfer------------|
```

The server actively reaches out to the client for the data connection.

### Why Active Mode Causes Firewall Problems

Firewalls block unsolicited inbound connections. When the FTP server tries to connect back to the client:

```
Client behind firewall:
1. Client connects to server ✓ (outbound, allowed)
2. Client sends PORT command ✓
3. Server tries to connect to client ✗ (inbound, BLOCKED)
4. Data connection fails
5. File transfer fails
```

The firewall sees the server's connection attempt as an attack, not a legitimate part of an FTP session.

## Passive FTP Mode

In passive mode, the client initiates both the control and data connections.

### How Passive FTP Works

Step-by-step process:

```
1. Client connects to server port 21 (control connection)
   Client (port 52000) -> Server (port 21)

2. Client sends USER and PASS commands
   Client -> "USER alice" -> Server
   Client -> "PASS secret" -> Server

3. Client sends PASV command
   Client -> "PASV" -> Server

4. Server responds with its IP and port
   Server -> "227 Entering Passive Mode (198,51,100,10,195,12)" -> Client
   (Tells client: "Connect to 198.51.100.10:49932")

5. Client initiates data connection
   Client (port 52113) -> Server (port 49932)

6. Data transfer happens
   Client <- File data <- Server

7. Connection closes
```

The server enters "passive" mode - it passively waits for the client to connect.

### Passive FTP Diagram

```
Client                           Server
  |                                 |
  |----(1) Control: port 21-------->|
  |                                 |
  |----(2) PASV command------------>|
  |                                 |
  |<---(3) Port number--------------|
  |    (server tells client which   |
  |     port to connect to)         |
  |                                 |
  |----(4) Data: port 49932-------->|
  |                                 |
  |<---(5) File transfer------------|
```

The client makes both connections, so firewalls don't block anything.

### Why Passive Mode Works Better

Client firewalls allow outbound connections:

```
Client behind firewall:
1. Client connects to server port 21 ✓ (outbound, allowed)
2. Client sends PASV command ✓
3. Server responds with port number ✓
4. Client connects to server data port ✓ (outbound, allowed)
5. Data transfer succeeds ✓
```

All connections originate from the client, so the firewall sees them as legitimate outbound traffic.

## Extended Passive Mode (EPSV)

IPv6 and modern FTP implementations use EPSV (Extended Passive Mode):

```
Client -> "EPSV" -> Server
Server -> "229 Entering Extended Passive Mode (|||49932|)" -> Client
```

EPSV simplifies the response format and works with both IPv4 and IPv6.

## Configuring FTP Clients

Most FTP clients default to passive mode or detect which mode works.

### Command-line FTP

```bash
# Enable passive mode
ftp> passive
Passive mode on.

# Or disable it
ftp> passive
Passive mode off.
```

### FileZilla

```
Edit -> Settings -> Connection -> FTP
Transfer mode: Passive (recommended)
```

### lftp

```bash
# Force passive mode
lftp -e "set ftp:passive-mode true" ftp.example.com

# Force active mode
lftp -e "set ftp:passive-mode false" ftp.example.com
```

### Python ftplib

```python
from ftplib import FTP

ftp = FTP('ftp.example.com')
ftp.login('username', 'password')

# Passive mode (default in Python)
ftp.set_pasv(True)

# Active mode
ftp.set_pasv(False)

ftp.retrlines('LIST')
ftp.quit()
```

## Configuring FTP Servers

### vsftpd (Linux)

```bash
# /etc/vsftpd.conf

# Enable passive mode
pasv_enable=YES

# Passive port range (for firewall rules)
pasv_min_port=40000
pasv_max_port=50000

# Server's public IP (important for NAT)
pasv_address=203.0.113.10
```

Restart the service:

```bash
sudo systemctl restart vsftpd
```

### ProFTPD

```apache
# /etc/proftpd/proftpd.conf

# Passive ports
PassivePorts 40000 50000

# Server's public IP
MasqueradeAddress 203.0.113.10
```

### FileZilla Server (Windows)

```
Settings -> Passive Mode Settings
  ✓ Use custom port range: 40000 - 50000
  Retrieve external IP address from: http://ip.example.com/
```

## Firewall Configuration

### Client-side Firewall (for Active FTP)

If you must use active FTP with a client behind a firewall, you need to allow inbound connections from the FTP server:

```bash
# iptables example
sudo iptables -A INPUT -p tcp --sport 20 -m state --state ESTABLISHED,RELATED -j ACCEPT

# ufw example
sudo ufw allow from 203.0.113.10 to any port 1024:65535 proto tcp
```

This is complex and error-prone. Passive mode is simpler.

### Server-side Firewall (for Passive FTP)

Allow the passive port range:

```bash
# iptables
sudo iptables -A INPUT -p tcp --dport 21 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 40000:50000 -j ACCEPT

# ufw
sudo ufw allow 21/tcp
sudo ufw allow 40000:50000/tcp

# firewalld
sudo firewall-cmd --permanent --add-port=21/tcp
sudo firewall-cmd --permanent --add-port=40000-50000/tcp
sudo firewall-cmd --reload
```

## NAT Complications

When the FTP server is behind NAT, passive mode requires special configuration.

### The Problem

```
Server behind NAT:
- Private IP: 192.168.1.100
- Public IP: 203.0.113.10

Server sends PASV response:
"227 Entering Passive Mode (192,168,1,100,195,12)"

Client tries to connect to 192.168.1.100
Client can't reach private IP ✗
```

### The Solution

Configure the server to advertise its public IP:

```bash
# vsftpd
pasv_address=203.0.113.10

# ProFTPD
MasqueradeAddress 203.0.113.10
```

Now the PASV response uses the public IP:
```
"227 Entering Passive Mode (203,0,113,10,195,12)"
```

Also configure NAT to forward the passive port range:

```bash
# Port forwarding rule
iptables -t nat -A PREROUTING -p tcp --dport 40000:50000 -j DNAT --to-destination 192.168.1.100
```

## When to Use Each Mode

### Use Passive Mode

- Client is behind a firewall (most common scenario)
- Client is behind NAT (home/office networks)
- You want maximum compatibility
- You're accessing public FTP servers

**This is the default and recommended mode for most situations.**

### Use Active Mode

- Both client and server are on the same trusted network
- Legacy systems that don't support passive mode
- Server is behind a firewall that makes passive mode complex
- You have full control over firewalls on both ends

## Troubleshooting FTP Connection Issues

### Can't retrieve directory listing

```
Error: Failed to retrieve directory listing
```

**Solution**: Switch to passive mode. This is usually a firewall blocking the data connection.

```bash
# In command-line FTP
ftp> passive
Passive mode on.
ftp> ls
```

### Server returns wrong IP in PASV response

```
Server: Entering Passive Mode (192,168,1,100,...)
Client: Cannot connect to 192.168.1.100
```

**Solution**: Configure the server's public IP address in its configuration:

```bash
# vsftpd.conf
pasv_address=YOUR_PUBLIC_IP
```

### Connection timeout on data transfer

```
Command: LIST
Response: 150 Opening data connection
Error: Connection timed out
```

**Solution**: Check firewall rules allow the passive port range:

```bash
# Verify ports are open
sudo nmap -p 40000-50000 your-server-ip
```

### Works locally but not remotely

The server might not be configured for external connections:

```bash
# vsftpd.conf
# Make sure this is commented out or removed
# listen_address=127.0.0.1

# Or explicitly set to all interfaces
listen_address=0.0.0.0
```

## Modern Alternatives to FTP

While FTP is still widely used, consider these alternatives:

**SFTP (SSH File Transfer Protocol):**
- Encrypted
- Uses single port (22)
- Firewall-friendly
- Recommended for sensitive data

**FTPS (FTP over SSL/TLS):**
- Encrypted FTP
- More complex than SFTP
- Still uses multiple ports

**HTTP/HTTPS:**
- Simple uploads/downloads
- Firewall-friendly
- Easy to implement

The difference between active and passive FTP comes down to who initiates the data connection. Passive mode, where the client initiates both connections, works better with modern firewalls and NAT setups. While active mode is simpler conceptually, passive mode solves real-world connectivity problems, making it the standard choice for FTP clients and servers today.
