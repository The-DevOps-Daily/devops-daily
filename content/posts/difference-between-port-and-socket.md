---
title: 'What Is the Difference Between a Port and a Socket?'
excerpt: 'Ports and sockets are often mentioned together in networking, but they serve different roles. This guide breaks down what they are and how they work together.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2024-05-21'
publishedAt: '2024-05-21T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Networking
  - TCP
  - Sockets
  - Ports
  - DevOps
---

If you've spent any time dealing with networking in software development or DevOps, you've likely seen the terms **port** and **socket**. They're related, but they aren't the same thing.

Understanding the difference can help you debug connectivity issues, configure servers, and write networked applications more confidently.

## What Is a Port?

A **port** is a logical number assigned to a specific service or application on a machine. It helps the operating system route incoming and outgoing traffic to the correct process.

Think of your computer like a large office building, and ports are the numbered rooms inside it. Just like mail needs a room number to reach the right person, network traffic needs a port number to reach the correct application.

Ports are always associated with a protocol like TCP or UDP. For example:

- Port 22 (TCP): SSH
- Port 80 (TCP): HTTP
- Port 443 (TCP): HTTPS
- Port 3306 (TCP): MySQL

Ports range from 0 to 65535. Ports below 1024 are considered _privileged_ and usually require elevated permissions to bind to.

## What Is a Socket?

A **socket** is an endpoint for sending or receiving data across a network. It includes more than just the port, it's a combination of several pieces of information:

```
<protocol>, <local IP address>, <local port>, <remote IP address>, <remote port>
```

This 5-part combination is often referred to as a **socket tuple**.

For example, a socket might look like this:

```
TCP, 192.168.1.5, 51734, 93.184.216.34, 80
```

This describes a TCP connection from your local machine on port `51734` to a remote web server (`93.184.216.34`) on port `80`.

A socket represents an actual connection, while a port is just an address that can accept or initiate connections.

## How They Work Together

When your machine runs a server (like a web app on port 3000), it listens on a specific port. That port doesn't do anything on its own, it becomes useful when a socket is created, which involves:

- Choosing a local port (like 3000)
- Listening for connections from remote addresses
- Creating a socket for each new connection

On the client side, your browser creates a socket with a random local port, connects to the remote IP and port, and establishes a TCP socket.

Here's a simplified flow:

```text
Client creates socket → OS assigns random local port
→ Connects to server IP + server port (e.g. 443)
→ Server accepts and creates a socket for the session
→ Data is exchanged through both sockets
```

## Checking Sockets and Ports in Action

On macOS or Linux, you can see active sockets with:

```bash
netstat -an | grep ESTABLISHED
```

To list all ports being listened to:

```bash
sudo lsof -nP -iTCP -sTCP:LISTEN
```

This helps you identify which apps are bound to which ports, and what sockets are actively being used.

## Common Confusion

Here are some things that often trip people up:

- **A port is not a process.** Multiple apps can't listen on the same port at the same time (on the same IP), but many sockets can use the same port if the connections are unique.
- **A socket includes the remote side.** That's what makes it a unique connection.
- **You can't bind two servers to the same port on the same IP.** You'll get an "address already in use" error.

---

When you're building or debugging networked applications, knowing how ports and sockets differ helps you understand how data flows between systems.

Next time you're wondering why a service isn't accepting traffic or why your app crashes with an `EADDRINUSE` error, you'll know exactly where to look.
