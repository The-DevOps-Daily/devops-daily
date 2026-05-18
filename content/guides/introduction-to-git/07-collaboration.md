---
title: 'Collaboration Workflows'
order: 7
description: 'Common Git collaboration workflows: centralized, feature branch, GitFlow, and trunk-based. How to pick one for your team and avoid merge-conflict pain.'
---

Working effectively in a team requires more than just knowing Git commands. You need established workflows that help your team collaborate smoothly. In this section, we'll explore popular Git workflows and best practices for team collaboration.

## Why Git Workflows Matter

A Git workflow defines how team members coordinate their work. A good workflow should:

- Make collaboration predictable and organized
- Minimize merge conflicts and integration problems
- Support code quality through reviews
- Allow parallel development
- Maintain a stable production codebase
- Adapt to your team's size and needs

## Common Git Workflows

There are several established Git workflows, each with its own advantages. Let's explore the most popular ones.

### 1. Centralized Workflow

This is the simplest workflow, similar to older centralized version control systems:

- Everyone clones from the same central repository
- Everyone works on the main branch
- Changes are pulled and pushed directly to main

**Advantages**:

- Simple to understand and implement
- Minimal branches to manage
- Works well for very small teams

**Drawbacks**:

- No isolation for new features or experiments
- Conflicts can occur frequently
- Difficult to maintain a stable main branch
- Doesn't scale well for larger teams

**When to use it**:
For small teams or personal projects with few contributors.

Example flow:

```bash
git clone https://github.com/team/project.git
git pull origin main  # Get latest changes
# Make your changes
git commit -a -m "Fix login button"
git pull origin main  # Integrate others' changes
git push origin main  # Share your changes
```

### 2. Feature Branch Workflow

A step up from the centralized workflow, where each feature or fix gets its own branch:

- The main branch contains stable, production-ready code
- Developers create feature branches for new work
- Changes are merged back to main when complete
- No direct commits to main

**Advantages**:

- Features are isolated during development
- Main branch remains stable
- Easier to track features
- Supports basic code reviews via pull requests

**Drawbacks**:

- Requires more Git knowledge
- Can still lead to integration issues if branches live too long

**When to use it**:
For small to medium teams that need more organization than the centralized workflow.

Example flow:

```bash
git checkout main
git pull
git checkout -b feature-user-login
# Make your changes
git add .
git commit -m "Implement user login"
git push -u origin feature-user-login
# Create pull request
# After review and approval, merge to main
```

### 3. Gitflow Workflow

A good branching model designed by Vincent Driessen:

- **main**: Only contains production code
- **develop**: Integration branch for features
- **feature/\***: New features
- **release/\***: Preparing for a release
- **hotfix/\***: Emergency fixes for production

**Advantages**:

- Highly structured and organized
- Supports parallel development
- Clear separation between development and production
- Well-defined process for releases and hotfixes

**Drawbacks**:

- More complex to understand and follow
- More overhead for managing branches
- Can be overly complicated for smaller projects

**When to use it**:
For medium to large teams with scheduled releases.

Example flow:

```bash
# Start a new feature
git checkout develop
git checkout -b feature/user-login

# Complete the feature
git checkout develop
git merge feature/user-login

# Prepare a release
git checkout -b release/1.0.0
# Make release-specific changes

# Finalize the release
git checkout main
git merge release/1.0.0
git tag -a 1.0.0 -m "Version 1.0.0"
git checkout develop
git merge release/1.0.0

# Create a hotfix
git checkout main
git checkout -b hotfix/login-fix
# Fix the issue
git checkout main
git merge hotfix/login-fix
git tag -a 1.0.1 -m "Version 1.0.1"
git checkout develop
git merge hotfix/login-fix
```

### 4. GitHub Flow

A simplified workflow designed for continuous delivery:

- The main branch is always deployable
- Create feature branches from main
- Open pull requests early for feedback
- Merge to main after code review
- Deploy immediately after merging to main

**Advantages**:

- Simpler than Gitflow
- Well-suited for continuous delivery
- Encourages early feedback through pull requests
- Integrates well with GitHub's features

**Drawbacks**:

- Less structured than Gitflow
- May not handle multiple versions in production

**When to use it**:
For teams practicing continuous delivery or with web applications.

Example flow:

```bash
git checkout main
git pull
git checkout -b feature-search
# Make your changes
git add .
git commit -m "Add search functionality"
git push -u origin feature-search
# Create a pull request
# After review and automated tests pass, merge to main
# Deploy from main
```

### 5. Trunk-Based Development

A minimal branching strategy focused on keeping the main branch (trunk) always releasable:

- Very short-lived feature branches
- Frequent integration to main (at least daily)
- Feature toggles to hide incomplete work
- Strong focus on automated testing

**Advantages**:

- Minimizes merge conflicts through frequent integration
- Supports continuous integration/deployment
- Reduces branch overhead
- Forces disciplined development practices

**Drawbacks**:

- Requires sophisticated testing and CI/CD
- Relies heavily on feature toggles
- Can be challenging for less experienced teams

**When to use it**:
For experienced teams with strong testing practices and CI/CD pipelines.

Example flow:

```bash
git checkout main
git pull
git checkout -b small-feature
# Make your changes
# Use feature toggles for incomplete work
git add .
git commit -m "Add first part of user profile"
git pull --rebase origin main
git push origin small-feature
# Create PR, get quick review
# Merge to main the same day
```

## Choosing the Right Workflow

The best workflow depends on your team's needs:

| Factor                          | Recommended Workflow          |
| ------------------------------- | ----------------------------- |
| Small team, simple project      | Feature Branch or GitHub Flow |
| Medium team, regular releases   | Gitflow                       |
| Large team, continuous delivery | GitHub Flow or Trunk-Based    |
| Open source project             | Fork and Pull Request         |
| Multiple versions in production | Gitflow                       |
| Strong testing culture          | Trunk-Based Development       |

Remember that workflows can be adapted. Many teams use hybrid approaches that take elements from different workflows.

## Team Collaboration Best Practices

Regardless of your chosen workflow, these practices help teams collaborate effectively:

### Communication

- **Pull request templates**: Standardize information in PRs
- **Issue templates**: Define expected information for bug reports and feature requests
- **Code owners**: Identify who's responsible for different parts of the codebase
- **Status updates**: Keep the team informed about branch status

### Code Quality

- **Code reviews**: Require at least one review before merging
- **Automated testing**: Set up CI to run tests on PRs
- **Linting**: Enforce code style automatically
- **Branch protection**: Prevent direct pushes to important branches

### Integration

- **Small, frequent PRs**: Easier to review and less likely to conflict
- **Rebase before merging**: Keep history clean and avoid unnecessary merge commits
- **Squash commits**: Combine work-in-progress commits before merging
- **Update branches regularly**: Pull from main often to reduce conflicts

### Documentation

- **README files**: Document project setup and contribution guidelines
- **CONTRIBUTING.md**: Explain your team's workflow
- **Meaningful commit messages**: Create a useful history
- **Branch naming conventions**: Make branch purposes clear

## Handling Common Collaboration Challenges

### Resolving Conflicts During Collaboration

When multiple team members modify the same code:

1. Communicate with the team member(s) involved
2. Understand each other's changes before resolving
3. Consider pairing to resolve complex conflicts
4. Update documentation if the conflict revealed unclear areas

### Managing Long-Running Branches

Sometimes feature branches need to exist for extended periods:

1. Regularly merge main into the feature branch
2. Consider breaking the feature into smaller, incremental PRs
3. Use feature toggles to merge incomplete work
4. Create checkpoints by merging stable portions back to main

### Coordinating Dependent Features

When features depend on each other:

1. Use vertical slicing to deliver complete, smaller portions
2. Consider a feature branch hierarchy (branch from other feature branches)
3. Use stacked PRs (each PR builds on the previous one)
4. Carefully coordinate merge order

## Tools for Better Collaboration

Several tools can enhance your Git collaboration:

- **GitHub/GitLab/Bitbucket**: Pull requests, reviews, issues
- **Git hooks**: Automated checks before commits or pushes
- **CI/CD pipelines**: Automated testing and deployment
- **Code review tools**: Enhanced review capabilities
- **ChatOps**: Integration with chat systems like Slack
- **Project management tools**: Track feature progress

## Conclusion

Effective collaboration with Git is about more than just technical knowledge, it's about establishing workflows and practices that help your team work together smoothly. By choosing the right workflow and following collaborative best practices, you can help your team deliver high-quality code consistently.

In the next section, we'll explore how to navigate and modify your Git history.
