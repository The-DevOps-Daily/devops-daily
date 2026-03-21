---
title: 'How to Artificially Create a Connection Timeout Error'
excerpt: 'Learn practical methods to simulate connection timeouts for testing error handling, resilience patterns, and timeout configurations in your applications.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2024-07-30'
publishedAt: '2024-07-30T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Testing
  - Network
  - Timeout
  - Error Handling
  - DevOps
  - Debugging
---

Testing how your application handles connection timeouts is crucial for building resilient software. Whether you're implementing retry logic, circuit breakers, or simply want to verify your error handling works correctly, you'll need to simulate timeout scenarios in a controlled way.

Connection timeouts occur when a client can't establish a connection to a server within a specified time limit. Unlike read timeouts (which happen during data transfer), connection timeouts happen at the initial handshake phase. Let's explore several practical methods to create these scenarios for testing.

## Prerequisites

You'll need access to a terminal and one of the following tools depending on your testing approach:

- Python 3.6+ for script-based solutions
- Node.js 14+ for JavaScript examples
- `netcat` (usually pre-installed on Linux/macOS)
- `iptables` (Linux only, requires sudo access)
- Docker (optional, for containerized testing)

## Using a Black Hole Server

The simplest approach is to connect to an IP address that routes to nowhere. The 10.255.255.1 address is commonly used for this purpose because it's in a reserved private range that typically doesn't exist on your network.

Here's how to test this with curl, which has a default timeout of around 2 minutes:

```bash
# This will hang until the connection timeout is reached
curl --connect-timeout 5 http://10.255.255.1:80
```

The `--connect-timeout 5` flag sets a 5-second connection timeout, making the test faster. You'll see a timeout error instead of waiting for the default timeout period.

For Python applications, you can use this non-routable IP in your code:

```python
import requests
from requests.exceptions import ConnectTimeout

try:
    # This will timeout after 3 seconds
    response = requests.get('http://10.255.255.1:80', timeout=3)
except ConnectTimeout:
    print("Connection timeout occurred - perfect for testing!")
except Exception as e:
    print(f"Other error: {e}")
```

This approach works because your system will try to establish a connection to an unreachable address, eventually timing out when no response comes back.

## Creating a Silent Server with Netcat

Sometimes you need a server that accepts connections but never responds. Netcat can create this scenario by listening on a port without sending any data back.

Start a silent server that accepts connections but doesn't respond:

```bash
# Listen on port 9999 but don't send any response
nc -l 9999 > /dev/null
```

Now test against this server from another terminal:

```bash
# This will connect but hang waiting for a response
curl --connect-timeout 10 http://localhost:9999
```

The connection will establish successfully, but since the server never sends HTTP headers or data, your client will hang until it times out. This is useful for testing read timeouts rather than connection timeouts.

## Using Python to Create a Delayed Server

For more control over the timeout scenario, you can create a server that introduces artificial delays. This Python script creates a server that delays before accepting connections:

```python
import socket
import time
import threading

def delayed_server(port, delay_seconds):
    """
    Creates a server that waits before accepting connections.
    Useful for testing connection timeout scenarios.
    """
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    try:
        server_socket.bind(('localhost', port))
        server_socket.listen(1)
        print(f"Server listening on port {port}, will delay {delay_seconds}s before accepting")

        while True:
            client_socket, address = server_socket.accept()
            print(f"Connection from {address}, delaying...")
            time.sleep(delay_seconds)  # Artificial delay
            client_socket.close()

    except KeyboardInterrupt:
        print("Server shutting down...")
    finally:
        server_socket.close()

if __name__ == "__main__":
    # Start server in a separate thread
    server_thread = threading.Thread(target=delayed_server, args=(8888, 10))
    server_thread.daemon = True
    server_thread.start()

    # Keep the main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping...")
```

Save this as `timeout_server.py` and run it:

```bash
python timeout_server.py
```

Now test against it with a shorter timeout:

```python
import requests
from requests.exceptions import ConnectTimeout

try:
    # Will timeout because server delays 10 seconds but we only wait 5
    response = requests.get('http://localhost:8888', timeout=5)
except ConnectTimeout:
    print("Successfully created a connection timeout!")
```

## Using iptables to Drop Packets (Linux Only)

On Linux systems, you can use iptables to drop packets to specific destinations, effectively creating a black hole for testing. This requires sudo privileges.

First, add a rule to drop packets to a specific IP:

```bash
# Drop all packets to 192.168.100.200 (choose an unused IP in your network)
sudo iptables -A OUTPUT -d 192.168.100.200 -j DROP
```

Now any connection attempt to that IP will timeout:

```bash
# This will timeout because packets are being dropped
curl --connect-timeout 5 http://192.168.100.200:80
```

Remember to remove the rule when you're done testing:

```bash
# Remove the rule
sudo iptables -D OUTPUT -d 192.168.100.200 -j DROP
```

This method is useful when you need to test timeout behavior with real IP addresses that might be referenced in configuration files.

## Creating Timeout Scenarios in Node.js

For Node.js applications, you can create timeout scenarios using the built-in `net` module:

```javascript
const net = require('net');
const http = require('http');

// Create a server that accepts connections but never completes the handshake
const timeoutServer = net.createServer((socket) => {
  console.log('Client connected, but we will not respond...');
  // Don't write anything to the socket - just leave it hanging
});

timeoutServer.listen(3000, () => {
  console.log('Timeout test server running on port 3000');
});

// Test the timeout behavior
const testTimeout = () => {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/',
    method: 'GET',
    timeout: 2000, // 2 second timeout
  };

  const req = http.request(options, (res) => {
    console.log('This should not execute due to timeout');
  });

  req.on('timeout', () => {
    console.log('Connection timeout occurred - test successful!');
    req.destroy();
  });

  req.on('error', (err) => {
    console.log('Error:', err.message);
  });

  req.end();
};

// Test after a short delay
setTimeout(testTimeout, 1000);
```

This creates a TCP server that accepts connections but never sends HTTP responses, causing HTTP clients to timeout.

## Using Docker for Isolated Testing

Docker provides an excellent way to create isolated timeout scenarios. You can create a container that simulates network delays or unresponsive services:

```dockerfile
# Save as Dockerfile.timeout-test
FROM alpine:latest
RUN apk add --no-cache netcat-openbsd
CMD ["nc", "-l", "-p", "8080"]
```

Build and run the container:

```bash
# Build the container
docker build -f Dockerfile.timeout-test -t timeout-test .

# Run it, exposing port 8080
docker run -p 8080:8080 timeout-test
```

Now you can test timeout scenarios against localhost:8080, and easily tear down the environment when done.

## Testing in Different Programming Languages

Here's how to test the timeout scenarios we've created in various programming languages:

### Java Example

```java
import java.net.*;
import java.io.*;

public class TimeoutTest {
    public static void main(String[] args) {
        try {
            URL url = new URL("http://10.255.255.1:80");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(5000); // 5 second timeout
            connection.setReadTimeout(5000);

            connection.connect();
            System.out.println("Connection successful");

        } catch (SocketTimeoutException e) {
            System.out.println("Timeout occurred: " + e.getMessage());
        } catch (Exception e) {
            System.out.println("Other error: " + e.getMessage());
        }
    }
}
```

### Go Example

```go
package main

import (
    "fmt"
    "net/http"
    "time"
)

func main() {
    client := &http.Client{
        Timeout: 5 * time.Second,
    }

    _, err := client.Get("http://10.255.255.1:80")
    if err != nil {
        fmt.Printf("Request failed (expected): %v\n", err)
    }
}
```

These examples demonstrate how different languages handle connection timeouts, which is valuable for understanding how your applications will behave in production.

## Best Practices for Timeout Testing

When testing timeout scenarios in your applications, consider setting up dedicated test environments where you can safely introduce network delays and failures. Use configuration files to easily switch between normal and timeout-testing endpoints, and always include timeout testing as part of your integration test suite.

Document the expected timeout behavior in your application, including what happens when external services are unavailable. This helps other developers understand the resilience patterns you've implemented.

You now have several practical methods to create connection timeout scenarios for testing. These techniques will help you build more resilient applications that gracefully handle network issues and service unavailability.
