# Create a DevOps Daily Checklist

Create a new checklist for DevOps Daily on the topic: $ARGUMENTS

## Content Location & Format

- Save as: `content/checklists/<topic-slug>.json`
- Format: JSON

## Checklist Structure

```json
{
  "id": "<checklist-slug>",
  "slug": "<checklist-slug>",
  "title": "<Checklist Title>",
  "description": "<1-2 sentences about what this checklist covers>",
  "category": "<Category Name>",
  "difficulty": "beginner|intermediate|advanced",
  "estimatedTime": "<N-N minutes>",
  "tags": ["tag1", "tag2", "tag3"],
  "items": []
}
```

## Item Structure

```json
{
  "id": "<kebab-case-item-id>",
  "title": "<Short actionable title>",
  "description": "<Why this matters and what to do — 1-3 sentences>",
  "critical": true|false,
  "codeBlocks": [
    {
      "language": "bash|yaml|json|hcl|dockerfile|python",
      "label": "<Human-readable label for the code block>",
      "code": "<Actual command or config to implement this item>"
    }
  ]
}
```

## Design Guidelines

- **10-20 items** per checklist
- Mark security-critical or high-impact items as `critical: true`
- Every item should have at least one `codeBlock` showing how to implement or verify it
- Items should be actionable — "Enable X" not "Consider X"
- Order items by priority/importance
- Group related items together
- `description` should explain WHY, not just WHAT

## Checklist

- [ ] All items have unique IDs
- [ ] Critical items are marked appropriately
- [ ] Code blocks have correct language identifiers
- [ ] Items are ordered by priority
- [ ] Description explains the "why"
