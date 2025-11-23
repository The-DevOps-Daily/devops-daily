# SVG Templates for DevOps Daily

Reusable SVG templates for creating consistent, professional images for exercises and quizzes.

## Available Templates

**Exercise Templates:**
- `exercise-template-default.svg` - Generic blue theme
- `exercise-template-docker.svg` - Docker/container theme
- `exercise-template-kubernetes.svg` - Kubernetes theme

**Quiz Templates:**
- `quiz-template-default.svg` - Purple theme
- `quiz-template-green.svg` - Green achievement theme

## Quick Start

```bash
# 1. Copy template
cp templates/svg/exercise-template-default.svg public/images/exercises/my-exercise.svg

# 2. Edit file and replace:
#    {{TITLE}} → Your Exercise Title
#    {{CATEGORY}} → DOCKER

# 3. Convert to PNG
pnpm run convert:svg-to-png:parallel
```

## Customization

**Change Colors:**
Edit gradient colors in the `<defs>` section:
```xml
<linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
  <stop offset="0%" style="stop-color:#YOUR_COLOR;..."/>
  <stop offset="100%" style="stop-color:#YOUR_COLOR;..."/>
</linearGradient>
```

**Multi-line Titles:**
Duplicate the `<text>` element and adjust `y` values:
```xml
<text x="80" y="280" ...>First Line</text>
<text x="80" y="350" ...>Second Line</text>
```

**Adjust Text:**
- `font-size` - Size in pixels
- `font-weight` - normal, bold, 600, 700
- `fill` - Color (hex or named)
- `x`, `y` - Position

## Standard Dimensions

All templates are **1200x630px** (Open Graph standard) for optimal social media display.

## Best Practices

- Use large font sizes (48px+) for readability
- Test on mobile devices
- Keep text high contrast against background
- Escape special characters: `&` `<` `>` `"` `'`
- Keep SVGs under 50KB when possible

## Converting to PNG

```bash
# Fast parallel conversion
pnpm run convert:svg-to-png:parallel

# Or standard conversion
pnpm run convert:svg-to-png
```
