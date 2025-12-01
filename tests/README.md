# DevOps Daily Test Suite

This directory contains automated tests for the DevOps Daily static site.

## Test Categories

### 1. Markdown Validation (`markdown-validation.test.ts`)

Validates the integrity and structure of all markdown content:

- **Posts**: Ensures all posts have required frontmatter fields (title, excerpt, publishedAt, author, category, tags)
- **Guides**: Validates guide structure including index.md and parts array
- **Advent of DevOps**: Checks that all 25 days exist with proper frontmatter

### 2. Data Integrity (`data-integrity.test.ts`)

Ensures data consistency across the site:

- **Internal Links**: Checks for broken relative links in markdown
- **Image References**: Validates that referenced images exist (soft check)
- **Unique Slugs**: Ensures no duplicate post or guide slugs
- **Category Consistency**: Verifies category usage is reasonable

## Running Tests

### Run all tests

```bash
pnpm test
```

### Run tests in watch mode

```bash
pnpm test:watch
```

### Run tests with UI

```bash
pnpm test:ui
```

## CI/CD Integration

Tests automatically run on:

- Pull requests to `main` branch
- Pushes to `main` branch

See `.github/workflows/tests.yml` for the CI configuration.

## Test Philosophy

These tests focus on **build-time validation** that can run quickly without requiring a full Next.js build:

- ✅ Fast feedback loop (< 10 seconds)
- ✅ No build required
- ✅ Catches common content errors
- ✅ Validates data integrity

## Adding New Tests

When adding new test files:

1. Create files with the pattern `*.test.ts` in this directory
2. Use Vitest's `describe`, `it`, and `expect` functions
3. Focus on validations that provide value and catch real issues
4. Keep tests fast and independent

## Future Improvements

Potential additions for the test suite:

- **Post-build validation**: Test generated HTML output
- **SEO checks**: Validate meta tags and Open Graph data
- **Accessibility tests**: Basic a11y checks
- **Performance tests**: Bundle size limits
- **E2E tests**: Critical user journeys with Playwright

## Notes

- Image reference checking is currently a soft check (warnings only) to avoid false positives
- Some validations are intentionally lenient to allow flexibility in content
- Tests run in Node environment (no browser required)
