---
title: 'How Can I Delete a Remote Tag?'
excerpt: 'Learn how to delete Git tags from remote repositories safely. Understand the difference between local and remote tag deletion, and discover best practices for managing release tags in team environments.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-07-08'
publishedAt: '2025-07-08T13:30:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Tags
  - Release Management
  - Repository Management
---

Git tags mark specific points in your repository history, typically used for releases like `v1.0.0` or `v2.1.3`. Sometimes you need to delete a tag - maybe you tagged the wrong commit, used an incorrect version number, or need to recreate a release. While deleting a local tag is straightforward, removing a tag from a remote repository requires an additional step that isn't immediately obvious.

## TLDR

To delete a remote tag, use `git push origin --delete tagname` or the alternative syntax `git push origin :refs/tags/tagname`. To also delete the local tag, run `git tag -d tagname`. Always coordinate with your team before deleting tags that others might be using.

## Prerequisites

You need a Git repository with tags and push access to the remote repository. Basic familiarity with Git commands and understanding of what tags are will help you follow along.

## Understanding Local vs Remote Tags

When you create a tag locally, it exists only in your local repository until you explicitly push it:

```bash
# Create a local tag
git tag v1.0.0

# List local tags
git tag
```

To make the tag available to others, push it:

```bash
# Push a specific tag
git push origin v1.0.0

# Or push all tags at once
git push --tags
```

Once pushed, the tag exists in two places - your local repository and the remote repository. Deleting a local tag doesn't automatically delete the remote tag, and vice versa. You need to delete them separately.

## How Do I Push a Git Tag to a Remote?

Push the tag by name. `git push` without a tag name does not send tags:

```bash
git tag -a v1.0.0 -m "Release 1.0.0"    # an annotated tag: it stores the tagger, date and message
git push origin v1.0.0
```

Other ways to push tags:

```bash
git push origin --tags                  # every local tag, lightweight ones too
git push --follow-tags                  # the pushed commits, plus the annotated tags that point into them
git push origin 'refs/tags/v1.*'        # the tags that match a pattern
git ls-remote --tags origin             # check what the remote has
```

`--follow-tags` is the safer default. It sends the annotated tags that point at commits reachable from the branches you push, and it never sends lightweight tags, which people often use as private bookmarks. In a test, it pushed two annotated tags and left a lightweight tag at home. Make it the default with `git config --global push.followTags true`.

Some details:

- **Use annotated tags for releases.** `git tag -a` records who made the tag and when. `git tag -s` also signs it, with GPG or, with `gpg.format ssh`, with your SSH key. Check a signature with `git tag -v v1.0.0`.
- **Tag an older commit** with `git tag -a v1.0.1 3a7b9f2 -m "Hotfix 1.0.1"`.
- **A tag and a branch with the same name** make the short name ambiguous: `git push origin v1.0` fails with `src refspec v1.0 matches more than one`. Push `refs/tags/v1.0` instead, and avoid such names.
- **CI and releases.** GitHub Actions, GitLab CI and most other systems can start a release job when a tag is pushed, and the hosting service can create a release page from the tag.

### Do not move a tag that others fetched

You can move a tag and force-push it (`git tag -f v1.0.0 <commit>`, then `git push --force origin v1.0.0`). But other clones do not follow. Since Git 2.20, a fetch refuses to change an existing tag:

```text
 ! [rejected]        v1.1.0     -> v1.1.0  (would clobber existing tag)
```

Each clone must run `git fetch --tags --force`, and until it does, the same tag name means two commits. Release a new version (`v1.0.1`) instead. The [remotes chapter of the Git guide](/guides/introduction-to-git/06-remote-repositories#h2-push-tags) and the [tag section of the tracking chapter](/guides/introduction-to-git/03-tracking-changes#h2-tag-a-release) show tags with real output.

## Deleting a Remote Tag

The standard way to delete a remote tag is:

```bash
git push origin --delete v1.0.0
```

This tells Git to delete the tag `v1.0.0` from the remote named `origin`. You'll see output like:

```text
To github.com:username/project.git
 - [deleted]         v1.0.0
```

An alternative syntax that does the same thing:

```bash
git push origin :refs/tags/v1.0.0
```

This older syntax means "push nothing to the remote tag v1.0.0", which effectively deletes it. The modern `--delete` flag is clearer and preferred, but both work identically.

If a branch on the remote has the same name as the tag, `git push origin --delete v1.0.0` fails with `dst refspec v1.0.0 matches more than one`. Name the tag in full: `git push origin --delete refs/tags/v1.0.0`.

## Deleting Both Local and Remote Tags

To completely remove a tag from both local and remote:

```bash
# Delete the local tag
git tag -d v1.0.0

# Delete the remote tag
git push origin --delete v1.0.0
```

You can run these in either order. If you delete the remote tag first, the local tag remains in your repository but won't be on the remote anymore.

## Deleting Multiple Remote Tags

To delete several tags at once:

```bash
# Delete multiple tags from remote
git push origin --delete v1.0.0 v1.0.1 v1.0.2

# Delete local tags
git tag -d v1.0.0 v1.0.1 v1.0.2
```

For many tags, you might script it:

```bash
# Delete all tags matching a pattern from remote
for tag in $(git tag -l "v1.0.*"); do
  git push origin --delete $tag
done

# Delete matching local tags
git tag -d $(git tag -l "v1.0.*")
```

This example deletes all tags starting with `v1.0.` - useful when cleaning up a series of pre-release tags or correcting a versioning mistake.

## Verifying Tag Deletion

After deleting a remote tag, verify it's gone:

```bash
# List all remote tags
git ls-remote --tags origin

# Or remove local tags that are gone from the remote
git fetch --prune --prune-tags
```

`--prune-tags` (Git 2.17 and later) deletes local tags that no longer exist on the remote. `git fetch --tags --prune` does not do this: `--prune` does not apply to tags that `--tags` fetches. In a test, the deleted tag was still there after `git fetch --tags --prune`, and gone after `git fetch --prune --prune-tags`. Note that `--prune-tags` also deletes tags that you created locally and never pushed.

Check your local tags:

```bash
# List all local tags
git tag

# Search for a specific tag
git tag -l "v1.0.0"
```

## Handling Permission Issues

If you get a permission error when deleting a remote tag:

```text
error: unable to delete 'v1.0.0': remote ref does not exist
error: failed to push some refs to 'github.com:username/project.git'
```

This could mean:

1. **The tag doesn't exist on the remote**: Check with `git ls-remote --tags origin`
2. **You don't have permission**: Some repositories protect tags, especially in production environments
3. **The tag is protected**: Platforms like GitHub and GitLab allow protecting tags to prevent accidental deletion

For protected tags, you may need to:

- Temporarily unprotect the tag in your Git hosting platform's settings
- Ask someone with appropriate permissions to delete it
- Use your Git host's web interface to delete the tag

## Recreating a Tag After Deletion

A common workflow is deleting and recreating a tag, perhaps because you tagged the wrong commit:

```bash
# Delete the incorrect tag locally and remotely
git tag -d v1.0.0
git push origin --delete v1.0.0

# Create the tag on the correct commit
git checkout main
git tag v1.0.0

# Push the corrected tag
git push origin v1.0.0
```

Or create the tag on a specific commit:

```bash
# Delete old tag
git tag -d v1.0.0
git push origin --delete v1.0.0

# Create tag on specific commit
git tag v1.0.0 abc123def

# Push the new tag
git push origin v1.0.0
```

## Impact on Team Members

When you delete a remote tag, it doesn't automatically disappear from your teammates' local repositories. They'll still have the old tag locally until they prune:

```bash
# Team members should run this to sync tags
git fetch --prune --prune-tags
```

This removes the local tags that no longer exist on the remote, including tags that someone created locally and never pushed. To make it the default, set both `git config fetch.prune true` and `git config fetch.pruneTags true`: tag pruning only happens on a fetch that prunes.

**Important**: Coordinate with your team before deleting tags. If someone has deployed code using a specific tag, deleting it can cause confusion. If the tag is referenced in documentation, CI/CD pipelines, or deployment scripts, those references will break.

## Tags in Release Management

In production environments, tags typically represent releases. Deleting them should be done carefully:

**Pre-release tags** (like `v1.0.0-beta.1` or `v1.0.0-rc.1`) can usually be deleted safely if you're still iterating.

**Production release tags** (like `v1.0.0` or `v2.3.1`) should rarely be deleted. If a release had problems:

```bash
# Instead of deleting v1.0.0, create v1.0.1 with fixes
git tag v1.0.1
git push origin v1.0.1
```

This preserves the history and makes it clear that 1.0.1 supersedes 1.0.0.

## Recovering a Deleted Tag

Tags have no reflog, so `git reflog` does not help here. Use the hash that `git tag -d` printed. For an annotated tag, it is the hash of the tag object, and a tag that points to it restores the original tag, with its message and tagger:

```bash
git tag -d v1.2.0
# Deleted tag 'v1.2.0' (was 7dbb286)

git tag v1.2.0 7dbb286      # restores the annotated tag
git tag -n1 -l v1.2.0
# v1.2.0          Release 1.2.0
```

If the terminal output is gone, any clone that fetched the tag still has it: run `git ls-remote --tags` against that clone, or push the tag from there. Until `git gc` deletes it, the unreachable tag object is also listed by `git fsck --unreachable --no-reflogs | grep tag`. If nobody has the tag, recreate it on the commit you believe was right, and say so in the release notes.

## Deleting Tags on Different Git Platforms

### GitHub

You can delete tags via the web interface:

1. Go to your repository's Releases page
2. Find the release associated with the tag
3. Click Edit or Delete
4. Delete the release (this doesn't delete the tag automatically)
5. Go to the Tags page and delete the tag

Or use the command line as shown above.

### GitLab

GitLab's interface:

1. Navigate to Repository → Tags
2. Click the delete icon next to the tag

Or use command line.

### Bitbucket

Bitbucket interface:

1. Go to the repository
2. Click on Tags in the navigation
3. Click the delete icon next to the tag

Command line works the same across all platforms.

## Scripting Tag Cleanup

For automated tag cleanup, you might create a script:

```bash
#!/bin/bash
# Delete old pre-release tags

# Get all tags matching pattern
OLD_TAGS=$(git tag -l "*-beta*" "*-alpha*" "*-rc*")

if [ -z "$OLD_TAGS" ]; then
  echo "No pre-release tags to delete"
  exit 0
fi

echo "Found pre-release tags:"
echo "$OLD_TAGS"
read -p "Delete these tags? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  for tag in $OLD_TAGS; do
    echo "Deleting $tag..."
    git tag -d "$tag"
    git push origin --delete "$tag"
  done
  echo "Done!"
else
  echo "Cancelled"
fi
```

This script finds all alpha, beta, and release candidate tags, shows them to you, and asks for confirmation before deleting.

## Best Practices for Tag Management

**Use semantic versioning**: Follow a consistent versioning scheme (like SemVer: major.minor.patch) so tags are predictable.

**Protect production tags**: Configure your Git hosting platform to protect release tags from accidental deletion.

**Document deletions**: If you must delete a production tag, document why in your team's communication channels.

**Create annotated tags for releases**: Use `git tag -a v1.0.0 -m "Release 1.0.0"` instead of lightweight tags. Annotated tags include metadata about who created the tag and when.

**Automate where possible**: Use CI/CD tools to create tags automatically based on successful builds or deployments.

**Never reuse tag names**: If you delete a tag, don't recreate it with the same name pointing to a different commit. This causes confusion. Instead, increment the version number.

Deleting remote tags is straightforward once you know the command, but the decision to delete should be made carefully. Tags serve as important markers in your project's history, and removing them can impact deployments, documentation, and team workflows. When in doubt, it's usually better to create a new tag with an incremented version than to delete and recreate an existing one.

## Related Resources

- [Introduction to Git: Push Tags](/guides/introduction-to-git/06-remote-repositories#h2-push-tags)
- [How to push a new branch, rename or delete branches](/posts/how-to-push-new-local-branch-to-remote-and-track)
- [Fetch a remote branch and check it out](/posts/git-fetch-remote-branch)
- Test yourself: [Git Command Quiz](/quizzes/git-quiz)
