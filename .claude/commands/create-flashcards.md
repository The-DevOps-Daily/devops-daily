# Create DevOps Daily Flashcards

Create a new flashcard deck for DevOps Daily on the topic: $ARGUMENTS

## Content Location & Format

- Save as: `content/flashcards/<topic>-<subtopic>.json`
- Format: JSON

## Flashcard Deck Structure

```json
{
  "id": "<deck-slug>",
  "title": "<Deck Title>",
  "description": "<1-2 sentences about what this deck covers>",
  "category": "<Category Name>",
  "icon": "<Lucide Icon Name>",
  "difficulty": "beginner|intermediate|advanced",
  "estimatedTime": "<N minutes>",
  "cardCount": 0,
  "theme": {
    "primaryColor": "<color>",
    "gradientFrom": "from-<color>-<shade>",
    "gradientTo": "to-<color>-<shade>"
  },
  "cards": []
}
```

### Theme Colors — same conventions as quizzes:
- Docker/Cloud: blue, Kubernetes: purple, Terraform: purple/pink
- AWS: orange, CI/CD: emerald, Git: orange/red, Linux: gray
- Security: red, Monitoring: amber, DevOps: green, Python: green

## Card Structure

```json
{
  "id": "<kebab-case-id>",
  "front": "<Question or term — concise, clear>",
  "back": "<Answer or definition — thorough but scannable>",
  "category": "<Sub-category within the deck>",
  "tags": ["tag1", "tag2"]
}
```

## Card Design Guidelines

- **Front**: One clear question or term. Keep it short and specific.
- **Back**: Complete but concise answer. Can include code snippets, commands, or key points.
- Group cards by `category` sub-topic for logical flow
- **12-20 cards** per deck is the sweet spot
- `cardCount` must match the actual number of cards
- Mix of concept cards, command cards, and "when to use" cards
- Avoid yes/no questions — ask "what", "how", "when", "why"

## Checklist

- [ ] cardCount matches actual card count
- [ ] All cards have unique IDs
- [ ] Front is concise, back is thorough
- [ ] Cards are grouped by category
- [ ] Theme colors follow conventions
- [ ] difficulty matches card content complexity
