---
title: 'Day 1 - Add Yourself to the Experts Directory'
day: 1
excerpt: 'Create your profile on DevOps Daily. Get a public page with a backlink to your site.'
difficulty: 'Beginner'
time: '5 min'
category: 'Profile'
tags:
  - hacktoberfest
  - profile
  - experts
---

## What You'll Do

Add yourself to the [DevOps Experts Directory](/experts). You'll get a public profile page on DevOps Daily with a link back to your own website.

## Step by Step

### 1. Create your profile file

Create a new Markdown file at `content/experts/your-name.md`. The file name must match the `slug` field. The slug can only use lowercase letters, numbers, and dashes.

```markdown
---
name: 'Your Name'
slug: 'your-name'
title: 'DevOps Engineer'
bio: 'A short bio about yourself and your experience.'
avatar: '/images/experts/your-name.jpg'
specialties:
  - Docker
  - Kubernetes
  - Terraform
  - CI/CD
availability: 'Open to freelance work'
location: 'City, Country'
website: 'https://yoursite.com'
---

## About Me

A few sentences about what you work on and what you can help with.
```

Two things are required: at least one contact field (`website`, `email`, `github`, or `linkedin`), and some text in the body below the frontmatter.

The profile page shows your `website` as a link. You can also add `email`, which shows as a Contact button, so only add it if you want it to be public. The `github` and `linkedin` fields are optional and the page does not show them yet.

### 2. Add your avatar (optional)

Add a profile photo to `public/images/experts/your-name.jpg`. Use a square image, ideally 400x400px or larger. If you skip this, remove the `avatar` line and the page shows your initial instead.

### 3. Check and preview locally

```bash
pnpm test tests/expert-validation.test.ts
pnpm dev
# Visit http://localhost:3000/experts/your-name
```

### 4. Submit your PR

```bash
git checkout -b hacktoberfest/add-your-name
git add content/experts/your-name.md public/images/experts/your-name.jpg
git commit -m "Add [Your Name] to experts directory"
git push origin hacktoberfest/add-your-name
```

Leave out the image path if you did not add an avatar. Then open a pull request on GitHub.

## Share It

Post your new expert profile on social media!

> "I just added myself to the @thedevopsdaily Experts Directory as part of the Hacktoberfest challenge! Check out my profile: devops-daily.com/experts #Hacktoberfest #DevOpsDaily"
