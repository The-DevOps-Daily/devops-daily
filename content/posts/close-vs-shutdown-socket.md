---
title: 'Close vs Shutdown Socket'
excerpt: 'The difference between close() and shutdown() on a socket: when to use each, how shutdown enables half-closed connections, why a restarted server gets "Address already in use", and how SO_REUSEADDR and SO_REUSEPORT differ.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2025-02-18'
publishedAt: '2025-02-18T10:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Networking
  - Sockets
  - TCP
  - Programming
  - Systems Programming
---

When working with network sockets, you have two ways to end a connection: `close()` and `shutdown()`. While both can terminate socket communication, they work differently and serve different purposes. Using the wrong one can lead to data loss, connection leaks, or improper connection termination.

This guide explains the difference between close and shutdown, when to use each, and how they affect TCP connections. The last part covers what a close leaves behind: connections in `TIME_WAIT`, the `Address already in use` error when a server restarts, and how `SO_REUSEADDR` and `SO_REUSEPORT` differ.

## TLDR

`shutdown()` closes one or both directions of a socket connection but keeps the socket descriptor open. `close()` releases the socket file descriptor entirely. Use `shutdown(SHUT_WR)` to signal you're done sending while still receiving data. Use `close()` when you're completely finished with the socket. For clean TCP shutdowns, call `shutdown()` first, then `close()`.

## Prerequisites

Basic understanding of sockets and TCP connections helps you follow the examples. Familiarity with file descriptors in Unix systems is useful but not required.

## Understanding Socket File Descriptors

In Unix-like systems, sockets are file descriptors. When you create a socket:

```c
int sockfd = socket(AF_INET, SOCK_STREAM, 0);
```

You get a file descriptor (an integer) representing that socket. This file descriptor is how the operating system tracks the socket.

## What close() Does

`close()` decrements the reference count on a file descriptor. When the count reaches zero, the operating system releases the socket resources.

### Basic close() Usage

```c
#include <unistd.h>

int sockfd = socket(AF_INET, SOCK_STREAM, 0);
// ... use the socket ...
close(sockfd);  // Release the file descriptor
```

### What Happens When You Call close()

1. The socket file descriptor is marked as closed
2. If this was the last reference to the socket, TCP connection termination begins
3. Any buffered data may be sent (or lost, depending on socket options)
4. The file descriptor number can be reused for new files/sockets

### close() with Multiple References

If multiple file descriptors reference the same socket (through `fork()` or `dup()`), close() only decrements the reference count:

```c
int sockfd = socket(AF_INET, SOCK_STREAM, 0);
int sockfd2 = dup(sockfd);  // Second reference to same socket

close(sockfd);   // Reference count: 2 -> 1, socket stays open
close(sockfd2);  // Reference count: 1 -> 0, socket actually closes
```

This matters when you fork processes:

```c
int sockfd = socket(AF_INET, SOCK_STREAM, 0);

if (fork() == 0) {
    // Child process
    close(sockfd);  // Child closes its reference
    // Parent still has socket open
} else {
    // Parent process
    close(sockfd);  // Parent closes its reference
    // Now socket is fully closed
}
```

## What shutdown() Does

`shutdown()` closes one or both directions of communication without releasing the file descriptor.

### Syntax

```c
#include <sys/socket.h>

int shutdown(int sockfd, int how);
```

The `how` parameter specifies what to shut down:

- `SHUT_RD` (or `0`): Shut down reading. Further receives are disallowed.
- `SHUT_WR` (or `1`): Shut down writing. Further sends are disallowed.
- `SHUT_RDWR` (or `2`): Shut down both reading and writing.

### Half-Close: Shutdown for Writing

The most common use case is shutting down the write side while keeping the read side open:

```c
shutdown(sockfd, SHUT_WR);
```

This tells the other end: "I'm done sending data, but I'll still receive."

**What happens:**

1. TCP FIN packet is sent to the peer
2. Your application can no longer send data on this socket
3. Your application can still receive data from the peer
4. The socket file descriptor remains open

This creates a "half-closed" connection, useful for protocols where one side finishes sending before receiving the response.

### Example: HTTP Client

```c
// Send HTTP request
send(sockfd, request, strlen(request), 0);

// Signal we're done sending
shutdown(sockfd, SHUT_WR);

// Continue receiving the response
while ((bytes = recv(sockfd, buffer, sizeof(buffer), 0)) > 0) {
    process_data(buffer, bytes);
}

// Now close the socket
close(sockfd);
```

## Key Differences

| Aspect              | close()                                                    | shutdown()                                      |
| ------------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| File descriptor     | Releases the fd                                            | Keeps fd open                                   |
| Affects             | Only your process's reference                              | All references to the socket                    |
| Directional control | No - closes everything                                     | Yes - can close read, write, or both            |
| Effect on TCP       | FIN after queued data, only when the last reference closes | `SHUT_WR` sends FIN after queued data at once   |
| Use after           | Cannot use the fd number                                   | Can still use the socket for allowed operations |

## When to Use shutdown()

### Protocol Requires Half-Close

Some protocols expect the client to signal end-of-request while keeping the connection open for the response:

```python
import socket

sock = socket.socket()
sock.connect(('example.com', 80))

# Send request
sock.sendall(b'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n')

# Signal end of request
sock.shutdown(socket.SHUT_WR)

# Receive full response
response = b''
while True:
    data = sock.recv(4096)
    if not data:
        break
    response += data

sock.close()
```

### Forcibly Close Regardless of Reference Count

shutdown() affects the underlying socket, not just your file descriptor reference:

```c
int sockfd = socket(AF_INET, SOCK_STREAM, 0);
int sockfd2 = dup(sockfd);

shutdown(sockfd, SHUT_RDWR);  // Shuts down socket for BOTH file descriptors

// Both sockfd and sockfd2 can no longer send or receive
close(sockfd);
close(sockfd2);
```

### Graceful Shutdown Sequence

For clean TCP connection termination:

```c
// 1. Stop sending data
shutdown(sockfd, SHUT_WR);

// 2. Drain any remaining data from peer
char buffer[1024];
while (recv(sockfd, buffer, sizeof(buffer), 0) > 0) {
    // Discard data
}

// 3. Close the socket
close(sockfd);
```

## When to Use close()

### Simple Connection Termination

For most straightforward cases where you're done with both sending and receiving:

```c
// Connect, send/receive data
send(sockfd, data, len, 0);
recv(sockfd, buffer, sizeof(buffer), 0);

// Done - just close
close(sockfd);
```

### Resource Cleanup

Always close sockets when you're finished to avoid file descriptor leaks:

```c
int sockfd = socket(AF_INET, SOCK_STREAM, 0);

if (connect(sockfd, addr, addrlen) < 0) {
    close(sockfd);  // Clean up on error
    return -1;
}

// ... use socket ...

close(sockfd);  // Clean up when done
```

## Common Patterns

### Server Handling Client Connection

```c
int client_sock = accept(listen_sock, NULL, NULL);

// Receive request
recv(client_sock, request, sizeof(request), 0);

// Send response
send(client_sock, response, response_len, 0);

// Graceful shutdown
shutdown(client_sock, SHUT_WR);  // Signal we're done sending

// Optional: drain any remaining client data
// ...

// Close the connection
close(client_sock);
```

### Client Making Request

```python
import socket

# Create and connect
sock = socket.socket()
sock.connect(('server', 8080))

# Send data
sock.sendall(b'REQUEST DATA')

# Half-close: we're done sending
sock.shutdown(socket.SHUT_WR)

# Receive response
response = sock.recv(4096)

# Fully close
sock.close()
```

## shutdown() Doesn't Release Resources

A common mistake is thinking shutdown() releases the socket:

```c
shutdown(sockfd, SHUT_RDWR);
// Socket is shutdown but file descriptor is still open!
// Must still call close()

close(sockfd);  // NOW the socket is fully released
```

Without close(), you leak file descriptors even though the connection is shut down.

## SO_LINGER Socket Option

The SO_LINGER option controls close() behavior:

```c
struct linger so_linger;
so_linger.l_onoff = 1;    // Enable linger
so_linger.l_linger = 5;   // Linger for 5 seconds

setsockopt(sockfd, SOL_SOCKET, SO_LINGER, &so_linger, sizeof(so_linger));

close(sockfd);  // Blocks for up to 5 seconds trying to send remaining data
```

With linger disabled or set to zero:

```c
so_linger.l_onoff = 1;
so_linger.l_linger = 0;   // Don't linger

setsockopt(sockfd, SOL_SOCKET, SO_LINGER, &so_linger, sizeof(so_linger));

close(sockfd);  // Immediately sends RST, discarding buffered data
```

## Language-Specific Behavior

### Python

```python
import socket

sock = socket.socket()
# ...

sock.shutdown(socket.SHUT_WR)   # Shutdown write
sock.close()                     # Close socket
```

### Go

```go
import "net"

conn, _ := net.Dial("tcp", "server:8080")

// Go has no shutdown() method, but TCPConn has both halves
conn.(*net.TCPConn).CloseWrite()  // Equivalent to shutdown(SHUT_WR)

conn.Close()  // Close the connection
```

### Java

```java
Socket socket = new Socket("server", 8080);

socket.shutdownOutput();  // Equivalent to shutdown(SHUT_WR)
// Can still read

socket.close();  // Close the socket
```

### Node.js

```javascript
const net = require('net');

const socket = net.connect(8080, 'server');

socket.end(); // Sends FIN (half-close write)
// Can still receive data

socket.destroy(); // Forcibly close socket (similar to close)
```

## Why Does bind() Fail With "Address already in use" After a Restart?

The connections that the old process closed are still in `TIME_WAIT`, and they hold the port. The side that closes a TCP connection first keeps it in `TIME_WAIT` for a while, 60 seconds on Linux, so that delayed packets from the old connection cannot be mistaken for a new one. A server that closes its client connections, for example while it shuts down, leaves these entries behind, and the new process gets `OSError: [Errno 98] Address already in use` from `bind()`.

Set `SO_REUSEADDR` on the listening socket before `bind()`:

```python
import socket

srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)  # before bind()
srv.bind(("0.0.0.0", 8080))
srv.listen()
```

On Linux, the option must be set in **both** processes: the connections in `TIME_WAIT` keep the setting of the listening socket that accepted them. We tested every combination on localhost with Python 3.11: a server accepts one connection, closes it first, exits, and a new server binds the same port at once:

```text
first run without, restart with   : [Errno 98] Address already in use
first run with, restart without   : [Errno 98] Address already in use
first run with, restart with      : ok
```

`ss -tan state time-wait '( sport = :8080 )'` lists the connections that block the port. Most servers set the option for you: nginx, Go's `net` package, Node.js and Python's `http.server` all do. Python's `socketserver.TCPServer` does not, unless you set `allow_reuse_address = True` on your class. Do not try to avoid `TIME_WAIT` with `SO_LINGER` set to 0. That makes `close()` send a reset, and the peer can lose data that was still on the way.

What `SO_REUSEADDR` does **not** do on Linux, from the same test:

- It does not let two sockets listen on the same address and port. A second listener fails with `Address already in use`, also when both set the option.
- It does not let a socket on `127.0.0.1:8080` and one on `0.0.0.0:8080` listen at the same time. BSD and macOS allow that with `SO_REUSEADDR`; Linux does not.
- Two different specific addresses need no option at all: `127.0.0.1:8080` and `127.0.0.2:8080` can both listen.

## How Do SO_REUSEADDR and SO_REUSEPORT Differ?

`SO_REUSEADDR` is for restarts. `SO_REUSEPORT` lets several sockets listen on the **same** address and port, and the kernel spreads the new connections across them:

|                                            | `SO_REUSEADDR`                                   | `SO_REUSEPORT`                                                                                                            |
| ------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Solves                                     | Binding while old connections are in `TIME_WAIT` | Several processes or threads that accept on one port                                                                      |
| Two listeners on the same address and port | No                                               | Yes, when every socket sets it before `bind()`                                                                            |
| Who may share the port                     | Not applicable                                   | Only sockets of the same effective user, so another user cannot take traffic                                              |
| Who picks the socket for a connection      | Not applicable                                   | The Linux kernel, by a hash of the connection's addresses and ports                                                       |
| Platforms                                  | All, with other rules on BSD, macOS and Windows  | Linux 3.9 and later spread connections; BSD and macOS have an option with the same name and other rules; Windows has none |

With four worker processes that each set `SO_REUSEPORT` and listen on `127.0.0.1:9030`, 400 connections from one client were spread like this:

```text
worker 3 (pid 3200034): 100 connections
worker 2 (pid 3200033): 99 connections
worker 1 (pid 3200032): 105 connections
worker 0 (pid 3200031): 96 connections
```

```python
# each worker process runs this; a parent forks four of them
s = socket.socket()
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
s.bind(("127.0.0.1", 9030))
s.listen(512)
while True:
    conn, _ = s.accept()
    conn.close()
```

The spread is by hash, not by load: a worker that is busy with a slow request still gets its share of new connections. When one of the sockets closes, for example during a restart of one worker, the connections waiting in its accept queue are reset. nginx (`listen 80 reuseport;`), HAProxy and Envoy use the option, and DNS servers use it for UDP to spread queries across threads.

Node.js's `cluster` module is often named as an example, but it does not use `SO_REUSEPORT`. By default, on every platform except Windows, the primary process accepts the connections and hands them to the workers in turn.

To combine both, set `SO_REUSEADDR` and `SO_REUSEPORT` on each socket. [Can two sockets share a TCP port?](/posts/can-two-sockets-share-tcp-port) walks through more cases, including UDP and multicast.

## Best Practices

**Use shutdown() before close() for graceful termination**: This signals the peer properly before releasing the socket.

**Always call close()**: Even after shutdown(), you must call close() to release the file descriptor.

**Use SHUT_WR for protocol compliance**: Many protocols expect you to signal end-of-transmission while receiving the response.

**Handle errors**: Both close() and shutdown() can fail. Check return values in production code.

**Avoid SO_LINGER with zero timeout**: This sends RST instead of FIN, which is abrupt and can lose data.

Understanding the difference between close() and shutdown() helps you write better network code. Use shutdown() when you need directional control or half-closed connections, and always follow up with close() to release the file descriptor. For simple cases, close() alone is sufficient, but protocols requiring graceful shutdown benefit from the shutdown() then close() pattern.

## Related Resources

- [Can two sockets share a TCP port?](/posts/can-two-sockets-share-tcp-port): ports, sockets and the 4-tuple, with more `SO_REUSEPORT` cases
- [How to free up a TCP port](/posts/how-to-free-up-tcp-port): find and stop the process that holds a port
- [Increasing the maximum number of TCP connections](/posts/increasing-the-maximum-number-of-tcp-ip-connections-in-linux#h3-time_wait): `TIME_WAIT`, ephemeral ports and backlog limits
- [UDP vs TCP: how much faster is UDP?](/posts/udp-vs-tcp-performance-comparison), measured on localhost
- [Sockets and connection states](/guides/networking-fundamentals/08-network-monitoring-and-troubleshooting#h2-sockets-and-connection-states) in the networking guide, and the [TCP vs UDP simulator](/games/tcp-vs-udp)
