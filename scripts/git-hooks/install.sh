#!/bin/sh
#
# Install git hooks for devops-daily
#

HOOK_DIR=".git/hooks"
SCRIPT_DIR="scripts/git-hooks"

# Ensure we're in the repo root
if [ ! -d "$HOOK_DIR" ]; then
    echo "\033[31m❌ Error: .git/hooks directory not found.\033[0m"
    echo "Please run this script from the repository root."
    exit 1
fi

# Install pre-commit hook
if [ -f "$HOOK_DIR/pre-commit" ]; then
    echo "\033[33m⚠ Existing pre-commit hook found. Backing up to pre-commit.bak\033[0m"
    mv "$HOOK_DIR/pre-commit" "$HOOK_DIR/pre-commit.bak"
fi

cp "$SCRIPT_DIR/pre-commit" "$HOOK_DIR/pre-commit"
chmod +x "$HOOK_DIR/pre-commit"

echo "\033[32m✅ Git hooks installed successfully!\033[0m"
echo ""
echo "Installed hooks:"
echo "  - pre-commit: Validates OG data (title, description, images) for content files"
echo ""
echo "To skip validation on a specific commit, use: git commit --no-verify"
