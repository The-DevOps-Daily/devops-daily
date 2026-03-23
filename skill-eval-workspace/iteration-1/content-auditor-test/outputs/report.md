## Content Audit Report

### Summary
- Quizzes scanned: 26 (85 issues found)
- Exercises scanned: 15 (12 issues found)

### Critical Issues (fix immediately)

#### 13 quizzes have incorrect `totalPoints` values

The `totalPoints` field does not match the sum of individual question `points` values. This likely causes incorrect score calculations displayed to users.

<details>
<summary>Affected files</summary>

| File | Declared | Actual Sum | Difference |
|------|----------|------------|------------|
| aws-quiz.json | 135 | 181 | -46 |
| cicd-pipelines-quiz.json | 96 | 110 | -14 |
| cloud-cost-optimization-quiz.json | 135 | 151 | -16 |
| devops-quiz.json | 125 | 155 | -30 |
| helm-charts-quiz.json | 140 | 147 | -7 |
| incident-response-quiz.json | 130 | 150 | -20 |
| kubernetes-operators-quiz.json | 210 | 208 | +2 |
| linux-quiz.json | 140 | 187 | -47 |
| monitoring-basics-quiz.json | 100 | 99 | +1 |
| monitoring-observability-quiz.json | 108 | 126 | -18 |
| python-quiz.json | 125 | 148 | -23 |
| sql-quiz.json | 150 | 197 | -47 |
| system-design-quiz.json | 102 | 118 | -16 |

</details>

#### 7 exercises have invalid category slugs

These category slugs do not match any file in `content/categories/`. This may break category filtering or cause rendering errors.

<details>
<summary>Affected files</summary>

| File | Invalid Slug |
|------|-------------|
| ansible-web-server-automation.json | `ansible` |
| gitops-argocd-deployment.json | `gitops` |
| infrastructure-security-vault-sops.json | `security` |
| microservices-observability-opentelemetry.json | `observability` |
| nginx-load-balancing-reverse-proxy.json | `infrastructure` |
| prometheus-grafana-monitoring.json | `monitoring` |
| redis-caching-strategies.json | `database` |

Valid category slugs are: `aws`, `bash`, `ci-cd`, `cloud`, `devops`, `docker`, `finops`, `git`, `kubernetes`, `linux`, `networking`, `python`, `terraform`

</details>

### Warnings (should fix)

#### 26 quizzes missing `difficultyLevels` field

No quizzes have the `difficultyLevels` metadata field, yet all quizzes contain questions with `difficulty` values (beginner, intermediate, advanced). The counts cannot be validated without this field. If the field is expected, it should be added to all quiz files.

#### 5 exercises have fewer than 3 troubleshooting items

The `troubleshooting` array should contain at least 3 items to adequately help users debug common problems.

<details>
<summary>Affected files</summary>

| File | Count |
|------|-------|
| ci-cd-github-actions.json | 0 |
| docker-multi-stage-build.json | 2 |
| kubernetes-hpa-lab.json | 0 |
| prometheus-grafana-monitoring.json | 0 |
| terraform-aws-vpc.json | 0 |

</details>

### Info (nice to have)

- All 26 quizzes have valid JSON.
- All 15 exercises have valid JSON.
- All quiz questions have `correctAnswer` values within the valid 0-3 range.
- No duplicate question IDs found in any quiz.
- All quiz question explanations meet the 50+ character minimum.
- All exercise steps have the required `id`, `title`, and `description` fields.
- All exercises have 3+ `completionCriteria` items.
</details>
