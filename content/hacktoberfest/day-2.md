---
title: 'Day 2 - Add Your Favorite DevOps Tool'
day: 2
excerpt: 'Share a DevOps tool you love by adding it to the Toolbox page.'
difficulty: 'Beginner'
time: '5 min'
category: 'Content'
tags:
  - hacktoberfest
  - toolbox
  - tools
---

## What You'll Do

Add your favorite DevOps tool to the [DevOps Toolbox](/toolbox). Help other engineers discover tools that make their work easier.

## Step by Step

### 1. Find the toolbox data

Open `lib/toolbox-data.ts` and find the category that best fits your tool.

### 2. Add your tool entry

Add a new object to the appropriate category array:

```typescript
{
  name: 'Tool Name',
  description: 'A one-line description of what the tool does.',
  url: 'https://tool-website.com',
  icon: ToolIcon, // Lucide icon name
}
```

### 3. Preview locally

```bash
pnpm dev
# Visit http://localhost:3000/toolbox
```

Make sure your tool shows up in the right category and the link works.

### 4. Submit your PR

```bash
git checkout -b hacktoberfest/add-tool-name
git add lib/toolbox-data.ts
git commit -m "Add [Tool Name] to toolbox"
git push origin hacktoberfest/add-tool-name
```

## Share It

> "Just added my favorite DevOps tool to the @thedevopsdaily Toolbox! What's yours? #Hacktoberfest #DevOpsDaily"
