#!/usr/bin/env node

// scripts/svg-to-png.ts
// Usage: npx tsx scripts/svg-to-png.ts <path-to-svg-file>

import fs from 'fs/promises';
import path from 'path';
import { convertSvgToPng as renderSvgToPng } from './og-utils';

// ANSI color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

async function convertSvgToPng(svgPath: string): Promise<void> {
  try {
    // Validate input file exists and is SVG
    const stats = await fs.stat(svgPath);
    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }

    if (!svgPath.toLowerCase().endsWith('.svg')) {
      throw new Error('File must have .svg extension');
    }

    // Generate output path
    const dir = path.dirname(svgPath);
    const basename = path.basename(svgPath, '.svg');
    const pngPath = path.join(dir, `${basename}.png`);

    console.log(colorize(`🔄 Converting: ${path.basename(svgPath)}`, 'blue'));
    console.log(colorize(`📁 Directory: ${dir}`, 'cyan'));

    await renderSvgToPng(svgPath, pngPath);

    // Get file sizes for comparison
    const svgSize = (await fs.stat(svgPath)).size;
    const pngSize = (await fs.stat(pngPath)).size;

    console.log(colorize(`✅ Success!`, 'green'));
    console.log(
      colorize(`📄 Input:  ${path.basename(svgPath)} (${(svgSize / 1024).toFixed(1)} KB)`, 'white')
    );
    console.log(
      colorize(`📄 Output: ${path.basename(pngPath)} (${(pngSize / 1024).toFixed(1)} KB)`, 'white')
    );
    console.log(colorize(`📏 Size:   1200x630 pixels`, 'white'));
  } catch (error) {
    console.error(colorize(`❌ Error converting ${svgPath}:`, 'red'));
    if (error instanceof Error) {
      console.error(colorize(`   ${error.message}`, 'red'));
    } else {
      console.error(colorize(`   Unknown error occurred`, 'red'));
    }
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showHelp();
    process.exit(1);
  }

  const command = args[0];

  // Handle help command
  if (command === '--help' || command === '-h' || command === 'help') {
    showHelp();
    process.exit(0);
  }

  // Handle batch conversion
  if (command === '--batch' || command === '-b') {
    if (args.length < 2) {
      console.error(colorize('❌ Please provide a directory path for batch conversion', 'red'));
      showHelp();
      process.exit(1);
    }

    await batchConvert(args[1]);
    return;
  }

  // Single file conversion
  const svgFilePath = path.resolve(command);

  console.log(colorize('🖼️  SVG to PNG Converter', 'magenta'));
  console.log();

  try {
    await convertSvgToPng(svgFilePath);
    console.log();
    console.log(colorize('🎉 Conversion completed successfully!', 'green'));
  } catch (error) {
    console.log();
    console.error(colorize('💥 Conversion failed!', 'red'));
    process.exit(1);
  }
}

async function batchConvert(dirPath: string) {
  console.log(colorize('🖼️  SVG to PNG Batch Converter', 'magenta'));
  console.log();

  try {
    const resolvedDir = path.resolve(dirPath);
    const files = await fs.readdir(resolvedDir);
    const svgFiles = files.filter((file) => file.toLowerCase().endsWith('.svg'));

    if (svgFiles.length === 0) {
      console.log(colorize(`📁 No SVG files found in: ${resolvedDir}`, 'yellow'));
      return;
    }

    console.log(colorize(`📁 Found ${svgFiles.length} SVG file(s) in: ${resolvedDir}`, 'cyan'));
    console.log();

    let successCount = 0;
    let errorCount = 0;

    for (const svgFile of svgFiles) {
      const svgPath = path.join(resolvedDir, svgFile);
      try {
        await convertSvgToPng(svgPath);
        successCount++;
      } catch (error) {
        errorCount++;
      }
      console.log(); // Add spacing between files
    }

    console.log(colorize('📊 Batch Conversion Summary:', 'blue'));
    console.log(colorize(`   ✅ Successful: ${successCount}`, 'green'));
    console.log(colorize(`   ❌ Failed: ${errorCount}`, 'red'));
    console.log(colorize(`   📁 Total: ${svgFiles.length}`, 'white'));
  } catch (error) {
    console.error(colorize(`❌ Error accessing directory: ${dirPath}`, 'red'));
    if (error instanceof Error) {
      console.error(colorize(`   ${error.message}`, 'red'));
    }
    process.exit(1);
  }
}

function showHelp() {
  console.log(colorize('🖼️  SVG to PNG Converter', 'magenta'));
  console.log();
  console.log(colorize('Usage:', 'cyan'));
  console.log('  npx tsx scripts/svg-to-png.ts <svg-file-path>');
  console.log('  npx tsx scripts/svg-to-png.ts --batch <directory-path>');
  console.log();
  console.log(colorize('Examples:', 'cyan'));
  console.log('  npx tsx scripts/svg-to-png.ts public/images/posts/my-post.svg');
  console.log('  npx tsx scripts/svg-to-png.ts ./content/images/guide-intro.svg');
  console.log('  npx tsx scripts/svg-to-png.ts --batch public/images/posts');
  console.log('  npx tsx scripts/svg-to-png.ts --batch ./public/images/guides');
  console.log();
  console.log(colorize('Options:', 'cyan'));
  console.log('  -h, --help              Show this help message');
  console.log('  -b, --batch <dir>       Convert all SVG files in directory');
  console.log();
  console.log(colorize('Output:', 'cyan'));
  console.log('  • PNG file created in same directory as SVG');
  console.log('  • Same filename with .png extension');
  console.log('  • Optimized for social media (1200x630)');
  console.log('  • High quality with compression');
  console.log();
  console.log(colorize('Requirements:', 'yellow'));
  console.log('  npm install --save-dev @resvg/resvg-js sharp tsx');
}

// Execute the script
main().catch((error) => {
  console.error(colorize('💥 Unexpected error:', 'red'), error);
  process.exit(1);
});
