---
title: 'Day 1 - Build a Minimal Docker Image'
day: 1
excerpt: 'Learn to create the smallest possible Docker image for a Go application. Optimize for size, security, and performance using static compilation.'
description: 'Create a minimal Docker image under 25MB using Go, multi-stage builds, Alpine Linux, and best practices for containerization.'
publishedAt: '2025-12-01T00:00:00Z'
updatedAt: '2025-12-14T00:00:00Z'
difficulty: 'Beginner'
category: 'Docker'
tags:
  - Docker
  - Containerization
  - Optimization
  - Alpine
  - Go
---

## Description

You're tasked with containerizing a small application, but your manager is concerned about image size and security. Large images slow down deployments, cost more to store, and have larger attack surfaces. Your goal is to create the smallest, most efficient Docker image possible.

## Task

Create the smallest working Docker image you can for a tiny Go application.

**Requirements:**
- Image must be under 25MB
- Application must run successfully
- Use multi-stage builds
- Use Alpine Linux base images or scratch
- Compile Go binary statically for minimal final image

## Target

- **Image Size**: Under 25MB (under 10MB possible with scratch!)
- **Startup Time**: Under 1 second
- **Security**: Minimal attack surface with Alpine/scratch base

## Sample App

### Go Example (main.go)

```go
package main

import (
	"fmt"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "Hello from Advent of DevOps!")
	})

	fmt.Println("Server running on port 8000...")
	if err := http.ListenAndServe(":8000", nil); err != nil {
		fmt.Printf("Error starting server: %v\n", err)
	}
}
```

## Solution

### Optimized Dockerfile (Go + Alpine)

```dockerfile
# Multi-stage build
FROM golang:1.23-alpine AS builder

WORKDIR /usr/src/app

# Copy Go source
COPY main.go .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags '-s -w' -o main .

# Final stage
FROM alpine:latest

# Create non-root user
RUN addgroup -g 1001 appgroup && \
    adduser -D -u 1001 -G appgroup appuser

WORKDIR /usr/src/app

# Copy from builder
COPY --from=builder --chown=appuser:appgroup /usr/src/app/main .

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Run binary
CMD ["./main"]
```

### Alternative: Scratch-Based Image (Even Smaller!)

For an even smaller image (under 10MB), you can use a `scratch` base:

```dockerfile
# Multi-stage build
FROM golang:1.23-alpine AS builder

WORKDIR /usr/src/app
COPY main.go .

# Build static binary with all dependencies embedded
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags '-s -w -extldflags "-static"' -o main .

# Use scratch (empty) base image
FROM scratch

# Copy only the binary
COPY --from=builder /usr/src/app/main /main

# Expose port
EXPOSE 8000

# Run binary
CMD ["/main"]
```

### Build and Test

```bash
# Build the Alpine version
docker build -t advent-day1:alpine .

# Build the scratch version (use the scratch Dockerfile)
docker build -f Dockerfile.scratch -t advent-day1:scratch .

# Check image sizes
docker images advent-day1

# Run the container
docker run -d -p 8000:8000 --name advent-day1 advent-day1:alpine

# Test the application
curl http://localhost:8000
# Should return: Hello from Advent of DevOps!

# Clean up
docker stop advent-day1 && docker rm advent-day1
```

## Explanation

### Why This Matters

Image size directly impacts:
- **Deployment Speed**: Smaller images deploy faster across networks
- **Storage Costs**: Less disk space and registry storage needed
- **Security**: Fewer packages mean fewer vulnerabilities
- **Build Times**: Smaller base images build faster

### Why Go for Minimal Images?

Go compiles to a **static binary** with no runtime dependencies, making it perfect for minimal Docker images:

- **Python/Node.js**: Require ~50-60MB runtime (interpreter + standard library)
- **Go**: Compiles to single binary (~5-7MB) with zero dependencies
- **Result**: Go achieves sub-25MB easily, while Python/Node.js struggle to get below 50MB

### Key Optimization Techniques

1. **Alpine Linux Base**: Uses musl libc instead of glibc, significantly reducing size (~7MB)
2. **Scratch Base**: Completely empty image, only the binary (0MB base!)
3. **Multi-Stage Builds**: Separates build-time dependencies from runtime
4. **Static Compilation**: Go binaries include all dependencies
5. **Strip Debug Symbols**: `-ldflags '-s -w'` removes debug info and symbol table
6. **Non-Root User**: Security best practice (Alpine version)

### Build Flags Explained

```bash
CGO_ENABLED=0          # Disable C bindings for pure Go binary
GOOS=linux             # Target Linux OS
-a                     # Force rebuild of all packages
-installsuffix cgo     # Separate build cache
-ldflags '-s -w'       # Strip debug info and symbol table
  -s                   # Omit symbol table
  -w                   # Omit DWARF symbol table
```

### Size Comparison

| Approach | Image Size | Notes |
|----------|-----------|--------------------------------------------|
| golang:1.23 | ~800MB | Full Debian-based image with Go toolchain |
| golang:1.23-alpine | ~300MB | Alpine with Go toolchain |
| Alpine + Go binary | **~15MB** | Multi-stage with Alpine base |
| Scratch + Go binary | **~7MB** | Only the compiled binary, no OS |
| python:3.12-alpine | ~60MB | Python interpreter required |
| node:20-alpine | ~70MB | Node.js runtime required |

## Result

You should achieve:
- ✅ Docker image under 25MB (15MB Alpine, 7MB scratch)
- ✅ Functional Go web server responding on port 8000
- ✅ Container runs as non-root user (Alpine version)
- ✅ Fast build and startup times
- ✅ Static binary with zero runtime dependencies

## Validation

```bash
# Check image size
docker images advent-day1 --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
# Alpine version: ~15MB
# Scratch version: ~7MB

# Verify non-root user (Alpine version only)
docker run --rm advent-day1:alpine whoami
# Should show: appuser

# Test application
docker run -d -p 8000:8000 --name test advent-day1:alpine
curl http://localhost:8000
# Should return: Hello from Advent of DevOps!
docker stop test && docker rm test

# Inspect image layers
docker history advent-day1:alpine
docker history advent-day1:scratch
```

## Bonus: Python and Node.js Alternatives

If you prefer Python or Node.js, here are **realistic** minimal images. Note that the 25MB target is **not achievable** with interpreted languages due to runtime requirements.

### Python (Realistic: ~60MB)

```dockerfile
FROM python:3.12-alpine

RUN addgroup -g 1001 appgroup && \
    adduser -D -u 1001 -G appgroup appuser

WORKDIR /app
COPY app.py .

USER appuser
EXPOSE 8000

CMD ["python", "app.py"]
```

**Python app.py:**
```python
from http.server import HTTPServer, BaseHTTPRequestHandler

class SimpleHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'Hello from Advent of DevOps!')

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8000), SimpleHandler)
    print('Server running on port 8000...')
    server.serve_forever()
```

**Note**: Python Alpine images are **~50-60MB minimum** due to the Python interpreter and standard library.

### Node.js (Realistic: ~70MB)

```dockerfile
FROM node:20-alpine

RUN addgroup -g 1001 appgroup && \
    adduser -D -u 1001 -G appgroup appuser

WORKDIR /app
COPY app.js .

USER appuser
EXPOSE 8000

CMD ["node", "app.js"]
```

**Node.js app.js:**
```javascript
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from Advent of DevOps!');
});

server.listen(8000, '0.0.0.0', () => {
  console.log('Server running on port 8000...');
});
```

**Note**: Node.js Alpine images are **~60-70MB minimum** due to the Node.js runtime and V8 engine.

## Links

- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Alpine Linux Docker Images](https://hub.docker.com/_/alpine)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Go Docker Official Images](https://hub.docker.com/_/golang)
- [Building Minimal Go Docker Images](https://chemidy.medium.com/create-the-smallest-and-secured-golang-docker-image-based-on-scratch-4752223b7324)
- [Scratch Base Images](https://docs.docker.com/develop/develop-images/baseimages/#create-a-simple-parent-image-using-scratch)

## Share Your Success

Completed this challenge? Share your achievement!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X (formerly Twitter) with:
- Your final image size
- Which approach you used (Alpine or scratch)
- Any additional optimizations you discovered
- Screenshots of your running container

Use hashtags: **#AdventOfDevOps #Docker #Day1 #GoLang**
