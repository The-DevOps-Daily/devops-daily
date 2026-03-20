# Create a DevOps Daily Exercise

Create a new hands-on exercise for DevOps Daily on the topic: $ARGUMENTS

## Content Location & Format

- Save as: `content/exercises/<exercise-slug>.json`
- Format: JSON

## Exercise Structure

```json
{
  "id": "<exercise-slug>",
  "title": "<Descriptive Exercise Title>",
  "description": "<2-3 sentences describing what the learner will build/accomplish>",
  "category": {
    "name": "<Category Name>",
    "slug": "<category-slug>"
  },
  "difficulty": "beginner|intermediate|advanced",
  "estimatedTime": "<N minutes>",
  "technologies": ["Tech1", "Tech2", "Tech3"],
  "prerequisites": [
    "Prerequisite 1",
    "Prerequisite 2"
  ],
  "learningObjectives": [
    "Objective 1 — use action verbs (Create, Configure, Implement, Debug)",
    "Objective 2",
    "Objective 3"
  ],
  "environment": "cloud|local|browser|container",
  "icon": "<Lucide Icon Name>",
  "publishedAt": "<ISO 8601 timestamp>",
  "author": {
    "name": "DevOps Daily Team",
    "slug": "devops-daily-team"
  },
  "tags": ["Tag1", "Tag2"],
  "featured": false,
  "steps": [],
  "completionCriteria": [],
  "troubleshooting": [],
  "resources": []
}
```

### Valid Categories
- Docker (docker), Kubernetes (kubernetes), Terraform (terraform), AWS (aws)
- Linux (linux), Git (git), CI/CD (ci-cd), DevOps (devops)
- Cloud (cloud), Python (python), Bash (bash), Networking (networking)

### Environment Types
- `local` — runs on learner's machine (Docker, CLI tools)
- `cloud` — requires cloud provider access (AWS, GCP, Azure)
- `container` — runs entirely in containers
- `browser` — can be done in browser-based tools

## Step Structure

Each step has required and optional fields:

```json
{
  "id": "<kebab-case-step-id>",
  "title": "<Step Title>",
  "description": "<Clear description of what to do and WHY>",
  "commands": ["command-to-run-1", "command-to-run-2"],
  "codeExample": "<Full code/config to create or modify — use \\n for newlines>",
  "expectedOutput": "<What the learner should see when it works>",
  "hints": ["Hint if they get stuck", "Another helpful tip"],
  "validationCriteria": ["How to verify this step succeeded", "What to check"]
}
```

- **Required**: `id`, `title`, `description`
- **Optional**: `commands`, `codeExample`, `expectedOutput`, `hints`, `validationCriteria`
- Include as many optional fields as make sense for the step — not every step needs commands or code (e.g., a monitoring/observation step may only need description)
```

## Exercise Design Guidelines

### Step Quality Rules
1. Each step should have a **single clear goal** — don't combine too many actions
2. `description` explains both WHAT to do and WHY (context matters for learning)
3. `commands` are the exact commands to run — no ambiguity
4. `codeExample` shows complete, copy-pasteable code/config
5. `expectedOutput` helps learners verify they're on track
6. `hints` help when stuck without giving away the answer
7. `validationCriteria` are concrete, checkable outcomes

### Exercise Composition
- **6-10 steps** for a typical exercise
- Start with setup/scaffolding, end with verification/cleanup
- Progressive complexity — each step builds on the previous
- Include a "verify it works" step near the end
- `estimatedTime` should be realistic (not optimistic)

### Difficulty Guidelines
- **Beginner** (30-45 min): Guided, step-by-step, one technology
- **Intermediate** (60-90 min): Multiple technologies, some problem-solving
- **Advanced** (90-120 min): Architecture decisions, debugging, production scenarios

### Troubleshooting Section
Include 3-5 common issues:

```json
{
  "troubleshooting": [
    {
      "issue": "Permission denied when running docker commands",
      "solution": "Add your user to the docker group: sudo usermod -aG docker $USER, then log out and back in"
    }
  ]
}
```

### Completion Criteria
List 3-5 high-level outcomes that prove the exercise is complete:

```json
{
  "completionCriteria": [
    "Web server responds on port 443 with valid SSL",
    "Firewall rules allow only ports 22, 80, 443",
    "Application deploys with zero downtime"
  ]
}
```

### Resources Section (optional but recommended)

Include links to documentation, tutorials, and tools:

```json
{
  "resources": [
    {
      "title": "Official Documentation",
      "url": "https://docs.example.com",
      "type": "documentation",
      "external": true
    },
    {
      "title": "Related Exercise",
      "url": "/exercises/related-slug",
      "type": "tutorial",
      "external": false
    }
  ]
}
```

Valid resource types: `documentation`, `tutorial`, `tool`, `reference`

## OG Image

After creating the exercise, remind the user to generate the OG image:
```bash
npm run generate:images:parallel
npm run convert:svg-to-png:parallel
```

## Checklist

- [ ] All steps have id, title, description; optional fields included where relevant
- [ ] Steps are in logical progressive order
- [ ] technologies list matches what's actually used
- [ ] prerequisites are accurate
- [ ] learningObjectives use action verbs
- [ ] troubleshooting covers common failure modes
- [ ] completionCriteria are verifiable
- [ ] estimatedTime is realistic
- [ ] Category matches an existing category
