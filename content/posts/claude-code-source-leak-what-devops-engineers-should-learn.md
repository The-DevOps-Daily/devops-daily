---
title: 'Claude Code Source Leaked via npm Source Maps: Lessons for Every DevOps Team'
excerpt: 'Anthropic accidentally shipped source maps in their npm package, exposing 512,000 lines of Claude Code source. Here is what went wrong and how to prevent it in your own CI/CD pipeline.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-04-01'
publishedAt: '2026-04-01T09:00:00Z'
updatedAt: '2026-04-01T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'Bobby Iliev'
  slug: 'bobby-iliev'
featured: true
tags:
  - security
  - npm
  - cicd
  - devops
  - source-maps
---

On March 31, 2026, a security researcher discovered that Anthropic's Claude Code CLI tool had its entire source code exposed through a source map file published to the npm registry. Version 2.1.88 of `@anthropic-ai/claude-code` shipped with a 59.8 MB source map that mapped the minified production code back to the original TypeScript, which pointed to a publicly accessible zip archive on Anthropic's Cloudflare R2 bucket.

Within hours, the codebase was archived to a [public GitHub repository](https://github.com/Kuberwastaken/claude-code) that quickly gained over 1,100 stars.

This is not a story about Anthropic doing something uniquely bad. This is a story about a packaging mistake that any team shipping npm packages could make, and probably already has.

## What Happened

Claude Code is Anthropic's agentic coding tool, a CLI that ships as an npm package. Like many JavaScript tools, the production build minifies the TypeScript source into a single bundled JavaScript file.

The problem: version 2.1.88 included a `.js.map` file in the published package. Source maps are debugging files that contain a complete mapping from the minified output back to the original source code. They are meant for development, never for production npm packages.

The source map itself was roughly 60 MB. It contained enough information to reconstruct the full original codebase: 512,000+ lines across 1,900 files.

Here is the kicker. [According to multiple reports](https://dev.to/gabrielanhaia/claude-codes-entire-source-code-was-just-leaked-via-npm-source-maps-heres-whats-inside-cjo), this is the second time this exact mistake happened with Claude Code. A nearly identical source map leak occurred with an earlier version in February 2025.

## What Was Exposed (and What Was Not)

The leaked code revealed:

- The full CLI architecture and command structure
- Internal tool definitions and agent orchestration logic
- Prompt engineering patterns and system prompts
- Unreleased features in development
- Internal APIs and data flow

What was not exposed:

- Model weights (these are server-side, not in the CLI)
- User data or credentials
- API keys or secrets

Anthropic acknowledged the incident, stating it was "a release packaging issue caused by human error, not a security breach." No customer data was involved.

## Why This Matters for DevOps Teams

If you publish npm packages, Docker images, or any build artifacts, the same class of mistake is waiting for you. Source maps, debug symbols, `.env` files, internal documentation, test fixtures with real data. All of these end up in production artifacts more often than anyone wants to admit.

The root cause is almost always the same: the CI/CD pipeline does not explicitly strip development artifacts before publishing.

## How to Prevent This

### 1. Use .npmignore or the files field

Every npm package should either have a `.npmignore` file or use the `files` field in `package.json` to whitelist what gets published.

The whitelist approach is safer because it only includes what you explicitly list:

```json
{
  "files": [
    "dist/",
    "README.md",
    "LICENSE"
  ]
}
```

With this config, source maps, test files, source code, and everything else is excluded by default. Only `dist/`, `README.md`, and `LICENSE` ship to npm.

### 2. Disable source maps in production builds

If you use TypeScript or a bundler, make sure source maps are off for production:

```json
{
  "compilerOptions": {
    "sourceMap": false,
    "declarationMap": false
  }
}
```

For webpack, esbuild, or other bundlers, set `sourcemap: false` in production configs.

### 3. Check what you are publishing before you publish

npm has a built-in command that shows exactly what will be included in your package:

```bash
npm pack --dry-run
```

This lists every file that would be included. Run it in CI before `npm publish` and fail the build if unexpected files appear:

```bash
# In your CI pipeline
npm pack --dry-run 2>&1 | grep -E "\.map$|\.env|\.test\." && echo "FAIL: unwanted files in package" && exit 1
```

### 4. Add a publish check to CI/CD

Create a step in your pipeline that validates the package contents:

```bash
# Pack and inspect
npm pack
tar -tzf *.tgz | grep -E "\.map$|source|\.env|\.test\." && exit 1
echo "Package contents look clean"
```

### 5. Use npm provenance

If you publish to npm, enable [provenance](https://docs.npmjs.com/generating-provenance-statements) so consumers can verify that the package was built from a specific commit via CI/CD, not manually published from someone's laptop:

```bash
npm publish --provenance
```

This links every published version to a specific GitHub Actions run, making it harder for compromised credentials to be used for rogue publishes (like the axios attack we covered [last week](/posts/axios-supply-chain-attack-what-happened-and-what-to-do)).

### 6. Review your Docker images too

The same problem applies to Docker images. Development dependencies, source code, debug tools, and secrets end up in production images all the time.

```dockerfile
# Bad: everything is in the final image
FROM node:20
COPY . .
RUN npm install
RUN npm run build

# Better: multi-stage build, only ship what you need
FROM node:20 AS builder
COPY . .
RUN npm install
RUN npm run build

FROM node:20-slim
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
```

## What the Claude Code Creator Said

Boris Cherny, the creator of Claude Code, [responded directly on X](https://x.com/bcherny/status/2039207155069505693): "It was human error. Our deploy process has a few manual steps, and we didn't do one of the steps correctly."

What he said next is the most interesting part for DevOps teams: "The counter-intuitive answer is to solve the problem by finding ways to go faster, rather than introducing more process. In this case more automation and claude checking the results."

That is a textbook SRE response. When something breaks because a human missed a step, the fix is not to add another checklist item that a different human will eventually miss. The fix is to remove the human from that step entirely. Automate the check. Let CI catch it. In their case, they are even using their own AI to validate the results.

## The Repeat Problem

The most concerning aspect of this incident is not the leak itself. It is that [this is the second time it happened](https://venturebeat.com/technology/claude-codes-source-code-appears-to-have-leaked-heres-what-we-know/) with the same product, with a nearly identical source map leak in February 2025.

That is exactly why Boris's response matters. After the first incident, the fix was apparently procedural (a manual step). The manual step was missed again. Now they are moving toward automation, which is the correct long-term fix.

For your own team, the takeaway is clear: when you fix a packaging mistake, fix it in the pipeline, not just in the config. A human will forget. A CI step will not.

## Key Takeaways

1. **Use the `files` whitelist in `package.json`.** Explicitly list what ships. Everything else stays behind.
2. **Disable source maps in production builds.** If they are not needed by consumers, do not generate them.
3. **Run `npm pack --dry-run` in CI.** Catch unwanted files before they hit the registry.
4. **Check Docker images too.** Run `docker history` and `dive` to inspect what is in your production images.
5. **Fix mistakes in the pipeline, not just the config.** If it happened once, it will happen again unless CI prevents it.

This is not about pointing fingers at Anthropic. Every team that publishes packages or images is one misconfigured build step away from the same mistake. The difference is whether your pipeline catches it before your users do.

*Sources: [Dev.to](https://dev.to/gabrielanhaia/claude-codes-entire-source-code-was-just-leaked-via-npm-source-maps-heres-whats-inside-cjo), [VentureBeat](https://venturebeat.com/technology/claude-codes-source-code-appears-to-have-leaked-heres-what-we-know), [The Register](https://www.theregister.com/2026/03/31/anthropic_claude_code_source_code/), [CyberSecurityNews](https://cybersecuritynews.com/claude-code-source-code-leaked/)*
