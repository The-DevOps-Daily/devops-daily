#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function copyMarkdownFiles() {
  const contentDir = path.join(__dirname, '..', 'content');
  const publicDir = path.join(__dirname, '..', 'public');

  try {
    // Copy posts
    const postsDir = path.join(contentDir, 'posts');
    const publicPostsDir = path.join(publicDir, 'posts');

    await fs.mkdir(publicPostsDir, { recursive: true });

    const posts = await fs.readdir(postsDir);
    for (const post of posts) {
      if (post.endsWith('.md')) {
        await fs.copyFile(path.join(postsDir, post), path.join(publicPostsDir, post));
      }
    }
    console.log(`✅ Copied ${posts.length} posts to public/posts/`);

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

    // Copy advent-of-devops
    const adventDir = path.join(contentDir, 'advent-of-devops');
    const publicAdventDir = path.join(publicDir, 'advent-of-devops');

    await fs.mkdir(publicAdventDir, { recursive: true });

    const adventFiles = await fs.readdir(adventDir);
    for (const file of adventFiles) {
      if (file.endsWith('.md')) {
        await fs.copyFile(path.join(adventDir, file), path.join(publicAdventDir, file));
      }
    }
    console.log(`✅ Copied ${adventFiles.filter(f => f.endsWith('.md')).length} advent days to public/advent-of-devops/`);
  } catch (error) {
    console.error('❌ Error copying markdown files:', error);
    process.exit(1);
  }
}

copyMarkdownFiles();
