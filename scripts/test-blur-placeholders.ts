#!/usr/bin/env tsx

/**
 * Test script to verify blur placeholder functionality
 * Run with: tsx scripts/test-blur-placeholders.ts
 */

import { getBlurPlaceholder } from '../lib/blur-data';

// Test cases
const testCases = [
  '/images/advent/day-1.png',  // Absolute path with leading slash
  'images/advent/day-1.png',   // Relative path without leading slash
  '/android-chrome-192x192.png', // Root-level image
  'invalid-image.png',         // Non-existent image
];

console.log('\n🔍 Testing blur placeholder functionality...\n');

let passed = 0;
let failed = 0;

for (const testPath of testCases) {
  const result = getBlurPlaceholder(testPath);
  const status = result ? '✅ PASS' : '❌ FAIL';
  
  console.log(`${status} - ${testPath}`);
  
  if (result) {
    console.log(`  ↳ Found blur data: ${result.substring(0, 50)}...`);
    passed++;
  } else {
    console.log(`  ↳ No blur data found`);
    if (!testPath.includes('invalid')) {
      failed++;
    } else {
      passed++; // Expected to fail for invalid images
    }
  }
  console.log();
}

console.log(`\n🎯 Test Summary: ${passed}/${testCases.length} passed, ${failed} failed\n`);

if (failed > 0) {
  console.error('❌ Some tests failed! Please check the blur cache and path normalization.');
  process.exit(1);
} else {
  console.log('✅ All tests passed! Blur placeholders are working correctly.');
}
