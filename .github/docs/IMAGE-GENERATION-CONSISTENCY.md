# Image Generation Consistency

## Problem

PNG images generated from SVG templates were producing different outputs across environments (local macOS vs Linux CI), causing hundreds of images to be unnecessarily regenerated in PRs.

### Root Cause

1. **System-dependent fonts**: SVG templates used `font-family="system-ui, -apple-system, sans-serif"`
   - macOS renders with San Francisco font
   - Linux CI renders with Liberation Sans, DejaVu Sans, or other system defaults
   - Different fonts → different text rendering → different PNG hashes

2. **Hash-based caching**: `.png-cache.json` stores SVG content hashes to avoid unnecessary regeneration
   - When SVG → PNG conversion produces different output, hash mismatch triggers regeneration
   - This is correct behavior, but the underlying cause (font differences) was the issue

### Example Impact

PR #898 showed 100+ images being regenerated despite no content changes, just because the images were generated on a different machine with different system fonts.

## Solution

### Use Universal Fonts

Replaced system-dependent fonts with **Arial**, which is:
- ✅ Available on Windows, macOS, and Linux by default
- ✅ Consistent rendering across platforms
- ✅ Professional appearance
- ✅ Good readability at various sizes

### Changes Made

**Before:**
\`\`\`typescript
font-family="system-ui, -apple-system, sans-serif"
\`\`\`

**After:**
\`\`\`typescript
font-family="Arial, sans-serif"
\`\`\`

### Files Modified

- \`scripts/generate-post-images-svg.ts\` - Post OG images (news, guides, exercises, advent)
- \`scripts/generate-post-images-svg-parallel.ts\` - Parallel version for faster generation
- \`scripts/generate-checklist-images-svg.ts\` - Checklist OG images
- \`scripts/generate-interview-images-svg.ts\` - Interview question OG images
- \`scripts/generate-quiz-og.ts\` - Quiz OG images

## Benefits

1. **Consistent output**: Same SVG → Same PNG on all machines
2. **Smaller PRs**: Only modified content triggers image regeneration
3. **Faster CI**: No unnecessary PNG regeneration/upload
4. **Better caching**: \`.png-cache.json\` works reliably across environments

## Future Considerations

### Why Not Disable System Fonts?

We considered using Resvg's \`loadSystemFonts: false\` option, but this causes **text to disappear entirely** from images when SVG references fonts that aren't embedded. Since we don't embed fonts in SVGs, this approach doesn't work.

### Why Arial?

- **Universal availability**: Ships with all major operating systems
- **Fallback compatibility**: If Arial is missing (rare), \`sans-serif\` provides a reasonable fallback
- **Professional**: Widely used for web graphics and branding
- **Performance**: No need to embed/load custom fonts

### Alternative Approaches Rejected

1. **Embed fonts in SVG**: Makes files 10-50x larger, complicates licensing
2. **Bundle font files**: Requires font file management, licensing concerns
3. **Disable system fonts**: Causes text rendering to fail completely
4. **Accept inconsistency**: Results in unnecessarily large PRs and slow CI

## Testing

To verify consistency:

\`\`\`bash
# Generate images
npm run generate:images

# Check git status - only NEW content should show modified images
git status

# Verify no regeneration on subsequent runs
npm run generate:images
git status  # Should show no changes
\`\`\`

## Migration

**Important:** This change only affects **new** image generation. Existing PNG files are NOT modified unless their source content changes.

- When new posts/guides/checklists are added, their OG images will use Arial
- Existing images will be regenerated naturally over time as content is updated
- No mass regeneration is needed or performed
