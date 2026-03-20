# Create a DevOps Daily Quiz

Create a new quiz for DevOps Daily on the topic: $ARGUMENTS

## Content Location & Format

- Save as: `content/quizzes/<topic>-quiz.json`
- Format: JSON

## Quiz Structure

```json
{
  "id": "<topic>-quiz",
  "title": "<Topic> Quiz",
  "description": "<1-2 sentences describing what the quiz tests>",
  "category": "<Category Name>",
  "icon": "<Lucide Icon Name>",
  "totalPoints": 0,
  "theme": {
    "primaryColor": "<color>",
    "gradientFrom": "from-<color>-<shade>",
    "gradientTo": "to-<color>-<shade>"
  },
  "metadata": {
    "estimatedTime": "<N-N minutes>",
    "difficultyLevels": {
      "beginner": 0,
      "intermediate": 0,
      "advanced": 0
    },
    "createdDate": "<YYYY-MM-DD>"
  },
  "questions": []
}
```

## Theme Color Conventions

Match the color to the technology/domain:
- **Docker/Cloud**: blue → from-blue-500, to-cyan-600
- **Kubernetes**: purple → from-purple-500, to-indigo-600
- **Terraform**: purple → from-purple-600, to-pink-600
- **AWS**: orange → from-orange-500, to-amber-600
- **CI/CD**: emerald → from-emerald-500, to-teal-600
- **Git**: orange → from-orange-500, to-red-600
- **Linux**: gray → from-gray-600, to-slate-700
- **Security**: red → from-red-500, to-orange-600
- **Monitoring**: amber/purple → from-amber-500, to-orange-600
- **DevOps General**: green → from-green-500, to-emerald-600
- **Python**: green → from-green-500, to-emerald-600
- **System Design**: indigo → from-indigo-500, to-purple-600

## Question Structure

Each question MUST follow this format:

```json
{
  "id": "<kebab-case-id>",
  "title": "<Short Question Title>",
  "description": "<Full question text>",
  "situation": "<Real-world scenario that gives context — this is what makes our quizzes unique>",
  "codeExample": "<Code snippet, config, or command output relevant to the question (use \\n for newlines)>",
  "options": [
    "Option A — be specific, not vague",
    "Option B — make wrong answers plausible",
    "Option C — avoid obviously wrong choices",
    "Option D — all options should be similar length"
  ],
  "correctAnswer": 0,
  "points": 12,
  "difficulty": "beginner|intermediate|advanced",
  "explanation": "<Detailed explanation of WHY the correct answer is right and why others are wrong>",
  "hint": "<Subtle hint that guides thinking without giving the answer away>"
}
```

## Question Design Guidelines

### Difficulty & Points
- **Beginner** (10-12 points): Fundamental concepts, basic commands, core terminology
- **Intermediate** (15 points): Applied knowledge, combining concepts, real scenarios
- **Advanced** (18-20 points): Edge cases, debugging, architecture decisions, production issues

### Question Quality Rules
1. Every question should have a `situation` field — a real-world scenario (e.g., "You're debugging a production outage..." or "Your team is setting up CI/CD..."). These are technically optional in the schema but ALL existing quizzes include them — they're what makes our quizzes unique.
2. Every question should have a `codeExample` — show actual code, config, or command output. Also technically optional but included in all existing quizzes.
3. Wrong options must be **plausible** — they should represent common misconceptions
4. `explanation` should teach, not just state the answer — explain the "why"
5. Questions should test understanding, not memorization
6. Avoid "All of the above" or "None of the above" options

### Quiz Composition
- **15 questions minimum** for a full quiz
- Mix of difficulties: ~20% beginner, ~55% intermediate, ~25% advanced
- Questions should progress from easier to harder
- Cover breadth of the topic, not just one subtopic
- `totalPoints` must equal the sum of all question points
- `difficultyLevels` counts must match actual question counts
- `estimatedTime` ≈ 1.5 min per question

## Validation

After creating the quiz, run:
```bash
npm run quiz:validate
```

## Checklist

- [ ] All questions have situation + codeExample
- [ ] totalPoints matches sum of individual points
- [ ] difficultyLevels counts are accurate
- [ ] estimatedTime is reasonable
- [ ] correctAnswer index is valid (0-3)
- [ ] No duplicate question IDs
- [ ] Theme colors follow conventions
- [ ] Explanations teach, not just state answers
