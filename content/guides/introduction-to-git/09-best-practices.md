---
title: 'Git Best Practices'
order: 9
description: 'Git best practices for daily work: meaningful commit messages, branching strategy, .gitignore hygiene, code review flow, and keeping history clean over time.'
---

While Git is flexible enough to accommodate many workflows, following established best practices will help you avoid common pitfalls and work more efficiently. This section outlines recommended practices for commits, branching, collaboration, and repository management.

## Commit Best Practices

### Write Meaningful Commit Messages

Good commit messages are crucial for understanding the project's history. Follow these guidelines:

1. **Use the imperative mood** in the subject line:

   - Good: "Add user authentication feature"
   - Avoid: "Added user authentication feature" or "Adds user authentication feature"

2. **Limit the subject line to 50 characters**

3. **Capitalize the subject line and don't end it with a period**

4. **Separate subject from body with a blank line**

5. **Use the body to explain what and why, not how**:

   ```
   Add password strength validation

   Increases security by requiring minimum password complexity:
   - At least 8 characters
   - Mix of uppercase, lowercase, and numbers
   - Special characters recommended but not required

   Closes #45
   ```

6. **Reference issues and pull requests** where appropriate

### Make Atomic Commits

Each commit should represent a single logical change:

- **Focus on a single task** per commit
- **Don't mix unrelated changes** in the same commit
- **Ensure the code works** after each commit

Atomic commits make it easier to:

- Understand the project history
- Find bugs with `git bisect`
- Cherry-pick specific changes
- Revert changes without affecting other features

### Commit Frequently

Commit small changes often rather than large changes infrequently:

- **Save your work** frequently
- **Make small, focused commits** rather than large, sweeping ones
- **Use private branches** for work-in-progress commits

If you need to clean up your history before sharing it, you can use interactive rebase to squash related commits.

### Don't Commit Generated Files

Avoid committing files that are generated or compiled:

- Build artifacts
- Compiled code
- Dependencies (e.g., node_modules)
- Log files
- Environment-specific configuration

Instead:

- Use `.gitignore` to exclude these files
- Document how to generate them
- Consider using Git LFS for large binary files when necessary

## Branching Best Practices

### Keep Branches Focused

Each branch should have a single, clear purpose:

- **Feature branches** for new features
- **Bug fix branches** for specific bugs
- **Refactoring branches** for code improvements
- **Documentation branches** for doc updates

### Use Consistent Branch Naming

Adopt a consistent branch naming convention:

```
<type>/<description>
```

Examples:

- `feature/user-authentication`
- `bugfix/login-error`
- `hotfix/security-vulnerability`
- `docs/api-documentation`

This makes it easier to:

- Identify branch purposes at a glance
- Filter and search branches
- Automate branch management

### Keep Branches Short-Lived

Long-lived branches lead to integration problems:

- **Merge frequently** back to the main branch
- **Keep feature scope small** to finish branches quickly
- **Split large features** into smaller, incremental branches

### Regularly Update from Main

Keep your feature branches up-to-date with the main branch:

```bash
git checkout feature-branch
git pull --rebase origin main
```

This helps:

- Detect conflicts early
- Ensure your changes work with recent updates
- Make eventual merges smoother

## Workflow Best Practices

### Pull Before You Push

Always integrate others' changes before sharing yours:

```bash
git pull origin main
# Resolve any conflicts
git push origin main
```

### Review Code Before Merging

Use pull requests or code review tools to review changes before merging:

- Verify functionality
- Check code quality
- Ensure tests pass
- Look for security issues

### Automate Testing

Set up continuous integration to test code automatically:

- Run tests on every push
- Check code style and linting
- Measure test coverage
- Scan for security vulnerabilities

### Keep Main Branch Stable

The main branch should always be in a deployable state:

- Never commit directly to main
- Merge only through pull requests
- Ensure all tests pass before merging
- Fix broken builds immediately

## Repository Management

### Use a Good .gitignore File

A well-configured `.gitignore` file keeps your repository clean:

- Use templates from [GitHub's gitignore repository](https://github.com/github/gitignore)
- Include language-specific patterns
- Add IDE and OS-specific files
- Exclude local configuration files
- Ignore build artifacts and dependencies

Example for a Node.js project:

```
# Dependencies
node_modules/
npm-debug.log
yarn-error.log

# Build output
dist/
build/
coverage/

# Environment variables
.env
.env.local
.env.*.local

# OS files
.DS_Store
Thumbs.db

# IDE files
.idea/
.vscode/
*.sublime-project
*.sublime-workspace
```

### Document Your Repository

Maintain good documentation:

- **README.md**: Project overview, setup instructions, usage examples
- **CONTRIBUTING.md**: Guidelines for contributors
- **CODE_OF_CONDUCT.md**: Community expectations
- **LICENSE**: Legal terms for using your code
- **CHANGELOG.md**: Record of changes for each version

### Use Tags for Releases

Mark release points with tags:

```bash
git tag -a v1.0.0 -m "Version 1.0.0 - Initial stable release"
git push origin --tags
```

Use semantic versioning (MAJOR.MINOR.PATCH) where:

- MAJOR: Incompatible API changes
- MINOR: New features, backward compatible
- PATCH: Bug fixes, backward compatible

### Manage Large Files Appropriately

Git isn't designed for large binary files. For these, consider:

- Git LFS (Large File Storage) for tracking large files
- External artifact repositories for builds
- Cloud storage with references in your code

## Security Best Practices

### Don't Commit Secrets

Never commit sensitive information:

- API keys
- Passwords
- Private tokens
- Connection strings
- Private certificates

Instead:

- Use environment variables
- Employ secret management tools
- Store examples with placeholders

If secrets are accidentally committed:

- Change the compromised credentials immediately
- Use tools like BFG or git-filter-branch to remove the secrets
- Force push to overwrite the history (with caution)

### Sign Your Commits

Consider signing commits to verify your identity:

```bash
git config --global user.signingkey YOUR_GPG_KEY_ID
git config --global commit.gpgsign true
```

Then commits will be signed automatically, or use `-S` flag:

```bash
git commit -S -m "Implement secure login"
```

### Use SSH for Remote Repositories

SSH is more secure than HTTPS for authentication:

```bash
git remote add origin git@github.com:username/repository.git
```

## Performance Best Practices

### Keep Your Repository Lean

A smaller repository is faster and more manageable:

- Don't commit large binary files
- Archive old branches
- Use shallow clones for CI/CD when possible
- Consider git-filter-repo for removing large historical files

### Use Git Hooks for Automation

Git hooks can automate tasks and enforce standards:

- **pre-commit**: Run linters and formatters
- **pre-push**: Run tests before pushing
- **commit-msg**: Enforce commit message standards
- **post-merge**: Update dependencies after pulls

Example pre-commit hook:

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running linter..."
npm run lint

if [ $? -ne 0 ]; then
  echo "Linting failed! Fix the errors before committing."
  exit 1
fi

echo "Running tests..."
npm test

if [ $? -ne 0 ]; then
  echo "Tests failed! Fix the failing tests before committing."
  exit 1
fi

exit 0
```

### Use Git Aliases for Common Commands

Create shortcuts for frequently used commands:

```bash
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
```

Now you can use `git co` instead of `git checkout`, etc.

More advanced aliases:

```bash
git config --global alias.logline "log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"
```

## Collaborative Best Practices

### Document Your Workflow

Ensure everyone on the team understands the workflow:

- Create a CONTRIBUTING.md file
- Document branch naming conventions
- Explain the review process
- Set expectations for commits and PRs

### Communicate About Major Changes

Inform the team before making disruptive changes:

- Large refactorings
- Changes to core interfaces
- New architectural directions
- Removal of features

### Resolve Conflicts Together

When complex conflicts arise:

- Communicate with the developers involved
- Consider pair programming for resolution
- Document the resolution decisions
- Update tests to verify correctness

### Provide Meaningful Feedback

When reviewing others' code:

- Be constructive and specific
- Explain the reasoning behind suggestions
- Refer to established best practices
- Balance criticism with positive feedback

## Common Pitfalls to Avoid

### Force Pushing to Shared Branches

Force pushing rewrites history and can disrupt others' work:

- **Never force push to main branches**
- Use `--force-with-lease` instead of `--force` for safety
- Communicate before force pushing to shared feature branches

### Rewriting Public History

Rewriting history that others have already pulled causes problems:

- Only rebase branches that are not shared
- Use `git revert` to undo changes in public branches
- Communicate if history must be rewritten

### Large Merge Commits

Massive merges are difficult to review and debug:

- Merge from main into your branch frequently
- Keep feature branches short-lived
- Break large changes into smaller, incremental PRs

### Committing Broken Code

Commits should represent working states:

- Run tests before committing
- Use pre-commit hooks to enforce quality
- Fix failing tests before pushing

## Conclusion

Following these Git best practices will help you and your team work more efficiently, avoid common issues, and maintain a high-quality codebase. While each team's needs may vary slightly, these principles provide a solid foundation for effective Git usage.

Remember that consistency is key, choose practices that work for your team and stick with them. Document your workflows and onboard new team members to ensure everyone follows the same conventions.

In the next section, we'll explore advanced Git techniques that can help you handle more complex scenarios and become a Git power user.
