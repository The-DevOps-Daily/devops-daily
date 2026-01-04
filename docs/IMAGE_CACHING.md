# Image Generation and Caching

This document explains how image generation and caching works in the DevOps Daily project.

## Overview

The build process generates OG (Open Graph) images for posts, guides, exercises, news, and checklists. To optimize build times, we implement intelligent caching to avoid regenerating images that haven't changed.

## Image Generation Scripts

### 1. SVG Generation (`generate-post-images-svg-parallel.ts`)

Generates SVG OG images for all content types.

**Caching Strategy:**
- Checks if SVG file exists using `fs.stat()`
- Uses persistent metadata cache (`.image-cache.json`)
- Compares content hash (MD5 of title + category) with cached hash
- Skips generation only if file exists AND hash matches
- Detects all content changes regardless of file age
- Parallel batch checking (50 items at a time) for performance
- Use `--force` flag to regenerate all images

**Usage:**
```bash
# Normal build (with caching)
npm run generate:images:parallel

# Force regenerate all images
npx tsx scripts/generate-post-images-svg-parallel.ts --force
```

**Output:**
- Shows total content items
- Shows how many are up to date (cached)
- Shows how many need generation
- Displays progress bar during generation

### 2. PNG Conversion (`convert-svg-to-png-parallel.ts`)

Converts SVG images to PNG format for social media compatibility.

**Caching Strategy:**
- Checks if PNG file exists
- Compares file modification times (mtime)
- Skips conversion if PNG is newer than SVG
- Use `--force` flag to regenerate all PNGs

**Usage:**
```bash
# Normal build (with caching)
npm run convert:svg-to-png:parallel

# Force regenerate all PNGs
npx tsx scripts/convert-svg-to-png-parallel.ts --force
```

**Output:**
- Shows total SVG files found
- Shows which files need conversion
- Displays progress bar during conversion
- Shows time statistics

## Build Process

The main build command in `package.json`:

```json
"build": "npm run generate:images:parallel && npm run convert:svg-to-png:parallel && npm run copy:markdown && npm run generate-search-index && next build && npm run generate-feed && npm run copy:markdown:out"
```

## Performance Impact

### First Build (No Cache)
- Generates all SVG images
- Converts all SVGs to PNGs
- **Time:** Same as before (~30-60s for images)

### Subsequent Builds (With Cache)
- Skips unchanged SVG generation
- Skips unchanged PNG conversion
- **Time:** 50-70% faster (~5-15s for images)
- Only regenerates changed content
- Cache checking uses metadata file (no SVG I/O)

### CI/CD Builds
- Benefits from caching if images + `.image-cache.json` are committed
- Or use `--force` to always regenerate

## Cache Invalidation

Images are regenerated when:

1. **Content Changes:**
   - New content added
   - Title changes in any post (detected via hash comparison)
   - Category changes in any post (detected via hash comparison)
   - Existing SVG deleted or corrupted (< 500 bytes)
   - Cache file deleted or corrupted

2. **Force Flag:**
   - `--force` flag bypasses all caching
   - Useful for template changes
   - Useful for debugging

3. **File Deletion:**
   - If SVG or PNG is deleted, it will be regenerated

## Examples

### Local Development

```bash
# Normal development (fast builds)
npm run build

# Add new post
# Only new post image will be generated
npm run build

# Changed post title
# Only changed post image will be regenerated
npm run build

# Force regenerate everything (template change)
npx tsx scripts/generate-post-images-svg-parallel.ts --force
npx tsx scripts/convert-svg-to-png-parallel.ts --force
npm run build
```

### CI/CD Pipeline

**Option 1: Commit Images (Recommended)**
```bash
# Images are committed to repo
# Build only regenerates changed images
npm run build
```

**Option 2: Always Regenerate**
```bash
# Don't commit images
# Always generate fresh
npx tsx scripts/generate-post-images-svg-parallel.ts --force
npx tsx scripts/convert-svg-to-png-parallel.ts --force
npm run build
```

## Debugging

### Check Which Images Need Regeneration

```bash
# Dry run - see what would be generated
npx tsx scripts/generate-post-images-svg-parallel.ts
# Output shows: "✅ Already up to date: X"
# Output shows: "🔄 To generate: Y"
```

### Force Regenerate Specific Type

```bash
# Delete all post images
rm -rf public/images/posts/*.svg
rm -rf public/images/posts/*.png

# Rebuild - only posts will be regenerated
npm run build
```

## Best Practices

1. **Commit Generated Images:**
   - Faster CI/CD builds
   - Consistent across environments
   - Version controlled

2. **Use Force Sparingly:**
   - Only when templates change
   - Only when debugging
   - Slows down builds

3. **Monitor Build Times:**
   - Check build logs for cache hits
   - Verify expected number of regenerations

4. **Clean Builds:**
   - Occasionally run with `--force`
   - Ensures all images are fresh
   - Good for releases

## Troubleshooting

### Images Not Updating

```bash
# Force regenerate
npx tsx scripts/generate-post-images-svg-parallel.ts --force
npx tsx scripts/convert-svg-to-png-parallel.ts --force
```

### Build Taking Too Long

```bash
# Check if caching is working
npm run generate:images:parallel
# Should show: "✅ Already up to date: X"

# If not, check file permissions
ls -la public/images/posts/
```

### Missing Images

```bash
# Regenerate all images
npm run generate:images:parallel
npm run convert:svg-to-png:parallel
```

## Future Improvements

- [x] Parallel cache checking (batches of 50)
- [x] Persistent metadata cache (.image-cache.json)
- [x] Content hash-based caching (detects all changes)
- [ ] Cache statistics reporting
- [ ] Automated cache cleanup
- [ ] Cache versioning for template changes
- [ ] Parallel cache file writes
