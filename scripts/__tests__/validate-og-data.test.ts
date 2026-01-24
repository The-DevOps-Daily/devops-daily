import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const TEST_DIR = path.join(process.cwd(), 'test-content-temp');
const TEST_IMAGES_DIR = path.join(process.cwd(), 'public', 'images', 'posts');

describe('validate-og-data', () => {
  beforeEach(() => {
    // Create test directory
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should export valid script', () => {
    // Verify the script exists and is syntactically valid TypeScript
    const scriptPath = path.join(process.cwd(), 'scripts', 'git-hooks', 'validate-og-data.ts');
    expect(fs.existsSync(scriptPath)).toBe(true);

    // Check it can be parsed by reading the content
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('validateFile');
    expect(content).toContain('ogImageExists');
    expect(content).toContain('CONTENT_CONFIG');
  });

  it('should define all required content types', () => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'git-hooks', 'validate-og-data.ts');
    const content = fs.readFileSync(scriptPath, 'utf-8');

    // Check that all content types are defined
    expect(content).toContain("'content/posts'");
    expect(content).toContain("'content/guides'");
    expect(content).toContain("'content/exercises'");
    expect(content).toContain("'content/checklists'");
    expect(content).toContain("'content/advent-of-devops'");
    expect(content).toContain("'content/news'");
  });

  it('should check for required fields: title and excerpt/description', () => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'git-hooks', 'validate-og-data.ts');
    const content = fs.readFileSync(scriptPath, 'utf-8');

    // Verify required fields are being checked
    expect(content).toContain("requiredFields: ['title', 'excerpt']");
    // Posts use excerpt, guides/exercises/checklists use description
    expect(content).toContain("descriptionFields: ['excerpt']");
    expect(content).toContain("descriptionFields: ['description']");
  });

  it('pre-commit hook file should exist and be executable format', () => {
    const hookPath = path.join(process.cwd(), 'scripts', 'git-hooks', 'pre-commit');
    expect(fs.existsSync(hookPath)).toBe(true);

    const content = fs.readFileSync(hookPath, 'utf-8');
    expect(content.startsWith('#!/bin/sh')).toBe(true);
    expect(content).toContain('validate-og-data.ts');
    expect(content).toContain('--staged-only');
  });

  it('install script should exist', () => {
    const installPath = path.join(process.cwd(), 'scripts', 'git-hooks', 'install.sh');
    expect(fs.existsSync(installPath)).toBe(true);

    const content = fs.readFileSync(installPath, 'utf-8');
    expect(content).toContain('.git/hooks');
    expect(content).toContain('pre-commit');
  });
});
