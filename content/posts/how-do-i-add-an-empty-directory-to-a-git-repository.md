---
title: 'How do I Add an Empty Directory to a Git Repository?'
excerpt: 'Git does not track empty directories by design. Learn practical workarounds to include empty folders in your repository using .gitkeep files and understand why this limitation exists.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-03-10'
publishedAt: '2025-03-10T14:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Repository Management
  - File Structure
  - Best Practices
---

You might have noticed that when you create an empty directory in your Git repository and run `git add`, nothing happens. Git doesn't track empty directories - it only tracks files. This can be frustrating when your project structure requires certain directories to exist, like log folders, upload directories, or cache locations.

There's a simple workaround that developers have standardized on: add a placeholder file to the directory so Git has something to track.

## TLDR

Git doesn't track empty directories. To include an empty directory in your repository, create a `.gitkeep` file inside it: `touch uploads/.gitkeep && git add uploads/.gitkeep`. The directory will now be committed and cloned with your repository.

## Prerequisites

You need a Git repository and basic familiarity with Git commands like add and commit. Knowledge of your command line or terminal will help you create directories and files quickly.

## Why Git Doesn't Track Empty Directories

Git's internal design tracks file contents and changes, not directories. Directories exist implicitly as part of file paths. When you commit a file at `src/components/header.js`, Git records the file and its path, creating the directory structure automatically when needed.

This design makes sense for most use cases - you rarely need truly empty directories in source code. But some scenarios require empty directories to exist:

```
project/
├── src/
├── uploads/          # Needs to exist for file uploads
├── logs/             # Application writes logs here
├── cache/            # Temporary cache files
└── temp/             # Temporary processing files
```

Without these directories, your application might crash when it tries to write files to locations that don't exist.

## The Standard Solution: Using .gitkeep

The convention most developers follow is creating a `.gitkeep` file in the empty directory:

```bash
# Create the directory
mkdir uploads

# Create a .gitkeep file inside it
touch uploads/.gitkeep

# Add and commit
git add uploads/.gitkeep
git commit -m "Add uploads directory for user file uploads"
```

Now Git tracks the `.gitkeep` file, which means the directory comes along with it. When someone clones your repository, they get the uploads directory automatically.

The `.gitkeep` filename is just a convention - there's nothing special about it in Git's eyes. You could name it anything:

```bash
touch logs/.gitkeep
touch cache/.keep
touch temp/.placeholder
```

But `.gitkeep` has become the de facto standard, so using it makes your intention clear to other developers.

## Alternative: Using .gitignore Inside the Directory

Another approach creates a `.gitignore` file that serves double duty - it keeps the directory in Git while also specifying what to ignore within that directory:

```bash
# Create the directory
mkdir uploads

# Create .gitignore that ignores everything except itself
cat > uploads/.gitignore << 'EOF'
# Ignore everything in this directory
*
# Except this file
!.gitignore
EOF

# Add and commit
git add uploads/.gitignore
git commit -m "Add uploads directory with gitignore"
```

This approach has an advantage: it explicitly documents that the directory should stay empty (or at least that its contents shouldn't be tracked). This is perfect for directories like `uploads/` or `logs/` where files will be created at runtime but shouldn't be committed.

Here's what the `.gitignore` content means:

```
*            # Ignore all files in this directory
!.gitignore  # Except the .gitignore file itself
```

The exclamation mark `!` negates a pattern, creating an exception to the ignore rule.

## Creating Multiple Empty Directories at Once

When setting up a new project structure with several empty directories, you can create them all efficiently:

```bash
# Create multiple directories
mkdir -p uploads logs cache temp/processing temp/exports

# Add .gitkeep to each one
touch uploads/.gitkeep logs/.gitkeep cache/.gitkeep \
      temp/processing/.gitkeep temp/exports/.gitkeep

# Add all .gitkeep files at once
git add */.gitkeep */*/.gitkeep

# Commit them
git commit -m "Add directory structure for runtime files"
```

The `-p` flag with mkdir creates parent directories as needed, so `temp/processing` creates both `temp` and `processing` in one command.

## When Your Application Needs Empty Directories

Many applications expect certain directories to exist at startup. Here's how to handle common scenarios:

**Web application upload directories:**

```bash
mkdir -p public/uploads/images public/uploads/documents
touch public/uploads/images/.gitkeep public/uploads/documents/.gitkeep
git add public/uploads/
git commit -m "Add upload directories for user content"
```

**Logging directories:**

```bash
mkdir logs
cat > logs/.gitignore << 'EOF'
*
!.gitignore
EOF
git add logs/.gitignore
git commit -m "Add logs directory (contents ignored)"
```

**Cache and temporary directories:**

```bash
mkdir -p cache tmp/cache tmp/sessions
find cache tmp -type d -exec touch {}/.gitkeep \;
git add cache/.gitkeep tmp/**/.gitkeep
git commit -m "Add cache and temp directories"
```

## Directory Structure for a Typical Project

Here's how you might set up a common project structure with empty directories:

```
project/
├── src/                    # Source code (tracked)
├── dist/                   # Build output (ignored, kept empty)
├── uploads/                # User uploads (ignored, kept empty)
│   └── .gitignore
├── logs/                   # Application logs (ignored, kept empty)
│   └── .gitignore
├── cache/                  # Runtime cache (ignored, kept empty)
│   └── .gitkeep
└── temp/                   # Temporary files (ignored, kept empty)
    └── .gitignore
```

Create this structure:

```bash
# Create all directories
mkdir -p dist uploads logs cache temp

# Create .gitignore for directories that will have runtime content
cat > uploads/.gitignore << 'EOF'
*
!.gitignore
EOF

cat > logs/.gitignore << 'EOF'
*
!.gitignore
EOF

cat > temp/.gitignore << 'EOF'
*
!.gitignore
EOF

# Use .gitkeep for cache (different convention, same effect)
touch cache/.gitkeep dist/.gitkeep

# Add everything
git add dist uploads logs cache temp
git commit -m "Add project directory structure"
```

## Checking If Empty Directories Are Tracked

After adding your placeholder files, verify Git is tracking the directories:

```bash
# See what Git will commit
git status

# List all tracked files
git ls-files

# See directory structure in the index
git ls-tree -r HEAD --name-only
```

You should see your `.gitkeep` or `.gitignore` files listed, which confirms the directories will be included in the repository.

## What Happens When You Clone

When someone clones your repository, Git recreates the directory structure based on the files it tracks:

```bash
# Clone creates all directories that contain tracked files
git clone git@github.com:username/project.git

# The directory structure includes your empty directories
cd project
ls -la uploads/    # Shows uploads/.gitkeep or uploads/.gitignore
```

This is why the placeholder file approach works - Git creates the directory to hold the placeholder file, giving you the empty directory you need.

## Ignoring Directory Contents While Keeping the Directory

A common requirement is having a directory that exists in the repository but whose runtime contents are ignored. Here's the pattern:

```bash
mkdir uploads
cat > uploads/.gitignore << 'EOF'
# Ignore all files in this directory
*

# But track this .gitignore file
!.gitignore
EOF

git add uploads/.gitignore
git commit -m "Add uploads directory, ignore contents"
```

Now the `uploads` directory exists in the repository, but any files users upload at runtime won't be tracked by Git. This is perfect for:

- Upload directories
- Log directories
- Cache directories
- Build output directories that need to exist but shouldn't contain tracked files

## Should You Commit Empty Directories?

Not every empty directory needs to be in Git. Consider whether the directory should be:

**In Git:** Directories that are part of your project structure and needed for the application to run correctly. Examples: uploads, logs, cache, tmp.

**Created at runtime:** Directories that can be created programmatically when first needed. Many applications create necessary directories on first run.

**Created by build tools:** Build output directories often don't need to be in Git - your build process creates them.

For directories you decide should be in Git, use the `.gitkeep` or `.gitignore` approach. For others, document them in your README and create them programmatically:

```javascript
// In your application code
const fs = require('fs');
const uploadDir = './uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
```

You now know how to add empty directories to your Git repository and when it makes sense to do so. The `.gitkeep` convention is simple, widely understood, and solves the problem elegantly. For directories that will contain runtime files, using a `.gitignore` file that ignores everything except itself is even better, as it explicitly documents the directory's purpose.
