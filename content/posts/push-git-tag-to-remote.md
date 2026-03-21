---
title: 'How to Push a Git Tag to a Remote Repository'
excerpt: 'Created a tag locally and need to share it? Learn how to push tags to remote repositories and manage release versions in Git.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-11-16'
publishedAt: '2024-11-16T13:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Tags
  - Version Control
  - Release Management
  - Remote
---

You created a tag to mark a release or important milestone in your project. Now you need to push it to your remote repository so others can see and use it.

**TLDR:** To push a single tag to remote, use `git push origin tag-name`. To push all tags at once, use `git push --tags` or `git push origin --tags`. Tags do not push automatically with regular commits, so you need to push them explicitly.

In this guide, you'll learn how to push and manage Git tags on remote repositories.

## Prerequisites

You'll need Git installed, a repository with remote access, and at least one local tag. Basic familiarity with Git tags and remotes will be helpful.

## Understanding Git Tags

Git tags are references that point to specific commits:

```
Commits:   A---B---C---D---E---F
                   |       |
Tags:            v1.0    v1.1
```

Unlike branches, tags do not move - they permanently mark a specific point in history. This makes them perfect for release versions.

## Creating a Tag Before Pushing

First, create a tag locally:

```bash
# Create lightweight tag
git tag v1.0.0

# Create annotated tag (recommended)
git tag -a v1.0.0 -m "Release version 1.0.0"

# Verify tag was created
git tag -l
```

Annotated tags store extra metadata (author, date, message) and are better for releases.

## Pushing a Single Tag

To push one specific tag to the remote:

```bash
# Push a single tag
git push origin v1.0.0

# Verify it was pushed
git ls-remote --tags origin
```

The tag is now available on the remote repository for others to fetch.

## Pushing All Tags

To push all local tags that are not yet on the remote:

```bash
# Push all tags
git push --tags

# Or explicitly specify the remote
git push origin --tags
```

This pushes every tag in your local repository to the remote.

## Difference Between --tags and --follow-tags

Git offers two options for pushing tags:

```bash
# Push ALL tags (including lightweight tags)
git push --tags

# Push only annotated tags reachable from pushed commits
git push --follow-tags
```

The `--follow-tags` option is safer because it only pushes tags associated with commits you're pushing.

## Pushing Tags with Commits

To push commits and tags together:

```bash
# Push commits and reachable annotated tags
git push --follow-tags

# Or push commits first, then tags
git push origin main
git push origin --tags
```

Regular `git push` does not push tags automatically - you must use `--follow-tags` or push tags separately.

## Checking If a Tag Exists Remotely

Before pushing, check if a tag already exists on the remote:

```bash
# List remote tags
git ls-remote --tags origin

# Check for specific tag
git ls-remote --tags origin | grep v1.0.0
```

This prevents accidentally overwriting existing tags.

## Pushing Tags to Different Remotes

If you have multiple remotes:

```bash
# List remotes
git remote -v

# Push tag to specific remote
git push upstream v1.0.0

# Push all tags to specific remote
git push upstream --tags
```

Make sure you push tags to the right remote, especially in fork workflows.

## Overwriting Remote Tags (Force Push)

If you need to move a tag (generally not recommended):

```bash
# Move tag locally
git tag -f v1.0.0 abc123

# Force push the updated tag
git push -f origin v1.0.0

# Or delete and recreate
git push origin :refs/tags/v1.0.0
git push origin v1.0.0
```

**Warning:** Only force-push tags if you own the repository and no one has used the old tag yet. Moving tags breaks reproducibility.

## Pushing Tags for Releases

When creating a release:

```bash
# Make sure you're on the right commit
git log --oneline -1

# Create annotated tag for release
git tag -a v2.0.0 -m "Release 2.0.0 - New authentication system"

# Push the tag
git push origin v2.0.0

# Create release on GitHub/GitLab from this tag
```

Most Git hosting platforms automatically detect pushed tags and can create releases from them.

## Pushing Tags from Specific Commits

To tag and push a specific commit:

```bash
# Tag a specific commit
git tag -a v1.0.1 abc123 -m "Hotfix release 1.0.1"

# Push the tag
git push origin v1.0.1
```

This is useful for creating hotfix tags on older commits.

## Deleting Remote Tags

To remove a tag from the remote:

```bash
# Delete remote tag
git push origin --delete v1.0.0

# Or use the colon syntax
git push origin :refs/tags/v1.0.0

# Verify deletion
git ls-remote --tags origin | grep v1.0.0
```

The tag is removed from the remote but still exists locally unless you delete it there too.

## Fetching Tags from Remote

To get tags that others pushed:

```bash
# Fetch all tags
git fetch --tags

# Or fetch everything including tags
git fetch --all

# List all tags (local and remote)
git tag -l
```

Fetching downloads tags to your local repository.

## Checking Tag Push Status

To see if local tags exist on the remote:

```bash
# Show all tags with their commits
git show-ref --tags

# Compare with remote tags
git ls-remote --tags origin

# Find tags that haven't been pushed
comm -23 <(git tag | sort) <(git ls-remote --tags origin | awk '{print $2}' | sed 's|refs/tags/||' | sort)
```

## Pushing Tags in CI/CD

In automated workflows, push tags after successful builds:

```bash
# In CI/CD script
if [ "$CI_COMMIT_TAG" ]; then
  echo "Building release $CI_COMMIT_TAG"
  # Build and test
  # ...
  # Push artifacts
fi

# Or create and push tags automatically
git tag -a v$(date +%Y.%m.%d) -m "Automated release"
git push origin --tags
```

Many CI/CD systems trigger on tag pushes to automate releases.

## Semantic Versioning with Tags

Follow semantic versioning in tag names:

```bash
# Major.Minor.Patch
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0

# Patch update
git tag -a v1.0.1 -m "Bug fixes"
git push origin v1.0.1

# Minor update
git tag -a v1.1.0 -m "New features"
git push origin v1.1.0

# Major update
git tag -a v2.0.0 -m "Breaking changes"
git push origin v2.0.0
```

This creates clear version history.

## Tagging Strategy for Teams

Establish team conventions:

```bash
# Production releases
git tag -a v1.0.0 -m "Production release"

# Release candidates
git tag -a v1.0.0-rc1 -m "Release candidate 1"

# Beta versions
git tag -a v1.0.0-beta -m "Beta release"

# Development snapshots
git tag -a dev-2024-01-15 -m "Development snapshot"
```

Consistent naming helps everyone understand release stages.

## Listing Tags with Patterns

To work with specific tag patterns:

```bash
# List all v1.x tags
git tag -l "v1.*"

# List release candidates
git tag -l "*-rc*"

# Push matching tags
git push origin --tags refs/tags/v1.*
```

## Automated Tag Creation

Create tags automatically in release scripts:

```bash
#!/bin/bash
# release.sh

# Get next version
CURRENT=$(git describe --tags --abbrev=0)
echo "Current version: $CURRENT"

# Increment version
# (parsing logic here)
NEW_VERSION="v1.0.1"

# Create and push tag
git tag -a $NEW_VERSION -m "Release $NEW_VERSION"
git push origin $NEW_VERSION

echo "Pushed tag $NEW_VERSION"
```

## Verifying Tag Signature

For signed tags:

```bash
# Create signed tag
git tag -s v1.0.0 -m "Signed release"

# Push signed tag
git push origin v1.0.0

# Verify signature
git tag -v v1.0.0
```

Signed tags prove authenticity and are important for security-critical releases.

## Tags vs Branches

Remember the key differences:

```bash
# Tags - immutable markers
git tag v1.0.0
git push origin v1.0.0

# Branches - mutable references
git branch release-1.0
git push origin release-1.0
```

Use tags for releases, branches for ongoing work.

## Best Practices

Always use annotated tags for releases:

```bash
# Good: Annotated tag
git tag -a v1.0.0 -m "Release version 1.0.0"

# Less ideal: Lightweight tag
git tag v1.0.0
```

Push tags explicitly:

```bash
# Good: Explicit tag push
git push origin main
git push origin v1.0.0

# Risky: Automatic with --follow-tags
git push --follow-tags
```

Never modify pushed tags:

```bash
# Bad: Moving a public tag
git tag -f v1.0.0
git push -f origin v1.0.0

# Good: Create new version
git tag v1.0.1
git push origin v1.0.1
```

Document tag meaning:

```bash
# Good: Descriptive message
git tag -a v1.0.0 -m "Release 1.0.0 - Added user authentication, fixed critical security bug"

# Not helpful
git tag -a v1.0.0 -m "Release"
```

Now you know how to push Git tags to remote repositories. Tags are essential for marking releases and important milestones, and pushing them requires explicit commands since they do not automatically sync with commits. Use `git push origin tag-name` for single tags or `git push --tags` for all tags.
