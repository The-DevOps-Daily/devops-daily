# Image Generation Consistency

## Problem

When generating PNG images from SVG templates, we were experiencing inconsistencies across different environments (local development on macOS, Linux servers, CI pipelines). The same SVG file would produce slightly different PNG outputs, causing:

- Unnecessary regeneration of hundreds of images in PRs
- Large PR diffs with image changes
- Slower CI/CD pipelines
- Cache invalidation issues (`.png-cache.json` not working properly)

## Root Cause

The issue had two components:

1. **System-Dependent Fonts**: SVG templates historically used system-dependent font families like:
   - `system-ui` (different on macOS, Windows, Linux)
   - `-apple-system` (macOS-specific)
   - `SF Mono`, `Monaco`, `Inconsolata` (not universally available)

2. **Resvg System Font Loading**: By default, the Resvg library loads system fonts when rendering SVGs to PNGs. This means:
   - macOS uses San Francisco font
   - Linux uses various fonts depending on distribution
   - Different font metrics → different text rendering → different PNG output

## Solution

We implemented a minimal, forward-looking fix that ensures future images are generated consistently:

### 1. Disable System Font Loading

Modified three PNG conversion scripts to disable system font loading in Resvg:

```typescript
const resvg = new Resvg(svgBuffer, {
  background: 'rgba(255, 255, 255, 1)',
  font: {
    loadSystemFonts: false, // Ensures consistent rendering
  },
  fitTo: {
    mode: 'width',
    value: 1200,
  },
});
```

**Files modified:**
- `scripts/svg-to-png.ts`
- `scripts/convert-svg-to-png.ts`
- `scripts/convert-svg-to-png-parallel.ts`

### 2. Use Universal Fonts in Templates

Going forward, all SVG generation scripts should use universally available fonts:

- **Sans-serif**: `Arial, sans-serif` (available on all major platforms)
- **Monospace**: `Courier New, monospace` (available on all major platforms)

**Current generation scripts already use these fonts:**
- `scripts/generate-post-images-svg.ts`
- `scripts/generate-post-images-svg-parallel.ts`
- `scripts/generate-checklist-images-svg.ts`
- `scripts/generate-interview-images-svg.ts`
- `scripts/generate-quiz-og.ts`

## Why This Approach?

### Minimal Changes
- Only modified 3 conversion scripts (5 lines of code total)
- Did NOT touch existing SVG or PNG files
- Did NOT trigger mass regeneration

### Forward-Looking
- New images will be generated consistently
- Existing images will be updated naturally when content changes
- No need to regenerate 500+ images at once

### Cache-Friendly
- `.png-cache.json` tracks SVG content hashes
- Same SVG → same hash → same PNG (no regeneration)
- Different environments now produce identical outputs

## Impact

- **Smaller PRs**: Only images with actual content changes will be regenerated
- **Faster CI**: Less time regenerating and uploading unchanged images
- **Better Caching**: `.png-cache.json` works correctly across environments
- **Consistent Output**: Same SVG produces same PNG on macOS, Linux, and CI

## Testing

To verify the fix works:

1. Generate images locally:
   ```bash
   npm run generate:images
   ```

2. Commit and push changes

3. CI should NOT regenerate the same images (check PR diff)

4. If you generate a NEW image and commit it, CI should recognize it's already up-to-date

## Best Practices

When creating new SVG templates:

1. **Always use universal fonts**:
   - Sans-serif: `Arial, sans-serif`
   - Monospace: `Courier New, monospace`
   - Never use: `system-ui`, `-apple-system`, `SF Mono`, `Monaco`

2. **Test on multiple platforms** (if possible):
   - Local development
   - CI pipeline
   - Different OS environments

3. **Check `.png-cache.json`**:
   - If a PNG is regenerated unnecessarily, investigate why the SVG hash changed
   - Common causes: whitespace, font family changes, system-dependent rendering

## Related Issues

- Issue #900: Image generation consistency across environments
- PR #905: Initial attempt (closed due to mass regeneration)
- PR #XXX: Minimal fix (scripts only)

## References

- [Resvg Documentation](https://github.com/yisibl/resvg-js)
- [Universal Web Safe Fonts](https://www.w3.org/Style/Examples/007/fonts.en.html)
