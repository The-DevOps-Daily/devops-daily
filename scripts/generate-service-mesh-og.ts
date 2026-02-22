#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

async function generateServiceMeshOG() {
  const outputDir = path.join(process.cwd(), 'public/images/games');
  const svgPath = path.join(outputDir, 'service-mesh-simulator-og.svg');
  const pngPath = path.join(outputDir, 'service-mesh-simulator-og.png');

  // Create SVG
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="1200" height="630" fill="#0a0a0a"/>
  
  <!-- Gradient Overlay -->
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.3" />
      <stop offset="100%" style="stop-color:#9333ea;stop-opacity:0.3" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#grad)"/>
  
  <!-- Grid Pattern -->
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#grid)"/>
  
  <!-- Service Nodes Visualization -->
  <g opacity="0.6">
    <!-- Frontend Service -->
    <rect x="200" y="250" width="100" height="100" rx="8" fill="#3b82f6" opacity="0.3"/>
    <rect x="190" y="240" width="20" height="20" rx="4" fill="#9333ea" opacity="0.5"/>
    <text x="250" y="310" font-family="Arial, sans-serif" font-size="14" fill="#ffffff" text-anchor="middle">Frontend</text>
    
    <!-- API v1 Service -->
    <rect x="500" y="180" width="100" height="100" rx="8" fill="#10b981" opacity="0.3"/>
    <rect x="490" y="170" width="20" height="20" rx="4" fill="#9333ea" opacity="0.5"/>
    <text x="550" y="240" font-family="Arial, sans-serif" font-size="14" fill="#ffffff" text-anchor="middle">API v1</text>
    
    <!-- API v2 Service -->
    <rect x="500" y="320" width="100" height="100" rx="8" fill="#10b981" opacity="0.3"/>
    <rect x="490" y="310" width="20" height="20" rx="4" fill="#9333ea" opacity="0.5"/>
    <text x="550" y="380" font-family="Arial, sans-serif" font-size="14" fill="#ffffff" text-anchor="middle">API v2</text>
    
    <!-- Database Service -->
    <rect x="800" y="250" width="100" height="100" rx="8" fill="#f59e0b" opacity="0.3"/>
    <rect x="790" y="240" width="20" height="20" rx="4" fill="#9333ea" opacity="0.5"/>
    <text x="850" y="310" font-family="Arial, sans-serif" font-size="14" fill="#ffffff" text-anchor="middle">Database</text>
    
    <!-- Connection Lines -->
    <line x1="300" y1="300" x2="500" y2="230" stroke="#ffffff" stroke-width="2" opacity="0.2"/>
    <line x1="300" y1="300" x2="500" y2="370" stroke="#ffffff" stroke-width="2" opacity="0.2"/>
    <line x1="600" y1="230" x2="800" y2="300" stroke="#ffffff" stroke-width="2" opacity="0.2"/>
    <line x1="600" y1="370" x2="800" y2="300" stroke="#ffffff" stroke-width="2" opacity="0.2"/>
    
    <!-- Traffic Flow Dots -->
    <circle cx="350" cy="260" r="6" fill="#3b82f6" opacity="0.8">
      <animate attributeName="cx" from="350" to="500" dur="2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="700" cy="290" r="6" fill="#10b981" opacity="0.8">
      <animate attributeName="cx" from="700" to="800" dur="2s" repeatCount="indefinite"/>
    </circle>
    
    <!-- mTLS Lock Icon -->
    <g transform="translate(100, 500)">
      <rect x="0" y="10" width="20" height="25" rx="3" fill="#fbbf24" opacity="0.8"/>
      <circle cx="10" cy="5" r="8" stroke="#fbbf24" stroke-width="2" fill="none" opacity="0.8"/>
      <text x="30" y="25" font-family="Arial, sans-serif" font-size="16" fill="#fbbf24">mTLS Encryption</text>
    </g>
  </g>
  
  <!-- Title -->
  <text x="600" y="100" font-family="Arial, sans-serif" font-size="56" font-weight="bold" fill="#ffffff" text-anchor="middle">
    Service Mesh
  </text>
  <text x="600" y="150" font-family="Arial, sans-serif" font-size="56" font-weight="bold" fill="#ffffff" text-anchor="middle">
    Traffic Simulator
  </text>
  
  <!-- Subtitle -->
  <text x="600" y="520" font-family="Arial, sans-serif" font-size="24" fill="#a1a1aa" text-anchor="middle">
    Learn mTLS, Circuit Breakers, Retries &amp; Traffic Splitting
  </text>
  
  <!-- Badge -->
  <rect x="520" y="540" width="160" height="40" rx="20" fill="#3b82f6" opacity="0.2"/>
  <text x="600" y="567" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#3b82f6" text-anchor="middle">
    ⚡ Interactive
  </text>
  
  <!-- DevOps Daily Branding -->
  <text x="1100" y="600" font-family="Arial, sans-serif" font-size="18" fill="#71717a" text-anchor="end">
    DevOps Daily
  </text>
</svg>`;

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(svgPath, svg, 'utf-8');
  console.log(`✅ Generated SVG: ${svgPath}`);

  // Convert to PNG using ImageMagick
  try {
    execSync(`convert -background none -density 300 "${svgPath}" "${pngPath}"`, {
      stdio: 'inherit',
    });
    console.log(`✅ Generated PNG: ${pngPath}`);
  } catch (error) {
    console.warn('⚠️  ImageMagick not available, PNG not generated');
    console.log('   SVG file can still be used for OG images');
  }
}

generateServiceMeshOG().catch(console.error);
