---
title: 'Advanced Git Techniques'
order: 10
description: 'Learn powerful Git features for complex workflows and scenarios'
---

As you become more proficient with Git, you'll encounter situations that require more advanced techniques. This section covers powerful Git features that can help you handle complex workflows and scenarios.

## Advanced Rebasing Techniques

### Interactive Rebase with Fixup

When you need to make changes to a previous commit, you can use the fixup option:

```bash
# Make your changes
git add .
git commit --fixup commit-hash

# Then rebase to incorporate the fixup
git rebase -i --autosquash HEAD~5
```

The `--autosquash` flag automatically moves fixup commits next to the commits they're fixing and marks them as `fixup`.

### Rebase onto a Different Base

Sometimes you need to move a branch from one base to another:

```bash
git rebase --onto new-base old-base feature-branch
```

This rebases the commits between `old-base` and `feature-branch` onto `new-base`.

Example: Moving a branch from one feature branch to another:

```bash
# Before:
#  main
#    |
#    A---B---C feature-1
#         \
#          D---E---F feature-2

git rebase --onto main feature-1 feature-2

# After:
#  main
#    |
#    A---D'---E'---F' feature-2
#    |
#    B---C feature-1
```

### Preserving Merges During Rebase

By default, rebasing flattens merge commits. To preserve the merge structure:

```bash
git rebase -i --rebase-merges HEAD~10
```

This is useful when you want to keep the context of merges in your history.

## Stashing Advanced Techniques

### Stashing Specific Files

To stash only specific files:

```bash
git stash push -m "Work on login component" src/components/Login.js
```

### Creating a Branch from a Stash

If you want to apply a stash to a new branch:

```bash
git stash branch new-branch stash@{1}
```

This creates a new branch starting from the commit where the stash was created, applies the stash, and drops it if successful.

### Managing Multiple Stashes

When you have multiple stashes, you can:

List all stashes with details:

```bash
git stash list --stat
```

Show the contents of a specific stash:

```bash
git stash show -p stash@{2}
```

Apply a specific stash without removing it:

```bash
git stash apply stash@{2}
```

Remove a specific stash:

```bash
git stash drop stash@{2}
```

### Stashing Untracked Files

By default, `git stash` only saves tracked files. To include untracked files:

```bash
git stash -u
```

To include ignored files as well:

```bash
git stash -a
```

## Submodules and Subtrees

### Working with Submodules

Submodules allow you to include other Git repositories within your repository:

Adding a submodule:

```bash
git submodule add https://github.com/username/library.git lib/library
```

Initializing submodules after cloning:

```bash
git submodule init
git submodule update
```

Or clone with submodules in one step:

```bash
git clone --recurse-submodules https://github.com/username/project.git
```

Updating all submodules:

```bash
git submodule update --remote
```

### Git Subtrees

Subtrees are an alternative to submodules that merge external repositories into a subdirectory:

Adding a subtree:

```bash
git subtree add --prefix=lib/library https://github.com/username/library.git main --squash
```

Updating a subtree:

```bash
git subtree pull --prefix=lib/library https://github.com/username/library.git main --squash
```

Contributing back to the original repository:

```bash
git subtree push --prefix=lib/library https://github.com/username/library.git contribution-branch
```

### Submodules vs Subtrees

| Feature             | Submodules               | Subtrees           |
| ------------------- | ------------------------ | ------------------ |
| Storage             | References only          | Full copy of code  |
| Learning curve      | Steeper                  | Gentler            |
| Dependency tracking | Explicit version         | Can be less clear  |
| Updates             | Manual                   | Can be easier      |
| External changes    | Need explicit permission | Can modify locally |
| Best for            | Third-party libraries    | Project splitting  |

## Rewriting History

### Filtering Repository History

For extensive history rewriting, use git-filter-repo (the modern replacement for git-filter-branch):

```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove a file from all of history
git filter-repo --path path/to/large-file.bin --invert-paths
```

This is useful for:

- Removing large files
- Removing sensitive information
- Extracting a subfolder into its own repository

### Splitting a Repository

To extract a subdirectory into a new repository:

```bash
git filter-repo --subdirectory-filter path/to/subdirectory
```

This rewrites history as if the subdirectory had been the root of the repository all along.

### Combining Repositories

To merge the history of multiple repositories:

```bash
# Add the other repository as a remote
git remote add other-repo https://github.com/username/other-repo.git
git fetch other-repo

# Merge with the allow-unrelated-histories flag
git merge other-repo/main --allow-unrelated-histories

# Resolve any conflicts
git commit
```

## Advanced Merge Strategies

### Octopus Merge

When merging more than two branches at once:

```bash
git merge branch1 branch2 branch3
```

This creates a single merge commit with multiple parents. It only works if there are no conflicts.

### Merge with Strategy Options

Git offers several merge strategies with customizable options:

Recursive strategy with patience algorithm (better handling of complex changes):

```bash
git merge feature-branch -s recursive -X patience
```

Ignore whitespace changes during merge:

```bash
git merge feature-branch -X ignore-space-change
```

Favor one side in conflicts:

```bash
git merge feature-branch -X ours  # Keep our version in conflicts
```

Or:

```bash
git merge feature-branch -X theirs  # Use their version in conflicts
```

## Refs and Refspecs

### Understanding Git References

Git uses references (refs) to point to commits:

- `HEAD`: The current commit you're working on
- `refs/heads/main`: The main branch
- `refs/tags/v1.0.0`: A tag named v1.0.0
- `refs/remotes/origin/main`: The main branch on the origin remote

You can use symbolic references to refer to commits:

```bash
HEAD~3  # Three commits before HEAD
main^2  # The second parent of the main branch tip (for merge commits)
v1.0.0^{} # The commit object that the tag points to
```

### Using Refspecs for Remote Operations

Refspecs define the mapping between remote and local references:

```bash
git fetch origin +refs/heads/*:refs/remotes/origin/*
```

This fetches all branches from origin and stores them as remote-tracking branches.

To fetch only specific branches:

```bash
git fetch origin main:refs/remotes/origin/main develop:refs/remotes/origin/develop
```

### Creating Custom Refspecs

You can set up custom refspecs in your git config:

```bash
[remote "origin"]
    url = https://github.com/username/repo.git
    fetch = +refs/heads/*:refs/remotes/origin/*
    fetch = +refs/pull/*/head:refs/remotes/origin/pr/*
```

With this configuration, `git fetch` will also fetch all pull requests from GitHub.

## Git Hooks

### Creating Useful Git Hooks

Git hooks are scripts that run automatically on certain Git events. They're stored in the `.git/hooks` directory.

Pre-commit hook to prevent committing large files:

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check for files larger than 5MB
large_files=$(find . -type f -size +5M -not -path "./.git/*")

if [ -n "$large_files" ]; then
  echo "Error: Attempting to commit large files:"
  echo "$large_files"
  echo "Please remove these files or add them to .gitignore"
  exit 1
fi

exit 0
```

Commit-msg hook to enforce commit message conventions:

```bash
#!/bin/bash
# .git/hooks/commit-msg

commit_msg_file=$1
commit_msg=$(cat "$commit_msg_file")

# Check if the message follows conventional commits format
if ! echo "$commit_msg" | grep -qE '^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+'; then
  echo "Error: Commit message does not follow the conventional commits format."
  echo "Example: feat(auth): add login functionality"
  exit 1
fi

exit 0
```

### Sharing Hooks with Your Team

Git hooks aren't copied when a repository is cloned. To share hooks:

1. Store hooks in a directory in your repository:

   ```
   project/
   ├── .git/
   └── git-hooks/
       ├── pre-commit
       ├── commit-msg
       └── ...
   ```

2. Set up a script to install the hooks:

   ```bash
   #!/bin/bash
   # setup-hooks.sh

   cp git-hooks/* .git/hooks/
   chmod +x .git/hooks/*
   ```

3. Document the process in your README

Alternatively, use a tool like Husky for npm projects to manage hooks in package.json.

## Working with Patches

### Creating and Applying Patches

Patches allow you to share changes without a common remote repository:

Creating a patch for the last commit:

```bash
git format-patch -1 HEAD
```

Creating patches for a range of commits:

```bash
git format-patch main..feature-branch
```

Applying a patch:

```bash
git apply path/to/0001-commit-message.patch
```

Applying and creating a commit:

```bash
git am path/to/0001-commit-message.patch
```

### Creating Patch Series

For a series of related changes:

```bash
git format-patch -o patches/ main..feature-branch --cover-letter
```

This creates a series of patch files with a cover letter that you can edit to explain the entire series.

## Git Attributes

### Customizing Git's Behavior with Attributes

Git attributes, defined in `.gitattributes`, control how Git handles different file types:

```
# .gitattributes
*.txt text
*.jpg binary
*.sh text eol=lf
*.bat text eol=crlf
```

This ensures:

- Text files have normalized line endings
- JPG files are treated as binary
- Shell scripts always use LF endings (for Unix)
- Batch files always use CRLF endings (for Windows)

### Defining Custom Diff and Merge Strategies

For specific file types:

```
*.png diff=image
*.docx diff=word
```

You'll need to configure these diff drivers:

```bash
git config diff.image.textconv exiftool
git config diff.word.textconv docx2txt
```

Now `git diff` will show meaningful differences for these file types.

## Bundle and Archive

### Creating Portable Git Repositories

Bundle creates a single file containing all commits and references:

```bash
git bundle create repo.bundle HEAD main
```

To clone from a bundle:

```bash
git clone repo.bundle -b main new-repo
```

This is useful for transferring Git data without a network connection.

### Creating Archives of Your Code

To create a ZIP archive of your project:

```bash
git archive --format=zip HEAD > project.zip
```

To archive a specific tag:

```bash
git archive --format=zip v1.0.0 > project-v1.0.0.zip
```

To include submodules:

```bash
git submodule foreach --recursive 'git archive --prefix=$path/ --format=zip HEAD > $PWD/submodule-$name.zip'
```

## Advanced Configuration

### Configuring Git for Productivity

Some helpful configuration settings:

```bash
# Auto-correct typos in Git commands
git config --global help.autocorrect 20

# Show branch names in commit logs
git config --global log.decorate true

# Cache credentials
git config --global credential.helper cache

# Set a global .gitignore
git config --global core.excludesfile ~/.gitignore_global

# Use delta for improved diffs
git config --global core.pager "delta"

# Automatically prune deleted remote branches on fetch/pull
git config --global fetch.prune true
```

### Aliases for Advanced Workflows

Setting up complex aliases:

```bash
# Undo the last commit but keep changes staged
git config --global alias.uncommit 'reset --soft HEAD^'

# Interactive rebase for cleanup
git config --global alias.cleanup 'rebase -i @{upstream}'

# Visualize log with graph
git config --global alias.graph 'log --graph --oneline --decorate --all'

# Show all configs
git config --global alias.aliases 'config --get-regexp ^alias\.'

# Clean up merged branches
git config --global alias.clean-branches '!git branch --merged | grep -v "\*" | xargs -n 1 git branch -d'
```

## Git Internals

### Understanding Git Objects

Git stores four types of objects:

1. **Blob**: Content of a file
2. **Tree**: Directory listing, containing blobs and other trees
3. **Commit**: Points to a tree, with metadata
4. **Tag**: An object pointing to a specific commit

You can examine these objects:

```bash
# View a blob
git cat-file -p blob_hash

# View a tree
git cat-file -p tree_hash

# View a commit
git cat-file -p commit_hash

# View an object's type
git cat-file -t object_hash
```

### Git References

References (refs) are pointers to commits. They're stored in `.git/refs/`:

- Branches: `.git/refs/heads/`
- Tags: `.git/refs/tags/`
- Remote branches: `.git/refs/remotes/`

View the commit a reference points to:

```bash
git rev-parse main
git rev-parse HEAD
git rev-parse --verify v1.0.0
```

### Custom Scripts Using Git Plumbing Commands

Git's low-level "plumbing" commands can be used to build custom tools:

A script to find large objects in your Git repository:

```bash
#!/bin/bash
# find-large-objects.sh

# Create a temporary pack
git gc --quiet --prune=now

# Find the 10 largest objects
git verify-pack -v .git/objects/pack/*.idx |
  grep -v chain |
  sort -k3nr |
  head -10 |
  while read hash type size remainder; do
    if [ $size -gt 100000 ]; then
      echo "$size bytes: $(git cat-file -t $hash) $hash"
      git rev-list --all --objects | grep $hash | sed 's/^.*\t//'
    fi
  done
```

## Git for Specialized Workflows

### Monorepos with Git

For managing large monorepos:

- Use sparse checkout to work with subsets of the repo:

  ```bash
  git clone --no-checkout https://github.com/username/monorepo.git
  cd monorepo
  git sparse-checkout set path/to/subdirectory1 path/to/subdirectory2
  git checkout main
  ```

- Consider partial clones to reduce download size:

  ```bash
  git clone --filter=blob:none https://github.com/username/monorepo.git
  ```

- Use tools like Git LFS for large binary files

### Git for Continuous Integration/Deployment

In CI/CD pipelines, optimize Git operations:

- Use shallow clones to speed up the process:

  ```bash
  git clone --depth 1 https://github.com/username/repo.git
  ```

- Fetch only the necessary branches:

  ```bash
  git fetch origin $CI_COMMIT_REF_NAME
  ```

- Use Git's built-in functionality to check for changes in specific directories:
  ```bash
  if git diff --name-only HEAD~1 HEAD | grep -q "^frontend/"; then
    run_frontend_tests
  fi
  ```

### Git for Data Science and ML

For data science projects:

- Use Git LFS for large model files and datasets
- Consider tools like DVC (Data Version Control) for data and ML model versioning
- Create hooks to prevent committing sensitive data or large untracked files
- Use branch naming conventions that reflect experiments (e.g., `experiment/feature-selection-1`)

## Working with Git Worktrees

Git worktrees let you check out multiple branches from the same repository
into separate directories. This is useful when you need to review a change or
work on a fix without switching branches or disturbing uncommitted work in your
current directory.

Create a worktree for a new branch based on `main`:

```bash
git worktree add -b hotfix ../project-hotfix main
```

Git creates the `hotfix` branch and checks it out in `../project-hotfix`. To
create a worktree for a branch that already exists, omit `-b` and the start
point:

```bash
git worktree add ../project-review review-branch
```

List the worktrees associated with the repository:

```bash
git worktree list
```

When you are finished, remove a worktree by naming its directory:

```bash
git worktree remove ../project-hotfix
```

Each branch can be checked out in only one worktree at a time. Removing a
worktree does not delete its branch; delete the branch separately if it is no
longer needed.

## Conclusion

These advanced Git techniques provide powerful tools for handling complex scenarios and optimizing your workflow. While you may not need all of these features immediately, understanding them will help you solve challenging version control problems as they arise.

Remember that Git is highly flexible and extensible. As you become more comfortable with these advanced features, you can combine and customize them to create workflows that perfectly suit your needs and those of your team.

The most important skill is knowing when to use these advanced techniques. Start with the basics, and gradually incorporate these more powerful features as you encounter situations that require them.
EOF
