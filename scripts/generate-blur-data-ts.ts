#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

async function main() {
  const cacheFile = path.join(projectRoot, '.blur-cache.json');
  const outputFile = path.join(projectRoot, 'lib', 'blur-data-generated.ts');

  console.log('📖 Reading blur cache...');
  const cacheContent = await fs.readFile(cacheFile, 'utf-8');
  const blurData = JSON.parse(cacheContent);

  console.log('🔧 Generating TypeScript file...');
  
  // Generate TypeScript file content
  const tsContent = `// Auto-generated file from .blur-cache.json
// DO NOT EDIT MANUALLY - Run 'npm run generate:blur-data' to regenerate
// Generated at: ${new Date().toISOString()}

export const BLUR_DATA: Record<string, string> = ${JSON.stringify(blurData, null, 2)} as const;
`;

  await fs.writeFile(outputFile, tsContent);

  console.log(`✅ Generated TypeScript blur data file`);
  console.log(`📁 Output: ${outputFile}`);
  console.log(`📊 Total placeholders: ${Object.keys(blurData).length}`);
}

main().catch(console.error);
