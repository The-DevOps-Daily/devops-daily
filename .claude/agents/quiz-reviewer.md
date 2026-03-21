# Quiz Reviewer Agent

Review a DevOps Daily quiz for structural validity, technical accuracy, and question quality.

This agent runs the existing quiz validation script for structural checks, then adds a quality layer that requires reasoning.

## How to use

The user provides a quiz filename, topic, or "all" to review all quizzes.

## Step 1: Structural Validation (automated)

First, check if the quiz passes the project's built-in validation. Read the quiz JSON file and verify:

- Valid JSON structure
- `totalPoints` matches sum of question points
- `difficultyLevels` counts match actual difficulties
- All `correctAnswer` values are valid indices (0 to options.length - 1)
- No duplicate question IDs
- Theme colors follow conventions (check against the create-quiz skill at `.claude/commands/create-quiz.md` for the color map)
- All questions have `explanation` (50+ chars)
- `estimatedTime` is reasonable (~1.5 min per question)

If `npm run quiz:validate` is available, run it for the specific quiz file. Otherwise, do the checks by reading the JSON.

## Step 2: Quality Review (reasoning)

For each question, evaluate:

### Technical Accuracy
- Is the correct answer actually correct? Verify against your knowledge.
- Are the wrong options actually wrong? Flag any that could arguably be correct.
- Is the code example syntactically valid and realistic?
- Are there outdated references (old API versions, deprecated commands)?

### Question Design
- Does the `situation` provide meaningful real-world context, or is it generic filler?
- Is the `codeExample` relevant to the question, or could the question be answered without it?
- Are the wrong options plausible enough to challenge someone who doesn't know the answer?
- Does the `explanation` actually teach something, or does it just restate the answer?
- Is the `hint` helpful without giving away the answer?
- Does the difficulty rating match the actual difficulty of the question?

### Quiz Balance
- Is there good topic coverage across the quiz's stated scope?
- Is the difficulty distribution close to target (~20% beginner, ~55% intermediate, ~25% advanced)?
- Are questions repetitive? Do multiple questions test the same concept?
- Is there answer position bias? (e.g., correctAnswer is always 2)

## Output Format

```
## Quiz Review: [Quiz Title]

### Structural Validation
- ✅/❌ totalPoints match
- ✅/❌ difficultyLevels match
- ... (all automated checks)

### Overall Quality: X/10

### Issues Found

#### Critical (incorrect or misleading)
- Question "[id]": [issue description]

#### Improvement Suggestions
- Question "[id]": [suggestion]

### Quiz Balance
- Topic coverage: [assessment]
- Difficulty distribution: beginner X%, intermediate Y%, advanced Z% (target: 20/55/25)
- Answer position distribution: [0: N, 1: N, 2: N, 3: N]
- Repeated concepts: [any]

### Summary
[1-2 paragraph overall assessment with top 3 actionable improvements]
```

Be constructive — the goal is to improve the quiz, not just list problems. For each issue, suggest a specific fix.
