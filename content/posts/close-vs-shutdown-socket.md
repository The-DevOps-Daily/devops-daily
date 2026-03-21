---
title: 'Close vs Shutdown Socket'
excerpt: 'Understanding the difference between close() and shutdown() for sockets is crucial for proper connection handling. Learn when to use each, how shutdown enables half-closed connections, and how close releases file descriptors.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2025-02-18'
publishedAt: '2025-02-18T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
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

This guide explains the difference between close and shutdown, when to use each, and how they affect TCP connections.

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

| Aspect | close() | shutdown() |
|--------|---------|------------|
| File descriptor | Releases the fd | Keeps fd open |
| Affects | Only your process's reference | All references to the socket |
| Directional control | No - closes everything | Yes - can close read, write, or both |
| Immediate effect | Not guaranteed (buffering) | Immediate (sends FIN for TCP) |
| Use after | Cannot use the fd number | Can still use the socket for allowed operations |

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

// Go doesn't expose shutdown directly
// Must use raw syscall
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

socket.end();  // Sends FIN (half-close write)
// Can still receive data

socket.destroy();  // Forcibly close socket (similar to close)
```

## Best Practices

**Use shutdown() before close() for graceful termination**: This signals the peer properly before releasing the socket.

**Always call close()**: Even after shutdown(), you must call close() to release the file descriptor.

**Use SHUT_WR for protocol compliance**: Many protocols expect you to signal end-of-transmission while receiving the response.

**Handle errors**: Both close() and shutdown() can fail. Check return values in production code.

**Avoid SO_LINGER with zero timeout**: This sends RST instead of FIN, which is abrupt and can lose data.

Understanding the difference between close() and shutdown() helps you write better network code. Use shutdown() when you need directional control or half-closed connections, and always follow up with close() to release the file descriptor. For simple cases, close() alone is sufficient, but protocols requiring graceful shutdown benefit from the shutdown() then close() pattern.
