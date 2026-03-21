---
title: "docker: 'build' requires 1 argument. See 'docker build --help'"
excerpt: "Getting the error 'docker: build requires 1 argument'? Learn what it means, why it happens, and how to fix it with practical examples for your Docker workflow."
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-04-28'
publishedAt: '2025-04-28T09:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Troubleshooting
  - Containers
  - DevOps
---

## TLDR

The error `docker: "build" requires 1 argument. See 'docker build --help'` means you forgot to specify the build context (usually a directory) when running `docker build`. Always provide a path (like `.`) as the last argument.

## Why Does This Error Happen?

When you run `docker build`, Docker expects a build context—a directory containing your `Dockerfile` and any files needed for the build. If you don't provide this argument, Docker doesn't know what to build.

**Example of the error:**

```bash
docker build
# Output:
# docker: "build" requires 1 argument. See 'docker build --help'.
```

## How to Fix It

Add the build context (usually `.` for the current directory) at the end of your command:

```bash
docker build .
```

Or, if your `Dockerfile` is in a different directory:

```bash
docker build /path/to/context
```

You can also tag your image at the same time:

```bash
docker build -t my-image .
```

## Common Pitfalls

- Forgetting the `.` or path at the end of the command.
- Using `docker build -t my-image` without the context (should be `docker build -t my-image .`).
- Running the command from the wrong directory (make sure your `Dockerfile` is in the context directory).

## Best Practices

- Always double-check your build context before running `docker build`.
- Use `docker build -t <name> .` for most local builds.
- For CI/CD, use absolute paths or ensure the working directory is correct.

## Conclusion

The `docker: "build" requires 1 argument` error is a simple fix—just add the build context (like `.`) to your command. This ensures Docker knows where to find your `Dockerfile` and build resources.

## Related Resources

- [Difference Between RUN and CMD in a Dockerfile](/posts/difference-run-cmd-dockerfile) — Dockerfile instructions
- [How Do I Make a Comment in a Dockerfile?](/posts/comment-in-dockerfile) — write clearer Dockerfiles
- [COPY with Docker Exclusion](/posts/copy-with-docker-exclusion) — optimize build context
- [Introduction to Docker: Building Custom Images](/guides/introduction-to-docker) — Dockerfile guide
- [Docker Quiz](/quizzes/docker-quiz) — test your Docker knowledge
