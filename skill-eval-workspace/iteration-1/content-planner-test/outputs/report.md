## Content Plan: Terraform

### Current Coverage

- **65 posts** covering a wide range of Terraform topics
- **1 comprehensive guide** (Introduction to Terraform, 10 parts) published 2025-04-28
- **2 exercises** (AWS VPC - intermediate, DigitalOcean Droplet - beginner)
- **1 quiz** (Terraform Fundamentals, 7 questions across beginner/intermediate/advanced)
- **1 flashcard deck** (Terraform Basics, 16 cards, intermediate level)
- **1 checklist** (Terraform Repository Structure, beginner level)
- **1 dedicated interview question set** (Terraform State Management, intermediate/mid-tier)
- **2 related interview question sets** (Infrastructure as Code Patterns - mid-tier, Multi-Cloud Architecture - senior-tier) that reference Terraform

**Strong areas:**
- HCL language features (conditionals, loops, string manipulation, list operations) -- very deep coverage with 20+ posts
- Module patterns (outputs, inputs, cross-module references, git sources, environments) -- 10+ posts
- State management (migration, locking, remote backends, removal) -- well covered in posts, guide, and interview questions
- Troubleshooting and error resolution -- 10+ posts covering specific error messages
- AWS-specific integrations (VPC, Lambda, CloudWatch, RDS, Fargate, API Gateway, Secrets Manager, DynamoDB)
- The 10-part introductory guide is thorough, covering fundamentals through production patterns

**Weak areas:**
- No content on Terraform testing (terraform test, Terratest, checkov, tflint)
- No content on Terraform CI/CD pipelines (GitHub Actions, GitLab CI, Atlantis)
- No content on OpenTofu or the Terraform license change (BSL)
- No content on Terraform Cloud / Terraform Enterprise
- No content on security scanning or policy-as-code with Terraform (OPA, Sentinel)
- No content on Terraform CDK (CDKTF)
- No content on `import` blocks (Terraform 1.5+) or `moved` blocks (Terraform 1.1+)
- No content on Terraform stacks or ephemeral resources (newer features)
- No advanced-level exercises (only beginner and intermediate)
- Only 1 quiz with limited question count
- Only 1 interview question set directly about Terraform -- missing junior and senior tiers
- No GCP or Azure-focused exercises
- Posts date range is 2024-01 to 2025-06 -- some early posts may reference older Terraform versions

### Content Type Gaps

| Category | Posts | Guide | Quiz | Exercise | Flashcards | Checklist | Interview Qs |
|----------|-------|-------|------|----------|------------|-----------|--------------|
| Terraform | 65 | 1 (10 parts) | 1 | 2 | 1 | 1 | 1 (+2 related) |
| **Ideal** | **5+** | **1+** | **1+** | **1+** | **1+** | **1+** | **3+ (jr/mid/sr)** |
| **Status** | Well above target | Met | Met (but thin) | Met (but no advanced) | Met (but only basics) | Met (but only repo structure) | Partially met (missing jr + sr) |

### High Priority

1. **Interview Questions -- Terraform for Junior Engineers**
   - **Title:** "Terraform Fundamentals for Junior Engineers"
   - **Why:** The only dedicated Terraform interview Q is at mid-tier (state management). Junior candidates need questions on basic workflow (init/plan/apply), resource syntax, provider configuration, and variable types. Major gap for job-seekers.
   - **Priority:** High
   - **Difficulty to create:** Easy
   - **Prerequisites:** Guide: Introduction to Terraform (parts 1-4)
   - **Internal linking:** Links from terraform-basics flashcards, terraform-quiz, guide index

2. **Interview Questions -- Terraform for Senior Engineers**
   - **Title:** "Advanced Terraform Patterns for Senior Engineers"
   - **Why:** No senior-tier Terraform interview content. Should cover state architecture decisions, module design at scale, provider development, migration strategies, drift detection, and CI/CD pipeline design for IaC.
   - **Priority:** High
   - **Difficulty to create:** Medium
   - **Prerequisites:** Existing mid-tier interview questions, best-practices posts
   - **Internal linking:** Links from terraform-best-practices post, guide part 10 (production patterns)

3. **Post -- Terraform CI/CD: Running Terraform in GitHub Actions**
   - **Title:** "How to Run Terraform in GitHub Actions (Complete Pipeline)"
   - **Why:** CI/CD integration is one of the most common real-world needs and there is zero coverage. Every team using Terraform needs automated plan/apply workflows.
   - **Priority:** High
   - **Difficulty to create:** Medium
   - **Prerequisites:** Guide parts on state management and remote backends
   - **Internal linking:** Links from best-practices posts, initial-setup-of-terraform-backend, terraform-save-plan-apply-output-to-file

4. **Post -- Terraform Testing with terraform test**
   - **Title:** "How to Write Tests for Terraform with the Built-in Test Framework"
   - **Why:** `terraform test` (GA in Terraform 1.6+) is a critical feature with no coverage. Testing is a fundamental gap in the content.
   - **Priority:** High
   - **Difficulty to create:** Medium
   - **Prerequisites:** Guide fundamentals
   - **Internal linking:** Links from best-practices posts, experimenting-locally-with-terraform

5. **Checklist -- Terraform Security Best Practices**
   - **Title:** "Terraform Security Checklist"
   - **Why:** Only checklist is about repo structure. Security is a critical cross-cutting concern: state encryption, secret handling, least-privilege IAM, provider pinning, supply chain security. No security-focused Terraform content exists.
   - **Priority:** High
   - **Difficulty to create:** Medium
   - **Prerequisites:** minimum-aws-permissions-for-terraform, retrieve-secret-terraform-aws-secret-manager
   - **Internal linking:** Links from security-gates guide (which already mentions Terraform), minimum-aws-permissions post

### Medium Priority

6. **Exercise -- Terraform Module Development (Advanced)**
   - **Title:** "Build a Reusable Terraform Module with Validation and Testing"
   - **Why:** No advanced exercise exists. Module development is a key skill gap between intermediate and senior. Should cover input validation, output design, documentation, and testing.
   - **Priority:** Medium
   - **Difficulty to create:** Hard
   - **Prerequisites:** Guide parts 6-7 (variables, modules), module-related posts
   - **Internal linking:** Links from organize-terraform-modules-multiple-environments, terraform-provider-variable-sharing-modules

7. **Post -- OpenTofu vs Terraform: What You Need to Know**
   - **Title:** "OpenTofu vs Terraform: Differences, Migration, and Which to Choose"
   - **Why:** The Terraform BSL license change and OpenTofu fork are major ecosystem developments with no coverage. Engineers need to understand the differences for career and project decisions.
   - **Priority:** Medium
   - **Difficulty to create:** Medium
   - **Prerequisites:** General Terraform knowledge
   - **Internal linking:** Links from upgrade-terraform-to-specific-version, best-practices posts

8. **Quiz -- Terraform Advanced Scenarios**
   - **Title:** "Advanced Terraform Quiz: State, Modules, and Production Patterns"
   - **Why:** Current quiz has only 7 questions skewing beginner/intermediate. An advanced quiz would complement the existing one and serve senior-track learners.
   - **Priority:** Medium
   - **Difficulty to create:** Medium
   - **Prerequisites:** Full guide, state management posts
   - **Internal linking:** Links from guide part 10, best-practices posts

9. **Flashcards -- Terraform Functions and Expressions**
   - **Title:** "Terraform Functions and Expressions Flashcards"
   - **Why:** Current flashcard deck covers basics only. There are 20+ posts about HCL language features (conditionals, loops, string ops, list ops) that could be distilled into a reference flashcard deck.
   - **Priority:** Medium
   - **Difficulty to create:** Easy
   - **Prerequisites:** terraform-basics flashcards
   - **Internal linking:** Links from all HCL-related posts (conditionals, for_each, string concatenation, etc.)

10. **Post -- Terraform Import Blocks: The Modern Way to Import Resources**
    - **Title:** "How to Use Import Blocks in Terraform 1.5+ (Replacing terraform import)"
    - **Why:** Import blocks (Terraform 1.5+) and `moved` blocks (1.1+) are significant modern features. The existing import post only covers the CLI command. Declarative import is the recommended approach now.
    - **Priority:** Medium
    - **Difficulty to create:** Easy
    - **Prerequisites:** how-can-i-remove-a-resource-from-terraform-state, terraform-import-index-value-required-error
    - **Internal linking:** Links from state management posts, migrate-terraform-state

11. **Post -- Terraform with Azure: Managing Resources and State**
    - **Title:** "Getting Started with Terraform on Azure: Resources, State, and Authentication"
    - **Why:** Most AWS posts exist but Azure coverage is thin (only 1 post about state file in different subscription). Azure is a major cloud provider and needs basic how-to coverage.
    - **Priority:** Medium
    - **Difficulty to create:** Medium
    - **Prerequisites:** Guide fundamentals
    - **Internal linking:** Links from terraform-azure-state-file-different-subscription

12. **Guide -- Terraform CI/CD and Automation**
    - **Title:** "Automating Terraform: CI/CD Pipelines, Policy, and GitOps"
    - **Why:** The existing guide covers fundamentals only. A second guide focused on automation (GitHub Actions, GitLab CI, Atlantis, Spacelift, policy-as-code, drift detection) would serve the intermediate-to-advanced audience.
    - **Priority:** Medium
    - **Difficulty to create:** Hard
    - **Prerequisites:** Full Introduction to Terraform guide
    - **Internal linking:** Links from all CI/CD and best-practices posts

### Low Priority

13. **Post -- Terraform CDK (CDKTF): Writing Infrastructure in TypeScript/Python**
    - **Title:** "Introduction to CDKTF: Writing Terraform in TypeScript or Python"
    - **Why:** CDKTF is a niche but growing approach. Fills an awareness gap for developers who prefer general-purpose languages over HCL.
    - **Priority:** Low
    - **Difficulty to create:** Medium
    - **Prerequisites:** General Terraform knowledge
    - **Internal linking:** Links from best-practices posts

14. **Exercise -- Terraform on GCP**
    - **Title:** "Deploy a GCP Cloud Run Service with Terraform"
    - **Why:** Exercises cover AWS and DigitalOcean but not GCP. Rounds out multi-cloud exercise coverage.
    - **Priority:** Low
    - **Difficulty to create:** Medium
    - **Prerequisites:** Guide fundamentals, terraform-add-ssh-key-gcp-instance
    - **Internal linking:** Links from terraform-add-ssh-key-gcp-instance

15. **Post -- Terraform Stacks and Ephemeral Resources**
    - **Title:** "What Are Terraform Stacks? Understanding the New Orchestration Layer"
    - **Why:** Terraform Stacks (announced 2024) represent the future direction of multi-stack orchestration. Early coverage builds authority as the feature matures.
    - **Priority:** Low
    - **Difficulty to create:** Medium
    - **Prerequisites:** Guide parts on modules and environments
    - **Internal linking:** Links from organize-terraform-modules-multiple-environments, different-environments-in-terraform

16. **Post -- Migrating from Terraform to OpenTofu**
    - **Title:** "Step-by-Step Guide to Migrating from Terraform to OpenTofu"
    - **Why:** Practical companion to the comparison post. Useful for teams making the switch.
    - **Priority:** Low
    - **Difficulty to create:** Easy
    - **Prerequisites:** OpenTofu vs Terraform post (proposed #7)
    - **Internal linking:** Links from upgrade-terraform-to-specific-version, migrate-terraform-state

### Post Topic Clustering (for reference)

The 65 existing posts cluster into these subtopics:

| Subtopic | Count | Notes |
|----------|-------|-------|
| HCL Language (conditionals, loops, strings, lists, maps) | ~22 | Very strong |
| Modules (outputs, inputs, references, organization) | ~10 | Strong |
| State Management (migration, locking, backends, removal) | ~8 | Strong |
| Troubleshooting / Errors | ~8 | Strong |
| AWS Integrations (Lambda, VPC, RDS, Fargate, etc.) | ~8 | Strong on AWS |
| Project Organization (repo structure, splitting files, environments) | ~6 | Good |
| Best Practices | ~3 | Adequate |
| Provider Configuration (checksums, variables, init) | ~5 | Good |
| Environment Variables / Configuration | ~4 | Adequate |
| GCP / Azure | ~2 | Weak -- mostly AWS-focused |
| Testing | 0 | Missing |
| CI/CD Automation | 0 | Missing |
| Security | 0 | Missing (only IAM permissions post tangentially) |
| Terraform Cloud / Enterprise | 0 | Missing |
| OpenTofu | 0 | Missing |
