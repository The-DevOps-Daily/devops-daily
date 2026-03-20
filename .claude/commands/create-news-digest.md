# Create a DevOps Weekly News Digest

Create a new weekly news digest for DevOps Daily: $ARGUMENTS

If no specific week/year is given, use the current week and year.

## Content Location & Format

- Save as: `content/news/<YYYY>/week-<N>.md`
- Format: Markdown with YAML frontmatter

## Frontmatter

```yaml
---
title: 'DevOps Weekly Digest - Week <N>, <YYYY>'
date: '<YYYY-MM-DD>'
summary: '<Emoji-rich 1-2 sentence summary of the week highlights>'
---
```

## Content Structure

Start with a pinned intro line, then organize news into emoji-prefixed `##` sections. Each news item uses an `###` sub-header.

```markdown
> 📌 **Handpicked by DevOps Daily** - Your weekly dose of curated DevOps news and updates!

---

## ⚓ Kubernetes

### 📄 Article Title Here

Brief 1-2 sentence snippet describing what the article covers.

**📅 Mar 16, 2026** • **📰 Source Name**

[**🔗 Read more**](https://example.com/article-url)

## ☁️ Cloud Native

### 📄 Another Article Title

Description snippet...

**📅 Mar 15, 2026** • **📰 Source Name**

[**🔗 Read more**](https://example.com/url)
```

### Standard Sections (use the ones relevant to the week's news)

- `## ⚓ Kubernetes`
- `## ☁️ Cloud Native`
- `## 🔄 CI/CD`
- `## 🏗️ IaC` (Infrastructure as Code)
- `## 📊 Observability`
- `## 🔐 Security`
- `## 💾 Databases`
- `## 🌐 Platforms`
- `## 📰 Misc`

## Style Rules

- Each section should have 4-8 news items
- Use emoji prefixes in section headers and the `summary` field
- Each news item is an `### 📄 Title` sub-header, NOT a bullet list
- Each item includes: snippet, date + source line, and read-more link
- Date format: `**📅 Mon DD, YYYY**`
- Source format: `**📰 Source Name**`
- Link format: `[**🔗 Read more**](url)`
- Focus on practical impact — "what does this mean for DevOps engineers?"
- Include version numbers for releases
- Link to primary sources, not aggregator sites
- Target 40-60 total news items across all sections

## OG Image

After creating the digest, remind the user to generate the OG image:
```bash
npm run generate:images:parallel
npm run convert:svg-to-png:parallel
```

## Checklist

- [ ] File is in correct year directory
- [ ] Week number is correct
- [ ] Date in frontmatter is accurate
- [ ] Summary has emojis
- [ ] Starts with the pinned intro line
- [ ] Sections use emoji-prefixed `##` headers
- [ ] News items use `### 📄` format with snippet, date/source, and link
- [ ] All links are valid
- [ ] Sections cover breadth of DevOps topics
- [ ] 40-60 total news items
