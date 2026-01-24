import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const POSTS_IMAGES_DIR = path.join(PUBLIC_DIR, 'images', 'posts');
const GUIDES_IMAGES_DIR = path.join(PUBLIC_DIR, 'images', 'guides');
const EXERCISES_IMAGES_DIR = path.join(PUBLIC_DIR, 'images', 'exercises');
const NEWS_IMAGES_DIR = path.join(PUBLIC_DIR, 'images', 'news');
const CHECKLISTS_IMAGES_DIR = path.join(PUBLIC_DIR, 'images', 'checklists');
const INTERVIEW_IMAGES_DIR = path.join(PUBLIC_DIR, 'images', 'interview-questions');

async function convertSvgToPng(svgPath: string, pngPath: string) {
  try {
    // Read SVG file
    const svgBuffer = await fs.readFile(svgPath);

    // Convert SVG to PNG using resvg
    const resvg = new Resvg(svgBuffer, {
      background: 'rgba(255, 255, 255, 1)', // White background
      fitTo: {
        mode: 'width',
        value: 1200, // OG image standard width
      },
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    // Optimize with sharp and ensure exact dimensions
    const optimizedBuffer = await sharp(pngBuffer)
      .resize(1200, 630, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png({ quality: 90, compressionLevel: 9 })
      .toBuffer();

    // Write PNG file
    await fs.writeFile(pngPath, optimizedBuffer);
    console.log(`✅ Converted: ${path.basename(svgPath)} → ${path.basename(pngPath)}`);
  } catch (error) {
    console.error(`❌ Error converting ${svgPath}:`, error);
  }
}

async function convertAllSvgImages() {
  console.log('🖼️  Converting SVG images to PNG for social media...');

  const directories = [
   { dir: POSTS_IMAGES_DIR, type: 'posts' },
   { dir: GUIDES_IMAGES_DIR, type: 'guides' },
   { dir: EXERCISES_IMAGES_DIR, type: 'exercises' },
   { dir: NEWS_IMAGES_DIR, type: 'news' },
    { dir: CHECKLISTS_IMAGES_DIR, type: 'checklists' },
    { dir: INTERVIEW_IMAGES_DIR, type: 'interview-questions' },
 ];

  for (const { dir, type } of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const files = await fs.readdir(dir);
      const svgFiles = files.filter((file) => file.endsWith('.svg'));

      console.log(`📁 Processing ${svgFiles.length} SVG files in ${type}...`);

      for (const svgFile of svgFiles) {
        const svgPath = path.join(dir, svgFile);
        const pngFile = svgFile.replace('.svg', '.png');
        const pngPath = path.join(dir, pngFile);

        // Check if PNG already exists and is newer than SVG
        try {
          const svgStats = await fs.stat(svgPath);
          const pngStats = await fs.stat(pngPath);

          if (pngStats.mtime > svgStats.mtime) {
            // console.log(`⏭️  Skipping ${svgFile} (PNG is up to date)`);
            continue;
          }
        } catch {
          // PNG doesn't exist, proceed with conversion
        }

        await convertSvgToPng(svgPath, pngPath);
      }
    } catch (error) {
      console.error(`❌ Error processing ${type} directory:`, error);
    }
  }

  console.log('✅ SVG to PNG conversion complete!');
}

// Execute the function
convertAllSvgImages().catch((error) => {
  console.error('Error converting SVG images:', error);
  process.exit(1);
});
