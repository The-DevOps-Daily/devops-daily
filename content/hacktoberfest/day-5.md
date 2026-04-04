---
title: 'Day 5 - Share a Tip'
day: 5
excerpt: 'Add a practical tip or gotcha to an existing blog post or guide.'
difficulty: 'Beginner'
time: '10 min'
category: 'Content'
tags:
  - hacktoberfest
  - tips
  - posts
---

## What You'll Do

Add a practical tip, gotcha, or "thing I wish I knew" to an existing [blog post](/posts) or [guide](/guides). Share something you learned the hard way so others don't have to.

## Step by Step

### 1. Find a post to improve

Browse `content/posts/` or `content/guides/` and find an article on a topic you have experience with. Look for opportunities to add:

- A common mistake and how to avoid it
- A useful flag or option the post doesn't mention
- A production gotcha that's not obvious
- A better way to do something described in the post

### 2. Add your tip

Open the markdown file and add a tip section. You can add it inline where it's relevant, or as a callout:

```markdown
> **Tip:** When running `docker compose up` in production, always use
> the `--pull always` flag to ensure you're using the latest image.
> Without it, Docker will use the cached local image even if a newer
> version exists in the registry.
```

Or add a new section if your tip is more detailed:

```markdown
## Common Gotcha: Volume Permissions

If you're running containers as a non-root user, you might hit
permission issues with mounted volumes. The fix is to set the
user ID in your Dockerfile:

\`\`\`dockerfile
RUN useradd -u 1000 appuser
USER appuser
\`\`\`
```

### 3. Preview locally

```bash
pnpm dev
# Navigate to the post you edited
```

### 4. Submit your PR

```bash
git checkout -b hacktoberfest/add-tip
git add content/
git commit -m "Add tip to [post-title]"
git push origin hacktoberfest/add-tip
```

## Share It

> "Just shared a DevOps tip I learned the hard way on @thedevopsdaily - hopefully it saves someone else the headache! #Hacktoberfest #DevOpsDaily"
