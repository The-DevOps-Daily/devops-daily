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

### Shared renderer

- \`scripts/og-utils.ts\` owns the adaptive 1200x630 cover layout.
- \`scripts/generate-content-og.ts\` discovers and generates every supported content type.
- \`scripts/generate-quiz-og.ts\` remains available for CLI compatibility and uses the same renderer.
- The code-native templates cover posts, guides, exercises, news, Advent entries,
  quizzes, games, checklists, interview questions, comparisons, flashcards, and tools.
- \`pnpm regenerate:content-covers\` deliberately regenerates the complete active
  content library, prunes unreferenced intermediate SVGs, and validates every cover.

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

# Generate missing images

pnpm generate:images

# Render and pixel-check all current content without writing files

pnpm validate:images

# Check git status - only NEW content should show modified images

git status

# Verify no regeneration on subsequent runs

pnpm generate:images
git status # Should show no changes
\`\`\`

## Migration

The initial migration regenerated every active content cover so old and new content
use the same layout. The files keep their existing public paths and names, so route
metadata does not need to change.

After migration, normal generation remains intentionally idempotent:

- \`pnpm generate:images\` creates covers that do not exist yet
- \`pnpm validate:images\` renders and checks the full active library without writing files
- \`pnpm regenerate:content-covers\` is the explicit full-regeneration path for future design changes
