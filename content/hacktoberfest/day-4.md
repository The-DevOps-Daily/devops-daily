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

Browse `content/flashcards/` and pick a set that matches your knowledge. For example, `docker-essentials.json` or `kubernetes-basics.json`. Read the cards that are already there so yours does not repeat one.

### 2. Add your flashcard

Add a new object to the end of the `cards` array:

```json
{
  "id": "job-definition",
  "front": "What is a Kubernetes Job?",
  "back": "A Job runs one or more Pods until a set number of them finish successfully. Use it for one-off tasks such as database migrations or batch processing. A CronJob creates Jobs on a schedule.",
  "category": "Workloads",
  "tags": ["job", "batch", "workloads"]
}
```

- `id` must be unique inside the set. The flashcard page uses it to track which cards you know, so two cards with the same `id` break the progress count.
- `category` groups related cards. Reuse a category that the set already has when one fits.
- `tags` is a short list of keywords in lowercase.

**Tips for good flashcards:**

- Keep the front short and specific (one question or term)
- Make the back concise but complete
- Include a practical detail or example when possible

### 3. Update the card count

At the top of the same file, increase `cardCount` by the number of cards you added. The flashcards page shows this number.

### 4. Preview locally

```bash
pnpm dev
# Visit http://localhost:3000/flashcards
```

### 5. Submit your PR

```bash
git checkout -b hacktoberfest/add-flashcard
git add content/flashcards/your-set.json
git commit -m "Add flashcard to [set-name]"
git push origin hacktoberfest/add-flashcard
```

## Share It

> "Here's a DevOps concept everyone should know - just added it as a flashcard on @thedevopsdaily! #Hacktoberfest #DevOpsDaily"
