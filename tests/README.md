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

### 3. SEO Validation (`seo-validation.test.ts`)

Validates SEO best practices for all content:

- **Title Length**: Warns if titles exceed 70 characters (Google truncation limit)
- **Excerpt Length**: Warns if excerpts exceed 160 characters (meta description limit)
- **Meta Descriptions**: Ensures posts have meta descriptions
- **Author Information**: Validates author data is present and complete

Note: SEO checks are soft warnings and won't fail builds.

### 4. Content Quality (`content-quality.test.ts`)

Ensures content meets quality standards:

- **Code Block Syntax**: Warns about code blocks missing language specifiers
- **Link Validity**: Checks that markdown links are properly formatted
- **Heading Structure**: Validates heading hierarchy (H1, H2, H3)
- **Content Length**: Ensures posts have meaningful content (soft check)

### 5. Quiz Validation (`quiz-validation.test.ts`)

Validates quiz structure when quizzes are present:

- **Quiz Structure**: Ensures quizzes have required fields (title, description, difficulty)
- **Questions**: Validates question array structure and correct answers
- **Difficulty Levels**: Checks valid difficulty values (beginner, intermediate, advanced)
- **Question Count**: Ensures minimum of 5 questions per quiz

Skipped if no quiz content exists.

### 6. News Validation (`news-validation.test.ts`)

Validates news item structure when news content is present:

- **News Structure**: Ensures news items have required frontmatter
- **Content Integrity**: Validates news content format and links

Skipped if no news content exists.

## Running Tests

### Run all tests

```bash
pnpm test
```

The test suite displays a quality summary at the end showing non-blocking warnings:

```
================================================================================
📊 Test Quality Summary
================================================================================

⚠️  Quality Warnings (Non-blocking):
   - ~165 posts with SEO title/excerpt optimization opportunities
   - ~545 files with code blocks missing language specifiers
   - 0 broken internal links detected

✅ All critical validations passed!
ℹ️  Warnings are recommendations only and won't fail builds.
================================================================================
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
- **Link checker**: Validate external links don't return 404s
- **Accessibility tests**: Basic a11y checks with axe-core
- **Performance tests**: Bundle size limits
- **E2E tests**: Critical user journeys with Playwright
- **Visual regression**: Screenshot comparison for key pages

## Notes

- Most quality checks are soft warnings (won't fail builds) to allow flexibility
- Quiz and news tests skip gracefully when content doesn't exist
- Tests run in Node environment (no browser required)
- SEO warnings help improve search engine visibility but aren't enforced
- Code block language specifiers improve syntax highlighting but aren't required
