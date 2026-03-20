# Create DevOps Daily Interview Questions

Create new interview questions for DevOps Daily on the topic: $ARGUMENTS

## Content Location & Format

- Save as: `content/interview-questions/<topic-slug>.json` (one file per question)
- Format: JSON

## Question Structure

```json
{
  "id": "<question-slug>",
  "slug": "<question-slug>",
  "title": "<Short Title>",
  "question": "<The interview question as it would be asked>",
  "answer": "<Direct, comprehensive answer — what a strong candidate would say>",
  "explanation": "<Why this question matters for DevOps professionals — interviewer context>",
  "category": "<Category Name>",
  "difficulty": "beginner|intermediate|advanced",
  "tier": "junior|mid|senior",
  "tags": ["tag1", "tag2", "tag3"],
  "codeExamples": [
    {
      "language": "bash|yaml|json|etc",
      "label": "<What this code demonstrates>",
      "code": "<Practical code example>"
    }
  ],
  "followUpQuestions": [
    "Natural follow-up an interviewer might ask",
    "Deeper dive question"
  ],
  "commonMistakes": [
    "What weak candidates often say wrong",
    "Common misconception"
  ],
  "relatedTopics": ["topic1", "topic2"]
}
```

## Design Guidelines

- `answer` should be what a strong candidate would say — thorough but not rambling
- `explanation` is for the interviewer — why ask this, what to listen for
- Include 1-3 `codeExamples` that demonstrate practical knowledge
- `followUpQuestions` should naturally extend the conversation (2-4)
- `commonMistakes` highlight what to watch out for (2-3)
- `tier` indicates the seniority level this question targets
- `difficulty` is about the question complexity, `tier` is about who gets asked

## Checklist

- [ ] Question reads naturally as spoken
- [ ] Answer is thorough but not a textbook chapter
- [ ] Code examples are practical and correct
- [ ] Follow-up questions flow naturally
- [ ] Common mistakes are realistic
- [ ] Tier and difficulty are appropriate
