---
title: 'Day 8 (Bonus) - Build Something'
day: 8
excerpt: 'Go big! Create a new quiz, comparison, checklist, or game.'
difficulty: 'Advanced'
time: '30+ min'
category: 'Feature'
tags:
  - hacktoberfest
  - advanced
  - bonus
---

## What You'll Do

This is the bonus challenge for contributors who want to go further. Pick one of the options below and build something new for DevOps Daily.

## Option A: Create a New Quiz

Create a full quiz with 10+ questions on a topic not yet covered.

**File:** `content/quizzes/your-topic-quiz.json`

```json
{
  "title": "Ansible Quiz",
  "slug": "ansible-quiz",
  "description": "Test your Ansible knowledge",
  "category": "DevOps",
  "difficulty": "intermediate",
  "questions": [
    {
      "question": "Your question here?",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "Why A is correct..."
    }
  ]
}
```

## Option B: Write a Tool Comparison

Create a side-by-side comparison of two DevOps tools.

**File:** `content/comparisons/tool-a-vs-tool-b.json`

Check existing comparisons in `content/comparisons/` for the JSON structure. Include features, pros/cons, use cases, and a verdict.

## Option C: Build a Checklist

Create a production-ready checklist for a DevOps task.

**File:** `content/checklists/your-checklist.json`

Check existing checklists in `content/checklists/` for the format.

## Option D: Contribute a Game or Simulator

This is the most advanced option. Build an interactive React component in `components/games/`.

Check existing games for the pattern - they use React, Framer Motion, and Tailwind CSS. Register your game in `lib/games.ts` and create a page in `app/games/your-game/page.tsx`.

## Submit Your PR

```bash
git checkout -b hacktoberfest/bonus-description
git add .
git commit -m "feat: [description of what you built]"
git push origin hacktoberfest/bonus-description
```

## Share It

> "Completed all 8 days of the @thedevopsdaily Hacktoberfest challenge! For the bonus I built [what you built]. #Hacktoberfest #DevOpsDaily #OpenSource"
