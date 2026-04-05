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

Browse `content/quizzes/` and pick a quiz file that matches your expertise. For example, `docker-quiz.json` or `kubernetes-quiz.json`.

### 2. Add your question

Add a new object to the `questions` array:

```json
{
  "question": "What is the default network driver in Docker?",
  "options": [
    "bridge",
    "host",
    "overlay",
    "none"
  ],
  "correct": 0,
  "explanation": "The bridge driver is Docker's default network driver. It creates a private internal network on the host, allowing containers to communicate with each other."
}
```

**Tips for good questions:**
- Make all options plausible (no joke answers)
- Write a clear explanation for the correct answer
- Focus on practical knowledge, not trivia

### 3. Validate your JSON

Make sure the file is valid JSON. You can check with:

```bash
cat content/quizzes/your-quiz.json | python3 -m json.tool > /dev/null
```

### 4. Submit your PR

```bash
git checkout -b hacktoberfest/add-quiz-question
git add content/quizzes/
git commit -m "Add quiz question to [quiz-name]"
git push origin hacktoberfest/add-quiz-question
```

## Share It

> "Just contributed a quiz question to @thedevopsdaily! Can you get it right? #Hacktoberfest #DevOpsDaily"
