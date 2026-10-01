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

This is the one regular day where you edit a TypeScript file instead of JSON or Markdown. You only add one object to an array, and you can copy the entries around it.

## Step by Step

### 1. Find the tools list

Open `app/toolbox/page.tsx`. Near the top you'll find two lists:

- `categories`: the category ids you can use. They are `cicd`, `cloud`, `containers`, `monitoring`, `infrastructure`, `security`, `database`, and `developer`.
- `tools`: the array of tool entries shown on the page.

Check that your tool is not in the `tools` array already.

### 2. Add your tool entry

Add a new object to the end of the `tools` array:

```typescript
{
  name: 'k9s',
  description: 'Terminal UI for browsing and managing Kubernetes clusters.',
  href: 'https://k9scli.io/',
  category: 'containers',
  icon: Terminal,
  badges: [
    { text: 'Kubernetes', variant: 'outline' },
    { text: 'Open Source', variant: 'secondary' },
  ],
},
```

- `href` is the link to the tool's website.
- `category` must be one of the ids from the `categories` list.
- `icon` is a [Lucide](https://lucide.dev/icons/) icon component. If the icon you pick is not in the `lucide-react` import at the top of the file yet, add it there too.
- `badges` is optional.

### 3. Preview locally

```bash
pnpm dev
# Visit http://localhost:3000/toolbox
```

Make sure your tool shows up in the right category and the link works.

### 4. Submit your PR

```bash
git checkout -b hacktoberfest/add-tool-name
git add app/toolbox/page.tsx
git commit -m "Add [Tool Name] to toolbox"
git push origin hacktoberfest/add-tool-name
```

## Share It

> "Just added my favorite DevOps tool to the @thedevopsdaily Toolbox! What's yours? #Hacktoberfest #DevOpsDaily"
