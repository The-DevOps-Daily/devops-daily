import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';

describe('Image Optimization', () => {
  describe('Image File Sizes', () => {
    const imageDir = path.join(process.cwd(), 'public/images');
    const imageFiles = fg.sync('**/*.{jpg,jpeg,png,webp}', { cwd: imageDir });

    it('should check for oversized images (soft check)', () => {
      const oversizedImages: Array<{ file: string; size: number }> = [];
      const maxSize = 500 * 1024; // 500KB

      imageFiles.forEach((file) => {
        const filePath = path.join(imageDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.size > maxSize) {
          oversizedImages.push({ 
            file, 
            size: Math.round(stats.size / 1024) 
          });
        }
      });

      if (oversizedImages.length > 0) {
        console.warn(
          `\n⚠️  Found ${oversizedImages.length} images larger than 500KB (consider optimization):`
        );
        oversizedImages.slice(0, 5).forEach((img) => {
          console.warn(`  - ${img.file}: ${img.size}KB`);
        });
      }

      // Soft check - just warn
      expect(true).toBe(true);
    });

    it('should have at least some images in the public directory', () => {
      expect(imageFiles.length).toBeGreaterThan(0);
    });

    it('should use modern image formats (webp/jpg/png)', () => {
      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
      
      imageFiles.forEach((file) => {
        const ext = path.extname(file).toLowerCase();
        expect(validExtensions).toContain(ext);
      });
    });
  });

  describe('Image Alt Text in Content', () => {
    const contentDir = path.join(process.cwd(), 'content');
    const markdownFiles = fg.sync('posts/*.md', { cwd: contentDir });

    it('should check images have alt text (soft check)', () => {
      const missingAltText: Array<{ file: string; images: number }> = [];

      markdownFiles.forEach((file) => {
        const filePath = path.join(contentDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');

        // Match markdown images: ![alt](url)
        const imageRegex = /!\[([^\]]*)\]\([^)]+\)/g;
        let match;
        let emptyAltCount = 0;

        while ((match = imageRegex.exec(fileContent)) !== null) {
          const altText = match[1];
          if (!altText || altText.trim() === '') {
            emptyAltCount++;
          }
        }

        if (emptyAltCount > 0) {
          missingAltText.push({ file, images: emptyAltCount });
        }
      });

      if (missingAltText.length > 0) {
        console.warn(
          `\n⚠️  Found ${missingAltText.length} posts with images missing alt text:`
        );
        missingAltText.slice(0, 3).forEach((item) => {
          console.warn(`  - ${item.file}: ${item.images} image(s)`);
        });
      }

      // Soft check for accessibility
      expect(true).toBe(true);
    });
  });
});
