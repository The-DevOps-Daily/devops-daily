---
title: 'Day 4 - Add a Flashcard'
day: 4
excerpt: 'Create 1-2 flashcards to help others study DevOps concepts.'
difficulty: 'Beginner'
time: '5 min'
category: 'Content'
tags:
  - hacktoberfest
  - flashcards
  - learning
---

## What You'll Do

Add 1-2 flashcards to an existing [flashcard set](/flashcards). Think of a DevOps concept you wish someone had explained to you simply.

## Step by Step

### 1. Pick a flashcard set

Browse `content/flashcards/` and pick a set that matches your knowledge. For example, `docker-fundamentals.json` or `kubernetes-basics.json`.

### 2. Add your flashcard

Add a new object to the `cards` array:

```json
{
  "front": "What is a Kubernetes Pod?",
  "back": "The smallest deployable unit in Kubernetes. A pod wraps one or more containers that share storage and network. Pods are ephemeral - they can be created, destroyed, and replaced at any time."
}
```

**Tips for good flashcards:**
- Keep the front short and specific (one question or term)
- Make the back concise but complete
- Include a practical detail or example when possible

### 3. Preview locally

```bash
pnpm dev
# Visit http://localhost:3000/flashcards
```

### 4. Submit your PR

```bash
git checkout -b hacktoberfest/add-flashcard
git add content/flashcards/
git commit -m "Add flashcard to [set-name]"
git push origin hacktoberfest/add-flashcard
```

## Share It

> "Here's a DevOps concept everyone should know - just added it as a flashcard on @thedevopsdaily! #Hacktoberfest #DevOpsDaily"
