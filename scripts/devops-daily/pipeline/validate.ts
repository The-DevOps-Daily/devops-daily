import matter from '../../../lib/front-matter';
import fs from 'fs/promises';
import path from 'path';

/**
 * Validate markdown file
 */
export async function validateMarkdown(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const { data, content: body } = matter(content);

    // Validate front matter
    if (!data.title || !data.date || !data.summary) {
      console.error('Missing required front matter fields');
      return false;
    }

    // Validate title format
    const titlePattern = /^DevOps Weekly Digest - Week \d+, \d{4}$/;
    if (!titlePattern.test(data.title)) {
      console.error('Invalid title format');
      return false;
    }

    // Validate date format (YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(data.date)) {
      console.error('Invalid date format');
      return false;
    }

    // Validate content exists
    if (!body || body.trim().length === 0) {
      console.error('Empty content');
      return false;
    }

    console.log('✓ Markdown validation passed');
    return true;
  } catch (error) {
    console.error('Validation error:', error);
    return false;
  }
}

/**
 * Validate URLs in markdown
 */
export async function validateUrls(content: string): Promise<boolean> {
  // Extract all URLs from markdown
  const urlPattern = /\[.*?\]\((https?:\/\/[^\)]+)\)/g;
  const urls: string[] = [];
  let match;

  while ((match = urlPattern.exec(content)) !== null) {
    urls.push(match[1]);
  }

  if (urls.length === 0) {
    console.warn('No URLs found in content');
    return true;
  }

  console.log(`Found ${urls.length} URLs to validate`);

  // Basic validation - check format
  const invalidUrls: string[] = [];
  for (const url of urls) {
    try {
      new URL(url);
    } catch {
      invalidUrls.push(url);
    }
  }

  if (invalidUrls.length > 0) {
    console.error('Invalid URLs found:', invalidUrls);
    return false;
  }

  console.log('✓ All URLs are valid');
  return true;
}

/**
 * Check for duplicate URLs
 */
export function checkDuplicateUrls(content: string): string[] {
  const urlPattern = /\[.*?\]\((https?:\/\/[^\)]+)\)/g;
  const urls: string[] = [];
  let match;

  while ((match = urlPattern.exec(content)) !== null) {
    urls.push(match[1]);
  }

  const duplicates = urls.filter((url, index) => urls.indexOf(url) !== index);
  return [...new Set(duplicates)];
}
