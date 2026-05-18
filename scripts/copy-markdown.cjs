#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function copyMarkdownFiles() {
  const contentDir = path.join(__dirname, '..', 'content');
  const publicDir = path.join(__dirname, '..', 'public');

  async function copyFiles(srcDir, destDir, extension) {
    await fs.mkdir(destDir, { recursive: true });

    const files = await fs.readdir(srcDir);
    const matchingFiles = files.filter((file) => file.endsWith(extension));

    for (const file of matchingFiles) {
      await fs.copyFile(path.join(srcDir, file), path.join(destDir, file));
    }

    return matchingFiles.length;
  }

  try {
    const postCount = await copyFiles(
      path.join(contentDir, 'posts'),
      path.join(publicDir, 'posts'),
      '.md'
    );
    console.log(`✅ Copied ${postCount} posts to public/posts/`);

    // Copy guides
    const guidesDir = path.join(contentDir, 'guides');
    const publicGuidesDir = path.join(publicDir, 'guides');

    await fs.mkdir(publicGuidesDir, { recursive: true });

    const guides = await fs.readdir(guidesDir);
    for (const guide of guides) {
      const guidePath = path.join(guidesDir, guide);
      const stat = await fs.stat(guidePath);

      if (stat.isDirectory()) {
        const publicGuideDir = path.join(publicGuidesDir, guide);
        await fs.mkdir(publicGuideDir, { recursive: true });

        const guideFiles = await fs.readdir(guidePath);
        for (const file of guideFiles) {
          if (file.endsWith('.md')) {
            if (file === 'index.md') {
              // Copy guide overview to be accessible as /guides/slug.md
              await fs.copyFile(
                path.join(guidePath, file),
                path.join(publicGuidesDir, `${guide}.md`)
              );
            } else {
              // Copy guide parts to the nested directory structure
              await fs.copyFile(path.join(guidePath, file), path.join(publicGuideDir, file));
            }
          }
        }
      }
    }
    console.log(`✅ Copied guides to public/guides/`);

    const adventCount = await copyFiles(
      path.join(contentDir, 'advent-of-devops'),
      path.join(publicDir, 'advent-of-devops'),
      '.md'
    );
    console.log(`✅ Copied ${adventCount} advent days to public/advent-of-devops/`);

    const comparisonCount = await copyFiles(
      path.join(contentDir, 'comparisons'),
      path.join(publicDir, 'comparisons'),
      '.json'
    );
    console.log(`✅ Copied ${comparisonCount} comparison JSON files to public/comparisons/`);
  } catch (error) {
    console.error('❌ Error copying markdown files:', error);
    process.exit(1);
  }
}

copyMarkdownFiles();
