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

Add yourself to the [DevOps Experts Directory](/experts). You'll get a public profile page on DevOps Daily with links back to your own site, GitHub, and LinkedIn.

## Step by Step

### 1. Create your profile file

Create a new JSON file at `content/experts/your-name.json`:

```json
{
  "name": "Your Name",
  "slug": "your-name",
  "title": "DevOps Engineer",
  "bio": "A short bio about yourself and your experience...",
  "avatar": "/images/experts/your-name.jpg",
  "specialties": ["Docker", "Kubernetes", "Terraform", "CI/CD"],
  "location": "City, Country",
  "availableForHire": true,
  "links": {
    "website": "https://yoursite.com",
    "github": "https://github.com/your-username",
    "linkedin": "https://linkedin.com/in/your-profile",
    "twitter": "https://x.com/your-handle"
  }
}
```

### 2. Add your avatar

Add a profile photo to `public/images/experts/your-name.jpg`. Use a square image, ideally 400x400px or larger.

### 3. Preview locally

```bash
pnpm dev
# Visit http://localhost:3000/experts
```

### 4. Submit your PR

```bash
git checkout -b hacktoberfest/add-your-name
git add content/experts/your-name.json public/images/experts/your-name.jpg
git commit -m "Add [Your Name] to experts directory"
git push origin hacktoberfest/add-your-name
```

Then open a pull request on GitHub.

## Share It

Post your new expert profile on social media!

> "I just added myself to the @thedevopsdaily Experts Directory as part of the Hacktoberfest challenge! Check out my profile: devops-daily.com/experts #Hacktoberfest #DevOpsDaily"
