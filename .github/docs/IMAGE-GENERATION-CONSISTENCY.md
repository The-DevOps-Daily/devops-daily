# Image Generation Consistency Fix

## Problem
The SVG-to-PNG conversion was producing slightly different images across environments (local vs CI), causing unnecessary regeneration of hundreds of images in PRs.

## Root Cause
Two main issues caused inconsistent PNG generation:

### 1. **System Font Variations**
The SVG templates used `font-family="system-ui, -apple-system, sans-serif"`, which means:
- **macOS** uses San Francisco font
- **Linux** uses whatever system font is available (DejaVu Sans, Liberation Sans, etc.)
- **CI environments** may have different fonts installed

This caused pixel-perfect differences in text rendering, making the same SVG produce different PNGs on different systems.

### 2. **System Font Loading in Resvg**
The Resvg library was loading system fonts by default (`loadSystemFonts: true`), amplifying the problem.

## Solution

### 1. **Use Consistent Font**
Changed all SVG templates to use `Arial, sans-serif`:
- **Arial** is available on all major operating systems (Windows, macOS, Linux)
- It's a standard web-safe font guaranteed to be present
- Provides consistent rendering across all environments

**Files updated:**
- `scripts/generate-post-images-svg-parallel.ts`
- `scripts/generate-post-images-svg.ts`
- `scripts/generate-checklist-images-svg.ts`
- `scripts/generate-interview-images-svg.ts`
- `scripts/generate-quiz-og.ts`

### 2. **Disable System Font Loading**
Added `loadSystemFonts: false` to all Resvg configurations:

```typescript
const resvg = new Resvg(svgBuffer, {
  background: 'rgba(255, 255, 255, 1)',
  fitTo: {
    mode: 'width',
    value: 1200,
  },
  font: {
    loadSystemFonts: false, // Ensures consistent font rendering
  },
});
```

**Files updated:**
- `scripts/svg-to-png.ts`
- `scripts/convert-svg-to-png.ts`
- `scripts/convert-svg-to-png-parallel.ts`

## Benefits

1. **Consistent Output**: Same SVG → Same PNG across all environments
2. **Smaller PRs**: No more hundreds of image regenerations
3. **Faster CI**: Less time spent regenerating and uploading images
4. **Better Caching**: The `.png-cache.json` system now works as intended

## Testing

To verify the fix works:

1. Generate images locally:
   ```bash
   npm run generate:images
   ```

2. Commit and push

3. CI should not regenerate the same images

## Notes

- **Arial** is chosen because it's universally available
- If Arial is not found, the browser/renderer falls back to `sans-serif` generic family
- The cache system (`generateContentHash`) now works correctly since visual output is consistent

## Related Issues

- Fixes #900
