#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function copyMarkdownToOut() {
  const publicDir = path.join(__dirname, '..', 'public');
  const outDir = path.join(__dirname, '..', 'out');

  try {
    // Check if out directory exists (it should after next build)
    const outExists = await fs
      .access(outDir)
      .then(() => true)
      .catch(() => false);
    if (!outExists) {
      console.log('⚠️ Out directory does not exist. Make sure to run this after next build.');
      return;
    }

    // Copy posts markdown files
    const publicPostsDir = path.join(publicDir, 'posts');
    const outPostsDir = path.join(outDir, 'posts');

    const postsExists = await fs
      .access(publicPostsDir)
      .then(() => true)
      .catch(() => false);
    if (postsExists) {
      await fs.mkdir(outPostsDir, { recursive: true });

      const posts = await fs.readdir(publicPostsDir);
      for (const post of posts) {
        if (post.endsWith('.md')) {
          await fs.copyFile(path.join(publicPostsDir, post), path.join(outPostsDir, post));
        }
      }
      console.log(
        `✅ Copied ${posts.filter((p) => p.endsWith('.md')).length} post markdown files to out/posts/`
      );
    }

    // Copy guides markdown files
    const publicGuidesDir = path.join(publicDir, 'guides');
    const outGuidesDir = path.join(outDir, 'guides');

    const guidesExists = await fs
      .access(publicGuidesDir)
      .then(() => true)
      .catch(() => false);
    if (guidesExists) {
      await fs.mkdir(outGuidesDir, { recursive: true });

      // Copy all files and directories from public/guides to out/guides
      async function copyRecursive(src, dest) {
        const entries = await fs.readdir(src, { withFileTypes: true });

        await fs.mkdir(dest, { recursive: true });

        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);

          if (entry.isDirectory()) {
            await copyRecursive(srcPath, destPath);
          } else if (entry.name.endsWith('.md')) {
            await fs.copyFile(srcPath, destPath);
          }
        }
      }

      await copyRecursive(publicGuidesDir, outGuidesDir);
      console.log(`✅ Copied guide markdown files to out/guides/`);
    }

    // Copy advent-of-devops markdown files
    const publicAdventDir = path.join(publicDir, 'advent-of-devops');
    const outAdventDir = path.join(outDir, 'advent-of-devops');

    const adventExists = await fs
      .access(publicAdventDir)
      .then(() => true)
      .catch(() => false);
    if (adventExists) {
      await fs.mkdir(outAdventDir, { recursive: true });

      const adventFiles = await fs.readdir(publicAdventDir);
      for (const file of adventFiles) {
        if (file.endsWith('.md')) {
          await fs.copyFile(path.join(publicAdventDir, file), path.join(outAdventDir, file));
        }
      }
      console.log(
        `✅ Copied ${adventFiles.filter((f) => f.endsWith('.md')).length} advent day markdown files to out/advent-of-devops/`
      );
    }

    // Copy comparison JSON files for static export deployments.
    const publicComparisonsDir = path.join(publicDir, 'comparisons');
    const outComparisonsDir = path.join(outDir, 'comparisons');

    const comparisonsExists = await fs
      .access(publicComparisonsDir)
      .then(() => true)
      .catch(() => false);
    if (comparisonsExists) {
      await fs.mkdir(outComparisonsDir, { recursive: true });

      const comparisonFiles = await fs.readdir(publicComparisonsDir);
      const comparisonJsonFiles = comparisonFiles.filter((file) => file.endsWith('.json'));
      for (const file of comparisonJsonFiles) {
        await fs.copyFile(path.join(publicComparisonsDir, file), path.join(outComparisonsDir, file));
      }
      console.log(
        `✅ Copied ${comparisonJsonFiles.length} comparison JSON files to out/comparisons/`
      );
    }

    // Ensure generated RSS feed is present in static export output.
    const publicFeedPath = path.join(publicDir, 'feed.xml');
    const outFeedPath = path.join(outDir, 'feed.xml');
    const feedExists = await fs
      .access(publicFeedPath)
      .then(() => true)
      .catch(() => false);
    if (feedExists) {
      await fs.copyFile(publicFeedPath, outFeedPath);
      console.log('✅ Copied RSS feed to out/feed.xml');
    }
  } catch (error) {
    console.error('❌ Error copying markdown files to out directory:', error);
    process.exit(1);
  }
}

copyMarkdownToOut();
