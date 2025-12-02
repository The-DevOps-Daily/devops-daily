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
- `quiz-template-security.svg` - Purple-blue theme for security/networking quizzes
- `quiz-template-devops.svg` - Orange-amber theme for DevOps/CI-CD quizzes
- `quiz-template-cloud.svg` - Blue theme for cloud/infrastructure quizzes
- `quiz-template-sre.svg` - Red-orange theme for SRE/operations quizzes

## Quick Start

**For Quizzes (Using Generator):**
```bash
# Generate quiz OG image with automatic theme
pnpm generate-quiz-og \
  --title "Kubernetes Security Quiz" \
  --category "Security" \
  --slug "kubernetes-security-quiz" \
  --theme security
```

**For Exercises (Manual Method):**
```bash
# 1. Copy template
cp templates/svg/exercise-template-default.svg public/images/exercises/my-exercise.svg

# 2. Edit file and replace:
#    {{TITLE}} → Your Exercise Title
#    {{CATEGORY}} → DOCKER

# 3. Convert to PNG
pnpm run convert:svg-to-png:parallel
```

## Quiz OG Image Generator

The automated quiz OG image generator creates both SVG and PNG files with proper XML escaping and multi-line title support.

**Usage:**
```bash
pnpm generate-quiz-og --title "Title" --category "Category" --slug "slug" [--theme theme]
```

**Available Themes:**
- `default` - Purple gradient (general quizzes)
- `security` - Purple-blue gradient (security, networking)
- `devops` - Orange-amber gradient (DevOps, CI/CD, automation)
- `cloud` - Blue gradient (cloud platforms, infrastructure)
- `sre` - Red-orange gradient (SRE, operations, monitoring)

**Examples:**
```bash
# Security quiz
pnpm generate-quiz-og \
  --title "Network & Security Fundamentals" \
  --category "Networking/Security" \
  --slug "network-security-quiz" \
  --theme security

# DevOps quiz
pnpm generate-quiz-og \
  --title "Jenkins Pipeline Quiz" \
  --category "CI/CD" \
  --slug "jenkins-quiz" \
  --theme devops

# Cloud quiz
pnpm generate-quiz-og \
  --title "AWS Solutions Architect Quiz" \
  --category "Cloud Computing" \
  --slug "aws-quiz" \
  --theme cloud
```

**Features:**
- Automatic XML character escaping (`&`, `<`, `>`, `"`, `'`)
- Multi-line title support (automatically splits long titles)
- Dynamic category badge width calculation
- Automatic PNG generation from SVG
- Responsive font sizing based on title length

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
