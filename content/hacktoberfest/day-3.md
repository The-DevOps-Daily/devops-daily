---
title: 'Day 3 - Add a Quiz Question'
day: 3
excerpt: 'Contribute a multiple-choice question to an existing quiz.'
difficulty: 'Beginner'
time: '5 min'
category: 'Content'
tags:
  - hacktoberfest
  - quiz
  - learning
---

## What You'll Do

Add 1 multiple-choice question to an existing [quiz](/quizzes). Pick any topic you know well and write a question that helps others learn.

## Step by Step

### 1. Pick a quiz

Browse `content/quizzes/` and pick a quiz file that matches your expertise. For example, `docker-quiz.json` or `kubernetes-quiz.json`. Read a few of its questions so yours does not repeat one.

### 2. Add your question

Add a new object to the end of the `questions` array:

```json
{
  "id": "default-network-driver",
  "title": "Default Network Driver",
  "description": "Which network driver does Docker use when you start a container without --network?",
  "options": ["bridge", "host", "overlay", "none"],
  "correctAnswer": 0,
  "explanation": "bridge is Docker's default network driver. It creates a private internal network on the host, so containers on it can talk to each other.",
  "difficulty": "beginner",
  "points": 10
}
```

- `id` must be unique inside the quiz file. Use lowercase words and dashes.
- `title` is a short label, and `description` is the question itself.
- `correctAnswer` is the position of the right option, counting from 0.
- `difficulty` is `beginner`, `intermediate`, or `advanced`. Give it points like the other questions at the same level in that file.
- `situation`, `codeExample`, and `hint` are optional. Many questions use them, so copy the pattern if it fits.

**Tips for good questions:**

- Make all options plausible (no joke answers)
- Write a clear explanation for the correct answer
- Focus on practical knowledge, not trivia

### 3. Update the totals

At the top of the same file:

- Add your question's `points` to `totalPoints`.
- Add 1 to the matching level in `metadata.difficultyLevels`. For a beginner question, that is `beginner`.

### 4. Check your change

```bash
pnpm test tests/quiz-validation.test.ts
pnpm quiz:validate
```

The test checks the JSON and the question shape. `pnpm quiz:validate` also warns if `totalPoints` does not match the sum of the question points.

### 5. Submit your PR

```bash
git checkout -b hacktoberfest/add-quiz-question
git add content/quizzes/your-quiz.json
git commit -m "Add quiz question to [quiz-name]"
git push origin hacktoberfest/add-quiz-question
```

## Share It

> "Just contributed a quiz question to @thedevopsdaily! Can you get it right? #Hacktoberfest #DevOpsDaily"
