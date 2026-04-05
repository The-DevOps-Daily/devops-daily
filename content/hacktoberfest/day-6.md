---
title: 'Day 6 - Find and Fix Something'
day: 6
excerpt: 'Browse the site and fix a typo, broken link, or formatting issue.'
difficulty: 'Intermediate'
time: '10 min'
category: 'Bug Fix'
tags:
  - hacktoberfest
  - bugfix
  - quality
---

## What You'll Do

By now you're familiar with the codebase from days 1-5. Today, browse the [live site](https://devops-daily.com) and find something to fix - a typo, broken link, outdated info, or formatting issue.

## What to Look For

- **Typos** in post titles, descriptions, or body text
- **Broken links** that lead to 404 pages
- **Outdated information** (old version numbers, deprecated commands)
- **Formatting issues** (missing code highlighting, broken markdown)
- **Missing alt text** on images
- **Inconsistent formatting** between similar pages

## Step by Step

### 1. Browse the site

Visit [devops-daily.com](https://devops-daily.com) and click around. Check posts, guides, quizzes, and other pages. When you find something off, note the URL.

### 2. Find the source file

Posts are in `content/posts/`, guides in `content/guides/`, and other content in their respective `content/` subdirectories.

### 3. Make the fix

Open the file and fix the issue. Keep your change focused - one fix per PR.

### 4. Submit your PR

```bash
git checkout -b hacktoberfest/fix-description
git add .
git commit -m "Fix: [brief description of what you fixed]"
git push origin hacktoberfest/fix-description
```

In your PR description, include:
- What you found
- Where you found it (URL)
- What you fixed

## Share It

> "Found and fixed a bug in an open source project today! Day 6 of the @thedevopsdaily Hacktoberfest challenge done. #Hacktoberfest #DevOpsDaily #OpenSource"
