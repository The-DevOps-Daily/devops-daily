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

Create a full quiz with 10+ questions on a topic not yet covered. Check `content/quizzes/` first so you do not pick a topic that already has a quiz.

**File:** `content/quizzes/your-topic-quiz.json`

```json
{
  "id": "nginx-quiz",
  "title": "Nginx Quiz",
  "description": "Test your Nginx knowledge: server blocks, reverse proxying, TLS, and caching.",
  "category": "Networking",
  "icon": "Network",
  "totalPoints": 10,
  "theme": {
    "primaryColor": "green",
    "gradientFrom": "from-green-500",
    "gradientTo": "to-emerald-600"
  },
  "metadata": {
    "estimatedTime": "15-20 minutes",
    "difficultyLevels": {
      "beginner": 1,
      "intermediate": 0,
      "advanced": 0
    },
    "createdDate": "2026-10-01"
  },
  "questions": [
    {
      "id": "nginx-config-test",
      "title": "Testing a Config Change",
      "description": "Which command checks the Nginx configuration for errors without reloading it?",
      "options": ["nginx -t", "nginx -s reload", "nginx -v", "systemctl status nginx"],
      "correctAnswer": 0,
      "explanation": "nginx -t parses the configuration and reports errors without touching the running server. Run it before nginx -s reload.",
      "difficulty": "beginner",
      "points": 10
    }
  ]
}
```

The `id` must match the file name without `.json`. Each question uses the same fields as on [Day 3](/hacktoberfest/day-3). Keep `totalPoints` equal to the sum of the question points, and keep each count in `metadata.difficultyLevels` equal to the number of questions at that level. Then check your quiz:

```bash
pnpm test tests/quiz-validation.test.ts
pnpm quiz:validate
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

Check existing games for the pattern - they use React, Framer Motion, and Tailwind CSS. A new game touches these files (replace `your-game` with your game's slug):

1. `components/games/your-game.tsx`: the game component.
2. `lib/games.ts`: add an entry to the `games` array with `id: 'your-game'`, `href: '/games/your-game'`, a `description` of at least 50 characters, `tags`, and a `createdAt` date.
3. `app/games/your-game/page.tsx`: the page for the game.
4. `components/games/game-component-registry.ts`: import your component and add it to `GAME_COMPONENTS` under the same slug. The embed route uses this.
5. `public/images/games/your-game-og.png`: a 1200x630 PNG social image.

Then run the game registry check. It fails if the `lib/games.ts` entry is incomplete, or if the page, the component registry entry, or the social image is missing:

```bash
pnpm validate:games
```

## Submit Your PR

```bash
git checkout -b hacktoberfest/bonus-description
git add .
git commit -m "feat: [description of what you built]"
git push origin hacktoberfest/bonus-description
```

## Share It

> "Completed all 8 days of the @thedevopsdaily Hacktoberfest challenge! For the bonus I built [what you built]. #Hacktoberfest #DevOpsDaily #OpenSource"
