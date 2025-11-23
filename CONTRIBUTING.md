# Contributing to DevOps Daily

First off, thank you for considering contributing to DevOps Daily! 🎉 It's people like you that make DevOps Daily such a great resource for the community.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Content Guidelines](#content-guidelines)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Style Guides](#style-guides)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior by opening an issue or contacting the project maintainers.

We're building a welcoming community where everyone can learn and contribute, regardless of experience level.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/devops-daily.git
   cd devops-daily
   ```
3. **Install dependencies**:
   ```bash
   pnpm install
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Start the development server**:
   ```bash
   npm run dev
   ```

## 🤝 How Can I Contribute?

### 📝 Writing Content

We're always looking for quality DevOps content! You can contribute:

- **Blog Posts**: Share your knowledge on DevOps topics
- **Guides**: Create comprehensive multi-part guides
- **Exercises**: Design hands-on practical exercises
- **Quizzes**: Create interactive quizzes
- **News**: Curate and share DevOps news

### 🐛 Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Your environment (OS, browser, Node version)

### 💡 Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- A clear and descriptive title
- Detailed description of the proposed feature
- Why this enhancement would be useful
- Possible implementation approach (optional)

### 🔧 Code Contributions

Look for issues labeled:

- `good first issue` - Great for newcomers
- `help wanted` - We need help with these
- `bug` - Bug fixes needed
- `enhancement` - New features

## 📚 Content Guidelines

### For Posts

- **Location**: `content/posts/<name-of-post>.md`
- **Example**: `content/posts/understanding-docker-networking.md`

**Front Matter Structure**:

```yaml
---
title: 'How to Fix Docker: Permission Denied'
excerpt: "Getting a 'permission denied' error when using Docker can be frustrating. Here's how to fix it."
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-11-15'
publishedAt: '2024-11-15T09:00:00Z'
updatedAt: '2024-11-15T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'Your Name'
  slug: 'your-name'
tags:
  - Docker
  - Troubleshooting
  - Linux
  - DevOps
---
Your content starts here. Note: The H1 heading comes from the title in front matter.
```

**Content Best Practices**:

- Write clear, concise, and actionable content
- Include practical examples and code snippets
- Use proper markdown formatting
- Add relevant images (optimized for web)
- Proofread for grammar and spelling
- Focus on providing value to readers

### For Guides

- **Location**: `content/guides/<guide-name>/`
- **Structure**:
  - Introduction: `content/guides/<guide-name>/index.md`
  - Parts: `content/guides/<guide-name>/01-part-one.md`, `02-part-two.md`, etc.

**Introduction File Front Matter**:

```yaml
---
title: 'Complete Guide to Kubernetes'
description: 'A comprehensive guide to mastering Kubernetes'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
publishedAt: '2024-11-15T09:00:00Z'
updatedAt: '2024-11-15T09:00:00Z'
author:
  name: 'Your Name'
  slug: 'your-name'
tags:
  - Kubernetes
  - Containers
  - Orchestration
---
```

**Part File Front Matter**:

```yaml
---
title: 'Kubernetes Fundamentals'
description: 'Understanding the basics of Kubernetes'
order: 1
---
```

### For Exercises

- **Location**: `content/exercises/<exercise-name>.md`
- **Purpose**: Hands-on practical exercises for skill development

### For Quizzes

- **Location**: `content/quizzes/<quiz-name>.md`
- **Validation**: Run `npm run quiz:validate` to validate quiz structure

### Author Information

If you're contributing content, add your author info:

**Location**: `content/authors/<your-slug>.md`

```yaml
---
name: 'Your Name'
slug: 'your-name'
bio: 'DevOps Engineer passionate about automation and cloud technologies'
avatar: '/images/authors/your-name.jpg'
social:
  twitter: 'https://twitter.com/yourhandle'
  github: 'https://github.com/yourhandle'
  linkedin: 'https://linkedin.com/in/yourhandle'
---
```

### Categories

Check `content/categories/` for existing categories. If you need a new category, create:

**Location**: `content/categories/<category-slug>.md`

```yaml
---
name: 'Docker'
slug: 'docker'
description: 'All about Docker containers and containerization'
---
```

## �� Development Workflow

### Running Locally

```bash
# Start development server
npm run dev

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run check-format
```

### Building for Production

```bash
# Full build with image generation
npm run build

# Fast build (skip image generation)
npm run build:fast
```

### Useful Scripts

```bash
# Validate quizzes
npm run quiz:validate

# Generate RSS feed
npm run generate-feed

# Generate search index
npm run generate-search-index

# Generate post images
npm run generate:images:parallel
```

## 📬 Pull Request Process

1. **Update your fork** with the latest changes from main:

   ```bash
   git checkout main
   git pull upstream main
   ```

2. **Create a feature branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes** following the style guides

4. **Test your changes locally**:

   ```bash
   npm run dev
   npm run lint
   npm run format
   ```

5. **Commit your changes**:

   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `style:` Code style changes (formatting)
   - `refactor:` Code refactoring
   - `test:` Adding tests
   - `chore:` Maintenance tasks

6. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request** on GitHub:
   - Provide a clear title and description
   - Reference any related issues
   - Include screenshots for UI changes
   - Ensure all checks pass

### PR Review Process

- A maintainer will review your PR
- Address any requested changes
- Once approved, your PR will be merged
- Your contribution will be acknowledged in the release notes

## 🎨 Style Guides

### Code Style

- **TypeScript**: Use TypeScript for all new code
- **Formatting**: Run `npm run format` before committing
- **Linting**: Run `npm run lint` to check for issues
- **Components**: Use functional components with hooks
- **Naming**: Use descriptive, camelCase variable names
- **Comments**: Write clear comments for complex logic

### Markdown Style

- Use ATX-style headers (`#` syntax)
- Include blank lines between sections
- Use fenced code blocks with language identifiers
- Keep lines under 120 characters when possible
- Use relative links for internal references

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body

footer
```

Example:

```
feat(posts): add Docker networking guide

- Added comprehensive Docker networking guide
- Included practical examples
- Added diagrams for better understanding

Closes #123
```

## 🏆 Recognition

Contributors are recognized in:

- GitHub contributors page
- Release notes
- Author pages (for content contributors)

## ❓ Questions?

- **GitHub Issues**: [Ask a question](https://github.com/The-DevOps-Daily/devops-daily/issues)
- **Discussions**: Check [GitHub Discussions](https://github.com/The-DevOps-Daily/devops-daily/discussions)

## 📄 License

By contributing to DevOps Daily, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to DevOps Daily! Your efforts help the entire DevOps community. ��
