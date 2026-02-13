---
title: Building Custom Docker Images
description: Create your own Docker images with Dockerfiles to package your applications
order: 5
---

Using pre-built images from Docker Hub is a great way to get started, but you'll eventually need to create custom images for your own applications. This is where Dockerfiles come in, they provide a script-like way to define exactly how an image should be built.

## Understanding Dockerfiles

A Dockerfile is a text file containing instructions for building a Docker image. Each instruction creates a layer in the image, which helps with caching and efficiency during builds.

Let's start with a basic example for a simple Node.js application:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

Let's break down each instruction:

- `FROM node:18-alpine`: Starts with the Node.js 18 Alpine Linux base image
- `WORKDIR /app`: Sets the working directory inside the container
- `COPY package*.json ./`: Copies package.json and package-lock.json first (for better caching)
- `RUN npm install`: Runs npm install to install dependencies
- `COPY . .`: Copies the rest of your application code
- `EXPOSE 3000`: Documents that the container listens on port 3000
- `CMD ["node", "index.js"]`: Specifies the command to run when the container starts

## Creating Your First Dockerfile

Let's create a simple web application with Express.js to demonstrate building a custom image.

1. Create a project directory and navigate to it:

```bash
mkdir docker-express-app
cd docker-express-app
```

2. Initialize a Node.js project and install Express:

```bash
npm init -y
npm install express
```

3. Create a simple `index.js` file:

```javascript
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello from Docker!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

4. Create a Dockerfile in the same directory:

```dockerfile
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

# The app binds to port 3000
EXPOSE 3000

# Define the command to run your app
CMD ["node", "index.js"]
```

## Building Your Docker Image

To build an image from your Dockerfile, use the `docker build` command:

```bash
docker build -t my-express-app .
```

The `-t` flag tags your image with a name, and the `.` specifies that the Dockerfile is in the current directory.

You'll see output showing each instruction being executed:

```
Sending build context to Docker daemon  4.096kB
Step 1/7 : FROM node:18-alpine
 ---> d483e6f712c5
Step 2/7 : WORKDIR /usr/src/app
 ---> Using cache
 ---> 8d7ab9c161c1
Step 3/7 : COPY package*.json ./
 ---> 65d2a7add184
Step 4/7 : RUN npm install
 ---> Running in 2c75e3941dba
...
```

Once the build completes, your image is ready to use:

```bash
docker images
```

```
REPOSITORY        TAG       IMAGE ID       CREATED         SIZE
my-express-app    latest    8c1a23e0b311   5 seconds ago   173MB
```

## Running Your Custom Image

Run a container from your new image:

```bash
docker run -d -p 3000:3000 --name my-app my-express-app
```

Now you can access your application at http://localhost:3000.

## Understanding Dockerfile Instructions

Let's explore the most common Dockerfile instructions:

### FROM

Specifies the base image. This is always the first instruction.

```dockerfile
FROM ubuntu:22.04
```

You can use minimal base images like Alpine Linux to keep your images small:

```dockerfile
FROM alpine:3.16
```

### WORKDIR

Sets the working directory for subsequent instructions.

```dockerfile
WORKDIR /app
```

Using `WORKDIR` is preferable to using multiple `RUN cd /some/dir` commands.

### COPY and ADD

Both copy files from the build context to the image, but they have different capabilities:

- `COPY` simply copies files and directories
- `ADD` can also extract tar files and download files from URLs

Best practice is to use `COPY` unless you specifically need `ADD`:

```dockerfile
COPY ./app /app
```

For URL downloads, prefer `RUN curl` or `RUN wget` instead of `ADD` for better control.

### RUN

Executes commands and creates a new layer:

```dockerfile
RUN apt-get update && \
    apt-get install -y python3
```

Combining commands into a single `RUN` instruction reduces layers and image size.

### ENV

Sets environment variables:

```dockerfile
ENV NODE_ENV=production \
    PORT=3000
```

Variables set with `ENV` persist when a container runs from the image.

### EXPOSE

Documents which ports the container listens on:

```dockerfile
EXPOSE 80 443
```

Note that `EXPOSE` is informational only, you still need to publish the ports with `-p` when running the container.

### CMD and ENTRYPOINT

These instructions define what happens when the container starts:

- `CMD` provides default arguments for the container, which can be overridden
- `ENTRYPOINT` specifies the executable that always runs when the container starts

The most common pattern is to use `ENTRYPOINT` for the executable and `CMD` for default arguments:

```dockerfile
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
```

This allows users to override the arguments but keeps nginx as the main process.

## Dockerfile Best Practices

### Use Official Base Images

Start with official images from Docker Hub when possible. They're maintained, secure, and follow best practices.

### Minimize Layers

Each instruction creates a layer. Combine related commands into a single `RUN` instruction:

```dockerfile
# Good
RUN apt-get update && apt-get install -y \
    package1 \
    package2 \
    package3 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Avoid
RUN apt-get update
RUN apt-get install -y package1
RUN apt-get install -y package2
RUN apt-get install -y package3
```

### Order Instructions by Stability

Place instructions that change less frequently at the top of your Dockerfile to leverage caching:

```dockerfile
FROM node:18-alpine
WORKDIR /app

# Dependencies change less frequently than source code
COPY package*.json ./
RUN npm install

# Source code changes most frequently
COPY . .
```

### Use .dockerignore

Create a `.dockerignore` file to exclude files and directories from the build context:

```
node_modules
npm-debug.log
Dockerfile
.git
.github
.gitignore
.env
.env.*
```

This reduces the build context size and prevents sensitive files from being included.

### Keep Images Small

Use smaller base images (Alpine variants often work well) and remove unnecessary files:

```dockerfile
FROM node:18-alpine

# Install dependencies and immediately clean up in the same layer
RUN apk add --no-cache python3 make g++ \
    && npm install \
    && npm cache clean --force
```

### Use Multi-Stage Builds

Multi-stage builds allow you to use multiple FROM statements in your Dockerfile. Each FROM statement begins a new stage that can selectively copy artifacts from previous stages:

```dockerfile
# Build stage
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

This results in a much smaller final image with only the necessary files.

## Tagging and Versioning Images

When building images for production, use specific tags for versioning:

```bash
docker build -t myapp:1.0.0 .
```

You can also apply multiple tags to the same build:

```bash
docker build -t myapp:1.0.0 -t myapp:latest .
```

## Working with Private Registries

If you're hosting your images in a private registry, you'll need to log in before pushing:

```bash
docker login registry.example.com
docker build -t registry.example.com/myapp:1.0.0 .
docker push registry.example.com/myapp:1.0.0
```

For cloud-based container registries, DigitalOcean Container Registry offers a secure, private place to store your Docker images. [Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) and get $200 in free credits to try their Container Registry service.

## Real-World Example: Building a Full-Stack Application

Here's an example of a more complex Dockerfile for a React application with a Node.js backend:

```dockerfile
# Build stage for React frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build stage for Node.js backend
FROM node:18-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=backend-build /app/backend ./
COPY --from=frontend-build /app/frontend/build ./public
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "server.js"]
```

This Dockerfile uses three stages:

1. Build the React frontend
2. Prepare the Node.js backend
3. Create a final production image with only the necessary files

In the next section, we'll explore Docker volumes for persistent data storage.
