#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function copyMarkdownToOut() {
  const publicDir = path.join(__dirname, '..', 'public');
  const outDir = path.join(__dirname, '..', 'out');

  async function pathExists(targetPath) {
    return fs
      .access(targetPath)
      .then(() => true)
      .catch(() => false);
  }

  async function copyFilesIfPresent(srcDir, destDir, extension, label) {
    if (!(await pathExists(srcDir))) {
      return;
    }

    await fs.mkdir(destDir, { recursive: true });

    const files = await fs.readdir(srcDir);
    const matchingFiles = files.filter((file) => file.endsWith(extension));
    for (const file of matchingFiles) {
      await fs.copyFile(path.join(srcDir, file), path.join(destDir, file));
    }

    console.log(`✅ Copied ${matchingFiles.length} ${label} to ${path.relative(outDir, destDir)}/`);
  }

  async function copyRecursiveMarkdown(src, dest) {
    const entries = await fs.readdir(src, { withFileTypes: true });

    await fs.mkdir(dest, { recursive: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await copyRecursiveMarkdown(srcPath, destPath);
      } else if (entry.name.endsWith('.md')) {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  try {
    // Check if out directory exists (it should after next build)
    if (!(await pathExists(outDir))) {
      console.log('⚠️ Out directory does not exist. Make sure to run this after next build.');
      return;
    }

    await copyFilesIfPresent(
      path.join(publicDir, 'posts'),
      path.join(outDir, 'posts'),
      '.md',
      'post markdown files'
    );

    // Copy guides markdown files
    const publicGuidesDir = path.join(publicDir, 'guides');
    const outGuidesDir = path.join(outDir, 'guides');

    if (await pathExists(publicGuidesDir)) {
      await copyRecursiveMarkdown(publicGuidesDir, outGuidesDir);
      console.log(`✅ Copied guide markdown files to out/guides/`);
    }

    await copyFilesIfPresent(
      path.join(publicDir, 'advent-of-devops'),
      path.join(outDir, 'advent-of-devops'),
      '.md',
      'advent day markdown files'
    );

    await copyFilesIfPresent(
      path.join(publicDir, 'comparisons'),
      path.join(outDir, 'comparisons'),
      '.json',
      'comparison JSON files'
    );

    // Ensure generated RSS feed is present in static export output.
    const publicFeedPath = path.join(publicDir, 'feed.xml');
    const outFeedPath = path.join(outDir, 'feed.xml');
    if (await pathExists(publicFeedPath)) {
      await fs.copyFile(publicFeedPath, outFeedPath);
      console.log('✅ Copied RSS feed to out/feed.xml');
    }
  } catch (error) {
    console.error('❌ Error copying markdown files to out directory:', error);
    process.exit(1);
  }
}

copyMarkdownToOut();
