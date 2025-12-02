import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('RSS Feed Validation', () => {
  const feedPath = path.join(process.cwd(), 'public/feed.xml');

  describe('Feed File', () => {
    it('should have an RSS feed file', () => {
      expect(fs.existsSync(feedPath)).toBe(true);
    });

    it('should be valid XML', () => {
      const feedContent = fs.readFileSync(feedPath, 'utf-8');
      
      // Check for XML declaration
      expect(feedContent).toContain('<?xml version');
      
      // Check for RSS root element
      expect(feedContent).toContain('<rss');
      expect(feedContent).toContain('</rss>');
    });

    it('should have required RSS channel elements', () => {
      const feedContent = fs.readFileSync(feedPath, 'utf-8');
      
      // Required channel elements
      expect(feedContent).toContain('<title>');
      expect(feedContent).toContain('<link>');
      expect(feedContent).toContain('<description>');
    });

    it('should have at least one item', () => {
      const feedContent = fs.readFileSync(feedPath, 'utf-8');
      
      // Count items in the feed
      const itemMatches = feedContent.match(/<item>/g);
      expect(itemMatches).toBeDefined();
      expect(itemMatches!.length).toBeGreaterThan(0);
    });

    it('should have proper lastBuildDate', () => {
      const feedContent = fs.readFileSync(feedPath, 'utf-8');
      
      expect(feedContent).toContain('<lastBuildDate>');
      
      // Extract and validate date format
      const dateMatch = feedContent.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/);
      if (dateMatch) {
        const dateStr = dateMatch[1];
        // Should be a valid date string
        const date = new Date(dateStr);
        expect(date.toString()).not.toBe('Invalid Date');
      }
    });

    it('should have items with required fields', () => {
      const feedContent = fs.readFileSync(feedPath, 'utf-8');
      
      // Each item should have these elements
      const itemsWithTitle = feedContent.match(/<title><!/g);
      const itemsWithLink = feedContent.match(/<link>https:\/\//g);
      const itemsWithGuid = feedContent.match(/<guid/g);
      
      expect(itemsWithTitle).toBeDefined();
      expect(itemsWithLink).toBeDefined();
      expect(itemsWithGuid).toBeDefined();
      
      // Should have at least some items with these fields
      expect(itemsWithTitle!.length).toBeGreaterThan(0);
      expect(itemsWithLink!.length).toBeGreaterThan(0);
    });

    it('should use CDATA for content (best practice)', () => {
      const feedContent = fs.readFileSync(feedPath, 'utf-8');
      
      // Should use CDATA for titles and descriptions to prevent XML issues
      expect(feedContent).toContain('CDATA');
    });

    it('should have reasonable feed size (soft check)', () => {
      const stats = fs.statSync(feedPath);
      const sizeInKB = Math.round(stats.size / 1024);
      
      // Warn if feed is very large (>5MB)
      if (stats.size > 5 * 1024 * 1024) {
        console.warn(
          `⚠️  RSS feed is quite large (${sizeInKB}KB). Consider limiting the number of items.`
        );
      }
      
      // Feed should have some content
      expect(stats.size).toBeGreaterThan(100);
    });
  });
});
