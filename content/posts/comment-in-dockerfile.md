---
title: 'How Do I Make a Comment in a Dockerfile?'
excerpt: 'Learn how to add comments in Dockerfiles to document your code and improve readability.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-07-03'
publishedAt: '2024-07-03T09:00:00Z'
updatedAt: '2024-07-03T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Dockerfile
  - Comments
  - Tutorials
---

## TLDR

To add comments in a Dockerfile, use the `#` symbol. Comments are ignored during the build process and are useful for documenting your Dockerfile.

---

Comments in Dockerfiles are essential for documenting your code, explaining instructions, and improving readability. This guide will show you how to use comments effectively in Dockerfiles.

## Use the `#` Symbol

In Dockerfiles, comments start with the `#` symbol. Anything following the `#` on the same line is ignored by Docker during the build process.

### Example

```dockerfile
# Use the official Node.js image as the base image
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy application files into the container
COPY . .

# Install dependencies
RUN npm install

# Start the application
CMD ["node", "app.js"]
```

### Explanation

- `# Use the official Node.js image as the base image`: Documents the purpose of the `FROM` instruction.
- `# Set the working directory inside the container`: Explains the `WORKDIR` instruction.
- `# Copy application files into the container`: Describes the `COPY` instruction.
- `# Install dependencies`: Notes the purpose of the `RUN` instruction.
- `# Start the application`: Clarifies the `CMD` instruction.

## Best Practices

- **Be Concise**: Write short and clear comments.
- **Explain Complex Instructions**: Use comments to explain non-obvious instructions.
- **Avoid Redundancy**: Do not comment on instructions that are self-explanatory.
- **Keep Comments Updated**: Ensure comments reflect the current state of the Dockerfile.

By following these practices, you can make your Dockerfiles more readable and maintainable.

## Related Resources

- [Difference Between RUN and CMD in a Dockerfile](/posts/difference-run-cmd-dockerfile) — choose the right instruction
- [Docker Build Requires 1 Argument](/posts/docker-build-requires-1-argument) — fix common build errors
- [Docker Security Best Practices](/posts/docker-security-best-practices) — write secure Dockerfiles
- [Introduction to Docker Guide](/guides/introduction-to-docker) — learn Docker from scratch
- [Docker Quiz](/quizzes/docker-quiz) — test your Docker knowledge
