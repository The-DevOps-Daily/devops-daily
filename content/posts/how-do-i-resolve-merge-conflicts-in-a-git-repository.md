---
title: 'How do I Resolve Merge Conflicts in a Git Repository?'
excerpt: 'Merge conflicts happen when Git cannot automatically combine changes from different branches. Learn how to identify, understand, and resolve conflicts to keep your development workflow moving forward.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-05-22'
publishedAt: '2025-05-22T11:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Merge Conflicts
  - Collaboration
  - Development
---

Merge conflicts are a normal part of working with Git in a team environment. They occur when Git cannot automatically determine which changes should take precedence because two branches have modified the same parts of a file in different ways. While they might seem intimidating at first, resolving conflicts is a straightforward process once you understand what Git is showing you.

This guide walks you through identifying, understanding, and resolving merge conflicts so you can confidently merge branches and collaborate with your team.

## TLDR

When you encounter a merge conflict, Git marks the conflicted sections in your files with `<<<<<<<`, `=======`, and `>>>>>>>` markers. Open the files, manually choose which changes to keep (or combine both), remove the markers, then run `git add <file>` and `git commit` to complete the merge.

## Prerequisites

You need a Git repository and basic familiarity with Git commands like commit, merge, and branch. Understanding how branches work will help you grasp why conflicts occur.

## Understanding Why Conflicts Happen

Merge conflicts occur when:

1. Two branches modify the same lines in a file
2. One branch deletes a file while another modifies it
3. Two branches create different files with the same name

Here's a common scenario:

```
main branch:      A -> B -> C -> D
                       \
feature branch:         X -> Y -> Z
```

If both commit D and commit Z modified line 10 of `config.js`, Git won't know which version to use when merging. It needs you to decide.

## Identifying When You Have a Conflict

When you try to merge branches, Git tells you immediately if there are conflicts:

```bash
git merge feature-branch
```

Output with conflicts:

```
Auto-merging src/config.js
CONFLICT (content): Merge conflict in src/config.js
Automatic merge failed; fix conflicts and then commit the result.
```

Check which files have conflicts:

```bash
git status
```

You'll see:

```
On branch main
You have unmerged paths.
  (fix conflicts and run "git commit")
  (use "git merge --abort" to abort the merge)

Unmerged paths:
  (use "git add <file>..." to mark resolution)
        both modified:   src/config.js
        both modified:   README.md

no changes added to commit (use "git add" and/or "git commit -a")
```

The "both modified" label shows files where both branches made changes to the same content.

## Understanding Conflict Markers

Open a conflicted file and you'll see special markers showing the conflicting changes:

```javascript
function initializeApp() {
  const config = {
<<<<<<< HEAD
    apiUrl: 'https://api.production.com',
    timeout: 5000,
    retries: 3
=======
    apiUrl: 'https://api.staging.com',
    timeout: 3000,
    maxRetries: 5
>>>>>>> feature-branch
  };
  return config;
}
```

Here's what each marker means:

- `<<<<<<< HEAD`: Start of changes from your current branch (usually main)
- `=======`: Divider between the two versions
- `>>>>>>> feature-branch`: End of changes from the branch you're merging

Everything between `<<<<<<< HEAD` and `=======` is what exists in your current branch. Everything between `=======` and `>>>>>>> feature-branch` is what exists in the branch you're merging in.

## Resolving Conflicts Manually

To resolve the conflict, you need to:

1. Decide which version to keep (or combine both)
2. Remove the conflict markers
3. Mark the file as resolved

### Option 1: Keep Changes from Your Current Branch

If you want to keep your current branch's version:

```javascript
function initializeApp() {
  const config = {
    apiUrl: 'https://api.production.com',
    timeout: 5000,
    retries: 3
  };
  return config;
}
```

Remove all the conflict markers and the other branch's changes.

### Option 2: Keep Changes from the Incoming Branch

If you want to keep the feature branch's version:

```javascript
function initializeApp() {
  const config = {
    apiUrl: 'https://api.staging.com',
    timeout: 3000,
    maxRetries: 5
  };
  return config;
}
```

### Option 3: Combine Both Changes

Often the best solution incorporates both sets of changes:

```javascript
function initializeApp() {
  const config = {
    apiUrl: 'https://api.production.com',
    timeout: 5000,
    retries: 3,
    maxRetries: 5
  };
  return config;
}
```

In this case, you keep the production API URL and timeout from main, but also add the maxRetries property from the feature branch. The key is understanding what each change does and making an informed decision.

## Marking Files as Resolved

After manually editing the file to resolve conflicts:

```bash
# Stage the resolved file
git add src/config.js

# Check status
git status
```

You'll see:

```
On branch main
All conflicts fixed but you are still merging.
  (use "git commit" to conclude merge)

Changes to be committed:
        modified:   src/config.js
```

Once all conflicted files are resolved and staged, complete the merge:

```bash
git commit
```

Git will open your editor with a pre-written merge commit message. You can accept it or modify it to include notes about how you resolved the conflicts.

## Using Command Line Tools to Choose a Version

If you want to quickly accept all changes from one branch or the other without manual editing:

### Keep all changes from your current branch:

```bash
# For a specific file
git checkout --ours src/config.js

# For all conflicted files
git checkout --ours .
```

### Keep all changes from the incoming branch:

```bash
# For a specific file
git checkout --theirs src/config.js

# For all conflicted files
git checkout --theirs .
```

After using `--ours` or `--theirs`, stage the files:

```bash
git add .
git commit
```

This approach is useful when you know one branch's changes should completely override the other, but use it carefully - you might lose important changes.

## Aborting a Merge

If you realize the merge is going wrong or you need to approach it differently:

```bash
git merge --abort
```

This returns your repository to the state before you started the merge. You lose any conflict resolution work you've done, but your branches remain unchanged.

## Resolving Conflicts During a Rebase

Conflicts can also occur during a rebase. The process is similar but with different commands:

```bash
git rebase main
```

If conflicts occur:

```
CONFLICT (content): Merge conflict in src/config.js
error: could not apply abc123... Add new feature
```

Resolve conflicts the same way (edit files, remove markers), then:

```bash
# Stage resolved files
git add src/config.js

# Continue the rebase
git rebase --continue
```

If you want to abort the rebase:

```bash
git rebase --abort
```

## Using Visual Merge Tools

Many developers prefer visual tools for resolving conflicts. Git supports various merge tools:

```bash
# See available merge tools
git mergetool --tool-help

# Use a specific tool (example: vimdiff)
git mergetool --tool=vimdiff

# Or just run the configured default tool
git mergetool
```

Popular merge tools include:

- **VS Code**: Built-in merge conflict resolver
- **vimdiff**: Terminal-based, available everywhere
- **meld**: Graphical tool for Linux
- **kdiff3**: Cross-platform graphical tool
- **p4merge**: Free tool from Perforce

Configure your preferred tool:

```bash
# Set VS Code as your merge tool
git config --global merge.tool vscode
git config --global mergetool.vscode.cmd 'code --wait $MERGED'

# Or use meld
git config --global merge.tool meld
```

## Common Conflict Scenarios

### Both Branches Added Different Lines

When both branches add content in the same location:

```javascript
<<<<<<< HEAD
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
=======
function calculateTotal(items) {
  const total = items.map(i => i.price).reduce((a, b) => a + b, 0);
  return total;
}
>>>>>>> feature-branch
```

You might combine the best of both:

```javascript
function calculateTotal(items) {
  // Use reduce for clarity and performance
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### Conflicting Import Statements

```javascript
<<<<<<< HEAD
import { UserService } from './services/user';
import { AuthService } from './services/auth';
=======
import { UserService } from './services/users';
import { AuthenticationService } from './services/authentication';
>>>>>>> feature-branch
```

Determine which module names and paths are correct:

```javascript
import { UserService } from './services/user';
import { AuthenticationService } from './services/authentication';
```

### Configuration Changes

```yaml
<<<<<<< HEAD
database:
  host: localhost
  port: 5432
  name: production_db
=======
database:
  host: db.example.com
  port: 5432
  name: app_database
  pool_size: 20
>>>>>>> feature-branch
```

Merge relevant settings:

```yaml
database:
  host: localhost
  port: 5432
  name: production_db
  pool_size: 20
```

## Preventing Conflicts

While conflicts are normal, you can reduce their frequency:

**Keep branches short-lived**: Merge feature branches frequently rather than letting them diverge for weeks.

**Pull regularly**: Keep your feature branch updated with main:

```bash
# While on feature branch
git fetch origin
git merge origin/main
```

**Communicate with your team**: If you know someone else is working on the same files, coordinate your changes.

**Use smaller commits**: Smaller, focused commits are easier to merge than large, sprawling changes.

**Refactor carefully**: Large refactoring changes often create conflicts. Consider doing them on a dedicated branch that gets merged quickly.

## Testing After Resolving Conflicts

After resolving conflicts and completing the merge, always test your code:

```bash
# Run your test suite
npm test

# Or whatever your project uses
pytest
go test ./...
cargo test
```

Conflicts might introduce subtle bugs even when the merge looks correct. The changes you merged might work individually but cause issues when combined.

## Viewing Conflict History

To see files that had conflicts in past merges:

```bash
# Show merge commits
git log --merges --oneline

# See details of a specific merge
git show <merge-commit-hash>

# See what conflicts were resolved
git log -p -S "<<<<<<" --all
```

## Using Git Rerere for Repeated Conflicts

If you frequently encounter the same conflicts (common when repeatedly merging long-lived branches), enable Git's "reuse recorded resolution" feature:

```bash
# Enable rerere
git config --global rerere.enabled true
```

Now Git remembers how you resolved conflicts and automatically applies the same resolution if the conflict reoccurs. This is helpful during rebases or when syncing branches repeatedly.

Merge conflicts are a natural part of collaborative development. The key is staying calm, understanding what Git is showing you, and making thoughtful decisions about which changes to keep. With practice, resolving conflicts becomes routine rather than stressful, and you'll develop strategies for avoiding conflicts in the first place.
